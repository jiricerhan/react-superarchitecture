import { useFilter, useSetFilter } from '../store/hooks';
import { Filter } from './Filter';

/** The keystroke-hot subscription lives in a leaf. */
export function FilterContainer() {
  const value = useFilter();
  const setFilter = useSetFilter();
  return <Filter value={value} onChange={setFilter} />;
}
