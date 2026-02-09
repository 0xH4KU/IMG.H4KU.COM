import { useEffect, useState } from 'react';
import { X, RefreshCw, Download, Trash2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { formatBytes } from '../utils/format';
import { getErrorMessage } from '../utils/errors';
import { useApiAction } from '../hooks/useApiAction';
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

export function AdminToolsModal({ open, onClose }: AdminToolsModalProps) {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const { run } = useApiAction();

  const fetchUsage = async () => {
    setUsageLoading(true);
    try {
      const data = await run(() => apiRequest<UsageResponse>('/api/monitoring/r2'));
      setUsage(data);
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to load storage usage'));
    } finally {
      setUsageLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const data = await run(() => apiRequest<{ logs?: LogEntry[] }>('/api/logs?limit=50'));
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to load error logs'));
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
    try {
      const data = await run(() => apiRequest('/api/maintenance/temp?days=30', {
        method: 'POST',
      }));
      setResult(JSON.stringify(data, null, 2));
      fetchUsage();
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to run temp cleanup'));
    }
  });

  const runOrphanCleanup = () => runAction('orphans', async () => {
    try {
      const data = await run(() => apiRequest('/api/maintenance/orphans', {
        method: 'POST',
      }));
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to cleanup orphans'));
    }
  });

  const runBrokenLinks = () => runAction('broken', async () => {
    try {
      const data = await run(() => apiRequest('/api/maintenance/broken-links'));
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to check broken links'));
    }
  });

  const runDuplicates = () => runAction('duplicates', async () => {
    try {
      const data = await run(() => apiRequest('/api/maintenance/duplicates?compute=1&limit=200'));
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to scan duplicates'));
    }
  });

  const downloadExport = () => runAction('export', async () => {
    try {
      const blob = await run(() => apiRequest<Blob>('/api/maintenance/export', {
        responseType: 'blob',
      }));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'img-h4ku-backup.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setResult('Export downloaded.');
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to export metadata'));
    }
  });

  const clearLogs = () => runAction('clearLogs', async () => {
    try {
      await run(() => apiRequest('/api/logs', { method: 'DELETE' }));
      setLogs([]);
      setResult('Logs cleared.');
    } catch (error) {
      setResult(getErrorMessage(error, 'Failed to clear logs'));
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
