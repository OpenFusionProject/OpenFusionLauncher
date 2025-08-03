import { promises as fs } from "fs";
import * as path from "path";

function flatten(obj: any, prefix = "", out: string[] = []): string[] {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.push(fullKey);
    } else if (value && typeof value === "object") {
      flatten(value, fullKey, out);
    }
  }
  return out;
}

async function main() {
  const localePath = path.join(process.cwd(), "resources", "locales", "en.json");
  const raw = await fs.readFile(localePath, "utf8");
  const data = JSON.parse(raw);
  const keys = flatten(data)
    .filter((k) => /^[\w.]+$/.test(k))
    .sort();
  const lines = keys.map((k) => `  | '${k}'`);
  const out = `export type TranslationKey =\n${lines.join("\n")};\n`;
  const outPath = path.join(process.cwd(), "app", "i18n-keys.d.ts");
  await fs.writeFile(outPath, out);
}

main();
