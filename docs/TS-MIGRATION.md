# TypeScript Migration Plan

## Current State

- Frontend: Full TypeScript (`src/**/*.tsx`, `src/**/*.ts`)
- Backend: JavaScript with JSDoc (`functions/**/*.js`)
- Tests: ESM JavaScript (`tests/**/*.mjs`)

## Migration Strategy

### Phase 1: JSDoc Enhancement (Current)

Already completed for critical utils:
- `functions/_utils/auth.js` - `@ts-check` + typedef
- `functions/_utils/meta.js` - `@ts-check` + typedef
- `functions/_utils/keys.js` - `@ts-check`
- `functions/_utils/r2.js` - `@ts-check`

### Phase 2: Shared Types (Next)

Create `functions/_types/index.d.ts` for shared type definitions:

```typescript
// API payloads
export interface ImageMeta { ... }
export interface ShareMeta { ... }
export interface FolderMeta { ... }

// Request/Response shapes
export interface ApiResponse<T> { ... }
```

### Phase 3: Utils Migration

Priority order (by risk/impact):
1. `functions/_utils/auth.js` → `auth.ts`
2. `functions/_utils/keys.js` → `keys.ts`
3. `functions/_utils/meta.js` → `meta.ts`
4. `functions/_utils/r2.js` → `r2.ts`

### Phase 4: Routes Migration

Order by complexity (simple → complex):
1. `functions/api/auth/*.js`
2. `functions/api/logs.js`
3. `functions/api/file.js`
4. `functions/api/folders.js`
5. `functions/api/metadata/*.js`
6. `functions/api/images/*.js`
7. `functions/api/shares.js`
8. `functions/api/upload.js`
9. `functions/api/maintenance/*.js`

## Migration Checklist Per File

- [ ] Add `// @ts-check` (if not already)
- [ ] Run `tsc --noEmit` to identify issues
- [ ] Rename `.js` → `.ts`
- [ ] Fix type errors
- [ ] Update imports in dependent files
- [ ] Run tests
- [ ] Verify build

## Configuration Changes

No changes needed - current `tsconfig.json` already supports:
- `allowJs: true`
- `checkJs: false` (opt-in via `@ts-check`)

## Risk Mitigation

- Migrate one file at a time
- Run full test suite after each migration
- Keep JSDoc as intermediate step
- No runtime behavior changes during migration
