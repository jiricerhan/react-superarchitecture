import fs from 'node:fs';
import path from 'node:path';

const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mts', '.mjs'];

/**
 * Resolve an import specifier to a project-relative posix path, or null when it is a package / unknown.
 * Handles relative paths and configured aliases ({ '@/': 'src/' }); index files and extensions are tried.
 */
export function resolveImport(spec, fromAbs, { root, aliases = {} }) {
  let abs = null;
  if (spec.startsWith('.')) abs = path.resolve(path.dirname(fromAbs), spec);
  else {
    for (const [prefix, target] of Object.entries(aliases)) {
      if (spec.startsWith(prefix)) { abs = path.resolve(root, target + spec.slice(prefix.length)); break; }
    }
  }
  if (!abs) return null;
  const candidates = [abs, ...EXTS.map((e) => abs + e), ...EXTS.map((e) => path.join(abs, 'index' + e))];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return path.relative(root, c).replace(/\\/g, '/'); } catch { /* next */ }
  }
  // unresolvable inside the project: still return the relative guess so kind-by-name works (e.g. generated files)
  return path.relative(root, abs).replace(/\\/g, '/');
}
