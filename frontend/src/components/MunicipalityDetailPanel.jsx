import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { getIndustryInsight } from '../services/dataService';

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
  ];

  const historicalData = Object.entries(municipality.historicalProduction || {}).map(([year, value]) => ({
    year,
    value,
  }));

  const ageData = muniDemo ? Object.entries(muniDemo.ageGroups).map(([age, count]) => ({ age, count })) : [];
  const genderData = muniDemo
    ? Object.entries(muniDemo.genderDistribution).map(([gender, count]) => ({
        gender: gender === 'notSpecified' ? 'Not Specified' : gender.charAt(0).toUpperCase() + gender.slice(1),
        count,
      }))
    : [];

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
              <div className="chart-container" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {methodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#198754', '#dc3545', '#ffc107'][index % 3]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title text-uppercase text-muted small">Historical Trend</h6>
              <div className="chart-container" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value) => value.toLocaleString()} />
                    <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`, '']} />
                    <Line type="monotone" dataKey="value" stroke="#198754" strokeWidth={2} dot={{ r: 4 }} />
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
                    <div className="chart-container" style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip formatter={(value) => [value, 'Producers']} />
                          <Bar dataKey="count" fill="#198754" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6 className="small text-muted mb-2">Gender Distribution</h6>
                    <div className="chart-container" style={{ height: 240 }}>
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
                            {genderData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#0d6efd', '#dc3545', '#6c757d'][index % 3]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, '']} />
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
