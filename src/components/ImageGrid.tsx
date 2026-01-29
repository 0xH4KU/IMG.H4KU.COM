import { useState, useEffect, useCallback, useMemo, MouseEvent } from 'react';
import { Copy, Check, RefreshCw, Star, MoreHorizontal } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
import { useImageMeta, TagColor } from '../contexts/ImageMetaContext';
import { TagDots } from './TagDots';
import { ImageContextMenu } from './ImageContextMenu';
import { ViewToggle, ViewMode } from './ViewToggle';
import { GroupSelector, GroupBy } from './GroupSelector';
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

export function ImageGrid({ folder, domain, refreshKey, onRefresh, activeTag, showFavorites }: ImageGridProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);

  const { getTags, isFavorite, toggleTag, toggleFavorite } = useImageMeta();

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

  const getImageUrl = (key: string) =>
    useFileProxy ? `/api/file?key=${encodeURIComponent(key)}` : `${DOMAINS[domain]}/${key}`;

  const getCopyUrl = (key: string) => `${DOMAINS[domain]}/${key}`;

  const copyLink = async (key: string) => {
    const url = getCopyUrl(key);
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const deleteImage = async (key: string) => {
    if (!confirm('Delete this image?')) return;
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/images?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onRefresh();
    } catch { /* ignore */ }
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

  const handleContextMenu = (e: MouseEvent, key: string) => {
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

    // Sort: favorites first, then by upload date
    return [...filtered].sort((a, b) => {
      const aFav = isFavorite(a.key) ? 0 : 1;
      const bFav = isFavorite(b.key) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
    });
  }, [images, activeTag, showFavorites, getTags, isFavorite]);

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

  const showFolderBadge = folder === '';

  const renderCard = (img: ImageItem) => {
    const imgTags = getTags(img.key);
    const imgFav = isFavorite(img.key);
    const folderName = showFolderBadge ? getFolderName(img.key) : '';

    return (
      <div
        key={img.key}
        className={styles.card}
        onContextMenu={e => handleContextMenu(e, img.key)}
      >
        <div className={styles.imageWrapper}>
          {imgFav && <Star size={14} className={styles.favStar} fill="currentColor" />}
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

    return (
      <div
        key={img.key}
        className={styles.listItem}
        onContextMenu={e => handleContextMenu(e, img.key)}
      >
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.count}>
          {processedImages.length} image{processedImages.length !== 1 ? 's' : ''}
        </span>
        <div className={styles.toolbar}>
          <GroupSelector value={groupBy} onChange={setGroupBy} />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <button className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spinning : ''} />
          </button>
        </div>
      </div>

      {processedImages.length === 0 && !loading && (
        <div className={styles.empty}>
          <p>{showFavorites ? 'No favorites yet' : activeTag ? 'No images with this tag' : 'No images in this folder'}</p>
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
          onOpenInNewTab={() => window.open(getImageUrl(contextMenu.key), '_blank')}
          onDelete={() => deleteImage(contextMenu.key)}
        />
      )}
    </div>
  );
}
