import { useEffect, useState } from 'react';
import { X, RefreshCw, Download, Trash2 } from 'lucide-react';
import { getAuthToken } from '../contexts/AuthContext';
import styles from './AdminToolsModal.module.css';

interface AdminToolsModalProps {
  open: boolean;
  onClose: () => void;
}

interface UsageResponse {
  total: { count: number; size: number };
  thresholds: {
    maxBytes: number | null;
    warnBytes: number | null;
    alertBytes: number | null;
    maxCount: number | null;
    warnCount: number | null;
    alertCount: number | null;
  };
  status: { bytes: 'ok' | 'warn' | 'alert'; count: 'ok' | 'warn' | 'alert' };
  percent: { bytes: number | null; count: number | null };
}

interface LogEntry {
  id: string;
  ts: string;
  route: string;
  method: string;
  message: string;
  detail?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function AdminToolsModal({ open, onClose }: AdminToolsModalProps) {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const fetchUsage = async () => {
    setUsageLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch('/api/monitoring/r2', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch {
      // Ignore
    } finally {
      setUsageLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch('/api/logs?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      }
    } catch {
      // Ignore
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setResult('');
    fetchUsage();
    fetchLogs();
  }, [open]);

  if (!open) return null;

  const runAction = async (name: string, fn: () => Promise<void>) => {
    setActionLoading(name);
    setResult('');
    try {
      await fn();
    } finally {
      setActionLoading('');
    }
  };

  const runTempCleanup = () => runAction('temp', async () => {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch('/api/maintenance/temp?days=30', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = res.ok ? JSON.stringify(await res.json(), null, 2) : await res.text();
    setResult(text);
    fetchUsage();
  });

  const runOrphanCleanup = () => runAction('orphans', async () => {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch('/api/maintenance/orphans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = res.ok ? JSON.stringify(await res.json(), null, 2) : await res.text();
    setResult(text);
  });

  const runBrokenLinks = () => runAction('broken', async () => {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch('/api/maintenance/broken-links', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = res.ok ? JSON.stringify(await res.json(), null, 2) : await res.text();
    setResult(text);
  });

  const runDuplicates = () => runAction('duplicates', async () => {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch('/api/maintenance/duplicates?compute=1&limit=200', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = res.ok ? JSON.stringify(await res.json(), null, 2) : await res.text();
    setResult(text);
  });

  const downloadExport = () => runAction('export', async () => {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch('/api/maintenance/export', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setResult(await res.text());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'img-h4ku-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setResult('Export downloaded.');
  });

  const clearLogs = () => runAction('clearLogs', async () => {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch('/api/logs', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setLogs([]);
      setResult('Logs cleared.');
    } else {
      setResult(await res.text());
    }
  });

  const statusClass = (status: string) => {
    if (status === 'alert') return styles.alert;
    if (status === 'warn') return styles.warn;
    return styles.ok;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Tools</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>Storage</span>
              <button className={styles.iconBtn} onClick={fetchUsage} disabled={usageLoading} title="Refresh usage">
                <RefreshCw size={14} className={usageLoading ? styles.spinning : ''} />
              </button>
            </div>
            <div className={styles.card}>
              <div className={styles.metricRow}>
                <span>Objects</span>
                <span className={statusClass(usage?.status?.count || 'ok')}>
                  {usage ? usage.total.count.toLocaleString() : '--'}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span>Size</span>
                <span className={statusClass(usage?.status?.bytes || 'ok')}>
                  {usage ? formatBytes(usage.total.size) : '--'}
                </span>
              </div>
              {usage && usage.percent?.bytes !== null && (
                <div className={styles.subText}>
                  {Math.round(((usage.percent?.bytes ?? 0) * 100))}% of max bytes
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>Maintenance</div>
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={runTempCleanup} disabled={actionLoading === 'temp'}>
                Temp cleanup (30d)
              </button>
              <button className={styles.actionBtn} onClick={runOrphanCleanup} disabled={actionLoading === 'orphans'}>
                Cleanup orphans
              </button>
              <button className={styles.actionBtn} onClick={runBrokenLinks} disabled={actionLoading === 'broken'}>
                Check broken links
              </button>
              <button className={styles.actionBtn} onClick={runDuplicates} disabled={actionLoading === 'duplicates'}>
                Scan duplicates
              </button>
              <button className={styles.actionBtn} onClick={downloadExport} disabled={actionLoading === 'export'}>
                <Download size={14} />
                Export metadata
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>Error Logs</span>
              <div className={styles.logActions}>
                <button className={styles.iconBtn} onClick={fetchLogs} disabled={logLoading} title="Refresh logs">
                  <RefreshCw size={14} className={logLoading ? styles.spinning : ''} />
                </button>
                <button className={styles.iconBtn} onClick={clearLogs} disabled={actionLoading === 'clearLogs'} title="Clear logs">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className={styles.logList}>
              {logs.length === 0 && <div className={styles.subText}>No logs.</div>}
              {logs.map(log => (
                <div key={log.id} className={styles.logRow}>
                  <span className={styles.logTime}>{new Date(log.ts).toLocaleString()}</span>
                  <span className={styles.logRoute}>{log.method} {log.route}</span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))}
            </div>
          </section>

          {result && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>Result</div>
              <pre className={styles.result}>{result}</pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
