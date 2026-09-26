import { readFile } from "node:fs/promises";

const stub = new URL("./server-only-stub.mjs", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: stub.href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const mapped = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
    return resolve(mapped, context, nextResolve);
  }
  const needsExt =
    (specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith("file:")) &&
    !/\.(ts|tsx|js|mjs|cjs|json|css)$/.test(specifier);
  if (!needsExt) return nextResolve(specifier, context);
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = await readFile(new URL(url), "utf8");
    return { format: "json", shortCircuit: true, source };
  }
  return nextLoad(url, context);
}
