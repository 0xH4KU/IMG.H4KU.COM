import styles from './GroupSelector.module.css';

export type GroupBy = 'none' | 'type' | 'date' | 'tag';

interface GroupSelectorProps {
  value: GroupBy;
  onChange: (groupBy: GroupBy) => void;
}

const OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'type', label: 'File type' },
  { value: 'date', label: 'Date' },
  { value: 'tag', label: 'Tag' },
];

export function GroupSelector({ value, onChange }: GroupSelectorProps) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={e => onChange(e.target.value as GroupBy)}
    >
      {OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
