---
name: reviewing-architecture
description: >
  Reviews React code against the react-superarchitecture rules: container / view separation, slots instead of container
  imports, narrow id-addressed hooks, memo on containers only, small writes in reducers, module boundaries and the shared
  layer, CSS next to views. Use this skill whenever the user asks to "review this PR", "review this component", "review
  this module", "does this follow the architecture", "check my containers", "is this a proper view", "why does this
  re-render", or wants a change validated before commit. Reviews what changed; does not rewrite the code (see
  `refactoring-to-containers` for that) and does not teach the rules from scratch (see `containers-and-views`).
---

# Reviewing Architecture

Review the change against the rules below, in this order. **Focus on what changed.** Pre-existing violations in
untouched code are mentioned once at the end, not as findings.

## Procedure

**0. Classify every touched file by name.** The lint does the same, so the name decides the rules:
`*Container.tsx` → container; any other `.tsx` → view; `hooks.ts` / `use*.ts` → hooks; `*Slice.ts` / `store.ts` → store;
`page.tsx` under `src/app`, `App.tsx`, `main.tsx` → composition root (a container without the `memo` requirement);
`src/components/**` → shared layer; `src/modules/<m>/shared/**` → the module's public views. A file that does not fit its
name (a `.tsx` with hooks and markup) is the first finding: it is neither.

**1. Views.** For every view:
- imports: no container, no `hooks.ts`, no slice, no `react-redux` / query client, no module-private view of another module
- no `useState`, `useReducer`, `useEffect`, `useLayoutEffect`, no data hook; `useRef`/`useMemo`/`useCallback`/`useId`/`useContext` are fine
- props are values (`title: string`), not entities (`task: Task`), not ids that are only handed on
- handlers are received, not created with domain logic; no fresh function passed to a component (a DOM event adapter on a host element is fine)
- wherever a container belongs there is a `ReactNode` slot
- would this render in Storybook with plain props and no provider? If not, it is not a view

**2. Containers.** For every container:
- no host elements, no `className`, no style; at most a fragment
- exactly one view rendered; several views = a layout hidden in the container
- data only through the module's hooks; no `useSelector`, no store, no slice import
- child containers receive ids, never objects; their elements go into the view's slots
- `memo` when created by another container, with stable props (ids, `useCallback` handlers); `displayName` set on the inner function
- no container that only subscribes to pass values down (pass-through)

**3. Hooks and selectors.**
- width: one hook returns one field or one derived value; flag `useX()` returning a whole slice or entity when the callers use one field
- id-addressed: `useTaskTitle(id)`, not `useTasks()` plus a lookup in the container
- derived values through `createSelector`; a selector returning a fresh object or array on every call is a finding
- parameterized selectors created per instance (`useMemo(makeSelector, [])`)
- action hooks return stable callbacks

**4. Reducers.** Small writes only:
- `t.done = !t.done`, not `byId[id] = { ...t, done }` (`store-no-object-swap`)
- never `return { ...state, x }` (`store-no-state-replace`)
- API responses written field by field or diffed; a bulk assignment of a fetched object over a subscribed one is a finding

**5. Module boundaries.**
- a module imports another module's containers and hooks only, never its views (except `<module>/shared/`)
- the shared layer (`src/components`) imports nothing from `src/modules` and no hooks
- edges between modules are container → container or hook → hook; never view → view
- cycles between modules (`import/no-cycle`): usually a module that is both a UI kit and a page composing its siblings; the kit belongs in the shared layer

**6. CSS.**
- styles live next to views only; a container has no stylesheet
- class names are BEM (`block__element--modifier`, state as `is-*`), flat, no nesting that mirrors the component tree
- no styling in containers, no inline style objects created in a container

## Severity

| severity | when |
|---|---|
| **blocker** | a view imports a container, hooks, the store or a store library; a container renders markup or several views; a reducer replaces state or swaps an object under subscribers; a module imports a foreign private view |
| **major** | entity props on a view; pass-through ids; a wide hook where narrow ones exist; a container without `memo` that a re-rendering owner creates; derived value without a memoized selector; state or effect in a view |
| **minor** | inline handler on a component in a view; naming that misclassifies the file; a `memo` on a view; shared-layer file that imports a module util |
| **note** | pre-existing violations in untouched code, listed once |

## Phrasing a finding

One line each, in this shape: `path/File.tsx:line` — `rule-name` — what is wrong — the fix.

```
src/modules/board/Task/Task.tsx:3 — view-no-container-import — the view imports TaskActionsContainer.
  Add an `actions: ReactNode` slot; TaskContainer fills it with <TaskActionsContainer taskId={id} />.
src/modules/board/hooks.ts:12 — (analyzer: wide subscription) — useBoard() returns the whole slice; callers use `filter` and `columns.ids`.
  Split into useFilter() and useColumnIds().
```

Name the lint rule when one exists; write "(analyzer: …)" for wide subscriptions, pass-through props, unstable props and
coarse writes measured against readers, which the lint cannot see. Finish with a two-line verdict: what blocks, what is
fine.

## Run the tooling

```
node packages/eslint-plugin/bin/check.js --root <dir> --modules src/modules --shared src/components --verbose
```

Quote the rule counts it prints. For CSS run the project's stylelint (`npx stylelint "src/**/*.{css,scss}"`) when the
project has a config; the rules above are the manual fallback. For re-render questions point to the analyzer
(`design: data → containers`, `trace`, `islands`) rather than guessing.

---
Full reference: **docs/02-containers-and-views.md** (rules, tooling table, FAQ) and **docs/03-data-flow.md** (hooks,
islands, small writes, typical mistakes).
Related skills: `containers-and-views`, `refactoring-to-containers`.
