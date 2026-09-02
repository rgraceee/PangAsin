# Plan: Login route access — No further action

## Status
**User has confirmed they already reached the login route.** No implementation work is required.

## Summary
The login page is already routed at `/#/login` (HashRouter — the hash is required by design). For reference:

- `frontend/src/App.jsx:43` — `<Route path="/login" element={<Login onLogin={setUser} />} />`
- Sign in as admin: `admin@pangasin.gov.ph` / `admin123`
- Sign in as encoder (Bolinao): `bolinao.encoder@pangasin.gov.ph` / `encoder123`

## Optional follow-up (NOT doing unless requested)
A minor cleanup is still available if you want it later:

1. `frontend/src/components/encoder/EncoderLayout.jsx:15` — `navigate('/encoder/login')` after logout (relies on the legacy `<Route path="/encoder/login" element={<Navigate to="/login" replace />} />` redirect at `App.jsx:44`). Could be changed to `navigate('/login')` for consistency with `AdminLayout.jsx:16`.
2. `frontend/src/App.jsx:44` — remove the legacy `/encoder/login` redirect once (1) is done.

No other login-route changes are needed.