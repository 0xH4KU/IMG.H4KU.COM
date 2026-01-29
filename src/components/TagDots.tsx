import { TagColor } from '../contexts/ImageMetaContext';
import styles from './TagDots.module.css';

interface TagDotsProps {
  tags: TagColor[];
  maxVisible?: number;
}

export function TagDots({ tags, maxVisible = 3 }: TagDotsProps) {
  if (tags.length === 0) return null;

  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - maxVisible;

  return (
    <div className={styles.dots}>
      {visible.map(tag => (
        <span
          key={tag}
          className={styles.dot}
          style={{ '--tag-color': `var(--tag-${tag})` } as React.CSSProperties}
          title={tag}
        />
      ))}
      {overflow > 0 && (
        <span className={styles.overflow}>+{overflow}</span>
      )}
    </div>
  );
}
