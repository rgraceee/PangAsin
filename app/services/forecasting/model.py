"""
app/services/forecasting/model.py

Bottom-up forecasting of monthly salt production: SARIMA, Random Forest, Linear Regression.
Pure functions only: no printing, no file reading, no database access, no side effects on import.
(The database part lives in service.py.)

Changes compared with the original forecasting_model.py
    1. Evaluation fixed. The old code fitted every model on ALL months, forecast the 3 months AFTER
       the data ended, and compared that with the LAST 3 actual months. Now the models are fitted on
       the months before the hold-out and forecast the hold-out itself.
    2. Metrics: MAE, RMSE, MAPE, R2, MASE (MASE scale comes from the training months only).
    3. A model that cannot fit, or whose forecast explodes (e.g. SARIMA at 1e26), is reported as
       failed and excluded. There is no silent fallback and no fake "MAE = 0" row.
    4. Province total sums the SIMULATED futures, then takes the quantiles (summing each
       municipality's quantiles is not the quantile of the sum).
    5. statsmodels / scikit-learn / joblib are imported defensively, so importing this module can
       never stop the web app from starting.
    6. Municipalities listed in SCOPE_BY_MUNICIPALITY can opt out of the 2025 scope-change dummy.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import LinearRegression

    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

# ----------------------------------------------------------------- CONFIG
SEASON = 12
N_SIMS = 1000            # simulated futures for the intervals (200 is too few for stable 10%/90% bounds)
SEED = 42
EVAL_HORIZON = 3         # months held out for scoring
EVAL_ORIGINS = 1         # 1 = one hold-out (fast). Use 4+ for the paper (rolling origin).
MIN_MONTHS = 24          # fewer months than this -> "insufficient data"
MAX_JUMP = 20.0          # a forecast above 20x the highest month ever seen is treated as unstable
RF_TREES = 200

SCOPE_CHANGE_DATE = "2025-01-01"   # reporting scope changed (assisted only -> assisted + non-assisted)
# Municipalities whose series did not go through that change. None = no dummy.
# San Fabian's 2024-2025 values come from the LGU's own records. Edit if that is wrong.
SCOPE_BY_MUNICIPALITY = {"San Fabian": None}

MODEL_LABELS = {"sarima": "SARIMA", "random_forest": "Random Forest", "linear_regression": "Linear Regression"}


class ForecastError(Exception):
    """Raised when a series cannot be forecast; the message is safe to show/log."""


# ----------------------------------------------------------------- DATA
def to_series_dict(df, municipality_col="municipality", year_col="year", month_col="month", value_col="kg"):
    """Long table (municipality, year, month, kg) -> {municipality: monthly Series in kg}. Gaps stay NaN."""
    d = df.copy()
    d["_date"] = pd.to_datetime(pd.DataFrame({"year": d[year_col], "month": d[month_col], "day": 1}))
    d[value_col] = pd.to_numeric(d[value_col], errors="coerce")
    out = {}
    for muni, g in d.groupby(municipality_col):
        s = g.groupby("_date")[value_col].sum(min_count=1).sort_index().asfreq("MS")
        if s.notna().sum() == 0:
            continue
        out[str(muni)] = s.loc[s.first_valid_index(): s.last_valid_index()].rename("kg")
    return out


def scope_date_for(y: pd.Series, municipality: str | None):
    """Scope-change date for this series, or None if the dummy does not apply / the series does not span it."""
    cc = SCOPE_BY_MUNICIPALITY.get(municipality, SCOPE_CHANGE_DATE)
    if cc is None:
        return None
    cc = pd.Timestamp(cc)
    return cc if (y.index.min() < cc <= y.index.max()) else None


def _calendar(index: pd.DatetimeIndex, scope_date) -> np.ndarray:
    m = index.month.to_numpy()
    cols = [np.sin(2 * np.pi * m / SEASON), np.cos(2 * np.pi * m / SEASON)]
    if scope_date is not None:
        cols.append((index >= pd.Timestamp(scope_date)).astype(float))
    return np.column_stack(cols)


def _future_index(last: pd.Timestamp, h: int) -> pd.DatetimeIndex:
    return pd.date_range(last + pd.offsets.MonthBegin(1), periods=h, freq="MS")


# ----------------------------------------------------------------- MODELS (fitted on log1p(kg))
class SarimaModel:
    """SARIMA(1,0,0)(1,0,0,12) + constant (+ scope-change dummy when the training months span it)."""

    def __init__(self, y_log: pd.Series, scope_date):
        self.scope_date, self.last = scope_date, y_log.index[-1]
        X = None
        if scope_date is not None:
            X = pd.DataFrame({"scope_change": (y_log.index >= pd.Timestamp(scope_date)).astype(float)}, index=y_log.index)
            if X["scope_change"].nunique() < 2:        # constant column would clash with the intercept
                X = None
        self.use_scope = X is not None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.res = SARIMAX(
                y_log, exog=X, order=(1, 0, 0), seasonal_order=(1, 0, 0, SEASON), trend="c",
                enforce_stationarity=False, enforce_invertibility=False,
            ).fit(disp=False, maxiter=100)

    def _exog(self, h):
        if not self.use_scope:
            return None
        idx = _future_index(self.last, h)
        return pd.DataFrame({"scope_change": (idx >= pd.Timestamp(self.scope_date)).astype(float)}, index=idx)

    def point(self, h):
        return np.asarray(self.res.get_forecast(steps=h, exog=self._exog(h)).predicted_mean)

    def simulate(self, h, n, rng):
        state = np.random.get_state()                  # statsmodels draws from the global RNG:
        np.random.seed(int(rng.integers(1_000_000_000)))   # seed it, then put it back
        try:
            sim = self.res.simulate(nsimulations=h, repetitions=n, anchor="end", exog=self._exog(h))
        finally:
            np.random.set_state(state)
        return np.asarray(sim).reshape(h, -1)


def _make_rf():
    return RandomForestRegressor(n_estimators=RF_TREES, min_samples_leaf=2, bootstrap=True,
                                 oob_score=True, random_state=SEED)


class LagModel:
    """
    Random Forest / Linear Regression on lagged log-production + month-of-year (+ scope dummy).
    Multi-step forecasts are recursive. Intervals bootstrap the model's own errors
    (out-of-bag for the forest, in-sample for linear regression).
    """

    def __init__(self, y_log: pd.Series, make_estimator, scope_date):
        self.last = y_log.index[-1]
        n = len(y_log)
        self.lags = [1, 2, 3] + ([SEASON] if n >= 36 else [])
        sd = pd.Timestamp(scope_date) if scope_date is not None else None
        self.sd = sd if (sd is not None and y_log.index.min() < sd <= y_log.index.max()) else None

        yv = y_log.to_numpy(dtype=float)
        cal = _calendar(y_log.index, self.sd)
        rows = np.arange(max(self.lags), n)
        X = np.column_stack([np.column_stack([yv[rows - l] for l in self.lags]), cal[rows]])
        t = yv[rows]
        ok = ~np.isnan(X).any(axis=1) & ~np.isnan(t)
        X, t = X[ok], t[ok]
        if len(t) < 10:
            raise ValueError(f"only {len(t)} usable training rows")

        self.est = make_estimator()
        self.est.fit(X, t)
        if hasattr(self.est, "oob_prediction_"):
            r = t - self.est.oob_prediction_
            r = r[~np.isnan(r)]
        else:
            r = t - self.est.predict(X)
            dof = len(r) - X.shape[1] - 1
            if dof > 0:
                r = r * np.sqrt(len(r) / dof)
        self.resid = r - np.median(r) if len(r) else np.zeros(1)
        self.hist0 = pd.Series(yv).ffill().bfill().to_numpy()

    def _features(self, hist, date):
        lagcols = [hist[:, -l] for l in self.lags]
        cal = _calendar(pd.DatetimeIndex([date]), self.sd)
        return np.column_stack(lagcols + [np.repeat(cal, hist.shape[0], axis=0)])

    def _date(self, j):
        return self.last + pd.offsets.MonthBegin(j + 1)

    def point(self, h):
        hist, out = self.hist0[None, :].copy(), []
        for j in range(h):
            p = self.est.predict(self._features(hist, self._date(j)))
            out.append(float(p[0]))
            hist = np.column_stack([hist, p])
        return np.array(out)

    def simulate(self, h, n, rng):
        hist = np.tile(self.hist0, (n, 1))
        for j in range(h):
            p = self.est.predict(self._features(hist, self._date(j))) + rng.choice(self.resid, size=n)
            hist = np.column_stack([hist, p])
        return hist[:, -h:].T


def _builders(y_log: pd.Series, scope_date) -> dict:
    b = {}
    if HAS_STATSMODELS:
        b["sarima"] = lambda: SarimaModel(y_log, scope_date)
    if HAS_SKLEARN:
        b["random_forest"] = lambda: LagModel(y_log, _make_rf, scope_date)
        b["linear_regression"] = lambda: LagModel(y_log, LinearRegression, scope_date)
    return b


def _check_stable(values_kg, history_kg, what="forecast"):
    cap = MAX_JUMP * float(np.nanmax(history_kg))
    if not np.all(np.isfinite(values_kg)) or float(np.nanmax(values_kg)) > cap:
        raise ValueError(f"unstable {what}")


# ----------------------------------------------------------------- EVALUATION
def evaluate_models(y_kg: pd.Series, scope_date, horizon=EVAL_HORIZON, origins=EVAL_ORIGINS):
    """
    Hold-out scoring. For each origin the models are fitted ONLY on months before it, then asked
    for the next `horizon` months, which are compared with what really happened.
    Returns (metrics sorted by MASE, {model: reason it failed}). All errors are in kg.
    A model must succeed at every origin to be ranked.
    """
    n = len(y_kg)
    last_origin = n - horizon
    first_origin = last_origin - (origins - 1)
    if first_origin <= SEASON:
        raise ForecastError(f"not enough months ({n}) for a {horizon}-month hold-out")
    y_log = np.log1p(y_kg)

    scored: dict[str, tuple[list, list, list]] = {}
    failures: dict[str, str] = {}
    for name in _builders(y_log, scope_date):
        A, F, S = [], [], []
        try:
            for origin in range(first_origin, last_origin + 1):
                train_kg, train_log = y_kg.iloc[:origin], y_log.iloc[:origin]
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    pred = np.expm1(_builders(train_log, scope_date)[name]().point(horizon)).clip(min=0)
                _check_stable(pred, train_kg.to_numpy())
                actual = y_kg.iloc[origin:origin + horizon].to_numpy(dtype=float)
                tr = train_kg.to_numpy(dtype=float)
                scale = np.nanmean(np.abs(tr[SEASON:] - tr[:-SEASON]))
                ok = ~np.isnan(actual)
                A += list(actual[ok]); F += list(pred[ok]); S += [scale] * int(ok.sum())
        except Exception as exc:
            failures[name] = f"{type(exc).__name__}: {exc}"[:200]
            continue
        scored[name] = (A, F, S)

    rows = []
    for name, (A, F, S) in scored.items():
        if not A:
            continue
        a, f, s = np.array(A), np.array(F), np.array(S)
        err = a - f
        pos = a > 0
        sst = np.sum((a - a.mean()) ** 2)
        rows.append({
            "model": name,
            "mae": float(np.mean(np.abs(err))),
            "rmse": float(np.sqrt(np.mean(err ** 2))),
            "mape": float(100 * np.mean(np.abs(err[pos]) / a[pos])) if pos.any() else None,
            "r2": float(1 - np.sum(err ** 2) / sst) if sst > 0 else None,
            "mase": float(np.mean(np.abs(err) / s)),
            "n_test_points": int(len(a)),
        })
    rows.sort(key=lambda r: (np.inf if not np.isfinite(r["mase"]) else r["mase"]))
    return rows, failures


# ----------------------------------------------------------------- FORECAST
def fit_and_forecast(y_kg, scope_date, model_name, horizon, n_sims=N_SIMS, seed=SEED):
    """Fit on all months. Returns (DataFrame predicted/lower/upper in kg, simulated futures (horizon, n_sims) in kg)."""
    y_log = np.log1p(y_kg)
    m = _builders(y_log, scope_date)[model_name]()
    rng = np.random.default_rng(seed)
    sims = np.expm1(m.simulate(horizon, n_sims, rng)).clip(min=0)
    point = np.expm1(m.point(horizon)).clip(min=0)
    hist = y_kg.to_numpy(dtype=float)
    _check_stable(point, hist, "forecast")
    _check_stable(np.nanpercentile(sims, 99, axis=1), hist, "simulation")

    q = np.quantile(sims, [0.10, 0.90], axis=1)
    fc = pd.DataFrame({
        "predicted_kg": point,
        "lower_kg": np.minimum(q[0], point),     # keep lower <= predicted <= upper
        "upper_kg": np.maximum(q[1], point),
    }, index=_future_index(y_kg.index[-1], horizon))
    return fc, sims


def forecast_municipality(y_kg, municipality, horizon=12, n_sims=N_SIMS, seed=SEED, model=None,
                          eval_horizon=EVAL_HORIZON, eval_origins=EVAL_ORIGINS):
    """One series -> dict with status, metrics, chosen model, forecast table and simulations."""
    n = int(y_kg.notna().sum())
    if n < MIN_MONTHS:
        raise ForecastError(f"only {n} months of data; at least {MIN_MONTHS} are needed")
    if (y_kg.dropna() < 0).any():
        raise ForecastError("negative production values found")
    sd = scope_date_for(y_kg, municipality)

    metrics, failures = evaluate_models(y_kg, sd, eval_horizon, eval_origins)
    if model is not None:
        chosen = model
    elif metrics:
        chosen = metrics[0]["model"]
    else:
        raise ForecastError(f"no model could be fitted: {failures}")
    if chosen not in _builders(np.log1p(y_kg), sd):
        raise ForecastError(f"model {chosen!r} is not available (is statsmodels / scikit-learn installed?)")

    fc, sims = fit_and_forecast(y_kg, sd, chosen, horizon, n_sims, seed)
    return {
        "municipality": municipality, "status": "ok", "best_model": chosen,
        "model_label": MODEL_LABELS.get(chosen, chosen),
        "metrics": metrics, "failures": failures,
        "forecast": fc, "sims_kg": sims, "history_kg": y_kg,
        "n_months": n, "last_month": y_kg.index[-1], "scope_date": sd,
    }


def _safe(name, y, kwargs):
    try:
        return forecast_municipality(y, name, **kwargs)
    except Exception as exc:                   # one municipality failing must not stop the others
        return {"municipality": name, "status": "error", "error": f"{type(exc).__name__}: {exc}"[:300]}


def forecast_all(series: dict, horizon=12, n_sims=N_SIMS, seed=SEED, model=None, n_jobs=1, **kwargs):
    """
    Forecast every municipality, then build the bottom-up province total.
    n_jobs=1 runs sequentially (use this inside the web app). n_jobs=-1 uses joblib (scripts only).
    model: force one technique for all municipalities (e.g. "sarima"); None = best MASE per municipality.
    """
    opts = dict(horizon=horizon, n_sims=n_sims, seed=seed, model=model, **kwargs)
    names = list(series)
    if n_jobs == 1:
        results = [_safe(n, series[n], opts) for n in names]
    else:
        from joblib import Parallel, delayed   # imported only when asked for
        results = Parallel(n_jobs=n_jobs)(delayed(_safe)(n, series[n], opts) for n in names)

    province = None
    ok = [r for r in results if r["status"] == "ok"]
    if ok:
        # only municipalities forecast over the same months can be added together
        groups: dict[tuple, list] = {}
        for r in ok:
            groups.setdefault(tuple(r["forecast"].index), []).append(r)
        inc = max(groups.values(), key=len)
        exc_names = [r["municipality"] for r in ok if r not in inc]
        exc_names += [r["municipality"] for r in results if r["status"] != "ok"]

        total_sims = sum(r["sims_kg"] for r in inc)
        idx = inc[0]["forecast"].index
        point = sum(r["forecast"]["predicted_kg"].to_numpy() for r in inc)
        q = np.quantile(total_sims, [0.10, 0.90], axis=1)
        hist = pd.concat([r["history_kg"].rename(r["municipality"]) for r in inc], axis=1)
        hist = hist.sum(axis=1, min_count=hist.shape[1]).dropna()
        province = {
            "municipality": None, "status": "ok", "best_model": "bottom_up", "model_label": "Bottom-up sum",
            "forecast": pd.DataFrame({
                "predicted_kg": point, "lower_kg": np.minimum(q[0], point), "upper_kg": np.maximum(q[1], point),
            }, index=idx),
            "history_kg": hist, "n_months": int(len(hist)), "last_month": idx[0] - pd.offsets.MonthBegin(1),
            "included": [r["municipality"] for r in inc], "excluded": exc_names,
            "complete": not exc_names and len(inc) == len(names),
            "metrics": [], "failures": {},
        }
    return {"municipalities": results, "province": province}
