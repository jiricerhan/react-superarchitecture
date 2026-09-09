import { Card } from '@/components/Card/Card';

interface Props {
  done: number;
  total: number;
}

export function Stats({ done, total }: Props) {
  return (
    <Card title="Stats">
      <div className="stats">
        <b>{done}</b> / {total} done
        <div className="stats__bar"><div className="stats__fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      </div>
    </Card>
  );
}
