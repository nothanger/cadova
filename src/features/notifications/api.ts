import { supabase } from "@/lib/supabase"
import type {
  Notification,
  PaginatedItems,
  SupportMessage,
  SupportThread,
} from "./types"

export type { Notification } from "./types"

function pagination(page: number, pageSize: number) {
  const size = Number.isFinite(pageSize)
    ? Math.min(50, Math.max(1, Math.floor(pageSize)))
    : 25
  const index = Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0
  return { index, size, start: index * size }
}

function paginatedItems<T>(items: T[], pageSize: number): PaginatedItems<T> {
  return {
    items: items.slice(0, pageSize),
    hasMore: items.length > pageSize,
  }
}

export async function listUnreadNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw error
  return count ?? 0
}

/** Page indexes start at zero. RLS restricts this history to the current user. */
export async function listNotificationHistory(
  page = 0,
  pageSize = 25,
): Promise<PaginatedItems<Notification>> {
  const { size, start } = pagination(page, pageSize)
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + size)
  if (error) throw error
  return paginatedItems((data ?? []) as Notification[], size)
}

export async function getNotification(id: string): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data as Notification
}

/** The server limits ordinary accounts to their own support conversation. */
export async function listSupportThreads(
  page = 0,
  pageSize = 25,
): Promise<PaginatedItems<SupportThread>> {
  const { index, size } = pagination(page, pageSize)
  const { data, error } = await supabase.rpc("list_support_threads", {
    p_page: index + 1,
    p_page_size: size,
  })
  if (error) throw error
  return paginatedItems((data ?? []) as SupportThread[], size)
}

/** Each page contains the newest messages first, with a stable secondary order. */
export async function listSupportMessages(
  threadId: string,
  page = 0,
  pageSize = 25,
): Promise<PaginatedItems<SupportMessage>> {
  const { size, start } = pagination(page, pageSize)
  const { data, error } = await supabase
    .from("support_messages")
    .select("id, thread_id, sender_id, sender_role, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + size)
  if (error) throw error
  return paginatedItems((data ?? []) as SupportMessage[], size)
}

/** Reuse requestId when retrying the same send to avoid duplicate messages. */
export async function sendSupportMessage(
  body: string,
  threadId: string | null,
  requestId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("send_support_message", {
    p_body: body,
    p_thread_id: threadId,
    p_request_id: requestId,
  })
  if (error) throw error
  if (typeof data !== "string" || !data) {
    throw new Error("La confirmation de l’envoi est indisponible.")
  }
  return data
}

export async function markSupportThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_support_thread_read", {
    p_thread_id: threadId,
  })
  if (error) throw error
}

export function notificationAPIError(
  error: unknown,
  fallback = "Impossible de charger les notifications. Réessayez.",
): string {
  const detail =
    typeof error === "object" && error !== null
      ? (error as { code?: string; message?: string })
      : null
  if (["28000", "PGRST301", "PGRST302"].includes(detail?.code ?? "")) {
    return "Votre session a expiré. Reconnectez-vous pour continuer."
  }
  if (detail?.code === "42501") {
    return "Vous n’avez pas accès à cette conversation."
  }
  if (["23503", "P0002"].includes(detail?.code ?? "")) {
    return "Cette conversation ou son destinataire n’est plus disponible."
  }
  if (detail?.code === "22023") {
    return "Vérifiez votre message, puis réessayez."
  }
  if (/fetch|network|connection/i.test(detail?.message ?? "")) {
    return "La connexion a été interrompue. Réessayez."
  }
  return fallback
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw error
}

export async function markOneRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function getEmailPreference(
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("company_members")
    .select("email_followup_reminders")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .single()
  if (error) throw error
  return data?.email_followup_reminders ?? true
}

export async function setEmailPreference(
  userId: string,
  companyId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("company_members")
    .update({ email_followup_reminders: enabled })
    .eq("user_id", userId)
    .eq("company_id", companyId)
  if (error) throw error
}

export interface ReminderPrefs {
  followupDelayDays: number
  reminderHour: number
}

export async function getReminderPrefs(
  userId: string,
  companyId: string,
): Promise<ReminderPrefs> {
  const { data, error } = await supabase
    .from("company_members")
    .select("followup_delay_days, reminder_hour")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .single()
  if (error) throw error
  return {
    followupDelayDays: data?.followup_delay_days ?? 3,
    reminderHour: data?.reminder_hour ?? 8,
  }
}

export async function setReminderPrefs(
  userId: string,
  companyId: string,
  prefs: Partial<ReminderPrefs>,
): Promise<void> {
  const update: Record<string, number> = {}
  if (prefs.followupDelayDays !== undefined)
    update.followup_delay_days = prefs.followupDelayDays
  if (prefs.reminderHour !== undefined) update.reminder_hour = prefs.reminderHour
  const { error } = await supabase
    .from("company_members")
    .update(update)
    .eq("user_id", userId)
    .eq("company_id", companyId)
  if (error) throw error
}
