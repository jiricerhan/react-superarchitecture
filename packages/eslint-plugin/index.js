/**
 * eslint-plugin-superarchitecture: the container / view rule as lint rules.
 *
 * settings.superarchitecture = {
 *   root: process.cwd(),            // project root the paths below are relative to
 *   modulesDir: 'src/modules',      // direct subfolders are the modules ('' = no module layer)
 *   sharedDir: 'src/components',    // the shared view layer; anyone may import it, it imports no module
 *   moduleSharedDirs: ['shared', 'public'], // a module's public views: `<module>/shared/**` may be imported by other modules
 *   aliases: { '@/': 'src/' },      // import prefixes -> project-relative dirs
 *   storeLibraries: ['react-redux', '@reduxjs/toolkit', 'zustand', 'jotai', 'valtio', 'mobx-react'],
 *   viewHooks: ['useRef', 'useId', 'useContext', 'useMemo', 'useCallback', 'useTransition', 'useDeferredValue', 'useImperativeHandle', 'useDebugValue'],
 * }
 *
 * What stays in the analyzer (needs the type checker or the whole graph): wide / pass-through subscriptions,
 * prop stability, module cycles (use eslint-plugin-import's `import/no-cycle`).
 */
import path from 'node:path';
import { classify, inModuleShared, moduleOf } from './lib/classify.js';
import { resolveImport } from './lib/resolve.js';

const DEFAULTS = {
  root: process.cwd(),
  modulesDir: '',
  sharedDir: '',
  moduleSharedDirs: ['shared', 'public'],
  aliases: { '@/': 'src/' },
  storeLibraries: ['react-redux', '@reduxjs/toolkit', 'zustand', 'jotai', 'valtio', 'mobx-react', 'mobx-react-lite'],
  viewHooks: ['useRef', 'useId', 'useContext', 'useMemo', 'useCallback', 'useTransition', 'useDeferredValue', 'useImperativeHandle', 'useDebugValue', 'useSyncExternalStore'],
};

function settingsOf(context) {
  return { ...DEFAULTS, ...(context.settings?.superarchitecture ?? {}) };
}

function fileInfo(context) {
  const s = settingsOf(context);
  const abs = context.filename ?? context.getFilename();
  const rel = path.relative(s.root, abs).replace(/\\/g, '/');
  return { s, abs, rel, kind: classify(rel), module: moduleOf(rel, s) };
}

/** for every import declaration: the resolved target (project-relative) and its kind / module, or a package name */
function forEachImport(context, cb) {
  const info = fileInfo(context);
  return {
    ImportDeclaration(node) {
      if (node.importKind === 'type') return;
      const spec = node.source.value;
      const rel = resolveImport(spec, info.abs, info.s);
      if (rel) cb(node, { rel, kind: classify(rel), module: moduleOf(rel, info.s), name: path.posix.basename(rel).replace(/\.[^.]+$/, ''), pkg: null }, info);
      else cb(node, { rel: null, kind: null, module: null, name: spec, pkg: spec }, info);
    },
  };
}

const calleeName = (node) => (node.callee.type === 'Identifier' ? node.callee.name : node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier' ? node.callee.property.name : null);

// ---------------------------------------------------------------------------------------------------------------------
// view rules
// ---------------------------------------------------------------------------------------------------------------------

/** the names a specifier carries: local, imported (import) or exported (re-export) */
const specifierNames = (s) => [s.local, s.imported, s.exported].filter(Boolean).map((n) => (n.type === 'Identifier' ? n.name : String(n.value)));

const viewNoContainerImport = {
  meta: { type: 'problem', docs: { description: 'a view never imports a container (by file, or by name through a barrel): it offers a slot (ReactNode prop) and the container fills it' }, schema: [], messages: { found: 'view {{view}} imports container {{target}}. Views never import containers; give the view a ReactNode prop and let a container put {{target}} into it.' } },
  create(context) {
    const info = fileInfo(context);
    if (info.kind !== 'view') return {};
    const view = path.basename(info.rel);
    // imports, re-exports (`export { X } from`) and `export * from` are all edges of the import graph
    const check = (node, specifiers) => {
      if (node.importKind === 'type' || node.exportKind === 'type') return;
      const values = specifiers.filter((s) => s.importKind !== 'type' && s.exportKind !== 'type');
      if (specifiers.length && !values.length) return; // every specifier is type-only
      const rel = resolveImport(node.source.value, info.abs, info.s);
      if (rel && classify(rel) === 'container') {
        context.report({ node: node.source, messageId: 'found', data: { view, target: path.posix.basename(rel).replace(/\.[^.]+$/, '') } });
        return;
      }
      // a barrel (`@/modules/user`) is not a container file; the specifier name still says what comes out of it
      for (const s of values) {
        const name = specifierNames(s).find((n) => /Container$/.test(n));
        if (name) context.report({ node: s, messageId: 'found', data: { view, target: name } });
      }
    };
    return {
      ImportDeclaration(node) { check(node, node.specifiers); },
      ExportNamedDeclaration(node) { if (node.source) check(node, node.specifiers); },
      ExportAllDeclaration(node) { check(node, node.exported ? [{ exported: node.exported }] : []); },
    };
  },
};

const viewNoLogicImport = {
  meta: { type: 'problem', docs: { description: 'a view imports only views, the shared layer and pure utils: no hooks, store, queries' }, schema: [], messages: { found: 'view {{view}} imports {{kind}} {{target}}. A view knows nothing about data; move this into a container.' } },
  create(context) {
    return forEachImport(context, (node, t, info) => {
      if (info.kind !== 'view') return;
      if (t.kind === 'hook' || t.kind === 'store' || t.kind === 'query') context.report({ node: node.source, messageId: 'found', data: { view: path.basename(info.rel), kind: t.kind, target: t.name } });
      if (t.pkg && settingsOf(context).storeLibraries.some((lib) => t.pkg === lib || t.pkg.startsWith(lib + '/'))) context.report({ node: node.source, messageId: 'found', data: { view: path.basename(info.rel), kind: 'store library', target: t.pkg } });
    });
  },
};

function viewHookRule(description, test, messageId, message) {
  return {
    meta: { type: 'problem', docs: { description }, schema: [], messages: { [messageId]: message } },
    create(context) {
      const info = fileInfo(context);
      if (info.kind !== 'view') return {};
      const allowed = new Set(settingsOf(context).viewHooks);
      return {
        CallExpression(node) {
          const name = calleeName(node);
          if (!name || !/^use[A-Z]/.test(name)) return;
          if (test(name, allowed)) context.report({ node: node.callee, messageId, data: { view: path.basename(info.rel), hook: name } });
        },
      };
    },
  };
}

const viewNoState = viewHookRule('a view owns no state: it is a function of its props', (n) => n === 'useState' || n === 'useReducer', 'found', 'view {{view}} owns state ({{hook}}). A view is a function of its props; the state and its handler belong to a container (hover and the like: CSS).');
const viewNoEffect = viewHookRule('a view runs no effects', (n) => /^use(Layout|Insertion)?Effect$/.test(n), 'found', 'view {{view}} runs {{hook}}. Effects belong to a container.');
const viewNoDataHook = viewHookRule('a view calls no data hooks (only harmless React built-ins)', (n, allowed) => !allowed.has(n) && n !== 'useState' && n !== 'useReducer' && !/^use(Layout|Insertion)?Effect$/.test(n), 'found', 'view {{view}} calls {{hook}}. A view gets everything through props; call the hook in a container.');

const viewNoInlineHandler = {
  meta: { type: 'suggestion', docs: { description: 'a view creates no handlers: it passes the ones it got' }, schema: [], messages: { found: 'view {{view}} creates an inline handler for {{prop}}. Handlers belong to containers; pass the prop through instead.' } },
  create(context) {
    const info = fileInfo(context);
    if (info.kind !== 'view') return {};
    return {
      JSXAttribute(node) {
        const v = node.value;
        if (!v || v.type !== 'JSXExpressionContainer') return;
        // adapting a DOM event for a host element (`onChange={(e) => onChange(e.target.value)}`) is view work;
        // a fresh function handed to a component is a new prop every render and hides domain logic in the view
        const el = node.parent;
        const tag = el?.name;
        if (!tag || tag.type !== 'JSXIdentifier' || !/^[A-Z]/.test(tag.name)) return;
        const ex = v.expression;
        if (ex.type === 'ArrowFunctionExpression' || ex.type === 'FunctionExpression') context.report({ node: ex, messageId: 'found', data: { view: path.basename(info.rel), prop: node.name.name ?? String(node.name) } });
      },
    };
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// container rules
// ---------------------------------------------------------------------------------------------------------------------

const containerNoMarkup = {
  meta: { type: 'problem', docs: { description: 'a container renders no host elements: markup and style belong to its view' }, schema: [], messages: { found: 'container {{container}} renders <{{tag}}>. Markup belongs to the view; the container passes data and elements.' } },
  create(context) {
    const info = fileInfo(context);
    if (info.kind !== 'container') return {};
    return {
      JSXOpeningElement(node) {
        const n = node.name;
        if (n.type === 'JSXIdentifier' && /^[a-z]/.test(n.name)) context.report({ node: n, messageId: 'found', data: { container: path.basename(info.rel), tag: n.name } });
      },
    };
  },
};

const containerNoStoreImport = {
  meta: { type: 'problem', docs: { description: "a container reaches data only through the module's hooks, never the store, a slice or a store library" }, schema: [], messages: { found: 'container {{container}} imports {{target}} directly. Go through the module hooks so the store can be swapped without touching containers.' } },
  create(context) {
    return forEachImport(context, (node, t, info) => {
      if (info.kind !== 'container') return;
      if (t.kind === 'store') context.report({ node: node.source, messageId: 'found', data: { container: path.basename(info.rel), target: t.name } });
      if (t.pkg && settingsOf(context).storeLibraries.some((lib) => t.pkg === lib || t.pkg.startsWith(lib + '/'))) context.report({ node: node.source, messageId: 'found', data: { container: path.basename(info.rel), target: t.pkg } });
    });
  },
};

const containerOneView = {
  meta: { type: 'suggestion', docs: { description: 'a container renders only views, typically one, and puts containers into its slots; several views is usually a layout hidden in the container' }, schema: [], messages: { found: 'container {{container}} imports {{count}} views ({{views}}). A container typically renders one view and composes containers into its slots; if this is a layout of several views, it belongs in a view of its own (a loading/empty state next to the main view is fine).' } },
  create(context) {
    const info = fileInfo(context);
    if (info.kind !== 'container') return {};
    const views = [];
    let last = null;
    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        const rel = resolveImport(node.source.value, info.abs, info.s);
        if (rel && classify(rel) === 'view') { views.push(path.posix.basename(rel).replace(/\.[^.]+$/, '')); last = node.source; }
      },
      'Program:exit'() {
        if (views.length > 1 && last) context.report({ node: last, messageId: 'found', data: { container: path.basename(info.rel), count: String(views.length), views: views.join(', ') } });
      },
    };
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// store rules: small writes keep the islands in the data apart
// ---------------------------------------------------------------------------------------------------------------------

/** functions that look like reducers: first parameter named state / draft, written inside a createSlice(...) call */
function isReducerFn(node, sourceCode) {
  const p0 = node.params?.[0];
  if (!p0 || p0.type !== 'Identifier' || !/^(state|draft)$/.test(p0.name)) return false;
  const ancestors = sourceCode?.getAncestors ? sourceCode.getAncestors(node) : [];
  return ancestors.some((a) => a.type === 'CallExpression' && ((a.callee.type === 'Identifier' && a.callee.name === 'createSlice') || (a.callee.type === 'MemberExpression' && a.callee.property.type === 'Identifier' && a.callee.property.name === 'createSlice')));
}

function rootedAtState(expr, params) {
  let e = expr;
  while (e && (e.type === 'MemberExpression' || e.type === 'TSNonNullExpression' || e.type === 'ChainExpression')) e = e.type === 'MemberExpression' ? e.object : e.expression;
  return !!e && e.type === 'Identifier' && params.has(e.name);
}

const storeNoStateReplace = {
  meta: { type: 'problem', docs: { description: 'a reducer mutates the fields that changed; returning a new state replaces the whole slice, so every field "changes" at once and every subscriber re-renders' }, schema: [], messages: { found: 'reducer returns a new state: the whole slice is replaced and every field changes together. Mutate the fields that changed (Immer) so subscriptions stay narrow.' } },
  create(context) {
    const info = fileInfo(context);
    if (info.kind !== 'store') return {};
    const stack = [];
    const source = context.sourceCode ?? context.getSourceCode();
    const enter = (node) => {
      const reducer = isReducerFn(node, source);
      stack.push(reducer ? 'reducer' : 'other');
      // `(state, action) => ({ ...state, filter: action.payload })`: an expression body is a return
      if (reducer && node.type === 'ArrowFunctionExpression' && node.body.type === 'ObjectExpression') context.report({ node: node.body, messageId: 'found' });
    };
    const leave = () => stack.pop();
    return {
      ArrowFunctionExpression: enter, 'ArrowFunctionExpression:exit': leave,
      FunctionExpression: enter, 'FunctionExpression:exit': leave,
      FunctionDeclaration: enter, 'FunctionDeclaration:exit': leave,
      ReturnStatement(node) {
        if (stack[stack.length - 1] !== 'reducer' || !node.argument) return;
        if (node.argument.type === 'Identifier' && /^(state|draft)$/.test(node.argument.name)) return; // `return state` is a no-op
        context.report({ node: node.argument, messageId: 'found' });
      },
    };
  },
};

const storeNoObjectSwap = {
  meta: { type: 'problem', docs: { description: 'a reducer assigns changed fields, it does not swap a whole object: `t.done = x`, not `byId[id] = { ...t, done: x }` or `Object.assign(t, patch)`' }, schema: [], messages: { found: 'a whole object is swapped ({{text}}): every field under it changes at once and the islands in the data merge. Assign the fields that changed instead.', assign: 'Object.assign writes every field of the patch onto {{text}}, changed or not, so the whole object changes at once. Assign the fields that changed instead.' } },
  create(context) {
    const info = fileInfo(context);
    if (info.kind !== 'store') return {};
    const params = new Set();
    const aliases = new Set();
    const fnStack = [];
    const source = context.sourceCode ?? context.getSourceCode();
    const enter = (node) => { fnStack.push(node); if (isReducerFn(node, source)) params.add(node.params[0].name); };
    const leave = () => fnStack.pop();
    return {
      ArrowFunctionExpression: enter, 'ArrowFunctionExpression:exit': leave,
      FunctionExpression: enter, 'FunctionExpression:exit': leave,
      FunctionDeclaration: enter, 'FunctionDeclaration:exit': leave,
      VariableDeclarator(node) {
        // const t = state.tasks.byId[id]  -> t is a state alias
        if (node.id.type === 'Identifier' && node.init && rootedAtState(node.init, new Set([...params, ...aliases]))) aliases.add(node.id.name);
      },
      AssignmentExpression(node) {
        if (!params.size || node.operator !== '=') return;
        if (!rootedAtState(node.left, new Set([...params, ...aliases]))) return;
        const r = node.right;
        const spreads = (r.type === 'ObjectExpression' && r.properties.some((pr) => pr.type === 'SpreadElement')) || (r.type === 'ArrayExpression' && r.elements.some((el) => el && el.type === 'SpreadElement'));
        if (spreads) context.report({ node, messageId: 'found', data: { text: source.getText(node.left) } });
      },
      CallExpression(node) {
        // Object.assign(state.tasks.byId[id], patch)
        if (!params.size) return;
        const c = node.callee;
        if (c.type !== 'MemberExpression' || c.object.type !== 'Identifier' || c.object.name !== 'Object' || c.property.type !== 'Identifier' || c.property.name !== 'assign') return;
        const target = node.arguments[0];
        if (target && rootedAtState(target, new Set([...params, ...aliases]))) context.report({ node, messageId: 'assign', data: { text: source.getText(target) } });
      },
    };
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// module rules
// ---------------------------------------------------------------------------------------------------------------------

const moduleNoForeignView = {
  meta: { type: 'problem', docs: { description: "a module's views are private; other modules compose its containers and read its hooks. Shared views live in the shared layer" }, schema: [], messages: { found: '{{from}} (module {{fromModule}}) imports view {{target}} of module {{toModule}}. Views are private to their module; compose {{toModule}}\'s containers instead, or publish {{target}} in {{toModule}}/shared/ or the shared layer.' } },
  create(context) {
    return forEachImport(context, (node, t, info) => {
      if (!info.module || info.module === '@app' || !t.module || t.module === '@shared' || t.module === info.module) return;
      if (inModuleShared(t.rel, info.s)) return; // the module publishes it on purpose
      if (t.kind === 'view' || t.kind === 'page') context.report({ node: node.source, messageId: 'found', data: { from: path.basename(info.rel), fromModule: info.module, target: t.name, toModule: t.module } });
    });
  },
};

const sharedNoModuleImport = {
  meta: { type: 'problem', docs: { description: 'the shared view layer depends on no module' }, schema: [], messages: { found: 'shared {{from}} imports {{target}} of module {{toModule}}. The shared layer depends on nothing; pass what you need as props.' } },
  create(context) {
    return forEachImport(context, (node, t, info) => {
      if (info.module !== '@shared' || !t.module || t.module === '@shared') return;
      context.report({ node: node.source, messageId: 'found', data: { from: path.basename(info.rel), target: t.name, toModule: t.module } });
    });
  },
};

// ---------------------------------------------------------------------------------------------------------------------

const rules = {
  'view-no-container-import': viewNoContainerImport,
  'view-no-logic-import': viewNoLogicImport,
  'view-no-state': viewNoState,
  'view-no-effect': viewNoEffect,
  'view-no-data-hook': viewNoDataHook,
  'view-no-inline-handler': viewNoInlineHandler,
  'container-no-markup': containerNoMarkup,
  'container-no-store-import': containerNoStoreImport,
  'container-one-view': containerOneView,
  'store-no-state-replace': storeNoStateReplace,
  'store-no-object-swap': storeNoObjectSwap,
  'module-no-foreign-view': moduleNoForeignView,
  'shared-no-module-import': sharedNoModuleImport,
};

const plugin = { meta: { name: 'eslint-plugin-superarchitecture', version: '0.1.0' }, rules, configs: {} };

/** flat config: `import superarchitecture from 'eslint-plugin-superarchitecture'; export default [superarchitecture.configs.recommended]` (add your TS parser) */
plugin.configs.recommended = {
  name: 'superarchitecture/recommended',
  files: ['**/*.{ts,tsx,js,jsx}'],
  // stories and tests are neither views nor containers: they may hold state, mocks and providers
  ignores: ['**/*.stories.*', '**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
  plugins: { superarchitecture: plugin },
  rules: {
    'superarchitecture/view-no-container-import': 'error',
    'superarchitecture/view-no-logic-import': 'error',
    'superarchitecture/view-no-state': 'error',
    'superarchitecture/view-no-effect': 'error',
    'superarchitecture/view-no-data-hook': 'error',
    'superarchitecture/view-no-inline-handler': 'warn',
    'superarchitecture/container-no-markup': 'error',
    'superarchitecture/container-no-store-import': 'error',
    'superarchitecture/container-one-view': 'warn',
    'superarchitecture/store-no-state-replace': 'error',
    'superarchitecture/store-no-object-swap': 'error',
    'superarchitecture/module-no-foreign-view': 'error',
    'superarchitecture/shared-no-module-import': 'error',
  },
};

export default plugin;
export { rules };
