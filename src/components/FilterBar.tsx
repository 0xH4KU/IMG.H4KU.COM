import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ImageFilters } from '../types';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  value: ImageFilters;
  onChange: (next: ImageFilters) => void;
}

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'jpg', label: 'JPG/JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'gif', label: 'GIF' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'svg', label: 'SVG' },
  { value: 'other', label: 'Other' },
];

export function FilterBar({ value, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  const isActive = useMemo(() => {
    return Boolean(
      value.query ||
      value.type ||
      value.sizeMin ||
      value.sizeMax ||
      value.dateFrom ||
      value.dateTo
    );
  }, [value]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (value.query.trim()) count += 1;
    if (value.type) count += 1;
    if (value.sizeMin || value.sizeMax) count += 1;
    if (value.dateFrom || value.dateTo) count += 1;
    return count;
  }, [value]);

  const update = (patch: Partial<ImageFilters>) => {
    onChange({ ...value, ...patch });
  };

  const clearAll = () => {
    onChange({
      query: '',
      type: '',
      sizeMin: '',
      sizeMax: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchRow}>
        <div className={styles.searchInput}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search filename..."
            value={value.query}
            onChange={e => update({ query: e.target.value })}
          />
          {value.query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => update({ query: '' })}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={`${styles.filterBtn} ${open ? styles.active : ''}`}
          onClick={() => setOpen(v => !v)}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeCount > 0 && (
            <span className={styles.filterCount}>{activeCount}</span>
          )}
        </button>

        {isActive && (
          <button type="button" className={styles.resetBtn} onClick={clearAll}>
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className={styles.panel}>
          <label className={styles.field}>
            <span>Type</span>
            <select
              value={value.type}
              onChange={e => update({ type: e.target.value })}
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Size (MB)</span>
            <div className={styles.rangeInputs}>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Min"
                value={value.sizeMin}
                onChange={e => update({ sizeMin: e.target.value })}
              />
              <span className={styles.rangeDivider}>-</span>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Max"
                value={value.sizeMax}
                onChange={e => update({ sizeMax: e.target.value })}
              />
            </div>
          </label>

          <label className={styles.field}>
            <span>Date range</span>
            <div className={styles.rangeInputs}>
              <input
                type="date"
                value={value.dateFrom}
                onChange={e => update({ dateFrom: e.target.value })}
              />
              <span className={styles.rangeDivider}>-</span>
              <input
                type="date"
                value={value.dateTo}
                onChange={e => update({ dateTo: e.target.value })}
              />
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
