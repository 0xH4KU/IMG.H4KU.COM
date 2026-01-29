import { useState, useEffect } from 'react';
import { Folder, FolderPlus, ChevronRight, Home, Star } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
import { useImageMeta, TAG_COLORS, TagColor } from '../contexts/ImageMetaContext';
import styles from './FolderNav.module.css';

interface FolderNavProps {
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  refreshKey: number;
  showFavorites: boolean;
  onShowFavorites: (show: boolean) => void;
  activeTag: TagColor | null;
  onTagFilter: (tag: TagColor | null) => void;
}

export function FolderNav({
  currentFolder,
  onFolderChange,
  refreshKey,
  showFavorites,
  onShowFavorites,
  activeTag,
  onTagFilter,
}: FolderNavProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [localFolders, setLocalFolders] = useState<Set<string>>(new Set());
  const [newFolder, setNewFolder] = useState('');
  const [showInput, setShowInput] = useState(false);

  const { getFavoriteCount, getTagCount } = useImageMeta();

  useEffect(() => {
    fetchFolders();
  }, [refreshKey]);

  const fetchFolders = async () => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/folders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const remoteFolders = data.folders || [];
        setLocalFolders(prev => {
          const newLocal = new Set(prev);
          remoteFolders.forEach((f: string) => newLocal.delete(f));
          return newLocal;
        });
        setFolders(remoteFolders);
      }
    } catch {
      // Ignore errors
    }
  };

  const handleAddFolder = () => {
    if (newFolder.trim()) {
      const folderName = newFolder.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
      if (!folders.includes(folderName) && !localFolders.has(folderName)) {
        setLocalFolders(prev => new Set(prev).add(folderName));
        onFolderChange(folderName);
      }
      setNewFolder('');
      setShowInput(false);
    }
  };

  const handleFolderClick = (folder: string) => {
    onShowFavorites(false);
    onTagFilter(null);
    onFolderChange(folder);
  };

  const handleFavoritesClick = () => {
    onShowFavorites(true);
    onTagFilter(null);
    onFolderChange('');
  };

  const handleTagClick = (tag: TagColor) => {
    if (activeTag === tag) {
      onTagFilter(null);
    } else {
      onTagFilter(tag);
      onShowFavorites(false);
      onFolderChange('');
    }
  };

  const allFolders = [...new Set([...folders, ...localFolders])].sort();
  const favCount = getFavoriteCount();

  return (
    <nav className={styles.nav}>
      <div className={styles.header}>
        <span>Folders</span>
        <button
          className={styles.addBtn}
          onClick={() => setShowInput(!showInput)}
          title="New folder"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {showInput && (
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={newFolder}
            onChange={e => setNewFolder(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddFolder()}
            placeholder="Folder name"
            className={styles.input}
            autoFocus
          />
        </div>
      )}

      <ul className={styles.list}>
        <li>
          <button
            className={`${styles.item} ${currentFolder === '' && !showFavorites && !activeTag ? styles.active : ''}`}
            onClick={() => handleFolderClick('')}
          >
            <Home size={16} />
            <span>All Images</span>
          </button>
        </li>
        <li>
          <button
            className={`${styles.item} ${showFavorites ? styles.active : ''}`}
            onClick={handleFavoritesClick}
          >
            <Star size={16} />
            <span>Favorites</span>
            {favCount > 0 && <span className={styles.badge}>{favCount}</span>}
          </button>
        </li>
        {allFolders.map(folder => (
          <li key={folder}>
            <button
              className={`${styles.item} ${currentFolder === folder && !showFavorites && !activeTag ? styles.active : ''}`}
              onClick={() => handleFolderClick(folder)}
            >
              <Folder size={16} />
              <span>{folder}</span>
              <ChevronRight size={14} className={styles.chevron} />
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>Tags</div>
        <div className={styles.tagList}>
          {TAG_COLORS.map(tag => {
            const count = getTagCount(tag);
            return (
              <button
                key={tag}
                className={`${styles.tagItem} ${activeTag === tag ? styles.active : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                <span
                  className={styles.tagDot}
                  style={{ '--tag-color': `var(--tag-${tag})` } as React.CSSProperties}
                />
                <span className={styles.tagName}>{tag}</span>
                {count > 0 && <span className={styles.tagCount}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
