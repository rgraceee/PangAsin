import React from 'react';

export default function KPICard({ title, value, supporting }) {
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-supporting">{supporting}</div>
    </div>
  );
}
