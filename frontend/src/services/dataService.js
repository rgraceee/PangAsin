import { municipalities as municipalitiesData, production as productionData, demographics as demographicsData, supplyDemand as supplyDemandData } from '../data/municipalities';

export async function loadAllMockData() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    municipalities: municipalitiesData,
    production: productionData,
    demographics: demographicsData,
    supplyDemand: supplyDemandData,
  };
}

export function getMunicipalityProduction() {
  const sorted = [...municipalitiesData].sort((a, b) => b.productionMT - a.productionMT);
  const total = sorted.reduce((sum, m) => sum + m.productionMT, 0);
  return sorted.map((m) => ({
    ...m,
    percentageOfTotal: total > 0 ? (m.productionMT / total) * 100 : 0,
  }));
}

export function getProductionSummary() {
  const totalProduction = municipalitiesData.reduce((sum, m) => sum + m.productionMT, 0);
  const totalArea = municipalitiesData.reduce((sum, m) => sum + (m.productionAreaHa || 0), 0);
  const producerEntries = Object.values(demographicsData.provinceWide.genderDistribution).reduce((a, b) => a + b, 0);
  const sufficiency = supplyDemandData.philippines.domesticSupply > 0 ? (supplyDemandData.philippines.domesticSupply / supplyDemandData.philippines.demand) * 100 : 0;
  return {
    totalProduction,
    totalArea,
    producerEntries,
    sufficiency,
    municipalityCount: municipalitiesData.length,
  };
}

export function getSupplyDemand(scope) {
  if (scope === 'philippines') {
    return {
      labels: ['National Demand', 'Domestic Supply', 'Imported Salt'],
      values: [supplyDemandData.philippines.demand, supplyDemandData.philippines.domesticSupply, supplyDemandData.philippines.imports],
      unit: 'MT',
      note: 'Synthetic demonstration data',
    };
  }
  return {
    labels: ['Pangasinan Supply', 'Demand Benchmark'],
    values: [supplyDemandData.pangasinan.localSupply, supplyDemandData.pangasinan.demandBenchmark],
    unit: 'MT',
    note: 'Synthetic demonstration data',
  };
}

export function getSectorDemand() {
  const sector = supplyDemandData.sectorDemand;
  const total = Object.values(sector).reduce((a, b) => a + b, 0);
  return Object.entries(sector).map(([key, value]) => ({
    sector: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    value,
    percentage: total > 0 ? (value / total) * 100 : 0,
  }));
}

export function getProducerDemographics() {
  return demographicsData.provinceWide;
}

export function getMunicipalityDetail(id) {
  return municipalitiesData.find((m) => m.id === id) || null;
}

export function getIndustryInsight(id) {
  const muni = municipalitiesData.find((m) => m.id === id);
  return muni ? muni.insightSnippet : null;
}
