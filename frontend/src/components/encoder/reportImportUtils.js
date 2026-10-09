export function findBarangay(row, barangays) {
  if (row.barangay_id !== undefined && row.barangay_id !== '') {
    return barangays.find((item) => String(item.id) === String(row.barangay_id));
  }
  const name = String(row.barangay || '').trim().toLocaleLowerCase();
  return barangays.find((item) => item.name.trim().toLocaleLowerCase() === name);
}

export function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = String(value ?? '').trim().replace(/,/g, '');
  return normalized === '' ? NaN : Number(normalized);
}

export function rowError(row, message) {
  return `Row ${row._row_number}: ${message}`;
}

export function cleanSpreadsheetDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value ?? '').trim().slice(0, 10);
}

export const PRODUCTION_METHOD_VALUES = ['solar', 'cooked', 'hybrid'];

// WHAT: Isang beses lang dito gawin ang row validation para pareho ang
//       preview at actual import (single source of truth).
// WHY: Maaaring mag-iba ang resulta kung sa bawat component paulit-ulit
//      isusulat ang checks; dito nakabatay ang soft warning at hard cap.
export function prepareProductionRows(rows, barangays, volumeCapMt) {
  const errors = [];
  const warnings = [];
  const prepared = rows.map((row) => {
    const barangay = findBarangay(row, barangays);
    const recordDate = cleanSpreadsheetDate(row.record_date);
    const productionVolumeMt = numberValue(row.production_volume_mt);
    const numSaltBeds = numberValue(row.num_salt_beds);
    const areaPerSaltBed = row.area_per_salt_bed === '' ? null : numberValue(row.area_per_salt_bed);
    const productionMethod = String(row.production_method || '').trim().toLowerCase();
    if (!barangay) errors.push(rowError(row, 'barangay must match a barangay in your municipality.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) errors.push(rowError(row, 'record_date must use YYYY-MM-DD.'));
    if (!Number.isFinite(productionVolumeMt) || productionVolumeMt < 0) errors.push(rowError(row, 'production_volume_mt must be zero or greater.'));
    else if (productionVolumeMt > volumeCapMt) errors.push(rowError(row, `production_volume_mt cannot exceed ${volumeCapMt} metric tons per month.`));
    const histMaxMt = Number(barangay?.historical_max_volume_mt) || 0;
    if (histMaxMt > 0 && Number.isFinite(productionVolumeMt) && productionVolumeMt > histMaxMt * 3) {
      warnings.push(rowError(row, `volume is more than 3x the highest recorded month (${histMaxMt} MT) for ${barangay?.name}.`));
    }
    if (!Number.isInteger(numSaltBeds) || numSaltBeds <= 0) errors.push(rowError(row, 'num_salt_beds must be a positive whole number.'));
    if (areaPerSaltBed !== null && (!Number.isFinite(areaPerSaltBed) || areaPerSaltBed < 0)) errors.push(rowError(row, 'area_per_salt_bed must be zero or greater.'));
    if (!PRODUCTION_METHOD_VALUES.includes(productionMethod)) errors.push(rowError(row, 'production_method must be solar, cooked, or hybrid.'));
    return {
      barangay_id: barangay?.id,
      record_date: recordDate,
      production_volume_mt: productionVolumeMt,
      num_salt_beds: numSaltBeds,
      area_per_salt_bed: areaPerSaltBed,
      production_method: productionMethod,
      rowNumber: row._row_number,
    };
  });
  return { errors, warnings, prepared };
}