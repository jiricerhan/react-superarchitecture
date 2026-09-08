interface Props {
  name: string;
  initial: string;
}

export function Assignee({ name, initial }: Props) {
  return (
    <span className="assignee">
      <span className="assignee__avatar">{initial}</span>
      {name}
    </span>
  );
}
