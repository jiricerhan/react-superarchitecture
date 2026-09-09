import { useColumnIds } from './hooks';
import { Board } from './Board';
import { FilterContainer } from './FilterContainer';
import { ColumnContainer } from './ColumnContainer';
import { StatsContainer } from './StatsContainer';
import { SelectedTaskContainer } from './SelectedTaskContainer';

/** Composition root: ids in, containers into slots. No data objects travel through here. */
export function BoardContainer() {
  const columnIds = useColumnIds();
  const toolbar = <FilterContainer />;
  const columns = columnIds.map((id) => <ColumnContainer key={id} id={id} />);
  const sidebar = (
    <>
      <StatsContainer />
      <SelectedTaskContainer />
    </>
  );
  return <Board toolbar={toolbar} columns={columns} sidebar={sidebar} />;
}
