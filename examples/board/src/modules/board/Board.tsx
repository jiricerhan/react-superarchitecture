import type { ReactNode } from 'react';

interface Props {
  toolbar: ReactNode;
  columns: ReactNode;
  sidebar: ReactNode;
}

/** The skeleton that remained after the cut: only slots. */
export function Board({ toolbar, columns, sidebar }: Props) {
  return (
    <div className="board">
      <div className="board__toolbar">{toolbar}</div>
      <div className="board__columns">{columns}</div>
      <div className="board__sidebar">{sidebar}</div>
    </div>
  );
}
