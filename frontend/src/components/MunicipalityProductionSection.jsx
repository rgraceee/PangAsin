import React, { useMemo } from 'react';
import { Card } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import { getMunicipalityProduction } from '../services/dataService';
import { oceanScale } from '../theme/colors';
import ChartCaption from './ChartCaption';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="admin-chart-tooltip">
      {label != null ? <div className="ct-label">{label}</div> : null}
      {payload.map((entry, i) => (
        <div key={i}>
          <div className="ct-value">{Number(entry.value).toLocaleString()} MT</div>
          <div className="ct-sub">{entry.payload.percentageOfTotal != null ? `${entry.payload.percentageOfTotal.toFixed(1)}% of provincial total` : 'Production'}</div>
        </div>
      ))}
    </div>
  );
}

export default function MunicipalityProductionSection() {
  const data = useMemo(() => getMunicipalityProduction(), []);
  const values = data.map((m) => m.productionMT);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const top = data[0];

  return (
    <section className="public-section">
      <Card className="encoder-card">
        <Card.Header>
          <div className="admin-card-head">
            <h5 className="admin-card-head-title">Salt Production by Municipality</h5>
            <span className="fw-normal text-muted small ms-1">Recorded production across Pangasinan&apos;s salt-producing municipalities</span>
          </div>
        </Card.Header>
        <Card.Body>
          {top && (
            <ChartCaption>
              {top.name} recorded the highest output at {top.productionMT.toLocaleString()} MT (
              {top.percentageOfTotal.toFixed(1)}% of the province-wide total), ahead of {data[1]?.name}.
            </ChartCaption>
          )}
          <div className="chart-container" style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 150, left: 20, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<ChartTooltip />} />
                <Bar dataKey="productionMT" radius={[0, 6, 6, 0]} maxBarSize={46}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={oceanScale(entry.productionMT, min, max)} />
                  ))}
                  <LabelList
                    dataKey="percentageOfTotal"
                    position="right"
                    className="chart-bar-label"
                    formatter={(value) => `${value.toFixed(1)}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>
    </section>
  );
}