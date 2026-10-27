// Shared white tooltip for admin charts: typed rows, optional note, always visible background.
export default function ChartTooltip({ title, rows, note }) {
  return (
    <div className="ac-tooltip">
      {title && <h2 className="ac-tooltip__title">{title}</h2>}
      {rows &&
        rows
          .filter((row) => row.value !== null && row.value !== undefined && row.value !== '')
          .map((row) => (
            <div key={row.label} className="ac-tooltip__row">
              <span className="ac-tooltip__label">{row.label}</span>
              <span className="ac-tooltip__value">{row.value}</span>
            </div>
          ))}
      {note && <div className="ac-tooltip__note">{note}</div>}
    </div>
  );
}