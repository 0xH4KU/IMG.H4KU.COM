# Rollback Strategy

## Quick Rollback (< 5 min)

### 1. Revert Deployment

```bash
# Find previous commit
git log --oneline -10

# Revert to specific commit
git checkout <commit-hash>

# Deploy
npm run deploy
```

### 2. Via Cloudflare Dashboard

1. Go to Cloudflare Dashboard > Pages
2. Select the project
3. Go to Deployments tab
4. Find previous successful deployment
5. Click "Rollback to this deployment"

---

## Token Compatibility

### Issue: New tokens not working after rollback

If you rollback to code that doesn't support v2 tokens:

1. Users with v2 tokens will get 401
2. They need to re-login

### Prevention

- Keep `JWT_SECRET` stable during rollback
- New code should always support old token formats

---

## Data Compatibility

### Metadata Schema Changes

If new code changed metadata structure:

1. **Forward compatible**: Old code can read new data (fields ignored)
2. **Backward compatible**: New code can read old data (normalize fills defaults)

Current schemas use normalize functions that:
- Add missing fields with defaults
- Ignore unknown fields
- Handle type mismatches gracefully

### Emergency Metadata Restore

```bash
# Download current metadata
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}/objects/.config/image-meta.json" \
  -H "Authorization: Bearer {token}" \
  -o backup-image-meta.json

# Restore from backup
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}/objects/.config/image-meta.json" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d @backup-image-meta.json
```

---

## Legacy Token Control

### Enable/Disable Legacy Token Support

Set `LEGACY_TOKEN_UNTIL` environment variable:

```bash
# Allow legacy tokens until specific date
wrangler secret put LEGACY_TOKEN_UNTIL
# Enter: 2025-06-01T00:00:00.000Z

# Block all legacy tokens immediately
wrangler secret put LEGACY_TOKEN_UNTIL
# Enter: 2020-01-01T00:00:00.000Z

# Allow legacy tokens indefinitely (not recommended)
wrangler secret delete LEGACY_TOKEN_UNTIL
```

---

## Emergency Procedures

### Complete Service Outage

1. Check Cloudflare status page
2. Check R2 bucket access
3. Rollback to last known good deployment
4. Check logs for errors

### Authentication Broken

1. Verify `ADMIN_PASSWORD` is set correctly
2. Check `JWT_SECRET` if used
3. Clear browser storage and retry
4. If still broken, rollback code

### Data Corruption

1. Download corrupted file from R2
2. Identify corruption (parse errors, missing fields)
3. Fix manually or restore from backup
4. Upload fixed file
5. Verify in application

---

## Rollback Decision Matrix

| Severity | Impact | Action |
|----------|--------|--------|
| Critical | All users affected | Immediate rollback |
| High | Core feature broken | Rollback within 1 hour |
| Medium | Minor feature broken | Fix forward if possible |
| Low | Cosmetic issue | Fix in next release |

---

## Post-Rollback Checklist

- [ ] Verify core functionality (quick smoke test)
- [ ] Check error logs for new issues
- [ ] Notify team of rollback reason
- [ ] Create issue to track the problem
- [ ] Plan fix for next deployment
