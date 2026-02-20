import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { useApiAction } from '../hooks/useApiAction';
import { useFocusTrap } from '../hooks/useFocusTrap';
import styles from './BulkMoveModal.module.css';

interface BulkMoveModalProps {
  open: boolean;
  onClose: () => void;
  keys: string[];
  onComplete: () => void;
}

export function BulkMoveModal({ open, onClose, keys, onComplete }: BulkMoveModalProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [targetFolder, setTargetFolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { run } = useApiAction();

  useEffect(() => {
    if (!open) return;
    setTargetFolder('');
    setError('');
    const fetchFolders = async () => {
      try {
        const data = await run(() => apiRequest<{ folders?: string[] }>('/api/folders'));
        setFolders(Array.isArray(data.folders) ? data.folders : []);
      } catch (nextError) {
        setError(getErrorMessage(nextError, 'Failed to load folders.'));
      }
    };
    fetchFolders();
  }, [open]);

  const titleId = useId();
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  const applyMove = async () => {
    if (keys.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const data = await run(() => apiRequest<{ moved: number; skipped: number }>('/api/images/move', {
        method: 'POST',
        body: { keys, targetFolder },
      }));

      onComplete();
      if (data.skipped > 0) {
        setError(`Moved ${data.moved}, skipped ${data.skipped}.`);
      } else {
        onClose();
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Failed to move files.'));
    } finally {
      setLoading(false);
    }
  };

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
          <h3 id={titleId}>Batch Move</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span>Target folder (leave blank for root)</span>
            <input
              list="folder-options"
              value={targetFolder}
              onChange={e => setTargetFolder(e.target.value)}
              placeholder="e.g. screenshots"
            />
            <datalist id="folder-options">
              {folders.map(folder => (
                <option key={folder} value={folder} />
              ))}
            </datalist>
          </label>

          <div className={styles.summary}>
            <span>{keys.length} items selected</span>
            {targetFolder ? <span>→ {targetFolder}/</span> : <span>→ root</span>}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={applyMove} disabled={loading}>
              {loading ? 'Moving...' : 'Move'}
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
