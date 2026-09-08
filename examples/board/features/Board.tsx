import type { ReactNode } from 'react';

interface Props {
  variant: string;
  toolbar: ReactNode;
  columns: ReactNode;
  sidebar: ReactNode;
}

export function Board({ variant, toolbar, columns, sidebar }: Props) {
  return (
    <div className="board">
      <div className="board__toolbar">
        {toolbar}
        <span className="board__variant">{variant}</span>
      </div>
      <div className="board__columns">{columns}</div>
      <div className="board__sidebar">{sidebar}</div>
    </div>
  );
}
