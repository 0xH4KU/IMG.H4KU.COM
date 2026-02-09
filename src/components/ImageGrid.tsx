import { useState, useEffect, useCallback, useMemo, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { Copy, Check, RefreshCw, Star, MoreHorizontal, Trash2, Download, Tags, Share2, FileText, Code, Square, CheckSquare, Pencil, Folder, RotateCcw, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useImageMeta, TagColor, TAG_COLORS } from '../contexts/ImageMetaContext';
import { TagDots } from './TagDots';
import { ImageContextMenu } from './ImageContextMenu';
import { ViewToggle, ViewMode } from './ViewToggle';
import { GroupSelector, GroupBy } from './GroupSelector';
import { ImageFilters } from '../types';
import { downloadZip } from '../utils/zip';
import { apiRequest, ApiError } from '../utils/api';
import { DELIVERY_HOSTS, shouldUseFileProxy } from '../utils/url';
import { formatBytes, formatDateShort } from '../utils/format';
import { useTransientMessage } from '../hooks/useTransientMessage';
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

const useFileProxy = shouldUseFileProxy(window.location.hostname);

const PAGE_SIZE = 50;
const CARD_HEIGHT = 260;
const LIST_ITEM_HEIGHT = 64;
const GROUP_HEADER_HEIGHT = 48;

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

type VirtualItem =
  | { type: 'header'; label: string; count: number }
  | { type: 'row'; images: ImageItem[] };

export function ImageGrid({ folder, domain, refreshKey, onRefresh, activeTag, showFavorites, filters, onShareItems, onBulkRename, onBulkMove }: ImageGridProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [tagMenu, setTagMenu] = useState<{ mode: 'add' | 'remove'; x: number; y: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [columns, setColumns] = useState(4);
  const [gridWidth, setGridWidth] = useState(0);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { message: actionError, show: showError } = useTransientMessage(2400);
  const { message: copiedKey, show: showCopiedKey } = useTransientMessage(2000);

  const { getTags, isFavorite, toggleTag, toggleFavorite, refreshMeta } = useImageMeta();
  const isTrashView = folder.toLowerCase() === 'trash';

  // Fetch images with pagination
  const fetchImages = useCallback(async (append = false) => {
    if (append && (!hasMore || loadingMore)) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setImages([]);
      setCursor(null);
      setHasMore(true);
    }

    const params = new URLSearchParams();
    if (folder) params.set('folder', folder);
    params.set('limit', String(PAGE_SIZE));
    if (append && cursor) params.set('cursor', cursor);

    try {
      const data = await apiRequest<{ images?: ImageItem[]; cursor?: string | null; hasMore?: boolean }>(`/api/images?${params}`);
      if (append) {
        setImages(prev => [...prev, ...(data.images || [])]);
      } else {
        setImages(data.images || []);
      }
      setCursor(data.cursor || null);
      setHasMore(data.hasMore ?? false);
    } catch (error) {
      if (!append) {
        showError(error instanceof ApiError ? error.message : 'Failed to load images');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [folder, cursor, hasMore, loadingMore]);

  // Initial fetch and refresh
  useEffect(() => {
    fetchImages(false);
  }, [folder, refreshKey]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchImages(true);
        }
      },
      { rootMargin: '400px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchImages]);

  // Tag menu click outside handler
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

  // Calculate columns for grid view
  useEffect(() => {
    const updateColumns = () => {
      if (scrollRef.current) {
        const width = scrollRef.current.offsetWidth;
        setGridWidth(width);
        setColumns(Math.max(2, Math.floor(width / 192)));
      }
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const getGridRowHeight = useCallback(() => {
    if (!gridWidth || columns <= 0) return CARD_HEIGHT;
    const gap = 12;
    const cellWidth = Math.max(160, (gridWidth - gap * (columns - 1)) / columns);
    const cardMetaHeight = 96;
    return Math.round(cellWidth + cardMetaHeight);
  }, [columns, gridWidth]);

  const getImageUrl = (key: string) =>
    useFileProxy ? `/api/file?key=${encodeURIComponent(key)}` : `${DELIVERY_HOSTS[domain]}/${key}`;

  const getThumbnailUrl = (key: string) => {
    const thumbKey = `.thumbs/${key}`;
    return useFileProxy ? `/api/file?key=${encodeURIComponent(thumbKey)}` : `${DELIVERY_HOSTS[domain]}/${thumbKey}`;
  };

  const getCopyUrl = (key: string) => `${DELIVERY_HOSTS[domain]}/${key}`;

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
    showCopiedKey(key);
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
    const message = isTrashView ? 'Delete this image permanently?' : 'Move this image to trash?';
    if (!confirm(message)) return;
    try {
      await apiRequest(`/api/images?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(error instanceof ApiError ? error.message : 'Failed to delete image');
    }
  };

  const restoreImage = async (key: string) => {
    if (!confirm('Restore this image to its original folder?')) return;
    try {
      await apiRequest('/api/images', {
        method: 'POST',
        body: { key },
      });
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(error instanceof ApiError ? error.message : 'Failed to restore image');
    }
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
    const message = isTrashView
      ? `Delete ${selectedKeys.size} selected image(s) permanently?`
      : `Move ${selectedKeys.size} selected image(s) to trash?`;
    if (!confirm(message)) return;
    try {
      await apiRequest('/api/images/batch', {
        method: 'POST',
        body: { keys: Array.from(selectedKeys) },
      });
      clearSelection();
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(error instanceof ApiError ? error.message : 'Failed to delete selected images');
    }
  };

  const restoreSelected = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`Restore ${selectedKeys.size} selected image(s) to their original folders?`)) return;
    try {
      await apiRequest('/api/images/batch', {
        method: 'POST',
        body: { keys: Array.from(selectedKeys), action: 'restore' },
      });
      clearSelection();
      onRefresh();
      refreshMeta();
    } catch (error) {
      showError(error instanceof ApiError ? error.message : 'Failed to restore selected images');
    }
  };

  const applyBulkTag = async (tag: TagColor, mode: 'add' | 'remove') => {
    try {
      await apiRequest('/api/metadata/batch', {
        method: 'POST',
        body: {
          keys: Array.from(selectedKeys),
          addTags: mode === 'add' ? [tag] : [],
          removeTags: mode === 'remove' ? [tag] : [],
        },
      });
      refreshMeta();
    } catch (error) {
      showError(error instanceof ApiError ? error.message : 'Failed to update tags');
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
        onProgress: (_finished, _total) => {
          // reserved for future UI progress indicator
        },
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

    if (activeTag) {
      filtered = filtered.filter(img => getTags(img.key).includes(activeTag));
    }

    if (showFavorites) {
      filtered = filtered.filter(img => isFavorite(img.key));
    }

    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(img => (img.key.split('/').pop() || '').toLowerCase().includes(query));
    }

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

    const minMb = filters.sizeMin ? Number(filters.sizeMin) : null;
    const maxMb = filters.sizeMax ? Number(filters.sizeMax) : null;
    if (Number.isFinite(minMb) && minMb !== null) {
      filtered = filtered.filter(img => img.size >= minMb * 1024 * 1024);
    }
    if (Number.isFinite(maxMb) && maxMb !== null) {
      filtered = filtered.filter(img => img.size <= maxMb * 1024 * 1024);
    }

    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
    if (from) {
      filtered = filtered.filter(img => new Date(img.uploaded).getTime() >= from);
    }
    if (to) {
      filtered = filtered.filter(img => new Date(img.uploaded).getTime() <= to);
    }

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

    const entries = Array.from(map.entries());
    if (groupBy === 'date') {
      entries.sort((a, b) => (DATE_ORDER[a[0]] ?? 99) - (DATE_ORDER[b[0]] ?? 99));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    return entries.map(([label, images]) => ({ label, images }));
  }, [processedImages, groupBy, getTags]);

  // Build flattened virtual items
  const virtualItems = useMemo((): VirtualItem[] => {
    const items: VirtualItem[] = [];
    for (const group of groups) {
      if (group.label) {
        items.push({ type: 'header', label: group.label, count: group.images.length });
      }
      if (viewMode === 'grid') {
        for (let i = 0; i < group.images.length; i += columns) {
          items.push({ type: 'row', images: group.images.slice(i, i + columns) });
        }
      } else {
        for (const img of group.images) {
          items.push({ type: 'row', images: [img] });
        }
      }
    }
    return items;
  }, [groups, viewMode, columns]);

  // Virtual list
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = virtualItems[index];
      if (item.type === 'header') return GROUP_HEADER_HEIGHT;
      return viewMode === 'grid' ? getGridRowHeight() : LIST_ITEM_HEIGHT;
    },
    overscan: 5,
  });

  // Clean up selection when images change
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
            src={getThumbnailUrl(img.key)}
            alt={img.key}
            className={styles.image}
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).src = getImageUrl(img.key); }}
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
            <span className={styles.size}>{formatBytes(img.size)}</span>
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
          <img
            src={getThumbnailUrl(img.key)}
            alt={img.key}
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).src = getImageUrl(img.key); }}
          />
        </div>
        <div className={styles.listInfo}>
          <div className={styles.listName}>
            {imgFav && <Star size={12} className={styles.favStarInline} fill="currentColor" />}
            <span title={img.key}>{img.key.split('/').pop()}</span>
          </div>
          <div className={styles.listMeta}>
            <TagDots tags={imgTags} />
            {folderName && <span className={styles.folderBadge}>{folderName}</span>}
            <span>{formatBytes(img.size)}</span>
            <span>{formatDateShort(img.uploaded)}</span>
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
        ? (isTrashView ? 'Trash is empty.' : 'No images in this folder yet.')
        : 'No images yet. Drop files above to upload.';

  return (
    <div className={`${styles.container} ${selectedCount > 0 ? styles.selectionMode : ''}`}>
      <div className={styles.header}>
        <span className={styles.count}>
          {processedImages.length} image{processedImages.length !== 1 ? 's' : ''}
          {hasMore && ' +'}
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
            {isTrashView && (
              <button className={styles.bulkBtn} onClick={restoreSelected}>
                <RotateCcw size={14} />
                Restore
              </button>
            )}
            <button className={`${styles.bulkBtn} ${styles.danger}`} onClick={deleteSelected}>
              <Trash2 size={14} />
              {isTrashView ? 'Delete forever' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {processedImages.length === 0 && !loading && (
        <div className={styles.empty}>
          <p>{emptyMessage}</p>
        </div>
      )}

      {actionError && (
        <div className={styles.inlineError}>{actionError}</div>
      )}

      <div ref={scrollRef} className={styles.scrollArea}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = virtualItems[virtualRow.index];

            if (item.type === 'header') {
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className={styles.groupHeader}>
                    <span>{item.label}</span>
                    <span className={styles.groupCount}>{item.count}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {viewMode === 'grid' ? (
                  <div
                    className={styles.grid}
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  >
                    {item.images.map(renderCard)}
                  </div>
                ) : (
                  <div className={styles.list}>
                    {item.images.map(renderListItem)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Load more trigger */}
        <div ref={loadMoreRef} className={styles.loadMore}>
          {loadingMore && (
            <div className={styles.loadingIndicator}>
              <Loader2 size={20} className={styles.spinning} />
              <span>Loading more...</span>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <ImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          imageKey={contextMenu.key}
          isFavorite={isFavorite(contextMenu.key)}
          tags={getTags(contextMenu.key)}
          isTrashView={isTrashView}
          onClose={() => setContextMenu(null)}
          onToggleFavorite={() => toggleFavorite(contextMenu.key)}
          onToggleTag={(tag) => toggleTag(contextMenu.key, tag)}
          onCopyLink={() => copyLink(contextMenu.key)}
          onCopyMarkdown={() => copyMarkdown(contextMenu.key)}
          onCopyHtml={() => copyHtml(contextMenu.key)}
          onOpenInNewTab={() => window.open(getImageUrl(contextMenu.key), '_blank')}
          onDelete={() => deleteImage(contextMenu.key)}
          onRestore={isTrashView ? () => restoreImage(contextMenu.key) : undefined}
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
