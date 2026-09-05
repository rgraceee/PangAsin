export const BRAND = {
  navy: '#0d47a1',
  ocean: '#1565C8',
  gold: '#F09A28',
  green: '#29B039',
  brown: '#574326',
};

export const BRAND_TINTS = {
  oceanLight: '#6FA8DC',
  goldLight: '#F7C16A',
  greenLight: '#7CD27E',
};

export const OCEAN_LIGHT = '#DCECFB';

export function lerpHex(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function oceanScale(value, min, max) {
  const t = max === min ? 0.5 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  return lerpHex(OCEAN_LIGHT, BRAND.ocean, t);
}

export const MUNICIPALITY_COLORS = {
  Alaminos: BRAND.ocean,
  Anda: BRAND.green,
  Bani: BRAND.gold,
  Bolinao: BRAND.navy,
  Dasol: BRAND.brown,
  Infanta: BRAND_TINTS.oceanLight,
  'San Fabian': BRAND_TINTS.greenLight,
};

export const STATUS = {
  ready: '#29B039',
  not_ready: '#E53935',
  warning: '#F09A28',
  neutral: '#6c757d',
};

export const GENDER = {
  male: '#6366F1',
  female: '#EC4899',
};
