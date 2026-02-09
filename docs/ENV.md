# Environment Variables

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `R2` | Cloudflare R2 bucket binding | *(Configured in wrangler.toml)* |
| `ADMIN_PASSWORD` | Admin login password | `your-secure-password` |

## Optional

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `JWT_SECRET` | Secret key for token signing | Falls back to `ADMIN_PASSWORD` | Recommended: use a separate secret |
| `TOKEN_TTL_DAYS` | Token expiration in days | `30` | Valid range: 1-365 |
| `LEGACY_TOKEN_UNTIL` | Cutoff date for legacy tokens | *(none)* | ISO 8601 format, e.g., `2025-03-01T00:00:00.000Z` |
| `DEV_BYPASS_AUTH` | Skip auth in development | `false` | Set to `1` or `true` to enable |

## R2 Monitoring Thresholds

| Variable | Description | Default |
|----------|-------------|---------|
| `R2_MAX_BYTES` | Hard limit for storage | *(none)* |
| `R2_WARN_BYTES` | Warning threshold for storage | *(none)* |
| `R2_ALERT_BYTES` | Alert threshold for storage | *(none)* |
| `R2_MAX_COUNT` | Hard limit for file count | *(none)* |
| `R2_WARN_COUNT` | Warning threshold for file count | *(none)* |
| `R2_ALERT_COUNT` | Alert threshold for file count | *(none)* |

## Security Notes

1. **Never commit secrets** - Use Cloudflare dashboard or `wrangler secret` to set sensitive values
2. **Rotate `ADMIN_PASSWORD` periodically** - Especially after team changes
3. **Set `JWT_SECRET` separately** - Allows password rotation without invalidating existing tokens
4. **Plan legacy token retirement** - Set `LEGACY_TOKEN_UNTIL` after monitoring confirms migration complete

## Configuration Example (wrangler.toml)

```toml
name = "img-h4ku"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "R2"
bucket_name = "your-bucket-name"

[vars]
TOKEN_TTL_DAYS = "30"
```

Secrets should be set via:
```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET
```
