import { useEffect, useMemo, useState } from 'react';
import { Lock, Download, RefreshCw } from 'lucide-react';
import { downloadZip } from '../utils/zip';
import { DELIVERY_HOSTS, shouldUseDownloadProxy, shouldUseFileProxy } from '../utils/url';
import { formatBytes, normalizeDownloadName } from '../utils/format';
import styles from './Share.module.css';

interface ShareInfo {
  id: string;
  title: string;
  description?: string;
  domain?: 'h4ku' | 'lum';
  createdAt?: string;
  updatedAt?: string;
}

interface ShareItem {
  key: string;
  size?: number;
  uploaded?: string | null;
  type?: string | null;
  missing?: boolean;
}

interface ShareResponse {
  share?: ShareInfo;
  items?: ShareItem[];
}

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

  const loadShare = async (pwd?: string) => {
    if (!shareId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/share/${shareId}`, {
        method: pwd ? 'POST' : 'GET',
        headers: pwd ? { 'Content-Type': 'application/json' } : undefined,
        body: pwd ? JSON.stringify({ password: pwd }) : undefined,
      });

      if (res.status === 401) {
        const text = await res.text();
        setRequiresPassword(true);
        setError(text && !text.includes('password_required') ? text : '');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(await res.text());
        setLoading(false);
        return;
      }

      const data = await res.json() as ShareResponse;
      setShare(data.share || null);
      setItems(data.items || []);
      setRequiresPassword(false);
    } catch {
      setError('Failed to load delivery.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShare();
  }, [shareId]);

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
                <img src={getImageUrl(item.key)} alt={item.key} loading="lazy" />
              )}
              <div className={styles.itemMeta}>
                <span className={styles.itemName}>{item.key.split('/').pop()}</span>
                <span className={styles.itemSize}>{formatBytes(item.size)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
