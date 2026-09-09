# Tooling

The rules in this repository are meant to be checked by machines, not remembered by people. Three tools cover them:

| tool | checks | where |
|---|---|---|
| `eslint-plugin-superarchitecture` | containers, views, hooks, reducers, module boundaries | `packages/eslint-plugin` |
| `stylelint-config-superarchitecture` | BEM naming, flat selectors, tokens-only modifiers and states | `packages/stylelint-config` |
| import/render graph analyzer | import graph vs render tree, subscriptions, re-render islands, module cycles | not published yet, see below |

Everything is convention-based: a file is a container because it is named `XContainer.tsx`, a view because it is any other `.tsx`, hooks live in `hooks.ts` / `useX.ts`, slices in `xSlice.ts`. No decorators, no types, no registration.

---

## ESLint plugin

Thirteen rules. Every rule maps to one sentence of the guideline.

| rule | guideline |
|---|---|
| `view-no-container-import` | a view never imports a container, by file (`XContainer.tsx`) or by name through a barrel (`import { XContainer } from '@/modules/x'`, re-exports included); type-only imports are fine. It offers a `ReactNode` slot instead |
| `view-no-logic-import` | a view imports only views, the shared layer and pure utils |
| `view-no-state` | a view holds no `useState` / `useReducer`; state lives in the container above |
| `view-no-effect` | a view runs no `useEffect` / `useLayoutEffect` |
| `view-no-data-hook` | a view calls no data hooks; only harmless React built-ins (`useRef`, `useMemo`, `useCallback`, `useId`) |
| `view-no-inline-handler` (warn) | a view passes handlers it received, it does not create them |
| `container-no-markup` | a container renders no JSX elements, only its one view and child containers |
| `container-one-view` (warn) | a container renders only views, typically one; several views is usually a layout hidden in the container |
| `container-no-store-import` | a container reads data through module hooks, never the store or a slice |
| `store-no-state-replace` | a reducer mutates fields, it never returns a new slice object (`return { ...state }` or an expression body) |
| `store-no-object-swap` | a reducer assigns changed fields, it never swaps a whole entity (spread swap, `Object.assign` onto state) |
| `module-no-foreign-view` | a module's views are private; other modules use its containers and hooks |
| `shared-no-module-import` | the shared view layer imports nothing from modules |

### Install

```sh
npm install --save-dev eslint-plugin-superarchitecture typescript-eslint
```

Until the package is published, install it from this repository:

```sh
npm install --save-dev ./packages/eslint-plugin
```

### Flat config

```js
// eslint.config.mjs
import tseslint from 'typescript-eslint';
import superarchitecture from 'eslint-plugin-superarchitecture';

export default [
  ...tseslint.configs.recommended,
  superarchitecture.configs.recommended,
  {
    settings: {
      superarchitecture: {
        modulesDir: 'src/modules',       // direct subfolders are the modules
        sharedDir: 'src/components',     // views shared by all modules; imports no module
        moduleSharedDirs: ['shared', 'public'], // <module>/shared/ and <module>/public/ may be imported by other modules
        aliases: { '@/': 'src/' },
      },
    },
  },
];
```

### Settings

| key | default | meaning |
|---|---|---|
| `root` | `process.cwd()` | project root the paths below are relative to |
| `modulesDir` | `''` | direct subfolders are the modules; empty = no module layer, module rules stay silent |
| `sharedDir` | `''` | the shared view layer: anyone may import it, it imports no module |
| `moduleSharedDirs` | `['shared', 'public']` | a module's public views: `<module>/shared/**` may be imported by other modules |
| `aliases` | `{ '@/': 'src/' }` | import prefixes mapped to project-relative folders |
| `storeLibraries` | react-redux, @reduxjs/toolkit, zustand, jotai, valtio, mobx-react | packages a container must not import directly (`container-no-store-import`) |
| `viewHooks` | `useRef`, `useId`, `useContext`, `useMemo`, `useCallback`, `useTransition`, `useDeferredValue`, `useImperativeHandle`, `useDebugValue`, `useSyncExternalStore` | hooks a view may call (`view-no-data-hook`); add `useTranslation`, `useTheme` or similar if your views read a context with a safe default |

Stories and tests (`*.stories.*`, `*.test.*`, `*.spec.*`, `__tests__/`) are ignored by the recommended config: they are neither views nor containers.

### Standalone runner

For a codebase that has no ESLint setup yet, or to get a report without touching its config:

```sh
node packages/eslint-plugin/bin/check.js --root ../my-app --dir src --modules src/modules --shared src/components [--verbose] [--json]
```

The runner prints one line per violation (`file:line rule message`) and a count per rule. On Windows in Git Bash, omit `--alias`; MSYS rewrites `@/=src/` into a path.

### Adopting it on an existing codebase

Turn on one rule at a time, in this order, and get each to zero before the next:

1. `view-no-container-import` — the rule itself. Every violation becomes a slot.
2. `container-no-store-import` — hooks become the module's data API.
3. `view-no-state`, `view-no-effect`, `view-no-data-hook` — views become pure functions.
4. `store-no-object-swap`, `store-no-state-replace` — data islands stop merging.
5. `module-no-foreign-view`, `shared-no-module-import` — module boundaries.

The rest (`view-no-logic-import`, `container-no-markup`, `container-one-view`) rarely fire once the first three groups are clean.

---

## Stylelint config

Enforces `docs/05-css-architecture.md` on `.module.scss` files: BEM class names, single-class selectors, no ids or tag selectors, no `!important`, and the custom rule `superarchitecture/modifier-sets-tokens-only`: inside a modifier, a state pseudo-class or a media query only custom properties may be set. Elements read tokens, modifiers set them.

```js
// stylelint.config.mjs
export default {
  extends: ['stylelint-config-superarchitecture'],
  customSyntax: 'postcss-scss',
};
```

See `packages/stylelint-config/README.md` for the rule table and how to relax a rule.

---

## Analyzer

The numbers in docs 02 and 03 come from an import/render graph analyzer that is not published yet. The lint rules check files; the analyzer reads the whole TypeScript project with the compiler API and measures what a single file cannot show:

- **two graphs**: the import graph next to the render graph; under the rule the first is flat and the second is deep
- **subscriptions and islands**: every container's selector paths, and how many re-render islands one state change or action touches (wide and pass-through subscriptions, coarse writes measured against real readers)
- **modules**: the module graph with cycles and submodule candidates

---

## Claude skills

`.claude/skills/` holds skills that teach Claude Code the same rules:

| skill | when it triggers |
|---|---|
| `containers-and-views` | writing or changing components, wiring data, "why does everything re-render" |
| `module-scaffolding` | new module, new feature, "where does this file go" |
| `css-architecture` | styling, variants, themes, responsive |
| `refactoring-to-containers` | migrating a component with hooks and markup, removing Storybook decorators |
| `reviewing-architecture` | reviewing a PR or a module against the rules |

Copy the folder into your project (or symlink it) and the skills load automatically. Each skill points to the guideline it enforces, so the docs stay the source of truth.
