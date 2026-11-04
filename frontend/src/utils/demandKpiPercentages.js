export function getDemandKpiPercentages(shortfall, production) {
  if (!Number.isFinite(shortfall) || !Number.isFinite(production)) {
    return { shortfall: null, production: null };
  }
  const total = shortfall + production;
  if (total <= 0) return { shortfall: null, production: null };

  const shortfallPercentage = Math.round((shortfall / total) * 1000) / 10;
  return {
    shortfall: shortfallPercentage,
    production: Math.round((100 - shortfallPercentage) * 10) / 10,
  };
}
