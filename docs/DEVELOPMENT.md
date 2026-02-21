# Development Guide

## Prerequisites

- Node.js 22+
- npm
- Cloudflare account (for R2 and Pages)

## Local Development

### Frontend Only (Hot Reload)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. API calls will fail without backend.

### Full Stack (with API)

```bash
npm run build
npx wrangler pages dev dist --port 8788
```

Opens at `http://localhost:8788`. Includes Functions and R2 binding.

---

## Project Structure

```
img.h4ku.com/
├── functions/                        # Cloudflare Pages Functions (backend)
│   ├── _types/
│   │   └── index.ts                 # Shared type definitions (ImageMeta, ShareMeta, etc.)
│   ├── _utils/
│   │   ├── auth.ts                  # Token signing/verification (HMAC-SHA256)
│   │   ├── env.js                   # Environment variable helpers
│   │   ├── keys.ts                  # Key/path sanitize & validation
│   │   ├── log.js                   # Error logging utilities
│   │   ├── meta.ts                  # Metadata CRUD & normalize
│   │   ├── operation.js             # Bulk operation helpers
│   │   ├── r2.ts                    # R2 bucket helpers
│   │   └── trash.js                 # Trash (soft delete) utilities
│   └── api/
│       ├── auth.js                  # Login (POST /api/auth)
│       ├── auth/verify.js           # Token verification
│       ├── file.js                  # Image proxy (dev only)
│       ├── folders.js               # Folder CRUD
│       ├── images.js                # Image list/delete
│       ├── images/
│       │   ├── batch.js             # Batch delete
│       │   ├── move.js              # Batch move
│       │   └── rename.js            # Batch rename
│       ├── logs.js                  # Error log management
│       ├── maintenance/
│       │   ├── broken-links.js      # Broken link check
│       │   ├── duplicates.js        # Duplicate detection
│       │   ├── export.js            # Metadata export
│       │   ├── orphans.js           # Orphan metadata cleanup
│       │   └── temp.js              # Temp folder cleanup
│       ├── metadata.js              # Tags & favorites CRUD
│       ├── metadata/batch.js        # Batch tag operations
│       ├── monitoring/r2.js         # R2 storage monitoring
│       ├── share/[id].js            # Public share access
│       ├── shares.js                # Share management
│       └── upload.js                # Image upload
├── src/
│   ├── components/
│   │   ├── AdminToolsModal.tsx      # Maintenance tools modal
│   │   ├── BulkMoveModal.tsx        # Batch move dialog
│   │   ├── BulkRenameModal.tsx      # Batch rename dialog
│   │   ├── ConfirmModal.tsx         # Generic confirm dialog
│   │   ├── ErrorBoundary.tsx        # React error boundary
│   │   ├── FilterBar.tsx            # Search & filter bar
│   │   ├── FolderNav.tsx            # Sidebar folder navigation
│   │   ├── GroupSelector.tsx        # Grouping dropdown
│   │   ├── Header.tsx               # Top navigation bar
│   │   ├── ImageContextMenu.tsx     # Right-click context menu
│   │   ├── ImageGrid.tsx            # Main image grid/list view
│   │   ├── ShareManagerModal.tsx    # Active shares management
│   │   ├── ShareModal.tsx           # Create share/delivery
│   │   ├── TagDots.tsx              # Tag color indicators
│   │   ├── TextPromptModal.tsx      # Generic text input dialog
│   │   ├── Uploader.tsx             # Drag-and-drop upload
│   │   └── ViewToggle.tsx           # Grid/List view switcher
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Authentication state
│   │   └── ImageMetaContext.tsx     # Tags/favorites state & sync
│   ├── hooks/
│   │   ├── useApiAction.ts         # Generic API action wrapper
│   │   ├── useDialogs.ts           # Confirm/prompt dialog hooks
│   │   ├── useFocusTrap.ts         # Modal focus trap
│   │   ├── useImageActions.ts      # Image CRUD operations
│   │   ├── useImageGridData.ts     # Grid data processing
│   │   ├── useImageGroups.ts       # Image grouping logic
│   │   ├── useImageSelection.ts    # Multi-select state
│   │   └── useTransientMessage.ts  # Auto-dismiss messages
│   ├── pages/
│   │   ├── Admin.tsx               # Admin panel
│   │   ├── Landing.tsx             # Landing page
│   │   ├── Login.tsx               # Login page
│   │   └── Share.tsx               # Public share page
│   ├── styles/
│   │   └── global.css              # Global styles & utilities
│   ├── utils/
│   │   ├── api.ts                  # Centralized API client
│   │   ├── api-error.ts            # API error class
│   │   ├── brand.ts                # Branding constants
│   │   ├── errorTracking.ts        # Frontend error tracking
│   │   ├── errors.ts               # Error display utilities
│   │   ├── format.ts               # formatBytes, formatDate, etc.
│   │   ├── keys.ts                 # Frontend key/path utilities
│   │   ├── shareApi.ts             # Public share API client
│   │   ├── storage.ts              # localStorage/sessionStorage wrapper
│   │   ├── thumbnail.ts            # Client-side thumbnail generation
│   │   ├── url.ts                  # Domain & URL helpers
│   │   └── zip.ts                  # ZIP download (fflate)
│   ├── App.tsx                     # Route entry
│   ├── main.tsx                    # App entry
│   └── types.ts                    # Shared frontend types
├── tests/
│   ├── auth.test.mjs               # Auth/token tests
│   ├── keys.test.mjs               # Key sanitize tests
│   ├── images.test.mjs             # Image API tests
│   ├── meta-cascade.test.mjs       # Metadata cascade tests
│   ├── e2e-smoke.test.mjs          # E2E smoke tests
│   ├── api-client.test.mjs         # API client tests
│   └── share-api.test.mjs          # Share API tests
├── index.html                       # HTML template + CSS variables + theme
├── package.json
├── tsconfig.json                    # Frontend TypeScript config
├── tsconfig.functions.json          # Backend TypeScript config
├── tsconfig.node.json               # Vite/Node config
├── eslint.config.js                 # ESLint flat config
├── vite.config.ts
└── wrangler.toml                    # Cloudflare configuration
```

---

## Components Overview

### Core Components

| Component | Description |
|-----------|-------------|
| `ImageGrid` | Main image display with grid/list view, grouping, filtering, virtual scroll, batch selection |
| `FolderNav` | Sidebar navigation with folders, favorites, tag filters, folder CRUD |
| `Uploader` | Drag-and-drop upload with progress, folder upload, thumbnail generation |
| `Header` | Top bar with domain switch, theme toggle, search, tools, shares, logout |
| `FilterBar` | Search and filter controls |

### Modal Components

| Component | Description |
|-----------|-------------|
| `AdminToolsModal` | Maintenance tools (temp cleanup, duplicates, broken links, export) |
| `BulkRenameModal` | Batch rename with find/replace and prefix/suffix |
| `BulkMoveModal` | Batch move to target folder |
| `ShareModal` | Create password-protected share/delivery links |
| `ShareManagerModal` | View and manage active deliveries |
| `ConfirmModal` | Generic confirm dialog (replaces `window.confirm`) |
| `TextPromptModal` | Generic text input dialog (replaces `window.prompt`) |

### Supporting Components

| Component | Description |
|-----------|-------------|
| `ImageContextMenu` | Right-click menu for image actions |
| `TagDots` | Tag color indicators |
| `ViewToggle` | Grid/List view switcher |
| `GroupSelector` | Grouping mode dropdown |
| `ErrorBoundary` | React error boundary to prevent white screens |

---

## Custom Hooks

| Hook | Description |
|------|-------------|
| `useImageActions` | Image CRUD: delete, rename, move, trash, restore |
| `useImageSelection` | Multi-select state with shift-click support |
| `useImageGridData` | Grid data processing and filtering |
| `useImageGroups` | Group images by type, date, or tag |
| `useDialogs` | `useConfirmDialog` / `usePromptDialog` for modal dialogs |
| `useTransientMessage` | Auto-dismiss messages with timer cleanup |
| `useFocusTrap` | Focus trap for modal accessibility |
| `useApiAction` | Generic async API action wrapper |

---

## Context Providers

### AuthContext

```typescript
const { isAuthenticated, login, logout } = useAuth();
```

### ImageMetaContext

```typescript
const {
  getTags, isFavorite,
  toggleTag, toggleFavorite,
  getFavoriteCount, getTagCount
} = useImageMeta();
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `R2` | Cloudflare R2 bucket binding | *(Configured in wrangler.toml)* |
| `ADMIN_PASSWORD` | Admin login password | `your-secure-password` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for token signing | Falls back to `ADMIN_PASSWORD` |
| `TOKEN_TTL_DAYS` | Token expiration in days | `30` |
| `LEGACY_TOKEN_UNTIL` | Cutoff date for legacy tokens | *(none)*, ISO 8601 |
| `DEV_BYPASS_AUTH` | Skip auth in development | `false` |
| `DOMAINS` | Comma-separated image domains | In `wrangler.toml` |

### R2 Monitoring Thresholds

| Variable | Description |
|----------|-------------|
| `R2_MAX_BYTES` / `R2_WARN_BYTES` / `R2_ALERT_BYTES` | Storage limits |
| `R2_MAX_COUNT` / `R2_WARN_COUNT` / `R2_ALERT_COUNT` | Object count limits |

### Configuration Example (wrangler.toml)

```toml
name = "img-h4ku"
compatibility_date = "2024-12-30"
pages_build_output_dir = "dist"

[[r2_buckets]]
binding = "R2"
bucket_name = "img-h4ku"

[vars]
DOMAINS = "img.h4ku.com,img.lum.bio"
```

Secrets should be set via Dashboard or CLI:

```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET
```

### Security Notes

1. **Never commit secrets** — Use Cloudflare dashboard or `wrangler secret`
2. **Rotate `ADMIN_PASSWORD` periodically**
3. **Set `JWT_SECRET` separately** — Allows password rotation without invalidating tokens

---

## Styling

### Theme System

CSS variables are defined in `index.html` with `[data-theme='light']` / `[data-theme='dark']` selectors. Theme is auto-detected from `prefers-color-scheme` and persisted in `localStorage`.

### CSS Modules

Each component has its own `.module.css` file:

```tsx
import styles from './Component.module.css';

<div className={styles.container}>...</div>
```

---

## TypeScript Configuration

| Config | Scope | Notes |
|--------|-------|-------|
| `tsconfig.json` | `src/` (frontend) | Strict mode, React JSX |
| `tsconfig.functions.json` | `functions/` (backend) | `allowJs: true`, Workers types |
| `tsconfig.node.json` | Vite config | Node types |

Backend utils (`_utils/`) have been fully migrated to TypeScript. Route handlers remain as JavaScript with JSDoc.

---

## Build & Scripts

```bash
npm run dev          # Vite dev server (frontend only)
npm run build        # tsc + vite build
npm run test         # Node test runner (7 test suites)
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
npm run deploy       # wrangler pages deploy
```

Pre-commit hooks (`husky` + `lint-staged`): ESLint fix + type-check on staged files.

---

## Testing

### Automated Tests (7 suites)

```bash
npm run test
```

| Test File | Coverage |
|-----------|----------|
| `auth.test.mjs` | Token signing, verification, legacy support |
| `keys.test.mjs` | Key sanitize, path validation |
| `images.test.mjs` | Image API (list, delete, batch) |
| `meta-cascade.test.mjs` | Metadata cascade on delete/restore |
| `e2e-smoke.test.mjs` | Upload → list → delete → trash flow |
| `api-client.test.mjs` | API client utilities |
| `share-api.test.mjs` | Share API endpoints |

### Manual Testing Checklist

See [Admin Guide — Regression Test](./ADMIN.md#regression-test-checklist).

---

## Staging Verification

### Option 1: Cloudflare Pages Preview

Every push to a non-main branch creates a preview deployment:

```
https://<branch>.<project>.pages.dev
```

### Option 2: Local Development

```bash
npm run build
wrangler pages dev dist --local
```

### Before Deploy Checklist

- [ ] `npm run test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] No console errors in dev mode

---

## Troubleshooting

### 401 Unauthorized

| Cause | Solution |
|-------|----------|
| Token expired (default 30 days) | Re-login |
| Token corrupted | Clear browser storage, re-login |
| `JWT_SECRET` rotated | All users must re-login |
| Legacy token blocked | Re-login for v2 token |

Debug in browser console:

```javascript
localStorage.getItem('auth_token')
```

### Upload Fails

| Cause | Solution |
|-------|----------|
| File too large (limit: 100MB) | Compress or split |
| Invalid file name | Use alphanumeric characters |
| R2 binding missing | Check `wrangler.toml` |

### Share Link Returns 404

| Cause | Solution |
|-------|----------|
| Share revoked | Check Share Manager |
| Source images deleted | Restore from trash, re-create delivery |
| Metadata corrupted | Re-create the delivery |

### Tags/Favorites Not Saving

| Cause | Solution |
|-------|----------|
| Concurrent updates (multiple tabs) | Refresh and retry |
| R2 write failure | Retry after a few seconds |
| Metadata corrupted | Download, fix, re-upload via R2 console |

### Slow Image Loading

| Cause | Solution |
|-------|----------|
| Missing thumbnails | Re-upload to generate thumbnails |
| CDN cache miss | Wait for cache warm-up |

### Recovery Procedures

```bash
# Reset authentication
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET  # invalidates all tokens

# Emergency rollback
git log --oneline -10
git checkout <commit-hash>
npm run deploy
```

Metadata restore: download `.config/*.json` from R2, fix or restore, re-upload via dashboard.
