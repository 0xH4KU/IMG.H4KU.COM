# IMG.H4KU.COM

Private image hosting service built on Cloudflare Pages + R2. Zero server cost.

## Features

### Core Features
- **Drag & Drop Upload** - Multi-file batch upload support (up to 50MB per file)
- **Folder Organization** - Auto-create folders with R2 prefix management
- **Dual View Modes** - Grid (icon) / List view
- **Grouping & Sorting** - By file type, upload date, or tags
- **Finder-style Tags** - 6 colors (red, orange, yellow, green, blue, purple)
- **Favorites** - Quick access to frequently used images
- **Cloud Sync** - Tags and favorites stored in R2, available across devices
- **Multi-domain** - Generate links for different domains from same R2 bucket
- **Responsive** - Mobile-optimized with slide-out sidebar

### Sharing & Delivery
- **Password-Protected Shares** - Create secure delivery links for images or folders
- **Batch Download** - Download multiple images or entire folders as ZIP
- **Delivery Pages** - Share collections with custom titles and descriptions
- **Share Management** - Revoke or manage active delivery links

### Batch Operations
- **Batch Rename** - Rename multiple files with find/replace and prefix/suffix
- **Batch Move** - Move images between folders while preserving metadata
- **Batch Delete** - Delete multiple images at once
- **Batch Tag Management** - Add or remove tags from multiple images

### Maintenance & Monitoring
- **R2 Storage Monitoring** - Track usage, object count, and set alert thresholds
- **Temp Folder Cleanup** - Auto-delete files older than 30 days in temp folders
- **Duplicate Detection** - Find duplicate images by hash
- **Broken Link Check** - Identify orphaned metadata
- **Metadata Export** - Backup tags and favorites data

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | CSS Modules + CSS Variables |
| Icons | Lucide React |
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
```

## Documentation

- [Development Guide](./docs/DEVELOPMENT.md) - Local setup, project structure, components
- [Deployment Guide](./docs/DEPLOYMENT.md) - Cloudflare Pages + R2 deployment
- [API Reference](./docs/API.md) - REST API endpoints
- [Admin Guide](./docs/ADMIN.md) - Sharing, batch operations, tools

## Architecture

```
Image Access (read):
  User → Cloudflare CDN → img.h4ku.com (R2 Custom Domain) → R2 Bucket

Admin Panel (write):
  User → admin.img.h4ku.com (Cloudflare Pages) → Pages Functions → R2 Bucket
```

## License

Private Project - All Rights Reserved
