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
    `<html lang="fr"><style>*{box-sizing:border-box}body{margin:0;background:#f5f5f0;color:#182725;font-family:system-ui,sans-serif;padding:64px 76px;width:1200px;height:630px}.logo{height:48px}h1{font-size:76px;line-height:1.1;letter-spacing:-3px;font-weight:600;margin:68px 0 24px}p{font-size:25px;line-height:1.5;color:#44534f;margin:0}.bottom{border-top:1px solid #bdc8c0;margin-top:48px;padding-top:20px;display:flex;justify-content:space-between;font-size:18px;color:#246052}</style><img class="logo" src="data:image/png;base64,${logo}" alt="Cadova"><h1>Vos devis envoyés.<br><span style="color:#246052">La suite, au clair.</span></h1><p>Clients, devis et relances. Dans un même espace.</p><div class="bottom"><span>Cadova</span><span>cadova.fr</span></div></html>`,
  )
  await page.screenshot({
    path: new URL("../public/social-card.png", import.meta.url).pathname,
  })
} finally {
  await browser.close()
}
