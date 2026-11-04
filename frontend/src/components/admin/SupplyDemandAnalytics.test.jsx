import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getAdminSupplyDemand } from '../../services/dataService';
import SupplyDemandAnalytics from './SupplyDemandAnalytics';

vi.mock('../../services/dataService', () => ({
  getAdminSupplyDemand: vi.fn(),
}));

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
  LabelList: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('SupplyDemandAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSupplyDemand.mockResolvedValue({
      pangasinan: {
        year: 2026,
        demand_volume: 50000,
        local_production: 15807.95,
      },
      benchmarks: {},
      sector_demand_by_scope: { national: [], provincial: [] },
    });
  });

  it('shows salt still needed to meet demand instead of a sufficiency or shortage label', async () => {
    render(
      <MemoryRouter>
        <SupplyDemandAnalytics />
      </MemoryRouter>,
    );

    const shortfallKpi = await screen.findByRole('group', {
      name: /Salt Needed to Meet Demand: 34,192\.05 Metric Tons \(MT\)/,
    });

    expect(shortfallKpi).toHaveTextContent('Still needed to meet the Pangasinan demand target');
    expect(screen.queryByText('Sufficiency')).not.toBeInTheDocument();
    expect(shortfallKpi).not.toHaveTextContent(/shortage/i);
    await waitFor(() => expect(getAdminSupplyDemand).toHaveBeenCalledOnce());
  });
});
