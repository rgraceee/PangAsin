import React from 'react';

const STATUS_STYLES = {
  draft: { label: 'Draft', cls: 'status-draft' },
  pending: { label: 'Pending', cls: 'status-pending' },
  approved: { label: 'Approved', cls: 'status-approved' },
  rejected: { label: 'Rejected', cls: 'status-rejected' },
  returned: { label: 'Returned', cls: 'status-returned' },
};

export default function RecordStatusBadge({ status, reviewerComment }) {
  const style = STATUS_STYLES[status] || { label: status, cls: 'status-draft' };
  return (
    <span className={`record-status-badge ${style.cls}`} title={reviewerComment || undefined}>
      {style.label}
    </span>
  );
}
