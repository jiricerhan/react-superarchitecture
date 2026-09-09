# Modules

The container / view rule one level up. [02-containers-and-views.md](./02-containers-and-views.md) says what a
container and a view are; this document says how they are grouped, what a group shows to the outside, and what may
cross the line between two groups. File names and folders are in [01-repo-structure.md](./01-repo-structure.md).

## Definition

> **A module is a folder under `src/modules` with an entry that exports containers and hooks. Its views are private.**

- **containers** are the module's UI entry points; pages and other modules put them into slots
- **hooks** are the module's data API; containers of this module call them, hooks of other modules derive from them
- **types** may be exported for hook signatures; views never receive them
- **views** stay inside; a module publishes a view on purpose only in `<module>/shared/`
- the **slice** is private to `hooks.ts` and `src/store/store.ts`

```ts
// src/modules/board/index.ts
export { BoardContainer } from './Board/BoardContainer';
export { TaskContainer } from './Task/TaskContainer';
export { useTaskTitle, useTaskDone, useVisibleTaskIds, useSelectTask } from './hooks';
export type { TaskId, ColumnId } from './types';
// no views, no slice, no selectors
```

A module is a domain (`board`, `tokens`, `user`), not a screen and not a component kit. A folder that only composes
its siblings is a page; a folder that only exports views is part of the shared layer. Both are covered under
[Module cycles](#module-cycles).

## Views Are Private

A view belongs to the container that renders it. Another module that wants the same markup does not import the view;
it composes the container or asks for the view to be moved.

Three places a view can live, in order of preference:

| who uses it | where it lives | who may import it |
|---|---|---|
| one feature | `<module>/<Feature>/X.tsx` | that feature's container and views |
| several features of the same module | `<module>/shared/X.tsx` | any container or view of that module, and other modules' views |
| several modules | `src/components/X/X.tsx` | everyone |

`<module>/shared/` is a published folder: the lint reads it as public (`moduleSharedDirs`, default `shared` and
`public`). Use it for markup that is specific to the domain but has no data: a `TokenFrame` that every token editor
draws, a `CardSkeleton` of the board. A view in `<module>/shared/` follows the same rules as any view: props in,
markup out, no hooks.

```tsx
// ❌ Bad: the colors module reaches into a private view of the tokens module
import { TokensBuilder } from '@/modules/tokens/TokensBuilder/TokensBuilder';

// ✅ Good: moved to the shared layer, or published by tokens on purpose
import { TokensBuilder } from '@/components/TokensBuilder/TokensBuilder';
import { TokensBuilder } from '@/modules/tokens/shared/TokensBuilder';
```

The shared layer (`src/components`) imports nothing from modules and no hooks: it is the bottom of the graph. A view
that needs a module's hook to render is not shared; it is a container's view in that module.

## Hooks Are the Data API

The contract of a module is the **signature** of its hooks, not the shape of its state.

```ts
// the contract: values by id, handlers that take ids
useTaskTitle(id: TaskId): string
useTaskDone(id: TaskId): boolean
useVisibleTaskIds(columnId: ColumnId): TaskId[]
useSelectTask(): (id: TaskId) => void
```

- **narrow and id-addressed**: `useTaskTitle(id)`, not `useTask(id).title`, never `useBoard()`; see
  [Minimal Subscription](./02-containers-and-views.md#minimal-subscription)
- **values and handlers**, never store shapes: a hook returns a `string`, a `boolean`, an array of ids, a memoized
  derived object, or a stable callback; it does not return `RootState['board']` or a slice entity for a view to pick apart
- **derived data through memoized selectors** inside the hook (`createSelector`, a `makeSelector` factory for
  parameterized ones); the container sees only the result
- **`hooks.ts` is the only file that knows the store**: `useAppSelector`, `useAppDispatch`, selectors, action creators
  and the slice are imported there and nowhere else in the module
- **hooks of one module may call hooks of another** (`useGradientCss(id)` calls `useThemeColor(ref)` from `themes`);
  this is the data edge between modules

The store swap ends inside `hooks.ts`. Replacing Redux with Zustand, RTK Query or GraphQL fragments rewrites the body
of every hook and the provider in `src/app`; the signatures, the containers and the views stay.

```ts
// ❌ Bad: the contract leaks the store; containers do task.title and re-render on every field
export const useTask = (id: string) => useAppSelector((s) => s.board.tasks.byId[id]);
// ✅ Good: one hook per value; the store shape is a detail of this file
export const useTaskTitle = (id: TaskId) => useAppSelector((s) => s.board.tasks.byId[id]?.title ?? '');
```

## Edges Between Modules

Two kinds of edges cross a module boundary, and only two:

```
  modules/board                          modules/user
  TaskContainer ────────────────────▶ AvatarContainer      container → container (UI composition)
     ▼                                     ▼
  Task (view)          ✗ never ──▶      Avatar (view)      never view → view across the line
  hooks.ts ─────────────────────────▶ hooks.ts             hooks → hooks (data derivation)
     ▼                                     ▼
  boardSlice.ts        ✗ never ──▶      userSlice.ts       never slice → slice
```

- **container → container**: `TaskContainer` puts `<AvatarContainer userId={assigneeId} />` into the `assignee` slot
  of its view. It passes an id, never an entity, and the `user` module renders its own island
- **hooks → hooks**: `useTaskAssigneeName(taskId)` in `board/hooks.ts` calls `useUserName(id)` from `@/modules/user`.
  Derived data is computed where the derivation lives, not in a container that subscribes to both
- **never view → view**: a view of `board` does not import a view of `user`. If the two need the same markup, it goes
  to `src/components` or the owner's `shared/`
- **never slice → slice**: a reducer of `board` does not read `state.user`; a container of `board` imports
  `@/modules/user`, not `@/modules/user/userSlice`
- **types** may cross as `import type`; a hook signature that takes a `UserId` needs it

```tsx
// ❌ Bad: board joins user data itself and hands the object to its view
const TaskContainer = ({ id }) => {
  const task = useTask(id);
  const user = useUser(task.assigneeId);          // user's internals, in a board container
  return <Task task={task} user={user} />;        // entities into a view
};

// ✅ Good: an id crosses the line, the user module renders its own island
const TaskContainer = memo(function TaskContainer({ id }: { id: TaskId }) {
  const title = useTaskTitle(id);
  const assigneeId = useTaskAssigneeId(id);
  return <Task title={title} assignee={<AvatarContainer userId={assigneeId} />} actions={<TaskActionsContainer taskId={id} />} />;
});
```

## One Level of Modules

`src/modules/<module>` is the only module level. Inside a module, features (`<module>/<Feature>/`) share views, hooks
and the slice freely; there is no boundary between them and none is enforced.

A feature is promoted to a module when it has **its own hooks (or slice) and another module imports it**. Then
`<module>/<Feature>/` becomes `src/modules/<feature>/` with an `index.ts`, and the old parent imports it like anyone
else. One of the two alone is not a reason to promote: a feature with private hooks stays; a feature other modules use
through the parent's containers stays. The analyzer reports the combination as `submodule-candidate`.

Nested modules (`src/modules/tokens/modules/colors`) do not exist. If a module has grown a second module inside, it is
two modules side by side.

## Module Cycles

Modules form a directed graph over container → container and hooks → hooks edges. A cycle in that graph means neither
module can be understood, tested or removed without the other, and `import/no-cycle` will flag it file by file. The
analyzer reports it once per pair as `module-cycle`.

The usual cause is a **module that is both a UI kit and a page**. A real case from `akicolors` (a private side project): the `tokens` module
owned three layout views (`TokenModuleLayout`, `TokensBuilder`, `TokensDocs`) that eight sibling modules (`colors`,
`gradients`, `shadows`, `borders`, `spacings`, `typography`, `patterns`, `themes`) imported to draw their editors. The
same `tokens` module also owned `TokensPageContainer`, which composed the containers of those eight modules into the
tokens page. Eight modules import `tokens`, `tokens` imports eight modules: eight cycles, all through three files.

The fix was three file moves: the layout views went to `src/components`, the page container to `src/app/tokens`.
No line of logic changed and the cycles were gone.

Rules of thumb:

- a module that exports views is a kit: move the views to `src/components`
- a module that composes its siblings is a page: move the composition to `src/app`
- a module whose hooks derive from a module whose hooks derive from it: one of the two derivations belongs in a third
  module, or the two are one module

## Pages Compose Modules

A page is a container-like file under `src/app` (or `pages/`, or `main.tsx` / `App.tsx` at the root). It has no
markup of its own beyond a layout view, no hooks of its own beyond routing, and it holds the providers.

```tsx
// src/app/board/page.tsx (the store provider sits once in src/app/layout.tsx)
import { BoardLayout } from '@/components/BoardLayout/BoardLayout';
import { BoardContainer } from '@/modules/board';
import { UserMenuContainer } from '@/modules/user';

export default function BoardPage() {
  return <BoardLayout header={<UserMenuContainer />} main={<BoardContainer />} />;
}
```

- a page renders module containers into the slots of a layout view; the layout view is shared (`src/components`)
- a page that renders one module container (`return <TokensPageContainer />`) is fine only if that container composes
  its own module; if it composes other modules, the composition belongs in the page
- routing values (`params.id`) go to containers as ids, the same as any container passes them
- a page imports nothing from a module but its `index.ts`

## Lint and Analyzer

`eslint-plugin-superarchitecture` guards the boundary by file name and location; the analyzer, which has the whole
graph, reports what a single file cannot see.

| rule | says |
|---|---|
| `module-no-foreign-view` | a module's views are private; other modules compose its containers and read its hooks. `src/components` and `<module>/shared/` are excepted |
| `shared-no-module-import` | the shared layer imports nothing from `src/modules` and no hooks |
| `container-no-store-import` | a container imports its module's hooks, never a slice, `src/store` or a store library |
| `module-cycle` (analyzer) | two modules import each other through containers or hooks |
| `submodule-candidate` (analyzer) | a feature folder has its own hooks and is imported by another module |

Settings: `modulesDir: 'src/modules'`, `sharedDir: 'src/components'`, `moduleSharedDirs: ['shared', 'public']`,
`aliases: { '@/': 'src/' }`.

### `module-no-foreign-view`

```tsx
// ❌ Bad: gradients renders a view of tokens
// src/modules/gradients/GradientsDocs/GradientsDocs.tsx
import { TokensDocs } from '@/modules/tokens/TokensDocs/TokensDocs';

// ✅ Good: the view is shared, or the container is composed
import { TokensDocs } from '@/components/TokensDocs/TokensDocs';
// or, in a container:
import { TokensDocsContainer } from '@/modules/tokens';
```

### `shared-no-module-import`

```tsx
// ❌ Bad: a shared view reads a module hook; it now needs a provider and a domain
// src/components/Avatar/Avatar.tsx
import { useUserName } from '@/modules/user';
export const Avatar = ({ id }: { id: string }) => <span>{useUserName(id)}</span>;

// ✅ Good: the shared view takes a value; the user module has AvatarContainer for the data
export const Avatar = ({ name }: { name: string }) => <span>{name}</span>;
```

### `container-no-store-import`

```tsx
// ❌ Bad: the container knows the store shape and the store library
import { useSelector } from 'react-redux';
import { toggleDone } from '../boardSlice';
const done = useSelector((s: RootState) => s.board.tasks.byId[id].done);

// ✅ Good: the container knows a signature
import { useTaskDone, useToggleDone } from '../hooks';
const done = useTaskDone(id);
const toggleDone = useToggleDone();
```

### `module-cycle`

```tsx
// ❌ Bad: tokens composes colors (TokensPageContainer), colors draws with a tokens view
import { ColorsContainer } from '@/modules/colors';                                   // in modules/tokens
import { TokenModuleLayout } from '@/modules/tokens/TokenModuleLayout/TokenModuleLayout'; // in modules/colors

// ✅ Good: the composition is a page, the layout is shared
import { ColorsContainer } from '@/modules/colors';                                   // in src/app/tokens/page.tsx
import { TokenModuleLayout } from '@/components/TokenModuleLayout/TokenModuleLayout'; // in modules/colors
```

### `submodule-candidate`

```tsx
// ❌ Bad: variables/Export/ has its own hooks.ts (useExportCss) and tokens imports it through the parent
import { ExportContainer } from '@/modules/variables';   // in modules/tokens

// ✅ Good: promoted to src/modules/export/ with its own index.ts
import { ExportContainer } from '@/modules/export';      // in modules/tokens
```

## Checklist

- [ ] the module has an `index.ts` that exports containers, hooks and types; no view, no slice, no selector
- [ ] every view is imported only inside the module, lives in `<module>/shared/` on purpose, or moved to `src/components`
- [ ] every hook has a signature that would survive a store swap: values and handlers by id, no state shapes
- [ ] `hooks.ts` is the only file importing the slice, selectors, `useAppSelector` or `useAppDispatch`
- [ ] edges to other modules are container → container or hooks → hooks, through `@/modules/<m>`; ids cross, entities do not
- [ ] no module imports a module that imports it back; the module is a domain, not a screen and not a kit
- [ ] a feature with its own hooks that another module uses has been promoted
- [ ] pages compose containers into a shared layout view and hold the provider
