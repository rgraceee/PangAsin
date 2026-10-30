// WHAT: "Needs attention" card below the municipality charts.
// WHY: Turns the municipality numbers into an actionable list: which place
//      needs a decision, why, and the key value behind it. The tiles use the
//      same colour meaning as the bars above them.
import { Card } from 'react-bootstrap';
import { Flag } from 'lucide-react';
import { MUNI_COLORS, MUNI_EDGES, ATTENTION_COLOR_KEY } from './forecastColors';

const REASON_LABEL = {
  declining: 'Declining forecast',
  nodata: 'Not enough data',
};

export default function ForecastNeedsAttention({ items, total = 0 }) {
  return (
    <Card className="fc-card fc-attention-card">
      <Card.Header className="fc-card-head">
        <div className="fc-card-head-left">
          <span className="fc-card-head-icon"><Flag size={16} strokeWidth={1.75} /></span>
          <div className="fc-card-head-text">
            <h5 className="fc-card-title">Needs attention</h5>
            <p className="fc-card-sub">Each tile names the reason a municipality needs a decision, worst first.</p>
          </div>
        </div>
        <div className="fc-card-head-right">
          <span className="fc-chip fc-chip--meta">
            {total > 0 ? `${items.length} of ${total} municipalities` : `${items.length} municipalities`}
          </span>
        </div>
      </Card.Header>
      <Card.Body className="fc-card-body fc-attention-body">
        {items.length === 0 ? (
          <div className="fc-empty fc-empty--inline">
            <p>No municipality needs attention for this selection.</p>
          </div>
        ) : (
          <ul className="fc-attention-list" role="list">
            {items.map((item) => (
              <li key={item.id} className="fc-attention-item">
                <div className="fc-attention-top">
                  <span className="fc-attention-name">{item.name}</span>
                  <span className="fc-attention-value">{item.value}</span>
                </div>
                {(() => {
                  const key = ATTENTION_COLOR_KEY[item.reasons[0]?.tone] || 'nodata';
                  return (
                    <div className="fc-attention-meter" aria-hidden="true">
                      <span
                        className={`fc-attention-meter-fill${key === 'nodata' ? ' is-dashed' : ''}`}
                        style={{
                          width: `${item.barPct}%`,
                          background: MUNI_COLORS[key],
                          borderColor: MUNI_EDGES[key],
                        }}
                      />
                    </div>
                  );
                })()}
                <div className="fc-attention-reasons">
                  {item.reasons.map((reason) => {
                    const key = ATTENTION_COLOR_KEY[reason.tone] || 'nodata';
                    return (
                      <span
                        key={reason.label}
                        className={`fc-attention-badge${key === 'nodata' ? ' fc-attention-badge--dashed' : ''}`}
                        style={{
                          background: MUNI_COLORS[key],
                          borderColor: MUNI_EDGES[key],
                          color: 'var(--fc-text-2)',
                        }}
                      >
                        {REASON_LABEL[reason.tone] || reason.label}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}
