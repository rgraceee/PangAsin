import React from 'react';

export function SkeletonBlock({ width = '100%', height = 14, circle = false, className = '', style }) {
  return (
    <div
      className={`skeleton ${circle ? 'skeleton-circle' : 'skeleton-block'} ${className}`}
      style={{ width, height: circle ? width : height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, width, lastWidth = '60%' }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={i === lines - 1 && lastWidth ? lastWidth : width || '100%'}
          height={12}
          className={i === lines - 1 ? 'skeleton-last' : ''}
        />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="skeleton-cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <SkeletonBlock height={42} width={42} circle />
          <SkeletonBlock width="55%" height={13} />
          <SkeletonBlock width="85%" height={24} />
          <SkeletonBlock width="70%" height={11} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 6, cols = 5 }) {
  const grid = { display: 'grid', gap: '12px', gridTemplateColumns: `repeat(${cols}, 1fr)` };
  return (
    <div className="skeleton-list" role="status" aria-label="Loading">
      <div className="skeleton-list-head" style={grid}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} width="75%" height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-list-row" style={grid}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} width={`${45 + ((r + c) % 4) * 12}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="skeleton-chart" style={{ height }}>
      <div className="skeleton-chart-grid">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-chart-line" />)}
      </div>
      <div className="skeleton-chart-bars">
        {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton-chart-bar" style={{ height: `${28 + ((i * 17) % 55)}%` }} />)}
      </div>
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="skeleton-form">
      <div className="skeleton-form-row">
        <SkeletonBlock width="100%" height={16} />
        <SkeletonBlock width="45%" height={36} />
      </div>
      <div className="skeleton-form-row">
        <SkeletonBlock width="100%" height={16} />
        <SkeletonBlock width="60%" height={36} />
      </div>
      <div className="skeleton-form-row">
        <SkeletonBlock width="100%" height={16} />
        <SkeletonBlock width="38%" height={36} />
      </div>
      <SkeletonBlock width="100%" height={16} />
      <SkeletonBlock width="72%" height={88} />
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="skeleton-page">
      <SkeletonBlock width="55%" height={22} />
      <SkeletonBlock width="80%" height={13} />
      <div className="skeleton-page-block"><SkeletonCards count={4} /></div>
      <SkeletonText lines={4} />
    </div>
  );
}