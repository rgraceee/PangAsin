// WHAT: "Share of Provincial Production" card for the Admin Dashboard: the
//       shared donut (MuniShareDonut) inside an admin card shell, with its own
//       header, description and data-driven interpretation note.
// WHY: mirrors the Public Dashboard "Share of Provincial Production" card but
//      uses the Admin Dashboard card style and follows the Admin filters
//      (municipality, year, month, start/end date) through the rows prop.
import React, { useMemo } from 'react';
import { Card } from 'react-bootstrap';
import { PieChart as PieGlyph } from 'lucide-react';
import { MUNICIPALITY_COLORS } from '../../../theme/colors';
import MuniShareDonut from './MuniShareDonut';

const CHART_HEIGHT = 340;

export default function MuniShareDonutCard({ rows = [], selectedMuni = '' }) {
  const { list, total } = useMemo(() => {
    const data = [...rows]
      .map((row) => ({ ...row, volumeMT: Number(row.volumeMT) || 0 }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
    return {
      list: data,
      total: data.reduce((sum, row) => sum + row.volumeMT, 0),
    };
  }, [rows]);

  const topRow = list[0];
  const topShare = total > 0 ? (topRow.volumeMT / total) * 100 : 0;
  const hasData = list.length > 0 && total > 0;
  const entityLabel = selectedMuni ? 'barangay' : 'municipality';

  const note = topRow
    ? `Top ${entityLabel}: ${topRow.name} · ${topShare.toFixed(1)}% of ${selectedMuni ? `${selectedMuni} approved production` : 'provincial production'}.`
    : null;

  return (
    <Card className="encoder-card h-100 admin-share-card">
      <Card.Header>
        <div className="admin-card-head">
          <span className="admin-card-head-icon admin-card-head-icon--soft">
            <PieGlyph size={16} strokeWidth={2} />
          </span>
          <div>
            <h5 className="admin-card-head-title">
              Share of {selectedMuni ? 'Barangay' : 'Provincial'} Production
            </h5>
            <p className="admin-card-head-sub">
              Each slice is a {entityLabel}&apos;s share of the {selectedMuni ? 'selected municipality' : 'provincial'} total.
            </p>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {!hasData ? (
          <div className="admin-prod-empty">
            <span className="admin-prod-empty-chip">No data</span>
            No production records for the selected {entityLabel}s.
          </div>
        ) : (
          <>
            <MuniShareDonut
              data={list.map((row) => ({
                name: row.name,
                value: row.volumeMT,
                id: row.id,
              }))}
              height={CHART_HEIGHT}
              centerLabel="Total"
              showLegend={false}
              colorMap={MUNICIPALITY_COLORS}
              scopeLabel={selectedMuni || 'province'}
              entityLabel={entityLabel}
            />
            {note && <p className="admin-prod-note">{note}</p>}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
