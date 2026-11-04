import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MuniDetailsTable from './MuniDetailsTable';
import { buildBarangayTableRows } from './municipalityData';

describe('barangay details', () => {
  it('combines production rows with registered farmers, including registry-only barangays', () => {
    const rows = buildBarangayTableRows(
      [{
        id: 1,
        name: 'Poblacion',
        volumeMT: 25,
        beds: 10,
        area: 20,
        records: 2,
        producers: 7,
      }],
      [
        { id: 1, name: 'Poblacion', producers: 3 },
        { id: 2, name: 'Luciente 1st', producers: 1 },
      ],
    );

    expect(rows).toEqual([
      {
        id: 1,
        name: 'Poblacion',
        volumeMT: 25,
        beds: 10,
        area: 20,
        records: 2,
        producers: 3,
      },
      {
        id: 2,
        name: 'Luciente 1st',
        volumeMT: 0,
        beds: 0,
        area: 0,
        records: 0,
        producers: 1,
      },
    ]);
  });

  it('uses barangay-specific table headings when a municipality is selected', () => {
    render(
      <MuniDetailsTable
        rows={[{
          id: 1,
          name: 'Poblacion',
          volumeMT: 25,
          beds: 10,
          area: 20,
          records: 2,
          producers: 3,
        }]}
        scopeLabel="Bolinao"
        entityLabel="barangay"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Barangay Details' })).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Barangay/ })).toBeTruthy();
    expect(within(table).getByRole('row', { name: /Poblacion/ })).toBeTruthy();
    expect(screen.getByText('Approved production metrics by barangay; distinct farmer counts from the master list')).toBeTruthy();
  });
});
