import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getSupplyDemand, getSectorDemand } from '../services/dataService';

export default function SupplyDemandSection({ supplyDemand }) {
  const [scope, setScope] = useState('philippines');
  const data = getSupplyDemand(scope);
  const sectorData = getSectorDemand();

  const COLORS = ['#dc3545', '#198754', '#0d6efd'];

  return (
    <section className="mb-5">
      <div className="section-card">
        <div className="card-body">
          <h2 className="section-title">Salt Supply and Demand</h2>
          <p className="text-muted small">Compare salt demand with domestic production and imported supply.</p>

          <div className="mb-3">
            <div className="btn-group" role="group" aria-label="Scope selector">
              <button
                type="button"
                className={`btn ${scope === 'philippines' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setScope('philippines')}
              >
                Philippines
              </button>
              <button
                type="button"
                className={`btn ${scope === 'pangasinan' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setScope('pangasinan')}
              >
                Pangasinan
              </button>
            </div>
          </div>

          <div className="chart-container" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.labels.map((label, index) => ({ name: label, value: data.values[index] }))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => value.toLocaleString()} />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} ${data.unit}`, '']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.labels.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-muted small mt-2">{data.note}</p>
        </div>
      </div>

      <div className="section-card">
        <div className="card-body">
          <h2 className="section-title">Salt Demand by Sector</h2>
          <p className="text-muted small">Reference national sector breakdown by end use</p>
          <div className="chart-container" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  dataKey="value"
                  nameKey="sector"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ sector, percentage }) => `${sector}: ${percentage.toFixed(1)}%`}
                >
                  {sectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#198754', '#0dcaf0', '#ffc107', '#0d6efd'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
