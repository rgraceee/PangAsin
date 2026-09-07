# Decision Support — Separate Admin Page

## Problem
The Decision Support feature was embedded in the Forecasting Dashboard as a toggle, but it doesn't work reliably. User wants it as a separate, dedicated page accessible via sidebar, with a simplified and working evaluation flow.

## Solution
Convert Decision Support into its own admin page with its own route, sidebar entry, and clean UI focused on clarity and reliability.

## Changes Required

### 1. `frontend/src/App.jsx`
- Import `DecisionSupport` component
- Add new route: `/admin/forecast/target` → `<DecisionSupport />`
- Add route title: `'/admin/forecast/target': 'Target Evaluation'`

### 2. `frontend/src/components/admin/AdminSidebar.jsx`
- Add new section item: `{ id: 'admin-forecast-target', label: 'Target Evaluation', icon: Target }`
- Add to `SECTIONS` array
- Add route handling in `handleClick` for `admin-forecast-target` → navigate to `/admin/forecast/target`
- Add active state detection in useEffect for `/admin/forecast/target`
- Exclude `admin-forecast-target` from IntersectionObserver scroll items

### 3. `frontend/src/components/admin/ForecastDashboard.jsx` — cleanup
- Remove all Decision Support state: `showDecisionSupport`, `decisionTarget`, `decisionHorizon`, `decisionResults`, `decisionLoading`
- Remove `runDecisionSupport` function
- Remove the entire Decision Support section from the JSX (the `showDecisionSupport && (...)` block)
- Remove the "Decision Support" toggle button from the header

### 4. Create `frontend/src/components/admin/DecisionSupport.jsx`
- New dedicated page component
- Clean, simple flow:
  - Top: Municipality selector (auto-synced with existing filter state if needed), Annual Target input, Forecast Horizon input, "Run Evaluation" button
  - Below: Results area with:
    - Summary stat cards (Annual Target, Projected Total, Variance, Status)
    - Narrative insight card with plain-language explanation
    - Simple bar chart showing monthly forecast vs monthly target (if data available)
    - If no forecast data available, show helpful message to run forecast first
- Use the existing `evaluateTarget()` from dataService
- Clean, modern styling with the PangAsin brand colors
- Error handling with user-friendly messages

### 5. `app/services/forecast_service.py`
- Fix `evaluate_target()` to also return `forecast_labels` (list of month labels like ["2026-07", "2026-08", ...]) so the frontend can display them on the chart
- Ensure `forecast_values` is padded to `forecast_horizon` length with zeros

### 6. `frontend/src/index.css`
- Add `.fc-decision-page` styling for the dedicated page layout
- Add `.fc-decision-summary` for stat cards
- Add `.fc-decision-narrative` for the insight box
- Keep it clean and minimal

### 7. `frontend/src/components/admin/ForecastDashboard.jsx` — also remove
- Remove the old `targetInsight` Alert (lines 584-621) - this was the text-based target vs forecast alert
- Remove the old Production Outlook card (lines 1036-1074)

## Validation Steps
1. Run `python run.py` and navigate to `/admin`
2. Verify sidebar shows "Target Evaluation" under Planning section
3. Click "Target Evaluation" in sidebar → should navigate to `/admin/forecast/target`
4. Verify page loads with municipality selector, target input, and Run Evaluation button
5. Enter annual target (e.g., 5000 MT) and click Run Evaluation
6. Verify:
   - Summary cards show correct numbers
   - Narrative insight explains the forecast in plain language
   - Chart shows monthly forecast vs target bars/line
   - If no forecast exists, helpful message appears
7. Verify Forecast Dashboard no longer has Decision Support toggle
8. Verify existing Forecast, Reports, and other admin pages still work
