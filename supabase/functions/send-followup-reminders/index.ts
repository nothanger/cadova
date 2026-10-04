/**
 * Cadova FollowUp — Edge Function : send-followup-reminders
 *
 * Exécutée chaque matin vers 08:00 Europe/Paris via un pg_cron job.
 * Pour chaque utilisateur actif qui a des devis à relancer (status=sent, sent_at <= J-3)
 * et dont email_followup_reminders = true :
 *   1. Crée une notification daily_followup_summary (idempotente via index unique)
 *   2. Envoie un email de résumé via Resend
 *
 * Variables d'environnement requises (côté Supabase secrets) :
 *   RESEND_API_KEY   — clé API Resend (jamais exposée au frontend)
 *   RESEND_FROM      — adresse expéditrice vérifiée, ex. "Cadova <hello@cadova.app>"
 *   APP_URL          — URL publique de l'application, ex. "https://app.cadova.app"
 *
 * Sécurité : la fonction est appelée par le scheduler avec le header Authorization
 * contenant la SUPABASE_SERVICE_ROLE_KEY, jamais depuis le frontend.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FOLLOWUP_DAYS = 3

interface QuoteRow {
  id: string
  reference: string
  amount_cents: number
  sent_at: string
  client: { name: string } | null
}

interface MemberRow {
  user_id: string
  company_id: string
  companies: { name: string } | null
}

Deno.serve(async (req) => {
  // Only accept calls from the scheduler (service role key in Authorization)
  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!authHeader.includes(serviceKey)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? ""
  const resendFrom =
    Deno.env.get("RESEND_FROM") ?? "Cadova <noreply@cadova.app>"
  const appUrl = Deno.env.get("APP_URL") ?? "https://app.cadova.app"

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const today = todayParis()
  const threshold = addDays(today, -FOLLOWUP_DAYS)

  // 1. Récupérer tous les membres qui ont activé les rappels email
  const { data: members, error: membersErr } = await db
    .from("company_members")
    .select("user_id, company_id, companies:company_id (name)")
    .eq("email_followup_reminders", true)

  if (membersErr) {
    console.error("[reminders] failed to fetch members", membersErr.message)
    return new Response("DB error", { status: 500 })
  }

  const results: string[] = []

  for (const member of members as unknown as MemberRow[] ?? []) {
    const { user_id, company_id } = member

    // 2. Devis à relancer pour cette entreprise
    const { data: quotes, error: quotesErr } = await db
      .from("quotes")
      .select("id, reference, amount_cents, sent_at, client:clients (name)")
      .eq("company_id", company_id)
      .eq("status", "sent")
      .lte("sent_at", threshold)
      .order("sent_at", { ascending: true })

    if (quotesErr) {
      console.error(
        `[reminders] quotes error for company ${company_id}`,
        quotesErr.message,
      )
      continue
    }

    const dueQuotes = quotes as unknown as QuoteRow[] ?? []
    if (dueQuotes.length === 0) continue // Pas d'email si rien à relancer

    // The service role bypasses RLS: check the current Auth state before any
    // notification or email, including when the user still holds an old JWT.
    const { data: authUser, error: authErr } =
      await db.auth.admin.getUserById(user_id)
    if (authErr || !authUser?.user?.email) {
      console.error(`[reminders] cannot get email for user ${user_id}`)
      continue
    }
    const bannedUntil = authUser.user.banned_until
    if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) continue
    const userEmail = authUser.user.email

    const totalCents = dueQuotes.reduce((s, q) => s + q.amount_cents, 0)
    const totalFormatted = formatEur(totalCents)
    const count = dueQuotes.length

    // 3. Créer la notification (idempotente — l'index unique empêche les doublons)
    const { error: notifErr } = await db.from("notifications").insert({
      company_id,
      user_id,
      type: "daily_followup_summary",
      title: `${count} devis à relancer aujourd'hui`,
      message: `Montant total en attente : ${totalFormatted}`,
      related_quote_id: null,
      notification_date: today,
    })

    if (notifErr && notifErr.code !== "23505") {
      // 23505 = unique_violation = déjà créée aujourd'hui → OK
      console.error(
        `[reminders] notif insert error for user ${user_id}`,
        notifErr.message,
      )
    }

    // 4. Envoyer l'email via Resend
    if (!resendKey) {
      console.warn("[reminders] RESEND_API_KEY not set — skipping email send")
      results.push(`skipped:${user_id}`)
      continue
    }

    const html = buildEmailHtml({
      count,
      totalFormatted,
      quotes: dueQuotes,
      appUrl,
    })
    const text = buildEmailText({
      count,
      totalFormatted,
      quotes: dueQuotes,
      appUrl,
    })

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: userEmail,
        subject: `${count} devis à relancer aujourd'hui`,
        html,
        text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[reminders] Resend error for ${userEmail}`, body)
      results.push(`error:${user_id}`)
    } else {
      results.push(`sent:${user_id}`)
    }
  }

  return new Response(JSON.stringify({ date: today, results }), {
    headers: { "Content-Type": "application/json" },
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayParis(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" })
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("fr-CA")
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

function buildEmailHtml({
  count,
  totalFormatted,
  quotes,
  appUrl,
}: {
  count: number
  totalFormatted: string
  quotes: QuoteRow[]
  appUrl: string
}): string {
  const rows = quotes
    .slice(0, 10)
    .map(
      (q) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${q.client?.name ?? "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;color:#6b7280;">${q.reference}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;text-align:right;">${formatEur(q.amount_cents)}</td>
      </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,system-ui,sans-serif;color:#0b1020;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="background:#5a5cff;padding:24px 32px;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Cadova</p>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0b1020;">${count} devis à relancer aujourd'hui</h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Montant total en attente : <strong style="color:#0b1020;">${totalFormatted}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Référence</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Montant</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${
        quotes.length > 10
          ? `<p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">+ ${quotes.length - 10} autre(s) devis — ouvrez Cadova pour tout voir.</p>`
          : ""
      }
      <div style="margin-top:32px;text-align:center;">
        <a href="${appUrl}/app" style="display:inline-block;background:#5a5cff;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
          Ouvrir Cadova
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Vous recevez cet email car vous utilisez Cadova FollowUp.<br>
        Pour vous désabonner, désactivez les rappels dans vos <a href="${appUrl}/app/settings" style="color:#5a5cff;">paramètres</a>.
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildEmailText({
  count,
  totalFormatted,
  quotes,
  appUrl,
}: {
  count: number
  totalFormatted: string
  quotes: QuoteRow[]
  appUrl: string
}): string {
  const lines = quotes
    .slice(0, 10)
    .map(
      (q) =>
        `- ${q.client?.name ?? "—"} · ${q.reference} · ${formatEur(q.amount_cents)}`,
    )
    .join("\n")

  return `Cadova FollowUp

${count} devis à relancer aujourd'hui
Montant en attente : ${totalFormatted}

${lines}
${quotes.length > 10 ? `\n+ ${quotes.length - 10} autre(s) devis` : ""}

Ouvrir Cadova : ${appUrl}/app

---
Pour désactiver ces rappels : ${appUrl}/app/settings`
}
