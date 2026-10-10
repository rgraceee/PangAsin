import React from 'react';

// WHAT: Insight callout na naka-kabit sa chart.
// WHY: isang reusable component para parehas ang hitsura ng lahat ng caption;
//      ang `icon` at `tone` ay optional para hindi mabasag ang lumang `<ChartCaption>text</ChartCaption>`.
export default function ChartCaption({ children, icon = null, tone = 'info', className = '' }) {
  const classes = ['public-chart-caption', `public-chart-caption--${tone}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} role="note">
      {icon ? <span className="public-chart-caption__icon" aria-hidden="true">{icon}</span> : null}
      <span className="public-chart-caption__text">{children}</span>
    </div>
  );
}
