/// <reference types="@cloudflare/workers-types" />

// ─── Env ────────────────────────────────────────────────────────────────
export interface Env {
    R2: R2Bucket;
    ADMIN_PASSWORD: string;
    JWT_SECRET?: string;
    DOMAINS?: string;
    LEGACY_TOKEN_UNTIL?: string;
    DEV_BYPASS_AUTH?: string;
    TOKEN_TTL_DAYS?: string;
}

// ─── Image Metadata ─────────────────────────────────────────────────────
export interface ImageMetaEntry {
    tags?: string[];
    favorite?: boolean;
}

export interface ImageMeta {
    version: number;
    updatedAt: string;
    images: Record<string, ImageMetaEntry>;
}

// ─── Hash Metadata ──────────────────────────────────────────────────────
export interface HashMetaEntry {
    hash?: string;
    size?: number | null;
    uploadedAt?: string | null;
}

export interface HashMeta {
    version: number;
    updatedAt: string;
    hashes: Record<string, HashMetaEntry>;
}

// ─── Share Metadata ─────────────────────────────────────────────────────
export interface ShareMetaEntry {
    id?: string;
    title?: string;
    description?: string;
    items?: string[];
    createdAt?: string;
    updatedAt?: string;
    passwordHash?: string;
    passwordSalt?: string;
    domain?: 'h4ku' | 'lum';
    folder?: string;
}

export interface ShareMeta {
    version: number;
    updatedAt: string;
    shares: Record<string, ShareMetaEntry>;
}

// ─── Folder Metadata ────────────────────────────────────────────────────
export interface FolderMeta {
    version: number;
    updatedAt: string;
    folders: string[];
}

// ─── Maintenance Metadata ───────────────────────────────────────────────
export interface MaintenanceMeta {
    version: number;
    updatedAt: string;
    lastRuns: Record<string, string>;
}

// ─── Auth Metrics ───────────────────────────────────────────────────────
export interface LegacyAuthMetrics {
    count: number;
    lastUsedAt: string | null;
    byDay: Record<string, number>;
}

export interface AuthMetrics {
    version: number;
    updatedAt: string;
    legacy: LegacyAuthMetrics;
}

// ─── Operation ──────────────────────────────────────────────────────────
export type ItemStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface ItemResult {
    key: string;
    status: ItemStatus;
    error?: string;
    data?: Record<string, unknown>;
}

export interface OperationResult {
    operationId: string;
    ok: boolean;
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    details: ItemResult[];
    retryable: string[];
    durationMs: number;
}

// ─── Env Validation ─────────────────────────────────────────────────────
export interface EnvVarCheck {
    name: string;
    required: boolean;
    warning?: string;
}

export interface EnvCheckResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
}

// ─── Log ────────────────────────────────────────────────────────────────
export interface LogEntry {
    id: string;
    ts: string;
    level: string;
    route: string;
    method: string;
    message: string;
    detail: string;
}

export interface LogData {
    version: number;
    updatedAt: string;
    logs: LogEntry[];
}

// ─── Trash ──────────────────────────────────────────────────────────────
export interface TrashResult {
    action: 'moved' | 'deleted' | 'missing';
    from: string;
    to?: string;
}

export interface RestoreResult {
    action: 'restored' | 'not_trash' | 'missing';
    from: string;
    to?: string;
    original?: string;
}

// ─── Key Validation ─────────────────────────────────────────────────────
export type KeyValidation =
    | { ok: true; key: string }
    | { ok: false; reason: string };
