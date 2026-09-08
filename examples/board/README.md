# Example: kanban board

A small board (columns, tasks, assignees, filter, stats, selected task) written by the rules.

```
features/   one container + one view per feature; containers create child containers into slots
store/      boardSlice.ts (small writes), hooks.ts (the data API), store.ts
```

Things to notice:

- `BoardContainer` reads only `useColumnIds()` and hands `Board` three slots: `toolbar`, `columns`, `sidebar`.
- `Board`, `Column`, `Task` never import a container; they render `ReactNode` props.
- `TaskContainer(id)` reads `useTaskTitle(id)` and `useIsTaskSelected(id)`, nothing else. Renaming a task re-renders one card.
- Every reducer in `boardSlice.ts` mutates the field that changed. No `{ ...task }`.
- Views have no state. Hover is CSS. Selection is a prop.

Storybook or a test renders any view with plain props; no `Provider` needed.
