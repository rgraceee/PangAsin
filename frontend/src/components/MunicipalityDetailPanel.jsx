import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { getIndustryInsight } from '../services/dataService';
import { GENDER, BRAND } from '../theme/colors';
import ChartCaption from './ChartCaption';

const METHOD_COLORS = { Solar: BRAND.ocean, Cooked: BRAND.gold, Hybrid: BRAND.green };

function VolumeTooltip({ active, payload, unit }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="admin-chart-tooltip">
      {p.name ? <div className="ct-label">{p.name}</div> : null}
      <div className="ct-value">{Number(p.value).toLocaleString()}{unit ? ` ${unit}` : ''}</div>
    </div>
  );
}

function CountTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="admin-chart-tooltip">
      {p.name ? <div className="ct-label">{p.name}</div> : null}
      <div className="ct-value">{Number(p.value).toLocaleString()} producers</div>
    </div>
  );
}

export default function MunicipalityDetailPanel({ municipality, onClose, demographics }) {
  if (!municipality) return null;

  const changePct = municipality.productionChangePercent;
  const trendSymbol = changePct >= 0 ? '↑' : '↓';
  const trendClass = changePct >= 0 ? 'text-success' : 'text-danger';
  const insight = getIndustryInsight(municipality.id);
  const muniDemo = demographics.byMunicipality[municipality.id];

  const methodData = [
    { name: 'Solar', value: municipality.solarProductionMT },
    { name: 'Cooked', value: municipality.cookedProductionMT },
    { name: 'Hybrid', value: municipality.hybridProductionMT },
  ].map((e) => {
    const total = [municipality.solarProductionMT, municipality.cookedProductionMT, municipality.hybridProductionMT].reduce((a, b) => a + (b || 0), 0);
    const pct = total > 0 ? (e.value / total) * 100 : 0;
    return { ...e, pct, label: `${e.value.toLocaleString()} MT · ${pct.toFixed(1)}%` };
  });
  const topMethod = methodData.reduce((best, e) => (e.value > best.value ? e : best), methodData[0]);

  const historicalData = Object.entries(municipality.historicalProduction || {}).map(([year, value]) => ({
    year,
    value,
  }));
  const peakYear = historicalData.length
    ? historicalData.reduce((best, e) => (e.value > best.value ? e : best), historicalData[0])
    : null;

  const ageData = muniDemo ? Object.entries(muniDemo.ageGroups).map(([age, count]) => ({ age, count })) : [];
  const topAge = ageData.length ? ageData.reduce((best, e) => (e.count > best.count ? e : best), ageData[0]) : null;
  const genderData = muniDemo
    ? Object.entries(muniDemo.genderDistribution).map(([gender, count]) => ({
        gender: gender === 'notSpecified' ? 'Not Specified' : gender.charAt(0).toUpperCase() + gender.slice(1),
        count,
      }))
    : [];
  const genderTotal = genderData.reduce((sum, g) => sum + g.count, 0);

  const genderColor = (name) => {
    const key = name === 'Male' ? 'male' : name === 'Female' ? 'female' : '';
    return key ? GENDER[key] : '#9E9E9E';
  };

  return (
    <>
      <div className={`detail-overlay ${municipality ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`detail-panel ${municipality ? 'open' : ''}`}>
        <div className="p-3">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h3 className="h5 mb-1">{municipality.name}</h3>
              <span className="text-muted small">{municipality.productionRank} of 7 municipalities</span>
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title text-uppercase text-muted small">Production Summary</h6>
              <div className="detail-metric">
                <span className="detail-metric-label">Current Production</span>
                <span className="detail-metric-value">{municipality.productionMT.toLocaleString()} MT</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-label">Previous Production</span>
                <span className="detail-metric-value">{municipality.previousProductionMT != null ? `${municipality.previousProductionMT.toLocaleString()} MT` : '—'}</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-label">Change</span>
                <span className={`detail-metric-value ${trendClass}`}>
                  {changePct != null ? `${trendSymbol} ${Math.abs(changePct)}%` : '—'}
                </span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-label">Production Rank</span>
                <span className="detail-metric-value">{municipality.productionRank} of 7</span>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title text-uppercase text-muted small">Production Area & Facilities</h6>
              <div className="detail-metric">
                <span className="detail-metric-label">Production Area</span>
                <span className="detail-metric-value">{municipality.productionAreaSqm.toLocaleString()} m²</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-label">Salt Beds</span>
                <span className="detail-metric-value">{municipality.saltBeds}</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-label">Dominant Method</span>
                <span className="detail-metric-value">{municipality.dominantMethod.charAt(0).toUpperCase() + municipality.dominantMethod.slice(1)}</span>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title text-uppercase text-muted small">Method Distribution</h6>
              {topMethod && topMethod.value > 0 && (
                <ChartCaption>
                  {topMethod.name} evaporation leads {municipality.name}&apos;s recorded volume at {topMethod.value.toLocaleString()} MT ({topMethod.pct.toFixed(1)}% of the municipal total).
                </ChartCaption>
              )}
              <div className="chart-container" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodData} layout="vertical" margin={{ top: 5, right: 150, left: 20, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                    <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<VolumeTooltip unit="MT" />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={30}>
                      {methodData.map((entry) => (
                        <Cell key={entry.name} fill={METHOD_COLORS[entry.name] || BRAND.ocean} />
                      ))}
                      <LabelList dataKey="label" position="right" className="chart-bar-label" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {municipality.methodDescription && <p className="text-muted small mt-2 mb-0">{municipality.methodDescription}</p>}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title text-uppercase text-muted small">Historical Trend</h6>
              {peakYear && (
                <ChartCaption>
                  Recorded production in {municipality.name} peaked in {peakYear.year} at {peakYear.value.toLocaleString()} MT.
                </ChartCaption>
              )}
              <div className="chart-container" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => value.toLocaleString()} />
                    <Tooltip cursor={{ stroke: BRAND.ocean }} content={<VolumeTooltip unit="MT" />} />
                    <Line type="monotone" dataKey="value" name="year" stroke={BRAND.ocean} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {muniDemo && (
            <div className="card mb-3">
              <div className="card-body">
                <h6 className="card-title text-uppercase text-muted small">Aggregated Demographics</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <h6 className="small text-muted mb-2">Age Distribution</h6>
                    {topAge && (
                      <ChartCaption>
                        Producers aged {topAge.age} form the largest cohort at {topAge.count.toLocaleString()}.
                      </ChartCaption>
                    )}
                    <div className="chart-container" style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip cursor={{ fill: 'rgba(41, 176, 57, 0.08)' }} content={<CountTooltip />} />
                          <Bar dataKey="count" fill={BRAND.green} radius={[4, 4, 0, 0]} maxBarSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6 className="small text-muted mb-2">Gender Distribution</h6>
                    {genderTotal > 0 && (
                      <ChartCaption>
                        {genderData.reduce((max, g) => (g.count > max.count ? g : max), genderData[0]).gender} is the largest reported group among the {genderTotal.toLocaleString()} producers.
                      </ChartCaption>
                    )}
                    <div className="chart-container" style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={genderData}
                            dataKey="count"
                            nameKey="gender"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ gender, count }) => `${gender}: ${count}`}
                          >
                            {genderData.map((entry) => (
                              <Cell key={entry.gender} fill={genderColor(entry.gender)} />
                            ))}
                          </Pie>
                          <Tooltip content={<CountTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {insight && (
            <div className="card mb-3">
              <div className="card-body">
                <h6 className="card-title text-uppercase text-muted small">Industry Insight</h6>
                <p className="mb-0">{insight}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}