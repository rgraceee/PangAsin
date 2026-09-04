import React from 'react';
import { Card } from 'react-bootstrap';

export default function AdminKpiCard({ icon: Icon, title, value, supporting, accent, valueClassName }) {
  return (
    <Card className="admin-kpi">
      <Card.Body className="admin-kpi-body">
        {Icon && (
          <div className={`admin-kpi-icon admin-kpi-accent-${accent}bg`}>
            <Icon size={22} strokeWidth={2} />
          </div>
        )}
        <div className="admin-kpi-title">{title}</div>
        <div className={`admin-kpi-value ${valueClassName || ''}`}>{value}</div>
        <div className="admin-kpi-supporting">{supporting}</div>
      </Card.Body>
    </Card>
  );
}
