interface Props {
  done: boolean;
  onToggle: () => void;
}

export function TaskActions({ done, onToggle }: Props) {
  return (
    <button type="button" className={done ? 'actions is-done' : 'actions'} onClick={onToggle} title="toggle done">
      {done ? '✓' : '○'}
    </button>
  );
}
