import { useState, useEffect, useCallback, useMemo, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { Copy, Check, RefreshCw, Star, MoreHorizontal, Trash2, Download, Tags, Share2, FileText, Code, Square, CheckSquare, Pencil, Folder, RotateCcw, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useImageMeta, TagColor, TAG_COLORS } from '../contexts/ImageMetaContext';
import { TagDots } from './TagDots';
import { ImageContextMenu } from './ImageContextMenu';
import { ViewToggle, ViewMode } from './ViewToggle';
import { GroupSelector, GroupBy } from './GroupSelector';
import { ConfirmModal } from './ConfirmModal';
import { TextPromptModal } from './TextPromptModal';
import { ImageFilters } from '../types';
import { formatBytes, formatDateShort } from '../utils/format';
import { useTransientMessage } from '../hooks/useTransientMessage';
import { useConfirmDialog, usePromptDialog } from '../hooks/useDialogs';
import { useImageGridData, ImageItem } from '../hooks/useImageGridData';
import { useImageSelection } from '../hooks/useImageSelection';
import { useImageActions } from '../hooks/useImageActions';
import { useImageGroups } from '../hooks/useImageGroups';
import styles from './ImageGrid.module.css';

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

const CARD_HEIGHT = 260;
const LIST_ITEM_HEIGHT = 70;  // 48px thumb + 16px padding + 2px border + 4px gap
const GROUP_HEADER_HEIGHT = 48;

type VirtualItem =
  | { type: 'header'; label: string; count: number }
  | { type: 'row'; images: ImageItem[] };

export function ImageGrid({ folder, domain, refreshKey, onRefresh, activeTag, showFavorites, filters, onShareItems, onBulkRename, onBulkMove }: ImageGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const [tagMenu, setTagMenu] = useState<{ mode: 'add' | 'remove'; x: number; y: number } | null>(null);
  const [columns, setColumns] = useState(4);
  const [gridWidth, setGridWidth] = useState(0);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { message: copiedKey, show: showCopiedKey } = useTransientMessage(2000);
  const { message: actionError, show: showError } = useTransientMessage(2400);
  const { confirm, confirmProps } = useConfirmDialog();
  const { prompt, promptProps } = usePromptDialog();

  const { getTags, isFavorite, toggleTag, toggleFavorite, refreshMeta } = useImageMeta();
  const isTrashView = folder.toLowerCase() === 'trash';

  // Data layer
  const { processedImages, loading, loadingMore, hasMore, loadMoreRef } = useImageGridData({
    folder,
    refreshKey,
    activeTag,
    showFavorites,
    filters,
  });

  // Selection layer
  const selection = useImageSelection({
    availableKeys: useMemo(() => processedImages.map(img => img.key), [processedImages]),
  });

  // Actions layer
  const actions = useImageActions({
    domain,
    isTrashView,
    onRefresh,
    refreshMeta,
    confirm,
    prompt,
    showError,
  });

  // Grouping
  const groups = useImageGroups({ images: processedImages, groupBy });

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

  const copyLink = async (key: string) => {
    await actions.copyLink(key);
    showCopiedKey(key);
  };

  const getFolderName = (key: string) => {
    const parts = key.split('/');
    return parts.length > 1 ? parts[0] : '';
  };

  const handleContextMenu = (e: ReactMouseEvent | React.KeyboardEvent, key: string) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX : rect.left + rect.width / 2;
    const y = 'clientY' in e ? e.clientY : rect.top + rect.height / 2;
    setContextMenu({ x, y, key });
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      handleContextMenu(e, key);
    }
  };

  const openTagMenu = (mode: 'add' | 'remove', event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTagMenu({ mode, x: rect.left, y: rect.bottom + 6 });
  };

  const handleDeleteSelected = async () => {
    await actions.deleteSelected(selection.getSelectedArray());
    selection.clear();
  };

  const handleRestoreSelected = async () => {
    await actions.restoreSelected(selection.getSelectedArray());
    selection.clear();
  };

  const handleApplyBulkTag = async (tag: TagColor, mode: 'add' | 'remove') => {
    await actions.applyBulkTag(selection.getSelectedArray(), tag, mode);
  };

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

  const showFolderBadge = folder === '';

  const renderCard = (img: ImageItem) => {
    const imgTags = getTags(img.key);
    const imgFav = isFavorite(img.key);
    const folderName = showFolderBadge ? getFolderName(img.key) : '';
    const selected = selection.isSelected(img.key);

    return (
      <div
        key={img.key}
        className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
        onContextMenu={e => handleContextMenu(e, img.key)}
        onKeyDown={e => handleKeyDown(e, img.key)}
        tabIndex={0}
      >
        <div className={styles.imageWrapper}>
          {imgFav && <Star size={14} className={styles.favStar} fill="currentColor" />}
          <button
            className={`${styles.selectBtn} ${selected ? styles.selected : ''}`}
            onClick={(e) => { e.stopPropagation(); selection.toggle(img.key); }}
            title={selected ? 'Unselect' : 'Select'}
          >
            {selected ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
          <img
            src={actions.getThumbnailUrl(img.key)}
            alt={img.key}
            className={styles.image}
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).src = actions.getImageUrl(img.key); }}
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
    const selected = selection.isSelected(img.key);

    return (
      <div
        key={img.key}
        className={`${styles.listItem} ${selected ? styles.listSelected : ''}`}
        onContextMenu={e => handleContextMenu(e, img.key)}
        onKeyDown={e => handleKeyDown(e, img.key)}
        tabIndex={0}
      >
        <button
          className={`${styles.selectBtn} ${styles.listSelect} ${selected ? styles.selected : ''}`}
          onClick={(e) => { e.stopPropagation(); selection.toggle(img.key); }}
          title={selected ? 'Unselect' : 'Select'}
        >
          {selected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <div className={styles.listThumb}>
          <img
            src={actions.getThumbnailUrl(img.key)}
            alt={img.key}
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).src = actions.getImageUrl(img.key); }}
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
    <div className={`${styles.container} ${selection.selectedCount > 0 ? styles.selectionMode : ''}`}>
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

      {selection.selectedCount > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkInfo}>
            <button className={styles.bulkBtn} onClick={selection.allSelected ? selection.clear : selection.selectAll}>
              {selection.allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {selection.allSelected ? 'All selected' : 'Select all'}
            </button>
            <span className={styles.bulkCount}>{selection.selectedCount} selected</span>
            <button className={styles.bulkLink} onClick={selection.clear}>
              Clear
            </button>
          </div>
          <div className={styles.bulkActions}>
            <button className={`${styles.bulkBtn} ${styles.primary}`} onClick={() => actions.downloadSelected(selection.getSelectedArray())} disabled={actions.downloading}>
              <Download size={14} />
              {actions.downloading ? 'Downloading...' : 'Download'}
            </button>
            <button className={styles.bulkBtn} onClick={() => actions.copyMarkdownSelected(selection.getSelectedArray())}>
              <FileText size={14} />
              Markdown
            </button>
            <button className={styles.bulkBtn} onClick={() => actions.copyHtmlSelected(selection.getSelectedArray())}>
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
            <button className={styles.bulkBtn} onClick={() => onBulkRename(selection.getSelectedArray())}>
              <Pencil size={14} />
              Rename
            </button>
            <button className={styles.bulkBtn} onClick={() => onBulkMove(selection.getSelectedArray())}>
              <Folder size={14} />
              Move
            </button>
            <button className={`${styles.bulkBtn} ${styles.primary}`} onClick={() => onShareItems(selection.getSelectedArray())}>
              <Share2 size={14} />
              Delivery
            </button>
            {isTrashView && (
              <button className={styles.bulkBtn} onClick={handleRestoreSelected}>
                <RotateCcw size={14} />
                Restore
              </button>
            )}
            <button className={`${styles.bulkBtn} ${styles.danger}`} onClick={handleDeleteSelected}>
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
          onCopyMarkdown={() => actions.copyMarkdown(contextMenu.key)}
          onCopyHtml={() => actions.copyHtml(contextMenu.key)}
          onOpenInNewTab={() => window.open(actions.getImageUrl(contextMenu.key), '_blank')}
          onDelete={() => actions.deleteImage(contextMenu.key)}
          onRestore={isTrashView ? () => actions.restoreImage(contextMenu.key) : undefined}
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
              onClick={() => { handleApplyBulkTag(tag, tagMenu.mode); setTagMenu(null); }}
              title={`${tagMenu.mode === 'add' ? 'Add' : 'Remove'} ${tag}`}
            />
          ))}
        </div>
      )}

      <ConfirmModal {...confirmProps} />
      <TextPromptModal {...promptProps} />
    </div>
  );
}

export type { ImageItem };
