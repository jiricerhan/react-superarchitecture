import type { ReactNode } from 'react';

interface Props {
  title: string;
  count: number;
  children: ReactNode;
}

export function Column({ title, count, children }: Props) {
  return (
    <div className="column">
      <h2 className="column__title">{title} <span className="column__count">{count}</span></h2>
      <div className="column__cards">{children}</div>
    </div>
  );
}
