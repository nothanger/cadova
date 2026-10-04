import { readFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
})
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  })
  const logo = (
    await readFile(new URL("../public/cadova-logo.png", import.meta.url))
  ).toString("base64")
  await page.setContent(
    `<html lang="fr"><style>*{box-sizing:border-box}body{margin:0;background:#f6f6f2;color:#0b1020;font-family:system-ui,sans-serif;padding:64px 76px;width:1200px;height:630px;overflow:hidden}.mark{position:absolute;right:72px;top:160px;width:284px;height:332px;overflow:hidden}.mark img{height:332px;width:auto;max-width:none}.logo{height:48px;position:relative}h1{position:relative;font-size:76px;line-height:1.04;font-weight:650;margin:92px 0 26px;max-width:720px}p{position:relative;font-size:25px;line-height:1.5;color:#424756;margin:0;max-width:720px}.bottom{position:absolute;left:76px;right:76px;bottom:56px;border-top:1px solid #c4c7d2;padding-top:20px;display:flex;justify-content:space-between;font-size:18px;color:#4f52e8}</style><div class="mark"><img src="data:image/png;base64,${logo}" alt=""></div><img class="logo" src="data:image/png;base64,${logo}" alt="Cadova"><h1>Gardez le fil de vos devis.</h1><p>Clients, devis et relances au même endroit.</p><div class="bottom"><span>Artisans et petites entreprises</span><span>cadova.fr</span></div></html>`,
  )
  await page.screenshot({
    path: new URL("../public/social-card.png", import.meta.url).pathname,
  })
} finally {
  await browser.close()
}
