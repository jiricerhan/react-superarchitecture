# Example: kanban board

A small board (columns, tasks, assignees, filter, stats, selected task) written by the rules and laid out the way
`docs/01-repo-structure.md` describes.

```
src/
  modules/board/     one module: containers, views, hooks.ts (the data API), boardSlice.ts (small writes), index.ts
  components/Card/   the shared markup view: knows layout (head, footer, body), knows nothing about tasks
  store/             store.ts (assembles the slice) + hooks.ts (useAppSelector, useAppDispatch)
  app/App.tsx        composition root: Provider + BoardContainer, imports the module through its index.ts
```

Files in `src/modules/board`:

| container | view | reads |
|---|---|---|
| `BoardContainer` | `Board` | `useColumnIds` |
| `FilterContainer` | `Filter` | `useFilter`, `useSetFilter` |
| `ColumnContainer(id)` | `Column` | `useColumnTitle`, `useVisibleTaskIds` |
| `TaskContainer(id)` | `Task` | `useTaskTitle`, `useIsTaskSelected`, `useSelectTask` |
| `AssigneeContainer(taskId)` | `Assignee` | `useTaskAssigneeId`, `useUser` |
| `TaskActionsContainer(taskId)` | `TaskActions` | `useTaskDone`, `useToggleDone` |
| `StatsContainer` | `Stats` | `useStats` |
| `SelectedTaskContainer` | `SelectedTask` | `useSelectedTaskId`, `useTaskTitle` |

`index.ts` exports the containers and the hooks, never a view. `boardSlice.ts` is imported only by `hooks.ts` and
`src/store/store.ts`.

Things to notice:

- `BoardContainer` reads only `useColumnIds()` and hands `Board` three slots: `toolbar`, `columns`, `sidebar`.
- `Board`, `Column`, `Task` never import a container; they render `ReactNode` props.
- `TaskContainer(id)` reads `useTaskTitle(id)` and `useIsTaskSelected(id)`, nothing else. Renaming a task re-renders one card.
- Every reducer in `boardSlice.ts` mutates the field that changed. No `{ ...task }`.
- Views have no state. Hover is CSS. Selection is a prop.

Storybook or a test renders any view with plain props; no `Provider` needed.

The example is meant to be read and linted, not started: there is no bundler config or `index.html`. Drop `src/` into a Vite + React + Redux Toolkit project and render `App` to run it.

`npm run check:example` from the repository root lints it with `modulesDir: src/modules` and `sharedDir: src/components`,
so the module rules run too.
