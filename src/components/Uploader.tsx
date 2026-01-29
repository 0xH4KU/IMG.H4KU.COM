import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
import styles from './Uploader.module.css';

interface UploaderProps {
  folder: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function Uploader({ folder, onUploadComplete }: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const uploadSingleFile = useCallback(async (uf: UploadFile) => {
    setFiles(prev =>
      prev.map(f => (f.id === uf.id ? { ...f, status: 'uploading' } : f))
    );

    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', uf.file);
    formData.append('folder', folderRef.current);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
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
    }
  }, [onUploadComplete]);

  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending',
    }));
    setFiles(prev => [...prev, ...uploadFiles]);
    uploadFiles.forEach(uploadSingleFile);
  }, [uploadSingleFile]);

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

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleInputChange}
          className={styles.input}
        />
        <Upload size={32} strokeWidth={1.5} />
        <p className={styles.dropText}>
          Drop images here or <span className={styles.link}>browse</span>
        </p>
        {folder && (
          <p className={styles.folderHint}>
            Uploading to: <strong>{folder || 'root'}/</strong>
          </p>
        )}
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <span>{files.length} file(s)</span>
            {files.some(f => f.status === 'success') && (
              <button className={styles.clearBtn} onClick={clearCompleted}>
                Clear completed
              </button>
            )}
          </div>
          {files.map(f => (
            <div key={f.id} className={styles.fileItem}>
              <span className={styles.fileName}>{f.file.name}</span>
              <span className={styles.fileStatus}>
                {f.status === 'uploading' && (
                  <span className={styles.uploading}>Uploading...</span>
                )}
                {f.status === 'success' && <Check size={16} className={styles.success} />}
                {f.status === 'error' && (
                  <span className={styles.error}>
                    <AlertCircle size={16} />
                  </span>
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
