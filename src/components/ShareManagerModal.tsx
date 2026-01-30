import { useEffect, useState } from 'react';
import { X, Copy, Trash2, RefreshCw } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
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

const ADMIN_ORIGINS = {
  h4ku: 'https://admin.img.h4ku.com',
  lum: 'https://admin.img.lum.bio',
};

export function ShareManagerModal({ open, onClose }: ShareManagerModalProps) {
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const fetchShares = async () => {
    setLoading(true);
    setError('');
    const token = getAuthToken();
    try {
      const res = await fetch('/api/shares', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setShares(Array.isArray(data.shares) ? data.shares : []);
      } else {
        setError(await res.text());
      }
    } catch {
      setError('Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchShares();
  }, [open]);

  if (!open) return null;

  const resolveShareOrigin = (domain?: string) => {
    const origin = window.location.origin;
    const host = window.location.hostname;
    if (host === 'localhost' || host.endsWith('.pages.dev')) return origin;
    const normalized = domain === 'lum' ? 'lum' : 'h4ku';
    if (normalized === 'lum') {
      return host.includes('lum.bio') ? origin : ADMIN_ORIGINS.lum;
    }
    return host.includes('h4ku.com') ? origin : ADMIN_ORIGINS.h4ku;
  };

  const copyLink = async (id: string, domain?: string) => {
    const url = `${resolveShareOrigin(domain)}/share/${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1500);
  };

  const revokeShare = async (id: string) => {
    if (!confirm('Revoke this delivery link?')) return;
    const token = getAuthToken();
    try {
      const res = await fetch(`/api/shares?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShares(prev => prev.filter(share => share.id !== id));
      } else {
        alert(await res.text());
      }
    } catch {
      alert('Failed to revoke delivery.');
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
