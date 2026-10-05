import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { randomUUID } from "node:crypto"

const require = createRequire(import.meta.url)
const output = resolve("public/document-reader")
const cache = resolve(".cache/document-assets")
const lock = join(cache, "generation-lock")
const marker = join(output, ".versions.json")
const packageRoot = (name) => dirname(require.resolve(`${name}/package.json`))
const tesseract = packageRoot("tesseract.js")
const tesseractRequire = createRequire(join(tesseract, "package.json"))
const core = dirname(tesseractRequire.resolve("tesseract.js-core/package.json"))
const language = packageRoot("@tesseract.js-data/fra")
const pdf = packageRoot("pdfjs-dist")
const roots = { tesseract, core, language, pdf }
const versions = Object.fromEntries(
  await Promise.all(
    Object.entries(roots).map(async ([name, root]) => [
      name,
      JSON.parse(await readFile(join(root, "package.json"), "utf8")).version,
    ]),
  ),
)
const versionText = JSON.stringify(versions)
const critical = [
  "ocr/worker.min.js",
  "ocr/fra.traineddata.gz",
  "ocr/tesseract-core-lstm.wasm",
  "pdf/cmaps",
  "pdf/standard_fonts",
  "pdf/wasm",
]

async function ready() {
  try {
    return (
      (await readFile(marker, "utf8")) === versionText &&
      (await Promise.all(critical.map((name) => stat(join(output, name))))).every(
        (entry) => entry.isDirectory() || entry.size > 0,
      )
    )
  } catch {
    return false
  }
}

await mkdir(cache, { recursive: true })
if (await ready()) {
  console.log("Ressources de lecture locales déjà préparées.")
} else {
  // predev and prebuild may start together. Only one writes assets, and no live
  // asset directory is removed while Vite or the build can be reading it.
  const started = Date.now()
  let acquired = false
  while (!acquired) {
    try {
      await mkdir(lock)
      acquired = true
    } catch (error) {
      if (error.code !== "EEXIST") throw error
      if (await ready()) break
      try {
        const owner = Number(await readFile(join(lock, "pid"), "utf8"))
        if (Number.isInteger(owner) && owner > 0) {
          try {
            process.kill(owner, 0)
          } catch (ownerError) {
            if (ownerError.code === "ESRCH")
              await rm(lock, { recursive: true, force: true })
          }
        } else if (Date.now() - (await stat(lock)).mtimeMs > 120_000)
          await rm(lock, { recursive: true, force: true })
      } catch {
        // A crashed process can leave a lock before writing its owner file.
        try {
          if (Date.now() - (await stat(lock)).mtimeMs > 120_000)
            await rm(lock, { recursive: true, force: true })
        } catch {
          /* Another process may have released it already. */
        }
      }
      if (Date.now() - started > 120_000)
        throw Error(
          "La préparation des ressources de lecture est encore occupée. Relancez la commande.",
        )
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  if (acquired) {
    await writeFile(join(lock, "pid"), String(process.pid))
    try {
      if (!(await ready())) {
        await mkdir(output, { recursive: true })
        const atomicCopy = async (source, target) => {
          await mkdir(dirname(target), { recursive: true })
          const temporary = join(cache, `${randomUUID()}.asset`)
          try {
            await cp(source, temporary)
            await rename(temporary, target)
          } finally {
            await rm(temporary, { force: true })
          }
        }
        const copyFolder = async (source, target) => {
          await mkdir(target, { recursive: true })
          for (const entry of await readdir(source, { withFileTypes: true })) {
            if (entry.isDirectory())
              await copyFolder(join(source, entry.name), join(target, entry.name))
            else if (entry.isFile())
              await atomicCopy(join(source, entry.name), join(target, entry.name))
          }
        }
        await atomicCopy(
          join(tesseract, "dist/worker.min.js"),
          join(output, "ocr/worker.min.js"),
        )
        for (const name of await readdir(core)) {
          if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(name))
            await atomicCopy(join(core, name), join(output, "ocr", name))
        }
        await atomicCopy(
          join(language, "4.0.0_best_int/fra.traineddata.gz"),
          join(output, "ocr/fra.traineddata.gz"),
        )
        for (const folder of ["cmaps", "standard_fonts", "wasm"])
          await copyFolder(join(pdf, folder), join(output, "pdf", folder))
        const temporaryMarker = join(cache, `${randomUUID()}.versions`)
        await writeFile(temporaryMarker, versionText)
        await rename(temporaryMarker, marker)
      }
      console.log(
        "Ressources PDF et reconnaissance française préparées pour un traitement local.",
      )
    } finally {
      await rm(lock, { recursive: true, force: true })
    }
  } else console.log("Ressources de lecture locales déjà préparées.")
}
