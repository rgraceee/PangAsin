import { describe, expect, it } from 'vitest';
import { buildProjectionTimeline } from './targetData';
import { buildProjectionSummary } from './targetSummaryData';

describe('target projection timeline', () => {
  it('starts with approved supply and accumulates the entire forecast horizon across years', () => {
    const rows = buildProjectionTimeline({
      lastRecordMonth: '2026-11',
      ytdTotal: 400,
      forecastLabels: ['2026-12', '2027-01', '2027-02'],
      monthlyForecasts: [100, 150, 200],
      forecastLower: [80, 120, 160],
      forecastUpper: [120, 180, 240],
      annualTarget: 1000,
    });

    expect(rows.map((row) => row.label)).toEqual([
      'Current supply (Jan-Nov 2026)',
      'Dec 2026',
      'Jan 2027',
      'Feb 2027',
    ]);
    expect(rows.map((row) => row.cumTotal)).toEqual([400, 500, 650, 850]);
    expect(rows.map((row) => row.cumTarget)).toEqual([1000, 1000, 1000, 1000]);
    expect(rows.at(-1).cumLower).toBe(760);
    expect(rows.at(-1).cumUpper).toBe(940);
  });

  it('compares current supply plus forecasts with the full demand target', () => {
    const rows = buildProjectionTimeline({
      lastRecordMonth: '2026-11',
      ytdTotal: 400,
      forecastLabels: ['2026-12', '2027-01'],
      monthlyForecasts: [300, 400],
      forecastLower: [250, 350],
      forecastUpper: [350, 450],
      annualTarget: 1000,
    });
    const summary = buildProjectionSummary({ rows, annualTarget: 1000 });

    expect(summary.recordedTotal).toBe(400);
    expect(summary.forecastTotal).toBe(700);
    expect(summary.projected).toBe(1100);
    expect(summary.gap).toBe(100);
    expect(summary.pct).toBeCloseTo(110);
    expect(summary.rangeLow).toBe(1000);
    expect(summary.rangeHigh).toBe(1200);
    expect(summary.reachedMonth).toBe('Jan 2027');
  });

  it('does not invent forecast values for missing forecast points', () => {
    const rows = buildProjectionTimeline({
      lastRecordMonth: '2026-11',
      ytdTotal: 400,
      forecastLabels: ['2026-12', '2027-01'],
      monthlyForecasts: [null, 100],
      forecastLower: [null, null],
      forecastUpper: [null, null],
      annualTarget: 1000,
    });

    expect(rows).toHaveLength(2);
    expect(rows.at(-1).cumTotal).toBe(500);
    expect(rows.at(-1).cumLower).toBeNull();
    expect(rows.at(-1).cumUpper).toBeNull();
  });
});
