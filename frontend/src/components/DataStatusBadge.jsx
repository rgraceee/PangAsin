import React from 'react';
import { supplyDemand } from '../data/municipalities';

export default function DataStatusBadge() {
  return (
    <div className="data-status-bar">
      <span className="data-as-of">Data as of: {supplyDemand.asOfDate}</span>
      <span className="synthetic-badge">Demo Data — Synthetic Values</span>
    </div>
  );
}
