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