import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { getAuthToken, useAuth } from '../contexts/AuthContext';
import { ImageMetaProvider, TagColor } from '../contexts/ImageMetaContext';
import { Header } from '../components/Header';
import { Uploader } from '../components/Uploader';
import { FilterBar } from '../components/FilterBar';
import { ImageGrid } from '../components/ImageGrid';
import { FolderNav } from '../components/FolderNav';
import { ShareModal } from '../components/ShareModal';
import { BulkRenameModal } from '../components/BulkRenameModal';
import { BulkMoveModal } from '../components/BulkMoveModal';
import { AdminToolsModal } from '../components/AdminToolsModal';
import { ShareManagerModal } from '../components/ShareManagerModal';
import { ImageFilters } from '../types';
import styles from './Admin.module.css';

export function Admin() {
  const { logout } = useAuth();
  const SIDEBAR_WIDTH_KEY = 'img_admin_sidebar_width';
  const SIDEBAR_OPEN_KEY = 'img_admin_sidebar_open';
  const SIDEBAR_DEFAULT_WIDTH = 260;
  const SIDEBAR_MIN_WIDTH = 220;
  const SIDEBAR_MAX_WIDTH = 360;

  const clampSidebarWidth = (value: number) => {
    if (Number.isNaN(value)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));
  };

  const getStoredSidebarWidth = () => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return clampSidebarWidth(Number.isFinite(parsed) ? parsed : SIDEBAR_DEFAULT_WIDTH);
  };

  const getStoredSidebarOpen = () => {
    if (typeof window === 'undefined') return true;
    if (window.innerWidth <= 768) return false;
    const raw = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return true;
  };

  const [currentFolder, setCurrentFolder] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDomain, setSelectedDomain] = useState<'h4ku' | 'lum'>('h4ku');
  const [sidebarOpen, setSidebarOpen] = useState(getStoredSidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(getStoredSidebarWidth);
  const resizeState = useRef<{ startX: number; startWidth: number } | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeTag, setActiveTag] = useState<TagColor | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareItems, setShareItems] = useState<string[]>([]);
  const [shareFolder, setShareFolder] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [bulkKeys, setBulkKeys] = useState<string[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [shareManagerOpen, setShareManagerOpen] = useState(false);
  const [filters, setFilters] = useState<ImageFilters>({
    query: '',
    type: '',
    sizeMin: '',
    sizeMax: '',
    dateFrom: '',
    dateTo: '',
  });

  const handleUploadComplete = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleFolderChange = useCallback((folder: string) => {
    setCurrentFolder(folder);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleLogoClick = useCallback(() => {
    setCurrentFolder('');
    setShowFavorites(false);
    setActiveTag(null);
  }, []);

  const openShareForItems = useCallback((items: string[]) => {
    setShareItems(items);
    setShareFolder(null);
    setShareOpen(true);
  }, []);

  const openShareForFolder = useCallback((folder: string) => {
    setShareItems([]);
    setShareFolder(folder);
    setShareOpen(true);
  }, []);

  const openBulkRename = useCallback((items: string[]) => {
    setBulkKeys(items);
    setRenameOpen(true);
  }, []);

  const openBulkMove = useCallback((items: string[]) => {
    setBulkKeys(items);
    setMoveOpen(true);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const handleResizeMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!resizeState.current) return;
    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    if (typeof clientX !== 'number') return;
    if ('touches' in event) event.preventDefault();
    const next = clampSidebarWidth(resizeState.current.startWidth + (clientX - resizeState.current.startX));
    setSidebarWidth(next);
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeState.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
    window.removeEventListener('touchmove', handleResizeMove);
    window.removeEventListener('touchend', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (window.innerWidth <= 768) return;
    const clientX = 'touches' in event ? event.touches[0]?.clientX : event.clientX;
    if (typeof clientX !== 'number') return;
    resizeState.current = { startX: clientX, startWidth: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('touchend', handleResizeEnd);
  }, [handleResizeEnd, handleResizeMove, sidebarWidth]);

  useEffect(() => {
    const runAutoCleanup = async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        await fetch('/api/maintenance/temp?auto=1&days=30', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore auto cleanup errors
      }
    };
    runAutoCleanup();
  }, []);

  return (
    <ImageMetaProvider>
      <div className={styles.container}>
        <Header
          selectedDomain={selectedDomain}
          onDomainChange={setSelectedDomain}
          onLogout={logout}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          sidebarOpen={sidebarOpen}
          onLogoClick={handleLogoClick}
          onOpenTools={() => setToolsOpen(true)}
          onOpenShares={() => setShareManagerOpen(true)}
        />

        <main className={`${styles.main} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
          <aside
            className={styles.sidebar}
            style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
          >
            <FolderNav
              currentFolder={currentFolder}
              onFolderChange={handleFolderChange}
              refreshKey={refreshKey}
              showFavorites={showFavorites}
              onShowFavorites={setShowFavorites}
              activeTag={activeTag}
              onTagFilter={setActiveTag}
              onShareFolder={openShareForFolder}
            />
            <div
              className={styles.resizeHandle}
              role="separator"
              aria-label="Resize sidebar"
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            />
          </aside>

          {sidebarOpen && (
            <button
              type="button"
              className={styles.scrim}
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {!sidebarOpen && (
            <button
              type="button"
              className={styles.pullHandle}
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            />
          )}

          <div className={styles.content}>
            <Uploader
              folder={currentFolder}
              onUploadComplete={handleUploadComplete}
            />

            <FilterBar value={filters} onChange={setFilters} />

            <ImageGrid
              folder={currentFolder}
              domain={selectedDomain}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey(k => k + 1)}
              activeTag={activeTag}
              showFavorites={showFavorites}
              filters={filters}
              onShareItems={openShareForItems}
              onBulkRename={openBulkRename}
              onBulkMove={openBulkMove}
            />
          </div>
        </main>

        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          items={shareItems}
          folder={shareFolder}
          domain={selectedDomain}
        />

        <BulkRenameModal
          open={renameOpen}
          onClose={() => setRenameOpen(false)}
          keys={bulkKeys}
          onComplete={() => setRefreshKey(k => k + 1)}
        />

        <BulkMoveModal
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          keys={bulkKeys}
          onComplete={() => setRefreshKey(k => k + 1)}
        />

        <AdminToolsModal
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
        />

        <ShareManagerModal
          open={shareManagerOpen}
          onClose={() => setShareManagerOpen(false)}
        />
      </div>
    </ImageMetaProvider>
  );
}
