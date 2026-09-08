interface Props {
  done: number;
  total: number;
}

export function StatsBody({ done, total }: Props) {
  return (
    <div className="stats">
      <b>{done}</b> / {total} done
      <div className="stats__bar"><div className="stats__fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
    </div>
  );
}
