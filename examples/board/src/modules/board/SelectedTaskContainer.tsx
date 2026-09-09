import { useSelectedTaskId, useTaskTitle } from './hooks';
import { SelectedTask } from './SelectedTask';
import { AssigneeContainer } from './AssigneeContainer';

/** AssigneeContainer again: the leaf container is the unit of reuse for data, Card is the unit of reuse for markup. */
export function SelectedTaskContainer() {
  const id = useSelectedTaskId();
  const title = useTaskTitle(id ?? '');
  const assignee = id ? <AssigneeContainer taskId={id} /> : null;
  return <SelectedTask title={id ? `Selected: ${title}` : 'Nothing selected'} assignee={assignee} />;
}
