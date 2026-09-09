import type { ReactNode } from 'react';

interface Props {
  title: string;
  selected: boolean;
  onSelect: () => void;
  /** semantic slots from the container; the view decides where they go in its markup */
  assignee: ReactNode;
  actions: ReactNode;
}

/** The task view: its own markup, the domain slots (assignee, actions) placed where the view wants them. */
export function Task({ title, selected, onSelect, assignee, actions }: Props) {
  return (
    <div className={selected ? 'card is-selected' : 'card'} onClick={onSelect}>
      <div className="card__head">
        <h3 className="card__title">{title}</h3>
        <div className="card__footer">{actions}</div>
      </div>
      <div className="card__body">{assignee}</div>
    </div>
  );
}
