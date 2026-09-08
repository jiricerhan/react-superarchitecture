---
name: containers-and-views
description: >
  The container / view rule of this architecture: a view never imports a container, containers compose through
  `ReactNode` slots, views are pure functions of their props, containers hold data and behaviour and render exactly one
  view. Use this skill whenever writing or changing a React component in a project that follows react-superarchitecture,
  even when the user does not say "container" or "view": "add a component", "wire data into X", "this view needs the
  store", "add a hook", "fetch in the component", "useSelector in the component", "useState in the component", "split
  this component", "where does this logic go", "why does everything re-render", "add a slot", "pass the task down".
  Not for reviewing an existing diff (see `reviewing-architecture`) or migrating legacy components in bulk (see
  `refactoring-to-containers`).
---

# Containers and Views

> **A view never imports a container. Containers compose through `ReactNode`.**

The same rule in other words: **do not mix data and views.** Anything that knows about data (a hook, a store, an id, a
handler with domain logic) lives in a container; anything that knows about pixels (markup, class names, layout) lives in
a view. The import graph stays flat; React composes the render tree from slots.

## Definitions

- **View** (`Task.tsx`): props in, markup out. A pure function of its props. Named after what it shows, no `View` suffix.
- **Container** (`TaskContainer.tsx`): subscriptions, handlers, effects, state. No markup. Renders exactly one view and
  puts child containers into its slots.
- **Slot**: a `ReactNode` prop of a view where a container puts content.
- **Island**: a container plus the views it renders up to the next container. Re-renders whole.

## View rules

- [ ] No `useState`, no `useReducer`: state and its handler live in a container; hover is CSS.
- [ ] No `useEffect`, no data hooks, no store, no queries. Harmless React built-ins are fine (`useRef`, `useMemo`,
      `useCallback`, `useId`, `useContext`).
- [ ] Imports only views, the shared layer and pure utils. Never a container, never `hooks.ts`, never a slice.
- [ ] Receives **values** (`title: string`, `selected: boolean`), never entities (`task: Task`), never ids to pass on.
- [ ] Passes the handlers it got; creates none with domain logic. Adapting a DOM event on a host element is fine
      (`onChange={(e) => onChange(e.target.value)}`).
- [ ] Hands no fresh function to a *component* (a memoized child would re-render for nothing).
- [ ] Offers a `ReactNode` slot wherever a container belongs.
- [ ] Renders in Storybook and tests with plain props: no provider, no mock, no fetch.

Library components that hold state (a headless Dialog, a Combobox) are views imported as views. Our own views hold none.

## Container rules

- [ ] No host elements, no class names, no style. At most a fragment.
- [ ] Renders **exactly one view** (its own or a shared one). Several views side by side is a layout hidden in a
      container: move it into a view with slots.
- [ ] Reads data only through the module's hooks (`useTaskTitle(id)`), never the store, a slice or `useSelector`.
- [ ] Creates child containers and passes them **ids**, never objects; puts their elements into the view's slots.
- [ ] Creates handlers with `useCallback`; passes stable props to child containers.
- [ ] `memo` when it is created by another container. `memo` nowhere else.
- [ ] Owns UI state that is not hover (open panel, edit mode): a container for one boolean is the price of pure views.

## Composing through slots

```tsx
// ❌ Before: the view imports a container; the import graph copies the render graph
import { TaskActionsContainer } from './TaskActionsContainer';
const Task = ({ task }: { task: Task }) => (
  <div className="card">
    <h3>{task.title}</h3>
    <TaskActionsContainer taskId={task.id} />
  </div>
);

// ✅ After: the view offers slots and takes values; the container fills the slots
type Props = { title: string; selected: boolean; onSelect: () => void; assignee: ReactNode; actions: ReactNode };
export function Task({ title, selected, onSelect, assignee, actions }: Props) {
  return (
    <div className={selected ? 'card is-selected' : 'card'} onClick={onSelect}>
      <div className="card__head">
        <h3 className="card__title">{title}</h3>
        <div className="card__footer">{actions}</div>
      </div>
      <div className="card__body">{assignee}</div>
    </div>
  );
}

function TaskContainerImpl({ id }: { id: string }) {
  const title = useTaskTitle(id);
  const selected = useIsTaskSelected(id);
  const selectTask = useSelectTask();
  const onSelect = useCallback(() => selectTask(id), [selectTask, id]);
  const assignee = <AssigneeContainer taskId={id} />;
  const actions = <TaskActionsContainer taskId={id} />;
  return <Task title={title} selected={selected} onSelect={onSelect} assignee={assignee} actions={actions} />;
}
export const TaskContainer = memo(TaskContainerImpl);
```

The view decides *where* a slot goes in the markup; the container decides *what* goes in. Neither knows the other's
decision. Data never passes through a view to reach a container below it.

## Adding data to an existing view

Never add a hook to the view. Two options, pick by where the data lands:

1. **The data lands in this view's own markup** (a title, a flag): make or extend the container **above** it. Add a
   narrow hook in `hooks.ts`, read it in the container, pass the value down as a prop.
2. **The data lands in one spot of the view that changes at its own pace** (assignee, actions, a counter): add a
   **child container** into a **slot**. The view gets a `ReactNode` prop; the parent container fills it with
   `<XContainer id={id} />`.

If the view does not have a container yet, it gets one now: `X.tsx` keeps the markup, `XContainer.tsx` takes the hooks.

## Naming and files

| kind | file | export |
|---|---|---|
| view | `Task.tsx` | `Task` |
| container | `TaskContainer.tsx` | `TaskContainer` (memoized: `memo(TaskContainerImpl)` with `displayName` set) |
| hooks (module data API) | `hooks.ts` or `useX.ts` | `useTaskTitle`, `useSelectTask` |
| store | `boardSlice.ts`, `store.ts` | private to the module |

The lint classifies by these names (`*Container.tsx` is a container, any other `.tsx` is a view), so the name is not
cosmetic. A module lives under `src/modules/<name>`, its views are private, shared views live in `src/components` or
`<module>/shared/`.

## Hooks: narrow and id-addressed

- Subscribe to the field you show: `useTaskTitle(id)`, not `useTask(id).title`, never `useBoard()`.
- Derived values through a memoized selector (`createSelector`): `useVisibleTaskIds(columnId)`, `useStats()`.
  Parameterized selectors are created per instance (`useMemo(makeSelector, [])`).
- The child computes its own derived state: `useIsTaskSelected(id)` returns a boolean; only two cards re-render.
- Action hooks return stable callbacks (`useSelectTask()` wraps `dispatch` in `useCallback`).
- A container that subscribes only to pass data down is a pass-through: move the composition up.

## Memo

- `memo` on containers created by another container. Their props must be stable: ids, `useCallback` handlers.
- No `memo` on views. Under strict views a re-render starts only in a container, so islands are exactly the container
  boundaries.

## Small writes in reducers

```ts
// ✅ one field changes
toggleDone(state, action) { const t = state.tasks.byId[action.payload]; if (t) t.done = !t.done; }
// ❌ the whole task is swapped; title, assigneeId and done "change" at once
toggleDone(state, action) { state.tasks.byId[id] = { ...state.tasks.byId[id], done: !done }; }
// ❌ the whole slice is replaced
setFilter(state, action) { return { ...state, filter: action.payload }; }
```

Immer lets you write the fine-grained form. API responses are written field by field or diffed against current state.

## Stories and tests

A view renders with plain props and nothing else:

```tsx
export const Selected = () => (
  <Task title="Design tokens" selected onSelect={() => {}} assignee={<span>Alena</span>} actions={null} />
);
```

No `Provider`, no store decorator, no mocked hooks, no fetch. If a story needs one of those, the component is not a
view. Containers are tested through their hooks, without a DOM.

## When you are tempted to…

| temptation | do this instead |
|---|---|
| put `useState` in a view (open, editing, hovered) | hover is CSS; anything else moves to the container, the view gets `open` + `onToggle` |
| pass `task: Task` to a view | pass `title`, `selected`, …; every other field is another island → child container in a slot |
| import `XContainer` inside a view | add a `x: ReactNode` slot prop; the parent container fills it |
| write one hook that returns the whole object | several narrow hooks, id-addressed; memoized selector for derived values |
| pass `taskId` through a view so a child can use it | the child container belongs in a slot filled by the container that already has the id |
| call `useSelector` / `useQuery` in a container | add a hook to `hooks.ts`; the container calls the hook |
| put a `<div>` around two containers in a container | that `<div>` is a view with two slots |
| `memo` a view "to be safe" | remove it; `memo` the container it belongs to |
| `state.items.byId[id] = { ...item, done }` | `state.items.byId[id].done = done` |

## Review checklist

Before finishing, walk the change against the lint rules (`eslint-plugin-superarchitecture`):

| check | rule |
|---|---|
| no view imports a container | `view-no-container-import` |
| no view imports hooks, store, queries or store libraries | `view-no-logic-import` |
| no view has state, effects or data hooks | `view-no-state`, `view-no-effect`, `view-no-data-hook` |
| no view hands a fresh function to a component | `view-no-inline-handler` |
| no container renders host elements | `container-no-markup` |
| every container renders exactly one view | `container-one-view` |
| no container imports the store, a slice or a store library | `container-no-store-import` |
| reducers assign fields, never replace objects or state | `store-no-object-swap`, `store-no-state-replace` |
| no module imports another module's private view | `module-no-foreign-view` |
| the shared layer imports no module | `shared-no-module-import` |

Run it: `node packages/eslint-plugin/bin/check.js --root <dir> --modules src/modules --shared src/components --verbose`.

---
Full reference: **docs/02-containers-and-views.md** (the rule, definitions, FAQ) and **docs/03-data-flow.md** (hooks,
islands, small writes, designing containers from data).
Related skills: `reviewing-architecture`, `refactoring-to-containers`.
