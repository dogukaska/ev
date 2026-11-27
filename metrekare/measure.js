const SCALE = 1000n;
const RATE = 100n * SCALE;

function milli(raw, min, max) {
  const match = /^(\d{1,5})(?:[.,](\d{1,3}))?$/.exec(String(raw ?? "").trim());
  if (!match) throw new RangeError("Ölçüleri en fazla üç ondalık basamakla gir.");
  const value = BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(3, "0"));
  if (value < min || value > max) throw new RangeError("Ölçü veya fire oranı geçerli aralığın dışında.");
  return value;
}

export function calculateMaterials(areas, waste, coverage) {
  if (!areas.length) throw new RangeError("En az bir alan ekle.");
  const area = areas.reduce((sum, [width, length]) =>
    sum + milli(width, 1n, 10_000n * SCALE) * milli(length, 1n, 10_000n * SCALE), 0n);
  const target = area * (RATE + milli(waste, 0n, RATE));
  const unit = coverage.trim() ? milli(coverage, 1n, 10_000n * SCALE) * SCALE * RATE : null;
  return {
    area: Number(area) / Number(SCALE ** 2n),
    withWaste: Number(target) / Number(SCALE ** 2n * RATE),
    packages: unit === null ? null : (target + unit - 1n) / unit,
  };
}
