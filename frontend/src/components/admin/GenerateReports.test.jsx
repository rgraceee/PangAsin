import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../Toast';
import GenerateReports from './GenerateReports';
import {
  createReport,
  deleteReport,
  getAdminMonths,
  getAdminMunicipalities,
  getAdminStats,
  getReport,
  getReportDownloadUrl,
  getReports,
} from '../../services/dataService';

vi.mock('../../services/dataService', () => ({
  createReport: vi.fn(),
  deleteReport: vi.fn(),
  getAdminMonths: vi.fn(),
  getAdminMunicipalities: vi.fn(),
  getAdminStats: vi.fn(),
  getReport: vi.fn(),
  getReportDownloadUrl: vi.fn(),
  getReports: vi.fn(),
}));

vi.mock('../../services/feedback', () => ({
  confirmDelete: vi.fn(async ({ onConfirm }) => onConfirm()),
}));

const generatedReport = {
  id: 7,
  report_type: 'production',
  format: 'excel',
  status: 'generated',
  municipality_id: null,
  municipality_name: null,
  barangay_id: null,
  barangay_name: null,
  date_range_start: '2026-01-01',
  date_range_end: '2026-12-31',
  requester_name: 'Admin',
  created_at: '2026-11-05T05:00:00Z',
};

const generatedData = {
  report_title: 'Production Report',
  total_production_mt: 125,
  monthly_trend: [{ month: '2026-01', production_mt: 125 }],
  outlook: [{ municipality: 'Bolinao', readiness: 'Sufficient' }],
  pangasinan: { year: 2026, demand_volume_mt: 500, local_production_mt: 125 },
  philippines: { year: 2026, demand_volume_mt: 1000 },
  sector_demand_by_scope: {
    national: [{ id: 1, name: 'Household', percentage: 40, demand_mt: 400 }],
    provincial: [{ id: 2, name: 'Household', percentage: 40, demand_mt: 200 }],
  },
};

function renderPage() {
  return render(
    <ToastProvider>
      <GenerateReports />
    </ToastProvider>,
  );
}

describe('admin Generate Reports', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    vi.clearAllMocks();
    getAdminMunicipalities.mockResolvedValue({
      municipalities: [{ id: 1, name: 'Bolinao' }],
    });
    getAdminStats.mockResolvedValue({
      by_municipality: [{
        municipality_id: 1,
        by_barangay: [{ barangay_id: 10, barangay: 'Poblacion' }],
      }],
    });
    getAdminMonths.mockResolvedValue({ months: ['2026-01', '2025-12'] });
    getReports.mockResolvedValue({ reports: [] });
    createReport.mockResolvedValue({ report: generatedReport, data: generatedData });
    getReport.mockResolvedValue({ report: generatedReport, data: generatedData });
    getReportDownloadUrl.mockImplementation((id, format) => `/api/admin/reports/${id}/download?format=${format}`);
    deleteReport.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    delete globalThis.Element.prototype.scrollIntoView;
  });

  it('supports all report filters and generates a preview with PDF, Word, and Excel downloads', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Generate Reports' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'barangay' } });
    fireEvent.change(screen.getByLabelText('Municipality'), { target: { value: '1' } });
    expect(await screen.findByRole('option', { name: 'Poblacion' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: 'year' } });
    expect(screen.getByLabelText('Year')).toHaveValue('2026');

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByRole('heading', { name: 'Report Preview' })).toBeInTheDocument();
    expect(createReport).toHaveBeenCalledWith({
      report_type: 'production',
      format: 'excel',
      date_range_start: '2026-01-01',
      date_range_end: '2026-12-31',
      barangay_id: 10,
    });
    expect(screen.getByRole('link', { name: 'Download Excel (.xlsx) file' })).toHaveAttribute(
      'href',
      '/api/admin/reports/7/download?format=excel',
    );
    expect(screen.getByRole('link', { name: 'Download PDF file' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download Word (.docx) file' })).toBeInTheDocument();
    expect(screen.getByText('Municipality Outlook')).toBeInTheDocument();
    expect(screen.getByText('Sector Demand Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Pangasinan demand:/)).toBeInTheDocument();
  });

  it('searches every report column and filters report history, including Excel downloads', async () => {
    getReports.mockResolvedValue({
      reports: [
        generatedReport,
        {
          ...generatedReport,
          id: 8,
          report_type: 'environment',
          format: 'pdf',
          status: 'failed',
          municipality_name: 'Bolinao',
          municipality_id: 1,
          requester_name: 'Encoder User',
          date_range_start: null,
          date_range_end: null,
          created_at: '2026-10-04T05:00:00Z',
        },
      ],
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'View Reports' }));
    expect(await screen.findByText('2 of 2 reports')).toBeInTheDocument();

    const search = screen.getByLabelText('Search reports');
    for (const [term, reportName] of [
      ['Environment', 'Environment'],
      ['Bolinao', 'Environment'],
      ['All records', 'Environment'],
      ['PDF', 'Environment'],
      ['Encoder User', 'Environment'],
      ['failed', 'Environment'],
      ['October', 'Environment'],
      ['Oct', 'Environment'],
      ['November', 'Production'],
      ['Nov', 'Production'],
    ]) {
      fireEvent.change(search, { target: { value: term } });
      await waitFor(() => expect(screen.getByText('1 of 2 reports')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: reportName })).toBeInTheDocument();
    }

    fireEvent.change(search, { target: { value: '2026-12-31' } });
    await waitFor(() => expect(screen.getByText('1 of 2 reports')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Production' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by format'), { target: { value: 'excel' } });
    fireEvent.change(search, { target: { value: 'excel' } });

    await waitFor(() => expect(screen.getByText('1 of 2 reports')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Download Excel for Production report' })).toHaveAttribute(
      'href',
      '/api/admin/reports/7/download?format=excel',
    );
    expect(screen.queryByRole('link', { name: 'Download PDF for Environment report' })).not.toBeInTheDocument();
  });

  it('surfaces failures loading report history and allows retrying', async () => {
    getReports.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ reports: [] });
    renderPage();

    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText('Network unavailable')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View Reports' }));
    await waitFor(() => expect(screen.getByText('No reports yet')).toBeInTheDocument());
    expect(getReports).toHaveBeenCalledTimes(2);
  });
});
