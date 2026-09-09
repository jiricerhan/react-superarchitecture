# Data Flow: Hooks, Subscriptions, Islands, and Designing Containers From Data

Companion to `02-containers-and-views.md`. That document states the rule ("a view never imports a container; containers
compose through `ReactNode`") and what follows from it. This one follows the data: how it enters a container, how it
leaves, which parts of the screen re-render when it changes, and how to derive the containers of a screen from the data
instead of from the layout. The examples are the `board` example (`examples/board`); the numbers come from an import/render graph
analyzer that is not published yet; the rules are enforced by `eslint-plugin-superarchitecture`.

## 1. The Three Flows of a Container

A container has exactly three edges. Everything it does is one of these, and nothing else crosses its boundary.

1. **Props in, from the parent container.** Ids, and only ids. `ColumnContainer` gets `id`, `TaskContainer` gets `id`,
   `AssigneeContainer` gets `taskId`. Never an entity (`task: Task`), never a value the child could read itself, never a
   handler with domain logic from above. The props are written by the **owner** (the container that created the element),
   even though React places the element where the parent's *view* put the slot.
2. **Reads from state, through the module's hooks.** `useTaskTitle(id)`, `useIsTaskSelected(id)`, `useSelectTask()`.
   Never the store, a slice, a selector library or a query client directly. The hook's signature is the whole contract.
3. **Props out, to its view.** Three kinds and no other: **values** of the container's own data (`title: string`,
   `selected: boolean`), **handlers** it created (`onSelect`), and **elements of child containers** for the slots.

```tsx
// examples/board/src/modules/board/TaskContainer.tsx
function TaskContainerImpl({ id }: Props) {                       // 1. props in: an id
  const title = useTaskTitle(id);                                 // 2. reads: narrow, id-addressed
  const selected = useIsTaskSelected(id);
  const selectTask = useSelectTask();
  const onSelect = useCallback(() => selectTask(id), [selectTask, id]);
  const assignee = <AssigneeContainer taskId={id} />;             // child containers get ids, never objects
  const actions = <TaskActionsContainer taskId={id} />;
  return <Task title={title} selected={selected} onSelect={onSelect} assignee={assignee} actions={actions} />; // 3. props out
}
export const TaskContainer = memo(TaskContainerImpl);
```

There is no fourth flow "props from a view". A view has no data of its own to give; the only thing it adds to the data
flow is a DOM event adapted to a handler it received (`onChange={(e) => onChange(e.target.value)}` in `Filter`). And
there is no flow *through* a view: data never passes through a view to reach a container below it. A view that receives
`taskId` only to hand it on marks a cut one level too high (see [typical mistakes](#7-typical-mistakes)).

## 2. Hooks Are the Data API

The hooks file of a module (`hooks.ts`) is the only place containers get data from. Its shape decides how many
containers re-render on a change, so it is designed, not accumulated.

- **Narrow.** One hook returns one field or one derived value: `useTaskTitle(id): string`, `useTaskDone(id): boolean`,
  `useColumnIds(): string[]`. A hook that returns an entity (`useTask(id): Task`) makes every reader re-render on every
  field of the entity.
- **Id-addressed.** The container passes the id, the hook finds the row. `useTaskTitle(id)`, not `useTasks()` followed
  by a lookup in the container.
- **Derived values through memoized selectors.** Anything computed from several fields (filtering, counting, joining)
  goes through `createSelector`, so the result keeps its identity while the inputs are unchanged. Parameterized selectors
  are created per component instance:

```ts
// examples/board/store/hooks.ts
const makeSelectVisibleTaskIds = () =>
  createSelector(
    [(s: RootState) => s.board.tasks.byId,
     (s: RootState, columnId: string) => s.board.columns.byId[columnId]?.taskIds ?? [],
     (s: RootState) => s.board.filter],
    (tasks, ids, filter) => {
      const f = filter.trim().toLowerCase();
      return f ? ids.filter((id) => tasks[id]?.title.toLowerCase().includes(f)) : ids;
    },
  );
export const useVisibleTaskIds = (columnId: string) => {
  const select = useMemo(makeSelectVisibleTaskIds, []);
  return useAppSelector((s) => select(s, columnId));
};

const selectStats = createSelector([(s: RootState) => s.board.tasks], (tasks) => ({
  total: tasks.ids.length,
  done: tasks.ids.filter((id) => tasks.byId[id]?.done).length,
}));
export const useStats = () => useAppSelector(selectStats);
```

- **The child derives its own state.** `useIsTaskSelected(id)` returns a boolean, so on selection only the two cards
  whose boolean flipped re-render. The alternative, `useSelectedTaskId()` in the column and `selected={id === selectedId}`
  on every card, re-renders the column and every card.
- **Action hooks return stable callbacks.** `useSelectTask()` wraps `dispatch` in `useCallback`; the container adds the
  id. A memoized child container then sees the same handler on every render.
- **Hooks derive from hooks.** Across modules the data edge is hook → hook (a `useStats` may be built on another
  module's `useTaskIds`); containers never combine two modules' state by hand.

Why not one wide hook:

```tsx
// ❌ Wrong: one subscription to the whole slice; every keystroke in the filter re-renders every card
const BoardContainer = () => {
  const board = useBoard();
  const columns = board.columns.ids.map((id) => ({
    ...board.columns.byId[id],
    tasks: board.columns.byId[id].taskIds
      .map((tid) => board.tasks.byId[tid])
      .filter((t) => t.title.includes(board.filter))
      .map((t) => ({ ...t, user: board.users.byId[t.assigneeId], selected: t.id === board.selectedTaskId })),
  }));
  return <Board filter={board.filter} columns={columns} onSelectTask={selectTask} />;
};

// ✅ Right: ids down; every container subscribes to the field it shows
const BoardContainer = () => {
  const columnIds = useColumnIds();
  const columns = columnIds.map((id) => <ColumnContainer key={id} id={id} />);
  return <Board toolbar={<FilterContainer />} columns={columns} sidebar={<><StatsContainer /><SelectedTaskContainer /></>} />;
};
```

The wide version has one subscriber and one island; every change lands in it, and the joins are recomputed in render.
The narrow version has as many subscribers as there are fields on screen, each subscribed to exactly the field it shows.
Measured on the board: a title rename re-renders **14** components with the wide hook and **5** with narrow hooks.

Containers depend on the hook's interface, not on the store. Replacing Redux with Zustand, RTK Query or GraphQL
fragments rewrites the inside of `hooks.ts` and the provider in the app; containers and views do not change.

## 3. Render Islands

Under strict views a re-render can only start in a container: a store subscription fired, or a container's own state
changed. Views hold no state, so they are never the origin. React sends the wave down; `memo` on the next container
stops it, because its props (ids, stable handlers) are unchanged; elements that sit in slots keep their identity and are
not re-rendered either. The application therefore splits into the smallest groups that always re-render together:

> **Island = a container + the views it renders, up to the next container.**

- Islands re-render whole; nothing outside the island re-renders.
- `memo` is not a habit, it is the definition of an island boundary. It belongs on every container that is created by
  another container, and on nothing else. A `memo` on a view is noise: the view re-renders only when its container does,
  and then its props changed.
- Islands are cut where the data changes at a different pace: title and selection change together (one island, the
  card), the assignee at another time (its own island), done at another (its own island). Three containers on one card
  are three islands on three places of the card.
- **The metric is islands touched per change.** Not "how many components re-rendered" in the abstract, but how many
  islands one action lights up, compared with how many places on the screen actually changed. On the board a title
  rename touches one giant island before the split and two small ones after (the card and the detail).

Two things the rule does not do on its own. It does not reduce store-driven renders: with the same narrow hooks the
nested variant (containers imported inside views) and the rule give the same numbers, 8 renders for a keystroke in the
filter, 9 for selecting another task, 15 for toggling done. The rendering win comes from narrow hooks plus `memo` on
containers. What the rule changes is the structure that makes those cheap: 4 views that cannot render without a store
vs 0, 7 pass-through ids vs 0, import depth 7 vs 4.

Not to be confused with Astro's islands architecture (islands of interactivity in a static page). These islands are
about re-render scope inside one React tree.

## 4. Data Islands and Small Writes

Islands exist on the screen only if they exist in the data first.

> **Data island (change group) = the state fields written by the same actions.**

Fields written together change together and may share a container. Fields never written by the same action change
independently and should not share a subscription. This is a property of the reducers, not of the screen, and it holds
only under one condition:

**Reducers change fields, not objects.**

```ts
// ✅ Good: one field changes; title and assigneeId stay untouched
toggleDone(state, action) {
  const t = state.tasks.byId[action.payload];
  if (t) t.done = !t.done;
}

// ❌ Bad: the whole task is swapped; title, assigneeId and done "change" at once
toggleDone(state, action) {
  state.tasks.byId[id] = { ...state.tasks.byId[id], done: !done };
}

// ❌ Bad: the whole slice is replaced; every subscriber of the slice is notified
setFilter(state, action) {
  return { ...state, filter: action.payload };
}
```

Why a coarse write merges islands: a swap gives the task a new identity, so everything that reads the task object sees a
change. The entity hook `useTask(id)` re-renders on every toggle, `selectStats` recomputes because its input
`s.board.tasks` changed, and in the data model the three fields now belong to one group, because one action writes all
of them. Narrow hooks that return primitives hide the damage for their own reader (`useTaskTitle` still gets the same
string) but do not undo it: the first entity hook or unmemoized derived value somebody writes pays for it. A slice
replacement (`return { ...state, filter }`) is the same one level up: every field of the slice is written by `setFilter`,
so the whole slice is one island.

Immer lets you write the fine-grained form without ceremony. API responses are written field by field, or diffed
against the current state before assignment, so that a refetch that changed nothing changes nothing. The lint catches
the syntactic forms: `store-no-object-swap` reports a spread swap (`byId[id] = { ...t, done }`) and `Object.assign`
onto state; `store-no-state-replace` reports a reducer that returns a new slice (`return { ...state }` or an
expression body `(state) => ({ ...state })`). A bulk assignment of a whole map (`state.tasks.byId = action.payload`)
looks like any other assignment to the lint and is a review item. The analyzer reports all of them as `coarse-write`
when containers subscribe below the replaced object.

## 5. Designing Containers From Data: Views → Data → Places → Containers

The goal is to split the screen into the smallest islands that re-render together. The order is: first what is visible,
then what changes, then where the two meet, and only then the containers. Containers are the result, not the starting
point. Worked on the board.

### Step 1. Views: one big view, and only what repeats

Draw the screen as **one view**: markup only, no hooks, no store, no ids.

```
Board
├─ filter (input)
├─ column ×n: title, count, list of cards
│  └─ card ×n: title, highlight, who, done
├─ stats: done / total
└─ detail of the selected card: title, who
```

The only thing you cut out in this step is **what repeats**: the card and the detail share a frame → `Card`; the input →
`Input`. Those go to the shared layer (`src/components` or `<module>/shared/`) and the big view imports them. Nothing
else is cut yet. List, item, layout: all of it is still one view.

### Step 2. Data: the state tree and what changes together

Write the state tree (`RootState`, the way the analyzer's `state` panel draws it):

```
board
├─ filter: string
├─ selectedTaskId: string | null
├─ columns.ids: string[]
├─ columns.byId[id].{ title, taskIds }
├─ tasks.byId[id].{ title, assigneeId, done }
└─ users.byId[id].{ name }
```

Change is defined by **actions**, not by the screen. For every reducer, write down which fields it writes and how often:

| action | writes | how often |
|---|---|---|
| `setFilter` | `filter` | every keystroke |
| `selectTask` | `selectedTaskId` | click |
| `toggleDone` | `tasks.byId[id].done` | click |
| `assignTask` | `tasks.byId[id].assigneeId` | rarely |
| `renameTask` | `tasks.byId[id].title` | rarely |
| `moveTask` | `columns.byId[id].taskIds` | sometimes |
| `renameColumn` | `columns.byId[id].title` | rarely |
| `renameUser` | `users.byId[id].name` | rarely |

Fields written by the same actions form a **data island**. Fields never written by the same action change independently.
This step is only meaningful under small writes (section 4): if `toggleDone` swapped the task, `title`, `assigneeId` and
`done` would be one island and the rest of the procedure would produce one container per task.

### Step 3. Places: where an island lands on the screen

For every island, list where its fields are displayed. Derived values (a count, the stats) are fields too.

| island | lands in |
|---|---|
| `setFilter` | the filter; through the visible ids also the list in every column |
| `selectTask` | the highlight of a card (two cards per change), the detail |
| `toggleDone` | "done" on the card, the stats |
| `renameTask` | the card title, the title in the detail |
| `assignTask` + `renameUser` | "who" on the card and in the detail |
| `moveTask` (+ `setFilter`) | the list of cards in a column |
| `renameColumn` | the column title |

A **place** is a connected piece of view where an island lands. One island may have several places (who: the card and
the detail); one place may carry several islands (the card: title and highlight). The pair **island × place** is what
gets built.

### Step 4. Containers: one per island × place, and the cut of the big view

**The cutting rule: one container reads one change group at one place.**

- Two islands landing in exactly the same view may share a container (title + selection in the card).
- A container that would read islands landing in **different** views is split. The cost of not splitting is
  `how often the island changes × how many views re-render for nothing`.
- Never split for a single string. A container whose view is one `<span>` is not worth a boundary.

| container | island | place |
|---|---|---|
| `BoardContainer` | `columns.ids` (almost never changes) | the skeleton |
| `FilterContainer` | `setFilter` | the filter |
| `ColumnContainer(id)` | `renameColumn` + membership (memoized selector over `taskIds` + `filter`) | a column |
| `TaskContainer(id)` | `renameTask` + `selectTask` (same view) | a card |
| `AssigneeContainer(taskId)` | `assignTask` + `renameUser` (same view) | "who", on the card and in the detail |
| `TaskActionsContainer(taskId)` | `toggleDone` | "done" on the card |
| `StatsContainer` | derived from `tasks` (memoized selector) | the stats |
| `SelectedTaskContainer` | `selectTask` + `renameTask` | the detail |

Three containers on one card are not too many: three islands land on three different places of the card. Note that
`AssigneeContainer` appears twice in the tree (card and detail) and is one file: the leaf container is the unit of reuse
for data, `Card` is the unit of reuse for markup.

**Now the big view is cut**, and it is cut exactly at the containers. At every such point the view ends and a **slot**
begins: `Board` gets `toolbar`, `columns`, `sidebar`; `Column` gets `children`; `Task` gets `assignee`, `actions`. What is
left of the big view are the views of the containers: `Board`, `Filter`, `Column`, `Task`, `Assignee`, `TaskActions`, `Stats`,
`SelectedTask`. There is no other reason to cut a view than a container or reuse. List and item are two islands, hence two
containers; the layout is what remains, with only slots; "readability" is taste and not a reason.

```tsx
// examples/board/src/modules/board/Board.tsx: the skeleton that remained after the cut. Only slots.
export function Board({ toolbar, columns, sidebar }: Props) {
  return (
    <div className="board">
      <div className="board__toolbar">{toolbar}</div>
      <div className="board__columns">{columns}</div>
      <div className="board__sidebar">{sidebar}</div>
    </div>
  );
}
```

**What a container sends its view**, and nothing else:

- **values** of its island (`title: string`, `selected: boolean`), never entities;
- **handlers** of its island (`onSelect`), created in the container from the module's action hooks;
- for every other island landing at the same place, **the element of a child container into a slot**
  (`assignee={<AssigneeContainer taskId={id} />}`).

Data never passes through a view to reach a container below. When a view needs `taskId` only to hand it on, the cut is
one level higher than it should be: the child container belongs in a slot filled by the parent container, which has the
id already.

**Hooks follow the islands.** Every island gets a narrow hook addressed by id: `useTaskTitle(id)`, `useIsTaskSelected(id)`,
`useTaskDone(id)`, `useUser(id)`; derived values through a memoized selector (`useVisibleTaskIds(columnId)`, `useStats()`).
A container touches only the hooks of its module, never the store.

### Step 5. Verify

See the next section.

## 6. Verification

What the analyzer and the viewer show, and which lint rules guard the result.

**Analyzer views**

- `design: data → containers`: the state tree coloured by islands, a column of islands with their actions, today's
  containers with dots for the islands they read, views as places. The sidebar "Proposed containers: island × place"
  marks every pair as *existing*, *missing* or *split candidate*. Target: nothing missing, nothing red.
- `state · containers · views`: a line from a field only to the containers that display it. A dimmed line (the field is
  covered by a wider subscription) is suspicious.
- **trace** on a field or an action: the re-render wave hits only the islands that show it. `toggleDone` → one island
  (plus the stats, through the memoized selector).
- **islands**: how many islands one action touches. As many as there are places that really changed, not one more.
- `views · import`: the import graph next to the render graph; under the rule they differ, and the import graph is flat.

**Lint (`eslint-plugin-superarchitecture`, rule ids `superarchitecture/<rule>`)**

| what the procedure needs | rule |
|---|---|
| views are functions of props (steps 1, 4) | `view-no-state`, `view-no-effect`, `view-no-data-hook`, `view-no-logic-import` |
| the cut lives in slots, not imports (step 4) | `view-no-container-import` |
| stable elements in slots | `view-no-inline-handler` (warn) |
| a container is one island at one place (step 4) | `container-one-view`, `container-no-markup` |
| data only through hooks (step 4) | `container-no-store-import` |
| islands exist in the data (step 2) | `store-no-object-swap`, `store-no-state-replace` |
| places do not leak across modules | `module-no-foreign-view`, `shared-no-module-import` |

The lint is convention-based (`*Container.tsx` is a container, other `.tsx` are views) and has no type information, so
wide subscriptions, pass-through subscriptions, prop stability and coarse writes measured against real readers are
reported by the analyzer, not the lint. Run the lint without touching a project's config:

```
node packages/eslint-plugin/bin/check.js --root <dir> --modules src/modules --shared src/components [--verbose]
```

## 7. Typical Mistakes

The procedure exposes these; the tooling names them.

| mistake | what it looks like | what it costs | what shows it | fix |
|---|---|---|---|---|
| **wide subscription** "to be safe" | `useBoard()` in one container | one giant island; 14 re-renders on a title rename instead of 5 | `islands`, dimmed lines in `state · containers · views` | one narrow hook per field shown; ids down, child containers fetch |
| **entity instead of values** | `task: Task` as a view prop | the view receives fields it does not show and re-renders with them; a title change "flows" into `Assignee` | trace on `renameTask` lighting up places that do not show the title | `title: string`, `selected: boolean`; every other island via a child container in a slot |
| **pass-through id** | a view has `taskId` only to hand it to a child | the cut is one level too high; the view knows ids and the render graph leaks into the import graph | analyzer *pass-through* report; 7 such ids in the nested variant, 0 under the rule | move the child container up into a slot filled by the parent container |
| **list and item in one container** | `ColumnContainer` reads `taskIds` and every task's fields | membership and item content are two islands; every keystroke in the filter re-renders all cards | `islands` on `setFilter` | `ColumnContainer` reads ids; `TaskContainer(id)` reads its own fields |
| **derived value without a memoized selector** | `useAppSelector((s) => ({ done: …, total: … }))` | a fresh object on every store change; `Stats` re-renders when nothing it shows changed | trace on any action lighting up the stats | `createSelector`; per-instance factory when parameterized |
| **coarse write** | `byId[id] = { ...t, done }`, `return { ...state, filter }` | islands in the data merge; every reader of the object re-renders | `store-no-object-swap`, `store-no-state-replace`; `coarse-write` in the analyzer | assign the field: `t.done = !t.done` |
| **pass-through container** | a container subscribes only to pass values down | an island that shows nothing and re-renders anyway | `state · containers · views` | move composition up; give the value its own container at its place |

## Checklist

- [ ] every hook returns exactly what its caller displays; no `useBoard()`-style wide hooks
- [ ] hooks are addressed by id; a view never holds an id only to pass it on
- [ ] a list container reads ids, an item container reads its own fields
- [ ] derived values come from memoized selectors
- [ ] reducers assign the field that changed, never the object around it
- [ ] one container per data island at one place; no container that only passes values down

## Glossary

- **flow**: one of the three edges of a container: props in (ids), reads (hooks), props out (values, handlers, elements)
- **data island / change group**: state fields written by the same actions
- **place**: a connected piece of view where a data island lands
- **island**: a container plus the views it renders up to the next container; re-renders whole
- **owner**: the container that created an element; **parent**: where React put it (may be a view)
- **small write**: a reducer that assigns the field that changed, never the object around it
- **wide hook**: a hook that returns more than the caller displays
