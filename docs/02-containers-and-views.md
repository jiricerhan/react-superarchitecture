# Container / View Guidelines

One rule, its definitions, what follows from it, and how to design with it. Written for a codebase that follows the
container / view split with React, TypeScript and a store (Redux Toolkit here; any store with narrow hooks works the same).
The examples are `examples/board` of this repo, the numbers come from
an import/render graph analyzer that is not published yet, the rules are enforced by `eslint-plugin-superarchitecture` (`packages/eslint-plugin`).

## The Rule

> **A view never imports a container. Containers compose through `ReactNode`.**

That is the whole rule. Everything below is either a definition it needs or a consequence it has.

Why it is unintuitive: the instinct is to import what you render. A card imports its actions, a column imports its cards.
The import graph then copies the render graph. The rule forbids exactly that, and React composes the render tree from a
flat import graph on its own.

```tsx
// ❌ Bad: the view imports a container, the import graph follows the render graph
import { TaskActionsContainer } from './TaskActionsContainer';
const Task = ({ task }: { task: Task }) => (
  <div className="card">
    <h3>{task.title}</h3>
    <TaskActionsContainer taskId={task.id} />
  </div>
);

// ✅ Good: the view offers a slot, a container fills it
type Props = { title: string; selected: boolean; onSelect: () => void; assignee: ReactNode; actions: ReactNode };
const Task = ({ title, selected, onSelect, assignee, actions }: Props) => (
  <div className={selected ? 'card is-selected' : 'card'} onClick={onSelect}>
    <h3>{title}</h3>
    <div className="card__footer">{actions}</div>
    <div className="card__body">{assignee}</div>
  </div>
);

const TaskContainer = memo(function TaskContainer({ id }: { id: string }) {
  const title = useTaskTitle(id);
  const selected = useIsTaskSelected(id);
  const selectTask = useSelectTask();
  const onSelect = useCallback(() => selectTask(id), [selectTask, id]);
  return <Task title={title} selected={selected} onSelect={onSelect} assignee={<AssigneeContainer taskId={id} />} actions={<TaskActionsContainer taskId={id} />} />;
});
```

## Definitions

The rule needs two kinds of components. These are definitions, not consequences.

### Views

- props in, markup out; everything a view does is about pixels, nothing about data
- **no state** (`useState`, `useReducer`): state and its handler live in a container; hover is CSS
- **no effects**: effects belong to a container
- no data hooks, no store, no queries, no `useContext` (a context needs a Provider: the same trap as a store); harmless React built-ins are fine (`useRef`, `useMemo`, `useCallback`, `useId`)
- imports only views, the shared layer and presentation utils (`cx` for class names); formatting of dates, numbers and money is the container's job, the view receives the finished string
- receives **values** (`title: string`), never entities (`task: Task`)
- passes the handlers it got; creates none with domain logic (adapting a DOM event on a host element is view work)
- no `View` suffix: the view is named after what it shows (`Task`), the container carries the suffix (`TaskContainer`)

Library components that hold state (a headless Dialog, a Combobox) are views imported as views. Our own views hold none.

### Containers

- data and behaviour: subscriptions, handlers, effects
- **no markup, no style**: no host elements, at most a fragment
- renders **only views and containers**, typically one view (its own, or a shared one), and puts containers into its slots
- reaches data only through the module's hooks, never the store, a slice or a store library directly
- creates child containers and hands them down as elements; passes ids to them, never objects
- memoized (`memo`) when it is created by another container: see [Memo](#memo)

A container with several views is a layout hidden in a container. Move the layout into a view of its own.

```tsx
// ❌ Bad: a layout inside the container
const PageContainer = () => (<><Header /><Sidebar /><Content /></>);

// ✅ Good: one view, the layout lives there
const PageContainer = () => <Page header={<HeaderContainer />} sidebar={<SidebarContainer />} content={<ContentContainer />} />;
```

## What Follows From the Rule

None of these needs to be a separate rule. Each one falls out of "a view never imports a container".

- **Slots.** A view cannot render a container, so where a container belongs it offers a `ReactNode` prop. The container above decides what goes in.
- **Containers are composition roots.** Somebody has to create the child containers; views may not; so the container creates them and puts them into its view's slots. Where a slot ends up in the tree is the view's decision; the container does not know the layout.
- **Views know no ids.** A view has nobody to hand an id to, so it gets display values. `taskId` in a view only to pass it on means the cut is one level too high.
- **A flat import graph.** Containers import their view and the containers they create; views import views. The import graph is shallow and independent of the render graph.
- **Views are pure functions.** They render without a store, so Storybook, snapshots and tests need no mocks, no Provider, no fetch: call the view with props, look at the markup. Containers are tested through their hooks, without a DOM.
- **A contract on one edge.** The view's props type is the contract between UI work and data work. A change in logic either does not touch the view, or shows up in TypeScript on that edge, not in the browser.
- **Dependency inversion.** The view defines the interface (its props, its slots); the container fulfils it. The source dependency points against the flow of composition.
- **Render islands.** See below.

### Two graphs and one tree

- **Import graph**: static, what you write. Flat under the rule.
- **Render graph**: static, what can render, with `x n` for lists and `↻` for recursion.
- **Render tree**: runtime, what React composed from concrete data.

Under the rule the import graph and the render graph differ; a container tunnels through views it never imported. That
is the picture the analyzer's viewer draws (`views · import`, `two trees → one`, `build the render tree`).

## Render Islands

Re-renders start only in containers, because views hold no state. React sends the wave down; `memo` on the next container
stops it; elements sitting in slots keep their identity. So the application splits into the smallest groups that re-render
together:

> **Island = a container + the views it renders, up to the next container.**

- islands re-render whole; nothing outside an island re-renders
- containers are cut where the data changes at a different pace: title and selection change together, the assignee at another time, done at another
- `memo` is not discipline, it is the definition of an island boundary; it belongs on containers and nowhere else
- the metric that matters: **how many islands one change touches**. The board: a title change touches 1 giant island with a wide `useBoard()` hook, 2 small ones with narrow hooks

Not to be confused with Astro's islands architecture (islands of interactivity in a static page).

## Minimal Subscription

The rule does not reduce renders by itself. Measured on the board fixture with the same narrow hooks:

| action | containers inside views | the rule |
|---|---|---|
| keystroke in the filter | 8 renders | 8 renders |
| select another task | 9 | 9 |
| toggle done | 15 | 15 |

Performance comes from **narrow hooks** and **memo on containers**. The rule keeps that cheap: ids need not travel
through views, and the props of a container are written by data code, not UI code. It also keeps views out of the store,
which is the structural win: 4 views that cannot render without a store vs 0, 7 pass-through ids vs 0, import depth 7 vs 4.

- subscribe to the field you show, addressed by id: `useTaskTitle(id)`, not `useTask(id).title`, never `useBoard()`
- derived values through a memoized selector: `useVisibleTaskIds(columnId)`, `useStats()`
- the child container computes its own derived state (`useIsTaskSelected(id)` returns a boolean; only two cards re-render on selection)
- a container that subscribes only to pass data down is a pass-through: move the composition up, give the value its own container

```tsx
// ❌ Bad: one container subscribes to everything and hands objects down
const BoardContainer = () => {
  const board = useBoard();
  const columns = board.columns.ids.map((id) => ({ ...board.columns.byId[id], tasks: /* join tasks with users, filter, isSelected */ }));
  return <Board filter={board.filter} columns={columns} onSelectTask={selectTask} />;
};

// ✅ Good: ids down, every container fetches its own island
const BoardContainer = () => {
  const columnIds = useColumnIds();
  return <Board toolbar={<FilterContainer />} columns={columnIds.map((id) => <ColumnContainer key={id} id={id} />)} sidebar={<><StatsContainer /><SelectedTaskContainer /></>} />;
};
```

## Small Writes

Islands in the data exist only when reducers change fields, not objects.

```ts
// ✅ Good: one field changes, the other islands stay apart
toggleDone(state, action) { const t = state.tasks.byId[action.payload]; if (t) t.done = !t.done; }

// ❌ Bad: the whole task is swapped; title, assigneeId and done "change" at once, every reader of the task re-renders
toggleDone(state, action) { state.tasks.byId[id] = { ...state.tasks.byId[id], done: !done }; }

// ❌ Bad: the whole slice is replaced
setFilter(state, action) { return { ...state, filter: action.payload }; }
```

Immer lets you write the fine-grained form. API responses are written field by field, or diffed against the current state.
The analyzer reports `coarse-write` (an action replaces an object that containers subscribe below); the lint reports
`store-no-object-swap` and `store-no-state-replace`.

## Memo

- `memo` on containers that are created by another container (a re-rendering owner re-creates its child elements)
- props of child containers stable: ids, `useCallback` handlers, never fresh objects or inline functions
- no `memo` on views: a view re-renders only when its container does, and then its props changed
- a re-render coming from views does not exist under strict views, so islands are exactly the container boundaries
- alternative to `memo` on the leaf: memoize the element at the creator, `useMemo(() => <AssigneeContainer taskId={id} />, [id])`

## Designing With the Rule: Views → Data → Places → Containers

Start from what is on screen, then what changes, then where they meet. Containers come last.

### 1. Views: one big view, cut only what repeats

Draw the screen as **one view**: markup only, no hooks, no store, no ids. The only cut in this step is reuse: the card
and the detail share a frame → `Card`; the input → `Input`. Those go to the shared layer. Lists, items and the layout stay
one view for now.

### 2. Data: the state tree and what changes together

Write the state tree (`RootState`). Then, for every reducer, which fields it writes and how often:

| action | writes | how often |
|---|---|---|
| `setFilter` | `filter` | every keystroke |
| `selectTask` | `selectedTaskId` | click |
| `toggleDone` | `tasks.byId[id].done` | click |
| `assignTask` | `tasks.byId[id].assigneeId` | rarely |
| `renameTask` | `tasks.byId[id].title` | rarely |
| `moveTask` | `columns.byId[id].taskIds` | sometimes |

Fields written by the same actions form a **data island**. Fields never written by the same action change independently.
This step requires small writes (above).

### 3. Places: where an island lands on the screen

For every island, where its fields are displayed. Derived values (count, stats) are fields too.

| island | lands in |
|---|---|
| `setFilter` | the filter; through the visible ids also the columns |
| `selectTask` | the highlight of two cards, the detail |
| `toggleDone` | "done" on the card, the stats |
| `renameTask` | the card title, the detail title |
| `assignTask` + `renameUser` | "who" on the card and in the detail |

A **place** is a connected piece of view where an island lands. One island may have several places; one place may carry
several islands. **Island × place** is what gets built.

### 4. Containers: one per island × place, and the cut of the big view

- one container reads one change group at one place
- two islands landing in exactly the same view may share a container (title + selection in the card)
- a container reading islands that land in different views is split; the cost is `how often × how many views re-render for nothing`
- do not split for a single string

| container | island | place |
|---|---|---|
| `BoardContainer` | `columns.ids` | the skeleton |
| `FilterContainer` | `setFilter` | the filter |
| `ColumnContainer(id)` | `renameColumn` + membership (memoized over `taskIds` + `filter`) | a column |
| `TaskContainer(id)` | `renameTask` + `selectTask` | a card |
| `AssigneeContainer(taskId)` | `assignTask` + `renameUser` | "who", on the card and in the detail |
| `TaskActionsContainer(taskId)` | `toggleDone` | "done" on the card |
| `StatsContainer` | derived from `tasks` (memoized) | the stats |
| `SelectedTaskContainer` | `selectTask` + `renameTask` | the detail |

Three containers on one card are not too many: three islands land on three places of the card.

**Now the big view is cut**, exactly at the containers. At every such point the view ends and a **slot** begins: `Board`
gets `toolbar`, `columns`, `sidebar`; `Column` gets `children`; `Task` gets `assignee`, `actions`. What is left are the
views of the containers. There is no other reason to cut a view than a container or reuse: list and item are two islands,
the layout is what remains with only slots, "readability" is taste.

What a container passes to its view:

- **values** of its island (`title: string`, `selected: boolean`), never entities
- **handlers** of its island (`onSelect`), created in the container
- for every other island at the same place, **a child container element into a slot**

Data never travels through a view to reach a container below.

### 5. Verify

- `design: data → containers` view: state coloured by islands, islands with their actions, today's containers with the islands they read, views as places; the sidebar proposes containers per island × place and marks missing ones and split candidates
- `state · containers · views` + trace: a field or an action lights up only the islands that show it
- `islands` view: how many islands one action touches
- lint (below)

## Modules and the Shared Layer

The rule one level up. A module is a folder under `src/modules` (or `src/features`).

- a module exposes **containers** (entry points, composed into slots elsewhere), **hooks** (its data API) and types; its **views are private**
- a module publishes views on purpose only in `<module>/shared/` (or `public/`)
- shared markup for everyone lives in `src/components` (or a design system package); the shared layer imports no module and no hooks
- between modules there are two kinds of edges: container → container (UI composition) and hooks → hooks (data derivation); never view → view across a boundary
- the app (pages) composes module containers and holds the store provider
- a module is one level; features inside share views freely; a feature with its own hooks or slice that other modules use is promoted to a module
- module cycles are a smell; the usual cause is a module that is both a UI kit and a page composing its siblings: split the kit into the shared layer

### Hooks aside

Containers depend on the **interface** of a hook (`useTaskTitle(id): string`), never on the store API. Swapping the store
(Redux → Zustand, RTK Query, GraphQL fragments) rewrites the inside of `hooks.ts` and the provider in the app; containers
and views do not change.

```
src/
  app/                       # pages: compose module containers, hold the provider
  components/                # shared views: import nothing from modules
  modules/
    board/
      hooks.ts               # the data API: narrow, id-addressed
      boardSlice.ts          # private
      Board/
        BoardContainer.tsx
        Board.tsx
      Task/
        TaskContainer.tsx
        Task.tsx
        AssigneeContainer.tsx
        Assignee.tsx
      shared/                # views this module publishes on purpose
```

## Tooling

### Lint (`eslint-plugin-superarchitecture`)

Convention-based, no type information: `*Container.tsx` is a container, other `.tsx` are views, `hooks.ts` / `use*.ts` are
hooks, `*Slice.ts` / `store.ts` is the store, `page.tsx` under `src/app` (and `main.tsx` / `App.tsx` at the root) are
composition roots.

| rule | says |
|---|---|
| `view-no-container-import` | a view never imports a container, by file or by name through a barrel; type-only imports are fine |
| `view-no-logic-import` | a view imports no hooks, store, queries or store libraries |
| `view-no-state`, `view-no-effect`, `view-no-data-hook` | a view is a function of its props |
| `view-no-inline-handler` (warn) | a view hands no fresh function to a component |
| `container-no-markup` | a container renders no host elements |
| `container-no-store-import` | data only through the module hooks |
| `container-one-view` (warn) | typically one view per container; a layout of several views is a view |
| `store-no-state-replace`, `store-no-object-swap` | small writes keep the islands apart |
| `module-no-foreign-view` | a module's views are private (shared layer and `<module>/shared/` excepted) |
| `shared-no-module-import` | the shared layer depends on nothing |

Cycles: `import/no-cycle`. Wide and pass-through subscriptions, prop stability, coarse writes against real readers: the
analyzer, which has the type checker and the whole graph.

### Analyzer and viewer

Not published yet. Views of the graph: `design` (data islands → places → containers), `modules`, `views · import` (the two graphs),
`state · containers · views` with trace (data flow, re-render wave, element flow), `islands`, `two trees → one`,
`build the render tree`, `render tree` (static or live).

## FAQ

**Hooks made containers unnecessary, why bother?** Hooks removed the mechanics of containers, not the reason. A view
with a hook cannot render without a store, sits in the client boundary, knows ids, and owns a re-render boundary that UI
code has to defend with `memo`. The reason for containers is the boundary, and hooks did not remove it.

**Isn't this a lot of small containers?** Yes. Every piece of UI with data or state gets one. Files are cheap, coupling
is expensive; the board has eight and each has a one-sentence reason. It pays off at scale; that is the trade.

**Where does UI state go (open panel, hover)?** Hover is CSS. Anything else is state, so a container holds it and the
view gets a value and a handler. A container for one boolean is the price of views that are pure functions.

**Does every container have its own view?** It renders only views and containers, typically one view: its own, or a shared one (`Input`, a layout). A loading or empty state next to the main view (`loading ? <Skeleton /> : <Task … />`) is fine; two views laid out side by side are a layout hidden in the container and belong in a view.
An adapter container that only renders another container is a named exception; prefer passing ids to it.

**When not to split?** When two islands land in the same view (title + selection), or when the view under it is a
single string. The cost you decide on is `how often × how much re-renders for nothing`.

## Checklist

- [ ] no view imports a container; every container it needs arrives through a `ReactNode` prop
- [ ] views hold no state and run no effects; the container above owns both
- [ ] a container renders only views and containers and has no markup of its own
- [ ] child containers are created by the parent container, never by a view
- [ ] `memo` sits on every container created by another container, and nowhere else
- [ ] a Storybook story for any view needs no decorator

## Glossary

- **container**: data and behaviour, only views and containers, no markup
- **view**: props in, markup out, no state
- **slot**: a `ReactNode` prop of a view where a container puts content
- **owner**: the component that created an element (its container); **parent**: where React put it (may be a view)
- **island**: a container plus the views it renders up to the next container; re-renders whole
- **data island / change group**: state fields written by the same actions
- **place**: a connected piece of view where a data island lands
- **shared layer**: views everyone may import, importing nothing from modules
