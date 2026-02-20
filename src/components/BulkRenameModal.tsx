import { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { useApiAction } from '../hooks/useApiAction';
import { useFocusTrap } from '../hooks/useFocusTrap';
import styles from './BulkRenameModal.module.css';

interface BulkRenameModalProps {
  open: boolean;
  onClose: () => void;
  keys: string[];
  onComplete: () => void;
}

interface PreviewItem {
  from: string;
  to: string;
  valid: boolean;
  reason?: string;
}

function splitName(key: string) {
  const parts = key.split('/');
  const fileName = parts[parts.length - 1] || key;
  const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const dot = fileName.lastIndexOf('.');
  if (dot > 0) {
    return { folder, base: fileName.slice(0, dot), ext: fileName.slice(dot) };
  }
  return { folder, base: fileName, ext: '' };
}

export function BulkRenameModal({ open, onClose, keys, onComplete }: BulkRenameModalProps) {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [keepExt, setKeepExt] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { run } = useApiAction();

  const preview = useMemo<PreviewItem[]>(() => {
    const seen = new Set<string>();
    return keys.map(key => {
      const { folder, base, ext } = splitName(key);
      const targetBase = find ? base.split(find).join(replace) : base;
      const newName = `${prefix}${targetBase}${suffix}${keepExt ? ext : ''}`.trim();
      if (!newName) {
        return { from: key, to: key, valid: false, reason: 'Empty name' };
      }
      const to = folder ? `${folder}/${newName}` : newName;
      if (to.startsWith('.config/')) {
        return { from: key, to, valid: false, reason: 'Invalid target' };
      }
      if (seen.has(to)) {
        return { from: key, to, valid: false, reason: 'Duplicate target' };
      }
      seen.add(to);
      return { from: key, to, valid: true };
    });
  }, [keys, prefix, suffix, find, replace, keepExt]);

  useEffect(() => {
    if (!open) return;
    setPrefix('');
    setSuffix('');
    setFind('');
    setReplace('');
    setKeepExt(true);
    setError('');
  }, [open]);

  const titleId = useId();
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  const applyRename = async () => {
    setError('');
    const renames = preview.filter(item => item.valid && item.from !== item.to);
    if (renames.length === 0) {
      setError('No changes to apply.');
      return;
    }
    setLoading(true);
    try {
      const data = await run(() => apiRequest<{ renamed: number; skipped: number }>('/api/images/rename', {
        method: 'POST',
        body: { renames: renames.map(item => ({ from: item.from, to: item.to })) },
      }));

      onComplete();
      if (data.skipped > 0) {
        setError(`Renamed ${data.renamed}, skipped ${data.skipped}.`);
      } else {
        onClose();
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Failed to rename files.'));
    } finally {
      setLoading(false);
    }
  };

  const changedCount = preview.filter(item => item.from !== item.to && item.valid).length;
  const invalidCount = preview.filter(item => !item.valid).length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id={titleId}>Batch Rename</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Find</span>
              <input value={find} onChange={e => setFind(e.target.value)} placeholder="Text to find" />
            </label>
            <label className={styles.field}>
              <span>Replace</span>
              <input value={replace} onChange={e => setReplace(e.target.value)} placeholder="Replacement" />
            </label>
            <label className={styles.field}>
              <span>Prefix</span>
              <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Optional" />
            </label>
            <label className={styles.field}>
              <span>Suffix</span>
              <input value={suffix} onChange={e => setSuffix(e.target.value)} placeholder="Optional" />
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={keepExt} onChange={e => setKeepExt(e.target.checked)} />
              Keep file extension
            </label>
          </div>

          <div className={styles.summary}>
            <span>{keys.length} items</span>
            <span>{changedCount} changes</span>
            {invalidCount > 0 && <span className={styles.warn}>{invalidCount} invalid</span>}
          </div>

          <div className={styles.preview}>
            {preview.slice(0, 8).map(item => (
              <div key={item.from} className={`${styles.previewRow} ${item.valid ? '' : styles.invalid}`}>
                <span className={styles.oldName}>{item.from.split('/').pop()}</span>
                <span className={styles.arrow}>-&gt;</span>
                <span className={styles.newName}>{item.to.split('/').pop()}</span>
                {item.reason && <span className={styles.reason}>{item.reason}</span>}
              </div>
            ))}
            {preview.length > 8 && (
              <div className={styles.more}>...and {preview.length - 8} more</div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={applyRename} disabled={loading}>
              {loading ? 'Renaming...' : 'Apply Rename'}
            </button>
            <button className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
