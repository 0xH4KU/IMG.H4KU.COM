# Staging Environment Verification

## Overview

Before deploying significant changes to production, verify on staging environment.

## Staging Setup

### Option 1: Cloudflare Pages Preview

Every push to a non-main branch creates a preview deployment:

```
https://<branch>.<project>.pages.dev
```

### Option 2: Local Development

```bash
# Start local dev server
npm run dev

# Test with local backend
wrangler pages dev dist --local
```

### Option 3: Dedicated Staging Environment

Create a separate Pages project with staging R2 bucket:

```bash
# Deploy to staging
wrangler pages deploy dist --project-name img-h4ku-staging
```

---

## Verification Checklist

### Before Staging Deploy

- [ ] All tests pass locally (`npm run test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in dev mode

### Staging Verification

Run the [Quick Smoke Test](./REGRESSION.md#quick-smoke-test-5-min):

1. [ ] Login
2. [ ] Upload an image
3. [ ] Add a tag
4. [ ] Create a delivery
5. [ ] Open share link in incognito
6. [ ] Delete the image
7. [ ] Restore from trash
8. [ ] Logout

### For Major Changes

Run full [Regression Test](./REGRESSION.md).

---

## Production Deploy Criteria

Deploy to production only when:

- [ ] Staging smoke test passes
- [ ] No new console errors
- [ ] Performance is acceptable
- [ ] All team members approved (if applicable)

---

## Post-Production Verification

After production deploy:

1. Run quick smoke test on production
2. Monitor error logs for 30 minutes
3. Check Cloudflare Analytics for anomalies

---

## Rollback Trigger

Rollback immediately if:

- Authentication is broken
- Uploads fail
- Error rate spikes
- Core functionality is unavailable

See [Rollback Strategy](./ROLLBACK.md) for procedures.
