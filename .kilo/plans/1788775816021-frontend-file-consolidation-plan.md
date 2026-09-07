# File Consolidation Plan — PangAsin Frontend

## Goal
Reduce the frontend source file count from ~36 files to ~24 by combining related components into single files, while preserving all functionality and keeping the system fully working.

## Scope
Frontend source files only (`frontend/src/`). Backend (`app/`), migrations, and build output are out of scope.

## Confirmed Decisions (from user)
1. **Public dashboard**: Fold everything except the map into `GuestDashboard.jsx`. Keep `MunicipalityMapSection.jsx` separate.
2. **`hooks/` folder**: Inline `usePageTitle.js` into the 3 components that use it. Delete the folder.
3. **`theme/` folder**: Keep as-is. Already the correct structure for theme source code.
4. **`data/` folder**: Keep as-is. GeoJSON data file is correctly scoped to Pangasinan.
5. **`services/` folder**: Keep as-is. Most-imported file in the frontend; flattening provides no benefit.
6. **Encoder components**: Fold `RecordStatusBadge` into `RecordsTable`. Delete `EncoderLayout.jsx` and `EncoderSidebar.jsx`. Keep `EncoderDashboard.jsx`, `RecordsTable.jsx`, and `ProductionRecordForm.jsx` separate.
7. **Admin components**: Create `admin/ui.jsx` for `AdminKpiCard` + `PageHeader`. Inline `RequireAdmin` into `App.jsx`. Inline `AdminPage` into `AdminDashboard`. Fold `AdminSidebar` into `AdminLayout`.

## Files to Delete (12)
| File | Reason |
|---|---|
| `hooks/usePageTitle.js` | Inlined into 3 components |
| `components/ChartCaption.jsx` | Inlined into `GuestDashboard.jsx` |
| `components/IconButton.jsx` | Inlined into `GuestDashboard.jsx` |
| `components/encoder/EncoderLayout.jsx` | Gutted per existing plan; replaced by direct rendering |
| `components/encoder/EncoderSidebar.jsx` | Gutted per existing plan; replaced by direct rendering |
| `components/encoder/RecordStatusBadge.jsx` | Inlined into `RecordsTable.jsx` |
| `components/admin/AdminKpiCard.jsx` | Moved to `admin/ui.jsx` |
| `components/admin/PageHeader.jsx` | Moved to `admin/ui.jsx` |
| `components/admin/RequireAdmin.jsx` | Inlined into `App.jsx` |
| `components/admin/AdminPage.jsx` | Inlined into `AdminDashboard.jsx` |
| `components/admin/AdminSidebar.jsx` | Folded into `AdminLayout.jsx` |
| `components/Reveal.jsx` | Inlined into `GuestDashboard.jsx` |

## Files to Create (2)
| File | Contents |
|---|---|
| `components/admin/ui.jsx` | `AdminKpiCard` + `PageHeader` (exported as named exports) |

## Files to Modify (8)
| File | Changes |
|---|---|
| `App.jsx` | Inline `RequireAuth`/`RequireAdmin` logic; remove `usePageTitle` import; remove `AdminPage` import |
| `GuestDashboard.jsx` | Fold in `MunicipalityProductionSection`, `SupplyDemandSection`, `ProducerDemographicsSection`, `MunicipalityDetailPanel`, `ChartCaption`, `IconButton`, `Reveal` |
| `components/encoder/RecordsTable.jsx` | Inline `RecordStatusBadge`; remove its import |
| `components/encoder/ProductionRecordForm.jsx` | No changes (already self-contained) |
| `components/encoder/EncoderDashboard.jsx` | No changes (already self-contained) |
| `components/admin/AdminLayout.jsx` | Fold in `AdminSidebar`; remove its import |
| `components/admin/AdminDashboard.jsx` | Inline `AdminPage` content directly |
| `components/admin/ValidationQueue.jsx` | Update import from `./PageHeader` to `./ui` |
| `components/admin/UsersManagement.jsx` | Update import from `./PageHeader` to `./ui` |
| `components/admin/DataQualityDashboard.jsx` | Update import from `./AdminKpiCard` to `./ui`; update `./PageHeader` to `./ui` |
| `components/admin/GenerateReports.jsx` | Update import from `./IconButton` to inline; update `./PageHeader` to `./ui` |
| `components/admin/MunicipalityAnalytics.jsx` | Update import from `./PageHeader` to `./ui` |
| `components/admin/SupplyDemandAnalytics.jsx` | Update imports from `./AdminKpiCard` and `./PageHeader` to `./ui` |
| `components/admin/ForecastDashboard.jsx` | Update import from `./PageHeader` to `./ui` |

## Order of Execution
1. Create `components/admin/ui.jsx` with `AdminKpiCard` and `PageHeader` as named exports.
2. Update all 7 admin component imports to use `./ui` instead of `./AdminKpiCard` or `./PageHeader`.
3. Inline `RequireAdmin` into `App.jsx`; delete `RequireAdmin.jsx`.
4. Inline `AdminPage` content into `AdminDashboard.jsx`; delete `AdminPage.jsx`.
5. Fold `AdminSidebar` into `AdminLayout.jsx`; delete `AdminSidebar.jsx`.
6. Inline `RecordStatusBadge` into `RecordsTable.jsx`; delete `RecordStatusBadge.jsx`.
7. Delete `EncoderLayout.jsx` and `EncoderSidebar.jsx`; update `App.jsx` to render `EncoderDashboard` directly (no layout wrapper).
8. Inline `usePageTitle` into `App.jsx`, `EncoderDashboard.jsx` (if needed), and any other users; delete `hooks/usePageTitle.js`.
9. Fold all public dashboard sections into `GuestDashboard.jsx`; delete `ChartCaption.jsx`, `IconButton.jsx`, `Reveal.jsx`, `MunicipalityProductionSection.jsx`, `SupplyDemandSection.jsx`, `ProducerDemographicsSection.jsx`, `MunicipalityDetailPanel.jsx`.
10. Run `npm run build` to verify everything compiles.

## Validation
- `npm run build` from `frontend/` must succeed with no errors.
- Manual smoke test: log in as encoder, verify `/encoder` renders the single-screen dashboard with all KPIs, charts, records table, and form modal working.
- Manual smoke test: log in as admin, verify all 7 admin routes render correctly.
- Manual smoke test: visit `/` (public dashboard), verify map, charts, and detail panel all work.
- Confirm no `import ... from '../encoder/RecordStatusBadge'` or `from './AdminKpiCard'` or `from './PageHeader'` or `from '../IconButton'` or `from './ChartCaption'` or `from './Reveal'` or `from '../hooks/usePageTitle'` remain in any file.

## Risks
- **Large `GuestDashboard.jsx`**: After folding, this file will be ~700+ lines. Review carefully for correctness.
- **`EncoderDashboard` loses sidebar scroll tracking**: The IntersectionObserver logic in `EncoderSidebar` will be lost. The dashboard will render without scroll-spy navigation. This is acceptable per the existing consolidation plan (which calls for gutting the navbar).
- **`AdminLayout` grows**: After folding `AdminSidebar` in, `AdminLayout.jsx` will be ~230 lines. Still manageable.
- **`RequireAdmin` inlining**: The auth guard logic moves into `App.jsx`. Ensure the `useEffect` dependency array and `setUser` calls are preserved exactly.