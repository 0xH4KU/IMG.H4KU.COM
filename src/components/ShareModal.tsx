import { useEffect, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { apiRequest, ApiError } from '../utils/api';
import { resolveShareOrigin } from '../utils/url';
import { useTransientMessage } from '../hooks/useTransientMessage';
import styles from './ShareModal.module.css';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  items?: string[];
  folder?: string | null;
  domain: 'h4ku' | 'lum';
}

interface CreateShareResponse {
  share?: { id?: string };
  url?: string;
}

export function ShareModal({ open, onClose, items = [], folder = null, domain }: ShareModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [shareDomain, setShareDomain] = useState<'h4ku' | 'lum'>(domain);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');
  const { message: copiedState, show: showCopied, clear: clearCopied } = useTransientMessage(2000);
  const copied = copiedState === 'copied';

  useEffect(() => {
    if (!open) return;
    setTitle(`Delivery ${new Date().toLocaleDateString()}`);
    setDescription('');
    setPassword('');
    setShareDomain(domain);
    setShareUrl('');
    clearCopied();
    setError('');
  }, [open, domain, clearCopied]);

  if (!open) return null;

  const createShare = async () => {
    if (items.length === 0 && !folder) {
      setError('Please select at least one image or folder.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<CreateShareResponse>('/api/shares', {
        method: 'POST',
        body: {
          title,
          description,
          password: password.trim(),
          items: items.length > 0 ? items : undefined,
          folder: items.length === 0 ? folder : undefined,
          domain: shareDomain,
        },
      });

      const id = data.share?.id;
      if (id) {
        setShareUrl(`${resolveShareOrigin(shareDomain)}/share/${id}`);
      } else {
        setShareUrl(data.url || '');
      }
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'Failed to create delivery.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    showCopied('copied');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>New Delivery</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.meta}>
            <span>
              {folder ? `Folder: ${folder}` : `${items.length} image(s) selected`}
            </span>
            <select value={shareDomain} onChange={e => setShareDomain(e.target.value as 'h4ku' | 'lum')}>
              <option value="h4ku">img.h4ku.com</option>
              <option value="lum">img.lum.bio</option>
            </select>
          </div>

          <label className={styles.field}>
            <span>Title</span>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional note for client"
            />
          </label>

          <label className={styles.field}>
            <span>Password (optional)</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Leave blank for public"
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={createShare} disabled={loading}>
              {loading ? 'Creating...' : 'Create Delivery'}
            </button>
            <button className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
          </div>

          {shareUrl && (
            <div className={styles.linkBox}>
              <input readOnly value={shareUrl} />
              <button className={styles.copyBtn} onClick={copyLink}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
