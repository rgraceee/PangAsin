import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminDescriptive } from '../../../services/dataService';
import MuniMonthlyTrendChart from './MuniMonthlyTrendChart';

vi.mock('../../../services/dataService', () => ({
  getAdminDescriptive: vi.fn(),
}));

vi.mock('recharts', () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ data }) => (
    <div data-testid="trend-data" data-labels={data.map((row) => row.label).join(',')} />
  ),
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('MuniMonthlyTrendChart year filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminDescriptive.mockImplementation(({ year }) => {
      const selectedYear = year || 2025;
      return Promise.resolve({
        selected_year: selectedYear,
        available_years: [2025, 2024],
        monthly_series: [{
          month: `${selectedYear}-01`,
          total_mt: selectedYear === 2025 ? 20 : 10,
        }],
      });
    });
  });

  it('loads the selected year and updates the chart when the year changes', async () => {
    render(<MuniMonthlyTrendChart selectedMuni="Bolinao" municipalityId={12} />);

    const yearFilter = await screen.findByRole('combobox', {
      name: 'Production trend year',
    });
    await waitFor(() => expect(yearFilter.value).toBe('2025'));
    const trend = await screen.findByTestId('trend-data');
    expect(trend.getAttribute('data-labels')).toBe('Jan 2025');

    fireEvent.change(yearFilter, { target: { value: '2024' } });

    await waitFor(() => {
      expect(getAdminDescriptive).toHaveBeenLastCalledWith({
        months: 12,
        source: 'municipality_production',
        municipality_id: 12,
        year: '2024',
      });
      expect(screen.getByTestId('trend-data').getAttribute('data-labels')).toBe('Jan 2024');
    });
  });
});
