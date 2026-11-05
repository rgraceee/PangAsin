// WHAT: The card shell used by every panel in the Municipality Analytics
//       section.
// WHY: one header pattern (icon + title left, chips right), one chart height
//      rule and one muted caption line - the same language the Forecast and
//      Target Evaluation pages use.

export default function MuniCard({ icon: Icon, title, sub, chips, children, className = '' }) {
  return (
    <div className={`muni-card ${className}`}>
      <div className="muni-card-head">
        <div className="muni-card-head-left">
          {Icon && (
            <span className="muni-card-head-icon">
              <Icon size={16} strokeWidth={1.75} />
            </span>
          )}
          <div className="muni-card-head-text">
            <h5 className="muni-card-title">{title}</h5>
            {sub ? <p className="muni-card-sub">{sub}</p> : null}
          </div>
        </div>
        {chips ? <div className="muni-card-head-right">{chips}</div> : null}
      </div>
      <div className="muni-card-body">
        {children}
      </div>
    </div>
  );
}

export function MuniChip({ label, color, dashed = false, meta = false }) {
  if (meta) {
    return <span className="muni-chip muni-chip--meta">{label}</span>;
  }
  const style = dashed
    ? { borderColor: color, backgroundColor: 'transparent' }
    : { backgroundColor: color, borderColor: color };
  return (
    <span className="muni-chip">
      <span className={`muni-chip-swatch${dashed ? ' muni-chip-swatch--dashed' : ''}`} style={style} />
      {label}
    </span>
  );
}
