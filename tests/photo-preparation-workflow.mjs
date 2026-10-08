import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { Buffer } from "node:buffer"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/photo-preparation/", import.meta.url).pathname
const fixtures = new URL("./fixtures/", import.meta.url)
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8462"
await mkdir(artifacts, { recursive: true })
const config = `${artifacts}vite.config.mjs`
await writeFile(
  config,
  `import { mergeConfig } from "vite"; import original from "../../vite.config.ts"; export default mergeConfig(original, { cacheDir: ".cache/vite/photo-preparation", server: { hmr: false } });`,
)
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["dev", "--port", "8462", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const [baseFixture, documentFixture, photo] = await Promise.all([
  readFile(new URL("supabase.mjs", fixtures), "utf8"),
  readFile(new URL("document-supabase.mjs", fixtures), "utf8"),
  readFile(new URL("document-photo.png", fixtures)),
])
const ocr = `export class LocalOcr {
  constructor(assets, signal) { this.signal = signal; }
  async recognize(bytes) {
    window.__photoOcrCalls = (window.__photoOcrCalls || 0) + 1;
    const image = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    window.__photoOcrDimensions = [image.width, image.height]; image.close();
    if (window.__scenario.ocrDelay) await new Promise(resolve => setTimeout(resolve, window.__scenario.ocrDelay));
    return { confidence: 98, text: "Devis DEV2026-015\\nClient : Ethan Noto\\nEmail : client@example.test\\nTotal TTC : 1250,50 EUR" };
  }
  close() { window.__photoOcrClosed = (window.__photoOcrClosed || 0) + 1; }
}`
let browser
let checks = 0
const errors = []
const external = []
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label)
  checks++
}

try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 59) throw new Error("Photo test server failed to start")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  async function pageFor(width = 390, options = {}) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    })
    await context.addInitScript(
      (value) => {
        window.__scenario = value
        if (value.admin)
          window.sessionStorage.setItem(
            "cadova.admin-company.user-test",
            "company-test",
          )
      },
      { session: true, empty: true, automation: true, ...options },
    )
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (
        ["http:", "https:"].includes(url.protocol) &&
        url.origin !== new URL(base).origin
      ) {
        external.push(url.origin)
        return route.abort("blockedbyclient")
      }
      return route.fallback()
    })
    await context.route("**/__document-base-fixture.mjs", (route) =>
      route.fulfill({ contentType: "application/javascript", body: baseFixture }),
    )
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: documentFixture }),
    )
    await context.route("**/src/features/quotes/import/localOcr.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: ocr }),
    )
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/app/quotes/new`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Ajouter un devis", exact: true }).waitFor()
    return page
  }

  async function upload(page, bytes = photo) {
    await page
      .getByLabel("Choisir le document du devis", { exact: true })
      .setInputFiles({ name: "devis.png", mimeType: "image/png", buffer: bytes })
    await page.getByRole("button", { name: "Lire cette photo", exact: true }).waitFor()
    await page.waitForFunction(
      () =>
        document.querySelector(
          'img[alt="Devis après rotation, redressement et recadrage"]',
        )?.complete,
    )
  }

  for (const width of [320, 390, 768, 1280]) {
    const page = await pageFor(width)
    await page.locator("#reference").fill("SAISI-42")
    await page.locator("#amount").fill("900,25")
    await upload(page)
    check(
      await page.evaluate(() => window.__photoOcrCalls || 0),
      0,
      `${width}: photo is not read before confirmation`,
    )
    check(
      await page
        .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
        .isDisabled(),
      true,
      `${width}: save waits for photo confirmation`,
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${width}: no horizontal overflow`,
    )
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    check(
      violations.map((value) => ({
        id: value.id,
        targets: value.nodes.map((node) => node.target),
      })),
      [],
      `${width}: accessible photo controls`,
    )
    await page.screenshot({
      path: `${artifacts}photo-editor-${width}.png`,
      fullPage: true,
    })
    await page.getByRole("button", { name: "Tourner à droite", exact: true }).click()
    await page
      .getByLabel("Angle de redressement en degrés", { exact: true })
      .fill("2.5")
    await page.getByLabel("À gauche (%)", { exact: true }).fill("3")
    await page.getByLabel("En bas (%)", { exact: true }).fill("2")
    check(
      await page
        .getByLabel("Angle de redressement en degrés", { exact: true })
        .inputValue(),
      "2.5",
      `${width}: precise keyboard deskew`,
    )
    await page
      .getByRole("button", { name: "Réinitialiser les réglages", exact: true })
      .click()
    check(
      await page.getByLabel("À gauche (%)", { exact: true }).inputValue(),
      "0",
      `${width}: reset restores full page`,
    )
    check(
      await page
        .getByLabel("Angle de redressement en degrés", { exact: true })
        .inputValue(),
      "0",
      `${width}: reset restores orientation`,
    )
    await page.getByRole("button", { name: "Tourner à droite", exact: true }).click()
    await page.getByRole("button", { name: "Lire cette photo", exact: true }).click()
    await page
      .getByRole("button", { name: "Retirer le document", exact: true })
      .waitFor()
    check(
      await page.evaluate(() => window.__photoOcrCalls),
      1,
      `${width}: one explicit OCR pass`,
    )
    check(
      await page.locator("#reference").inputValue(),
      "SAISI-42",
      `${width}: manual reference preserved`,
    )
    check(
      await page.locator("#amount").inputValue(),
      "900,25",
      `${width}: manual amount preserved`,
    )
    check(
      await page.evaluate(() => window.__documentCalls.length),
      0,
      `${width}: editing never uploads or sends`,
    )
    assert.ok(
      await page.evaluate(
        () => window.__photoOcrDimensions[0] > window.__photoOcrDimensions[1],
      ),
      "Quarter turn changes a portrait photo to landscape",
    )
    checks++
    await page.screenshot({ path: `${artifacts}photo-${width}.png`, fullPage: true })
    await page.context().close()
  }

  const native = await pageFor()
  const nativeResult = await native.evaluate(async () => {
    const { decodeQuotePhoto, renderQuotePhoto, applyQuotePhoto } =
      await import("/src/features/quotes/import/photoPreparation.ts")
    const { DEFAULT_PHOTO_ADJUSTMENTS } =
      await import("/src/features/quotes/import/photoGeometry.ts")
    const canvas = document.createElement("canvas")
    canvas.width = 360
    canvas.height = 500
    const context = canvas.getContext("2d")
    context.fillStyle = "white"
    context.fillRect(0, 0, 360, 500)
    context.fillStyle = "#000000"
    context.fillRect(2, 2, 8, 8)
    context.fillRect(350, 490, 8, 8)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg"))
    const file = new window.File([blob], "native.jpg", { type: "image/jpeg" })
    const bitmap = await decodeQuotePhoto(file, new window.AbortController().signal)
    const turned = renderQuotePhoto(bitmap, {
      ...DEFAULT_PHOTO_ADJUSTMENTS,
      rotation: 90,
    })
    const rotatedPixels = turned
      .getContext("2d")
      .getImageData(0, 0, turned.width, turned.height).data
    const corners = [
      rotatedPixels[(5 * turned.width + 494) * 4],
      rotatedPixels[(354 * turned.width + 5) * 4],
    ]
    const cropped = renderQuotePhoto(bitmap, {
      ...DEFAULT_PHOTO_ADJUSTMENTS,
      crop: { left: 10, top: 10, right: 0, bottom: 0 },
    })
    const applied = await applyQuotePhoto(
      bitmap,
      { ...DEFAULT_PHOTO_ADJUSTMENTS, rotation: 90 },
      file,
      new window.AbortController().signal,
    )
    bitmap.close()
    // Insert a real EXIF Orientation 6 tag into the camera-like JPEG.
    const jpeg = new Uint8Array(await blob.arrayBuffer())
    const exif = new Uint8Array([
      0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18,
      1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ])
    const orientedFile = new window.File(
      [jpeg.slice(0, 2), exif, jpeg.slice(2)],
      "camera.jpg",
      { type: "image/jpeg" },
    )
    const oriented = await decodeQuotePhoto(
      orientedFile,
      new window.AbortController().signal,
    )
    const result = {
      rotation: [turned.width, turned.height],
      crop: [cropped.width, cropped.height],
      preservedCorners: corners.every((value) => value < 50),
      exportedType: applied.type,
      exif: [oriented.width, oriented.height],
    }
    oriented.close()
    canvas.width =
      canvas.height =
      turned.width =
      turned.height =
      cropped.width =
      cropped.height =
        1
    return result
  })
  check(nativeResult.rotation, [500, 360], "Native canvas applies exact quarter turn")
  check(nativeResult.crop, [324, 450], "Native canvas removes only requested crop")
  check(
    nativeResult.preservedCorners,
    true,
    "Native rotation preserves page-corner content",
  )
  check(
    nativeResult.exportedType,
    "image/jpeg",
    "Prepared image remains compatible with PDF conversion",
  )
  check(
    nativeResult.exif,
    [500, 360],
    "Native decoding respects actual camera EXIF orientation",
  )
  check(
    await native.evaluate(async () => {
      const { decodeQuotePhoto } =
        await import("/src/features/quotes/import/photoPreparation.ts")
      const controller = new window.AbortController()
      controller.abort()
      try {
        await decodeQuotePhoto(new window.File([], "photo.png"), controller.signal)
      } catch (error) {
        return error.name
      }
      return "not-aborted"
    }),
    "AbortError",
    "Cancelled preparation never starts image decoding",
  )
  await native.context().close()

  const oversizedHeader = Buffer.from(photo.subarray(0, 24))
  oversizedHeader.writeUInt32BE(8000, 16)
  oversizedHeader.writeUInt32BE(8000, 20)
  for (const [bytes, expected] of [
    [Buffer.alloc(0), "Ce fichier est vide"],
    [Buffer.alloc(10 * 1024 * 1024 + 1), "La photo dépasse 10 Mo"],
    [oversizedHeader, "32 mégapixels maximum"],
    [photo.subarray(0, 24), "Cette photo est illisible ou endommagée"],
    [Buffer.from("unsupported HEIC image"), "Format non reconnu"],
  ]) {
    const invalid = await pageFor()
    await invalid.locator("#reference").fill("MA-SAISIE")
    await invalid
      .getByLabel("Choisir le document du devis", { exact: true })
      .setInputFiles({ name: "devis.png", mimeType: "image/png", buffer: bytes })
    await invalid.getByRole("alert").filter({ hasText: expected }).waitFor()
    check(
      await invalid.evaluate(() => window.__photoOcrCalls || 0),
      0,
      `${expected}: invalid image never starts OCR`,
    )
    check(
      await invalid
        .getByRole("button", { name: "Lire cette photo", exact: true })
        .isDisabled(),
      true,
      `${expected}: image cannot be applied`,
    )
    await invalid
      .getByRole("button", { name: "Annuler la préparation de la photo", exact: true })
      .click()
    check(
      await invalid.locator("#reference").inputValue(),
      "MA-SAISIE",
      `${expected}: recovery preserves manual fields`,
    )
    check(
      await invalid
        .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
        .isEnabled(),
      true,
      `${expected}: user can return to manual entry`,
    )
    await invalid.context().close()
  }

  const blurry = await pageFor()
  const blurryBytes = await blurry.evaluate(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 700
    canvas.height = 1000
    const context = canvas.getContext("2d")
    context.fillStyle = "white"
    context.fillRect(0, 0, 700, 1000)
    context.filter = "blur(10px)"
    context.fillStyle = "black"
    for (let y = 100; y < 850; y += 90) context.fillRect(75, y, 450, 30)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await upload(blurry, Buffer.from(blurryBytes))
  await blurry
    .getByRole("status")
    .filter({ hasText: "Cette photo semble manquer de netteté" })
    .waitFor()
  check(
    await blurry
      .getByRole("button", { name: "Lire cette photo", exact: true })
      .isEnabled(),
    true,
    "Measured blur warning leaves explicit continuation available",
  )
  check(
    await blurry.evaluate(() => window.__photoOcrCalls || 0),
    0,
    "Blur warning never starts OCR by itself",
  )
  await blurry.getByRole("button", { name: "Lire cette photo", exact: true }).click()
  await blurry
    .getByRole("button", { name: "Retirer le document", exact: true })
    .waitFor()
  check(
    await blurry.locator("#reference").inputValue(),
    "DEV2026-015",
    "User can explicitly continue with a blurred photograph",
  )
  check(
    await blurry
      .getByLabel("Informations à vérifier")
      .textContent()
      .then((value) => value.includes("manquer de netteté")),
    true,
    "Measured warning stays visible when confirming imported fields",
  )
  await blurry.context().close()

  const cancelled = await pageFor()
  await upload(cancelled)
  await cancelled
    .getByRole("button", { name: "Annuler la préparation de la photo", exact: true })
    .click()
  check(
    await cancelled
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .isEnabled(),
    true,
    "Cancellation restores manual form",
  )
  check(
    await cancelled.evaluate(() => window.__photoOcrCalls || 0),
    0,
    "Cancelled preparation never starts OCR",
  )
  await cancelled.context().close()

  for (const applyBeforeSwitch of [false, true]) {
    const scoped = await pageFor(1280, { admin: true, ocrDelay: 2500 })
    await upload(scoped)
    if (applyBeforeSwitch) {
      await scoped
        .getByRole("button", { name: "Lire cette photo", exact: true })
        .click()
      await scoped.waitForFunction(() => window.__photoOcrCalls === 1)
    }
    await scoped
      .getByRole("link", { name: "Changer d’entreprise", exact: true })
      .click()
    await scoped.getByRole("heading", { name: "Administration", exact: true }).waitFor()
    await scoped.getByRole("button", { name: "Entreprises", exact: true }).click()
    await scoped
      .getByRole("button", {
        name: "Ouvrir l’entreprise Autre entreprise",
        exact: true,
      })
      .click()
    await scoped.getByRole("heading", { name: "Aujourd’hui", exact: true }).waitFor()
    await scoped.getByRole("link", { name: "Devis", exact: true }).click()
    await scoped
      .locator("#app-content")
      .getByRole("link", { name: "Ajouter un devis", exact: true })
      .click()
    await scoped
      .getByRole("heading", { name: "Ajouter un devis", exact: true })
      .waitFor()
    await scoped.waitForTimeout(2700)
    check(
      await scoped.locator("#reference").inputValue(),
      "",
      "Company switch does not fill new company from old photo",
    )
    check(
      await scoped
        .getByRole("region", { name: "Aperçu de la photo préparée", exact: true })
        .count(),
      0,
      "Company switch releases old preview",
    )
    check(
      await scoped.evaluate(() => window.__documentCalls.length),
      0,
      "Company switch never uploads old document",
    )
    if (!applyBeforeSwitch)
      check(
        await scoped.evaluate(() => window.__photoOcrCalls || 0),
        0,
        "Company switch before validation never starts OCR",
      )
    await scoped.context().close()
  }
  check(errors, [], "No browser runtime errors")
  check(external, [], "No provider or third-party requests")
  console.log(
    `PASS: ${checks} photo preparation browser checks; artifacts ${artifacts}`,
  )
} finally {
  await browser?.close()
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {
      /* stopped */
    }
  }
}
