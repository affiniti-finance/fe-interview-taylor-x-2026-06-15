import type { SelectOption } from '../hooks/useTransactions';

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
}

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: FilterSelectProps<T>) {
  return (
    <label className="filter-select">
      <span className="filter-select-label">{label}</span>
      <select
        className="filter-select-input"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
