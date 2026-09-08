# Tooling

The rules in this repository are meant to be checked by machines, not remembered by people. Three tools cover them:

| tool | checks | where |
|---|---|---|
| `eslint-plugin-superarchitecture` | containers, views, hooks, reducers, module boundaries | `packages/eslint-plugin` |
| `stylelint-config-superarchitecture` | BEM naming, flat selectors, tokens-only modifiers and states | `packages/stylelint-config` |
| `twographs` analyzer + viewer | import graph vs render tree, subscriptions, re-render islands, module cycles | separate repo, see below |

Everything is convention-based: a file is a container because it is named `XContainer.tsx`, a view because it is any other `.tsx`, hooks live in `hooks.ts` / `useX.ts`, slices in `xSlice.ts`. No decorators, no types, no registration.

---

## ESLint plugin

Twelve rules. Every rule maps to one sentence of the guideline.

| rule | guideline |
|---|---|
| `view-no-container-import` | a view never imports a container; it offers a `ReactNode` slot instead |
| `view-no-logic-import` | a view imports only views, the shared layer and pure utils |
| `view-no-state` | a view holds no `useState` / `useReducer`; state lives in the container above |
| `view-no-effect` | a view runs no `useEffect` / `useLayoutEffect` |
| `view-no-data-hook` | a view calls no data hooks; only harmless React built-ins (`useRef`, `useMemo`, `useCallback`, `useId`) |
| `view-no-inline-handler` (warn) | a view passes handlers it received, it does not create them |
| `container-no-markup` | a container renders no JSX elements, only its one view and child containers |
| `container-one-view` | a container renders exactly one view (its own or a shared one) |
| `container-no-store-import` | a container reads data through module hooks, never the store or a slice |
| `store-no-state-replace` | a reducer mutates fields, it never returns a new slice object |
| `store-no-object-swap` | a reducer assigns changed fields, it never swaps a whole entity |
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
        moduleSharedDirs: ['shared'],    // <module>/shared/ may be imported by other modules
        aliases: { '@/': 'src/' },
      },
    },
  },
];
```

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

## Analyzer and viewer (twographs)

The lint rules check files. The analyzer checks the graph: it reads a TypeScript codebase with the compiler API and produces the import graph, the render graph, every container's subscriptions (selector paths, memoization), every reducer's writes, and the module graph. The viewer draws them:

- **views · import**: import graph next to render graph. Under the rule the import graph is flat and the render graph is deep; without it they are the same tree.
- **build the render tree**: step by step, how a container is created inside its parent container and passed through view slots to its place.
- **state · containers · views** with **trace**: click a state field or an action and watch which containers re-render.
- **islands**: how many re-render islands one change touches.
- **design: data → containers**: the state tree coloured by change groups, the places where each group lands, and the proposed container per island × place.
- **modules**: module graph with cycles and foreign-view imports.

It lives in the `twographs` repository (analyzer, viewer, fixtures). Run it on your app with:

```sh
twographs analyze --entry src/main.tsx --modules src/modules --shared src/components --out graph.json
```

and open the JSON in the viewer. The analyzer reports what lint cannot see: wide subscriptions, pass-through ids, coarse writes measured against real readers, module cycles and submodule candidates.

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
