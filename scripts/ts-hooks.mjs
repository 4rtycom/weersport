export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = new URL(`../${specifier.slice(2)}.ts`, import.meta.url);
    return { url: url.href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.(?:[cm]?js|json|ts|tsx|mjs|cjs|node)$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
