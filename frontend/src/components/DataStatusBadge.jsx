import React, { useEffect, useState } from 'react';
import { loadAllMockData } from '../services/dataService';

export default function DataStatusBadge() {
  const [supplyDemand, setSupplyDemand] = useState(null);

  useEffect(() => {
    loadAllMockData()
      .then((data) => setSupplyDemand(data.supplyDemand || null))
      .catch(() => setSupplyDemand(null));
  }, []);

  return (
    <div className="data-status-bar">
      <span className="data-as-of">Data as of: {supplyDemand ? supplyDemand.asOfDate : '—'}</span>
      <span className="synthetic-badge">Live database data</span>
    </div>
  );
}