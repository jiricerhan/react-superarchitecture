import { useCallback, useMemo } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectTask, setFilter, toggleDone, type User } from './boardSlice';

// The data API of the module: narrow, id-addressed subscriptions. Containers call these and nothing else.

export const useColumnIds = () => useAppSelector((s) => s.board.columns.ids);
export const useColumnTitle = (id: string) => useAppSelector((s) => s.board.columns.byId[id]?.title ?? '');

/** ids of tasks in a column that match the filter; memoized per component instance so the array is stable */
const makeSelectVisibleTaskIds = () =>
  createSelector(
    [
      (s: RootState) => s.board.tasks.byId,
      (s: RootState, columnId: string) => s.board.columns.byId[columnId]?.taskIds ?? [],
      (s: RootState) => s.board.filter,
    ],
    (tasks, ids, filter) => {
      const f = filter.trim().toLowerCase();
      return f ? ids.filter((id) => tasks[id]?.title.toLowerCase().includes(f)) : ids;
    },
  );
export const useVisibleTaskIds = (columnId: string) => {
  const select = useMemo(makeSelectVisibleTaskIds, []);
  return useAppSelector((s) => select(s, columnId));
};

export const useTaskTitle = (id: string) => useAppSelector((s) => s.board.tasks.byId[id]?.title ?? '');
export const useTaskDone = (id: string) => useAppSelector((s) => s.board.tasks.byId[id]?.done ?? false);
export const useTaskAssigneeId = (id: string) => useAppSelector((s) => s.board.tasks.byId[id]?.assigneeId ?? '');
export const useUser = (id: string): User | undefined => useAppSelector((s) => s.board.users.byId[id]);

export const useFilter = () => useAppSelector((s) => s.board.filter);
export const useSelectedTaskId = () => useAppSelector((s) => s.board.selectedTaskId);
export const useIsTaskSelected = (id: string) => useAppSelector((s) => s.board.selectedTaskId === id);

const selectStats = createSelector([(s: RootState) => s.board.tasks], (tasks) => ({
  total: tasks.ids.length,
  done: tasks.ids.filter((id) => tasks.byId[id]?.done).length,
}));
export const useStats = () => useAppSelector(selectStats);

export const useSetFilter = () => {
  const dispatch = useAppDispatch();
  return useCallback((text: string) => dispatch(setFilter(text)), [dispatch]);
};
export const useSelectTask = () => {
  const dispatch = useAppDispatch();
  return useCallback((id: string) => dispatch(selectTask(id)), [dispatch]);
};
export const useToggleDone = () => {
  const dispatch = useAppDispatch();
  return useCallback((id: string) => dispatch(toggleDone(id)), [dispatch]);
};
