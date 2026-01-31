import { useState, useRef, useCallback, DragEvent, ChangeEvent, useEffect, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Upload, X, Check, AlertCircle, Pause, Play, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
import { generateThumbnail } from '../utils/thumbnail';
import styles from './Uploader.module.css';

interface UploaderProps {
  folder: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  id: string;
  file: File;
  targetFolder: string;
  relativePath: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const MAX_CONCURRENT = 3;

export function Uploader({ folder, onUploadComplete }: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [paused, setPaused] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef(folder);
  folderRef.current = folder;

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDropzoneKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  const uploadSingleFile = useCallback(async (uf: UploadFile) => {
    setFiles(prev =>
      prev.map(f => (f.id === uf.id ? { ...f, status: 'uploading', error: undefined } : f))
    );
    setActiveCount(count => count + 1);

    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', uf.file);
    formData.append('folder', uf.targetFolder);

    try {
      // Generate thumbnail in parallel with upload preparation
      const thumbnailPromise = generateThumbnail(uf.file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();

        // Upload thumbnail if generated
        const thumbnail = await thumbnailPromise;
        if (thumbnail) {
          const thumbKey = `.thumbs/${result.key}`;
          const thumbFormData = new FormData();
          thumbFormData.append('file', thumbnail, 'thumb.webp');
          thumbFormData.append('key', thumbKey);

          fetch('/api/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: thumbFormData,
          }).catch(() => { /* Thumbnail upload failure is non-critical */ });
        }

        setFiles(prev =>
          prev.map(f =>
            f.id === uf.id ? { ...f, status: 'success', progress: 100 } : f
          )
        );
        onUploadComplete();
      } else {
        const error = await res.text();
        setFiles(prev =>
          prev.map(f =>
            f.id === uf.id ? { ...f, status: 'error', error } : f
          )
        );
      }
    } catch {
      setFiles(prev =>
        prev.map(f =>
          f.id === uf.id ? { ...f, status: 'error', error: 'Upload failed' } : f
        )
      );
    } finally {
      setActiveCount(count => Math.max(0, count - 1));
    }
  }, [onUploadComplete]);

  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = relativePath.split('/');
      const relativeDir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const targetFolder = [folderRef.current, relativeDir].filter(Boolean).join('/');
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        targetFolder,
        relativePath,
        progress: 0,
        status: 'pending',
      };
    });
    setFiles(prev => [...prev, ...uploadFiles]);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (activeCount >= MAX_CONCURRENT) return;
    const next = files.find(f => f.status === 'pending');
    if (!next) return;
    uploadSingleFile(next);
  }, [files, paused, activeCount, uploadSingleFile]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
      e.target.value = '';
    }
  }, [addFiles]);

  const handleFolderInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      addFiles(selectedFiles);
      e.target.value = '';
    }
  }, [addFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  const retryFile = (id: string) => {
    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, status: 'pending', error: undefined } : f))
    );
  };

  const retryFailed = () => {
    setFiles(prev =>
      prev.map(f => (f.status === 'error' ? { ...f, status: 'pending', error: undefined } : f))
    );
  };

  const togglePause = () => {
    setPaused(prev => !prev);
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  const successCount = files.filter(f => f.status === 'success').length;

  const errorSuffix = errorCount > 0 ? ` • ${errorCount} failed` : '';

  const queueLabel = paused
    ? `Queue paused${pendingCount > 0 ? ` • ${pendingCount} queued` : ''}${errorSuffix}`
    : uploadingCount > 0
      ? `${uploadingCount} uploading${pendingCount > 0 ? ` • ${pendingCount} queued` : ''}${errorSuffix}`
      : pendingCount > 0
        ? `${pendingCount} queued${errorSuffix}`
        : successCount > 0
          ? `${successCount} completed${errorSuffix}`
          : `Queue idle${errorSuffix}`;

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className={styles.input}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={handleFolderInputChange}
        className={styles.input}
        // @ts-expect-error webkitdirectory is supported by Chromium browsers
        webkitdirectory="true"
      />
      {!collapsed && (
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Upload images"
        >
          <Upload size={32} strokeWidth={1.5} />
          <p className={styles.dropText}>
            Drop images here or <span className={styles.link}>click to select files</span>
          </p>
          <p className={styles.sizeHint}>Max size: 50 MB per file</p>
          <p className={styles.folderHint}>
            Uploading to: <strong>{folder || 'root'}/</strong>
          </p>
        </div>
      )}

      <div className={styles.dropActions}>
        <button className={styles.actionBtn} onClick={() => folderInputRef.current?.click()}>
          Upload folder
        </button>
        <button className={styles.actionBtn} onClick={() => inputRef.current?.click()}>
          Select files
        </button>
        <span className={styles.queueStatus}>
          {queueLabel}
        </span>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.collapseBtn}`}
          onClick={() => setCollapsed(prev => !prev)}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <span>{files.length} file(s)</span>
            <div className={styles.queueControls}>
              <button className={styles.queueBtn} onClick={togglePause}>
                {paused ? <Play size={12} /> : <Pause size={12} />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              {errorCount > 0 && (
                <button className={styles.queueBtn} onClick={retryFailed}>
                  <RotateCcw size={12} />
                  Retry failed
                </button>
              )}
              {files.some(f => f.status === 'success') && (
                <button className={styles.clearBtn} onClick={clearCompleted}>
                  Clear completed
                </button>
              )}
            </div>
          </div>
          {files.map(f => (
            <div key={f.id} className={styles.fileItem}>
              <span className={styles.fileName}>{f.relativePath}</span>
              <span className={styles.fileStatus}>
                {f.status === 'uploading' && (
                  <span className={styles.uploading}>Uploading...</span>
                )}
                {f.status === 'pending' && (
                  <span className={styles.pending}>{paused ? 'Paused' : 'Queued'}</span>
                )}
                {f.status === 'success' && <Check size={16} className={styles.success} />}
                {f.status === 'error' && (
                  <>
                    <span className={styles.error}>
                      <AlertCircle size={16} />
                    </span>
                    <button className={styles.retryBtn} onClick={() => retryFile(f.id)} title="Retry">
                      <RotateCcw size={14} />
                    </button>
                  </>
                )}
                {f.status !== 'uploading' && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeFile(f.id)}
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
