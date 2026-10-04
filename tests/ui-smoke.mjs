import assert from "node:assert/strict"
import { readFile, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8446"
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["dev", "--port", "8446"], { stdio: "ignore", detached: true })
const fixture = await readFile(
  new URL("./fixtures/supabase.mjs", import.meta.url),
  "utf8",
)
const artifacts = new URL("../.cache/ui/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
let browser
let checks = 0
const errors = []
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 39) throw Error("Vite failed to start")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  async function pageFor(scenario = {}, width = 390) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    })
    await context.addInitScript((value) => {
      window.__scenario = value
    }, scenario)
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: fixture }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => {
      errors.push(error.message)
    })
    return page
  }
  async function visit(page, path, heading) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: heading, exact: true }).waitFor()
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Overflow at ${path}`,
    )
    checks++
  }
  async function accessible(page) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    assert.deepEqual(
      violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    )
    checks++
  }
  // All public routes, with no invented values in the public product preview.
  const publicPages = [
    ["/", "Gardez le fil de vos devis."],
    ["/login", "Connexion"],
    ["/signup", "Créer un compte"],
    ["/forgot-password", "Mot de passe oublié"],
    ["/reset-password", "Nouveau mot de passe"],
    ["/privacy", "Politique de confidentialité"],
    ["/terms", "Conditions d’utilisation"],
    ["/legal-notice", "Mentions légales"],
    ["/cookies", "Cookies et stockage local"],
  ]
  for (const width of [320, 390, 768, 1280]) {
    const page = await pageFor({}, width)
    for (const [path, heading] of publicPages) {
      await visit(page, path, heading)
      if (width === 390) await accessible(page)
    }
    await page.context().close()
    console.log(`PASS: responsive ${width}px`)
  }
  const landing = await pageFor()
  await visit(landing, "/", publicPages[0][1])
  await landing.screenshot({ path: `${artifacts}landing-mobile.png`, fullPage: true })
  await landing.getByRole("button", { name: "Ouvrir le menu" }).click()
  await landing
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: "Le suivi" })
    .click()
  assert.equal(
    await landing
      .getByRole("button", { name: "Ouvrir le menu" })
      .getAttribute("aria-expanded"),
    "false",
  )
  await visit(landing, "/app", "Connexion") // guard remains effective
  await landing.getByLabel("Email").fill("test@example.test")
  await landing.getByLabel(/^Mot de passe/).fill("invalid")
  await landing.getByRole("button", { name: "Se connecter" }).click()
  await landing
    .getByRole("alert")
    .filter({ hasText: "Email ou mot de passe incorrect." })
    .waitFor()
  await landing.getByLabel(/^Mot de passe/).fill("valid-password")
  await landing.getByRole("button", { name: "Se connecter" }).click()
  await landing.getByRole("heading", { name: "Tableau de bord", exact: true }).waitFor()
  checks++
  await landing.context().close()

  const appPages = [
    ["/app", "Tableau de bord"],
    ["/app/clients", "Clients"],
    ["/app/clients/new", "Nouveau client"],
    ["/app/clients/client-test", "Client de test"],
    ["/app/clients/client-test/edit", "Modifier le client"],
    ["/app/quotes", "Devis"],
    ["/app/quotes/new", "Nouveau devis"],
    ["/app/quotes/quote-test", "TEST-001"],
    ["/app/quotes/quote-test/edit", "Modifier le devis"],
    ["/app/settings", "Paramètres"],
  ]
  for (const width of [320, 390, 768, 1280]) {
    const page = await pageFor({ session: true }, width)
    for (const [path, heading] of appPages) {
      await visit(page, path, heading)
      if (width === 390) await accessible(page)
    }
    await page.context().close()
    console.log(`PASS: responsive ${width}px`)
  }
  const app = await pageFor({ session: true })
  await visit(app, "/app", "Tableau de bord")
  await app.screenshot({ path: `${artifacts}dashboard-mobile.png`, fullPage: true })
  await app.getByRole("button", { name: "Ouvrir le menu" }).click()
  await app.keyboard.press("Escape")
  assert.equal(
    await app
      .getByRole("button", { name: "Ouvrir le menu" })
      .getAttribute("aria-expanded"),
    "false",
  )
  await app
    .getByRole("button", { name: /^Notifications/ })
    .first()
    .click()
  const panel = app.getByRole("region", { name: "Notifications", exact: true })
  await panel.waitFor()
  const rect = await panel.boundingBox()
  assert.ok(rect.y >= 0 && rect.x >= 0 && rect.x + rect.width <= 390)
  await app.keyboard.press("Escape")
  await visit(app, "/app/quotes", "Devis")
  await app.getByLabel("Rechercher un devis par client ou référence").fill("TEST-002")
  await app.getByRole("link", { name: "TEST-002", exact: true }).waitFor()
  assert.equal(
    await app.getByRole("link", { name: "TEST-001", exact: true }).count(),
    0,
  )
  await app.getByLabel("Rechercher un devis par client ou référence").fill("")
  await app.getByLabel("Trier les devis").selectOption("waiting")
  await app.getByRole("button", { name: "Pipeline", exact: true }).click()
  await app.getByRole("heading", { name: "À relancer", exact: true }).waitFor()
  await app.getByRole("button", { name: "À relancer", exact: true }).click()
  assert.equal(await app.getByRole("link").filter({ hasText: "TEST-002" }).count(), 0)
  await visit(app, "/app/quotes/quote-test", "TEST-001")
  await app.getByRole("button", { name: "Préparer la relance" }).click()
  const dialog = app.getByRole("dialog", { name: "Préparer la relance" })
  await dialog.waitFor()
  await accessible(app)
  await dialog.screenshot({ path: `${artifacts}followup-mobile.png` })
  await app.keyboard.press("Escape")
  assert.equal(await dialog.count(), 0)
  assert.equal(
    await app
      .getByRole("button", { name: "Préparer la relance" })
      .evaluate((el) => el === document.activeElement),
    true,
  )
  await app.getByRole("button", { name: "Préparer la relance" }).click()
  await app.getByRole("button", { name: "Deuxième relance" }).click()
  await app.getByRole("button", { name: "Copier", exact: true }).click()
  assert.match(await app.evaluate(() => navigator.clipboard.readText()), /TEST-001/)
  assert.match(
    await app.getByRole("link", { name: "Ouvrir l’email" }).getAttribute("href"),
    /^mailto:/,
  )

  await app.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await app.getByText("Relance effectuée", { exact: true }).waitFor()
  await app.getByLabel("Note ou réponse reçue").fill("Réponse de test")
  await app.getByRole("button", { name: "Ajouter", exact: true }).click()
  await app.getByText("Réponse de test", { exact: true }).waitFor()
  await app.getByLabel("Date de la prochaine relance").fill("2027-01-01")
  await app.getByRole("button", { name: "Planifier" }).click()
  await app.getByText("Relance planifiée", { exact: true }).waitFor()
  await app.getByRole("button", { name: "Marquer accepté" }).click()
  await app.getByRole("button", { name: "Marquer accepté" }).waitFor()
  assert.equal(
    await app.evaluate(() => window.__testStore.quotes[0].status),
    "accepted",
  )
  checks += 7
  await visit(app, "/app/clients/new", "Nouveau client")
  await app.getByLabel("Nom / raison sociale").fill("Nouveau client de test")
  await app.getByLabel("Email").fill("new@example.test")
  await app.getByRole("button", { name: "Créer le client" }).click()
  await app.getByRole("heading", { name: "Nouveau client de test" }).waitFor()
  assert.equal(await app.evaluate(() => window.__testStore.clients.length), 2)
  await visit(app, "/app/quotes/new", "Nouveau devis")
  await app.getByLabel(/^Client/).selectOption("client-test")
  await app.getByLabel("Référence").fill("TEST-CREATE")
  await app.getByLabel("Montant (€)").fill("123,45")
  await app.getByRole("button", { name: "Créer le devis" }).click()
  await app.getByRole("heading", { name: "TEST-CREATE" }).waitFor()
  assert.equal(
    await app.evaluate(
      () =>
        window.__testStore.quotes.find((q) => q.reference === "TEST-CREATE")
          .amount_cents,
    ),
    12345,
  )
  await visit(app, "/app/settings", "Paramètres")
  await app.getByRole("switch").click()
  assert.equal(await app.getByRole("switch").getAttribute("aria-checked"), "false")
  await app.getByLabel("Délai avant relance").selectOption("7")
  await app.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await app.getByText("Préférences enregistrées").waitFor()
  assert.equal(
    await app.evaluate(() => window.__testStore.company_members[0].followup_delay_days),
    7,
  )
  checks += 4
  await app.getByLabel("Nom de l'entreprise").fill("Entreprise renommée")
  await app.getByRole("button", { name: "Renommer" }).click()
  await app.getByText("Nom mis à jour").waitFor()
  assert.equal(
    await app.evaluate(() => window.__testStore.companies[0].name),
    "Entreprise renommée",
  )
  await visit(app, "/app/clients/client-test/edit", "Modifier le client")
  await app.getByLabel("Nom / raison sociale").fill("Client modifié")
  await app.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await app.getByRole("heading", { name: "Client modifié", exact: true }).waitFor()
  await visit(app, "/app/quotes/quote-test/edit", "Modifier le devis")
  await app.getByLabel("Référence").fill("TEST-EDIT")
  await app.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await app.getByRole("heading", { name: "TEST-EDIT", exact: true }).waitFor()
  await app.getByRole("button", { name: "Marquer refusé" }).click()
  await app.getByText("Refusé", { exact: true }).waitFor()
  await app.getByRole("button", { name: "Dupliquer" }).click()
  await app.getByRole("heading", { name: "Modifier le devis", exact: true }).waitFor()
  assert.equal(await app.getByLabel("Statut").inputValue(), "draft")
  assert.equal(await app.getByLabel("Date d’envoi").inputValue(), "")
  await app.getByRole("button", { name: "Ouvrir le menu" }).click()
  await app.getByRole("button", { name: "Déconnexion" }).click()
  await app.getByRole("heading", { name: "Connexion", exact: true }).waitFor()
  checks += 8
  await app.context().close()

  const auth = await pageFor()
  await visit(auth, "/signup", "Créer un compte")
  await auth.getByLabel("Email").fill("test@example.test")
  await auth.getByLabel(/^Mot de passe/).fill("valid-password")
  await auth.getByRole("button", { name: "Créer mon compte" }).click()
  await auth.getByRole("heading", { name: "Vérifiez votre email" }).waitFor()
  await visit(auth, "/forgot-password", "Mot de passe oublié")
  await auth.getByLabel("Email").fill("test@example.test")
  await auth.getByRole("button", { name: "Envoyer le lien" }).click()
  await auth.getByText(/Un email de réinitialisation a été envoyé/).waitFor()
  await visit(auth, "/reset-password", "Nouveau mot de passe")
  await auth.getByLabel("Nouveau mot de passe").fill("new-password")
  await auth.getByLabel("Confirmer le mot de passe").fill("new-password")
  await auth.getByRole("button", { name: "Mettre à jour le mot de passe" }).click()
  await auth.getByText(/Mot de passe mis à jour/).waitFor()
  checks += 3
  await auth.context().close()

  async function submitSignup(page, email) {
    await visit(page, "/signup", "Créer un compte")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel(/^Mot de passe/).fill("valid-password")
    await page.getByRole("button", { name: "Créer mon compte" }).click()
  }

  const existingEmail = "existing@example.test"
  for (const [scenario, width] of [
    ["user_already_exists", 320],
    ["email_exists", 390],
    ["legacy_duplicate", 390],
    ["hidden_duplicate", 390],
  ]) {
    const duplicate = await pageFor({ signup: scenario }, width)
    await submitSignup(duplicate, ` ${existingEmail} `)
    const alert = duplicate
      .getByRole("alert")
      .filter({ hasText: "Un compte existe déjà avec cette adresse." })
    await alert.waitFor()
    const login = alert.getByRole("link", { name: /Se connecter ici/ })
    assert.equal(await login.getAttribute("href"), "/login")
    assert.equal(
      await duplicate.getByRole("heading", { name: "Vérifiez votre email" }).count(),
      0,
      "Existing accounts must not receive a false confirmation screen",
    )
    const bounds = await alert.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
    assert.equal(
      await duplicate.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Duplicate-account alert overflow at ${width}px`,
    )
    checks += 4
    if (scenario === "user_already_exists" || scenario === "email_exists") {
      await accessible(duplicate)
      await duplicate.screenshot({
        path: `${artifacts}signup-duplicate-${width}.png`,
        fullPage: true,
      })
    }
    if (scenario === "user_already_exists") {
      await login.focus()
      await duplicate.keyboard.press("Enter")
      await duplicate.getByRole("heading", { name: "Connexion", exact: true }).waitFor()
      assert.equal(new URL(duplicate.url()).pathname, "/login")
      assert.equal(await duplicate.getByLabel("Email").inputValue(), existingEmail)
      assert.equal(await duplicate.getByLabel(/^Mot de passe/).inputValue(), "")
      checks += 3
    }
    if (scenario === "email_exists") {
      await duplicate.getByLabel("Email").fill("new@example.test")
      await alert.waitFor({ state: "detached" })
      assert.equal(
        await duplicate.getByRole("link", { name: /Se connecter ici/ }).count(),
        0,
      )
      await duplicate.getByRole("button", { name: "Créer mon compte" }).click()
      await duplicate.getByRole("heading", { name: "Vérifiez votre email" }).waitFor()
      await duplicate.getByText("new@example.test", { exact: true }).waitFor()
      checks += 2
    }
    await duplicate.context().close()
  }

  const missingIdentity = await pageFor({ signup: "identities_missing" })
  await submitSignup(missingIdentity, "new@example.test")
  await missingIdentity.getByRole("heading", { name: "Vérifiez votre email" }).waitFor()
  assert.equal(await missingIdentity.getByRole("alert").count(), 0)
  await missingIdentity.context().close()
  checks++

  const rateLimited = await pageFor({ signup: "rate_limit" })
  await submitSignup(rateLimited, existingEmail)
  const rateAlert = rateLimited.getByRole("alert")
  await rateAlert.filter({ hasText: "Trop de tentatives." }).waitFor()
  assert.equal(await rateAlert.getByRole("link").count(), 0)
  assert.equal(
    await rateLimited.getByRole("link", { name: /Se connecter ici/ }).count(),
    0,
  )
  assert.equal(
    await rateLimited.getByRole("heading", { name: "Vérifiez votre email" }).count(),
    0,
  )
  await rateLimited.context().close()
  checks += 3

  const directSignup = await pageFor({ signup: "session", member: false })
  await submitSignup(directSignup, "new@example.test")
  await directSignup
    .getByRole("heading", { name: "Votre espace entreprise", exact: true })
    .waitFor()
  assert.equal(new URL(directSignup.url()).pathname, "/onboarding")
  assert.equal(await directSignup.getByRole("alert").count(), 0)
  await directSignup.context().close()
  checks += 2

  const empty = await pageFor({ session: true, empty: true })
  await visit(empty, "/app", "Tableau de bord")
  await empty.getByRole("heading", { name: "Rien à suivre pour l’instant" }).waitFor()
  await visit(empty, "/app/quotes/new", "Nouveau devis")
  await empty.getByRole("button", { name: "Créer un client" }).waitFor()
  await empty.context().close()
  const onboarding = await pageFor({ session: true, member: false })
  await visit(onboarding, "/app", "Votre espace entreprise")
  await onboarding.getByLabel("Nom de votre entreprise").fill("Espace de test")
  await onboarding.getByRole("button", { name: "Créer mon espace" }).click()
  await onboarding
    .getByRole("heading", { name: "Tableau de bord", exact: true })
    .waitFor()
  await onboarding.context().close()
  const failed = await pageFor({ session: true, fail: true })
  await failed.goto(`${base}/app/quotes`)
  await failed
    .getByRole("alert")
    .filter({ hasText: "Impossible de charger les devis." })
    .waitFor()
  await failed.getByRole("button", { name: "Réessayer" }).waitFor()
  await failed.context().close()
  checks += 3
  const assets = await pageFor()
  for (const path of ["/favicon.svg", "/favicon.png", "/social-card.png"])
    assert.equal((await assets.request.get(`${base}${path}`)).status(), 200)
  await assets.context().close()
  checks += 3
  assert.deepEqual(errors, [], "Unexpected browser errors")
  console.log(
    `PASS: ${checks} contrôles, pages publiques et privées sur 4 largeurs, accessibilité et interactions avec Supabase simulé.`,
  )
} finally {
  await browser?.close()
  if (server?.pid) process.kill(-server.pid, "SIGTERM")
}
