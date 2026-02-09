# Refactor TODO Checklist

## P0 - 安全與回歸保護（先做）

### P0-A：測試與 CI 基礎（最優先）
- [x] 補 token 核心流程單元測試：簽發、驗證、過期、TTL、錯誤簽章。
- [x] 補 key sanitize 邊界測試：空值、`..`、重複斜線、保留前綴、thumb 特例。
- [x] 建立 CI 門檻：`type-check` + `build` + `tests` 任一失敗即阻擋合併。

### P0-B：Legacy Token 過渡（待監測數據後決定）
- [x] 補 legacy token 使用監測（log/計數），確認仍有多少舊 token 流量。
- [x] 依據監測結果設定退場日期，加入 `LEGACY_TOKEN_UNTIL` 環境變數。
- [x] 補 legacy 截止相關測試案例。

### P0-C：路徑防護補齊
- [x] 在刪除／還原／批次操作補齊保留路徑防護，禁止 `.config/*` 與非法 key。

## P1 - 錯誤邊界與前端一致性（可與型別安全並行）
- [x] 全面盤點 `apiRequest` 呼叫點，確保使用者操作皆有 `catch` 與可見錯誤提示。
- [x] 建立統一錯誤處理 helper/hook（例如 `useApiAction`），避免各元件重複實作。
- [x] 移除 silent catch；至少記錄 warning，關鍵流程需顯示 inline/toast 錯誤。
- [x] 統一 `ApiError` 顯示規則，避免後端 raw error 直接暴露於 UI。
- [x] 建立全域 401 流程：清 token、回登入頁、可選保留原操作上下文。
- [x] 補前端錯誤情境測試：401/403/500、網路中斷、超時、blob/text/json 回應。

## P1 - 型別安全（可與錯誤邊界並行）
- [x] 後端關鍵 util 先加 `// @ts-check` + JSDoc typedef，降低 JS 無型別風險。
- [x] 優先處理 `meta.js`（資料核心），再擴展至其他 util。
- [x] 為 metadata schema 建立明確型別（image/hash/share/folder/maintenance）。
- [x] normalize 函式補輸入／輸出型別與 type guard，避免隱性欄位漂移。
- [x] 前後端 API payload 建立共享型別，避免欄位命名與可選性不一致。
- [x] 加 schema 契約檢查，防止舊資料與新程式不相容。
- [x] 規劃 JS → TS 漸進遷移路線（先 util，再 route）。→ 見 `docs/TS-MIGRATION.md`

## P2 - 架構與可維護性
- [x] 抽離 R2 service 層（list/get/put/move/delete/meta cascade），讓 route 專注流程控制。→ 基礎版 `functions/_utils/r2.js`
- [x] 拆分大型元件（特別是 `ImageGrid`）為資料層、虛擬清單層、動作層。→ `useImageGridData`, `useImageSelection`, `useImageActions`, `useImageGroups`
- [x] 前後端 key/path/domain 規則收斂為單一來源，避免重複實作。→ `src/utils/keys.ts`
- [x] 將 `prompt/confirm/alert` 逐步替換為一致 Modal UX。→ `useDialogs.ts` + `ConfirmModal` + `TextPromptModal`
- [x] 批次操作加入可觀測性（operation id、失敗明細、可重試）。→ `functions/_utils/operation.js`
- [x] 建立固定回歸清單：upload、share、trash、rename、move、metadata。→ `docs/REGRESSION.md`

## 工具鏈與品質門檻
- [x] 補齊 `eslint` 依賴與配置，修復 lint script 無法執行問題。
- [x] 設定 pre-commit（lint + type-check + focused tests）。→ husky + lint-staged
- [x] 建立 staging 環境驗證流程：重大改動 production deploy 前需完整 staging 驗證。→ `docs/STAGING.md`
- [x] 建立 PR checklist（安全、測試覆蓋、錯誤處理、文件更新）。→ `.github/pull_request_template.md`
- [x] 建立 CI 報告輸出（測試覆蓋率、失敗分佈、警告趨勢）。→ CI workflow summary
- [x] 關鍵 env vars 加啟動期檢查，缺漏直接告警。→ `functions/_utils/env.js`
- [x] 規劃 nightly 驗證任務（maintenance 掃描 + 健康報告）。→ `.github/workflows/nightly.yml`

## 文件與發布管理
- [x] 在重構文件新增「legacy token 退場計畫」與明確日期。→ 見 `docs/ENV.md` 說明
- [x] 補環境變數文件：用途、預設值、風險、建議值。→ `docs/ENV.md`
- [x] 補故障排查手冊：401、上傳失敗、分享異常、metadata 損壞。→ `docs/TROUBLESHOOTING.md`
- [x] 補回滾策略：token 過渡開關、資料相容、緊急復原流程。→ `docs/ROLLBACK.md`
- [x] 每次重構更新 changelog + 驗證紀錄，確保可追溯性。→ `docs/REFACTOR-2026-02-09.md` 第 8 節
- [x] 下一輪 scope 切小，避免一次跨太多面向造成風險堆疊。→ 見下方「建議執行順序」

## 建議執行順序

1. **Sprint A - P0-A**：測試骨架 + CI gate（阻擋回歸的基礎）
2. **Sprint A - P0-B**：上線後觀察 legacy token 流量，收集數據
3. **Sprint B**：P1 錯誤邊界 + P1 型別安全（可並行）
4. **Sprint C**：依據 legacy 監測數據決定退場日期，完成 P0-B 剩餘項目
5. **Sprint D**：P2 架構拆分 + UX 一致化
