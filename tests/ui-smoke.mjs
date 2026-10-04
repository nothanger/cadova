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
  await app.getByLabel("Note de suivi").fill("Réponse de test")
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

  const anonymousAdmin = await pageFor()
  await visit(anonymousAdmin, "/admin", "Connexion")
  assert.equal(new URL(anonymousAdmin.url()).pathname, "/login")
  await anonymousAdmin.context().close()
  const regularAdmin = await pageFor({ session: true })
  await visit(regularAdmin, "/admin", "Accès réservé")
  assert.equal(
    await regularAdmin.getByText("delete-me@example.test", { exact: true }).count(),
    0,
  )
  await regularAdmin.getByRole("link", { name: "Retour à mon espace" }).click()
  await regularAdmin
    .getByRole("heading", { name: "Tableau de bord", exact: true })
    .waitFor()
  await regularAdmin.context().close()
  checks += 2

  for (const width of [320, 390, 1280]) {
    const responsiveAdmin = await pageFor(
      { session: true, admin: true, member: false },
      width,
    )
    await visit(responsiveAdmin, "/admin", "Administration")
    await responsiveAdmin
      .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
      .waitFor()
    await accessible(responsiveAdmin)
    await responsiveAdmin.screenshot({
      path: `${artifacts}admin-accounts-${width}.png`,
      fullPage: true,
    })
    await responsiveAdmin
      .getByRole("button", { name: "Entreprises", exact: true })
      .click()
    await responsiveAdmin
      .getByRole("button", {
        name: "Ouvrir l’entreprise Autre entreprise",
        exact: true,
      })
      .waitFor()
    assert.equal(
      await responsiveAdmin.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    )
    await accessible(responsiveAdmin)
    await responsiveAdmin.screenshot({
      path: `${artifacts}admin-companies-${width}.png`,
      fullPage: true,
    })
    await responsiveAdmin.getByRole("button", { name: "Comptes", exact: true }).click()
    await responsiveAdmin
      .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
      .click()
    const dialog = responsiveAdmin.getByRole("dialog", { name: "Supprimer le compte" })
    await dialog.waitFor()
    const rect = await dialog.boundingBox()
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width)
    await accessible(responsiveAdmin)
    await dialog.screenshot({ path: `${artifacts}admin-delete-${width}.png` })
    await responsiveAdmin.keyboard.press("Escape")
    assert.equal(await dialog.count(), 0)
    await responsiveAdmin.context().close()
    checks += 3
  }

  const admin = await pageFor({ admin: true, member: false }, 1280)
  await visit(admin, "/login", "Connexion")
  await admin.getByLabel("Email").fill("test@example.test")
  await admin.getByLabel(/^Mot de passe/).fill("valid-password")
  await admin.getByRole("button", { name: "Se connecter", exact: true }).click()
  await admin.getByRole("heading", { name: "Administration", exact: true }).waitFor()
  assert.equal(new URL(admin.url()).pathname, "/admin")
  assert.equal(
    await admin
      .getByRole("heading", { name: "Votre espace entreprise", exact: true })
      .count(),
    0,
  )
  await admin
    .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
    .waitFor()
  for (const email of ["test@example.test", "second-admin@example.test"]) {
    const row = admin.getByRole("row").filter({ hasText: email })
    await row.getByText("Compte protégé", { exact: true }).waitFor()
    for (const action of ["Supprimer", "Suspendre", "Réactiver"]) {
      assert.equal(
        await row
          .getByRole("button", { name: `${action} ${email}`, exact: true })
          .evaluateAll((buttons) => buttons.some((button) => !button.disabled)),
        false,
        `Protected account ${email} must not offer ${action}`,
      )
    }
    checks++
  }
  const accountPagination = admin.getByRole("navigation", {
    name: "Pagination des comptes",
  })
  assert.ok(
    await accountPagination
      .getByRole("button", { name: "Page précédente" })
      .isDisabled(),
  )
  await accountPagination.getByRole("button", { name: "Page suivante" }).click()
  await admin.getByText("extra-26@example.test", { exact: true }).waitFor()
  assert.equal(
    await admin
      .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
      .count(),
    0,
  )
  assert.ok(
    await accountPagination.getByRole("button", { name: "Page suivante" }).isDisabled(),
  )
  await accountPagination.getByRole("button", { name: "Page précédente" }).click()
  await admin
    .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
    .waitFor()
  checks += 4

  for (const [action, title, nextAction] of [
    ["Réactiver", "Réactiver le compte", "Suspendre"],
    ["Suspendre", "Suspendre le compte", "Réactiver"],
  ]) {
    await admin
      .getByRole("button", { name: `${action} suspended@example.test`, exact: true })
      .click()
    const dialog = admin.getByRole("dialog", { name: title })
    await dialog.getByRole("button", { name: title, exact: true }).click()
    await dialog.waitFor({ state: "detached" })
    await admin
      .getByRole("button", {
        name: `${nextAction} suspended@example.test`,
        exact: true,
      })
      .waitFor()
    checks++
  }

  const deleteAccount = admin.getByRole("button", {
    name: "Supprimer delete-me@example.test",
    exact: true,
  })
  await deleteAccount.focus()
  await admin.keyboard.press("Enter")
  const deleteDialog = admin.getByRole("dialog", { name: "Supprimer le compte" })
  const deleteConfirm = deleteDialog.getByRole("button", {
    name: "Supprimer définitivement",
    exact: true,
  })
  await deleteDialog.waitFor()
  assert.ok(await deleteConfirm.isDisabled())
  await deleteDialog.getByLabel("Adresse email du compte").fill("wrong@example.test")
  assert.ok(await deleteConfirm.isDisabled())
  await admin.keyboard.press("Escape")
  assert.equal(await deleteDialog.count(), 0)
  assert.equal(
    await deleteAccount.evaluate((button) => button === document.activeElement),
    true,
  )
  assert.equal(await admin.evaluate(() => window.__adminTestStore.users.length), 32)
  await deleteAccount.click()
  await deleteDialog
    .getByLabel("Adresse email du compte")
    .fill("delete-me@example.test")
  assert.ok(await deleteConfirm.isEnabled())
  await deleteConfirm.focus()
  await admin.keyboard.press("Enter")
  await deleteDialog.waitFor({ state: "detached" })
  await admin
    .getByRole("status")
    .filter({ hasText: "Le compte delete-me@example.test a été supprimé." })
    .waitFor()
  assert.equal(
    await admin
      .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
      .count(),
    0,
  )
  assert.equal(
    await admin.evaluate(() =>
      window.__adminTestStore.users.some((account) => account.id === "user-delete"),
    ),
    false,
  )
  checks += 8

  await admin
    .getByRole("button", { name: "Supprimer owner-other@example.test", exact: true })
    .click()
  const ownerDelete = admin.getByRole("dialog", { name: "Supprimer le compte" })
  await ownerDelete
    .getByLabel("Adresse email du compte")
    .fill("owner-other@example.test")
  await ownerDelete.getByRole("button", { name: "Supprimer définitivement" }).click()
  await ownerDelete
    .getByRole("alert")
    .filter({ hasText: "Transférez d’abord la propriété de l’entreprise." })
    .waitFor()
  assert.ok(await ownerDelete.isVisible())
  await ownerDelete.getByRole("button", { name: "Annuler", exact: true }).click()
  assert.equal(
    await admin.evaluate(() =>
      window.__adminTestStore.users.some((account) => account.id === "user-owner"),
    ),
    true,
  )
  checks += 2

  await admin.getByRole("button", { name: "Entreprises", exact: true }).click()
  const companyPagination = admin.getByRole("navigation", {
    name: "Pagination des entreprises",
  })
  await companyPagination.getByRole("button", { name: "Page suivante" }).click()
  await admin.getByText("Entreprise supplémentaire 30", { exact: true }).waitFor()
  assert.ok(
    await companyPagination.getByRole("button", { name: "Page suivante" }).isDisabled(),
  )
  await companyPagination.getByRole("button", { name: "Page précédente" }).click()
  await admin
    .getByRole("button", {
      name: "Transférer la propriété de Autre entreprise",
      exact: true,
    })
    .click()
  const transfer = admin.getByRole("dialog", { name: "Transférer la propriété" })
  const transferConfirm = transfer.getByRole("button", {
    name: "Transférer la propriété",
    exact: true,
  })
  assert.ok(await transferConfirm.isDisabled())
  await transfer
    .getByRole("radio", { name: "future-owner@example.test", exact: true })
    .check()
  assert.ok(await transferConfirm.isDisabled())
  await transfer
    .getByRole("checkbox", {
      name: "Je confirme ce transfert de propriété.",
      exact: true,
    })
    .check()
  await transferConfirm.click()
  await transfer.waitFor({ state: "detached" })
  await admin
    .getByRole("row")
    .filter({ hasText: "Autre entreprise" })
    .getByText("future-owner@example.test", { exact: true })
    .waitFor()
  assert.equal(
    await admin.evaluate(
      () =>
        window.__testStore.company_members.find(
          (member) =>
            member.company_id === "company-other" && member.user_id === "user-owner",
        ).role,
    ),
    "member",
  )
  assert.equal(
    await admin.evaluate(
      () =>
        window.__adminTestStore.companies.find((entry) => entry.id === "company-other")
          .owners[0].id,
    ),
    "user-transfer",
  )
  checks += 5

  await admin
    .getByRole("button", { name: "Ouvrir l’entreprise Autre entreprise", exact: true })
    .click()
  await admin.getByRole("heading", { name: "Tableau de bord", exact: true }).waitFor()
  await admin.getByRole("link", { name: "Clients", exact: true }).click()
  await admin.getByRole("heading", { name: "Clients", exact: true }).waitFor()
  await admin
    .getByRole("link", { name: "Client autre entreprise", exact: true })
    .waitFor()
  assert.equal(
    await admin.getByRole("link", { name: "Client de test", exact: true }).count(),
    0,
  )
  await admin.getByRole("link", { name: "Devis", exact: true }).click()
  await admin.getByRole("heading", { name: "Devis", exact: true }).waitFor()
  await admin.getByRole("link", { name: "OTHER-001", exact: true }).waitFor()
  assert.equal(
    await admin.getByRole("link", { name: "TEST-001", exact: true }).count(),
    0,
  )
  await admin.getByRole("link", { name: "Changer d’entreprise", exact: true }).click()
  await admin.getByRole("heading", { name: "Administration", exact: true }).waitFor()
  assert.equal(new URL(admin.url()).pathname, "/admin")
  await admin.context().close()
  checks += 4

  const failingAdmin = await pageFor({
    session: true,
    admin: true,
    member: false,
    adminFailure: "delete_user",
  })
  await visit(failingAdmin, "/admin", "Administration")
  await failingAdmin
    .getByRole("button", { name: "Supprimer delete-me@example.test", exact: true })
    .click()
  const failedDelete = failingAdmin.getByRole("dialog", { name: "Supprimer le compte" })
  await failedDelete
    .getByLabel("Adresse email du compte")
    .fill("delete-me@example.test")
  await failedDelete
    .getByRole("button", { name: "Supprimer définitivement", exact: true })
    .click()
  await failedDelete
    .getByRole("alert")
    .filter({ hasText: "Le serveur de test n’a pas pu effectuer cette action." })
    .waitFor()
  assert.ok(await failedDelete.isVisible())
  assert.ok(
    await failedDelete
      .getByRole("button", { name: "Supprimer définitivement", exact: true })
      .isEnabled(),
  )
  assert.equal(
    await failingAdmin.evaluate(() =>
      window.__adminTestStore.users.some((account) => account.id === "user-delete"),
    ),
    true,
  )
  await failedDelete.screenshot({ path: `${artifacts}admin-delete-error.png` })
  await failedDelete.getByRole("button", { name: "Annuler", exact: true }).click()
  await failingAdmin.context().close()
  checks += 3

  const anonymousMessages = await pageFor()
  await visit(anonymousMessages, "/notifications", "Connexion")
  assert.equal(new URL(anonymousMessages.url()).pathname, "/login")
  await anonymousMessages.context().close()

  const firstContact = await pageFor({
    session: true,
    member: false,
    messaging: true,
    messagingEmpty: true,
    messagingDelay: 150,
  })
  await visit(firstContact, "/notifications?view=messages", "Notifications et messages")
  await firstContact
    .getByRole("heading", { name: "Contacter Cadova", exact: true })
    .waitFor()
  assert.equal(
    await firstContact
      .getByRole("button", { name: "Envoyer une notification", exact: true })
      .count(),
    0,
  )
  const firstMessage = firstContact.getByLabel("Votre message")
  const sendFirst = firstContact.getByRole("button", {
    name: "Envoyer le message",
    exact: true,
  })
  assert.ok(await sendFirst.isDisabled())
  await firstMessage.fill("   ")
  assert.ok(await sendFirst.isDisabled())
  await firstMessage.fill("a".repeat(4001))
  assert.equal((await firstMessage.inputValue()).length, 4000)
  await firstMessage.fill("Premier message sans entreprise")
  await sendFirst.evaluate((button) => {
    button.click()
    button.click()
  })
  await firstContact
    .getByRole("list", { name: "Historique de la conversation", exact: true })
    .getByText("Premier message sans entreprise", { exact: true })
    .waitFor()
  assert.equal(await firstMessage.inputValue(), "")
  assert.equal(
    await firstContact.evaluate(
      () =>
        window.__testStore.support_messages.filter(
          (message) => message.body === "Premier message sans entreprise",
        ).length,
    ),
    1,
  )
  assert.equal(
    await firstContact.evaluate(
      () =>
        new Set(
          window.__messagingCalls
            .filter((call) => call.name === "send_support_message")
            .map((call) => call.args.p_request_id),
        ).size,
    ),
    1,
  )
  assert.equal(
    await firstContact.evaluate(
      () => window.__testStore.support_messages[0].sender_role,
    ),
    "user",
  )
  await firstContact.reload({ waitUntil: "networkidle" })
  await firstContact
    .getByRole("list", { name: "Historique de la conversation", exact: true })
    .getByText("Premier message sans entreprise", { exact: true })
    .waitFor()
  await firstContact.context().close()
  checks += 8

  const ownMessages = await pageFor({ session: true, messaging: true }, 1280)
  await visit(ownMessages, "/app", "Tableau de bord")
  await ownMessages
    .getByRole("button", { name: "Notifications (3 non lues)", exact: true })
    .waitFor()
  await ownMessages
    .getByRole("button", { name: "Notifications (3 non lues)", exact: true })
    .click()
  const messagePanel = ownMessages.getByRole("region", {
    name: "Notifications",
    exact: true,
  })
  await messagePanel
    .getByRole("link", { name: "Réponse de Cadova", exact: true })
    .click()
  await ownMessages
    .getByRole("heading", { name: "Notifications et messages", exact: true })
    .waitFor()
  assert.equal(new URL(ownMessages.url()).searchParams.get("thread"), "thread-test")
  await ownMessages.getByText("Réponse de l’équipe de test", { exact: true }).waitFor()
  assert.equal(
    await ownMessages.evaluate(() =>
      window.__testStore.support_messages.some(
        (message) => message.id === "message-admin-test",
      ),
    ),
    true,
  )
  assert.ok(
    await ownMessages.evaluate(
      () =>
        window.__testStore.notifications.find(
          (notification) => notification.id === "notification-message",
        ).read_at,
    ),
  )
  await ownMessages
    .getByRole("button", { name: "Notifications", exact: true })
    .last()
    .click()
  await ownMessages.getByText("Informations de test", { exact: true }).waitFor()
  await ownMessages
    .getByRole("listitem")
    .filter({ hasText: "Informations de test" })
    .getByRole("link", { name: "Lire le message", exact: true })
    .click()
  const announcementDetail = ownMessages.getByRole("dialog", {
    name: "Informations de test",
    exact: true,
  })
  await announcementDetail
    .getByText("Information conservée après lecture.", { exact: true })
    .waitFor()
  assert.equal(
    new URL(ownMessages.url()).searchParams.get("notification"),
    "notification-announcement",
  )
  await announcementDetail
    .getByRole("button", { name: "Marquer comme lue", exact: true })
    .click()
  assert.ok(
    await ownMessages.evaluate(
      () =>
        window.__testStore.notifications.find(
          (notification) => notification.id === "notification-announcement",
        ).read_at,
    ),
  )
  await announcementDetail
    .getByRole("button", { name: "Fermer le message", exact: true })
    .click()
  await ownMessages
    .getByRole("button", { name: "Tout marquer comme lu", exact: true })
    .click()
  assert.equal(
    await ownMessages.evaluate(
      () =>
        window.__testStore.notifications.filter(
          (notification) =>
            notification.user_id === "user-test" && !notification.read_at,
        ).length,
    ),
    0,
  )
  await ownMessages
    .getByText("Information conservée après lecture.", { exact: true })
    .waitFor()
  await ownMessages.reload({ waitUntil: "networkidle" })
  await ownMessages
    .getByText("Information conservée après lecture.", { exact: true })
    .waitFor()
  await visit(
    ownMessages,
    "/notifications?view=messages&thread=thread-other",
    "Notifications et messages",
  )
  assert.equal(
    await ownMessages.getByText("Question de l’autre compte", { exact: true }).count(),
    0,
  )
  assert.equal(await ownMessages.getByLabel("Votre réponse").count(), 0)
  assert.equal(
    await ownMessages
      .getByRole("button", { name: "Envoyer une notification", exact: true })
      .count(),
    0,
  )
  await ownMessages.context().close()
  checks += 10

  const messagePages = await pageFor({
    session: true,
    member: false,
    messaging: true,
    messagingPages: true,
  })
  await visit(messagePages, "/notifications", "Notifications et messages")
  const historyPagination = messagePages.getByRole("navigation", {
    name: "Pagination des notifications",
    exact: true,
  })
  assert.ok(
    await historyPagination
      .getByRole("button", { name: "Page précédente", exact: true })
      .isDisabled(),
  )
  await historyPagination
    .getByRole("button", { name: "Page suivante", exact: true })
    .click()
  await messagePages.getByText("Information archivée 26", { exact: true }).waitFor()
  assert.ok(
    await historyPagination
      .getByRole("button", { name: "Page suivante", exact: true })
      .isDisabled(),
  )
  assert.equal(
    await messagePages.getByText("Informations de test", { exact: true }).count(),
    0,
  )
  await historyPagination
    .getByRole("button", { name: "Page précédente", exact: true })
    .click()
  await messagePages.getByText("Informations de test", { exact: true }).waitFor()
  await messagePages.getByRole("button", { name: "Messages", exact: true }).click()
  await messagePages.getByText("Réponse de l’équipe de test", { exact: true }).waitFor()
  assert.equal(
    await messagePages.getByText("Ancien message 26", { exact: true }).count(),
    0,
  )
  const messagePagination = messagePages.getByRole("navigation", {
    name: "Pagination des messages",
    exact: true,
  })
  await messagePagination
    .getByRole("button", { name: "Messages précédents", exact: true })
    .click()
  await messagePages.getByText("Ancien message 26", { exact: true }).waitFor()
  assert.equal(
    await messagePages
      .getByText("Réponse de l’équipe de test", { exact: true })
      .count(),
    0,
  )
  assert.ok(
    await messagePagination
      .getByRole("button", { name: "Messages précédents", exact: true })
      .isDisabled(),
  )
  await messagePagination
    .getByRole("button", { name: "Messages suivants", exact: true })
    .click()
  await messagePages.getByText("Réponse de l’équipe de test", { exact: true }).waitFor()
  await messagePages.context().close()
  checks += 8

  const failedMessage = await pageFor({
    session: true,
    member: false,
    messaging: true,
    messagingFailure: "send_support_message",
  })
  await visit(
    failedMessage,
    "/notifications?view=messages",
    "Notifications et messages",
  )
  const retryMessage = failedMessage.getByLabel("Votre message")
  await retryMessage.fill("Message conservé après erreur")
  await failedMessage
    .getByRole("button", { name: "Envoyer le message", exact: true })
    .click()
  await failedMessage
    .getByRole("alert")
    .filter({ hasText: "La connexion a été interrompue. Réessayez." })
    .waitFor()
  assert.equal(await retryMessage.inputValue(), "Message conservé après erreur")
  assert.equal(
    await failedMessage.evaluate(
      () =>
        window.__testStore.support_messages.filter(
          (message) => message.body === "Message conservé après erreur",
        ).length,
    ),
    0,
  )
  await failedMessage.evaluate(() => {
    window.__scenario.messagingFailure = null
  })
  await failedMessage
    .getByRole("button", { name: "Envoyer le message", exact: true })
    .click()
  await failedMessage
    .getByRole("list", { name: "Historique de la conversation", exact: true })
    .getByText("Message conservé après erreur", { exact: true })
    .waitFor()
  assert.equal(
    await failedMessage.evaluate(
      () =>
        new Set(
          window.__messagingCalls
            .filter((call) => call.name === "send_support_message")
            .map((call) => call.args.p_request_id),
        ).size,
    ),
    1,
  )
  await failedMessage.context().close()
  checks += 4

  const failedRead = await pageFor({
    session: true,
    messaging: true,
    messagingFailure: "read_notifications",
  })
  await visit(failedRead, "/notifications", "Notifications et messages")
  await failedRead.getByText("Informations de test", { exact: true }).waitFor()
  await failedRead
    .getByRole("button", { name: "Tout marquer comme lu", exact: true })
    .click()
  await failedRead
    .getByRole("alert")
    .filter({ hasText: "La connexion a été interrompue. Réessayez." })
    .first()
    .waitFor()
  assert.equal(
    await failedRead.evaluate(
      () =>
        window.__testStore.notifications.filter(
          (notification) =>
            notification.user_id === "user-test" && !notification.read_at,
        ).length,
    ),
    3,
  )
  await failedRead
    .getByText("Information conservée après lecture.", { exact: true })
    .waitFor()
  await failedRead.evaluate(() => {
    window.__scenario.messagingFailure = null
  })
  await failedRead
    .getByRole("button", { name: "Tout marquer comme lu", exact: true })
    .click()
  await failedRead.waitForFunction(() =>
    window.__testStore.notifications.every((notification) => notification.read_at),
  )
  await failedRead
    .getByText("Information conservée après lecture.", { exact: true })
    .waitFor()
  await failedRead.context().close()
  checks += 3

  const failedThreads = await pageFor({
    session: true,
    member: false,
    messaging: true,
    messagingFailure: "list_support_threads",
  })
  await visit(
    failedThreads,
    "/notifications?view=messages",
    "Notifications et messages",
  )
  await failedThreads
    .getByRole("alert")
    .filter({ hasText: "La connexion a été interrompue. Réessayez." })
    .waitFor()
  await failedThreads.evaluate(() => {
    window.__scenario.messagingFailure = null
  })
  await failedThreads.getByRole("button", { name: "Réessayer", exact: true }).click()
  await failedThreads
    .getByText("Réponse de l’équipe de test", { exact: true })
    .waitFor()
  await failedThreads.context().close()
  checks += 2

  const adminMessages = await pageFor(
    { session: true, admin: true, member: false, messaging: true, messagingDelay: 150 },
    1280,
  )
  await visit(
    adminMessages,
    "/notifications?view=messages",
    "Notifications et messages",
  )
  await adminMessages
    .getByRole("heading", { name: "Messages reçus", exact: true })
    .waitFor()
  const conversationPagination = adminMessages.getByRole("navigation", {
    name: "Pagination des conversations",
    exact: true,
  })
  await conversationPagination
    .getByRole("button", { name: "Page suivante", exact: true })
    .click()
  await adminMessages
    .getByRole("button", {
      name: "Ouvrir la conversation avec extra-26@example.test",
      exact: true,
    })
    .waitFor()
  assert.ok(
    await conversationPagination
      .getByRole("button", { name: "Page suivante", exact: true })
      .isDisabled(),
  )
  await conversationPagination
    .getByRole("button", { name: "Page précédente", exact: true })
    .click()
  await adminMessages
    .getByRole("button", {
      name: "Ouvrir la conversation avec owner-other@example.test",
      exact: true,
    })
    .click()
  const conversationHistory = adminMessages.getByRole("list", {
    name: "Historique de la conversation",
    exact: true,
  })
  await conversationHistory
    .getByText("Question de l’autre compte", { exact: true })
    .waitFor()
  const adminResponse = adminMessages.getByLabel("Votre réponse")
  await adminResponse.fill("Réponse admin persistante")
  await adminMessages
    .getByRole("button", { name: "Envoyer la réponse", exact: true })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await conversationHistory
    .getByText("Réponse admin persistante", { exact: true })
    .waitFor()
  assert.equal(
    await adminMessages.evaluate(
      () =>
        window.__testStore.support_messages.filter(
          (message) =>
            message.body === "Réponse admin persistante" &&
            message.thread_id === "thread-other" &&
            message.sender_role === "admin",
        ).length,
    ),
    1,
  )
  assert.equal(
    await adminMessages.evaluate(
      () =>
        window.__testStore.notifications.filter(
          (notification) =>
            notification.user_id === "user-owner" &&
            notification.type === "admin_message" &&
            notification.support_thread_id === "thread-other" &&
            notification.company_id === null,
        ).length,
    ),
    1,
  )
  await adminMessages.reload({ waitUntil: "networkidle" })
  await conversationHistory
    .getByText("Réponse admin persistante", { exact: true })
    .waitFor()
  await adminMessages
    .getByRole("button", { name: "Notifications", exact: true })
    .last()
    .click()
  await adminMessages
    .getByRole("button", { name: "Envoyer une notification", exact: true })
    .first()
    .click()
  let composer = adminMessages.getByRole("dialog", {
    name: "Envoyer une notification",
    exact: true,
  })
  await composer.getByLabel("Titre").fill("t".repeat(121))
  assert.equal((await composer.getByLabel("Titre").inputValue()).length, 120)
  await composer.getByLabel("Message").fill("m".repeat(4001))
  assert.equal((await composer.getByLabel("Message").inputValue()).length, 4000)
  await composer.getByLabel("Titre").fill("Information pour tous")
  await composer.getByLabel("Message").fill("Message collectif de test.")
  await composer.getByRole("button", { name: "Vérifier l’envoi", exact: true }).click()
  let preview = adminMessages.getByRole("dialog", {
    name: "Vérifier la notification",
    exact: true,
  })
  await preview.getByText("Information pour tous", { exact: true }).waitFor()
  await preview.getByText("Message collectif de test.", { exact: true }).waitFor()
  assert.equal(
    await adminMessages.evaluate(
      () =>
        window.__messagingCalls.filter(
          (call) => call.name === "send_admin_notification",
        ).length,
    ),
    0,
  )
  await preview
    .getByRole("button", { name: "Confirmer l’envoi", exact: true })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await preview.waitFor({ state: "detached" })
  await adminMessages
    .getByRole("status")
    .filter({ hasText: "Notification envoyée à 31 comptes." })
    .waitFor()
  assert.equal(
    await adminMessages.evaluate(
      () =>
        window.__testStore.notifications.filter(
          (notification) => notification.title === "Information pour tous",
        ).length,
    ),
    31,
  )
  assert.equal(
    await adminMessages.evaluate(() =>
      window.__testStore.notifications.some(
        (notification) =>
          notification.title === "Information pour tous" &&
          notification.user_id === "user-suspended",
      ),
    ),
    false,
  )
  await adminMessages
    .getByRole("button", { name: "Envoyer une notification", exact: true })
    .first()
    .click()
  composer = adminMessages.getByRole("dialog", {
    name: "Envoyer une notification",
    exact: true,
  })
  await composer.getByLabel("Destinataires", { exact: true }).selectOption("one")
  await composer
    .getByRole("radio", { name: "suspended@example.test", exact: true })
    .waitFor()
  assert.ok(
    await composer
      .getByRole("radio", { name: "suspended@example.test", exact: true })
      .isDisabled(),
  )
  const recipientsPagination = composer.getByRole("navigation", {
    name: "Pagination des destinataires",
    exact: true,
  })
  await recipientsPagination
    .getByRole("button", { name: "Destinataires suivants", exact: true })
    .click()
  await composer
    .getByRole("radio", { name: "extra-26@example.test", exact: true })
    .waitFor()
  assert.ok(
    await recipientsPagination
      .getByRole("button", { name: "Destinataires suivants", exact: true })
      .isDisabled(),
  )
  await recipientsPagination
    .getByRole("button", { name: "Destinataires précédents", exact: true })
    .click()
  await composer
    .getByRole("radio", { name: "delete-me@example.test", exact: true })
    .check()
  await composer.getByLabel("Titre").fill("Information individuelle")
  await composer.getByLabel("Message").fill("Message pour un seul compte.")
  await composer.getByRole("button", { name: "Vérifier l’envoi", exact: true }).click()
  preview = adminMessages.getByRole("dialog", {
    name: "Vérifier la notification",
    exact: true,
  })
  await preview.getByText("Pour delete-me@example.test", { exact: true }).waitFor()
  await preview.getByRole("button", { name: "Confirmer l’envoi", exact: true }).click()
  await preview.waitFor({ state: "detached" })
  await adminMessages
    .getByRole("status")
    .filter({ hasText: "Notification envoyée à 1 compte." })
    .waitFor()
  assert.deepEqual(
    await adminMessages.evaluate(() =>
      window.__testStore.notifications
        .filter((notification) => notification.title === "Information individuelle")
        .map((notification) => notification.user_id),
    ),
    ["user-delete"],
  )
  await adminMessages.context().close()
  checks += 17

  const failedBroadcast = await pageFor({
    session: true,
    admin: true,
    member: false,
    messaging: true,
    messagingFailure: "send_admin_notification",
  })
  await visit(failedBroadcast, "/notifications", "Notifications et messages")
  await failedBroadcast
    .getByRole("button", { name: "Envoyer une notification", exact: true })
    .first()
    .click()
  const failedComposer = failedBroadcast.getByRole("dialog", {
    name: "Envoyer une notification",
    exact: true,
  })
  await failedComposer.getByLabel("Titre").fill("Envoi à réessayer")
  await failedComposer.getByLabel("Message").fill("Le texte est conservé.")
  await failedComposer
    .getByRole("button", { name: "Vérifier l’envoi", exact: true })
    .click()
  const failedPreview = failedBroadcast.getByRole("dialog", {
    name: "Vérifier la notification",
    exact: true,
  })
  await failedPreview
    .getByRole("button", { name: "Confirmer l’envoi", exact: true })
    .click()
  await failedPreview.getByRole("alert").waitFor()
  assert.equal(
    await failedBroadcast.evaluate(
      () =>
        window.__testStore.notifications.filter(
          (notification) => notification.title === "Envoi à réessayer",
        ).length,
    ),
    0,
  )
  await failedPreview.getByText("Le texte est conservé.", { exact: true }).waitFor()
  await failedBroadcast.evaluate(() => {
    window.__scenario.messagingFailure = null
  })
  await failedPreview
    .getByRole("button", { name: "Confirmer l’envoi", exact: true })
    .click()
  await failedPreview.waitFor({ state: "detached" })
  assert.equal(
    await failedBroadcast.evaluate(
      () =>
        new Set(
          window.__messagingCalls
            .filter((call) => call.name === "send_admin_notification")
            .map((call) => call.args.p_request_id),
        ).size,
    ),
    1,
  )
  await failedBroadcast.context().close()
  checks += 3

  for (const width of [320, 390, 1280]) {
    const messages = await pageFor(
      { session: true, member: false, messaging: true },
      width,
    )
    await visit(messages, "/notifications", "Notifications et messages")
    await messages.getByText("Informations de test", { exact: true }).waitFor()
    await accessible(messages)
    await messages.screenshot({
      path: `${artifacts}notifications-${width}.png`,
      fullPage: true,
    })
    await messages.getByRole("button", { name: "Messages", exact: true }).click()
    await messages.getByText("Réponse de l’équipe de test", { exact: true }).waitFor()
    assert.equal(
      await messages.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    )
    await accessible(messages)
    await messages.screenshot({
      path: `${artifacts}messages-${width}.png`,
      fullPage: true,
    })
    await messages.context().close()
    const inbox = await pageFor(
      { session: true, admin: true, member: false, messaging: true },
      width,
    )
    await visit(inbox, "/notifications?view=messages", "Notifications et messages")
    await inbox
      .getByRole("button", {
        name: "Ouvrir la conversation avec owner-other@example.test",
        exact: true,
      })
      .click()
    await inbox
      .getByRole("list", { name: "Historique de la conversation", exact: true })
      .getByText("Question de l’autre compte", { exact: true })
      .waitFor()
    await accessible(inbox)
    await inbox.screenshot({
      path: `${artifacts}message-inbox-${width}.png`,
      fullPage: true,
    })
    await inbox
      .getByRole("button", { name: "Envoyer une notification", exact: true })
      .first()
      .click()
    const dialog = inbox.getByRole("dialog", {
      name: "Envoyer une notification",
      exact: true,
    })
    await dialog.waitFor()
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
    await accessible(inbox)
    await dialog.screenshot({ path: `${artifacts}notification-composer-${width}.png` })
    await inbox.keyboard.press("Escape")
    assert.equal(await dialog.count(), 0)
    await inbox.context().close()
    checks += 4
  }

  const companyAdmin = await pageFor(
    {
      session: true,
      admin: true,
      member: false,
      companyManagement: true,
      companyDelay: 150,
    },
    1280,
  )
  await visit(companyAdmin, "/admin", "Administration")
  await companyAdmin.getByRole("button", { name: "Entreprises", exact: true }).click()
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__adminTestStore.users.find((account) => account.id === "user-test")
          .companies.length,
    ),
    0,
  )
  await companyAdmin
    .getByRole("button", { name: "Créer une entreprise", exact: true })
    .click()
  let createCompany = companyAdmin.getByRole("dialog", {
    name: "Créer une entreprise",
    exact: true,
  })
  const companyName = createCompany.getByLabel("Nom de l’entreprise")
  const createConfirm = createCompany.getByRole("button", {
    name: "Créer l’entreprise",
    exact: true,
  })
  await createCompany.getByRole("radio", { name: "test@example.test" }).waitFor()
  assert.ok(
    await createCompany.getByRole("radio", { name: "test@example.test" }).isChecked(),
  )
  assert.ok(
    await createCompany
      .getByRole("radio", { name: "owner-other@example.test" })
      .isDisabled(),
  )
  assert.ok(
    await createCompany
      .getByRole("radio", { name: "suspended@example.test" })
      .isDisabled(),
  )
  assert.ok(await createConfirm.isDisabled())
  await companyName.fill("   ")
  assert.ok(await createConfirm.isDisabled())
  await companyName.fill("n".repeat(121))
  assert.equal((await companyName.inputValue()).length, 120)
  await companyName.fill("Première entreprise admin")
  await createConfirm.evaluate((button) => {
    button.click()
    button.click()
  })
  await createCompany.waitFor({ state: "detached" })
  await companyAdmin
    .getByRole("row")
    .filter({ hasText: "Première entreprise admin" })
    .getByText("test@example.test", { exact: true })
    .waitFor()
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__testStore.companies.filter(
          (entry) => entry.name === "Première entreprise admin",
        ).length,
    ),
    1,
  )
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__companyCalls.filter((call) => call.name === "admin_create_company")
          .length,
    ),
    1,
  )
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__adminTestStore.users.find((account) => account.id === "user-test")
          .companies.length,
    ),
    1,
  )

  await companyAdmin
    .getByRole("button", { name: "Créer une entreprise", exact: true })
    .click()
  createCompany = companyAdmin.getByRole("dialog", {
    name: "Créer une entreprise",
    exact: true,
  })
  await createCompany.getByRole("radio", { name: "test@example.test" }).waitFor()
  assert.ok(
    await createCompany.getByRole("radio", { name: "test@example.test" }).isChecked(),
  )
  assert.ok(
    await createCompany.getByRole("radio", { name: "test@example.test" }).isEnabled(),
  )
  await createCompany
    .getByLabel("Nom de l’entreprise")
    .fill("Deuxième entreprise admin")
  await createCompany
    .getByRole("button", { name: "Créer l’entreprise", exact: true })
    .click()
  await createCompany.waitFor({ state: "detached" })
  await companyAdmin.getByText("Deuxième entreprise admin", { exact: true }).waitFor()
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__adminTestStore.users.find((account) => account.id === "user-test")
          .companies.length,
    ),
    2,
  )

  await companyAdmin
    .getByRole("button", { name: "Créer une entreprise", exact: true })
    .click()
  createCompany = companyAdmin.getByRole("dialog", {
    name: "Créer une entreprise",
    exact: true,
  })
  await createCompany.getByRole("radio", { name: "future-owner@example.test" }).check()
  await createCompany
    .getByLabel("Nom de l’entreprise")
    .fill("Entreprise du propriétaire choisi")
  await createCompany
    .getByRole("button", { name: "Créer l’entreprise", exact: true })
    .click()
  await createCompany.waitFor({ state: "detached" })
  await companyAdmin
    .getByRole("row")
    .filter({ hasText: "Entreprise du propriétaire choisi" })
    .getByText("future-owner@example.test", { exact: true })
    .waitFor()
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__testStore.company_members.filter(
          (member) => member.user_id === "user-transfer",
        ).length,
    ),
    1,
  )
  await companyAdmin
    .getByRole("button", { name: "Créer une entreprise", exact: true })
    .click()
  createCompany = companyAdmin.getByRole("dialog", {
    name: "Créer une entreprise",
    exact: true,
  })
  await createCompany
    .getByRole("radio", { name: "future-owner@example.test" })
    .waitFor()
  assert.ok(
    await createCompany
      .getByRole("radio", { name: "future-owner@example.test" })
      .isDisabled(),
  )
  await companyAdmin.keyboard.press("Escape")
  checks += 15

  await companyAdmin
    .getByRole("button", { name: "Ouvrir l’entreprise Autre entreprise", exact: true })
    .click()
  await companyAdmin
    .getByRole("heading", { name: "Tableau de bord", exact: true })
    .waitFor()
  await companyAdmin
    .getByRole("link", { name: "Changer d’entreprise", exact: true })
    .click()
  await companyAdmin
    .getByRole("heading", { name: "Administration", exact: true })
    .waitFor()
  await companyAdmin.getByRole("button", { name: "Entreprises", exact: true }).click()
  const deleteOtherCompany = companyAdmin.getByRole("button", {
    name: "Supprimer l’entreprise Autre entreprise",
    exact: true,
  })
  await deleteOtherCompany.focus()
  await companyAdmin.keyboard.press("Enter")
  let deleteCompany = companyAdmin.getByRole("dialog", {
    name: "Supprimer l’entreprise",
    exact: true,
  })
  let deleteCompanyConfirm = deleteCompany.getByRole("button", {
    name: "Supprimer définitivement",
    exact: true,
  })
  assert.ok(await deleteCompanyConfirm.isDisabled())
  await deleteCompany
    .getByLabel("Nom de l’entreprise à supprimer")
    .fill("autre entreprise")
  assert.ok(await deleteCompanyConfirm.isDisabled())
  await companyAdmin.keyboard.press("Escape")
  assert.equal(await deleteCompany.count(), 0)
  assert.equal(
    await deleteOtherCompany.evaluate((button) => button === document.activeElement),
    true,
  )
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__companyCalls.filter((call) => call.name === "admin_delete_company")
          .length,
    ),
    0,
  )
  await deleteOtherCompany.click()
  deleteCompany = companyAdmin.getByRole("dialog", {
    name: "Supprimer l’entreprise",
    exact: true,
  })
  deleteCompanyConfirm = deleteCompany.getByRole("button", {
    name: "Supprimer définitivement",
    exact: true,
  })
  await deleteCompany
    .getByLabel("Nom de l’entreprise à supprimer")
    .fill("Autre entreprise")
  await deleteCompanyConfirm.evaluate((button) => {
    button.click()
    button.click()
  })
  await deleteCompany.waitFor({ state: "detached" })
  assert.equal(
    await companyAdmin
      .getByRole("button", {
        name: "Ouvrir l’entreprise Autre entreprise",
        exact: true,
      })
      .count(),
    0,
  )
  assert.equal(
    await companyAdmin.evaluate(
      () =>
        window.__companyCalls.filter((call) => call.name === "admin_delete_company")
          .length,
    ),
    1,
  )
  assert.equal(
    await companyAdmin.evaluate(() => window.__adminTestStore.users.length),
    32,
  )
  assert.equal(
    await companyAdmin.evaluate(() =>
      window.__adminTestStore.users.some((account) => account.id === "user-owner"),
    ),
    true,
  )
  assert.equal(
    await companyAdmin.evaluate(() =>
      window.__testStore.company_members.some(
        (member) => member.company_id === "company-other",
      ),
    ),
    false,
  )
  assert.equal(
    await companyAdmin.evaluate(() =>
      window.__testStore.clients.some(
        (client) => client.company_id === "company-other",
      ),
    ),
    false,
  )
  assert.equal(
    await companyAdmin.evaluate(() =>
      window.__testStore.quotes.some((quote) => quote.company_id === "company-other"),
    ),
    false,
  )
  await visit(companyAdmin, "/app", "Administration")
  assert.equal(new URL(companyAdmin.url()).pathname, "/admin")
  assert.equal(
    await companyAdmin.evaluate(() =>
      window.__testStore.companies.some((entry) => entry.id === "company-other"),
    ),
    false,
  )
  await companyAdmin.getByRole("button", { name: "Entreprises", exact: true }).click()
  await companyAdmin
    .getByRole("button", {
      name: "Ouvrir l’entreprise Première entreprise admin",
      exact: true,
    })
    .click()
  await companyAdmin
    .getByRole("heading", { name: "Tableau de bord", exact: true })
    .waitFor()
  await companyAdmin.context().close()
  checks += 13

  const staleOwner = await pageFor(
    { session: true, admin: true, member: false, companyManagement: true },
    1280,
  )
  await visit(staleOwner, "/admin", "Administration")
  await staleOwner.getByRole("button", { name: "Entreprises", exact: true }).click()
  await staleOwner
    .getByRole("button", { name: "Créer une entreprise", exact: true })
    .click()
  const staleDialog = staleOwner.getByRole("dialog", {
    name: "Créer une entreprise",
    exact: true,
  })
  await staleDialog.getByRole("radio", { name: "future-owner@example.test" }).check()
  await staleDialog.getByLabel("Nom de l’entreprise").fill("Création à refuser")
  await staleOwner.evaluate(() => {
    window.__testStore.company_members.push({
      company_id: "company-other",
      user_id: "user-transfer",
      role: "member",
    })
  })
  await staleDialog
    .getByRole("button", { name: "Créer l’entreprise", exact: true })
    .click()
  await staleDialog.getByRole("alert").waitFor()
  assert.equal(
    await staleDialog.getByLabel("Nom de l’entreprise").inputValue(),
    "Création à refuser",
  )
  assert.equal(
    await staleOwner.evaluate(() =>
      window.__testStore.companies.some((entry) => entry.name === "Création à refuser"),
    ),
    false,
  )
  await staleDialog.getByRole("button", { name: "Annuler", exact: true }).click()
  await staleOwner.context().close()
  checks += 2

  for (const action of ["admin_create_company", "admin_delete_company"]) {
    const failedCompany = await pageFor({
      session: true,
      admin: true,
      member: false,
      companyManagement: true,
      companyFailure: action,
    })
    await visit(failedCompany, "/admin", "Administration")
    await failedCompany
      .getByRole("button", { name: "Entreprises", exact: true })
      .click()
    const creating = action === "admin_create_company"
    await failedCompany
      .getByRole("button", {
        name: creating
          ? "Créer une entreprise"
          : "Supprimer l’entreprise Autre entreprise",
        exact: true,
      })
      .click()
    const dialog = failedCompany.getByRole("dialog", {
      name: creating ? "Créer une entreprise" : "Supprimer l’entreprise",
      exact: true,
    })
    const field = dialog.getByLabel(
      creating ? "Nom de l’entreprise" : "Nom de l’entreprise à supprimer",
    )
    await field.fill(creating ? "Entreprise après erreur" : "Autre entreprise")
    const confirm = dialog.getByRole("button", {
      name: creating ? "Créer l’entreprise" : "Supprimer définitivement",
      exact: true,
    })
    await confirm.click()
    await dialog.getByRole("alert").waitFor()
    assert.equal(
      await field.inputValue(),
      creating ? "Entreprise après erreur" : "Autre entreprise",
    )
    assert.equal(
      await failedCompany.evaluate(() => window.__testStore.companies.length),
      32,
    )
    assert.ok(await confirm.isEnabled())
    await failedCompany.evaluate(() => {
      window.__scenario.companyFailure = null
    })
    await confirm.click()
    await dialog.waitFor({ state: "detached" })
    assert.equal(
      await failedCompany.evaluate(() => window.__testStore.companies.length),
      creating ? 33 : 31,
    )
    assert.equal(
      await failedCompany.evaluate(() => window.__adminTestStore.users.length),
      32,
    )
    await failedCompany.context().close()
    checks += 5
  }

  for (const width of [320, 390, 1280]) {
    const responsiveCompany = await pageFor(
      { session: true, admin: true, member: false, companyManagement: true },
      width,
    )
    await visit(responsiveCompany, "/admin", "Administration")
    await responsiveCompany
      .getByRole("button", { name: "Entreprises", exact: true })
      .click()
    await responsiveCompany
      .getByRole("button", { name: "Créer une entreprise", exact: true })
      .click()
    const createDialog = responsiveCompany.getByRole("dialog", {
      name: "Créer une entreprise",
      exact: true,
    })
    await createDialog.getByRole("radio", { name: "test@example.test" }).waitFor()
    let bounds = await createDialog.boundingBox()
    assert.ok(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= width &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= 900,
    )
    await accessible(responsiveCompany)
    await createDialog.screenshot({
      path: `${artifacts}admin-create-company-${width}.png`,
    })
    await responsiveCompany.keyboard.press("Escape")
    await responsiveCompany
      .getByRole("button", {
        name: "Supprimer l’entreprise Autre entreprise",
        exact: true,
      })
      .click()
    const deleteDialog = responsiveCompany.getByRole("dialog", {
      name: "Supprimer l’entreprise",
      exact: true,
    })
    bounds = await deleteDialog.boundingBox()
    assert.ok(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= width &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= 900,
    )
    await accessible(responsiveCompany)
    await deleteDialog.screenshot({
      path: `${artifacts}admin-delete-company-${width}.png`,
    })
    await responsiveCompany.keyboard.press("Escape")
    await responsiveCompany.context().close()
    checks += 2
  }

  // A late response for one quote must not replace the quote opened meanwhile.
  for (const action of ["status", "note"]) {
    const page = await pageFor({ session: true, quoteMutationDelay: 350 })
    await visit(page, "/app/quotes/quote-test", "TEST-001")
    if (action === "status") {
      await page.getByRole("button", { name: "Marquer accepté" }).click()
    } else {
      await page.getByLabel("Note de suivi").fill("Note réservée au premier devis")
      await page.getByRole("button", { name: "Ajouter", exact: true }).click()
    }
    await page.waitForFunction(() => window.__quoteMutationCalls.length === 1)
    await page.evaluate(() => {
      window.history.pushState({}, "", "/app/quotes/draft-test")
      window.dispatchEvent(new window.PopStateEvent("popstate"))
    })
    await page.getByRole("heading", { name: "TEST-002", exact: true }).waitFor()
    await page.waitForFunction(() => window.__quoteMutationCalls[0].completed)
    assert.equal(
      await page.getByRole("heading", { name: "TEST-001", exact: true }).count(),
      0,
    )
    assert.equal(
      await page.getByRole("heading", { name: "TEST-002", exact: true }).isVisible(),
      true,
    )
    assert.equal(
      await page.evaluate(
        () =>
          window.__testStore.quotes.find((quote) => quote.id === "draft-test").status,
      ),
      "draft",
    )
    assert.equal(
      await page.getByText("Note réservée au premier devis", { exact: true }).count(),
      0,
    )
    assert.equal(await page.getByLabel("Note de suivi").inputValue(), "")
    await page.context().close()
    checks += 5
  }
  console.log("PASS: late manual quote actions retain the current route and draft")

  // Client email automation is opt-in for each quote and separate from manual notes.
  const automationSettings = await pageFor({
    session: true,
    automation: true,
    automationConfigured: false,
    automationDelay: 180,
  })
  await visit(automationSettings, "/app/settings", "Paramètres")
  await automationSettings
    .getByRole("heading", { name: "Emails aux clients" })
    .waitFor()
  assert.equal(
    await automationSettings.getByLabel("Nom affiché dans les emails").inputValue(),
    "Entreprise de test",
  )
  assert.equal(
    await automationSettings
      .getByLabel("Nom affiché dans les emails")
      .getAttribute("readonly"),
    "",
  )
  assert.equal(
    await automationSettings.getByLabel("Adresse de réponse").inputValue(),
    "test@example.test",
  )
  assert.equal(
    await automationSettings.evaluate(
      () => window.__testStore.company_email_settings.length,
    ),
    0,
    "A proposed contact is not implicitly saved",
  )
  await automationSettings.getByLabel("Adresse de réponse").fill("invalid-address")
  await automationSettings
    .getByRole("button", { name: "Enregistrer les coordonnées email" })
    .click()
  assert.equal(
    await automationSettings.evaluate(
      () =>
        window.__automationCalls.filter(
          (call) => call.name === "set_company_email_settings",
        ).length,
    ),
    0,
  )
  await automationSettings.getByLabel("Adresse de réponse").fill("REPLY@example.test")
  await automationSettings
    .getByRole("button", { name: "Enregistrer les coordonnées email" })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await automationSettings
    .getByRole("status")
    .filter({ hasText: "L’adresse de réponse a été enregistrée." })
    .waitFor()
  assert.equal(
    await automationSettings.evaluate(
      () =>
        window.__automationCalls.filter(
          (call) => call.name === "set_company_email_settings",
        ).length,
    ),
    1,
  )
  assert.equal(
    await automationSettings.getByLabel("Adresse de réponse").inputValue(),
    "reply@example.test",
  )
  await automationSettings.reload({ waitUntil: "networkidle" })
  assert.equal(
    await automationSettings.getByLabel("Adresse de réponse").inputValue(),
    "reply@example.test",
  )
  assert.equal(
    await automationSettings.evaluate(
      () => window.__testStore.quote_followup_automations.length,
    ),
    0,
    "Company contact configuration does not opt any quote in",
  )
  await automationSettings.context().close()
  checks += 9

  const automationMember = await pageFor({
    session: true,
    automation: true,
    memberRole: "member",
  })
  await visit(automationMember, "/app/settings", "Paramètres")
  await automationMember.getByRole("heading", { name: "Emails aux clients" }).waitFor()
  assert.equal(
    await automationMember.getByLabel("Adresse de réponse").getAttribute("readonly"),
    "",
  )
  assert.equal(
    await automationMember
      .getByRole("button", { name: "Enregistrer les coordonnées email" })
      .count(),
    0,
  )
  await visit(automationMember, "/app/quotes/quote-test", "TEST-001")
  await automationMember
    .getByRole("button", { name: "Activer les relances automatiques" })
    .waitFor()
  assert.equal(
    await automationMember
      .getByRole("button", { name: "Activer les relances automatiques" })
      .isEnabled(),
    true,
  )
  await automationMember.goto(`${base}/app/quotes/quote-other`, {
    waitUntil: "networkidle",
  })
  await automationMember.getByText("Devis introuvable.", { exact: true }).waitFor()
  assert.equal(
    await automationMember
      .getByText("client-other@example.test", { exact: true })
      .count(),
    0,
  )
  await automationMember.context().close()
  checks += 4

  const automationAnonymous = await pageFor({ automation: true })
  await visit(automationAnonymous, "/app/quotes/quote-test", "Connexion")
  assert.equal(
    await automationAnonymous
      .getByRole("button", { name: "Activer les relances automatiques" })
      .count(),
    0,
  )
  await automationAnonymous.context().close()
  checks++

  for (const scenario of [
    {
      serviceReady: false,
      warning: "Le service email n’est pas encore configuré.",
      repair: null,
    },
    {
      automationConfigured: false,
      warning: "Enregistrez une adresse de réponse",
      repair: "Configurer les emails de l’entreprise",
    },
    {
      clientWithoutEmail: true,
      warning: "Le client n’a pas d’adresse email.",
      repair: "Modifier la fiche client",
    },
    {
      quoteStatus: "accepted",
      warning: "L’activation est réservée aux devis envoyés",
      repair: null,
    },
    {
      expiresToday: true,
      warning: "L’activation est réservée aux devis envoyés",
      repair: null,
    },
    {
      companyAutomationPaused: true,
      warning: "Les envois automatiques de cette entreprise sont en pause.",
      repair: null,
    },
  ]) {
    const page = await pageFor({ session: true, automation: true, ...scenario })
    await visit(page, "/app/quotes/quote-test", "TEST-001")
    await page.getByText(scenario.warning, { exact: false }).waitFor()
    assert.equal(
      await page
        .getByRole("button", { name: "Activer les relances automatiques" })
        .isDisabled(),
      true,
    )
    await page.getByRole("button", { name: "Enregistrer les réglages" }).click()
    await page
      .getByRole("status")
      .filter({ hasText: "Aucun envoi automatique n’est activé." })
      .waitFor()
    assert.equal(
      await page.evaluate(
        () =>
          window.__testStore.quote_followup_automations.find(
            (row) => row.quote_id === "quote-test",
          ).enabled,
      ),
      false,
    )
    assert.equal(
      await page.evaluate(() => window.__testStore.quote_followup_jobs.length),
      0,
    )
    if (scenario.repair) {
      await page.getByRole("button", { name: scenario.repair }).click()
      await page
        .getByRole("heading", {
          name: scenario.clientWithoutEmail ? "Modifier le client" : "Paramètres",
          exact: true,
        })
        .waitFor()
    }
    await page.context().close()
    checks += 3
  }
  console.log(
    "PASS: email prerequisites, per-quote consent, company owner and route permissions",
  )

  const automatic = await pageFor({
    session: true,
    automation: true,
    automationDelay: 180,
  })
  await visit(automatic, "/app/quotes/quote-test", "TEST-001")
  await automatic
    .getByRole("button", { name: "Activer les relances automatiques" })
    .waitFor()
  assert.equal(await automatic.getByText("Désactivées", { exact: true }).count(), 1)
  assert.equal(
    await automatic.evaluate(() => window.__testStore.quote_followup_jobs.length),
    0,
  )
  assert.equal(await automatic.getByLabel("Première relance après").inputValue(), "5")
  assert.equal(await automatic.getByLabel("Deuxième relance après").inputValue(), "12")
  assert.equal(
    await automatic.getByLabel("Objet de la relance").getAttribute("maxlength"),
    "160",
  )
  assert.equal(
    await automatic
      .getByLabel("Message de relance automatique")
      .getAttribute("maxlength"),
    "4000",
  )
  await automatic.getByLabel("Deuxième relance après").fill("5")
  assert.equal(
    await automatic
      .getByRole("button", { name: "Activer les relances automatiques" })
      .isDisabled(),
    true,
  )
  await automatic
    .getByText("Le second délai doit dépasser le premier", { exact: false })
    .waitFor()
  await automatic.getByLabel("Deuxième relance après").fill("12")
  await automatic
    .getByLabel("Message de relance automatique")
    .fill("Bonjour {{unknown_variable}}")
  await automatic
    .getByText("La variable « unknown_variable » n’est pas disponible.")
    .waitFor()
  assert.equal(
    await automatic.getByRole("button", { name: "Voir l’aperçu" }).isDisabled(),
    true,
  )
  await automatic
    .getByLabel("Message de relance automatique")
    .fill(
      "Bonjour {{ client_name }}, pouvez-vous répondre au devis {{quote_reference}} de {{amount_formatted}} ?\n{{company_name}}",
    )
  await automatic.getByRole("button", { name: "Voir l’aperçu" }).click()
  const automaticPreview = automatic.getByRole("dialog", {
    name: "Aperçu de la relance automatique",
  })
  await automaticPreview.waitFor()
  await automaticPreview.getByText("client@example.test", { exact: true }).waitFor()
  await automaticPreview.getByText("Votre devis TEST-001", { exact: true }).waitFor()
  await automaticPreview
    .getByText("Bonjour Client de test, pouvez-vous répondre au devis TEST-001 de", {
      exact: false,
    })
    .waitFor()
  assert.match(await automaticPreview.innerText(), /1\s?250,50\s?€/)
  await automaticPreview.getByText("contact@example.test", { exact: true }).waitFor()
  assert.equal(await automaticPreview.getByText(/\{\{.*\}\}/).count(), 0)
  assert.equal(
    await automatic.evaluate(() => window.__testStore.quote_followup_jobs.length),
    0,
    "Preview never schedules an email",
  )
  await accessible(automatic)
  await automatic.keyboard.press("Escape")
  assert.equal(
    await automatic
      .getByRole("button", { name: "Voir l’aperçu" })
      .evaluate((button) => button === document.activeElement),
    true,
  )
  await automatic
    .getByRole("button", { name: "Activer les relances automatiques" })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await automatic
    .getByRole("status")
    .filter({ hasText: "Les relances automatiques sont activées pour ce devis." })
    .waitFor()
  let schedule = await automatic.evaluate(() => ({
    config: window.__testStore.quote_followup_automations.find(
      (row) => row.quote_id === "quote-test",
    ),
    jobs: window.__testStore.quote_followup_jobs.filter(
      (job) => job.status === "queued",
    ),
    calls: window.__automationCalls.filter(
      (call) => call.name === "save_quote_followup_automation" && call.args.p_enabled,
    ).length,
  }))
  assert.equal(schedule.config.enabled, true)
  assert.equal(schedule.calls, 1, "One activation despite a rapid double click")
  assert.equal(schedule.jobs.length, 2)
  assert.deepEqual(
    schedule.jobs.map((job) => job.step),
    [1, 2],
  )
  const parisDate = (value) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value))
  const addCalendarDays = (day, count) =>
    new Date(new Date(`${day}T12:00:00Z`).getTime() + count * 86400000)
      .toISOString()
      .slice(0, 10)
  assert.equal(
    parisDate(schedule.jobs[0].scheduled_at),
    addCalendarDays(parisDate(Date.now()), 1),
    "Overdue first email moves to tomorrow",
  )
  assert.equal(
    parisDate(schedule.jobs[1].scheduled_at),
    addCalendarDays(parisDate(schedule.jobs[0].scheduled_at), 7),
  )
  assert.equal(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(schedule.jobs[0].scheduled_at)),
    "09:00",
  )
  const originalDates = schedule.jobs.map((job) => job.scheduled_at)
  await automatic.getByRole("button", { name: "Mettre en pause" }).click()
  await automatic.getByText("En pause", { exact: true }).waitFor()
  assert.deepEqual(
    await automatic.evaluate(() =>
      window.__testStore.quote_followup_jobs
        .filter((job) => job.status === "queued")
        .map((job) => job.scheduled_at),
    ),
    originalDates,
  )
  await automatic.getByText("Cette échéance est conservée pendant la pause.").waitFor()
  await automatic.getByRole("button", { name: "Modifier les réglages" }).click()
  await automatic.getByRole("button", { name: "Enregistrer les réglages" }).click()
  await automatic
    .getByRole("status")
    .filter({ hasText: "Les réglages des relances ont été enregistrés." })
    .waitFor()
  assert.equal(
    await automatic.evaluate(
      () =>
        window.__testStore.quote_followup_automations.find(
          (row) => row.quote_id === "quote-test",
        ).paused,
    ),
    true,
    "Editing an active plan does not implicitly resume it",
  )
  await automatic.getByText("En pause", { exact: true }).waitFor()
  await automatic.getByRole("button", { name: "Reprendre les relances" }).click()
  await automatic.getByText("Actives", { exact: true }).waitFor()
  assert.deepEqual(
    await automatic.evaluate(() =>
      window.__testStore.quote_followup_jobs
        .filter((job) => job.status === "queued")
        .map((job) => job.scheduled_at),
    ),
    originalDates,
  )
  await automatic
    .getByLabel("Note de suivi")
    .fill("Note interne sans réponse du client")
  await automatic.getByRole("button", { name: "Ajouter", exact: true }).click()
  await automatic
    .getByText("Note interne sans réponse du client", { exact: true })
    .waitFor()
  assert.equal(
    await automatic.evaluate(
      () =>
        window.__testStore.quote_followup_automations.find(
          (row) => row.quote_id === "quote-test",
        ).enabled,
    ),
    true,
    "A manual note does not stop emails",
  )
  await automatic.getByRole("button", { name: "Modifier les réglages" }).click()
  await automatic.getByLabel("Première relance après").fill("7")
  await automatic.getByLabel("Deuxième relance après").fill("15")
  const postponedDay = addCalendarDays(parisDate(Date.now()), 14)
  await automatic
    .getByLabel("Reporter la prochaine relance automatique")
    .fill(parisDate(Date.now()))
  assert.equal(
    await automatic
      .getByRole("button", { name: "Enregistrer les réglages" })
      .isDisabled(),
    true,
  )
  await automatic
    .getByLabel("Reporter la prochaine relance automatique")
    .fill(postponedDay)
  await automatic.getByRole("button", { name: "Enregistrer les réglages" }).click()
  await automatic
    .getByRole("status")
    .filter({ hasText: "Les réglages des relances ont été enregistrés." })
    .waitFor()
  schedule = await automatic.evaluate(() => ({
    config: window.__testStore.quote_followup_automations.find(
      (row) => row.quote_id === "quote-test",
    ),
    jobs: window.__testStore.quote_followup_jobs.filter(
      (job) => job.status === "queued",
    ),
  }))
  assert.equal(schedule.config.first_delay_days, 7)
  assert.equal(schedule.config.second_delay_days, 15)
  assert.equal(parisDate(schedule.jobs[0].scheduled_at), postponedDay)
  assert.equal(
    parisDate(schedule.jobs[1].scheduled_at),
    addCalendarDays(postponedDay, 8),
  )
  await automatic.reload({ waitUntil: "networkidle" })
  await automatic.getByText("Actives", { exact: true }).waitFor()
  assert.equal(await automatic.getByText("Programmé", { exact: true }).count(), 2)
  await automatic.getByRole("button", { name: "Marquer une réponse reçue" }).click()
  const responseDialog = automatic.getByRole("dialog", {
    name: "Marquer une réponse reçue",
  })
  await responseDialog
    .getByLabel("Réponse du client")
    .fill("Le client demande de revoir le délai.")
  assert.equal(
    await responseDialog.getByLabel("Réponse du client").getAttribute("maxlength"),
    "4000",
  )
  await responseDialog
    .getByRole("button", { name: "Enregistrer la réponse" })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await automatic
    .getByRole("status")
    .filter({
      hasText: "La réponse a été enregistrée. Les relances suivantes sont arrêtées.",
    })
    .waitFor()
  await automatic
    .getByText("Le client demande de revoir le délai.", { exact: true })
    .waitFor()
  assert.equal(
    await automatic.evaluate(
      () =>
        window.__testStore.quote_events.filter(
          (event) => event.event_type === "response",
        ).length,
    ),
    1,
  )
  assert.equal(
    await automatic.evaluate(
      () =>
        window.__testStore.quote_followup_automations.find(
          (row) => row.quote_id === "quote-test",
        ).stop_reason,
    ),
    "response_received",
  )
  assert.equal(
    await automatic.evaluate(
      () =>
        window.__testStore.quote_followup_jobs.filter((job) => job.status === "queued")
          .length,
    ),
    0,
  )
  await automatic.getByRole("button", { name: "Modifier les réglages" }).click()
  assert.equal(
    await automatic
      .getByRole("button", { name: "Activer les relances automatiques" })
      .isDisabled(),
    true,
  )
  await automatic.context().close()
  checks += 37
  console.log(
    "PASS: automation preview, validation, scheduling, pause, consent and response stop",
  )

  for (const action of ["stop", "accepted", "refused"]) {
    const page = await pageFor({
      session: true,
      automation: true,
      automationState: "enabled",
    })
    await visit(page, "/app/quotes/quote-test", "TEST-001")
    await page.getByText("Actives", { exact: true }).waitFor()
    await page
      .getByRole("button", {
        name:
          action === "stop"
            ? "Arrêter les relances"
            : action === "accepted"
              ? "Marquer accepté"
              : "Marquer refusé",
      })
      .click()
    await page
      .getByText(
        action === "stop"
          ? "Les prochaines relances automatiques sont arrêtées."
          : action === "accepted"
            ? "Le devis a été accepté."
            : "Le devis a été refusé.",
        { exact: true },
      )
      .waitFor()
    assert.equal(
      await page.evaluate(
        () =>
          window.__testStore.quote_followup_automations.find(
            (row) => row.quote_id === "quote-test",
          ).stop_reason,
      ),
      action === "stop" ? "disabled" : action,
    )
    assert.equal(
      await page.evaluate(() =>
        window.__testStore.quote_followup_jobs.some((job) => job.status === "queued"),
      ),
      false,
    )
    await page.context().close()
    checks += 2
  }

  const automationFailure = await pageFor({
    session: true,
    automation: true,
    automationFailure: "save_quote_followup_automation",
  })
  await visit(automationFailure, "/app/quotes/quote-test", "TEST-001")
  await automationFailure
    .getByLabel("Objet de la relance")
    .fill("Message conservé en cas d’erreur")
  await automationFailure
    .getByRole("button", { name: "Activer les relances automatiques" })
    .click()
  await automationFailure
    .getByRole("alert")
    .filter({ hasText: "Impossible d’enregistrer les relances automatiques." })
    .waitFor()
  assert.equal(
    await automationFailure.getByLabel("Objet de la relance").inputValue(),
    "Message conservé en cas d’erreur",
  )
  assert.equal(
    await automationFailure.evaluate(
      () => window.__testStore.quote_followup_jobs.length,
    ),
    0,
  )
  assert.equal(await automationFailure.getByText("Actives", { exact: true }).count(), 0)
  await automationFailure.evaluate(() => {
    window.__scenario.automationFailure = null
  })
  await automationFailure
    .getByRole("button", { name: "Activer les relances automatiques" })
    .click()
  await automationFailure.getByText("Actives", { exact: true }).waitFor()
  assert.equal(
    await automationFailure.evaluate(
      () =>
        window.__testStore.quote_followup_jobs.filter((job) => job.status === "queued")
          .length,
    ),
    2,
  )
  await automationFailure.context().close()
  checks += 4

  const contactFailure = await pageFor({
    session: true,
    automation: true,
    automationConfigured: false,
    automationFailure: "set_company_email_settings",
  })
  await visit(contactFailure, "/app/settings", "Paramètres")
  await contactFailure
    .getByLabel("Adresse de réponse")
    .fill("keep-contact@example.test")
  await contactFailure
    .getByRole("button", { name: "Enregistrer les coordonnées email" })
    .click()
  await contactFailure
    .getByRole("alert")
    .filter({ hasText: "Impossible d’enregistrer l’adresse de réponse." })
    .waitFor()
  assert.equal(
    await contactFailure.getByLabel("Adresse de réponse").inputValue(),
    "keep-contact@example.test",
  )
  assert.equal(
    await contactFailure.evaluate(
      () => window.__testStore.company_email_settings.length,
    ),
    0,
  )
  await contactFailure.context().close()
  checks += 2

  for (const state of [
    "sent",
    "failed",
    "processing",
    "delivery_unknown",
    "completed",
  ]) {
    const page = await pageFor({
      session: true,
      automation: true,
      automationState: state,
      automationHistory: state === "sent",
    })
    await visit(page, "/app/quotes/quote-test", "TEST-001")
    await page
      .getByRole("heading", { name: "Historique des envois automatiques" })
      .waitFor()
    const label = {
      sent: "Envoyé",
      failed: "Échec",
      processing: "Envoi en cours",
      delivery_unknown: "Résultat à vérifier",
      completed: "Envoyé",
    }[state]
    await page.locator("ol").getByText(label, { exact: true }).first().waitFor()
    if (["processing", "delivery_unknown"].includes(state)) {
      const settingsButton = page.getByRole("button", {
        name: /^(Modifier|Masquer) les réglages$/,
      })
      if (state === "processing") assert.equal(await settingsButton.isDisabled(), true)
      else assert.equal(await page.getByLabel("Objet de la relance").isDisabled(), true)
      await page
        .getByText("Un envoi est en cours ou son résultat reste à vérifier.", {
          exact: false,
        })
        .waitFor()
      if (state === "delivery_unknown") {
        await page
          .getByText(
            "Aucun nouvel essai automatique n’est effectué pour éviter un doublon.",
            { exact: false },
          )
          .waitFor()
        assert.equal(
          await page
            .getByRole("button", { name: "Activer les relances automatiques" })
            .isDisabled(),
          true,
        )
      } else {
        await page.getByRole("button", { name: "Mettre en pause" }).click()
        await page.getByText("En pause", { exact: true }).waitFor()
        await page.getByRole("button", { name: "Arrêter les relances" }).click()
        await page
          .getByRole("status")
          .filter({ hasText: "Les prochaines relances automatiques sont arrêtées." })
          .waitFor()
        assert.equal(
          await page.locator("ol").getByText("Envoi en cours", { exact: true }).count(),
          1,
          "An in-flight result stays visible after stop",
        )
      }
    }
    if (state === "completed") {
      await page.getByText("Les deux relances sont terminées.").waitFor()
      assert.equal(
        await page
          .getByRole("button", { name: "Activer les relances automatiques" })
          .isDisabled(),
        true,
      )
      assert.equal(
        await page.locator("ol").getByText("Envoyé", { exact: true }).count(),
        2,
      )
    }
    if (state === "sent") {
      const pagination = page.getByRole("navigation", {
        name: "Pagination des envois automatiques",
      })
      await pagination.getByRole("button", { name: "Envois précédents" }).click()
      await pagination.getByText("Page 2", { exact: true }).waitFor()
      await page.locator("ol").getByText("Annulé", { exact: true }).first().waitFor()
      await pagination.getByRole("button", { name: "Envois plus récents" }).click()
      await pagination.getByText("Page 1", { exact: true }).waitFor()
      await page.locator("ol").getByText("Envoyé", { exact: true }).waitFor()
      await page
        .getByRole("button", { name: /^Notifications/ })
        .first()
        .click()
      const notificationRegion = page.getByRole("region", {
        name: "Notifications",
        exact: true,
      })
      await notificationRegion
        .getByRole("link")
        .filter({ hasText: "Relance automatique envoyée" })
        .click()
      await page.getByRole("heading", { name: "TEST-001", exact: true }).waitFor()
      assert.equal(new URL(page.url()).pathname, "/app/quotes/quote-test")
      assert.equal(
        await page.evaluate(
          () =>
            window.__testStore.quote_followup_jobs.filter(
              (job) => job.status === "sent",
            ).length,
        ),
        1,
      )
      await page.getByRole("button", { name: "Modifier les réglages" }).click()
      await page.getByRole("button", { name: "Enregistrer les réglages" }).click()
      await page
        .getByRole("status")
        .filter({ hasText: "Les réglages des relances ont été enregistrés." })
        .waitFor()
      assert.equal(
        await page.evaluate(
          () =>
            window.__testStore.quote_followup_jobs.filter(
              (job) => job.step === 1 && job.status === "queued",
            ).length,
        ),
        0,
        "Changing settings cannot schedule the already-sent first step again",
      )
      assert.equal(
        await page.evaluate(
          () =>
            window.__testStore.quote_followup_jobs.filter(
              (job) => job.step === 2 && job.status === "queued",
            ).length,
        ),
        1,
      )
      checks += 2
    }
    await page.context().close()
    checks += 2
  }
  console.log(
    "PASS: automatic send history, notifications, terminal states and failures without duplicates",
  )

  for (const width of [320, 390, 1280]) {
    const page = await pageFor({ session: true, automation: true }, width)
    await visit(page, "/app/quotes/quote-test", "TEST-001")
    await page.getByRole("button", { name: "Voir l’aperçu" }).waitFor()
    await accessible(page)
    await page.screenshot({
      path: `${artifacts}automation-${width}.png`,
      fullPage: true,
    })
    await page.getByRole("button", { name: "Voir l’aperçu" }).click()
    const preview = page.getByRole("dialog", {
      name: "Aperçu de la relance automatique",
    })
    const box = await preview.boundingBox()
    assert.ok(
      box.x >= 0 && box.x + box.width <= width,
      "Email preview fits the viewport",
    )
    await accessible(page)
    await page.screenshot({ path: `${artifacts}automation-preview-${width}.png` })
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Marquer une réponse reçue" }).click()
    const response = page.getByRole("dialog", { name: "Marquer une réponse reçue" })
    await response.getByLabel("Réponse du client").fill("Réponse à conserver")
    await accessible(page)
    await page.screenshot({ path: `${artifacts}automation-response-${width}.png` })
    await response.getByRole("button", { name: "Annuler" }).click()
    assert.equal(
      await page.evaluate(() =>
        window.__testStore.quote_events.some(
          (event) => event.event_type === "response",
        ),
      ),
      false,
    )
    await visit(page, "/app/settings", "Paramètres")
    await page.getByLabel("Adresse de réponse").waitFor()
    await accessible(page)
    await page.screenshot({
      path: `${artifacts}automation-settings-${width}.png`,
      fullPage: true,
    })
    await page.context().close()
    checks += 2
  }
  console.log(
    "PASS: automated followups and company email settings at 320/390/1280px, accessibility and dialogs",
  )

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
