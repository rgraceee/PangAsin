import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';
import ProducerMasterList from './ProducerMasterList';
import { getProducers } from '../services/dataService';

vi.mock('../services/dataService', () => ({
  createProducer: vi.fn(),
  deleteProducer: vi.fn(),
  getEncoderProducerReports: vi.fn(),
  getProducers: vi.fn(),
  updateProducer: vi.fn(),
}));

vi.mock('../hooks/useMunicipalityDirectory', () => ({
  default: () => ({ activeNames: ['Bolinao'] }),
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
    getProducers.mockResolvedValue({
      producers: [],
      statistics: { total: 0, male: 0, female: 0, other: 0, average_age: null, by_barangay: [] },
      municipalities: [{ id: 1, name: 'Bolinao' }],
      barangays: [],
      total: 0,
      pages: 0,
    });
  });

  it('uses one search field and filters administrators by sex', async () => {
    renderMasterList();

    expect(await screen.findByRole('heading', { name: 'Salt Farmer Master List' })).toBeInTheDocument();
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Search$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Other' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'Female' } });
    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        sex: 'Female',
        page: 1,
      }));
    });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Juan' } });
    await waitFor(() => {
      expect(getProducers).toHaveBeenLastCalledWith(expect.objectContaining({
        q: 'Juan',
        sex: 'Female',
        page: 1,
      }));
    });
  });
});
