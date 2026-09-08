import { memo } from 'react';
import { useColumnTitle, useVisibleTaskIds } from '@/board/store/hooks';
import { Column } from './Column';
import { TaskContainer } from './TaskContainer';

interface Props {
  id: string;
}

/** Subscribes to the column title and the filtered task ids only; each task fetches itself by id. */
function ColumnContainerImpl({ id }: Props) {
  const title = useColumnTitle(id);
  const taskIds = useVisibleTaskIds(id);
  const cards = taskIds.map((taskId) => <TaskContainer key={taskId} id={taskId} />);
  return <Column title={title} count={taskIds.length}>{cards}</Column>;
}

// React uses the inner function as the fiber type for simple memo components, so name it there too
ColumnContainerImpl.displayName = 'ColumnContainer';
export const ColumnContainer = memo(ColumnContainerImpl);
ColumnContainer.displayName = 'ColumnContainer';
