import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ImageMetaProvider, TagColor } from '../contexts/ImageMetaContext';
import { Header } from '../components/Header';
import { Uploader } from '../components/Uploader';
import { ImageGrid } from '../components/ImageGrid';
import { FolderNav } from '../components/FolderNav';
import styles from './Admin.module.css';

export function Admin() {
  const { logout } = useAuth();
  const [currentFolder, setCurrentFolder] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDomain, setSelectedDomain] = useState<'h4ku' | 'lum'>('h4ku');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeTag, setActiveTag] = useState<TagColor | null>(null);

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

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);

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

            <ImageGrid
              folder={currentFolder}
              domain={selectedDomain}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey(k => k + 1)}
              activeTag={activeTag}
              showFavorites={showFavorites}
            />
          </div>
        </main>
      </div>
    </ImageMetaProvider>
  );
}
