import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';
import ProducerMasterList from './ProducerMasterList';
import { createReport, getProducers } from '../services/dataService';
import { promptText } from '../services/feedback';

vi.mock('../services/dataService', () => ({
  createProducer: vi.fn(),
  createReport: vi.fn(),
  deleteProducer: vi.fn(),
  getEncoderProducerReports: vi.fn(),
  getProducers: vi.fn(),
  updateProducer: vi.fn(),
}));

vi.mock('../hooks/useMunicipalityDirectory', () => ({
  default: () => ({ activeNames: ['Bolinao'] }),
}));

vi.mock('../services/feedback', () => ({
  confirmDelete: vi.fn(),
  promptText: vi.fn(),
}));

const admin = { id: 1, role: 'admin', name: 'Test Admin' };

function renderMasterList() {
  return render(
    <MemoryRouter initialEntries={['/admin/master-list']}>
      <ToastProvider>
        <Routes>
          <Route element={<Outlet context={{ user: admin }} />}>
            <Route path="/admin/master-list" element={<ProducerMasterList user={admin} isAdmin />} />
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('admin salt farmer master list filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createReport).mockResolvedValue({});
    vi.mocked(promptText).mockResolvedValue('Custom Salt Farmer Report');
    getProducers.mockResolvedValue({
      producers: [],
      statistics: { total: 0, male: 0, female: 0, other: 0, average_age: null, by_barangay: [] },
      municipalities: [{ id: 1, name: 'Bolinao' }],
      barangays: [],
      filter_options: {
        salt_farm_owner: ['Sunrise Salt Farm'],
        designation: ['Owner'],
        business_classification: ['Individual Producer'],
        address: ['Poblacion Road'],
        production_method: ['solar', 'cooked', 'hybrid'],
      },
      total: 0,
      pages: 0,
    });
  });

  it('uses one search field and filters administrators by sex', async () => {
    renderMasterList();

    expect(await screen.findByRole('heading', { name: 'Salt Farmer Master List' })).toBeInTheDocument();
    expect(screen.getAllByRole('searchbox')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /^Search$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Other' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'Female' } });
    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        sex: 'Female',
        page: 1,
      }));
    });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'Juan' } });
    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        q: 'Juan',
        sex: 'Female',
        page: 1,
      }));
    });
  });

  it('sends each profile column and age range as server-side filters', async () => {
    renderMasterList();

    await screen.findByRole('heading', { name: 'Salt Farmer Master List' });
    fireEvent.change(screen.getByLabelText('Name of salt farm/owner'), { target: { value: 'Sunrise' } });
    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Maximum age'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Production method'), { target: { value: 'cooked' } });

    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        salt_farm_owner: 'Sunrise',
        min_age: '30',
        max_age: '60',
        production_method: 'cooked',
        page: 1,
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Name of salt farm/owner')).toHaveValue('');
      expect(screen.getByLabelText('Minimum age')).toHaveValue(null);
      expect(screen.getByLabelText('Production method')).toHaveValue('');
    });
  });

  it('updates dropdown suggestions when the municipality, barangay, and sex filters change', async () => {
    getProducers.mockImplementation((params) => Promise.resolve({
      producers: [],
      statistics: { total: 0, male: 0, female: 0, other: 0, average_age: null, by_barangay: [] },
      municipalities: [{ id: 1, name: 'Bolinao' }],
      barangays: [{ id: 4, name: 'Poblacion', municipality_id: 1, municipality: 'Bolinao' }],
      filter_options: {
        salt_farm_owner: params.sex === 'Female' ? ['Sunrise Farm'] : ['Moon Farm'],
        designation: params.sex === 'Female' ? ['Owner'] : ['Worker'],
        business_classification: ['Individual Producer'],
        address: ['Poblacion Road'],
      },
      total: 0,
      pages: 0,
    }));

    renderMasterList();

    await screen.findByRole('heading', { name: 'Salt Farmer Master List' });
    fireEvent.change(screen.getByLabelText('Municipality'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'Female' } });

    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        municipality_id: '1',
        barangay_id: '4',
        sex: 'Female',
      }));
      expect(document.querySelector('#master-filter-options-salt_farm_owner option[value="Sunrise Farm"]')).not.toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'Male' } });
    await waitFor(() => {
      expect(document.querySelector('#master-filter-options-salt_farm_owner option[value="Moon Farm"]')).not.toBeNull();
      expect(document.querySelector('#master-filter-options-salt_farm_owner option[value="Sunrise Farm"]')).toBeNull();
    });
  });

  it('renders the producer CSV profile columns in the master list', async () => {
    getProducers.mockResolvedValue({
      producers: [{
        id: 8,
        first_name: 'Ana',
        last_name: 'Santos',
        age: null,
        sex: null,
        municipality: 'Bolinao',
        barangay: 'Poblacion',
        salt_farm_owner: 'Sunrise Salt Farm',
        designation: 'Owner',
        business_classification: 'Individual Producer',
        contact_number: '09171234567',
        production_method: 'cooked',
      }],
      statistics: { total: 1, male: 0, female: 0, other: 0, average_age: null, by_barangay: [] },
      municipalities: [{ id: 1, name: 'Bolinao' }],
      barangays: [],
      total: 1,
      pages: 1,
    });

    renderMasterList();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Santos')).toBeInTheDocument();
    expect(screen.getByText('Sunrise Salt Farm')).toBeInTheDocument();
    expect(screen.getByText('Individual Producer')).toBeInTheDocument();
    expect(screen.getByText('09171234567')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Cooked' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'First Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Business Classification' })).toBeInTheDocument();
  });

  it('creates saved Excel and PDF reports using the current table filters', async () => {
    renderMasterList();

    await screen.findByRole('heading', { name: 'Salt Farmer Master List' });
    fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'Female' } });
    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Name of salt farm/owner'), { target: { value: 'Sunrise' } });
    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        sex: 'Female',
        min_age: '30',
        salt_farm_owner: 'Sunrise',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create report for Salt Farmers' }));
    fireEvent.click(screen.getByText('Excel (.xlsx)'));
    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith(expect.objectContaining({
        report_type: 'producers',
        title: 'Custom Salt Farmer Report',
        format: 'excel',
        filters: expect.objectContaining({
          sex: 'Female',
          min_age: '30',
          salt_farm_owner: 'Sunrise',
          view: 'farmers',
        }),
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create report for Salt Farmers by Barangay' }));
    fireEvent.click(screen.getAllByText('PDF (.pdf)')[1]);
    await waitFor(() => {
      expect(createReport).toHaveBeenLastCalledWith(expect.objectContaining({
        report_type: 'producers',
        title: 'Custom Salt Farmer Report',
        format: 'pdf',
        filters: expect.objectContaining({ view: 'by_barangay' }),
      }));
    });
  });

  it('does not create a Salt Farmer report when the title prompt is cancelled', async () => {
    promptText.mockResolvedValueOnce(null);
    renderMasterList();

    await screen.findByRole('heading', { name: 'Salt Farmer Master List' });
    fireEvent.click(screen.getByRole('button', { name: 'Create report for Salt Farmers' }));
    fireEvent.click(screen.getByText('Excel (.xlsx)'));

    await waitFor(() => {
      expect(promptText).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Name this report',
        inputValue: 'Salt Farmer Master List',
      }));
    });
    expect(createReport).not.toHaveBeenCalled();
  });
});
