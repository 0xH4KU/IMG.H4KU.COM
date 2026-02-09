import { useState, useEffect, useRef, useLayoutEffect, MouseEvent as ReactMouseEvent } from 'react';
import { Folder, FolderPlus, Home, Star, MoreHorizontal, Pencil, Merge, Trash2, Share2, Clock } from 'lucide-react';
import { useImageMeta, TAG_COLORS, TagColor } from '../contexts/ImageMetaContext';
import { ConfirmModal } from './ConfirmModal';
import { TextPromptModal } from './TextPromptModal';
import { apiRequest } from '../utils/api';
import { useTransientMessage } from '../hooks/useTransientMessage';
import { useConfirmDialog, usePromptDialog } from '../hooks/useDialogs';
import { getErrorMessage } from '../utils/errors';
import { useApiAction } from '../hooks/useApiAction';
import styles from './FolderNav.module.css';

interface FoldersResponse {
  folders?: string[];
  stats?: Record<string, { count: number; size: number }>;
  total?: { count: number; size: number } | null;
}

interface FolderNavProps {
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  refreshKey: number;
  showFavorites: boolean;
  onShowFavorites: (show: boolean) => void;
  activeTag: TagColor | null;
  onTagFilter: (tag: TagColor | null) => void;
  onShareFolder: (folder: string) => void;
}

export function FolderNav({
  currentFolder,
  onFolderChange,
  refreshKey,
  showFavorites,
  onShowFavorites,
  activeTag,
  onTagFilter,
  onShareFolder,
}: FolderNavProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [folderStats, setFolderStats] = useState<Record<string, { count: number; size: number }>>({});
  const [totalStats, setTotalStats] = useState<{ count: number; size: number } | null>(null);
  const [menu, setMenu] = useState<{ folder: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const { message: actionError, show: showActionError } = useTransientMessage(2400);
  const { run } = useApiAction();
  const { confirm, confirmProps } = useConfirmDialog();
  const { prompt, promptProps } = usePromptDialog();

  const { getFavoriteCount, getTagCount } = useImageMeta();

  useEffect(() => {
    fetchFolders();
  }, [refreshKey]);

  const fetchFolders = async () => {
    try {
      const data = await run(() => apiRequest<FoldersResponse>('/api/folders?stats=1'));
      setFolders((data.folders || []) as string[]);
      setFolderStats(data.stats || {});
      setTotalStats(data.total || null);
    } catch (error) {
      showActionError(getErrorMessage(error, 'Failed to load folders'));
    }
  };

  const handleAddFolder = async () => {
    const trimmed = newFolder.trim();
    if (!trimmed) return;
    const folderName = trimmed.replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!folders.includes(folderName)) {
      try {
        await run(() => apiRequest('/api/folders', {
          method: 'POST',
          body: { name: folderName },
        }));
        await fetchFolders();
        onFolderChange(folderName);
      } catch (error) {
        showActionError(getErrorMessage(error, 'Failed to create folder'));
      }
    }
    setNewFolder('');
    setShowInput(false);
  };

  useEffect(() => {
    if (!menu) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenu(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current || !navRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const navWidth = navRef.current.clientWidth;
    const navHeight = navRef.current.clientHeight;
    const padding = 8;
    let nextX = menu.x;
    let nextY = menu.y;

    const maxX = navWidth - rect.width - padding;
    const maxY = navHeight - rect.height - padding;

    if (nextX < padding) nextX = padding;
    if (nextX > maxX) nextX = Math.max(padding, maxX);
    if (nextY < padding) nextY = padding;
    if (nextY > maxY) nextY = Math.max(padding, maxY);

    if (nextX !== menu.x || nextY !== menu.y) {
      setMenu({ ...menu, x: nextX, y: nextY });
    }
  }, [menu]);

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

  const allFolders = [...new Set(folders)].sort();
  const systemFolderKeys = ['temp', 'trash'];
  const systemFolderNames = new Set(systemFolderKeys);
  const systemFolderMap = new Map<string, string>();
  allFolders.forEach(folder => {
    const key = folder.toLowerCase();
    if (systemFolderNames.has(key)) systemFolderMap.set(key, folder);
  });
  const systemFolders = systemFolderKeys.map(key => systemFolderMap.get(key) ?? key);
  const normalFolders = allFolders.filter(folder => !systemFolderNames.has(folder.toLowerCase()));
  const favCount = getFavoriteCount();
  const totalCount = totalStats?.count || 0;
  const hasFolders = normalFolders.length > 0;
  const allActive = currentFolder === '' && !showFavorites && !activeTag;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, folder: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const navRect = navRef.current?.getBoundingClientRect();
    const baseLeft = navRect?.left ?? 0;
    const baseTop = navRect?.top ?? 0;
    setMenu({ folder, x: rect.left - baseLeft, y: rect.bottom - baseTop + 6 });
  };

  const renameFolder = async (folder: string) => {
    const next = await prompt('New folder name:', folder, { title: 'Rename Folder' });
    if (!next) return;
    const nextName = next.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!nextName || nextName === folder) return;
    try {
      await run(() => apiRequest('/api/folders', {
        method: 'PUT',
        body: { from: folder, to: nextName, mode: 'rename' },
      }));
      await fetchFolders();
      if (currentFolder === folder) onFolderChange(nextName);
    } catch (error) {
      showActionError(getErrorMessage(error, 'Failed to rename folder'));
    }
  };

  const mergeFolder = async (folder: string) => {
    const target = await prompt('Target folder name:', '', { title: 'Merge Folder' });
    if (!target) return;
    const targetName = target.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!targetName || targetName === folder) return;
    try {
      await run(() => apiRequest('/api/folders', {
        method: 'PUT',
        body: { from: folder, to: targetName, mode: 'merge' },
      }));
      await fetchFolders();
      if (currentFolder === folder) onFolderChange(targetName);
    } catch (error) {
      showActionError(getErrorMessage(error, 'Failed to merge folder'));
    }
  };

  const deleteFolder = async (folder: string) => {
    const confirmed = await confirm(`Delete folder "${folder}" and all images inside?`, { title: 'Delete Folder', danger: true });
    if (!confirmed) return;
    try {
      await run(() => apiRequest(`/api/folders?name=${encodeURIComponent(folder)}`, {
        method: 'DELETE',
      }));
      await fetchFolders();
      if (currentFolder === folder) onFolderChange('');
    } catch (error) {
      showActionError(getErrorMessage(error, 'Failed to delete folder'));
    }
  };

  return (
    <nav ref={navRef} className={styles.nav}>
      <div className={styles.groupHeader}>Library</div>
      <ul className={`${styles.list} ${styles.libraryList}`}>
        <li className={`${styles.listRow} ${allActive ? styles.rowActive : ''}`}>
          <button
            className={`${styles.item} ${allActive ? styles.active : ''}`}
            onClick={() => handleFolderClick('')}
          >
            <Home size={16} />
            <span>All Images</span>
            {totalCount > 0 && <span className={styles.badge}>{totalCount}</span>}
          </button>
        </li>
        <li className={`${styles.listRow} ${showFavorites ? styles.rowActive : ''}`}>
          <button
            className={`${styles.item} ${showFavorites ? styles.active : ''}`}
            onClick={handleFavoritesClick}
          >
            <Star size={16} />
            <span>Favorites</span>
            {favCount > 0 && <span className={styles.badge}>{favCount}</span>}
          </button>
        </li>
      </ul>

      <div className={styles.header}>
        <span>Folders</span>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowInput(!showInput)}
          title="New folder"
          aria-expanded={showInput}
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
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddFolder();
              if (e.key === 'Escape') {
                setShowInput(false);
                setNewFolder('');
              }
            }}
            placeholder="Folder name"
            className={styles.input}
            autoFocus
          />
          <button
            type="button"
            className={styles.createBtn}
            onClick={handleAddFolder}
            disabled={!newFolder.trim()}
          >
            Create
          </button>
        </div>
      )}

      <ul className={`${styles.list} ${styles.folderList}`}>
        {!hasFolders && (
          <li className={styles.emptyState}>
            <span>No folders yet</span>
            <span className={styles.emptyHint}>Click + to create one.</span>
          </li>
        )}
        {normalFolders.map(folder => {
          const isActive = currentFolder === folder && !showFavorites && !activeTag;
          const stats = folderStats[folder];
          return (
            <li
              key={folder}
              className={`${styles.folderRow} ${isActive ? styles.rowActive : ''}`}
            >
              <button
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                onClick={() => handleFolderClick(folder)}
              >
                <Folder size={16} />
                <span className={styles.folderName}>{folder}</span>
                {stats && (
                  <span
                    className={styles.folderStats}
                    title={`${stats.count} files • ${formatSize(stats.size)}`}
                  >
                    {stats.count}
                  </span>
                )}
              </button>
              <button
                className={styles.folderMenuBtn}
                onClick={(e) => openMenu(e, folder)}
                title="Folder actions"
              >
                <MoreHorizontal size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      {systemFolders.length > 0 && (
        <div className={styles.systemSection}>
          <div className={styles.sectionHeader}>System</div>
          <ul className={`${styles.list} ${styles.systemList}`}>
            {systemFolders.map(folder => {
              const isActive = currentFolder === folder && !showFavorites && !activeTag;
              const stats = folderStats[folder];
              const isTrash = folder.toLowerCase() === 'trash';
              return (
                <li
                  key={folder}
                  className={`${styles.listRow} ${isActive ? styles.rowActive : ''}`}
                >
                  <button
                    className={`${styles.item} ${isActive ? styles.active : ''}`}
                    onClick={() => handleFolderClick(folder)}
                  >
                    {isTrash ? <Trash2 size={16} /> : <Clock size={16} />}
                    <span className={styles.folderName}>{folder}</span>
                    {stats && (
                      <span
                        className={styles.folderStats}
                        title={`${stats.count} files • ${formatSize(stats.size)}`}
                      >
                        {stats.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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

      {menu && (
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ left: menu.x, top: menu.y }}
        >
          <button className={styles.menuItem} onClick={() => { onShareFolder(menu.folder); setMenu(null); }}>
            <Share2 size={14} />
            <span>Share</span>
          </button>
          <button className={styles.menuItem} onClick={() => { renameFolder(menu.folder); setMenu(null); }}>
            <Pencil size={14} />
            <span>Rename</span>
          </button>
          <button className={styles.menuItem} onClick={() => { mergeFolder(menu.folder); setMenu(null); }}>
            <Merge size={14} />
            <span>Merge</span>
          </button>
          <button className={`${styles.menuItem} ${styles.danger}`} onClick={() => { deleteFolder(menu.folder); setMenu(null); }}>
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {actionError && (
        <div className={styles.actionError}>{actionError}</div>
      )}

      <ConfirmModal {...confirmProps} />
      <TextPromptModal {...promptProps} />
    </nav>
  );
}
