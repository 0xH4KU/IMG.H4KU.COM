import { useState, useEffect, useCallback, useMemo, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { Copy, Check, RefreshCw, Star, MoreHorizontal, Trash2, Download, Tags, Share2, FileText, Code, Square, CheckSquare, Pencil, Folder } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
import { useImageMeta, TagColor, TAG_COLORS } from '../contexts/ImageMetaContext';
import { TagDots } from './TagDots';
import { ImageContextMenu } from './ImageContextMenu';
import { ViewToggle, ViewMode } from './ViewToggle';
import { GroupSelector, GroupBy } from './GroupSelector';
import { ImageFilters } from '../types';
import { downloadZip } from '../utils/zip';
import styles from './ImageGrid.module.css';

interface ImageItem {
  key: string;
  size: number;
  uploaded: string;
}

interface ImageGridProps {
  folder: string;
  domain: 'h4ku' | 'lum';
  refreshKey: number;
  onRefresh: () => void;
  activeTag: TagColor | null;
  showFavorites: boolean;
  filters: ImageFilters;
  onShareItems: (items: string[]) => void;
  onBulkRename: (items: string[]) => void;
  onBulkMove: (items: string[]) => void;
}

const DOMAINS = {
  h4ku: 'https://img.h4ku.com',
  lum: 'https://img.lum.bio',
};

// Use file proxy in development or Pages preview (before R2 custom domain is configured)
const useFileProxy = window.location.hostname === 'localhost' ||
  window.location.hostname.endsWith('.pages.dev');

function getFileExt(key: string): string {
  const name = key.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function getDateGroup(uploaded: string): string {
  const date = new Date(uploaded);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'This Week';
  if (days <= 30) return 'This Month';
  return 'Older';
}

const DATE_ORDER: Record<string, number> = {
  'Today': 0, 'Yesterday': 1, 'This Week': 2, 'This Month': 3, 'Older': 4,
};

const TAG_LABEL: Record<string, string> = {
  red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green',
  blue: 'Blue', purple: 'Purple', gray: 'Gray',
};

export function ImageGrid({ folder, domain, refreshKey, onRefresh, activeTag, showFavorites, filters, onShareItems, onBulkRename, onBulkMove }: ImageGridProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [tagMenu, setTagMenu] = useState<{ mode: 'add' | 'remove'; x: number; y: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  const { getTags, isFavorite, toggleTag, toggleFavorite, refreshMeta } = useImageMeta();

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    try {
      const params = new URLSearchParams();
      if (folder) params.set('folder', folder);

      const res = await fetch(`/api/images?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages, refreshKey]);

  useEffect(() => {
    if (!tagMenu) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setTagMenu(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTagMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [tagMenu]);

  const getImageUrl = (key: string) =>
    useFileProxy ? `/api/file?key=${encodeURIComponent(key)}` : `${DOMAINS[domain]}/${key}`;

  const getCopyUrl = (key: string) => `${DOMAINS[domain]}/${key}`;

  const getAltText = (key: string) => {
    const name = key.split('/').pop() || key;
    return name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'image';
  };

  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const copyLink = async (key: string) => {
    const url = getCopyUrl(key);
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyMarkdown = async (key: string, promptAlt = true) => {
    const url = getCopyUrl(key);
    const defaultAlt = getAltText(key);
    const alt = promptAlt ? (prompt('Alt text:', defaultAlt) ?? '') : defaultAlt;
    if (promptAlt && alt === '') return;
    await navigator.clipboard.writeText(`![${alt || defaultAlt}](${url})`);
  };

  const copyHtml = async (key: string, promptAlt = true) => {
    const url = getCopyUrl(key);
    const defaultAlt = getAltText(key);
    const alt = promptAlt ? (prompt('Alt text:', defaultAlt) ?? '') : defaultAlt;
    if (promptAlt && alt === '') return;
    const safeAlt = escapeHtml(alt || defaultAlt);
    await navigator.clipboard.writeText(`<img src="${url}" alt="${safeAlt}" loading="lazy" />`);
  };

  const deleteImage = async (key: string) => {
    if (!confirm('Delete this image?')) return;
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/images?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onRefresh();
        refreshMeta();
      }
    } catch { /* ignore */ }
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const selectAll = () => {
    setSelectedKeys(new Set(processedImages.map(img => img.key)));
  };

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`Delete ${selectedKeys.size} selected image(s)?`)) return;
    const token = getAuthToken();
    try {
      const res = await fetch('/api/images/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keys: Array.from(selectedKeys) }),
      });
      if (res.ok) {
        clearSelection();
        onRefresh();
        refreshMeta();
      }
    } catch {
      // Ignore errors
    }
  };

  const applyBulkTag = async (tag: TagColor, mode: 'add' | 'remove') => {
    const token = getAuthToken();
    try {
      const res = await fetch('/api/metadata/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keys: Array.from(selectedKeys),
          addTags: mode === 'add' ? [tag] : [],
          removeTags: mode === 'remove' ? [tag] : [],
        }),
      });
      if (res.ok) {
        refreshMeta();
      }
    } catch {
      // Ignore errors
    }
  };

  const downloadSelected = async () => {
    if (selectedKeys.size === 0) return;
    setDownloading(true);
    try {
      await downloadZip({
        name: 'images',
        keys: Array.from(selectedKeys),
        getUrl: getImageUrl,
      });
    } finally {
      setDownloading(false);
    }
  };

  const copyMarkdownSelected = async () => {
    if (selectedKeys.size === 0) return;
    const lines = Array.from(selectedKeys).map(key => {
      const alt = getAltText(key);
      return `![${alt}](${getCopyUrl(key)})`;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
  };

  const copyHtmlSelected = async () => {
    if (selectedKeys.size === 0) return;
    const lines = Array.from(selectedKeys).map(key => {
      const alt = escapeHtml(getAltText(key));
      return `<img src="${getCopyUrl(key)}" alt="${alt}" loading="lazy" />`;
    });
    await navigator.clipboard.writeText(lines.join('\n'));
  };

  const openTagMenu = (mode: 'add' | 'remove', event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTagMenu({ mode, x: rect.left, y: rect.bottom + 6 });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getFolderName = (key: string) => {
    const parts = key.split('/');
    return parts.length > 1 ? parts[0] : '';
  };

  const handleContextMenu = (e: ReactMouseEvent, key: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, key });
  };

  // Filter and sort images
  const processedImages = useMemo(() => {
    let filtered = images;

    // Filter by tag
    if (activeTag) {
      filtered = filtered.filter(img => getTags(img.key).includes(activeTag));
    }

    // Filter by favorites
    if (showFavorites) {
      filtered = filtered.filter(img => isFavorite(img.key));
    }

    // Search by filename
    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(img => (img.key.split('/').pop() || '').toLowerCase().includes(query));
    }

    // Filter by type
    if (filters.type) {
      const type = filters.type;
      filtered = filtered.filter(img => {
        const ext = getFileExt(img.key);
        if (type === 'other') {
          return !['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext);
        }
        if (type === 'jpg') return ext === 'jpg' || ext === 'jpeg';
        return ext === type;
      });
    }

    // Filter by size (MB)
    const minMb = filters.sizeMin ? Number(filters.sizeMin) : null;
    const maxMb = filters.sizeMax ? Number(filters.sizeMax) : null;
    if (Number.isFinite(minMb) && minMb !== null) {
      filtered = filtered.filter(img => img.size >= minMb * 1024 * 1024);
    }
    if (Number.isFinite(maxMb) && maxMb !== null) {
      filtered = filtered.filter(img => img.size <= maxMb * 1024 * 1024);
    }

    // Filter by date range
    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
    if (from) {
      filtered = filtered.filter(img => new Date(img.uploaded).getTime() >= from);
    }
    if (to) {
      filtered = filtered.filter(img => new Date(img.uploaded).getTime() <= to);
    }

    // Sort: favorites first, then by upload date
    return [...filtered].sort((a, b) => {
      const aFav = isFavorite(a.key) ? 0 : 1;
      const bFav = isFavorite(b.key) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
    });
  }, [images, activeTag, showFavorites, getTags, isFavorite, filters]);

  // Group images
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: '', images: processedImages }];

    const map = new Map<string, ImageItem[]>();

    for (const img of processedImages) {
      let groupKey: string;

      if (groupBy === 'type') {
        groupKey = getFileExt(img.key).toUpperCase() || 'OTHER';
      } else if (groupBy === 'date') {
        groupKey = getDateGroup(img.uploaded);
      } else {
        // tag
        const tags = getTags(img.key);
        if (tags.length === 0) {
          const list = map.get('Untagged') || [];
          list.push(img);
          map.set('Untagged', list);
          continue;
        }
        for (const tag of tags) {
          const label = TAG_LABEL[tag] || tag;
          const list = map.get(label) || [];
          list.push(img);
          map.set(label, list);
        }
        continue;
      }

      const list = map.get(groupKey) || [];
      list.push(img);
      map.set(groupKey, list);
    }

    // Sort groups
    const entries = Array.from(map.entries());
    if (groupBy === 'date') {
      entries.sort((a, b) => (DATE_ORDER[a[0]] ?? 99) - (DATE_ORDER[b[0]] ?? 99));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    return entries.map(([label, images]) => ({ label, images }));
  }, [processedImages, groupBy, getTags]);

  useEffect(() => {
    if (selectedKeys.size === 0) return;
    const visibleKeys = new Set(processedImages.map(img => img.key));
    setSelectedKeys(prev => {
      const next = new Set([...prev].filter(key => visibleKeys.has(key)));
      return next;
    });
  }, [processedImages]);

  const showFolderBadge = folder === '';
  const selectedCount = selectedKeys.size;
  const allSelected = processedImages.length > 0 && processedImages.every(img => selectedKeys.has(img.key));

  const renderCard = (img: ImageItem) => {
    const imgTags = getTags(img.key);
    const imgFav = isFavorite(img.key);
    const folderName = showFolderBadge ? getFolderName(img.key) : '';
    const selected = selectedKeys.has(img.key);

    return (
      <div
        key={img.key}
        className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
        onContextMenu={e => handleContextMenu(e, img.key)}
      >
        <div className={styles.imageWrapper}>
          {imgFav && <Star size={14} className={styles.favStar} fill="currentColor" />}
          <button
            className={`${styles.selectBtn} ${selected ? styles.selected : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleSelect(img.key); }}
            title={selected ? 'Unselect' : 'Select'}
          >
            {selected ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
          <img
            src={getImageUrl(img.key)}
            alt={img.key}
            className={styles.image}
            loading="lazy"
          />
          <button
            className={styles.moreBtn}
            onClick={e => handleContextMenu(e, img.key)}
            title="More actions"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
        <div className={styles.info}>
          <span className={styles.name} title={img.key}>
            {img.key.split('/').pop()}
          </span>
          <div className={styles.meta}>
            <TagDots tags={imgTags} />
            {folderName && <span className={styles.folderBadge}>{folderName}</span>}
            <span className={styles.size}>{formatSize(img.size)}</span>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => copyLink(img.key)}
            title="Copy link"
          >
            {copiedKey === img.key ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    );
  };

  const renderListItem = (img: ImageItem) => {
    const imgTags = getTags(img.key);
    const imgFav = isFavorite(img.key);
    const folderName = showFolderBadge ? getFolderName(img.key) : '';
    const selected = selectedKeys.has(img.key);

    return (
      <div
        key={img.key}
        className={`${styles.listItem} ${selected ? styles.listSelected : ''}`}
        onContextMenu={e => handleContextMenu(e, img.key)}
      >
        <button
          className={`${styles.selectBtn} ${styles.listSelect} ${selected ? styles.selected : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleSelect(img.key); }}
          title={selected ? 'Unselect' : 'Select'}
        >
          {selected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <div className={styles.listThumb}>
          <img src={getImageUrl(img.key)} alt={img.key} loading="lazy" />
        </div>
        <div className={styles.listInfo}>
          <div className={styles.listName}>
            {imgFav && <Star size={12} className={styles.favStarInline} fill="currentColor" />}
            <span title={img.key}>{img.key.split('/').pop()}</span>
          </div>
          <div className={styles.listMeta}>
            <TagDots tags={imgTags} />
            {folderName && <span className={styles.folderBadge}>{folderName}</span>}
            <span>{formatSize(img.size)}</span>
            <span>{formatDate(img.uploaded)}</span>
          </div>
        </div>
        <div className={styles.listActions}>
          <button
            className={styles.actionBtn}
            onClick={() => copyLink(img.key)}
            title="Copy link"
          >
            {copiedKey === img.key ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            className={styles.actionBtn}
            onClick={e => handleContextMenu(e, img.key)}
            title="More actions"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    );
  };

  const emptyMessage = showFavorites
    ? 'No favorites yet. Star images to pin them here.'
    : activeTag
      ? 'No images with this tag yet.'
      : folder
        ? 'No images in this folder yet.'
        : 'No images yet. Drop files above to upload.';

  return (
    <div className={`${styles.container} ${selectedCount > 0 ? styles.selectionMode : ''}`}>
      <div className={styles.header}>
        <span className={styles.count}>
          {processedImages.length} image{processedImages.length !== 1 ? 's' : ''}
        </span>
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <span className={styles.toolbarLabel}>Group</span>
            <GroupSelector value={groupBy} onChange={setGroupBy} />
          </div>
          <div className={styles.toolbarGroup}>
            <span className={styles.toolbarLabel}>View</span>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
          <button className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spinning : ''} />
            <span className={styles.refreshLabel}>Refresh</span>
          </button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkInfo}>
            <button className={styles.bulkBtn} onClick={allSelected ? clearSelection : selectAll}>
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? 'All selected' : 'Select all'}
            </button>
            <span className={styles.bulkCount}>{selectedCount} selected</span>
            <button className={styles.bulkLink} onClick={clearSelection}>
              Clear
            </button>
          </div>
          <div className={styles.bulkActions}>
            <button className={`${styles.bulkBtn} ${styles.primary}`} onClick={downloadSelected} disabled={downloading}>
              <Download size={14} />
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <button className={styles.bulkBtn} onClick={copyMarkdownSelected}>
              <FileText size={14} />
              Markdown
            </button>
            <button className={styles.bulkBtn} onClick={copyHtmlSelected}>
              <Code size={14} />
              HTML
            </button>
            <button className={styles.bulkBtn} onClick={(e) => openTagMenu('add', e)}>
              <Tags size={14} />
              Tags +
            </button>
            <button className={styles.bulkBtn} onClick={(e) => openTagMenu('remove', e)}>
              <Tags size={14} />
              Tags -
            </button>
            <button className={styles.bulkBtn} onClick={() => onBulkRename(Array.from(selectedKeys))}>
              <Pencil size={14} />
              Rename
            </button>
            <button className={styles.bulkBtn} onClick={() => onBulkMove(Array.from(selectedKeys))}>
              <Folder size={14} />
              Move
            </button>
            <button className={`${styles.bulkBtn} ${styles.primary}`} onClick={() => onShareItems(Array.from(selectedKeys))}>
              <Share2 size={14} />
              Delivery
            </button>
            <button className={`${styles.bulkBtn} ${styles.danger}`} onClick={deleteSelected}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}

      {processedImages.length === 0 && !loading && (
        <div className={styles.empty}>
          <p>{emptyMessage}</p>
        </div>
      )}

      <div className={styles.scrollArea}>
        {groups.map(group => (
          <div key={group.label || '__all__'}>
            {group.label && (
              <div className={styles.groupHeader}>
                <span>{group.label}</span>
                <span className={styles.groupCount}>{group.images.length}</span>
              </div>
            )}
            {viewMode === 'grid' ? (
              <div className={styles.grid}>
                {group.images.map(renderCard)}
              </div>
            ) : (
              <div className={styles.list}>
                {group.images.map(renderListItem)}
              </div>
            )}
          </div>
        ))}
      </div>

      {contextMenu && (
        <ImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          imageKey={contextMenu.key}
          isFavorite={isFavorite(contextMenu.key)}
          tags={getTags(contextMenu.key)}
          onClose={() => setContextMenu(null)}
          onToggleFavorite={() => toggleFavorite(contextMenu.key)}
          onToggleTag={(tag) => toggleTag(contextMenu.key, tag)}
          onCopyLink={() => copyLink(contextMenu.key)}
          onCopyMarkdown={() => copyMarkdown(contextMenu.key)}
          onCopyHtml={() => copyHtml(contextMenu.key)}
          onOpenInNewTab={() => window.open(getImageUrl(contextMenu.key), '_blank')}
          onDelete={() => deleteImage(contextMenu.key)}
        />
      )}

      {tagMenu && (
        <div
          ref={tagMenuRef}
          className={styles.tagMenu}
          style={{ left: tagMenu.x, top: tagMenu.y }}
        >
          {TAG_COLORS.map(tag => (
            <button
              key={tag}
              className={styles.tagMenuBtn}
              style={{ '--tag-color': `var(--tag-${tag})` } as React.CSSProperties}
              onClick={() => { applyBulkTag(tag, tagMenu.mode); setTagMenu(null); }}
              title={`${tagMenu.mode === 'add' ? 'Add' : 'Remove'} ${tag}`}
            />
          ))}
        </div>
      )}

    </div>
  );
}
