import { memo, useCallback } from 'react';
import { useTaskDone, useToggleDone } from '@/board/store/hooks';
import { Actions } from './Actions';

interface Props {
  taskId: string;
}

function TaskActionsContainerImpl({ taskId }: Props) {
  const done = useTaskDone(taskId);
  const toggleDone = useToggleDone();
  const onToggle = useCallback(() => toggleDone(taskId), [toggleDone, taskId]);
  return <Actions done={done} onToggle={onToggle} />;
}
// React uses the inner function as the fiber type for simple memo components, so name it there too
TaskActionsContainerImpl.displayName = 'TaskActionsContainer';
/** memo + a stable `taskId`: a parent re-render stops here */
export const TaskActionsContainer = memo(TaskActionsContainerImpl);
