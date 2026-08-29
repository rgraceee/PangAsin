import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getMunicipalityProduction } from '../services/dataService';

export default function MunicipalityProductionSection() {
  const data = getMunicipalityProduction();

  return (
    <section className="mb-5">
      <div className="section-card">
        <div className="card-body">
          <h2 className="section-title">Salt Production by Municipality</h2>
          <p className="text-muted small">Explore recorded salt production across Pangasinan's seven salt-producing municipalities.</p>
          <div className="chart-container" style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip
                  formatter={(value) => [`${value.toLocaleString()} MT`, 'Production']}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="productionMT" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#0d6efd" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
