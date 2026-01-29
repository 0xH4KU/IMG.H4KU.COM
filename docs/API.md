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

**Response** (200 OK):
```json
{
  "images": [
    {
      "key": "screenshots/1m2n3b4-image.png",
      "size": 102400,
      "uploaded": "2026-01-29T12:00:00.000Z"
    }
  ]
}
```

### Delete Image

```http
DELETE /api/images?key=screenshots/1m2n3b4-image.png
Authorization: Bearer <token>
```

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `key` | string | Required. Full image key |

**Response** (200 OK):
```json
{
  "deleted": "screenshots/1m2n3b4-image.png"
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

**Max Size**: 20 MB

**Response** (200 OK):
```json
{
  "key": "screenshots/1m2n3b4-filename.png",
  "size": 102400,
  "type": "image/png"
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
    "screenshots/1m2n3b4-image.png": {
      "tags": ["red", "blue"],
      "favorite": true
    },
    "wallpaper/5k6j7h8-bg.jpg": {
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
  "key": "screenshots/1m2n3b4-image.png",
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
DELETE /api/metadata?key=screenshots/1m2n3b4-image.png
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "ok": true
}
```

## File Proxy (Development Only)

### Get Image File

```http
GET /api/file?key=screenshots/1m2n3b4-image.png
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

Cloudflare Workers free tier:
- 100,000 requests/day
- 10ms CPU time per request

For typical personal use, these limits are not reached.
