import { useStats } from '../store/hooks';
import { Stats } from './Stats';

export function StatsContainer() {
  const { done, total } = useStats();
  return <Stats done={done} total={total} />;
}
