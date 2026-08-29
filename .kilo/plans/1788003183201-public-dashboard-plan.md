# Public Dashboard Prototype — Implementation Plan

## 1. Goal

Build a read-only, mock-data-driven Guest/Public Dashboard for the PangAsin capstone system. No database connection, no authentication, no admin/encoder functionality. The dashboard must be immediately accessible, responsive, and visually polished enough to serve as a realistic prototype.

## 2. Current State Assessment

- Existing Flask app at `C:\PangAsin trial\pangasin\` already has:
  - `public_dashboard_bp` (queries database — keep intact for future use)
  - `public/dashboard.html` (basic, database-dependent)
  - `base.html` (includes admin/encoder nav links — not suitable for public-only view)
  - `gis_map.py` blueprint (marker-based map)
- New requirements demand a completely separate prototype that:
  - Uses centralized mock/synthetic JSON data
  - Does NOT touch PostgreSQL
  - Does NOT require login
  - Includes choropleth map, municipality detail panel, demographics, supply/demand, comparison charts

## 3. Key Design Decisions

### 3.1 New Blueprint vs. Modify Existing

**Decision**: Create a **new** blueprint `public_mock_dashboard.py` rather than modifying the existing `public_dashboard.py`.

**Rationale**:
- Preserves existing database-connected code for future integration
- Clean separation between prototype and production logic
- Eliminates risk of accidentally importing DB models in the mock version
- Easy to remove/replace when real data is ready

### 3.2 Route

**Decision**: Register the new blueprint at URL prefix `/public-dashboard` (route: `/public-dashboard/`).

**Rationale**:
- Avoids conflict with existing `/dashboard` route
- Makes it clear this is the prototype/public version
- Can later be remapped to `/` or merged with the real dashboard

### 3.3 Mock Data Location

**Decision**: Place JSON files in `static/data/mock/`.

**Files**:
- `static/data/mock/municipalities.json`
- `static/data/mock/production.json`
- `static/data/mock/demographics.json`
- `static/data/mock/supply_demand.json`

**Rationale**:
- Flask serves `static/` automatically — no API routes needed
- JavaScript `fetch()` can load them directly
- Simulates future API calls without building endpoints
- Clean separation of data from presentation

### 3.4 Base Template

**Decision**: Create `templates/public_base.html`.

**Rationale**:
- Existing `base.html` includes Admin/Encoder/Validation nav links
- Public dashboard must NOT expose admin functionality
- New base template includes only public navigation (Overview, Municipalities, Supply & Demand, Producer Demographics)

### 3.5 Map Implementation

**Decision**: Use Leaflet with temporary synthetic GeoJSON polygons for the seven municipalities.

**Rationale**:
- Prompt explicitly requests choropleth classification
- Synthetic GeoJSON can be replaced later with official boundaries
- Code structured to accept external GeoJSON URL or file in future

### 3.6 Detail Panel

**Decision**: Bootstrap Offcanvas component for municipality detail.

**Rationale**:
- Mobile-friendly (full-screen on small devices)
- Desktop: right-side drawer
- No external dependencies beyond Bootstrap (already in stack)

## 4. File Structure (Current + Needed Changes)

```
C:\PangAsin trial\pangasin\
├── app\
│   ├── blueprints\
│   │   ├── public_mock_dashboard.py          # EXISTS — no DB imports
│   │   └── monitoring.py                     # EXISTS — landing route
│   ├── static\
│   │   ├── css\
│   │   │   └── dashboard.css                 # EXISTS — needs sidebar styles
│   │   ├── data\mock\                        # EXISTS
│   │   │   ├── municipalities.json
│   │   │   ├── production.json
│   │   │   ├── demographics.json
│   │   │   └── supply_demand.json
│   │   └── js\
│   │       ├── dashboard.js                  # EXISTS — needs data visibility fixes
│   │       ├── map.js                        # EXISTS
│   │       └── charts.js                     # EXISTS
│   └── templates\
│       ├── public_base.html                  # EXISTS — needs sidebar markup
│       ├── public\
│       │   ├── dashboard.html                # EXISTS — needs sidebar integration, sticky header
│       │   └── landing.html                  # EXISTS — already has splash + redirect
│       └── shared\
│           └── municipality_detail.html      # EXISTS — placeholder
├── app\__init__.py                           # MODIFIED — blueprint registered
└── .kilo\plans\...                           # THIS PLAN
```

**Files to modify**:
- `app/templates/public_base.html` — Add collapsible sidebar markup, hamburger toggle, sticky header area
- `app/static/css/dashboard.css` — Add sidebar styles, responsive breakpoints, loading/error states
- `app/static/js/dashboard.js` — Fix data loading visibility, add retry logic, ensure KPIs render
- `app/templates/public/dashboard.html` — Integrate sidebar, move overview to sticky header, ensure data-as-of visibility

## 5. Data Model (Mock JSON Schema)

### 5.1 `municipalities.json`

```json
[
  {
    "id": 1,
    "name": "Alaminos City",
    "latitude": 16.1619,
    "longitude": 119.9803,
    "productionMT": 4520.0,
    "previousProductionMT": 3980.0,
    "productionChangePercent": 13.6,
    "productionRank": 1,
    "productionAreaHa": 385.0,
    "saltBeds": 62,
    "dominantMethod": "solar",
    "solarProductionMT": 3164.0,
    "cookedProductionMT": 452.0,
    "hybridProductionMT": 904.0,
    "insightSnippet": "Peak season typically occurs from March to June...",
    "historicalProduction": { "2023": 3200, "2024": 3980, "2025": 4520, "2026": 4890 }
  }
]
```

### 5.2 `production.json`

Time-series production records for trend charts (monthly or annual).

### 5.3 `demographics.json`

```json
{
  "provinceWide": {
    "ageGroups": { "18-30": 245, "31-40": 412, "41-50": 289, "51-60": 156, "61+": 24 },
    "genderDistribution": { "male": 682, "female": 421, "notSpecified": 23 }
  },
  "byMunicipality": { ... }
}
```

### 5.4 `supply_demand.json`

```json
{
  "nationalDemandMT": 683608,
  "pangasinanSupplyMT": 18642,
  "importedMT": 500000,
  "sufficiencyRate": 38.4,
  "sectorDemand": {
    "household": 320000,
    "foodProcessing": 180000,
    "industry": 120000,
    "agriculture": 63608
  }
}
```

## 6. Blueprint Implementation (`public_mock_dashboard.py`)

```python
from flask import Blueprint, render_template

public_mock_dashboard_bp = Blueprint("public_mock_dashboard", __name__)

@public_mock_dashboard_bp.route("/public-dashboard")
def dashboard():
    return render_template("public/dashboard.html")
```

**No database imports. No authentication decorators.**

## 7. JavaScript Architecture

### 7.1 `dashboard.js`

Responsibilities:
- `initDashboard()` — entry point
- `loadMockData()` — fetch all 4 JSON files with loading/error states
- `renderKPIs(data)` — populate 4 KPI cards
- `selectMunicipality(id)` — open offcanvas, populate detail panel
- `showLoading()` / `showError(message)` — UI state management

### 7.2 `map.js`

Responsibilities:
- `initMap()` — initialize Leaflet centered on Pangasinan
- `loadGeoJSON()` — fetch synthetic GeoJSON
- `classifyProduction(value)` — return HIGH / MEDIUM / LOW based on value distribution
- `createChoropleth(municipalities)` — render colored polygons
- `createTooltip(municipality)` — compact hover (name, production, trend, method)
- `onFeatureClick(e)` — open detail offcanvas

### 7.3 `charts.js`

Responsibilities:
- `renderComparisonChart(municipalities)` — ranked horizontal bar chart
- `renderSupplyDemandChart(data)` — grouped bar or horizontal comparison
- `renderSectorDemand(data)` — sector breakdown
- `renderAgeDistribution(data)` — province-wide age groups
- `renderGenderDistribution(data)` — province-wide gender breakdown
- `renderMethodDistribution(municipality)` — pie/doughnut for selected municipality
- `renderHistoricalTrend(municipality)` — line/bar for 2023–2026

## 8. Template Sections (`templates/public/dashboard.html`)

1. **Collapsible Sidebar Navigation** — Google Docs-style left sidebar with hamburger toggle, PangAsin branding, and section links (Overview, Municipalities, Supply & Demand, Producer Demographics). Sidebar collapses on mobile with overlay backdrop.
2. **Top Header / ASIN Overview Bar** — Sticky subheader below the sidebar containing ASIN Center mission text, data-as-of indicator, and synthetic data badge. This replaces the inline overview section for better visibility.
3. **Four KPI Cards** — Total Production, Production Area, Registered Producer Entries, National Self-Sufficiency. Values populated from mock data with loading and error fallbacks.
4. **Choropleth Map** — Leaflet with legend.
5. **Municipality Comparison** — Ranked bar chart (all 7).
6. **Supply & Demand Summary** — National demand, Pangasinan supply, imports, sector breakdown.
7. **Producer Demographics** — Age distribution, gender distribution.
8. **Municipality Detail Offcanvas** — Production summary, area, beds, method distribution, historical trend, demographics, insight.
9. **Footer** — ASIN Center / PSU credit, data note.

## 9. Responsive Breakpoints & Sidebar Behavior

- **Desktop (≥992px)**:
  - Sidebar is visible by default, ~260px wide
  - Main content has left margin to accommodate sidebar
  - 4 KPI cards in one row
  - Charts side-by-side where paired

- **Tablet (≥768px, <992px)**:
  - Sidebar collapsed by default, hamburger toggle visible
  - When opened, sidebar overlays content with backdrop
  - 2x2 KPI grid
  - Charts stack vertically

- **Mobile (<768px)**:
  - Sidebar hidden by default, hamburger toggle in top-left
  - Sidebar opens as full-height overlay with backdrop
  - 1-column KPI stack
  - Full-width map and charts
  - Offcanvas detail panel becomes full-screen

## 10. Accessibility Requirements

- Semantic HTML (`<main>`, `<nav>`, `<aside>` for sidebar)
- ARIA labels on sidebar toggle, map, and charts
- Keyboard-accessible sidebar, offcanvas, and controls
- Visible focus states
- Chart labels and text alternatives
- Map legend includes text labels (not color-only)
- Sufficient color contrast

## 11. Implementation Order (Phases)

### Phase 1 — Foundation
1. Create `static/data/mock/` directory
2. Create 4 JSON mock data files (internally consistent)
3. Create `static/css/dashboard.css` (variables, responsive grid, card styles, sidebar styles)
4. Create `static/js/dashboard.js`, `map.js`, `charts.js` (module pattern, empty functions)
5. Create `templates/public_base.html` with collapsible sidebar structure
6. Create `templates/public/dashboard.html` (skeleton with all sections, sidebar, sticky header)
7. Create `app/blueprints/public_mock_dashboard.py`
8. Register blueprint in `app/__init__.py`
9. Verify Flask starts without database errors

### Phase 2 — Data Visibility Fix
1. Verify all 4 mock JSON files return HTTP 200 and valid JSON
2. Add visible loading skeletons to KPI cards
3. Add visible error message with retry button
4. Test `Dashboard.loadAll()` in browser console
5. Confirm KPI values render after data loads

### Phase 3 — Sidebar Navigation
1. Implement hamburger toggle button
2. Build collapsible sidebar with branding and nav links
3. Add backdrop overlay for mobile/tablet
4. Implement keyboard navigation (Escape to close)
5. Add active state highlighting

### Phase 4 — Dashboard Overview & Header
1. Move ASIN overview and data-as-of to sticky subheader
2. Ensure synthetic data badge is always visible
3. Adjust main content padding/margin for sidebar

### Phase 5 — GIS Map
1. Create synthetic GeoJSON for 7 municipalities
2. Implement Leaflet map with choropleth classification
3. Add legend

### Phase 6 — Map Interaction
1. Implement hover tooltip (quick peek only)
2. Implement click → open offcanvas

### Phase 7 — Municipality Detail
1. Build offcanvas panel
2. Populate production summary, area, beds, methods
3. Add method distribution chart
4. Add historical trend chart
5. Add aggregated demographics
6. Add insight snippet

### Phase 8 — Comparison & Supply/Demand
1. Ranked bar chart (all 7 municipalities)
2. Supply vs demand visualization
3. Sector demand breakdown

### Phase 9 — Demographics
1. Province-wide age distribution chart
2. Province-wide gender distribution chart

### Phase 10 — Responsiveness & Polish
1. Test desktop/tablet/mobile layouts
2. Refine sidebar behavior on all breakpoints
3. Add error/empty states
4. Test keyboard accessibility

### Phase 11 — Final Review
1. Verify no DB imports in new blueprint
2. Verify no individual producer data exposed
3. Verify no admin functionality visible
4. Verify mock data clearly labeled
5. Verify all 7 municipalities present
6. Verify choropleth classification is data-driven
7. Verify hover shows only quick-peek fields
8. Verify sidebar collapses/expands correctly
9. Verify data-as-of and synthetic badge visibility
10. Verify responsive behavior

## 12. Validation Plan

After implementation:
1. Run `flask run` — app starts without DB connection errors
2. Navigate to `/public-dashboard` — loads without login
3. Verify sidebar hamburger toggle opens/closes sidebar
4. Verify sidebar contains correct nav links (Overview, Municipalities, Supply & Demand, Producer Demographics)
5. Verify 4 KPI cards display values from mock data (not "—")
6. Verify data-as-of and synthetic badge are visible in sticky header
7. Verify ASIN overview text is present
8. Verify Leaflet map shows 7 municipalities with choropleth colors
9. Verify hover tooltip shows only name, production, trend, method
10. Verify clicking municipality opens detail offcanvas
11. Verify comparison chart shows all 7 municipalities sorted by production
12. Verify supply/demand chart renders
13. Verify demographics charts render province-wide aggregates only
14. Verify no producer names, ages, or individual records appear
15. Verify responsive layout on mobile/tablet/desktop
16. Verify sidebar overlay behavior on mobile
17. Verify footer contains synthetic data disclaimer
18. Verify no console errors in browser DevTools
19. Verify all 4 mock JSON files return HTTP 200

## 13. Open Questions / Assumptions

- **Q**: Should the new dashboard replace the existing `/dashboard` route?
  - **A**: No. Keep existing route for future database integration. New route is `/public-dashboard`.

- **Q**: Should the landing page (`/`) redirect to the new dashboard?
  - **A**: No. Keep landing page as-is, add a prominent link/button to `/public-dashboard`.

- **Q**: What GeoJSON format to use for synthetic boundaries?
  - **A**: Simple FeatureCollections with rough rectangular/polygonal boundaries approximating municipality locations. Clear comment in code: "Replace with official Pangasinan municipal GeoJSON".

- **Q**: How to handle missing data in mock files?
  - **A**: Include `null` or `"N/A"` values where appropriate. UI displays "Not Available" for missing fields.

- **Q**: Why isn't synthetic data visible on the dashboard?
  - **A**: The current implementation relies entirely on JavaScript `fetch()` to load mock JSON files after page render. If the fetch fails (e.g., 404, network error, JS error), the KPI cards and charts remain empty. The fix is to add explicit loading/error UI states, verify static file paths, and ensure the JS gracefully handles missing data without breaking the layout.

## 14. Landing Page Behavior

The root route `/` currently renders `monitoring.landing` via `monitoring_bp`, which uses the existing `public/landing.html` template.

**Decision**: Replace the existing landing page with a lightweight splash page that:
- Shows ASIN Center / PangAsin branding (text-based logo)
- Displays a 3-second countdown before redirecting to `/public-dashboard`
- Does NOT show database-dependent KPI cards or charts
- Does NOT require authentication
- Uses a clean, professional research-oriented design

**Rationale**:
- Provides a branded entry point for the system
- Automatic redirect improves UX for returning visitors
- Splash page can later be removed or repurposed when real data is ready
- Keeps the public dashboard as the primary interface

## 15. Sidebar Navigation Design

Replace the top navbar with a collapsible left sidebar inspired by Google Docs.

**Structure**:
- Fixed sidebar on the left (`<aside>`)
- Hamburger toggle button fixed in top-left corner
- Sidebar width: ~260px when expanded
- Contains:
  - PangAsin branding/logo at top
  - Navigation links: Overview, Municipalities, Supply & Demand, Producer Demographics
  - "Data as of" + synthetic badge at bottom
- Main content area shifts right when sidebar is open (desktop)
- On mobile/tablet: sidebar overlays with backdrop, no content shift

**Interaction**:
- Click hamburger → sidebar slides in
- Click outside sidebar / press Escape → sidebar closes
- Active section highlighting based on scroll position or click
- Keyboard accessible (Tab, Enter, Escape)

**CSS**:
- Use Bootstrap offcanvas or custom CSS transitions
- Ensure z-indexing: sidebar > backdrop > main content
- Smooth transition for collapse/expand

## 16. Synthetic Data Visibility Fix

**Problem**: KPI cards and charts show "—" or empty because they rely on asynchronous `fetch()` calls to JSON files. If the request fails or JS errors occur, users see no data.

**Solution**:
1. **Verify static file paths**: Ensure `/static/data/mock/*.json` are accessible and return valid JSON with correct MIME type.
2. **Add visible loading states**: Show skeleton placeholders or "Loading..." text while data fetches.
3. **Add visible error states**: If fetch fails, display "Unable to load dashboard data. Please refresh." with a retry button.
4. **Inline fallback (optional)**: Embed a small JS object with critical KPI values as a fallback if JSON fetch fails, ensuring users always see numbers.
5. **Console error handling**: Catch and log JS errors without breaking the UI.

**Validation**:
- Open DevTools Network tab → confirm 4 JSON files return 200
- Confirm Chart.js renders all charts after data loads
- Confirm KPI values match mock data exactly

## 17. ASIN Overview & Data-As-of Placement

**Current issue**: Overview text and data-as-of are buried in the main content area, easy to miss.

**New placement**:
- Move ASIN overview text and data-as-of indicator to a **sticky subheader** directly below the sidebar (or top of main content when sidebar is collapsed)
- On desktop: appears as a thin banner between sidebar and content
- On mobile: appears as a collapsible info bar or top-of-page notice
- Synthetic data badge remains visible at all times

**Content**:
- ASIN Center mission text (one sentence)
- "Data as of: June 30, 2026"
- "Demo Data — Synthetic values for system prototyping" badge

## 18. Risks

- **Risk**: Synthetic GeoJSON boundaries look unrealistic.
  - **Mitigation**: Clearly mark as temporary; use simple shapes with comment indicating replacement needed.

- **Risk**: Mock data inconsistencies (e.g., method totals don't match production).
  - **Mitigation**: Validate JSON files before implementation; ensure `solar + cooked + hybrid ≈ total production`.

- **Risk**: Existing `base.html` leaks admin links if reused.
  - **Mitigation**: Use new `public_base.html` exclusively for this dashboard.

- **Risk**: Sidebar overlay breaks on mobile Safari.
  - **Mitigation**: Test on actual mobile viewport; use `position: fixed` with proper `overflow-y: auto` and `-webkit-overflow-scrolling: touch`.

- **Risk**: JSON fetch blocked by browser caching or CORS.
  - **Mitigation**: Use same-origin paths (`/static/...`), add cache-busting query param during development if needed.
