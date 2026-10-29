// WHAT: Sticky one-row filter bar for the Forecasting page.
// WHY: every filter in one place, one muted summary line, and a compact
//      mobile version that collapses behind a "Filters" button.
import { useEffect, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { Filter, RotateCcw, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { SkeletonBlock } from '../../Skeleton';
import { scopeAllLabel } from '../../../constants/labels';

const PERIODS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '24', label: '24 months' },
  { value: 'all', label: 'All data' },
];

const HORIZONS = [
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
];

/* The admin shell scrolls an inner container, not the window. */
function findScrollParent(el) {
  let node = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const scrollable = /(auto|scroll)/.test(style.overflowY);
    if (scrollable && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/* Plain-English "how old is this data" label. */
export function formatUpdated(timestamp) {
  if (!timestamp) return '';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'Updated last week' : `Updated ${weeks} weeks ago`;
}

export default function ForecastFilters({
  recordedWindow, onRecordedWindow,
  forecastHorizon, onForecastHorizon,
  selectedMuni, municipalities, onSelectedMuni,
  province, onProvince,
  onReset, onRefresh, refreshing, lastUpdated,
  summary, disabled = false, municipalityCount = 0,
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const barRef = useRef(null);
  // Re-render every 30s so the "updated" label keeps up with the clock.
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const scroller = findScrollParent(barRef.current);
    const onScroll = () => setScrolled((scroller.scrollTop || window.scrollY || 0) > 6);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  const updatedLabel = formatUpdated(lastUpdated);

  return (
    <div
      className={`fc-filterbar${scrolled ? ' fc-filterbar--scrolled' : ''}`}
      ref={barRef}
      role="group"
      aria-label="Forecast filters"
    >
      <div className="fc-filterbar-row">
        <button
          type="button"
          className="fc-filterbar-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal size={15} strokeWidth={1.75} />
          Filters
        </button>

        <div className={`fc-filterbar-fields${open ? ' is-open' : ''}`}>
          <div className="fc-filterbar-field">
            <label className="fc-filterbar-label" htmlFor="fc-period">Historical period</label>
            <Form.Select id="fc-period" value={recordedWindow} disabled={disabled} onChange={(e) => onRecordedWindow(e.target.value)}>
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Form.Select>
          </div>

          <div className="fc-filterbar-field">
            <label className="fc-filterbar-label" htmlFor="fc-horizon">Forecast horizon</label>
            <Form.Select id="fc-horizon" value={forecastHorizon} disabled={disabled} onChange={(e) => onForecastHorizon(e.target.value)}>
              {HORIZONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </Form.Select>
          </div>

          <div className="fc-filterbar-field">
            <label className="fc-filterbar-label" htmlFor="fc-municipality">Municipality</label>
            <Form.Select id="fc-municipality" value={selectedMuni} disabled={disabled} onChange={(e) => onSelectedMuni(e.target.value)}>
              <option value="all">{scopeAllLabel(municipalityCount || municipalities.length)}</option>
              {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Form.Select>
          </div>

          <div className="fc-filterbar-field">
            <label className="fc-filterbar-label" htmlFor="fc-province">Province</label>
            <Form.Select id="fc-province" value={province} disabled={disabled} onChange={(e) => onProvince(e.target.value)}>
              <option value="pangasinan">Pangasinan</option>
            </Form.Select>
          </div>

          <button type="button" className="fc-filterbar-reset" onClick={onReset} disabled={disabled}>
            <RotateCcw size={14} strokeWidth={1.75} />
            Reset
          </button>

          <div className="fc-filterbar-refresh">
            <button
              type="button"
              className={`fc-filterbar-refresh-btn${refreshing ? ' is-spinning' : ''}`}
              onClick={onRefresh}
              disabled={disabled || refreshing}
              aria-label="Refresh the forecast data"
              title="Refresh the forecast data"
            >
              <RefreshCw size={14} strokeWidth={1.75} />
            </button>
            {lastUpdated
              ? <span className="fc-filterbar-updated">{updatedLabel}</span>
              : <SkeletonBlock className="fc-filterbar-updated" width={120} height={11} />}
          </div>
        </div>
      </div>

      <p className="fc-filterbar-summary">
        <Filter size={12} strokeWidth={2} aria-hidden="true" />
        <span>{summary}</span>
      </p>
    </div>
  );
}
