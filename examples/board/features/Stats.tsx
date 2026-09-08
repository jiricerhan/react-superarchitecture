import { Card } from './Card';
import { StatsBody } from './StatsBody';

interface Props {
  done: number;
  total: number;
}

export function Stats({ done, total }: Props) {
  return (
    <Card title="Stats">
      <StatsBody done={done} total={total} />
    </Card>
  );
}
