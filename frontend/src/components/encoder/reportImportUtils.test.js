import { describe, expect, it } from 'vitest';
import { prepareProductionRows } from './reportImportUtils';

describe('prepareProductionRows', () => {
  const barangays = [{ id: 7, name: 'Poblacion' }];
  const baseRow = {
    _row_number: 2,
    barangay: 'Poblacion',
    record_date: '2026-11-06',
    production_volume_mt: '12',
    num_salt_beds: '4',
    area_per_salt_bed: '100',
    production_method: 'solar',
  };

  it('includes producer counts and defaults omitted counts to zero for older templates', () => {
    const result = prepareProductionRows([baseRow], barangays, 2000);

    expect(result.errors).toEqual([]);
    expect(result.prepared[0]).toMatchObject({
      barangay_id: 7,
      male_producers: 0,
      female_producers: 0,
      producers_18_30: 0,
      producers_31_40: 0,
      producers_41_50: 0,
      producers_51_60: 0,
      producers_61_plus: 0,
    });
  });

  it('rejects invalid producer counts', () => {
    const result = prepareProductionRows(
      [{ ...baseRow, male_producers: '1.5' }],
      barangays,
      2000,
    );

    expect(result.errors).toContain('Row 2: male_producers must be a non-negative whole number.');
  });

  it('rejects age-bracket worker totals above registered workers', () => {
    const result = prepareProductionRows([{
      ...baseRow,
      male_producers: '1',
      female_producers: '1',
      producers_18_30: '1',
      producers_31_40: '1',
      producers_41_50: '1',
    }], barangays, 2000);

    expect(result.errors).toContain(
      'Row 2: age-bracket worker counts (3) cannot exceed registered workers (2).',
    );
  });

  it('accepts worker-named columns in the updated CSV template', () => {
    const result = prepareProductionRows([{
      ...baseRow,
      male_workers: '2',
      female_workers: '1',
      workers_18_30: '1',
      workers_31_40: '1',
    }], barangays, 2000);

    expect(result.errors).toEqual([]);
    expect(result.prepared[0]).toMatchObject({
      male_producers: 2,
      female_producers: 1,
      producers_18_30: 1,
      producers_31_40: 1,
    });
  });
});
