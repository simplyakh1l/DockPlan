export class HttpError extends Error {
  constructor(message, status = 400, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function positive(value, label, errors) {
  const number = Number(value);
  if (
    value === '' ||
    value == null ||
    typeof value === 'boolean' ||
    !Number.isFinite(number) ||
    number <= 0
  )
    errors.push(`${label} must be a positive number.`);
  return number;
}

function boolean(value, label, errors, fallback = false) {
  if (value == null || value === '') return fallback;
  if ([true, 'true', 'TRUE', '1', 1].includes(value)) return true;
  if ([false, 'false', 'FALSE', '0', 0].includes(value)) return false;
  errors.push(`${label} must be true or false.`);
  return false;
}

export function parseVehicle(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new HttpError('Vehicle must be an object.', 422);
  const errors = [];
  const name = String(data.name ?? '').trim();
  if (!name || name.length > 100)
    errors.push('Vehicle name is required (maximum 100 characters).');
  const result = { name };
  for (const key of [
    'length',
    'width',
    'height',
    'maxPayloadKg',
    'rearDoorWidth',
    'rearDoorHeight',
  ])
    result[key] = positive(data[key], key, errors);
  if (
    result.rearDoorWidth > result.width ||
    result.rearDoorHeight > result.height
  )
    errors.push('Door dimensions cannot exceed the vehicle interior.');
  if (
    !Number.isFinite(result.length * result.width * result.height) ||
    result.length * result.width * result.height <= 0
  )
    errors.push('Vehicle volume is outside the supported numeric range.');
  if (errors.length)
    throw new HttpError('Vehicle validation failed.', 422, errors);
  return result;
}

export function parsePackage(data = {}, index = 0) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new HttpError(`Package ${index + 1} must be an object.`, 422);
  const errors = [];
  const id = String(data.id ?? '').trim();
  const label = String(data.label ?? '').trim();
  if (!id || id.length > 60)
    errors.push('ID is required (maximum 60 characters).');
  if (!label || label.length > 100)
    errors.push('Label is required (maximum 100 characters).');
  const result = { id, label };
  for (const key of ['length', 'width', 'height', 'weight', 'stop'])
    result[key] = positive(data[key], key, errors);
  if (!Number.isInteger(result.stop))
    errors.push('Stop must be a whole number.');
  if (
    !Number.isFinite(result.length * result.width * result.height) ||
    result.length * result.width * result.height <= 0
  )
    errors.push('Package volume is outside the supported numeric range.');
  result.fragile = boolean(data.fragile, 'Fragile', errors);
  result.noStack = boolean(data.noStack, 'No stack', errors);
  result.baseRotationAllowed = boolean(
    data.baseRotationAllowed,
    'Base rotation',
    errors,
    true,
  );
  result.maxStackingLoadKg =
    data.maxStackingLoadKg === '' || data.maxStackingLoadKg == null
      ? null
      : Number(data.maxStackingLoadKg);
  if (
    result.maxStackingLoadKg != null &&
    (!Number.isFinite(result.maxStackingLoadKg) || result.maxStackingLoadKg < 0)
  )
    errors.push('Maximum stacking load must be zero or greater.');
  if (errors.length)
    throw new HttpError(
      `Package ${index + 1} (${label || id || 'untitled'}) is invalid.`,
      422,
      errors,
    );
  return result;
}

export function parsePlan(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new HttpError('Load plan must be an object.', 422);
  const vehicle = parseVehicle(data.vehicle);
  if (!Array.isArray(data.packages) || data.packages.length > 100)
    throw new HttpError('Provide up to 100 packages.', 422);
  const packages = data.packages.map(parsePackage);
  if (new Set(packages.map((p) => p.id)).size !== packages.length)
    throw new HttpError('Package IDs must be unique.', 422);
  const name = String(data.name ?? 'Untitled load plan').trim();
  if (!name || name.length > 100)
    throw new HttpError('Plan name is required (maximum 100 characters).', 422);
  return { name, vehicle, packages };
}
