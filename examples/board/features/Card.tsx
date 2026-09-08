import type { ReactNode } from 'react';

interface Props {
  title: string;
  footer?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}

/** Shared markup, on the level of a Button: knows layout (head, footer, body), knows nothing about tasks or stats. */
export function Card({ title, footer, selected, onSelect, children }: Props) {
  return (
    <div className={selected ? 'card is-selected' : 'card'} onClick={onSelect}>
      <div className="card__head">
        <h3 className="card__title">{title}</h3>
        {footer && <div className="card__footer">{footer}</div>}
      </div>
      {children && <div className="card__body">{children}</div>}
    </div>
  );
}
