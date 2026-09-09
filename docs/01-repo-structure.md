# Repository Structure and Naming

Where files go and what they are called. The layout exists to serve one rule, **a view never imports a container**
([02-containers-and-views.md](./02-containers-and-views.md)), and one grouping, **modules**
([04-modules.md](./04-modules.md)). Every convention below is either derived from those two documents or from what the
lint plugin (`eslint-plugin-superarchitecture`) can detect without type information: it classifies files **by name and
location**, so the names are not taste, they are the contract with the tooling.

The layouts are taken from three real codebases that follow the rule: `akicolors` (feature folders) and `akinom`
(flat modules with an `index.ts` entry), both private side projects, and the `board` example of this repo
(`examples/board/src`).

## Top-Level Layout

```
src/
  app/                  # pages / routes: compose module containers, hold providers (Next: app/, Vite: main.tsx + App.tsx)
  modules/              # one folder per domain module (board, tokens, user, ...)
    board/
    tokens/
  components/           # shared views, design-system views: import nothing from modules, no hooks
  hooks/                # generic, domain-free hooks (useDialog, useMediaQuery): used by containers
  utils/                # pure, domain-free functions (formatDate, clamp)
  store/                # store assembly only: store.ts + typed base hooks; no domain logic
```

| folder | contains | may import | may not import |
|---|---|---|---|
| `src/app` | pages, layouts, providers | module containers, module hooks, shared views | slices, module views |
| `src/modules/<m>` | containers, views, hooks, slice, types of one domain | own files, other modules' `index.ts`, `components`, `hooks`, `utils` | other modules' views or slices |
| `src/components` | shared views | other shared views, `utils` | modules, `hooks`, `store` |
| `src/hooks` | generic hooks | `utils` | modules, `components` |
| `src/utils` | pure functions | nothing project-specific | everything else |
| `src/store` | `store.ts` (assembles slices), `hooks.ts` (`useAppSelector`, `useAppDispatch`) | module slices | containers, views |

`src/store/store.ts` is the one file outside a module that imports a slice. Module `hooks.ts` files import
`type RootState` from it; that is a type-only edge and does not count as a cycle.

## Inside a Module

```
src/modules/board/
  index.ts               # public API: containers + hooks + types; never a view
  hooks.ts               # the data API; the only file that touches the slice and its selectors
  boardSlice.ts          # private; or store/ when the module has several slices
  types.ts               # domain types (Task, Column); entities that views never receive
  utils.ts               # pure functions of this domain; or utils/ when it grows
  shared/                # views this module publishes on purpose (see 04-modules.md)
    TokenFrame.tsx
  Board/                 # feature folder
    BoardContainer.tsx
    Board.tsx
    Board.module.scss
    Board.stories.tsx    # optional
    Board.test.tsx       # optional
  Task/
    TaskContainer.tsx
    Task.tsx
    Task.module.scss
    AssigneeContainer.tsx
    Assignee.tsx
```

- **`index.ts`** lists what other modules and pages may import: containers, hooks, types. It is `.ts`, not `.tsx`: a
  `.tsx` entry would be classified as a view.
- **`hooks.ts`** is the data API. Containers call `useTaskTitle(id)`; the selector, the store library and the slice
  stay inside this file. A module with many hooks may split them into `hooks/useTask.ts`, `hooks/useColumn.ts`; the
  `hooks/` folder is classified the same way.
- **`boardSlice.ts`** is private. Nothing but `hooks.ts` and `src/store/store.ts` imports it.
- **`types.ts`** holds the entities. Views define their own prop types and never import entities.
- **feature folders** hold one container, its view, its styles, and the small containers that fill its slots. A
  feature folder has no `index.ts`.
- **no barrel files inside a module.** The module's own `index.ts` is the only one, and it exports containers and
  hooks, never views. A barrel does not hide a container from the lint either: `view-no-container-import` also
  matches the imported name (`*Container`), so `import { TaskContainer } from '@/modules/board'` in a view is reported.

## File Naming

| kind | file | export | lint classification |
|---|---|---|---|
| container | `TaskContainer.tsx` | `export const TaskContainer` | `*Container.tsx` → container |
| view | `Task.tsx` | `export const Task` | any other `.tsx` → view |
| styles | `Task.module.scss` | block `.task` | style of the view with the same name |
| story | `Task.stories.tsx` | stories of the view | view (imports only the view) |
| test | `Task.test.tsx`, `hooks.test.ts` | — | view / other |
| hooks | `hooks.ts`, `useTask.ts`, `hooks/*.ts` | `export const useTaskTitle` | hook |
| slice | `boardSlice.ts`, `store/*.ts` | `export const boardSlice` | store |
| store assembly | `src/store/store.ts`, `src/store/hooks.ts` | `store`, `RootState`, `AppDispatch`; `useAppSelector`, `useAppDispatch` | store |
| types | `types.ts` | domain types | util |
| utils | `utils.ts`, `utils/*.ts`, `consts.ts` | pure functions, constants | util |
| page | `src/app/**/page.tsx`, `layout.tsx`; `src/main.tsx`, `src/App.tsx` | default export | page (composition root) |
| module entry | `index.ts` | containers, hooks, types | other |

Rules behind the table:

- **One component per file, the file named after the export.** `Task.tsx` exports `Task`, `TaskContainer.tsx` exports
  `TaskContainer`. Named exports; a default export can be renamed at the import site and the name stops meaning anything.
- **No `View` suffix.** The view is named after what it shows; the container carries the suffix.
- **Hooks are camelCase with the `use` prefix**, in `hooks.ts` or `useX.ts`. `UseX.ts` (PascalCase) is not recognized.
- **Slices are camelCase with the `Slice` suffix**, named after the module: `boardSlice.ts`, `gradientsSlice.ts`.
- **Styles, stories and tests share the view's name.** They sit next to the view, never in `tests/` or `__tests__/`.
- **A page is only a page by location**: `page.tsx` / `layout.tsx` under `src/app` (or `pages/`), or `main.tsx` /
  `App.tsx` / `index.tsx` directly under `src/` or under `src/app`. The same names deeper in the tree are ordinary views.
- **Module folders are camelCase** (`board`, `colorPicker`); feature folders and component files are PascalCase.

```tsx
// ❌ Bad: the name says nothing, the export does not match the file, the view carries a suffix
// components/task/index.tsx
export default function TaskView() { ... }

// ✅ Good: one export, named after the file, no suffix
// modules/board/Task/Task.tsx
export const Task = ({ title, selected, onSelect, assignee, actions }: Props) => ( ... );
```

## Import Direction

Arrows point at what is imported. Everything flows one way; nothing points back up.

```
  src/app                 pages: compose module containers, hold providers
     │
     ▼
  src/modules/*           containers + hooks per domain
     │        │
     │        └──────────────▶  src/hooks   generic hooks (containers only)
     ▼                              │
  src/components          shared views
     │                              │
     ▼                              ▼
  src/utils               pure functions
```

`src/store/store.ts` sits beside this chain: it imports every module's slice and is imported by the provider in
`src/app`. Modules reach it only through `import type { RootState }`.

Inside a module the same shape repeats one level down:

```
  BoardContainer ──────▶ Board (view) ──────▶ shared views (src/components, <module>/shared)
     │    │                                     ▲
     │    └──▶ ColumnContainer ──▶ Column ──────┘      view ← container
     │              │
     │              └──▶ TaskContainer ──▶ Task        container ← container
     │
     └──▶ hooks.ts ──▶ boardSlice.ts ──▶ types.ts      hooks ← container, slice ← hooks only
              │
              └──▶ src/store/hooks.ts (useAppSelector)  base hooks ← module hooks only
```

- a **view** imports views, the shared layer and pure utils
- a **container** imports its view, the containers it creates, and hooks
- **hooks** import the slice, selectors, base store hooks, other modules' hooks
- a **slice** imports types and utils, nothing with React in it
- nothing imports a container except another container or a page; nothing imports a slice except `hooks.ts` and `store.ts`

## Path Aliases

`@/` is rooted at `src/`. Cross-folder imports use it; imports inside a module are relative.

```tsx
// ✅ Good
import { Button } from '@/components/Button/Button';          // shared view, direct file
import { TaskContainer, useTaskTitle } from '@/modules/board'; // another module, through its entry
import { Task } from './Task';                                 // inside the module: relative

// ❌ Bad
import { Task } from '@/modules/board/Task/Task';             // reaches a private view of another module
import { Button } from '@/components';                        // barrel over the shared layer
import { useTaskTitle } from '../../board/hooks';             // relative path climbing out of the module
```

The lint plugin needs the alias declared: `settings.superarchitecture.aliases = { '@/': 'src/' }`, together with
`modulesDir: 'src/modules'` and `sharedDir: 'src/components'`.

## Colocation

- styles, stories and tests live next to the view they belong to; a feature folder is complete on its own
- a story renders the view with props: no provider, no mock, no container. If a story needs a provider, the file is
  not a view
- hook tests (`hooks.test.ts`) test the hook against a real store; container tests are hook tests
- GraphQL operations, when used, sit in the feature folder as `<Feature>.graphql`; the generated hook is called from
  the module's `hooks.ts`, not from the container

## Two Shapes: Flat and Feature Folders

Both are the same module. Choose by size.

```
flat (akinom style)                     feature folders (akicolors style)

src/modules/layer/                      src/modules/gradients/
  index.ts                                index.ts
  hooks.ts                                hooks.ts
  layerSlice.ts                           gradientsSlice.ts
  types.ts                                types.ts
  LayerContainer.tsx                      utils.ts
  Layer.tsx                               GradientsContainer.tsx        # the module's root container
  Layer.module.scss                       GradientsBuilder/
  LayerToolbarContainer.tsx                 GradientsBuilderContainer.tsx
  LayerToolbar.tsx                          GradientsBuilder.tsx
  LayerOverlayContainer.tsx                 GradientsBuilder.module.scss
  LayerOverlay.tsx                          GradientSelectorContainer.tsx
                                            GradientSelector.tsx
                                            GradientPreviewContainer.tsx
                                            GradientPreview.tsx
                                          GradientsDocs/
                                            GradientsDocsContainer.tsx
                                            GradientsDocs.tsx
                                          GradientsPreview/
                                            GradientsPreviewContainer.tsx
```

- **flat** until about ten files: one container-view pair per concern, all directly in the module folder
- **feature folders** once a module has several screens or sections with their own child containers. A feature folder
  is a container, its view, and the containers that fill its slots. The root container of the module (the one pages
  render) may stay at the module root
- do not nest feature folders inside feature folders. Two levels under `src/modules` is the maximum: `<module>/<Feature>/`
- moving from flat to folders is a file move; imports inside the module are relative and short either way

## Growing a Module

A feature starts as a folder inside a module and shares that module's hooks and slice. It becomes a module of its own
when both of these are true:

1. it has its own data API: a `hooks.ts` (or `useX.ts`) and usually its own slice
2. another module imports it

At that point `<module>/<Feature>/` moves to `src/modules/<feature>/` with an `index.ts`. Until then a feature folder
with its own hooks is fine, and a feature that another module imports through the parent module's `index.ts` is fine;
it is the combination that marks a module hiding inside another. The analyzer reports it as `submodule-candidate`.

The reverse holds too: a module whose `index.ts` exports nothing but views is not a module, it is a kit. Move its
files to `src/components`.

## Anti-Patterns

| smell | why it hurts | do instead |
|---|---|---|
| `index.ts` re-exporting views across modules | the view becomes public; other modules' views import it and the import graph crosses the module boundary | export containers and hooks; put a view used by several modules in `src/components` |
| barrel `src/components/index.ts` | one import pulls in every shared view; refactors touch the barrel | import the file: `@/components/Button/Button` |
| `utils.ts` as a dumping ground | domain logic, formatting and store helpers end up in one file every layer imports | `src/utils` holds pure, domain-free functions; domain helpers live in `<module>/utils.ts`; anything that reads state is a hook |
| a container under `src/components` | the shared layer now depends on a module's data | containers live in modules; `src/components` is views only |
| a view importing from `src/store` or a slice | the view needs a provider; it cannot render in Storybook or a test | the container reads a hook and passes a value |
| a view importing `hooks.ts` | same as above, one step removed | hooks are called in containers |
| `tests/`, `__tests__/`, `styles/` folders inside a feature | the feature is spread over three folders; moving it means moving three things | colocate next to the view |
| `<module>/components/` | a second shared layer per module with no rule for who may import it | `<module>/shared/` for published views, feature folders for the rest |
| a module folder named after a screen (`tokensPage`) | it composes sibling modules and becomes a cycle hub | pages live in `src/app`; a module is a domain |
| `UseLayer.ts`, `Types.ts`, `Store.ts` | PascalCase hook and util files are not recognized by the classifier | `useLayer.ts`, `types.ts`, `store.ts` |

## Checklist

Before a file lands:

- [ ] it is in the right layer: page in `src/app`, domain code in `src/modules/<m>`, shared view in `src/components`, generic hook in `src/hooks`, pure function in `src/utils`
- [ ] the file name says what it is: `*Container.tsx`, plain `.tsx` view, `hooks.ts` / `useX.ts`, `*Slice.ts`, `types.ts`, `utils.ts`
- [ ] one export per component file, named after the file, no `View` suffix
- [ ] the module has an `index.ts` (`.ts`, not `.tsx`) exporting containers, hooks and types only
- [ ] styles, stories and tests sit next to the view and share its name
- [ ] the story renders the view without a provider
- [ ] cross-module imports go through `@/modules/<m>`; shared views through `@/components/<Name>/<Name>`; imports inside a module are relative
- [ ] no view imports a container, a hook, a slice or the store
- [ ] nothing but `hooks.ts` and `src/store/store.ts` imports a slice
- [ ] the module is flat or has one level of feature folders, not more
- [ ] a feature with its own hooks that another module imports has been promoted to a module
- [ ] `eslint-plugin-superarchitecture` runs with `modulesDir`, `sharedDir` and `aliases` set
