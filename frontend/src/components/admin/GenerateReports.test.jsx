import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../Toast';
import GenerateReports from './GenerateReports';
import {
  createReport,
  getAdminMonths,
  getAdminMunicipalities,
  getAdminStats,
  getEncoderReportOptions,
  getReportFilterSuggestions,
  getReports,
  previewReport,
} from '../../services/dataService';

vi.mock('../../services/dataService', () => ({
  createReport: vi.fn(),
  deleteReport: vi.fn(),
  getReport: vi.fn(),
  getAdminMonths: vi.fn(),
  getAdminMunicipalities: vi.fn(),
  getAdminStats: vi.fn(),
  getEncoderReportOptions: vi.fn(),
  getReportDownloadUrl: vi.fn((id, format) => `/api/admin/reports/${id}/download?format=${format}`),
  getReportFilterSuggestions: vi.fn(),
  getReports: vi.fn(),
  previewReport: vi.fn(),
}));

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Pie: () => null,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const reportData = {
  report_title: 'Production Report',
  total_production_mt: 20,
  by_municipality: [
    { municipality: 'Bolinao', production_mt: 12, record_count: 2, total_salt_beds: 4 },
    { municipality: 'Dagupan', production_mt: 8, record_count: 1, total_salt_beds: 3 },
  ],
  monthly_trend: [
    { month: '2026-01', production_mt: 12 },
    { month: '2026-02', production_mt: 8 },
  ],
};

function renderPage({ encoder = false } = {}) {
  return render(
    <ToastProvider>
      <GenerateReports
        encoderMode={encoder}
        user={encoder ? { municipality_id: 1, municipality_name: 'Bolinao' } : null}
      />
    </ToastProvider>,
  );
}

describe('Generate Reports chart builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
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
    getEncoderReportOptions.mockResolvedValue({
      municipality: { id: 1, name: 'Bolinao' },
      barangays: [{ id: 10, name: 'Poblacion' }],
      months: ['2026-01', '2025-12'],
    });
    getReports.mockResolvedValue({ reports: [] });
    getReportFilterSuggestions.mockResolvedValue({ suggestions: ['Ana', 'Anabel'] });
    previewReport.mockResolvedValue({ data: reportData });
    createReport.mockResolvedValue({
      report: {
        id: 4,
        report_type: 'production',
        title: 'Production Report',
        format: 'pdf',
        status: 'generated',
        created_at: '2026-02-01T10:00:00Z',
      },
      data: reportData,
    });
  });

  afterEach(() => {
    delete globalThis.Element.prototype.scrollIntoView;
  });

  it('lets admins choose a chart type and graph multiple numeric columns', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Generate Reports' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Build chart' }));
    expect(await screen.findByRole('heading', { name: 'Report Preview' })).toBeInTheDocument();
    expect(previewReport).toHaveBeenCalledWith({
      report_type: 'production',
      date_range_start: null,
      date_range_end: null,
      filters: {},
    });

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'X axis' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Y axis' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Line' }));
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pie' }));
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Save chart as PDF' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Generated Reports' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview report' })).toBeInTheDocument();
    expect(screen.queryByText('Word')).not.toBeInTheDocument();
  });

  it('saves reports in PDF or Excel and keeps both downloads in report history', async () => {
    const savedReport = {
      id: 8,
      report_type: 'production',
      title: 'Production Report',
      format: 'excel',
      status: 'generated',
      created_at: '2026-02-01T10:00:00Z',
      municipality_name: 'Bolinao',
    };
    getReports
      .mockResolvedValueOnce({ reports: [] })
      .mockResolvedValueOnce({ reports: [savedReport] });
    createReport.mockResolvedValueOnce({ report: savedReport, data: reportData });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Excel', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview report' }));
    expect(await screen.findByRole('button', { name: 'Save report' })).toBeInTheDocument();
    expect(createReport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith({
        report_type: 'production',
        date_range_start: null,
        date_range_end: null,
        filters: {},
        format: 'excel',
        title: 'Production Report',
      });
    });
    expect(await screen.findByRole('link', { name: /Download PDF/ })).toHaveAttribute(
      'href',
      '/api/admin/reports/8/download?format=pdf',
    );
    expect(screen.getByRole('link', { name: /Download Excel/ })).toHaveAttribute(
      'href',
      '/api/admin/reports/8/download?format=excel',
    );
    expect(screen.queryByRole('button', { name: /Word/ })).not.toBeInTheDocument();
  });

  it('opens the chart preview without saving a table report for Graph PDF output', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Graph (PDF)', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview report' }));

    expect(await screen.findByRole('heading', { name: 'Report Preview' })).toBeInTheDocument();
    expect(previewReport).toHaveBeenCalledWith({
      report_type: 'production',
      date_range_start: null,
      date_range_end: null,
      filters: {},
    });
    expect(createReport).not.toHaveBeenCalled();
    expect(printSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save graph PDF' }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledOnce(), { timeout: 1500 });
    printSpy.mockRestore();
  });

  it('keeps older Word-format records readable without offering Word exports', async () => {
    getReports.mockResolvedValueOnce({
      reports: [{
        id: 9,
        report_type: 'production',
        title: 'Archived Production Report',
        format: 'docx',
        status: 'generated',
        created_at: '2025-01-01T10:00:00Z',
      }],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'View Reports' }));

    expect(await screen.findByText('Legacy')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Word/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download Excel/ })).toBeInTheDocument();
  });

  it('keeps encoder charts scoped to the assigned municipality and barangay', async () => {
    renderPage({ encoder: true });

    expect(await screen.findByLabelText('Municipality')).toHaveValue('Bolinao');
    expect(screen.queryByRole('option', { name: 'Province-wide' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'barangay' } });
    fireEvent.change(await screen.findByLabelText('Barangay'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build chart' }));

    await waitFor(() => {
      expect(previewReport).toHaveBeenCalledWith(expect.objectContaining({
        report_type: 'production',
        municipality_id: 1,
        barangay_id: 10,
      }));
    });
  });

  it('preserves searchable content filters for report data', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Content'), { target: { value: 'producers' } });
    fireEvent.click(screen.getByText('More filters'));
    fireEvent.click(screen.getByText('Profile details'));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'An' } });

    await waitFor(() => {
      expect(getReportFilterSuggestions).toHaveBeenCalledWith(expect.objectContaining({
        report_type: 'producers',
        field: 'first_name',
        q: 'An',
      }));
      expect(screen.getByRole('option', { name: 'Ana' })).toBeVisible();
    });
  });

  it('does not enable PDF output when filters return no data', async () => {
    previewReport.mockResolvedValueOnce({ data: { report_title: 'Empty production report', by_municipality: [] } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Build chart' }));
    expect(await screen.findByText('No matching records found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save chart as PDF' })).not.toBeInTheDocument();
  });
});
