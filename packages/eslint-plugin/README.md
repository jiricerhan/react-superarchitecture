# @twographs/eslint-plugin

The container / view rule as lint rules. Convention-based, no type information needed:
`*Container.tsx` is a container, any other `.tsx` is a view, `hooks.ts` / `use*.ts` are hooks, `*Slice.ts` / `store.ts` is the store,
`page.tsx` under `src/app` (and `main.tsx` / `App.tsx` at the root) are composition roots.

| rule | what it says |
|---|---|
| `view-no-container-import` | a view never imports a container: it offers a `ReactNode` prop and a container fills it |
| `view-no-logic-import` | a view imports only views, the shared layer and pure utils: no hooks, store, queries, store libraries |
| `view-no-state` | a view owns no state (`useState`, `useReducer`); state and its handler live in a container, hover is CSS |
| `view-no-effect` | a view runs no effects |
| `view-no-data-hook` | a view calls no hooks beyond harmless React built-ins (`useRef`, `useMemo`, `useCallback`, `useId`, ...) |
| `view-no-inline-handler` (warn) | a view hands no fresh function to a component; adapting a DOM event on a host element is fine |
| `container-no-markup` | a container renders no host elements; markup and style belong to its view |
| `container-no-store-import` | a container reaches data through the module hooks, never the store, a slice or a store library |
| `container-one-view` | a container renders exactly one view (its own or a shared one) and composes containers into its slots; several views = layout hidden in the container |
| `store-no-state-replace` | a reducer mutates the fields that changed; `return { ...state }` replaces the whole slice and every subscriber re-renders |
| `store-no-object-swap` | a reducer assigns changed fields, it does not swap a whole object (`byId[id] = { ...t, done }`): the islands in the data merge |
| `module-no-foreign-view` | a module's views are private; other modules compose its containers and read its hooks; shared views live in the shared layer or in the module's public folder (`<module>/shared/`, `moduleSharedDirs`) |
| `shared-no-module-import` | the shared view layer depends on no module |

Not here on purpose (they need the type checker or the whole graph and live in `@twographs/analyze`): wide and pass-through
subscriptions, prop stability, module cycles (use `import/no-cycle`).

## Use

```js
// eslint.config.js (flat)
import tseslint from 'typescript-eslint';
import twographs from '@twographs/eslint-plugin';

export default [
  ...tseslint.configs.recommended,
  {
    ...twographs.configs.recommended,
    settings: {
      twographs: {
        root: import.meta.dirname,
        modulesDir: 'src/modules',   // direct subfolders are the modules; '' = no module layer
        sharedDir: 'src/components', // the shared view layer
        aliases: { '@/': 'src/' },
      },
    },
  },
];
```

## Try it on a project without touching its config

```
node bin/check.js --root C:/projects/akicolors --modules src/modules --shared src/components [--verbose] [--json]
node bin/check.js --root ../fixture --modules src
```

Git Bash on Windows rewrites `@/=src/` arguments into Windows paths; the default alias `@/ -> src/` is applied when
`--alias` is omitted, or run with `MSYS_NO_PATHCONV=1`.
