import React from 'react';

// WHAT: Responsive grid wrapper para sa KpiCard row.
// WHY: isang lugar lang ang column logic (5/4 desktop -> 2 @768 -> 1 @375).
export default function KpiGrid({ columns = 3, children, className = '' }) {
  const classes = ['ui-kpi-grid', className].filter(Boolean).join(' ');
  return (
    <div className={classes} data-cols={columns}>
      {children}
    </div>
  );
}
