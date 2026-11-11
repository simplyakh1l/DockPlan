export const defaultVehicle = {
  name: 'Sprinter · L3H2',
  length: 430,
  width: 178,
  height: 194,
  maxPayloadKg: 1250,
  rearDoorWidth: 156,
  rearDoorHeight: 184,
};
const cargo = [
  ['Oak dining table', 140, 80, 55, 64, 4, false, false],
  ['Lounge chair · A', 75, 75, 85, 22, 3, false, false],
  ['Lounge chair · B', 75, 75, 85, 22, 3, false, false],
  ['Ceramic collection', 65, 50, 55, 18, 1, true, true],
  ['Studio monitors', 60, 45, 45, 16, 1, true, false],
  ['Linen set · A', 60, 50, 40, 8, 2, false, false],
  ['Linen set · B', 60, 50, 40, 8, 2, false, false],
  ['Books & stationery', 50, 40, 35, 24, 2, false, false],
  ['Floor lamp', 95, 40, 45, 12, 3, true, true],
  ['Kitchen essentials', 65, 55, 50, 20, 2, false, false],
  ['Side table', 70, 60, 60, 26, 4, false, false],
  ['Art print archive', 85, 30, 70, 12, 1, true, true],
  ['Textile roll', 110, 40, 40, 14, 4, false, false],
  ['Storage crate · A', 60, 60, 55, 32, 3, false, false],
  ['Storage crate · B', 60, 60, 55, 32, 4, false, false],
  ['Desk accessories', 45, 40, 35, 9, 1, false, false],
];
export const demoPlan = {
  name: 'Northside · Afternoon route',
  vehicle: defaultVehicle,
  packages: cargo.map(
    ([label, length, width, height, weight, stop, fragile, noStack], i) => ({
      id: `DP-${String(i + 1).padStart(3, '0')}`,
      label,
      length,
      width,
      height,
      weight,
      stop,
      fragile,
      noStack,
      baseRotationAllowed: true,
      maxStackingLoadKg: null,
    }),
  ),
};
export const stopColors = [
  '#d99c72',
  '#80a997',
  '#8299bc',
  '#b59fc0',
  '#d4b655',
  '#78acb8',
  '#d88382',
  '#9eb477',
];
export const colorForStop = (stop) =>
  stopColors[(stop - 1) % stopColors.length];
