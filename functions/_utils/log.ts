import type { Env } from '../_types/index.ts';

const LOG_KEY = '.config/error-log.json';
const MAX_LOGS = 200;

interface LogEntry {
    id: string;
    ts: string;
    level: string;
    route: string;
    method: string;
    message: string;
    detail: string;
}

interface LogData {
    version: number;
    updatedAt: string;
    logs: LogEntry[];
}

function safeString(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.slice(0, 2000);
    try {
        return JSON.stringify(value).slice(0, 2000);
    } catch {
        return String(value).slice(0, 2000);
    }
}

async function getLogData(env: Env): Promise<LogData> {
    try {
        const obj = await env.R2.get(LOG_KEY);
        if (!obj) return { version: 1, updatedAt: new Date().toISOString(), logs: [] };
        const data = JSON.parse(await obj.text()) as Partial<LogData>;
        return {
            version: 1,
            updatedAt: data.updatedAt || new Date().toISOString(),
            logs: Array.isArray(data.logs) ? data.logs : [],
        };
    } catch {
        return { version: 1, updatedAt: new Date().toISOString(), logs: [] };
    }
}

async function saveLogData(env: Env, data: LogData): Promise<void> {
    data.updatedAt = new Date().toISOString();
    await env.R2.put(LOG_KEY, JSON.stringify(data));
}

function randomId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface LogErrorInput {
    level?: string;
    route?: string;
    method?: string;
    message?: string;
    detail?: unknown;
}

export async function logError(env: Env, entry: LogErrorInput): Promise<void> {
    try {
        const data = await getLogData(env);
        const logEntry: LogEntry = {
            id: randomId(),
            ts: new Date().toISOString(),
            level: entry?.level || 'error',
            route: safeString(entry?.route),
            method: safeString(entry?.method),
            message: safeString(entry?.message),
            detail: safeString(entry?.detail),
        };
        data.logs.unshift(logEntry);
        if (data.logs.length > MAX_LOGS) {
            data.logs = data.logs.slice(0, MAX_LOGS);
        }
        await saveLogData(env, data);
    } catch {
        // Swallow logging errors
    }
}

export async function getLogs(env: Env, limit = 100): Promise<LogEntry[]> {
    const data = await getLogData(env);
    return data.logs.slice(0, Math.max(1, Math.min(limit, MAX_LOGS)));
}

export async function clearLogs(env: Env): Promise<void> {
    await saveLogData(env, { version: 1, updatedAt: new Date().toISOString(), logs: [] });
}
