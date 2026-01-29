# Cloudflare Deployment Guide

Complete guide to deploy IMG on Cloudflare Pages with R2 storage.

## Domain Architecture

R2 and Pages cannot share the same domain. Use separate subdomains:

| Service | Domain | Purpose |
|---------|--------|---------|
| R2 Custom Domain | `img.h4ku.com` | Direct image serving |
| R2 Custom Domain | `img.lum.bio` | Alternative image domain |
| Cloudflare Pages | `admin.img.h4ku.com` | Admin panel |

## Prerequisites

- Cloudflare account
- Domain added to Cloudflare
- Git repository (GitHub/GitLab) for CI/CD deployment

## Step 1: Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Enter bucket name (e.g., `img-h4ku`)
5. Select region (choose closest to your users)
6. Click **Create bucket**

## Step 2: Configure R2 Custom Domains

This allows direct image access without Worker overhead.

1. In R2 bucket details, click **Settings**
2. Find **Custom Domains** section
3. Click **Connect Domain**
4. Enter `img.h4ku.com`
5. Wait for status to show **Active**
6. Repeat for `img.lum.bio` if needed

## Step 3: Create Pages Project

### Option A: Git Integration (Recommended)

1. Push code to GitHub/GitLab
2. Go to Cloudflare Dashboard → **Workers & Pages**
3. Click **Create** → **Pages** → **Connect to Git**
4. Select repository and authorize
5. Configure build settings:
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. Click **Save and Deploy**

### Option B: Direct Upload

```bash
npm run build
npx wrangler pages deploy dist --project-name=img-h4ku
```

## Step 4: Bind R2 Bucket

1. Go to Pages project → **Settings** → **Functions**
2. Find **R2 bucket bindings**
3. Click **Add binding**
4. Configure:
   - **Variable name**: `R2`
   - **R2 bucket**: Select your bucket
5. Click **Save**

## Step 5: Set ADMIN_PASSWORD as Secret

Since `DOMAINS` is managed in `wrangler.toml`, only `ADMIN_PASSWORD` needs to be set as a Secret (encrypted) in Dashboard.

1. Go to Pages project → **Settings** → **Environment variables**
2. Under **Secrets**, click **Add**
3. Add:
   - **Name**: `ADMIN_PASSWORD`
   - **Value**: Your password
4. Click **Save**

Alternatively via Wrangler CLI:

```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name=img-h4ku
```

## Step 6: Configure Custom Domain (Admin Panel)

**Important**: Use a different subdomain than R2.

1. Go to Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter `admin.img.h4ku.com`
4. Follow DNS configuration prompts
5. Wait for SSL certificate to activate

## Step 7: Verify Deployment

1. Visit `https://admin.img.h4ku.com/admin`
2. Log in with your password
3. Upload a test image
4. Copy image link → should point to `https://img.h4ku.com/...`
5. Open the link to verify R2 serving works

## Configuration Reference

### wrangler.toml

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

### Required Bindings

| Binding | Type | Description |
|---------|------|-------------|
| `R2` | R2 Bucket | Image storage |

### Environment Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `ADMIN_PASSWORD` | Secret | Yes | Set via Dashboard or `wrangler secret` |
| `DOMAINS` | Var | No | In `wrangler.toml`, comma-separated |
| `JWT_SECRET` | Secret | No | Defaults to ADMIN_PASSWORD |

## Updating Deployment

### With Git Integration

Push to your repository. Cloudflare automatically rebuilds and deploys.

### Manual Update

```bash
npm run build
npx wrangler pages deploy dist --project-name=img-h4ku
```

## Troubleshooting

### Images not loading

- Check R2 custom domain is **Active**
- Verify CORS settings if accessing from different domain
- Check browser console for specific errors

### API returns 401 Unauthorized

- Verify `ADMIN_PASSWORD` secret is set in Dashboard
- Check token hasn't expired (24-hour validity)
- Try logging out and back in

### Upload fails

- Check R2 binding is configured correctly
- Verify file is an allowed image type
- Check file size (max 20MB)

### Functions not working

- Ensure `functions/` directory is in repository root
- Check Cloudflare Dashboard → Pages → Functions for errors

### Domain conflict

R2 custom domain and Pages custom domain **cannot** be the same hostname. Use `admin.img.h4ku.com` for Pages and `img.h4ku.com` for R2.

## Cost Estimation

Cloudflare Free Tier includes:

| Resource | Free Allowance |
|----------|----------------|
| Pages | Unlimited sites, 500 builds/month |
| R2 Storage | 10 GB |
| R2 Operations | 1M Class A, 10M Class B |
| Workers (Functions) | 100K requests/day |

For personal use, this is typically sufficient at $0 cost.

## Security Recommendations

1. **Use strong password** - At least 16 characters
2. **Enable 2FA** on Cloudflare account
3. **Don't commit secrets** - Use `wrangler secret` or Dashboard Secrets
4. **Review access logs** - Monitor for unauthorized access
5. **Regular backups** - Export R2 data periodically
