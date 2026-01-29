import { useEffect, useRef, useCallback } from 'react';
import { Star, StarOff, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { TAG_COLORS, TagColor } from '../contexts/ImageMetaContext';
import styles from './ImageContextMenu.module.css';

interface ImageContextMenuProps {
  x: number;
  y: number;
  imageKey: string;
  isFavorite: boolean;
  tags: TagColor[];
  onClose: () => void;
  onToggleFavorite: () => void;
  onToggleTag: (tag: TagColor) => void;
  onCopyLink: () => void;
  onOpenInNewTab: () => void;
  onDelete: () => void;
}

export function ImageContextMenu({
  x,
  y,
  isFavorite,
  tags,
  onClose,
  onToggleFavorite,
  onToggleTag,
  onCopyLink,
  onOpenInNewTab,
  onDelete,
}: ImageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position if menu goes off screen
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menu = menuRef.current;

    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [x, y]);

  // Close on click outside or ESC
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleAction = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      <button
        className={styles.item}
        onClick={() => handleAction(onToggleFavorite)}
      >
        {isFavorite ? (
          <>
            <StarOff size={16} />
            <span>Remove from Favorites</span>
          </>
        ) : (
          <>
            <Star size={16} />
            <span>Add to Favorites</span>
          </>
        )}
      </button>

      <div className={styles.tagRow}>
        <span className={styles.tagLabel}>Tags</span>
        <div className={styles.tagDots}>
          {TAG_COLORS.map(color => (
            <button
              key={color}
              className={`${styles.tagDot} ${tags.includes(color) ? styles.selected : ''}`}
              style={{ '--tag-color': `var(--tag-${color})` } as React.CSSProperties}
              onClick={() => onToggleTag(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <button
        className={styles.item}
        onClick={() => handleAction(onCopyLink)}
      >
        <Copy size={16} />
        <span>Copy Link</span>
      </button>

      <button
        className={styles.item}
        onClick={() => handleAction(onOpenInNewTab)}
      >
        <ExternalLink size={16} />
        <span>Open in New Tab</span>
      </button>

      <div className={styles.divider} />

      <button
        className={`${styles.item} ${styles.danger}`}
        onClick={() => handleAction(onDelete)}
      >
        <Trash2 size={16} />
        <span>Delete</span>
      </button>
    </div>
  );
}
