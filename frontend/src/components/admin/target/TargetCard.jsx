// WHAT: The card shell used by every Target Evaluation chart.
// WHY: one header pattern (icon + title left, chips right), one chart height
//      rule and one muted caption line for all three charts.

export default function TargetCard({ icon: Icon, title, chips, children }) {
  return (
    <div className="te-card">
      <div className="te-card-head">
        <div className="te-card-head-left">
          {Icon && (
            <span className="te-card-head-icon">
              <Icon size={16} strokeWidth={1.75} />
            </span>
          )}
          <div className="te-card-head-text">
            <h5 className="te-card-title">{title}</h5>
          </div>
        </div>
        {chips ? <div className="te-card-head-right">{chips}</div> : null}
      </div>
      <div className="te-card-body">
        {children}
      </div>
    </div>
  );
}
