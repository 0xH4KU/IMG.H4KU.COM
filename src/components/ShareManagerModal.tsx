import { useEffect, useState } from 'react';
import { X, Copy, Trash2, RefreshCw } from 'lucide-react';
import { apiRequest, ApiError } from '../utils/api';
import { resolveShareOrigin } from '../utils/url';
import { useTransientMessage } from '../hooks/useTransientMessage';
import styles from './ShareManagerModal.module.css';

interface ShareManagerModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShareInfo {
  id: string;
  title: string;
  description?: string;
  count: number;
  createdAt?: string;
  updatedAt?: string;
  hasPassword?: boolean;
  domain?: string;
}

export function ShareManagerModal({ open, onClose }: ShareManagerModalProps) {
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { message: copiedId, show: showCopied } = useTransientMessage(1500);

  const fetchShares = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{ shares?: ShareInfo[] }>('/api/shares');
      setShares(Array.isArray(data.shares) ? data.shares : []);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchShares();
  }, [open]);

  if (!open) return null;

  const copyLink = async (id: string, domain?: string) => {
    const url = `${resolveShareOrigin(domain === 'lum' ? 'lum' : 'h4ku')}/share/${id}`;
    await navigator.clipboard.writeText(url);
    showCopied(id);
  };

  const revokeShare = async (id: string) => {
    if (!confirm('Revoke this delivery link?')) return;
    try {
      await apiRequest(`/api/shares?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setShares(prev => prev.filter(share => share.id !== id));
    } catch (error) {
      alert(error instanceof ApiError ? error.message : 'Failed to revoke delivery.');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Deliveries</h3>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={fetchShares} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? styles.spinning : ''} />
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}
          {loading && shares.length === 0 && <div className={styles.empty}>Loading...</div>}
          {!loading && shares.length === 0 && <div className={styles.empty}>No deliveries yet.</div>}
          <div className={styles.list}>
            {shares.map(share => (
              <div key={share.id} className={styles.row}>
                <div className={styles.info}>
                  <div className={styles.titleRow}>
                    <span className={styles.title}>{share.title}</span>
                    {share.hasPassword && <span className={styles.badge}>Password</span>}
                  </div>
                  <div className={styles.meta}>
                    <span>{share.count} items</span>
                    <span>{share.domain && share.domain.includes('lum') ? 'img.lum.bio' : 'img.h4ku.com'}</span>
                    {share.updatedAt && <span>Updated {new Date(share.updatedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.actionBtn} onClick={() => copyLink(share.id, share.domain)}>
                    <Copy size={14} />
                    {copiedId === share.id ? 'Copied' : 'Copy'}
                  </button>
                  <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => revokeShare(share.id)}>
                    <Trash2 size={14} />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
