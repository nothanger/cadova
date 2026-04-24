import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "public", "supabase", "index.html", "package.json", "postcss.config.mjs", "vite.config.ts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".html", ".json", ".md", ".mjs", ".css"]);
const SUSPICIOUS = new RegExp("[\\u00c3\\u00c2]|\\u00e2\\u20ac|\\ufffd");

function extensionOf(path) {
  const match = path.match(/\.[^.\\\/]+$/);
  return match?.[0] ?? "";
}

function collectFiles(path, files = []) {
  const stats = statSync(path);

  if (stats.isFile()) {
    if (EXTENSIONS.has(extensionOf(path)) || ROOTS.includes(path)) files.push(path);
    return files;
  }

  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    collectFiles(join(path, entry), files);
  }

  return files;
}

const matches = [];

for (const root of ROOTS) {
  try {
    for (const file of collectFiles(root)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (SUSPICIOUS.test(line)) {
          matches.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  } catch {
    // Optional roots may not exist in every environment.
  }
}

if (matches.length) {
  console.error(matches.join("\n"));
  process.exit(1);
}

console.log("Encoding check passed: no mojibake markers found.");
