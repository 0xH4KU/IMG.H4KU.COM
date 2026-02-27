# API Reference

All API endpoints require Bearer token authentication unless noted otherwise.

## Authentication

### Login

```http
POST /api/auth
Content-Type: application/json

{
  "password": "your-password"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJleHAiOjE3...abc123"
}
```

**Response** (401 Unauthorized):
```json
"Invalid password"
```

### Verify Token

```http
GET /api/auth/verify
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "valid": true
}
```

## Images

### List Images

```http
GET /api/images?folder=screenshots
Authorization: Bearer <token>
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `folder` | string | Optional. Filter by folder prefix |
| `cursor` | string | Optional. Pagination cursor from previous response |
| `limit` | number | Optional. Max items per page (1-100, default 50) |

**Response** (200 OK):
```json
{
  "images": [
    {
      "key": "screenshots/1m2n3b4_image.png",
      "size": 102400,
      "uploaded": "2026-01-29T12:00:00.000Z"
    }
  ],
  "cursor": null,
  "hasMore": false
}
```

### Delete Image

```http
DELETE /api/images?key=screenshots/1m2n3b4_image.png
Authorization: Bearer <token>
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `key` | string | Required. Full image key |

**Response** (200 OK):
```json
{
  "ok": true,
  "deleted": false,
  "trashed": true,
  "key": "screenshots/1m2n3b4_image.png",
  "to": "trash/screenshots/1m2n3b4_image.png"
}
```

### Upload Image

```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
folder: screenshots
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `file` | File | Required. Image file |
| `folder` | string | Optional. Target folder |

**Supported Types**: JPEG, PNG, GIF, WebP, AVIF, SVG

**Max Size**: 50 MB

**Response** (200 OK):
```json
{
  "key": "screenshots/1m2n3b4_filename.png",
  "size": 102400,
  "type": "image/png"
}
```

**Rate Limit**: 60 uploads per 10 minutes per IP.

### Batch Delete Images

```http
POST /api/images/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "keys": [
    "screenshots/1m2n3b4_image.png",
    "wallpaper/5k6j7h8_bg.jpg"
  ]
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "deleted": 2,
  "metaRemoved": 2
}
```

### Batch Download Images

Download multiple images as a ZIP file. This is handled client-side using `fflate`.

**Client Implementation**:
```typescript
import { zipSync } from 'fflate';

async function downloadAsZip(keys: string[], domain: string) {
  const entries: Record<string, Uint8Array> = {};

  for (const key of keys) {
    const url = `https://${domain}/${key}`;
    const res = await fetch(url);
    if (res.ok) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      const baseName = key.split('/').pop() || key;
      entries[baseName] = buffer;
    }
  }

  const zipped = zipSync(entries, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'images.zip';
  link.click();
}
```

### Batch Rename Images

```http
POST /api/images/rename
Authorization: Bearer <token>
Content-Type: application/json

{
  "renames": [
    { "from": "screenshots/old-name.png", "to": "screenshots/new-name.png" }
  ]
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "renamed": 1,
  "skipped": 0,
  "errors": []
}
```

### Batch Move Images

```http
POST /api/images/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "keys": ["screenshots/old-name.png"],
  "targetFolder": "archive"
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "moved": 1,
  "skipped": 0,
  "errors": []
}
```

## Folders

### List Folders

```http
GET /api/folders
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "folders": ["screenshots", "wallpaper", "icons"]
}
```

**Note**: Folders starting with `.` (like `.config`) are hidden.

## Metadata (Tags & Favorites)

### Get All Metadata

```http
GET /api/metadata
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "version": 1,
  "updatedAt": "2026-01-29T12:00:00.000Z",
  "images": {
    "screenshots/1m2n3b4_image.png": {
      "tags": ["red", "blue"],
      "favorite": true
    },
    "wallpaper/5k6j7h8_bg.jpg": {
      "tags": [],
      "favorite": false
    }
  }
}
```

### Update Image Metadata

```http
PUT /api/metadata
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "screenshots/1m2n3b4_image.png",
  "tags": ["red", "green"],
  "favorite": true
}
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `key` | string | Required. Image key |
| `tags` | string[] | Optional. Tag colors |
| `favorite` | boolean | Optional. Favorite status |

**Valid Tags**: `red`, `orange`, `yellow`, `green`, `blue`, `purple`

**Response** (200 OK):
```json
{
  "ok": true,
  "meta": {
    "tags": ["red", "green"],
    "favorite": true
  }
}
```

### Delete Image Metadata

```http
DELETE /api/metadata?key=screenshots/1m2n3b4_image.png
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "ok": true
}
```

### Batch Update Metadata

```http
POST /api/metadata/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "keys": ["screenshots/a.png", "screenshots/b.png"],
  "action": "add",
  "tags": ["red", "blue"]
}
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `keys` | string[] | Required. Image keys to update |
| `action` | string | Required. "add" or "remove" |
| `tags` | string[] | Optional. Tags to add/remove |

**Response** (200 OK):
```json
{
  "ok": true,
  "updated": 2
}
```

## Shares (Deliveries)

### List Shares

```http
GET /api/shares
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "shares": [
    {
      "id": "a1b2c3d4",
      "title": "Delivery a1b2c3d4",
      "description": "",
      "count": 3,
      "createdAt": "2026-01-29T12:00:00.000Z",
      "updatedAt": "2026-01-29T12:00:00.000Z",
      "hasPassword": true,
      "domain": "h4ku"
    }
  ]
}
```

### Create Share

```http
POST /api/shares
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Client Delivery",
  "description": "Optional notes",
  "items": ["screenshots/a.png", "screenshots/b.png"],
  "password": "optional-password",
  "domain": "h4ku"
}
```

You can also share an entire folder:

```json
{
  "title": "Folder Delivery",
  "folder": "temp",
  "password": "",
  "domain": "h4ku"
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "share": { "id": "a1b2c3d4" },
  "url": "https://share.img.h4ku.com/share/a1b2c3d4"
}
```

### Revoke Share

```http
DELETE /api/shares?id=a1b2c3d4
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{ "ok": true }
```

### Access Share (Public)

```http
GET /api/share/a1b2c3d4
```

If the share is protected, the API returns:

```json
{ "error": "password_required" }
```

### Unlock Share

```http
POST /api/share/a1b2c3d4
Content-Type: application/json

{ "password": "your-password" }
```

**Response** (200 OK):
```json
{
  "share": { "id": "a1b2c3d4" },
  "items": []
}
```

## Monitoring

### R2 Usage

```http
GET /api/monitoring/r2
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "ok": true,
  "total": { "count": 1200, "size": 123456789 },
  "status": { "bytes": "ok", "count": "warn" },
  "thresholds": {
    "maxBytes": null,
    "warnBytes": null,
    "alertBytes": null,
    "maxCount": null,
    "warnCount": null,
    "alertCount": null
  }
}
```

## Maintenance

### Temp Cleanup

```http
POST /api/maintenance/temp?days=30&auto=1&dryRun=0
Authorization: Bearer <token>
```

### Orphan Metadata Cleanup

```http
POST /api/maintenance/orphans
Authorization: Bearer <token>
```

### Broken Links Check

```http
GET /api/maintenance/broken-links
Authorization: Bearer <token>
```

### Duplicate Scan

```http
GET /api/maintenance/duplicates?compute=1&limit=200
Authorization: Bearer <token>
```

### Export Metadata

```http
GET /api/maintenance/export
Authorization: Bearer <token>
```

## Logs

### Get Logs

```http
GET /api/logs?limit=50
Authorization: Bearer <token>
```

### Clear Logs

```http
DELETE /api/logs
Authorization: Bearer <token>
```

## File Proxy (Development Only)

### Get Image File

```http
GET /api/file?key=screenshots/1m2n3b4_image.png
Authorization: Bearer <token>
```

Returns the raw image file. Used in development when R2 custom domain is not available.

## Error Responses

### 400 Bad Request

```json
"Missing key"
```

### 401 Unauthorized

```json
"Unauthorized"
```

### 500 Internal Server Error

```json
"Failed to upload: <error message>"
```

## Token Format

Tokens are custom JWT-like strings:

```
<base64-payload>.<signature>
```

**Payload**:
```json
{
  "exp": 1706544000000  // Expiration timestamp (ms)
}
```

**Validity**: 24 hours from login

## Rate Limits

### Application Rate Limits
| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/upload` | 60 requests | 10 minutes (per IP) |
| `POST /api/share/:id` (password) | 10 attempts | 5 minutes (per IP) |

### Cloudflare Workers Free Tier
- 100,000 requests/day
- 10ms CPU time per request

For typical personal use, these limits are not reached.
