"""Compare forecasts against the workbook's 2024-2026 validation plot series.

Training data: IQR-adjusted monthly estimates for 2024-2025.
Test data: Jan-Sep 2026 San Fabian-based synthetic reference values.

Run:
    python validate_2026_arima_sarima.py
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re

import matplotlib

matplotlib.use("Agg")

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

try:
    from statsmodels.tsa.arima.model import ARIMA
except ImportError as exc:
    raise SystemExit(
        "statsmodels is required. Install dependencies with "
        "'python -m pip install -r requirements-forecast.txt'."
    ) from exc


TRAINING_START = pd.Timestamp("2024-01-01")
TRAINING_END = pd.Timestamp("2025-12-01")
TEST_START = pd.Timestamp("2026-01-01")
TEST_MONTHS = 9
MODEL_ARIMA = "ARIMA(1,1,1)"
MODEL_SEASONAL_NAIVE = "Seasonal naive (same month, 2025)"


def read_backtest_data(
    workbook_path: Path,
) -> tuple[dict[str, pd.Series], dict[str, pd.Series]]:
    """Load the IQR-adjusted training and validation-plot reference series."""
    if not workbook_path.is_file():
        raise FileNotFoundError(f"IQR workbook not found: {workbook_path}")

    training_table = pd.read_excel(workbook_path, sheet_name="IQR_2024_25_Detail")
    test_table = pd.read_excel(workbook_path, sheet_name="2026_Monthly_Synthesis")

    training_required = {
        "Municipality",
        "Year",
        "Month",
        "Adjusted estimate (kg)",
    }
    test_required = {
        "Municipality",
        "Year",
        "Month",
        "Month number",
        "Monthly production (kg)",
    }
    missing_training = training_required - set(training_table.columns)
    missing_test = test_required - set(test_table.columns)
    if missing_training or missing_test:
        raise ValueError(
            "The workbook does not contain the required IQR-adjusted training and "
            f"2026 test columns. Training missing: {sorted(missing_training)}; "
            f"test missing: {sorted(missing_test)}."
        )

    month_numbers = {
        month: number
        for number, month in enumerate(
            ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
             "Oct", "Nov", "Dec"],
            start=1,
        )
    }

    training: dict[str, pd.Series] = {}
    test: dict[str, pd.Series] = {}
    expected_training_index = pd.date_range(
        TRAINING_START, TRAINING_END, freq="MS"
    )
    expected_test_index = pd.date_range(
        TEST_START, periods=TEST_MONTHS, freq="MS"
    )

    municipalities = sorted(training_table["Municipality"].dropna().unique())
    if not municipalities:
        raise ValueError("No municipalities were found in the IQR training sheet.")

    for municipality in municipalities:
        train_rows = training_table.loc[
            training_table["Municipality"] == municipality
        ].copy()
        train_rows["month_number"] = train_rows["Month"].map(month_numbers)
        train_rows["date"] = pd.to_datetime(
            train_rows["Year"].astype(int).astype(str)
            + "-"
            + train_rows["month_number"].astype(int).astype(str)
            + "-01"
        )
        train_rows = train_rows.sort_values("date")
        train_values = pd.to_numeric(
            train_rows["Adjusted estimate (kg)"], errors="raise"
        ).to_numpy(dtype=float)
        train_series = pd.Series(
            train_values,
            index=pd.DatetimeIndex(train_rows["date"], freq="MS"),
            name=municipality,
        )
        if (
            len(train_series) != 24
            or not train_series.index.equals(expected_training_index)
            or not np.isfinite(train_values).all()
            or (train_values <= 0).any()
        ):
            raise ValueError(
                f"{municipality} must have 24 positive monthly training values "
                "from January 2024 through December 2025."
            )
        train_series.index.name = "date"
        training[municipality] = train_series

        test_rows = test_table.loc[
            test_table["Municipality"] == municipality
        ].copy()
        test_rows["month_number"] = test_rows["Month"].map(month_numbers)
        test_rows["date"] = pd.to_datetime(
            test_rows["Year"].astype(int).astype(str)
            + "-"
            + test_rows["month_number"].astype(int).astype(str)
            + "-01"
        )
        test_rows = test_rows.sort_values("date")
        test_values = pd.to_numeric(
            test_rows["Monthly production (kg)"], errors="raise"
        ).to_numpy(dtype=float)
        test_series = pd.Series(
            test_values,
            index=pd.DatetimeIndex(test_rows["date"], freq="MS"),
            name=municipality,
        )
        if (
            len(test_series) != TEST_MONTHS
            or not test_series.index.equals(expected_test_index)
            or not np.isfinite(test_values).all()
            or (test_values <= 0).any()
        ):
            raise ValueError(
                f"{municipality} must have nine positive test values from "
                "January through September 2026."
            )
        test_series.index.name = "date"
        test[municipality] = test_series

    if set(training) != set(test):
        raise ValueError(
            "The municipalities in training and test data do not match."
        )
    return training, test


def fit_and_forecast(
    municipality: str, training: pd.Series, test: pd.Series
) -> list[dict[str, object]]:
    """Compare ARIMA with the prior-year same-month seasonal baseline."""
    transformed = np.log1p(training)
    fitted = ARIMA(transformed, order=(1, 1, 1)).fit()
    if not fitted.mle_retvals.get("converged", True):
        raise RuntimeError(
            f"{MODEL_ARIMA} failed to converge for {municipality}; "
            "validation output was not completed."
        )

    prediction = fitted.get_forecast(steps=TEST_MONTHS)
    arima_forecast = np.maximum(
        np.expm1(np.asarray(prediction.predicted_mean, dtype=float)), 0
    )
    arima_interval = np.maximum(
        np.expm1(np.asarray(prediction.conf_int(alpha=0.05), dtype=float)), 0
    )
    seasonal_naive_forecast = training.iloc[-12:].to_numpy(dtype=float)[:TEST_MONTHS]
    model_forecasts = [
        (MODEL_ARIMA, arima_forecast, arima_interval),
        (
            MODEL_SEASONAL_NAIVE,
            seasonal_naive_forecast,
            np.full((TEST_MONTHS, 2), np.nan),
        ),
    ]
    rows: list[dict[str, object]] = []

    for model_name, forecast, interval in model_forecasts:
        test_values = test.to_numpy(dtype=float)
        errors = forecast - test_values
        absolute_errors = np.abs(errors)
        percentage_errors = absolute_errors / test_values
        smape_denominator = np.abs(forecast) + np.abs(test_values)
        smape = np.divide(
            2 * absolute_errors,
            smape_denominator,
            out=np.zeros_like(absolute_errors),
            where=smape_denominator != 0,
        )

        for date, estimate, observed, bounds, error, ape, symmetric_ape in zip(
            test.index,
            forecast,
            test_values,
            interval,
            errors,
            percentage_errors,
            smape,
        ):
            rows.append(
                {
                    "municipality": municipality,
                    "date": date,
                    "year": date.year,
                    "month": date.strftime("%B"),
                    "model": model_name,
                    "forecast_kg": float(estimate),
                    "test_production_kg": float(observed),
                    "error_kg": float(error),
                    "absolute_error_kg": float(abs(error)),
                    "absolute_percentage_error": float(ape),
                    "symmetric_absolute_percentage_error": float(symmetric_ape),
                    "lower_95_kg": float(bounds[0]),
                    "upper_95_kg": float(bounds[1]),
                    "training_months": len(training),
                    "test_months": len(test),
                }
            )
    return rows


def calculate_metrics(monthly: pd.DataFrame) -> pd.DataFrame:
    """Calculate municipality, model, and pooled holdout metrics."""
    metrics = []
    grouped = list(monthly.groupby(["municipality", "model"], sort=True))
    grouped.extend(
        (("ALL MUNICIPALITIES", model), group)
        for model, group in monthly.groupby("model", sort=True)
    )
    for (municipality, model_name), group in grouped:
        errors = group["error_kg"].to_numpy(dtype=float)
        actual = group["test_production_kg"].to_numpy(dtype=float)
        forecast = group["forecast_kg"].to_numpy(dtype=float)
        metrics.append(
            {
                "municipality": municipality,
                "model": model_name,
                "test_months": len(group),
                "MAE_kg": float(np.mean(np.abs(errors))),
                "RMSE_kg": float(np.sqrt(np.mean(np.square(errors)))),
                "WAPE_percent": float(
                    np.sum(np.abs(errors)) / np.sum(actual) * 100
                ),
                "MAPE_percent": float(
                    group["absolute_percentage_error"].mean() * 100
                ),
                "sMAPE_percent": float(
                    group["symmetric_absolute_percentage_error"].mean() * 100
                ),
                "bias_kg": float(np.mean(forecast - actual)),
            }
        )
    return pd.DataFrame(metrics)


def save_validation_plots(
    training: dict[str, pd.Series],
    test: dict[str, pd.Series],
    forecasts: pd.DataFrame,
    plot_directory: Path,
) -> None:
    """Plot the workbook's IQR-adjusted training and synthetic 2026 reference."""
    plot_directory.mkdir(parents=True, exist_ok=True)
    for municipality, history in training.items():
        figure, axis = plt.subplots(figsize=(11, 5.5))
        axis.plot(
            history.index,
            history.to_numpy(),
            color="black",
            marker="o",
            markersize=3,
            label="Training history (IQR adjusted, 2024-2025)",
        )
        test_series = test[municipality]
        axis.plot(
            test_series.index,
            test_series.to_numpy(),
            color="green",
            marker="o",
            markersize=4,
            linestyle="-",
            label="Actual/reference: generated from San Fabian (synthetic)",
        )

        municipality_forecasts = forecasts[
            forecasts["municipality"] == municipality
        ]
        for model_name, model_rows in municipality_forecasts.groupby("model"):
            dates = pd.to_datetime(model_rows["date"])
            values = model_rows["forecast_kg"].to_numpy(dtype=float)
            lower = np.maximum(model_rows["lower_95_kg"].to_numpy(dtype=float), 1.0)
            upper = np.maximum(model_rows["upper_95_kg"].to_numpy(dtype=float), 1.0)
            axis.plot(dates, values, marker="o", markersize=3, label=model_name)
            if np.isfinite(lower).all() and np.isfinite(upper).all():
                axis.fill_between(
                    dates,
                    lower,
                    upper,
                    alpha=0.13,
                    label=f"{model_name} 95% interval",
                )

        axis.axvline(TEST_START, color="gray", linestyle=":")
        axis.set(
            title=f"{municipality}: 2026 Jan-Sep generated data vs forecast baselines",
            xlabel="Month",
            ylabel="Production (kg, log scale)",
        )
        axis.set_yscale("log")
        axis.set_xlim(pd.Timestamp("2023-12-01"), pd.Timestamp("2026-10-01"))
        axis.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
        axis.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
        axis.grid(True, alpha=0.25)
        axis.legend(fontsize=8)
        figure.autofmt_xdate()
        figure.tight_layout()
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", municipality).strip("_")
        figure.savefig(
            plot_directory / f"{safe_name}_2026_holdout_validation.png", dpi=150
        )
        plt.close(figure)


def main() -> None:
    script_directory = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description=(
            "Compare ARIMA with a seasonal-naive baseline: train on "
            "IQR-adjusted 2024-2025 estimates and compare Jan-Sep 2026 "
            "predictions to the workbook's San Fabian-based reference series."
        )
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=script_directory / "PangAsin_Salt_Estimates_Final_IQR_2026.xlsx",
        help="Workbook containing IQR-adjusted training and 2026 monthly synthesis sheets.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=script_directory / "arima_sarima_2026_validation_iqr.xlsx",
        help="Validation workbook output path.",
    )
    parser.add_argument(
        "--plots",
        type=Path,
        default=script_directory / "arima_sarima_2026_validation_iqr_plots",
        help="Directory for municipality validation plots.",
    )
    args = parser.parse_args()

    training, test = read_backtest_data(args.input)
    forecast_rows = [
        row
        for municipality in sorted(training)
        for row in fit_and_forecast(municipality, training[municipality], test[municipality])
    ]
    monthly = pd.DataFrame(forecast_rows)
    metrics = calculate_metrics(monthly)
    pooled_metrics = metrics.loc[
        metrics["municipality"] == "ALL MUNICIPALITIES"
    ].sort_values("WAPE_percent")
    notes = pd.DataFrame(
        [
            ("Training period", "January 2024 through December 2025"),
            ("Training source", "IQR_2024_25_Detail / Adjusted estimate (kg)"),
            ("Test period", "January through September 2026"),
            ("Test source", "2026_Monthly_Synthesis / Monthly production (kg)"),
            ("Test-data status", "Generated using the San Fabian-based IQR method; synthetic reference series."),
            ("Models", f"{MODEL_ARIMA}; {MODEL_SEASONAL_NAIVE}"),
            ("Seasonal-naive method", "Forecast each 2026 month using the corresponding 2025 month; no fitted seasonal model or prediction interval."),
            ("Evaluation", "Nine-month holdout; MAE, RMSE, WAPE, MAPE, sMAPE, and bias"),
            ("Use caution", "The 2026 green line is a synthetic comparison reference, not independently observed monthly production."),
        ],
        columns=["Item", "Value"],
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(args.output, engine="openpyxl") as writer:
        monthly.rename(
            columns={
                "forecast_kg": "Predicted production (kg)",
                "test_production_kg": (
                    "Actual/reference production (kg)"
                ),
            }
        ).to_excel(writer, sheet_name="Monthly Holdout", index=False)
        metrics.to_excel(writer, sheet_name="Accuracy Metrics", index=False)
        notes.to_excel(writer, sheet_name="Run Notes", index=False)
    save_validation_plots(training, test, monthly, args.plots)

    print(f"Training: 2024-2025 IQR-adjusted estimates ({len(training)} municipalities x 24 months).")
    print("Test: Jan-Sep 2026 San Fabian-based synthetic reference series.")
    print(f"Validation workbook: {args.output}")
    print(f"Plots: {args.plots}")
    print("Pooled metrics (lower errors are better):")
    print(pooled_metrics.to_string(index=False, float_format=lambda value: f"{value:,.2f}"))


if __name__ == "__main__":
    main()
