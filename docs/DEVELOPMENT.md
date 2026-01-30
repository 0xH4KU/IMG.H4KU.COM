# Development Guide

## Prerequisites

- Node.js 18+
- npm / pnpm / yarn
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

## Project Structure

```
img.h4ku.com/
├── functions/                  # Cloudflare Pages Functions
│   ├── _utils/
│   │   ├── log.js             # Error logging utilities
│   │   └── meta.js            # Metadata management utilities
│   └── api/
│       ├── auth.js            # Login authentication
│       ├── auth/verify.js     # Token verification
│       ├── file.js            # Image proxy (dev only)
│       ├── folders.js         # Folder listing
│       ├── images.js          # Image list/delete
│       ├── images/
│       │   ├── batch.js       # Batch delete images
│       │   ├── move.js        # Batch move images
│       │   └── rename.js      # Batch rename images
│       ├── logs.js            # Error log management
│       ├── maintenance/
│       │   ├── broken-links.js # Check for broken links
│       │   ├── duplicates.js  # Duplicate detection
│       │   ├── export.js      # Metadata export
│       │   ├── orphans.js     # Orphan metadata cleanup
│       │   └── temp.js        # Temp folder cleanup
│       ├── metadata.js        # Tags and favorites
│       ├── metadata/batch.js  # Batch tag operations
│       ├── monitoring/r2.js   # R2 storage monitoring
│       ├── share/[id].js      # Public share access
│       ├── shares.js          # Share management
│       └── upload.js          # Image upload
├── src/
│   ├── components/            # React components
│   │   ├── FolderNav.tsx      # Sidebar folder navigation
│   │   ├── GroupSelector.tsx  # Grouping dropdown
│   │   ├── Header.tsx         # Top navigation bar
│   │   ├── ImageContextMenu.tsx # Right-click menu
│   │   ├── ImageGrid.tsx      # Image grid/list view
│   │   ├── TagDots.tsx        # Tag color dots
│   │   ├── Uploader.tsx       # Upload component
│   │   └── ViewToggle.tsx     # View mode toggle
│   ├── contexts/              # React Context providers
│   │   ├── AuthContext.tsx    # Authentication state
│   │   └── ImageMetaContext.tsx # Tags/favorites state
│   ├── modals/                # Modal components
│   │   ├── BatchRenameModal.tsx # Batch rename dialog
│   │   ├── DeliveryModal.tsx  # Share/delivery creation
│   │   ├── DeliveryListModal.tsx # Active shares list
│   │   └── ToolsModal.tsx     # Maintenance tools
│   ├── pages/                 # Page components
│   │   ├── Admin.tsx          # Admin panel
│   │   ├── Landing.tsx        # Landing page
│   │   ├── Login.tsx          # Login page
│   │   └── Share.tsx          # Public share page
│   ├── utils/                 # Utility functions
│   │   └── zip.ts             # ZIP download utilities
│   ├── App.tsx                # Route entry
│   └── main.tsx               # App entry
├── index.html                 # HTML template + CSS variables
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml              # Cloudflare configuration
```

## Components Overview

### Core Components

| Component | Description |
|-----------|-------------|
| `ImageGrid` | Main image display, supports grid/list view, grouping, filtering, batch selection |
| `FolderNav` | Sidebar navigation with folders, favorites, and tag filters |
| `Uploader` | Drag-and-drop file upload with progress tracking and folder upload support |
| `Header` | Top bar with logo, domain switch, theme toggle, tools, deliveries, logout |

### Supporting Components

| Component | Description |
|-----------|-------------|
| `ImageContextMenu` | Right-click menu for image actions (copy link, rename, delete, etc.) |
| `TagDots` | Displays tag color indicators |
| `ViewToggle` | Grid/List view switcher |
| `GroupSelector` | Grouping mode dropdown |

### Modal Components

| Component | Description |
|-----------|-------------|
| `BatchRenameModal` | Batch rename with find/replace and prefix/suffix options |
| `DeliveryModal` | Create password-protected share links for images or folders |
| `DeliveryListModal` | View and manage active delivery links |
| `ToolsModal` | Maintenance tools (temp cleanup, duplicates, broken links, export) |

## Context Providers

### AuthContext

Manages authentication state and token storage.

```typescript
const { isAuthenticated, login, logout } = useAuth();
```

### ImageMetaContext

Manages tags and favorites with cloud sync.

```typescript
const {
  getTags,
  isFavorite,
  toggleTag,
  toggleFavorite,
  getFavoriteCount,
  getTagCount
} = useImageMeta();
```

## Environment Variables

Configure in `wrangler.toml` for development:

```toml
[vars]
ADMIN_PASSWORD = "your-password"
DOMAINS = "img.h4ku.com,img.lum.bio"
```

**Important**: Set production variables in Cloudflare Dashboard, not in code.

## Styling

### CSS Variables

Defined in `index.html`:

```css
:root {
  --color-primary: #c0a88d;
  --color-background: #1a1a1a;
  --color-surface: #0f0f0f;
  --color-border: #333;
  --color-text: #e8e8e8;
  --tag-red: #ff3b30;
  --tag-orange: #ff9500;
  /* ... */
}
```

### CSS Modules

Each component has its own `.module.css` file:

```tsx
import styles from './Component.module.css';

<div className={styles.container}>...</div>
```

## Build

```bash
# Type check and build
npm run build

# Output in dist/
```

Build uses esbuild for minification. Output includes:
- `index.html` - Entry HTML
- `assets/*.js` - Bundled JavaScript (code-split)
- `assets/*.css` - Bundled styles

## Testing

Currently no automated tests. Manual testing checklist:

### Basic Operations
1. Login with password
2. Upload single and multiple images
3. Create folders and upload to specific folder
4. Add/remove tags and favorites
5. Switch between grid and list view
6. Test grouping by type, date, and tag
7. Test on mobile device
8. Verify image links work on production domain

### Batch Operations
9. Select multiple images and batch delete
10. Batch rename with find/replace
11. Batch move to different folder
12. Batch download as ZIP
13. Batch add/remove tags

### Sharing & Delivery
14. Create delivery link for selected images
15. Create delivery link for entire folder
16. Set password on delivery link
17. Access delivery link and verify password protection
18. Revoke delivery link and verify access denied
19. Download all from delivery page

### Maintenance
20. Run temp folder cleanup (30 days)
21. Check R2 storage monitoring displays correct values
22. Run duplicate detection
23. Check for broken links
24. Export metadata backup
25. Clean orphan metadata
