type SegmentedProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </label>
  );
}

type ToggleProps = { label: string; checked: boolean; onChange: (checked: boolean) => void };

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
  );
}
