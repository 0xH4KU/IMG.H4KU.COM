/**
 * Lightweight frontend error tracking.
 * Captures uncaught errors and unhandled promise rejections,
 * batches them, and posts to /api/logs.
 */

const BATCH_INTERVAL_MS = 5_000;
const MAX_QUEUE = 20;

interface ErrorEntry {
    ts: string;
    message: string;
    source?: string;
    line?: number;
    col?: number;
    stack?: string;
}

const queue: ErrorEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function enqueue(entry: ErrorEntry) {
    if (queue.length >= MAX_QUEUE) return; // prevent memory buildup
    queue.push(entry);
    if (!timer) {
        timer = setTimeout(flush, BATCH_INTERVAL_MS);
    }
}

async function flush() {
    timer = null;
    if (queue.length === 0) return;
    const batch = queue.splice(0);
    try {
        const token = localStorage.getItem('token');
        await fetch('/api/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ errors: batch }),
        });
    } catch {
        // Best-effort, don't re-queue to avoid loops
    }
}

export function initErrorTracking() {
    window.onerror = (message, source, lineno, colno, error) => {
        enqueue({
            ts: new Date().toISOString(),
            message: String(message),
            source: source || undefined,
            line: lineno || undefined,
            col: colno || undefined,
            stack: error?.stack,
        });
    };

    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        enqueue({
            ts: new Date().toISOString(),
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
        });
    };

    // Flush on page hide
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush();
        }
    });
}
