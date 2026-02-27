import { useEffect, useMemo, useState, useCallback } from 'react';
import { Lock, Download, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadZip } from '../utils/zip';
import { DELIVERY_HOSTS, shouldUseDownloadProxy, shouldUseFileProxy } from '../utils/url';
import { formatBytes, normalizeDownloadName } from '../utils/format';
import { loadShareData, ShareInfo, ShareItem } from '../utils/shareApi';
import { ApiError } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import styles from './Share.module.css';

const host = window.location.hostname;
const useFileProxy = shouldUseFileProxy(host);
const useDownloadProxy = shouldUseDownloadProxy(host);

export function Share() {
  const shareId = useMemo(() => {
    const path = window.location.pathname;
    const idx = path.indexOf('/share/');
    if (idx === -1) return '';
    return path.slice(idx + 7).split('/')[0];
  }, []);

  const [share, setShare] = useState<ShareInfo | null>(null);
  const [items, setItems] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ finished: number; total: number } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set());

  const validItems = useMemo(() => items.filter(item => !item.missing), [items]);

  const loadShare = async (pwd?: string) => {
    if (!shareId) return;
    setLoading(true);
    setError('');
    try {
      const data = await loadShareData({ shareId, password: pwd });
      setShare(data.share || null);
      setItems(data.items || []);
      setRequiresPassword(false);
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        setRequiresPassword(true);
        const apiError = nextError as ApiError;
        setError(apiError.message === 'password_required' ? '' : apiError.message);
      } else {
        setError(getErrorMessage(nextError, 'Failed to load delivery.'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShare();
  }, [shareId]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') setLightboxIndex(i => i !== null && i > 0 ? i - 1 : i);
      if (e.key === 'ArrowRight') setLightboxIndex(i => i !== null && i < validItems.length - 1 ? i + 1 : i);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, validItems.length]);

  const openLightbox = useCallback((key: string) => {
    const idx = validItems.findIndex(item => item.key === key);
    if (idx >= 0) setLightboxIndex(idx);
  }, [validItems]);

  const handleImgLoad = useCallback((key: string) => {
    setLoadedImages(prev => new Set(prev).add(key));
  }, []);

  const getImageUrl = (key: string) => {
    const domain = share?.domain === 'lum' ? 'lum' : 'h4ku';
    return useFileProxy ? `/api/file?key=${encodeURIComponent(key)}` : `${DELIVERY_HOSTS[domain]}/${key}`;
  };

  const getDownloadUrl = (key: string) => {
    if (useDownloadProxy) return `/api/file?key=${encodeURIComponent(key)}`;
    const domain = share?.domain === 'lum' ? 'lum' : 'h4ku';
    return `${DELIVERY_HOSTS[domain]}/${key}`;
  };

  const downloadAll = async () => {
    const keys = items.filter(item => !item.missing).map(item => item.key);
    if (keys.length === 0) return;
    setDownloading(true);
    setDownloadProgress({ finished: 0, total: keys.length });
    try {
      await downloadZip({
        name: normalizeDownloadName(share?.title || 'delivery', 'delivery'),
        keys,
        getUrl: getDownloadUrl,
        onProgress: (finished, total) => setDownloadProgress({ finished, total }),
      });
    } finally {
      setDownloadProgress(null);
      setDownloading(false);
    }
  };

  if (!shareId) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>Missing share ID.</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>{share?.title || 'Delivery'}</h1>
          {share?.description && <p>{share.description}</p>}
          {(share?.createdAt || share?.updatedAt || items.length > 0) && (
            <div className={styles.metaRow}>
              {items.length > 0 && <span>{items.length} files</span>}
              {share?.createdAt && <span>Created {new Date(share.createdAt).toLocaleDateString()}</span>}
              {share?.updatedAt && <span>Updated {new Date(share.updatedAt).toLocaleDateString()}</span>}
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.actionBtn} onClick={() => loadShare(password)}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className={styles.primaryBtn} onClick={downloadAll} disabled={downloading}>
            <Download size={14} />
            {downloading
              ? `Downloading${downloadProgress ? ` (${downloadProgress.finished}/${downloadProgress.total})` : '...'}`
              : 'Download All'}
          </button>
        </div>
      </div>

      {loading && <div className={styles.card}>Loading...</div>}

      {error && <div className={styles.card}>{error}</div>}

      {requiresPassword && !loading && (
        <div className={styles.card}>
          <div className={styles.passwordPrompt}>
            <Lock size={16} />
            <span>Password required</span>
          </div>
          <div className={styles.passwordInput}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
            />
            <button onClick={() => loadShare(password)}>Unlock</button>
          </div>
        </div>
      )}

      {!loading && !requiresPassword && (
        <div className={styles.grid}>
          {items.map(item => (
            <div key={item.key} className={styles.itemCard}>
              {item.missing ? (
                <div className={styles.missing}>Missing file</div>
              ) : (
                <div className={`${styles.imgWrap}${loadedImages.has(item.key) ? ` ${styles.loaded}` : ''}`}>
                  <img
                    src={getImageUrl(item.key)}
                    alt={item.key.split('/').pop() || item.key}
                    loading="lazy"
                    onClick={() => openLightbox(item.key)}
                    onLoad={() => handleImgLoad(item.key)}
                  />
                </div>
              )}
              <div className={styles.itemMeta}>
                <span className={styles.itemName}>{item.key.split('/').pop()}</span>
                <span className={styles.itemSize}>{formatBytes(item.size)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && validItems[lightboxIndex] && (
        <div className={styles.lightbox} onClick={() => setLightboxIndex(null)}>
          <img
            src={getImageUrl(validItems[lightboxIndex].key)}
            alt={validItems[lightboxIndex].key.split('/').pop() || ''}
            onClick={e => e.stopPropagation()}
          />
          <button className={styles.lightboxClose} onClick={() => setLightboxIndex(null)} aria-label="Close">
            <X size={18} />
          </button>
          {lightboxIndex > 0 && (
            <button
              className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i ?? 1) - 1); }}
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {lightboxIndex < validItems.length - 1 && (
            <button
              className={`${styles.lightboxNav} ${styles.lightboxNext}`}
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i ?? 0) + 1); }}
              aria-label="Next"
            >
              <ChevronRight size={20} />
            </button>
          )}
          <div className={styles.lightboxMeta}>
            {lightboxIndex + 1} / {validItems.length} · {validItems[lightboxIndex].key.split('/').pop()}
          </div>
        </div>
      )}
    </div>
  );
}
