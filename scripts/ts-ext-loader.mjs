/**
 * 功能注释：为相对 import 补全 .ts/.tsx，供 Node --experimental-strip-types 单测加载 Romance 源码。
 */
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function tryResolveFile(absNoExt) {
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    const candidate = `${absNoExt}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  const asIndexTs = join(absNoExt, 'index.ts');
  if (existsSync(asIndexTs)) return asIndexTs;
  const asIndexTsx = join(absNoExt, 'index.tsx');
  if (existsSync(asIndexTsx)) return asIndexTsx;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL;
  if (!parent || (!specifier.startsWith('./') && !specifier.startsWith('../'))) {
    return nextResolve(specifier, context);
  }
  if (CODE_EXTS.has(extname(specifier)) || specifier.endsWith('.json') || specifier.endsWith('.css')) {
    return nextResolve(specifier, context);
  }
  try {
    const parentPath = fileURLToPath(parent);
    const abs = join(dirname(parentPath), specifier);
    const hit = tryResolveFile(abs);
    if (hit) {
      return nextResolve(pathToFileURL(hit).href, context);
    }
  } catch {
    // fall through
  }
  return nextResolve(specifier, context);
}
