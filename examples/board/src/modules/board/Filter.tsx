interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function Filter({ value, onChange }: Props) {
  return (
    <label className="filter">
      <span>filter</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="type to filter tasks…" />
    </label>
  );
}
