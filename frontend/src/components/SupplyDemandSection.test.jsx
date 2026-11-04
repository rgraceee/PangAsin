import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SupplyDemandSection from './SupplyDemandSection';
import {
  invalidateDashboardCache,
  loadPublicDashboardData,
} from '../services/dataService';

const publicDashboard = {
  supplyDemand: {
    philippines: {
      demand: 1000,
      domesticSupply: 300,
      imports: 400,
      year: 2025,
    },
    pangasinan: {
      localSupply: 125,
      demandBenchmark: 500,
      year: 2025,
    },
    sectorDemandByScope: {
      national: [
        { id: 1, name: 'Household', percentage: 40, demand_mt: 400, supply_mt: 280, production_mt: 120 },
        { id: 2, name: 'Others', percentage: 60, demand_mt: 600, supply_mt: 420, production_mt: 180 },
      ],
      provincial: [
        { id: 3, name: 'Household', percentage: 40, demand_mt: 200, supply_mt: 50, production_mt: 50 },
        { id: 4, name: 'Others', percentage: 60, demand_mt: 300, supply_mt: 75, production_mt: 75 },
      ],
    },
  },
};

describe('public supply and demand section', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateDashboardCache();
  });

  it('renders sector allocations for both public scope choices', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => publicDashboard,
    }));
    await loadPublicDashboardData();

    render(<SupplyDemandSection />);

    expect(await screen.findByRole('img', {
      name: /Others: 600 Metric Tons \(MT\), 60\.0%; Household: 400 Metric Tons \(MT\), 40\.0%/,
    })).toBeInTheDocument();
    expect(screen.queryByText(/No sector allocations have been configured/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pangasinan' }));

    await waitFor(() => {
      expect(screen.getByRole('img', {
        name: /Others: 300 Metric Tons \(MT\), 60\.0%; Household: 200 Metric Tons \(MT\), 40\.0%/,
      })).toBeInTheDocument();
    });
    expect(screen.getAllByText(/current Pangasinan demand target/).length).toBeGreaterThan(0);
  });
});
