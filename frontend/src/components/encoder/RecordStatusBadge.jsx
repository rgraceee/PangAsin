import React from 'react';
import { STATUS_LABELS } from '../../constants/labels';

export default function RecordStatusBadge({ status, reviewerComment }) {
  const label = STATUS_LABELS[status]?.label || status;
  const cls = `status-${STATUS_LABELS[status] ? status : 'pending'}`;
  return (
    <span className={`record-status-badge ${cls}`} title={reviewerComment || undefined}>
      {label}
    </span>
  );
}
