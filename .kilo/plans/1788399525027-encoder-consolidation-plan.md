# PangAsin Encoder — Single-Screen UI, Approved-Record Lock, Form Cleanup, Charts

Plan file: `C:\PangAsin\.kilo\plans\1788399525027-encoder-consolidation-plan.md`

## 1. Goal recap

Rebuild the Encoder (BFAR Municipal Coordinator) experience:

1. One screen, no header/nav.
2. One "+ Add Record" button → Entry Form opens in a modal.
3. Records table: icon-only actions; approved rows are read-only.
4. Entry Form: cleaner labels, placeholders everywhere; replace `notes` free-text with a `production_method` dropdown (Solar / Cooked / Hybrid); remove the "Output per Salt Bed" derived field from the form (it's already only derived — no consumer reads it from the DB).
5. Dashboard: "Barangay Total Summary" becomes a Pie chart; "Production by Barangay" becomes a multi-line chart over monthly buckets, with a period filter (per user decision).
6. KPI cards (incl. "Registered Producers") refresh after every mutation.

Do not touch Admin or Public/Guest layouts or routes.

---

## 2. Confirmed decisions (from user)

- **Notes → Production Method:** Drop the `notes` column, add `production_method` ENUM('solar','cooked','hybrid') NOT NULL. Demo seed data ("Demo seeded record") is replaced with `production_method='solar'`. This drops the admin notes search and the data-quality `notes` weight — both will be removed in this same change set.
- **Chart period:** Add a year/month period filter above the charts. Charts and KPI cards re-fetch on filter change.

---

## 3. Conflicting findings / spec gaps to flag before implementation

1. **`output_per_bed` is a derived-only field.** Confirmed: not stored in the DB; computed in both `encoder_api._serialize` (encoder_api.py:40) and `admin_api._serialize` (admin_api.py:72). The forecast model (`forecast_service.py`) reads only `production_volume` from `ProductionRecord`. **Spec's "remove it if nothing consumes it" → safe to remove from the form UI; the serializer keeps returning it for the existing detail modals (admin ValidationQueue, encoder View modal) and the existing `output_per_bed` table column. Implementation will also stop surfacing it in the table column per the spec's "no clutter" intent, but keep it in the detail view.**
2. **Approved-record lock is missing server-side.** Current `update_record` (encoder_api.py:238) and `delete_record` (encoder_api.py:298) have no status guard. A direct API call (e.g. via the encoder's "Submit for Review" flow on a record that an admin later approved) can still mutate or delete it. Must add `if record.status == "approved": return 409` in both endpoints.
3. **Hardcoded barangay list exists in two places.** `app/seed/seed_demo_data.py:9-67` (`SALT_BARANGAYS`) and the model has no constraint. This is **out of scope** for this task but worth flagging — the form already loads barangays from the DB (`getEncoderBarangays`), so the hardcoded list is only a seed-time concern.
4. **`output_per_bed` is currently a column in `RecordsTable.jsx:135`.** The spec says "minimal on-screen text." Implementation will drop the column from the table to reduce clutter, but keep it in the View modal so data isn't lost.
5. **Existing demo records will lose their `notes` value on migration.** Acceptable per the user's destructive-replace decision; the seeder will be updated to insert `production_method='solar'` instead.
6. **`/encoder/records`, `/encoder/records/new`, `/encoder/records/:id/edit` routes** currently still exist and are referenced by `EncoderLayout` nav. After Task 1, these routes are removed and `RecordList` is no longer routed. The "Edit" flow becomes a modal on the single screen (state: `editingRecordId | null`).

---

## 4. Files to touch

### Backend
- `app/models/production_record.py` — replace `notes` Text with `production_method` Enum.
- `app/seed/seed_demo_data.py` — drop `notes` insert; add `production_method` default `'solar'`.
- `migrations/versions/0003_production_method_enum.py` (new) — Alembic migration: drop `notes`, add `production_method` ENUM NOT NULL DEFAULT 'solar' on existing rows, then drop the default for new rows.
- `app/blueprints/encoder_api.py`
  - `_allocate`: handle `production_method`, drop `notes`.
  - `_validate`: add `production_method` whitelist validation (`solar`/`cooked`/`hybrid`).
  - `_serialize`: drop `notes`, keep `output_per_bed` (derived), add `production_method`.
  - `update_record`: **add server-side approved-record lock** (return 409 if `record.status == 'approved'`).
  - `delete_record`: **add server-side approved-record lock** (return 409 if `record.status == 'approved'`).
  - `stats`: add `?start=YYYY-MM-DD&?end=YYYY-MM-DD` query params; return `by_month: [{month: "YYYY-MM", barangay: name, volume_kg: N}, …]` for the line chart, plus `pie_total_kg` reused from `total_volume_kg` and `by_barangay` for the pie. Include `period: {start, end}` in the response.
- `app/blueprints/admin_api.py`
  - `_serialize`: drop `notes`, add `production_method`, keep `output_per_bed`.
  - `list_records` (around admin_api.py:325): drop `notes.ilike` from search; replace with `production_method` filter (or just remove the search clause — admin still searches by barangay name).
  - Data-quality endpoint (admin_api.py:502): drop `notes` from `QUALITY_WEIGHTS` and `QUALITY_FIELDS`; add `production_method`.
- `app/services/forecast_service.py` — **no change** (confirmed: only reads `production_volume`).

### Frontend
- `frontend/src/services/dataService.js` — `createRecord`, `updateRecord` payloads drop `notes`, add `production_method`; `getStats` accepts `{start, end}`.
- `frontend/src/App.jsx`
  - Remove `RecordList` and `ProductionRecordForm` from `import`.
  - Remove the three `/encoder/records*` child routes. Keep `/encoder` index → `EncoderDashboard` only.
- `frontend/src/components/encoder/EncoderLayout.jsx` — **gut the navbar.** Keep the route as a thin pass-through that renders `<Outlet context={{ user }} />` (no header, no nav links, no user/email chip, no Logout button). Add a small floating Logout button in the dashboard itself, or keep Logout accessible via a profile menu — **out of scope to redesign chrome beyond "no header/nav"; a minimal unobtrusive logout control is acceptable**. (Decision: add a single small "Logout" text-link in the top-right of the dashboard, position absolute, low-emphasis, so the user can still log out without a header.)
- `frontend/src/components/encoder/EncoderDashboard.jsx` — full rewrite as the single screen (see §5).
- `frontend/src/components/encoder/RecordsTable.jsx` — replace text action buttons with icon-only buttons (Bootstrap Icons are already in use elsewhere; use `react-bootstrap-icons` if installed, otherwise inline SVG — **check first**). Hide Edit and Delete when `r.status === 'approved'` (View always present). Drop the "Output/bed" column. Keep the View modal.
- `frontend/src/components/encoder/ProductionRecordForm.jsx` — refactor into a presentational `<ProductionRecordForm>` component used inside the new modal (see §5). All inputs gain placeholders. Drop "Output per Salt Bed" field. Drop the "Registered Producers" derived read-only field — keep the value visible only as a small live label "Registered Producers: N" (no input). Replace `notes` textarea with `production_method` dropdown (required, 3 options). Remove the post-save "Record Saved" screen — close modal on success.
- `frontend/src/components/encoder/RecordList.jsx` — **delete file** (no longer routed; `RecordsTable` is mounted directly from `EncoderDashboard`).
- `frontend/src/index.css` — minor tweaks: remove `.encoder-navbar`, `.encoder-brand*`, `.encoder-user*` rules; add a `.encoder-floating-logout` rule for the new minimal logout control; keep all `.encoder-kpi*`, `.encoder-card*`, `.encoder-table*` rules.

### Out of scope
- Admin `ValidationQueue` detail modal — keep showing the same fields, but `notes` becomes `production_method`. No table-column changes there (admin can stay text-rich).
- Public/Guest screens (`GuestDashboard`, `Login`, `PublicHeader`, `PublicFooter`) — untouched.
- Excel Upload — still deferred.

---

## 5. Single-screen layout (target)

```
┌──────────────────────────────────────────────────────────────────┐
│ Municipality: <Name>     [Period: This Year ▾]   [Logout]        │  ← minimal top strip (no navbar)
├──────────────────────────────────────────────────────────────────┤
│ Welcome, <Name>                                  [+ Add Record]  │
├──────────────────────────────────────────────────────────────────┤
│ [Total Production]  [Salt Area]   [Total Salt Beds]              │
│ [Records]           [Registered Producers]                       │
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐  ┌─────────────────────────────┐ │
│ │ Production by Barangay      │  │ Barangay Total Summary      │ │
│ │ <Recharts LineChart>        │  │ <Recharts PieChart w/legend>│ │
│ │ x: month, y: kg, lines: per │  │ one slice per barangay      │ │
│ │ barangay, color-stable      │  │ (shares of selected period) │ │
│ └─────────────────────────────┘  └─────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ Submissions (filters: barangay, status)                           │
│ <RecordsTable — icon-only actions, approved rows = view-only>     │
└──────────────────────────────────────────────────────────────────┘
```

Period filter: `<Form.Select>` with options `[This Year, Last 12 Months, All Time, Custom…]`. Default `This Year` (calendar year of `record_date`).

`EncoderDashboard` state:
- `stats` (object from `getStats` with `start, end`)
- `period` (`{start, end}` ISO date objects, or `null` for "All Time")
- `recordsRefreshKey` (counter, bumped after every successful create/update/delete/submit)
- `showFormModal` (bool), `editingRecordId` (number | null)

On mount and on `period` change: refetch `getStats({start, end})`. On `recordsRefreshKey` change: refetch `getRecords` (and also re-refresh stats, to keep the "Registered Producers" card fresh).

Modal flow:
- "+ Add Record" → `setShowFormModal(true), setEditingRecordId(null)`.
- Edit icon on a row → `setShowFormModal(true), setEditingRecordId(r.id)`.
- Modal renders `<ProductionRecordForm editingId={editingRecordId} onClose={onClose} onSaved={onSaved} />`.
- `onSaved` bumps `recordsRefreshKey`, re-fetches stats, closes modal.
- `onClose` closes modal without state change.

Approved-record lock UX:
- `RecordsTable` row actions: when `r.status === 'approved'`, render only the View icon. Edit and Delete are not rendered at all (not just disabled) so the spec's "hide" is satisfied.
- `<Button>`s use `<Button variant="link" size="sm" className="text-secondary p-1">` with an inline icon and `title=` + `aria-label=`.

Icon library choice: project already has no icon library in `package.json`. The simplest no-new-dep path is inline SVGs (Heroicons-style). Add a tiny `frontend/src/components/icons.jsx` with `ViewIcon`, `EditIcon`, `DeleteIcon` SVGs (24×24, stroke-based, color = `currentColor` so Bootstrap text variants drive the color). This avoids adding a dependency for three icons.

---

## 6. Form changes (detail)

`<ProductionRecordForm>` field set after cleanup:

| Field | Label | Required | Placeholder | Notes |
|---|---|---|---|---|
| `barangay_id` | "Barangay" | yes | "Select barangay…" (in `<option>`) | dropdown |
| `record_date` | "Date Covered" | yes | (HTML date) | — |
| `male_producers` | "Male Producers" | yes | "e.g. 7" | number |
| `female_producers` | "Female Producers" | yes | "e.g. 5" | number |
| `production_volume` | "Total Production Volume (kg)" | yes | "e.g. 120" | number |
| `num_salt_beds` | "Number of Salt Beds" | yes | "e.g. 15" | number |
| `area_per_salt_bed` | "Area per Salt Bed (m²)" | no | "e.g. 250" | number |
| `production_method` | "Production Method" | yes | "Select method…" (in `<option>`) | dropdown, options: Solar, Cooked, Hybrid |

Removed:
- "Output per Salt Bed (Derived)" — derived only, no consumer in the form.
- "Registered Producers" input — was already read-only. Replaced by a small live label "Registered Producers: N" (no input, no form-data key).

Help text removed: every label now relies on a placeholder. Where placeholders can't carry the meaning (e.g. units), the unit is in the label (kg, m²).

Submit button: "Save Draft" (if new) or "Save Changes" (if editing). After a successful save the modal closes and the table + stats refresh. A small toast or inline success message is out of scope; the data refresh is the signal.

After save, the spec implies a "Submit for Review" follow-up. **Decision: keep a single submit action — save → close modal → encoder then clicks an icon in the row to submit. To stay minimal and avoid extra UI in the modal, expose Submit-for-Review as a third icon on rows where `status === 'draft'`.** (Already partially implemented in `submitRecord(id)` in encoder_api.py:278; the icon just calls it.)

Row actions matrix:
- `draft`: [View, Edit, Delete, Submit-for-Review]
- `pending`: [View] only (already locked server-side)
- `approved`: [View] only
- `rejected`: [View, Edit, Delete] (allow edit-and-resubmit)
- `returned`: [View, Edit, Delete]

---

## 7. Chart changes (detail)

Library: `recharts` (already in `package.json:18`). Both charts inside `<ResponsiveContainer>` with `height={260}`.

**Pie chart** (Barangay Total Summary):
- Data: `stats.by_barangay` (already aggregated by server).
- `dataKey="total_volume_kg"`, `nameKey="barangay"`.
- Colors: deterministic palette from the brand — Ocean Blue `#1565C8`, Leaf Green `#43A047`, Harvest Gold `#D4A017`, Earth Brown `#795548`, Deep Navy `#0D2B4B`, plus a few light tints. Recharts assigns in array order; precompute a stable list and sort barangays alphabetically for stability.
- `<Legend />` below or to the right with barangay name + share % (use `formatter` to append ` (xx.x%)`).

**Line chart** (Production by Barangay):
- New server data: `stats.by_month` shaped as `[{ month: "2025-01", barangay: "Bolinao", volume_kg: 1200 }, …]`. Server pivots to wide format internally and returns `by_month: [{ month: "2025-01", Bolinao: 1200, Anda: 900, … }, …]`. Missing months = 0.
- X axis `dataKey="month"` (YYYY-MM).
- One `<Line>` per barangay present in the period, with a stable color from the same palette keyed by barangay name (`barangayColor[name]` = palette[index % len]).
- `<Legend />` mapping color → barangay.
- Use a single `<Tooltip />`.

`getStats` server change:
- Accept `start`, `end` query params. If both provided, filter `ProductionRecord.record_date` accordingly. If not, return all-time.
- For the line chart, group by `(year-month, barangay)`, then pivot to wide format in Python. Emit `months: sorted unique labels`, `barangays: sorted unique names`, `series: { [barangay]: [{ month, volume_kg }, …] }`. Pivot to a list of `{ month, [barangay]: volume_kg }` is simpler for recharts and is the chosen shape.
- For the pie, reuse `by_barangay` but with the date filter applied to the aggregate query.

---

## 8. KPI freshness

`EncoderDashboard` exposes a single `refreshAll()` callback that:
1. refetches `getStats(period)` → `setStats`,
2. refetches `getRecords()` → passed to `RecordsTable` via a `refreshKey` prop or by lifting the records state up.

Every successful mutation in the modal or in the table calls `refreshAll()`. Specifically:
- `createRecord` success → `refreshAll()`, close modal.
- `updateRecord` success → `refreshAll()`, close modal.
- `deleteRecord` success → `refreshAll()`.
- `submitRecord` (submit-for-review icon) success → `refreshAll()`.

No full page reload; the HashRouter is preserved.

---

## 9. Validation plan

After implementation, an executing agent should run:

Backend
- `flask db upgrade` (applies 0003 migration). Verify with a one-off query that `production_records.production_method` is the new ENUM and `notes` is gone.
- `python run_seed.py` (re-runs seed; existing approved demo records get `production_method='solar'`).
- Manual: as encoder for Bolinao, `curl -X PUT /api/encoder/records/<approved-id>` should return `409 {"error": "Cannot modify an approved record."}`. Same for `DELETE`.
- Manual: admin's `GET /api/admin/records?q=…` no longer searches `notes`; data-quality score no longer mentions `notes` weight.
- Forecast smoke: `POST /api/admin/forecast/run` should still complete (forecast only reads `production_volume`).

Frontend
- `npm run build` clean.
- Login as encoder, land on `/encoder`. Confirm no header/nav. Confirm charts render and react to period filter. Confirm "+ Add Record" opens modal. Confirm form has no "Output per Salt Bed" and `production_method` is a dropdown. Confirm submitting closes modal and cards + table refresh. Confirm an approved row's Edit/Delete icons are not present and the View modal still shows all data.
- Direct API test: as encoder, `fetch PUT /api/encoder/records/<approved>` is rejected with 409.

---

## 10. Risks / open items

- **Destructive notes removal.** User accepted. Existing approved demo records will have `production_method='solar'` regardless of original notes. If real production data has been entered, that data is lost. Confirm with user before running in any environment that has real (non-demo) records.
- **`output_per_bed` removal from the table column** is a UX call I'm making because of the "minimal on-screen text" constraint. The data is still available in the View modal. Flag for user awareness.
- **Icon library choice (inline SVGs)** keeps the bundle dependency-free but means hand-rolled icons. Acceptable for three icons; flag in case the project later wants a real icon set.
- **Period filter default** is "This Year". If the encoder's data spans only the last few months, the line chart may be sparse. Default is fine; All Time is available.
- **Stats endpoint now returns more data per call.** Negligible at this scale (one municipality, dozens of records).

---

## 11. Order of execution (for the implementing agent)

1. Backend migration + model change + seed update.
2. Backend serializer + validation + approved-record lock.
3. Backend admin serializer + search + data-quality weights.
4. Frontend service-layer payload updates.
5. Frontend `RecordsTable` icons + approved-row behavior.
6. Frontend refactor `ProductionRecordForm` to modal-friendly + field cleanup.
7. Frontend rewrite `EncoderDashboard` to single screen + period filter + pie/line charts + chart data wiring.
8. Frontend route cleanup (`App.jsx`) + delete `RecordList.jsx` + gut `EncoderLayout.jsx` (keep Outlet only, add floating Logout) + CSS trim.
9. End-to-end validation per §9.
