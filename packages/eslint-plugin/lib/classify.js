import path from 'node:path';

/**
 * Convention-based classification, by file name and location:
 * - *Container.tsx           -> container
 * - use*.ts / hooks.ts       -> hook
 * - *Slice.ts / store.ts / store/hooks.ts (typed base hooks) -> store
 * - utils / consts / types   -> util
 * - *.graphql, queries/      -> query
 * - page.tsx etc. under app  -> page
 * - other .tsx               -> view
 */
export function classify(relFile, opts = {}) {
  const pageDirs = opts.pageDirs ?? ['src/app', 'app', 'src/pages', 'pages'];
  const posix = relFile.replace(/\\/g, '/');
  const base = path.posix.basename(posix).replace(/\.(tsx?|jsx?|graphql|gql)$/, '');
  const ext = path.posix.extname(posix);
  if (ext === '.graphql' || ext === '.gql' || /\/(queries|fragments)\//.test(posix)) return 'query';
  // app entry points and Next/Vite roots are composition roots, like pages
  if (/^(main|index|App|_app|root|Root)$/.test(base) && (ext === '.tsx' || ext === '.jsx') && (posix.split('/').length <= 2 || pageDirs.some((d) => posix.startsWith(d + '/')))) return 'page';
  if (/Container$/.test(base)) return 'container';
  // src/store/hooks.ts holds useAppSelector / useAppDispatch: part of the store, not a module's data API
  if (/(^|\/)store\/hooks$/.test(posix.replace(/\.[^.]+$/, ''))) return 'store';
  if (/(^|\.)use[A-Z]/.test(base) || base === 'hooks' || /\/hooks\//.test(posix)) return 'hook';
  if (/Slice$/.test(base) || /^store$/i.test(base) || /\/store\//.test(posix)) return 'store';
  if (/^(utils?|consts?|constants|types|helpers?|actionCreators|.*Adapter)$/.test(base) || /\/utils?\//.test(posix)) return 'util';
  if (pageDirs.some((d) => posix.startsWith(d + '/')) && /^(page|layout|template|default|error|loading|not-found)$/.test(base)) return 'page';
  if (ext === '.tsx' || ext === '.jsx') return 'view';
  return 'other';
}

/** is the file inside a module's public view folder (`<modulesDir>/<module>/<one of moduleSharedDirs>/`)? */
export function inModuleShared(relFile, opts = {}) {
  const posix = relFile.replace(/\\/g, '/');
  const mods = opts.modulesDir?.replace(/\/+$/, '');
  const dirs = opts.moduleSharedDirs ?? ['shared', 'public'];
  if (!mods || !posix.startsWith(mods + '/')) return false;
  const rest = posix.slice(mods.length + 1).split('/');
  return rest.length > 2 && dirs.includes(rest[1]);
}

/** module of a project-relative file: '@shared', '@app', a folder under the modules dir, or '' */
export function moduleOf(relFile, opts = {}) {
  const posix = relFile.replace(/\\/g, '/');
  const pageDirs = opts.pageDirs ?? ['src/app', 'app', 'src/pages', 'pages'];
  const shared = opts.sharedDir?.replace(/\/+$/, '');
  const mods = opts.modulesDir?.replace(/\/+$/, '');
  if (shared && (posix === shared || posix.startsWith(shared + '/'))) return '@shared';
  if (pageDirs.some((d) => posix.startsWith(d + '/'))) return '@app';
  if (mods && posix.startsWith(mods + '/')) {
    const seg = posix.slice(mods.length + 1).split('/')[0];
    return seg.includes('.') ? '' : seg;
  }
  return '';
}
