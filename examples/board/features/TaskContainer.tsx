import { memo, useCallback } from 'react';
import { useIsTaskSelected, useSelectTask, useTaskTitle } from '@/board/store/hooks';
import { Task } from './Task';
import { AssigneeContainer } from './AssigneeContainer';
import { TaskActionsContainer } from './TaskActionsContainer';

interface Props {
  id: string;
}

/** Data and behaviour for one task. Composes the leaf containers into semantic slots; the view lays them out. */
function TaskContainerImpl({ id }: Props) {
  const title = useTaskTitle(id);
  const selected = useIsTaskSelected(id);
  const selectTask = useSelectTask();
  const onSelect = useCallback(() => selectTask(id), [selectTask, id]);
  const assignee = <AssigneeContainer taskId={id} />;
  const actions = <TaskActionsContainer taskId={id} />;
  return <Task title={title} selected={selected} onSelect={onSelect} assignee={assignee} actions={actions} />;
}

// React uses the inner function as the fiber type for simple memo components, so name it there too
TaskContainerImpl.displayName = 'TaskContainer';
export const TaskContainer = memo(TaskContainerImpl);
TaskContainer.displayName = 'TaskContainer';
