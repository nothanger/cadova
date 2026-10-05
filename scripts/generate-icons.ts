import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { cadovaLogoContour } from "../src/features/landing/cadovaLogoShape.ts"

// Reuse the traced brand contour rather than stretching the transparent mark.
// Each platform has its own spacing; app icons leave room for the OS mask.
const background = "#f6f6f2"
const contour =
  cadovaLogoContour.map(([x, y], index) => `${index ? "L" : "M"}${x},${-y}`).join(" ") +
  " Z"
function svg(size: number, coverage: number, rounded = false, mask = false) {
  const scale = (64 * coverage) / 2.7
  const surface = mask
    ? ""
    : `<rect width="64" height="64" rx="${rounded ? 12 : 0}" fill="${background}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${surface}<g transform="translate(32 32) scale(${scale})"><path fill="${mask ? "#000" : "#0b1020"}" d="${contour}"/><circle cx="0.093676" cy="0.122583" r="0.32361" fill="${mask ? "#000" : "#5a5cff"}"/></g></svg>\n`
}

const output = new URL("../public/", import.meta.url)
await mkdir(output, { recursive: true })
await writeFile(new URL("favicon.svg", output), svg(64, 0.76, true))
await writeFile(new URL("safari-pinned-tab.svg", output), svg(64, 0.76, false, true))
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
})
try {
  const page = await browser.newPage()
  const profiles = [
    { name: "favicon-16.png", size: 16, coverage: 0.76 },
    { name: "favicon-32.png", size: 32, coverage: 0.76 },
    { name: "favicon-48.png", size: 48, coverage: 0.76 },
    { name: "favicon.png", size: 48, coverage: 0.76 },
    { name: "apple-touch-icon.png", size: 180, coverage: 0.7 },
    { name: "icon-192.png", size: 192, coverage: 0.7 },
    { name: "icon-512.png", size: 512, coverage: 0.7 },
    { name: "icon-maskable-512.png", size: 512, coverage: 0.64 },
  ]
  const pngs = new Map<number, Buffer>()
  for (const { name, size, coverage } of profiles) {
    const source = Buffer.from(svg(size, coverage)).toString("base64")
    await page.setContent(
      `<img id="icon" src="data:image/svg+xml;base64,${source}" alt="">`,
    )
    const data = await page.evaluate(async (size) => {
      const image = document.querySelector<HTMLImageElement>("#icon")!
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = size
      const context = canvas.getContext("2d")!
      context.drawImage(image, 0, 0, size, size)
      const { data } = context.getImageData(0, 0, size, size)
      let maxRadius = 0
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = (y * size + x) * 4
          if (data[index + 3] !== 255) throw new Error("App icons must be opaque")
          if (data[index] < 200) {
            maxRadius = Math.max(
              maxRadius,
              Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2),
            )
          }
        }
      }
      return { png: canvas.toDataURL("image/png").split(",")[1], maxRadius }
    }, size)
    if (name.includes("maskable"))
      assert.ok(data.maxRadius < size * 0.4, "Logo must fit the maskable safe circle")
    const png = Buffer.from(data.png, "base64")
    await writeFile(new URL(name, output), png)
    if (size <= 48) pngs.set(size, png)
  }
  // PNG-backed ICO with explicit 16/32/48 sizes for legacy browsers/bookmarks.
  const entries = [...pngs]
  const header = Buffer.alloc(6 + entries.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(([size, png], index) => {
    const entry = 6 + index * 16
    header[entry] = header[entry + 1] = size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  await writeFile(
    new URL("favicon.ico", output),
    Buffer.concat([header, ...entries.map(([, png]) => png)]),
  )
  console.log(
    "Icônes Cadova générées : favicon, iPhone, application et masque Android.",
  )
} finally {
  await browser.close()
}
