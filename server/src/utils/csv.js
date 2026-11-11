import { parse } from 'csv-parse/sync';
import { parsePackage, HttpError } from './validation.js';

export const CSV_HEADERS = [
  'id',
  'label',
  'length',
  'width',
  'height',
  'weight',
  'stop',
  'fragile',
  'noStack',
  'baseRotationAllowed',
  'maxStackingLoadKg',
];

export function importCsv(buffer) {
  let records;
  try {
    records = parse(buffer, {
      columns: (headers) => {
        if (new Set(headers).size !== headers.length)
          throw new Error('Column names must be unique.');
        return headers;
      },
      bom: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 10000,
    });
  } catch (error) {
    throw new HttpError(`Malformed CSV: ${error.message}`, 422);
  }
  if (!records.length)
    throw new HttpError('CSV contains no package rows.', 422);
  if (records.length > 100)
    throw new HttpError('Import is limited to 100 packages per plan.', 422);
  const headers = Object.keys(records[0]);
  const missing = CSV_HEADERS.slice(0, 7).filter(
    (key) => !headers.includes(key),
  );
  if (missing.length)
    throw new HttpError(`Missing CSV columns: ${missing.join(', ')}.`, 422);
  const packages = [];
  const errors = [];
  const ids = new Set();
  records.forEach((record, index) => {
    try {
      const pkg = parsePackage(record, index);
      if (ids.has(pkg.id))
        throw new HttpError('Duplicate package ID.', 422, [
          `${pkg.id} appears more than once.`,
        ]);
      ids.add(pkg.id);
      packages.push(pkg);
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error.message,
        details: error.details ?? [],
      });
    }
  });
  return { packages, errors, totalRows: records.length };
}

const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function exportPlacements(result) {
  const headers = [
    'id',
    'label',
    'stop',
    'status',
    'x',
    'y',
    'z',
    'length',
    'width',
    'height',
    'rotation',
    'weight',
    'reason',
  ];
  const rows = [
    ...result.placed.map((p) => ({ ...p, status: 'placed' })),
    ...result.unplaced.map((p) => ({ ...p, status: 'unplaced' })),
  ];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => cell(row[h])).join(',')),
  ].join('\r\n');
}
