import { Provider } from 'react-redux';
import { BoardContainer } from '@/modules/board';
import { store } from '@/store/store';

// composition root: the only place that knows the store and the module's public API
export function App() {
  return (
    <Provider store={store}>
      <BoardContainer />
    </Provider>
  );
}
