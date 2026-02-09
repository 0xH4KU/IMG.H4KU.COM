# Troubleshooting Guide

## Authentication Issues

### 401 Unauthorized

**Symptoms:**
- "Session expired" message
- Automatic logout
- API requests return 401

**Causes & Solutions:**

1. **Token expired**
   - Default TTL is 30 days
   - Solution: Re-login

2. **Invalid token signature**
   - Token may be corrupted or tampered
   - Solution: Clear browser storage and re-login

3. **Server secret changed**
   - `JWT_SECRET` or `ADMIN_PASSWORD` was rotated
   - Solution: All users must re-login

4. **Legacy token blocked**
   - `LEGACY_TOKEN_UNTIL` date has passed
   - Solution: Re-login to get a new v2 token

**Debug Steps:**
```javascript
// Check token in browser console
localStorage.getItem('auth_token')

// Decode token payload (base64url)
const [payload] = token.split('.');
JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
```

---

## Upload Issues

### Upload Fails Silently

**Causes & Solutions:**

1. **File too large**
   - Cloudflare Pages limit: 100MB
   - Solution: Compress or split the file

2. **Invalid file name**
   - Special characters in filename
   - Solution: Rename file with alphanumeric characters

3. **Network timeout**
   - Slow connection
   - Solution: Retry or use smaller file

4. **R2 binding missing**
   - Check wrangler.toml configuration
   - Solution: Verify R2 bucket binding

### Thumbnail Not Generated

**Causes:**
- Browser doesn't support canvas operations
- Image format not supported for thumbnail generation

**Solution:**
- Original image is still uploaded; thumbnail will be missing

---

## Share/Delivery Issues

### Share Link Returns 404

**Causes & Solutions:**

1. **Share was revoked**
   - Check Share Manager for active deliveries

2. **Share metadata corrupted**
   - Rare: `.config/share-meta.json` may be damaged
   - Solution: Re-create the delivery

3. **Items were deleted**
   - Source images moved to trash or deleted
   - Solution: Restore images and re-create delivery

### Password-Protected Share Not Working

**Causes:**
- Incorrect password
- Share was updated without password

**Debug:**
- Check share metadata via API: `/api/share/[id]`

---

## Metadata Issues

### Tags/Favorites Not Saving

**Causes & Solutions:**

1. **Concurrent updates**
   - Multiple tabs updating same metadata
   - Solution: Refresh and retry

2. **R2 write failure**
   - Temporary R2 issue
   - Solution: Retry after a few seconds

3. **Metadata file corrupted**
   - `.config/image-meta.json` has invalid JSON
   - Solution: Download, fix, and re-upload via R2 console

### Images Missing Metadata

**Causes:**
- Images uploaded before metadata system
- Metadata normalize failed to backfill

**Solution:**
- Metadata will be created on first tag/favorite action

---

## Performance Issues

### Slow Image Loading

**Causes & Solutions:**

1. **No thumbnails**
   - Check `.thumbs/` folder in R2
   - Solution: Re-upload images to generate thumbnails

2. **Large original files**
   - Thumbnails missing, loading full images
   - Solution: Use maintenance tools to generate missing thumbnails

3. **CDN cache miss**
   - First load after deployment
   - Solution: Wait for cache to warm up

### Virtual List Flickering

**Causes:**
- Row height calculation mismatch
- Rapid scroll events

**Solution:**
- This was fixed in the recent refactor; ensure latest code is deployed

---

## Recovery Procedures

### Reset Authentication

```bash
# Rotate the admin password
wrangler secret put ADMIN_PASSWORD

# Optional: Set new JWT secret to invalidate all tokens
wrangler secret put JWT_SECRET
```

### Restore Metadata from Backup

1. Download current `.config/*.json` files from R2
2. Fix or restore from backup
3. Upload back to R2 via dashboard

### Emergency Rollback

1. Revert to previous git commit
2. Re-deploy: `npm run deploy`
3. Verify functionality

---

## Contact

For issues not covered here, check:
- GitHub Issues
- Cloudflare R2/Pages status page
