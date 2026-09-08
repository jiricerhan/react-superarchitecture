import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface User { id: string; name: string }
export interface Task { id: string; title: string; assigneeId: string; done: boolean }
export interface Column { id: string; title: string; taskIds: string[] }

export interface BoardState {
  users: { ids: string[]; byId: Record<string, User> };
  tasks: { ids: string[]; byId: Record<string, Task> };
  columns: { ids: string[]; byId: Record<string, Column> };
  /** search text, changes on every keystroke */
  filter: string;
  selectedTaskId: string | null;
}

const users: User[] = [
  { id: 'u1', name: 'Alena' },
  { id: 'u2', name: 'Bořek' },
  { id: 'u3', name: 'Cyril' },
];
const tasks: Task[] = [
  { id: 't1', title: 'Design tokens', assigneeId: 'u1', done: false },
  { id: 't2', title: 'Color picker', assigneeId: 'u2', done: true },
  { id: 't3', title: 'Gradient editor', assigneeId: 'u3', done: false },
  { id: 't4', title: 'Shadow editor', assigneeId: 'u1', done: false },
  { id: 't5', title: 'Docs page', assigneeId: 'u2', done: false },
  { id: 't6', title: 'Theme export', assigneeId: 'u3', done: true },
  { id: 't7', title: 'Contrast check', assigneeId: 'u1', done: false },
  { id: 't8', title: 'Design review', assigneeId: 'u2', done: false },
];
const columns: Column[] = [
  { id: 'c1', title: 'Todo', taskIds: ['t1', 't4', 't5'] },
  { id: 'c2', title: 'In progress', taskIds: ['t3', 't7', 't8'] },
  { id: 'c3', title: 'Done', taskIds: ['t2', 't6'] },
];

const initialState: BoardState = {
  users: { ids: users.map((u) => u.id), byId: Object.fromEntries(users.map((u) => [u.id, u])) },
  tasks: { ids: tasks.map((t) => t.id), byId: Object.fromEntries(tasks.map((t) => [t.id, t])) },
  columns: { ids: columns.map((c) => c.id), byId: Object.fromEntries(columns.map((c) => [c.id, c])) },
  filter: '',
  selectedTaskId: 't1',
};

export const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<string>) => { state.filter = action.payload; },
    selectTask: (state, action: PayloadAction<string>) => { state.selectedTaskId = action.payload; },
    toggleDone: (state, action: PayloadAction<string>) => {
      const t = state.tasks.byId[action.payload];
      if (t) t.done = !t.done;
    },
    // small, targeted writes: each action changes one field, so the islands in the data stay apart
    renameTask: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const t = state.tasks.byId[action.payload.id];
      if (t) t.title = action.payload.title;
    },
    assignTask: (state, action: PayloadAction<{ id: string; assigneeId: string }>) => {
      const t = state.tasks.byId[action.payload.id];
      if (t) t.assigneeId = action.payload.assigneeId;
    },
    moveTask: (state, action: PayloadAction<{ id: string; to: string }>) => {
      for (const c of Object.values(state.columns.byId)) {
        const i = c.taskIds.indexOf(action.payload.id);
        if (i >= 0) c.taskIds.splice(i, 1);
      }
      state.columns.byId[action.payload.to]?.taskIds.push(action.payload.id);
    },
    renameColumn: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const c = state.columns.byId[action.payload.id];
      if (c) c.title = action.payload.title;
    },
    renameUser: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const u = state.users.byId[action.payload.id];
      if (u) u.name = action.payload.name;
    },
  },
});

export const { setFilter, selectTask, toggleDone, renameTask, assignTask, moveTask, renameColumn, renameUser } = boardSlice.actions;
