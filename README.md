# IMG.H4KU.COM

Private image hosting service built on Cloudflare Pages + R2. Zero server cost.

## Features

### Core Features
- **Drag & Drop Upload** — Multi-file batch upload support (up to 50MB per file)
- **Folder Organization** — Auto-create folders with R2 prefix management
- **Dual View Modes** — Grid (icon) / List view with virtual scroll
- **Grouping & Sorting** — By file type, upload date, or tags
- **Search & Filter** — Quick search across images and folders
- **Finder-style Tags** — 7 colors (red, orange, yellow, green, blue, purple, gray)
- **Favorites** — Quick access to frequently used images
- **Cloud Sync** — Tags and favorites stored in R2, available across devices
- **Multi-domain** — Generate links for different domains from same R2 bucket
- **Responsive** — Mobile-optimized with slide-out sidebar
- **Light / Dark Theme** — Auto-detects system preference, manually switchable
- **Thumbnails** — Client-side thumbnail generation for faster browsing

### Sharing & Delivery
- **Password-Protected Shares** — Create secure delivery links for images or folders
- **Batch Download** — Download multiple images or entire folders as ZIP
- **Delivery Pages** — Share collections with custom titles and descriptions
- **Share Management** — Revoke or manage active delivery links

### Batch Operations
- **Batch Rename** — Rename multiple files with find/replace and prefix/suffix
- **Batch Move** — Move images between folders while preserving metadata
- **Batch Delete** — Delete multiple images at once (moves to trash)
- **Batch Tag Management** — Add or remove tags from multiple images

### Trash (Recycle Bin)
- **Soft Delete** — Deleted images move to trash instead of permanent removal
- **Restore** — Recover trashed images to their original folders
- **Permanent Delete** — Permanently remove selected items or empty trash

### Maintenance & Monitoring
- **R2 Storage Monitoring** — Track usage, object count, and set alert thresholds
- **Temp Folder Cleanup** — Auto-delete files older than 30 days in temp folders
- **Duplicate Detection** — Find duplicate images by hash
- **Broken Link Check** — Identify orphaned metadata
- **Metadata Export** — Backup tags and favorites data
- **Error Tracking** — Frontend errors sent to backend logs

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | CSS Modules + CSS Variables |
| Icons | Lucide React |
| Virtual List | @tanstack/react-virtual |
| ZIP | fflate |
| Backend | Cloudflare Pages Functions |
| Storage | Cloudflare R2 |
| CDN | Cloudflare (R2 Custom Domain) |

## Quick Start

```bash
# Install dependencies
npm install

# Development (frontend only)
npm run dev

# Build
npm run build

# Full development with API
npx wrangler pages dev dist --port 8788

# Run tests
npm run test
```

## Documentation

- [Development Guide](./docs/DEVELOPMENT.md) — Local setup, project structure, env vars, troubleshooting
- [Deployment Guide](./docs/DEPLOYMENT.md) — Cloudflare Pages + R2 deployment, rollback strategy
- [API Reference](./docs/API.md) — REST API endpoints
- [Admin Guide](./docs/ADMIN.md) — Sharing, batch operations, trash, regression tests

## Architecture

```
Image Access (read):
  User → Cloudflare CDN → img.h4ku.com (R2 Custom Domain) → R2 Bucket

Admin Panel (write):
  User → admin.img.h4ku.com (Cloudflare Pages) → Pages Functions → R2 Bucket
```

## Roadmap

- [ ] 前端 hooks 單元測試（`useImageActions`、`useImageSelection` 等）
- [ ] 圖片上傳/交付支援 WebP/AVIF 格式轉換
- [ ] Share 頁面 `<img>` 加入 `srcSet` 支援 responsive images

## License

GPL-3.0 — See [LICENSE](./LICENSE) for details.
