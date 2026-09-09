import { memo } from 'react';
import { useTaskAssigneeId, useUser } from './hooks';
import { Assignee } from './Assignee';

interface Props {
  taskId: string;
}

/** Two hops of data (task → user) resolved here, by id, at the leaf. */
function AssigneeContainerImpl({ taskId }: Props) {
  const userId = useTaskAssigneeId(taskId);
  const user = useUser(userId);
  const name = user?.name ?? '—';
  return <Assignee name={name} initial={name.slice(0, 1)} />;
}
// React uses the inner function as the fiber type for simple memo components, so name it there too
AssigneeContainerImpl.displayName = 'AssigneeContainer';
/** memo + a stable `taskId`: a parent re-render stops here */
export const AssigneeContainer = memo(AssigneeContainerImpl);
