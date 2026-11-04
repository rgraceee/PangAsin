import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DataQualityDashboard from './DataQualityDashboard';
import { getDataQuality } from '../../services/dataService';

vi.mock('../../services/dataService', () => ({
  getDataQuality: vi.fn(),
}));

vi.mock('../../hooks/useMunicipalityDirectory', () => ({
  default: () => ({ activeNames: [] }),
}));

const months = [
  '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
  '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
];

const dataQuality = {
  available_years: [2025, 2026],
  selected_year: 2026,
  months,
  expected_months: 12,
  current_month: '2026-11',
  generated_at: '2026-11-05T00:00:00Z',
  kpis: {
    pending_total: 0,
    oldest_pending_days: 0,
    reporting_pct: 75,
    municipality_count: 1,
    behind_count: 1,
    review_clearable_count: 0,
    field_pct: 90,
  },
  fields: [{ key: 'production_volume_mt', label: 'Salt production', pct: 90 }],
  municipalities: [{
    id: 1,
    name: 'Bolinao',
    cells: Object.fromEntries(months.map((month, index) => [month, index < 9 ? 'reported' : 'missing'])),
    reporting_pct: 75,
    reported_months: 9,
    expected_months: 12,
    pending_count: 0,
  }],
};

describe('Data Integrity (Completeness)', () => {
  beforeEach(() => {
    getDataQuality.mockReset().mockResolvedValue(dataQuality);
  });

  it('filters by year and period, showing percentages and completed month counts without scores', async () => {
    render(<DataQualityDashboard />);

    expect(await screen.findByRole('heading', { name: 'Data Integrity (Completeness)' })).toBeInTheDocument();
    expect(await screen.findByText('9/12 months')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Score')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2025' } });
    await waitFor(() => expect(getDataQuality).toHaveBeenLastCalledWith({ months: 12, year: 2025 }));

    fireEvent.click(screen.getByRole('button', { name: '6 months' }));
    await waitFor(() => expect(getDataQuality).toHaveBeenLastCalledWith({ months: 6, year: 2025 }));
  });
});
