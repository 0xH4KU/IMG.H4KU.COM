import { useState, useCallback, useEffect } from 'react';
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
  const [currentFolder, setCurrentFolder] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDomain, setSelectedDomain] = useState<'h4ku' | 'lum'>('h4ku');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

        <main className={`${styles.main} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <aside className={styles.sidebar}>
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
          </aside>

          {sidebarOpen && (
            <button
              type="button"
              className={styles.scrim}
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
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
