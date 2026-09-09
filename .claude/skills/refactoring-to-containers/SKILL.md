---
name: refactoring-to-containers
description: >
  Migrates existing React components to the react-superarchitecture container / view split, one leaf at a time, keeping
  the app working at every commit: split hooks from markup, replace container imports in views with `ReactNode` slots,
  narrow the hooks, fix reducers to small writes, run the lint to zero, delete Storybook decorators that became
  unnecessary. Use this skill whenever the user asks to "refactor this to containers and views", "extract a container",
  "split this component", "this component has hooks and markup", "remove the Provider from the stories", "make this a
  view", "get rid of useSelector here", or wants a legacy tree brought under the lint. Not for writing new components
  (see `containers-and-views`) or for reviewing without changing (see `reviewing-architecture`).
---

# Refactoring to Containers

Refactor **one leaf at a time**, bottom up, and keep the app compiling and rendering after every step. Do not move whole
trees. The board example (`examples/board`) is the target shape; the "before" snippets below are the usual legacy form.

## Procedure

### 1. Pick one leaf component with hooks

Start with the deepest component that calls a data hook or holds state and has markup. It will become a container plus a
view. Leaves first: their parents may still be mixed, that is fine for now.

```tsx
// Before: hooks and markup in one file, imports a nested "container"
import { useSelector, useDispatch } from 'react-redux';
import { TaskActions } from './TaskActions';
export function Task({ id }: { id: string }) {
  const task = useSelector((s: RootState) => s.board.tasks.byId[id]);
  const selectedId = useSelector((s: RootState) => s.board.selectedTaskId);
  const dispatch = useDispatch();
  return (
    <div className={id === selectedId ? 'card is-selected' : 'card'} onClick={() => dispatch(selectTask(id))}>
      <h3>{task.title}</h3>
      <TaskActions taskId={id} />
      <span>{task.assignee?.name}</span>
    </div>
  );
}
```

### 2. Split into `XContainer.tsx` and `X.tsx`

The container takes every hook, handler and `memo`; the view keeps the markup and gets a props type of **values**.
Everything the view rendered that has its own data becomes a `ReactNode` slot (next step).

```tsx
// After: Task.tsx, props only
type Props = { title: string; selected: boolean; onSelect: () => void; assignee: ReactNode; actions: ReactNode };
export function Task({ title, selected, onSelect, assignee, actions }: Props) {
  return (
    <div className={selected ? 'card is-selected' : 'card'} onClick={onSelect}>
      <div className="card__head"><h3 className="card__title">{title}</h3><div className="card__footer">{actions}</div></div>
      <div className="card__body">{assignee}</div>
    </div>
  );
}

// After: TaskContainer.tsx, hooks, handlers, memo
function TaskContainerImpl({ id }: { id: string }) {
  const title = useTaskTitle(id);
  const selected = useIsTaskSelected(id);
  const selectTask = useSelectTask();
  const onSelect = useCallback(() => selectTask(id), [selectTask, id]);
  return <Task title={title} selected={selected} onSelect={onSelect}
               assignee={<AssigneeContainer taskId={id} />} actions={<TaskActionsContainer taskId={id} />} />;
}
TaskContainerImpl.displayName = 'TaskContainer';
export const TaskContainer = memo(TaskContainerImpl);
```

Every caller that rendered `<Task id={id} />` now renders `<TaskContainer id={id} />`. Nothing else changes yet; the
hooks may still be wide at this point (step 4 narrows them).

### 3. Replace container imports in views with slots

For every container a view still imports: delete the import, add a `ReactNode` prop named after what it shows
(`actions`, `assignee`, `toolbar`, `children`), and fill it from the parent container. The view keeps deciding where in
the markup the slot renders.

```tsx
// Before: Column.tsx renders TaskContainer for every id it was given
import { TaskContainer } from './TaskContainer';
export function Column({ title, taskIds }: { title: string; taskIds: string[] }) {
  return <div className="column"><h2>{title}</h2>{taskIds.map((id) => <TaskContainer key={id} id={id} />)}</div>;
}

// After: Column.tsx takes children; ColumnContainer builds the list
export function Column({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <div className="column"><h2>{title} <span>{count}</span></h2><div className="column__cards">{children}</div></div>;
}
function ColumnContainerImpl({ id }: { id: string }) {
  const title = useColumnTitle(id);
  const taskIds = useVisibleTaskIds(id);
  return <Column title={title} count={taskIds.length}>{taskIds.map((taskId) => <TaskContainer key={taskId} id={taskId} />)}</Column>;
}
export const ColumnContainer = memo(ColumnContainerImpl);
```

The `taskIds` prop disappeared from the view: it was a pass-through id. When a view still needs an id only to hand it
on, the cut is one level too high; move the child container up into a slot.

### 4. Narrow the hooks

Replace every wide hook and raw `useSelector` in containers with id-addressed hooks in the module's `hooks.ts`; derived
values through `createSelector`.

```ts
// Before: one wide hook, joins in render
export const useBoard = () => useAppSelector((s) => s.board);

// After: one hook per field shown, memoized selectors for derived values
export const useTaskTitle = (id: string) => useAppSelector((s) => s.board.tasks.byId[id]?.title ?? '');
export const useIsTaskSelected = (id: string) => useAppSelector((s) => s.board.selectedTaskId === id);
export const useTaskDone = (id: string) => useAppSelector((s) => s.board.tasks.byId[id]?.done ?? false);
export const useVisibleTaskIds = (columnId: string) => {
  const select = useMemo(makeSelectVisibleTaskIds, []);   // createSelector over tasks.byId, taskIds, filter
  return useAppSelector((s) => select(s, columnId));
};
export const useSelectTask = () => { const d = useAppDispatch(); return useCallback((id: string) => d(selectTask(id)), [d]); };
```

Where a container read an entity (`useTask(id)`) and passed it down, split the readers: each field shown by a different
view gets its own container (`AssigneeContainer(taskId)` reads `useTaskAssigneeId` + `useUser`). Keep `useTask` only
until its last caller is gone, then delete it.

### 5. Fix reducers to small writes

```ts
// Before
toggleDone: (state, { payload: id }) => { state.tasks.byId[id] = { ...state.tasks.byId[id], done: !state.tasks.byId[id].done }; },
setFilter: (state, { payload }) => ({ ...state, filter: payload }),

// After
toggleDone: (state, action) => { const t = state.tasks.byId[action.payload]; if (t) t.done = !t.done; },
setFilter: (state, action) => { state.filter = action.payload; },
```

For fetched data, assign field by field or diff against current state; never `state.tasks.byId = response.byId` over
entities that containers subscribe to. The lint catches the syntactic forms only: `store-no-object-swap` reports a
spread swap and `Object.assign` onto state, `store-no-state-replace` reports a returned or expression-body
`{ ...state }`. The bulk assignment of a whole map passes the lint; it is a review item.

### 6. Run the lint until zero

```
node packages/eslint-plugin/bin/check.js --root <dir> --modules src/modules --shared src/components --verbose
```

Work down the counts by rule: `view-no-container-import` and `view-no-logic-import` first (they mark the cuts), then
`view-no-state` / `view-no-effect` / `view-no-data-hook`, then `container-no-markup` / `container-one-view` /
`container-no-store-import`, then `store-no-object-swap` / `store-no-state-replace`, then `module-no-foreign-view` /
`shared-no-module-import`. A file that keeps failing both view and container rules needs the step 2 split, not a fix.

### 7. Delete the Storybook decorators and mocks that became unnecessary

A view story now takes plain props. Remove the `Provider` decorator, the store factory, the mocked hooks and the MSW
handlers from view stories; keep them only for container-level integration stories, if any.

```tsx
// Before
export default { component: Task, decorators: [(Story) => <Provider store={makeStore(fixture)}><Story /></Provider>] };
// After
export const Selected = () => <Task title="Design tokens" selected onSelect={() => {}} assignee={<span>Alena</span>} actions={null} />;
```

If a story still needs a provider, the component is not a view yet: go back to step 2.

## Order of operations that keeps the app working at every commit

1. Add the narrow hooks to `hooks.ts` next to the old wide one (additive, nothing breaks).
2. Split one leaf: new `XContainer.tsx` + `X.tsx`; repoint the callers. Commit.
3. Turn every container import inside that view into a slot filled by the caller. Commit.
4. Move up one level and repeat 2–3 until the composition root.
5. Delete the wide hook once it has no callers. Fix reducers. Commit.
6. Lint to zero, delete story decorators. Commit.

Every commit compiles and renders the same screen; only the last two change re-render counts.

## Don'ts

- Don't refactor by moving whole trees at once. One leaf, its callers, commit.
- Don't create pass-through props: a view that receives an id or an entity only to hand it to a child means the child
  container belongs in a slot filled one level up.
- Don't keep both a hook and a prop for the same value (a container that reads `useTaskTitle(id)` *and* receives
  `title`). Pick the hook; delete the prop.
- Don't leave the wide hook "for later" once its callers are gone; it invites the next wide subscription.
- Don't `memo` views to compensate for a mixed component. Split it; `memo` the container.
- Don't put a `<div>` around two containers inside a container to "save a file". That `<div>` is a view with two slots.
- Don't add a `View` suffix. `Task` is the view, `TaskContainer` the container.
- Don't rename or move files outside the leaf you are on; the lint classifies by file name, so a half-renamed tree
  reports noise.

---
Full reference: **docs/02-containers-and-views.md** (the rule and definitions) and **docs/03-data-flow.md** (hooks,
islands, small writes, the views → data → places → containers procedure).
Related skills: `containers-and-views`, `reviewing-architecture`.
