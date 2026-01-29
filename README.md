# IMG.H4KU.COM

Private image hosting service built on Cloudflare Pages + R2. Zero server cost.

## Features

- **Drag & Drop Upload** - Multi-file batch upload support
- **Folder Organization** - Auto-create folders with R2 prefix management
- **Dual View Modes** - Grid (icon) / List view
- **Grouping & Sorting** - By file type, upload date, or tags
- **Finder-style Tags** - 6 colors (red, orange, yellow, green, blue, purple)
- **Favorites** - Quick access to frequently used images
- **Cloud Sync** - Tags and favorites stored in R2, available across devices
- **Multi-domain** - Generate links for different domains from same R2 bucket
- **Responsive** - Mobile-optimized with slide-out sidebar

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

## Architecture

```
Image Access (read):
  User → Cloudflare CDN → img.h4ku.com (R2 Custom Domain) → R2 Bucket

Admin Panel (write):
  User → admin.img.h4ku.com (Cloudflare Pages) → Pages Functions → R2 Bucket
```

## License

Private Project - All Rights Reserved
