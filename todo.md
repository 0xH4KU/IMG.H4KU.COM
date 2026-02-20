# Improvement TODO

## P0 - 高衝擊（優先處理）

### CI / 品質門檻
- [x] CI Lint step 移除 `continue-on-error: true`。

### TypeScript 遷移（Phase 2–3）
- [x] 建立 `functions/_types/index.d.ts`，定義 ImageMeta、ShareMeta、FolderMeta 等共用型別。
- [x] 遷移 `functions/_utils/auth.js` → `auth.ts`。
- [x] 遷移 `functions/_utils/keys.js` → `keys.ts`。
- [x] 遷移 `functions/_utils/meta.js` → `meta.ts`。
- [x] 遷移 `functions/_utils/r2.js` → `r2.ts`。
- [x] 在 `tsconfig.json` 加入 `functions` 到 `include`。

### 測試覆蓋補強
- [x] 後端 route handler 測試：用 mock R2/env 測試 `images.js`、`folders.js`、`upload.js` 關鍵路徑。
- [x] Metadata cascade 測試：刪除/還原時 metadata cascade 正確性。
- [ ] 前端 hooks 單元測試：`useImageActions`、`useImageSelection` 等（需加入 React Testing Library）。
- [x] E2E 煙霧測試：upload → list → delete → trash 端對端流程。

## P1 - 中衝擊

### 程式碼品質
- [x] ESLint `@typescript-eslint/no-explicit-any` 改為 `warn`，逐步消除 `any`。
- [x] 加入 React Error Boundary，包覆 `<AppContent />`，避免白屏。
- [x] 整理 `index.html` 與 `global.css` 重複樣式，`index.html` 只保留 FOUC 預防必要的初始樣式。

### 資料一致性
- [x] Metadata 讀寫加入樂觀鎖（version/etag），防止並發更新的 race condition。

### 路由
- [x] 評估是否需要引入輕量 router（視未來頁面擴充需求決定）。  
  ✅ 目前三頁（Landing/Console/Share）用 `resolveRoute()` 足夠，暫不需框架級 router。

## P2 - 持續改善

### 效能
- [ ] 圖片上傳/交付支援 WebP/AVIF 格式轉換。
- [ ] Share 頁面 `<img>` 加入 `srcSet` 支援 responsive images。

### Accessibility
- [x] Modal 加入 `role="dialog"`、`aria-modal`、focus trap。
- [x] Context menu 加入鍵盤觸發方式（Shift+F10）。
- [x] Share 頁面圖片 alt text 改用有意義的檔名。

### 安全性
- [x] 加入 Content Security Policy header。
- [x] `/api/auth` 登入端點加入 rate limiting。
- [x] 確認 CORS header 設定。  
  ✅ API 僅同源存取，不需額外 CORS 設定。

### 監控
- [x] 加入前端錯誤追蹤（`window.onerror` + `unhandledrejection` → `/api/logs`）。
- [x] 整合 Cloudflare Web Analytics 追蹤 Web Vitals。  
  ⚠️ 需在 Cloudflare Dashboard 取得 Beacon token 並填入 `index.html`。

### DX
- [x] 整合 Vite dev server 與 Wrangler proxy，統一 `npm run dev`。  
  ✅ 目前 `npm run dev`已透過 Vite 統一管理，Cloudflare Pages 部署時自動處理 Functions，無需額外整合。
