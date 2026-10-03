import assert from "node:assert/strict"
import { readFile, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8448"
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["dev", "--port", "8448"], {
      stdio: "ignore",
      detached: true,
    })
const fixture = await readFile(
  new URL("./fixtures/supabase.mjs", import.meta.url),
  "utf8",
)
const artifacts = new URL("../.cache/ui/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
let browser
let decoder
const errors = []
let checks = 0
const chapters = [
  { label: "Client", title: "Le dossier client", detail: "Coordonnées et notes" },
  { label: "Devis", title: "Le devis envoyé", detail: "En attente de réponse" },
  {
    label: "Relance",
    title: "La relance à préparer",
    detail: "Message à personnaliser",
  },
  {
    label: "Dossier",
    title: "Le dossier complet",
    detail: "Client, devis et historique",
  },
]

function stopServer() {
  if (!server?.pid) return
  try {
    process.kill(-server.pid, "SIGTERM")
  } catch (error) {
    if (error.code !== "ESRCH") throw error
  }
}

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
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  })
  decoder = await browser.newPage()

  async function pageFor(
    width,
    reducedMotion = "reduce",
    noWebGL = false,
    height = 1000,
  ) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: reducedMotion === "no-preference" ? "reduce" : reducedMotion,
    })
    if (noWebGL) {
      await context.addInitScript(() => {
        const getContext = window.HTMLCanvasElement.prototype.getContext
        window.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (["webgl", "webgl2", "experimental-webgl"].includes(type)) return null
          return getContext.call(this, type, ...args)
        }
      })
    }
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: fixture }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(base, { waitUntil: "networkidle" })
    await page
      .getByRole("heading", { name: "Le suivi commercial, sans bruit.", exact: true })
      .waitFor()
    const canvas = page.locator("main canvas")
    await canvas.waitFor()
    assert.equal(await canvas.count(), 1, "Only one responsive scene is mounted")
    await canvas.scrollIntoViewIfNeeded()
    if (!noWebGL) {
      await page.waitForFunction(() => {
        const element = document.querySelector("main canvas")
        return element && window.getComputedStyle(element).opacity === "1"
      })
    }
    if (reducedMotion === "no-preference") {
      // Freeze time after lazy mounting so slow GPU captures cannot consume the sequence.
      await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") })
      await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"))
      await page.emulateMedia({ reducedMotion: "no-preference" })
      await page.getByRole("button", { name: "Mettre l’animation en pause" }).waitFor()
      await page.clock.runFor(32)
    }
    return { page, canvas }
  }

  async function snapshot(canvas, name) {
    return canvas.screenshot({
      ...(name ? { path: `${artifacts}scene-${name}.png` } : {}),
      animations: "allow",
    })
  }

  async function pixels(buffer) {
    return decoder.evaluate(
      async (url) => {
        const image = new window.Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement("canvas")
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext("2d")
        context.drawImage(image, 0, 0)
        const data = context.getImageData(0, 0, image.width, image.height).data
        let dark = 0
        let indigo = 0
        const bounds = [image.width, image.height, 0, 0]
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = data.slice(i, i + 3)
          const isDark = r < 70 && g < 80 && b < 110
          const isIndigo = b > 120 && b > r * 1.2 && b > g * 1.15
          dark += Number(isDark)
          indigo += Number(isIndigo)
          if (isDark || isIndigo) {
            const x = (i / 4) % image.width
            const y = Math.floor(i / 4 / image.width)
            bounds[0] = Math.min(bounds[0], x)
            bounds[1] = Math.min(bounds[1], y)
            bounds[2] = Math.max(bounds[2], x)
            bounds[3] = Math.max(bounds[3], y)
          }
        }
        return { dark, indigo, bounds, width: image.width, height: image.height }
      },
      `data:image/png;base64,${buffer.toString("base64")}`,
    )
  }

  async function difference(first, second) {
    return decoder.evaluate(
      async (urls) => {
        const images = await Promise.all(
          urls.map(async (url) => {
            const image = new window.Image()
            image.src = url
            await image.decode()
            return image
          }),
        )
        const canvas = document.createElement("canvas")
        canvas.width = images[0].width
        canvas.height = images[0].height
        const context = canvas.getContext("2d")
        const frames = images.map((image) => {
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0)
          return context.getImageData(0, 0, canvas.width, canvas.height).data
        })
        let changed = 0
        for (let i = 0; i < frames[0].length; i += 4) {
          if (
            Math.abs(frames[0][i] - frames[1][i]) +
              Math.abs(frames[0][i + 1] - frames[1][i + 1]) +
              Math.abs(frames[0][i + 2] - frames[1][i + 2]) >
            12
          )
            changed++
        }
        return changed / (canvas.width * canvas.height)
      },
      [first, second].map(
        (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
      ),
    )
  }

  async function assertArtwork(buffer, margin = true) {
    const stats = await pixels(buffer)
    assert.ok(stats.dark > 200, `Logo missing: ${JSON.stringify(stats)}`)
    assert.ok(stats.indigo > 40, `Indigo point missing: ${JSON.stringify(stats)}`)
    if (margin) {
      assert.ok(
        stats.bounds[0] > 4 &&
          stats.bounds[1] > 4 &&
          stats.bounds[2] < stats.width - 5 &&
          stats.bounds[3] < stats.height - 5,
        `Scene artwork is clipped: ${JSON.stringify(stats)}`,
      )
    }
    checks++
  }

  async function assertChapter(page, index) {
    const chapter = chapters[index]
    const navigation = page.getByRole("navigation", {
      name: "Parcours du dossier",
      exact: true,
    })
    await navigation.waitFor({ state: "visible" })
    const buttons = navigation.getByRole("button")
    assert.equal(await buttons.count(), chapters.length)
    assert.equal(
      await navigation
        .getByRole("button", { name: chapter.label, exact: true })
        .getAttribute("aria-pressed"),
      "true",
      `Current chapter should be ${chapter.label}`,
    )
    assert.equal(await navigation.locator('[aria-pressed="true"]').count(), 1)
    const heading = page.getByRole("heading", {
      name: chapter.title,
      level: 2,
      exact: true,
    })
    const detail = page.getByText(chapter.detail, { exact: true }).first()
    assert.ok(await heading.isVisible(), `${chapter.title} must be visible`)
    assert.ok(await detail.isVisible(), `${chapter.detail} must be visible`)
    for (const element of [heading, detail]) {
      const metrics = await element.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        return {
          fontSize: parseFloat(window.getComputedStyle(node).fontSize),
          left: rect.left,
          right: rect.right,
          viewport: window.innerWidth,
          fits: node.scrollWidth <= node.clientWidth,
        }
      })
      assert.ok(metrics.fontSize >= 14, `Readable text: ${JSON.stringify(metrics)}`)
      assert.ok(
        metrics.left >= 0 && metrics.right <= metrics.viewport && metrics.fits,
        `Chapter text should fit: ${JSON.stringify(metrics)}`,
      )
    }
    checks++
  }

  async function captureChapters(page, canvas, width, elapsed = 0) {
    for (const [index, time] of [3000, 9000, 15000, 23000].entries()) {
      await page.clock.fastForward(time - elapsed)
      elapsed = time
      await assertChapter(page, index)
      await assertArtwork(
        await snapshot(canvas, `story-${width}-${chapters[index].label.toLowerCase()}`),
      )
    }
  }

  for (const width of [320, 390, 768, 1440]) {
    const { page, canvas } = await pageFor(width)
    const rect = await canvas.boundingBox()
    assert.ok(
      rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= width &&
        rect.y + rect.height <= 1000,
      `Canvas outside viewport at ${width}px: ${JSON.stringify(rect)}`,
    )
    const first = await snapshot(canvas, `static-${width}`)
    await assertArtwork(first)
    await assertChapter(page, 3)
    await page.waitForTimeout(400)
    assert.equal(
      await difference(first, await snapshot(canvas)),
      0,
      "Reduced motion must remain still",
    )
    await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.3)
    assert.equal(
      await difference(first, await snapshot(canvas)),
      0,
      "Reduced motion ignores pointer tilt",
    )
    assert.equal(await page.getByRole("button", { name: /animation/ }).count(), 0)
    await page
      .getByRole("navigation", { name: "Parcours du dossier" })
      .getByRole("button", { name: "Devis", exact: true })
      .click()
    await assertChapter(page, 1)
    const selected = await snapshot(canvas)
    assert.ok(
      (await difference(first, selected)) > 0.002,
      "Reduced motion chapter selection should update the static composition",
    )
    await page.waitForTimeout(400)
    assert.equal(
      await difference(selected, await snapshot(canvas)),
      0,
      "Reduced motion chapter selection must not start animation",
    )
    await page.context().close()
    checks += 4
    console.log(`PASS: scene frame, pixels and reduced motion ${width}px`)
  }

  const { page, canvas } = await pageFor(1440, "no-preference")
  const start = await snapshot(canvas, "motion-start")
  await page.clock.fastForward(700)
  const moving = await snapshot(canvas, "motion-organizing")
  assert.ok((await difference(start, moving)) > 0.002, "Scene should animate")
  await page.getByRole("button", { name: "Mettre l’animation en pause" }).click()
  await page.mouse.move(0, 0)
  await page.getByRole("button", { name: "Reprendre l’animation" }).waitFor()
  const paused = await snapshot(canvas, "paused")
  await page.clock.fastForward(500)
  assert.equal(
    await difference(paused, await snapshot(canvas)),
    0,
    "Pause should freeze the scene",
  )
  const chapterNavigation = page.getByRole("navigation", {
    name: "Parcours du dossier",
  })
  await chapterNavigation.getByRole("button", { name: "Relance", exact: true }).focus()
  await page.keyboard.press("Enter")
  await assertChapter(page, 2)
  assert.ok(
    await page.getByRole("button", { name: "Reprendre l’animation" }).isVisible(),
    "Selecting a chapter while paused must preserve pause",
  )
  const selectedPaused = await snapshot(canvas, "selected-paused")
  await page.clock.fastForward(500)
  assert.equal(
    await difference(selectedPaused, await snapshot(canvas)),
    0,
    "Keyboard chapter selection must remain paused",
  )
  await page.getByRole("button", { name: "Reprendre l’animation" }).click()
  await page.mouse.move(0, 0)
  await page.clock.runFor(32)
  await page.clock.fastForward(6500)
  await assertChapter(page, 3)
  assert.ok(
    (await difference(selectedPaused, await snapshot(canvas))) > 0.002,
    "Resume should continue the scene",
  )
  await page.clock.fastForward(27000)
  await page
    .getByRole("button", { name: "Rejouer l’animation" })
    .waitFor({ timeout: 15000 })
  const finished = await snapshot(canvas, "finished")
  await assertArtwork(finished)
  await assertChapter(page, 3)
  await page.clock.fastForward(400)
  assert.equal(
    await difference(finished, await snapshot(canvas)),
    0,
    "Completed animation should settle",
  )
  await page.getByRole("button", { name: "Rejouer l’animation" }).click()
  await page.mouse.move(0, 0)
  await page.getByRole("button", { name: "Mettre l’animation en pause" }).waitFor()
  await assertChapter(page, 0)
  assert.ok(
    (await difference(finished, await snapshot(canvas))) > 0.002,
    "Replay should restart the sequence",
  )

  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: /animation/ }).waitFor({ state: "detached" })
  const reduced = await snapshot(canvas, "media-reduced")
  await page.clock.fastForward(400)
  assert.equal(
    await difference(reduced, await snapshot(canvas)),
    0,
    "Live reduced-motion change should stop movement",
  )
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.getByRole("button", { name: "Mettre l’animation en pause" }).waitFor()
  await page.clock.runFor(32)
  const restarted = await snapshot(canvas)
  await page.clock.fastForward(700)
  assert.ok(
    (await difference(restarted, await snapshot(canvas))) > 0.002,
    "Live motion preference should restart the sequence",
  )
  await page.context().close()
  checks += 8
  console.log("PASS: animation, pause/resume, finish/replay and live motion preference")

  const story = await pageFor(1440, "no-preference")
  await captureChapters(story.page, story.canvas, 1440)
  await story.page
    .getByRole("navigation", { name: "Parcours du dossier" })
    .getByRole("button", { name: "Devis", exact: true })
    .click()
  await story.page.mouse.move(0, 0)
  await assertChapter(story.page, 1)
  assert.ok(
    await story.page
      .getByRole("button", { name: "Mettre l’animation en pause" })
      .isVisible(),
    "Selecting a chapter during playback must preserve playback",
  )
  await story.page.clock.runFor(32)
  await story.page.clock.fastForward(5000)
  await assertChapter(story.page, 2)
  await story.page.clock.fastForward(27000)
  await story.page.getByRole("button", { name: "Rejouer l’animation" }).waitFor()
  await story.page.context().close()

  const mobile = await pageFor(390, "no-preference")
  const mobileStart = await snapshot(mobile.canvas, "mobile-motion-start")
  await mobile.page.clock.fastForward(700)
  assert.ok(
    (await difference(
      mobileStart,
      await snapshot(mobile.canvas, "mobile-motion-next"),
    )) > 0.002,
    "Mobile scene should animate",
  )
  await captureChapters(mobile.page, mobile.canvas, 390, 700)
  await mobile.page.context().close()
  checks++

  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const view = await pageFor(width, "reduce", false, height)
    await assertChapter(view.page, 3)
    assert.equal(
      await view.page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `No page overflow at ${width}px`,
    )
    await view.page.screenshot({ path: `${artifacts}scene-page-${width}.png` })
    await view.page.screenshot({
      path: `${artifacts}scene-page-full-${width}.png`,
      fullPage: true,
    })
    await view.page
      .getByRole("navigation", { name: "Parcours du dossier" })
      .getByRole("button", { name: "Relance", exact: true })
      .click()
    await assertChapter(view.page, 2)
    await view.page.screenshot({ path: `${artifacts}scene-page-relance-${width}.png` })
    await view.page.context().close()
  }

  const fallback = await pageFor(390, "reduce", true)
  const logo = fallback.canvas.locator("..").locator("img")
  await logo.waitFor({ state: "visible" })
  assert.ok(
    await logo.evaluate((image) => image.complete && image.naturalWidth > 0),
    "Fallback logo should load",
  )
  await assertArtwork(
    await logo.screenshot({ path: `${artifacts}scene-webgl-fallback.png` }),
    false,
  )
  assert.equal(
    await fallback.page.getByRole("button", { name: /animation/ }).count(),
    0,
  )
  await assertChapter(fallback.page, 3)
  await fallback.page
    .getByRole("navigation", { name: "Parcours du dossier" })
    .getByRole("button", { name: "Client", exact: true })
    .click()
  await assertChapter(fallback.page, 0)
  assert.ok(
    await fallback.page
      .locator("main")
      .getByRole("link", { name: "Créer mon espace" })
      .first()
      .isVisible(),
    "Signup action should remain available",
  )
  await fallback.page.context().close()
  checks += 3
  assert.deepEqual(errors, [], "Unexpected browser errors")
  console.log(
    `PASS: ${checks} scene checks, responsive pixels, motion controls and WebGL fallback.`,
  )
} finally {
  await browser?.close()
  stopServer()
}
