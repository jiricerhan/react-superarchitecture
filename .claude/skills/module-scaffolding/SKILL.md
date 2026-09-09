---
name: module-scaffolding
description: >
  Scaffolds a new module or feature in a react-superarchitecture codebase: the
  right folder, the container/view split, hooks as the data API, a Redux Toolkit
  slice with small writes, BEM styles and a provider-free story. Use this skill
  whenever creating a module, feature, screen, section or page, even if the user
  just says "create a module for X", "add a new screen", "scaffold a feature",
  "add a section", or "where should this file go". Produces the folder layout
  and the boilerplate; the rules live in docs/01-repo-structure.md,
  docs/02-containers-and-views.md and docs/04-modules.md.
---

# Creating a Module or Feature

## Where does it go

Answer in order; the first yes wins.

1. **Markup only, no data, used by more than one module?** → a shared view: `src/components/<Name>/<Name>.tsx` (+ `.module.scss`). No hooks, no container.
2. **A new domain** (its own state, its own hooks: `board`, `user`, `tokens`)? → a new module: `src/modules/<module>/` with `index.ts`, `hooks.ts`, `<module>Slice.ts`.
3. **A screen or section of an existing domain** (a card, a toolbar, a detail panel)? → a feature folder: `src/modules/<module>/<Feature>/` with `<Feature>Container.tsx` + `<Feature>.tsx`. It uses the module's `hooks.ts`; it gets no `index.ts`, no slice.
4. **Markup used by several features of one module** → `src/modules/<module>/shared/<Name>.tsx`.
5. **A route** → `src/app/<route>/page.tsx`: renders module containers into a shared layout view. No hooks, no markup.
6. **A hook with no domain** (`useDialog`, `useMediaQuery`) → `src/hooks/useX.ts`. A pure function → `src/utils/`.

A module folder stays **flat** until about ten files; then feature folders. Never a third level.

## Files to create

Create only what the request needs; no empty placeholders. New module = `index.ts` + `hooks.ts` + slice + one feature.
New feature = container + view + styles (+ story).

```
src/modules/board/
  index.ts               # containers + hooks + types; never a view. Must be .ts
  hooks.ts               # the data API; the only file touching the slice
  boardSlice.ts          # private; register it in src/store/store.ts: reducer: { board: boardSlice.reducer }
  types.ts
  Task/                  # TaskContainer.tsx, Task.tsx, Task.module.scss, Task.stories.tsx
```

### `index.ts`

```ts
export { TaskContainer } from './Task/TaskContainer';
export { useTaskTitle, useTaskDone, useToggleDone } from './hooks';
export type { TaskId } from './types';
```

### `hooks.ts`

```ts
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleDone } from './boardSlice';
import type { TaskId } from './types';

// one value per hook, addressed by id; the store shape stays in this file
export const useTaskTitle = (id: TaskId) => useAppSelector((s) => s.board.tasks.byId[id]?.title ?? '');
export const useTaskDone = (id: TaskId) => useAppSelector((s) => s.board.tasks.byId[id]?.done ?? false);

// derived values: createSelector inside the hook (makeSelector factory + useMemo when parameterized)
// handlers: stable callbacks that take ids
export const useToggleDone = () => {
  const dispatch = useAppDispatch();
  return useCallback((id: TaskId) => dispatch(toggleDone(id)), [dispatch]);
};
```

### `boardSlice.ts`

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Task, TaskId } from './types';

type BoardState = { tasks: { ids: TaskId[]; byId: Record<TaskId, Task> }; filter: string };
const initialState: BoardState = { tasks: { ids: [], byId: {} }, filter: '' };

export const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    // small writes: mutate the field that changed; never replace the object or return a new state
    setFilter: (state, action: PayloadAction<string>) => { state.filter = action.payload; },
    toggleDone: (state, action: PayloadAction<TaskId>) => {
      const t = state.tasks.byId[action.payload];
      if (t) t.done = !t.done;
    },
  },
});

export const { setFilter, toggleDone } = boardSlice.actions;
```

Never `state.tasks.byId[id] = { ...t, done }` and never `return { ...state, filter }`: every reader of the object re-renders.

### `TaskContainer.tsx`

```tsx
import { memo, useCallback } from 'react';
import { useTaskTitle, useTaskDone, useToggleDone } from '../hooks';
import { AssigneeContainer } from './AssigneeContainer';
import { Task } from './Task';
import type { TaskId } from '../types';

type Props = { id: TaskId };

// memo: this container is created by another container. Hooks only, one view, no markup.
export const TaskContainer = memo(function TaskContainer({ id }: Props) {
  const title = useTaskTitle(id);
  const done = useTaskDone(id);
  const toggleDone = useToggleDone();
  const onToggle = useCallback(() => toggleDone(id), [toggleDone, id]);
  const assignee = <AssigneeContainer taskId={id} />; // child container element into a slot; id, not object
  return <Task title={title} done={done} onToggle={onToggle} assignee={assignee} />;
});
```

### `Task.tsx`

```tsx
import type { ReactNode } from 'react';
import cx from 'classnames';
import styles from './Task.module.scss';

type Props = {
  title: string;          // values, never entities
  done: boolean;
  onToggle: () => void;   // handlers made in the container
  assignee: ReactNode;    // slot: the container decides what goes here
};

export const Task = ({ title, done, onToggle, assignee }: Props) => (
  <div className={cx(styles.task, done && styles['task--done'])}>
    <h3 className={styles['task__title']}>{title}</h3>
    <div className={styles['task__assignee']}>{assignee}</div>
    <button className={styles['task__toggle']} onClick={onToggle}>Done</button>
  </div>
);
```

No `useState`, no effects, no hooks beyond `useRef`/`useMemo`/`useCallback`/`useId`, no container imports.

### `Task.module.scss`

```scss
// block named after the view, BEM, no nesting, modifiers over nested selectors
.task { opacity: var(--task-opacity, 1); display: grid; gap: var(--space-2); padding: var(--space-3); }
.task--done { --task-opacity: 0.6; }
.task__title { margin: 0; font: var(--font-heading-s); }
.task__assignee { display: flex; }
.task__toggle { justify-self: end; }
```

### `Task.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Task } from './Task';

export default { component: Task } satisfies Meta<typeof Task>;
// props only: no provider, no mock store, no container. If it needs a provider, it is not a view.
export const Default: StoryObj<typeof Task> = {
  args: { title: 'Design tokens', done: false, onToggle: () => {}, assignee: <span>Alena</span> },
};
```

## Naming

| kind | file | export |
|---|---|---|
| module folder | `src/modules/board/` | camelCase |
| entry | `index.ts` | containers, hooks, types (`.ts`, not `.tsx`) |
| container | `TaskContainer.tsx` | `TaskContainer` (named export, `memo` when created by a container) |
| view | `Task.tsx` | `Task`, no suffix |
| styles | `Task.module.scss` | block `.task` |
| story / test | `Task.stories.tsx`, `Task.test.tsx` | next to the view |
| hooks | `hooks.ts` or `useTask.ts` | `useTaskTitle` (camelCase, `use` prefix) |
| slice | `boardSlice.ts` | `boardSlice` |
| types / utils / page | `types.ts`, `utils.ts`, `src/app/<route>/page.tsx` | — |

Imports: `@/` is `src/`. Other modules through `@/modules/board` (its `index.ts`), shared views by file
(`@/components/Button/Button`), inside the module relative.

## Checklist

- [ ] the file is in the layer the decision tree gives; a module is a domain, not a screen and not a kit
- [ ] `index.ts` exports containers, hooks and types; no view, no slice
- [ ] `hooks.ts` is the only file importing the slice or `useAppSelector`; every hook returns one value or one stable handler by id
- [ ] reducers mutate fields; no object swap, no `return { ...state }`; the slice is registered in `src/store/store.ts`
- [ ] the container: hooks only, one view, no host elements, `memo` when created by another container, ids to child containers
- [ ] the view: props only, values not entities, `ReactNode` slots where a container belongs, no state, no effects
- [ ] styles, story and test sit next to the view; the story renders without a provider
- [ ] `eslint-plugin-superarchitecture` passes

---
Full reference: `docs/01-repo-structure.md` (layout and naming), `docs/04-modules.md` (module boundary),
`docs/02-containers-and-views.md` (the rule).
