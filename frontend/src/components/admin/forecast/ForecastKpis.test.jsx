import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ForecastKpis from './ForecastKpis';

describe('ForecastKpis', () => {
  it('keeps the forecast horizon once and puts expected-change indicators beside its value', () => {
    render(
      <ForecastKpis
        recordedMT={14981.79}
        recordedPeriodLabel="all available months"
        recordedThrough="October 2026"
        forecastMT={2386.02}
        horizon={6}
        expectedChangePct={75.8}
        runMonth="November 2026"
      />,
    );

    const forecast = screen.getByRole('group', {
      name: /Forecasted Total Production: 2,386\.02 Metric Tons \(MT\)/,
    });
    expect(within(forecast).getByText('Next 6 months')).toBeInTheDocument();
    expect(within(forecast).queryByText('6 months')).not.toBeInTheDocument();

    const change = screen.getByRole('group', { name: /Expected Change: \+75\.8%/ });
    expect(within(change).getByText('Increasing')).toBeInTheDocument();
    expect(change.querySelector('.ui-kpi__trend-main')).toHaveTextContent('▲75.8%');
    expect(change.querySelector('.ui-kpi__unit')).not.toBeInTheDocument();
    expect(change.querySelector('.ui-kpi__caption')).not.toBeInTheDocument();
    const value = change.querySelector('.ui-kpi__value');
    const indicators = change.querySelector('.ui-kpi__indicators');
    expect(value.parentElement).toBe(indicators.parentElement);
    expect(value.compareDocumentPosition(indicators) & 4).toBeTruthy();
  });
});
