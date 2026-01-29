import { Grid3x3, List } from 'lucide-react';
import styles from './ViewToggle.module.css';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className={styles.toggle}>
      <button
        className={`${styles.btn} ${mode === 'grid' ? styles.active : ''}`}
        onClick={() => onChange('grid')}
        title="Grid view"
      >
        <Grid3x3 size={16} />
      </button>
      <button
        className={`${styles.btn} ${mode === 'list' ? styles.active : ''}`}
        onClick={() => onChange('list')}
        title="List view"
      >
        <List size={16} />
      </button>
    </div>
  );
}
