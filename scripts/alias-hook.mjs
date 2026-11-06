import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), base];
    const hit = candidates.find((candidate) => existsSync(candidate));
    if (!hit) {
      throw new Error(`Cannot resolve ${specifier}`);
    }
    return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
