import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../Toast';
import {
  getAdminSupplyDemand,
  updateAdminSectorDemandSettings,
} from '../../services/dataService';
import DemandBenchmarkSettings from './DemandBenchmarkSettings';

vi.mock('../../services/dataService', () => ({
  getAdminSupplyDemand: vi.fn(),
  updateAdminDemandBenchmark: vi.fn(),
  updateAdminSectorDemandSettings: vi.fn(),
}));

describe('DemandBenchmarkSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSupplyDemand.mockResolvedValue({
      available_years: [2025, 2024],
      local_supply_by_year: { 2025: 125.5, 2024: 90 },
      philippines: {
        demand_volume: 600000,
        local_production: 100000,
        import_volume: 400000,
      },
      sector_settings_by_scope: {
        national: [
          { id: 1, name: 'Household', percentage: 40 },
          { id: 2, name: 'Food Processing', percentage: 26.33 },
          { id: 3, name: 'Industry', percentage: 17.55 },
          { id: 4, name: 'Agriculture', percentage: 9.3 },
          { id: 5, name: 'Others', percentage: 6.82 },
        ],
        provincial: [
          { id: 6, name: 'Household', percentage: 40 },
          { id: 7, name: 'Food Processing', percentage: 0 },
          { id: 8, name: 'Industry', percentage: 0 },
          { id: 9, name: 'Agriculture', percentage: 0 },
          { id: 10, name: 'Others', percentage: 60 },
        ],
      },
      benchmarks_by_year: {
        provincial: [{
          year: 2025,
          demand_volume: 400,
          local_production: 125.5,
          source_name: 'Local source',
        }],
        national: [{
          year: 2024,
          demand_volume: 900,
          local_production: 300,
          import_volume: 600,
          source_name: 'National source',
        }],
      },
      pangasinan: { year: 2025 },
    });
  });

  it('uses a year dropdown and displays production-derived Pangasinan supply without an imports field', async () => {
    render(
      <ToastProvider>
        <DemandBenchmarkSettings />
      </ToastProvider>,
    );

    const yearSelect = await screen.findByLabelText('Year', { selector: '#provincial-benchmark-year' });
    const localSupply = screen.getByLabelText('Local supply (Pangasinan) (Metric Tons (MT))');

    expect(yearSelect.tagName).toBe('SELECT');
    expect(localSupply).toHaveValue(125.5);
    expect(localSupply).toHaveProperty('readOnly', true);
    expect(screen.queryByLabelText(/imports/i)).not.toBeInTheDocument();

    fireEvent.change(yearSelect, { target: { value: '2024' } });

    await waitFor(() => expect(localSupply).toHaveValue(90));
    expect(screen.getByLabelText('Domestic supply (Philippines) (Metric Tons (MT))')).toHaveValue(300);
  });

  it('shows all sectors and saves multiple edits and a removal together', async () => {
    updateAdminSectorDemandSettings.mockImplementation(async ({ sectors }) => ({
      sectors: [
        ...sectors,
        { name: 'Others', percentage: 20 },
      ],
    }));
    render(
      <ToastProvider>
        <DemandBenchmarkSettings />
      </ToastProvider>,
    );

    await screen.findByText('Sector Demand Breakdown Settings');
    expect(screen.getByLabelText('Sector 1 name')).toHaveValue('Household');
    expect(screen.getByLabelText('Food Processing percentage')).toHaveValue(26.33);
    expect(screen.getByLabelText('Others percentage')).toHaveValue(6.82);
    expect(screen.getByLabelText('Others percentage')).toHaveProperty('readOnly', true);

    fireEvent.change(screen.getByLabelText('Household percentage'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Food Processing percentage'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Industry percentage'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Agriculture percentage'), { target: { value: '10' } });
    expect(screen.getByLabelText('Others percentage')).toHaveValue(10);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Industry' }));
    expect(screen.getByLabelText('Others percentage')).toHaveValue(20);

    fireEvent.click(screen.getByRole('button', { name: 'Save Philippines sectors' }));

    await waitFor(() => {
      expect(updateAdminSectorDemandSettings).toHaveBeenCalledWith({
        geographic_scope: 'national',
        sectors: [
          { name: 'Household', percentage: 40 },
          { name: 'Food Processing', percentage: 30 },
          { name: 'Agriculture', percentage: 10 },
        ],
      });
    });
    expect(getAdminSupplyDemand).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('sector allocations saved');
  });

  it('explains when a save fails because the admin session expired', async () => {
    updateAdminSectorDemandSettings.mockRejectedValue(
      Object.assign(new Error('Request failed'), { status: 401 }),
    );
    render(
      <ToastProvider>
        <DemandBenchmarkSettings />
      </ToastProvider>,
    );

    await screen.findByText('Sector Demand Breakdown Settings');
    fireEvent.click(screen.getByRole('button', { name: 'Save Philippines sectors' }));

    expect(await screen.findByText(
      'Your admin session has expired. Sign in again to save sector settings.',
    )).toBeInTheDocument();
  });

  it('shows the full sector list for Pangasinan and allows adding a custom sector', async () => {
    render(
      <ToastProvider>
        <DemandBenchmarkSettings />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Pangasinan' }));
    expect(screen.getByLabelText('Household percentage')).toHaveValue(40);
    expect(screen.getByLabelText('Others percentage')).toHaveValue(60);

    fireEvent.change(screen.getByLabelText('New sector'), { target: { value: 'Salt Trading' } });
    fireEvent.change(screen.getByLabelText('Share (%)'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sector' }));

    expect(screen.getByLabelText('Salt Trading percentage')).toHaveValue(25);
    expect(screen.getByLabelText('Others percentage')).toHaveValue(35);
    expect(screen.getByRole('button', { name: 'Remove Salt Trading' })).toBeInTheDocument();
  });
});
