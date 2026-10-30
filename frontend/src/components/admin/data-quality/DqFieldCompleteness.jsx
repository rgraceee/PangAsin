// WHAT: "Field completeness" - how often each required field was filled in,
//       province-wide or for one selected municipality.
// WHY: Nine bars all at 100% tells the admin nothing, so only the fields that
//      are below the threshold are shown by default; the rest are one click
//      away. The threshold and the field labels come from the API.
import React, { useState } from 'react';
import { Collapse } from 'react-bootstrap';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { toneForPercent } from './dqData';

export default function DqFieldCompleteness({ data, selectedId, onShowProvince }) {
  const { fields = [], municipalities = [], thresholds } = data;
  const [open, setOpen] = useState(false);

  const selected = municipalities.find((municipality) => municipality.id === selectedId);
  const source = selected ? selected.fields || {} : {};
  const rows = fields.map((field) => ({
    key: field.key,
    label: field.label,
    pct: selected ? (source[field.key] ?? 0) : field.pct,
  }));

  const below = rows.filter((row) => row.pct < thresholds.ok).sort((a, b) => a.pct - b.pct);
  const rest = rows.filter((row) => row.pct >= thresholds.ok).sort((a, b) => a.pct - b.pct);
  const scopeLabel = selected ? selected.name : 'Pangasinan (all municipalities)';

  const renderRow = (row) => (
    <div className="dq-field" key={row.key}>
      <span className="dq-field-label">{row.label}</span>
      <span className="dq-field-bar">
        <span
          className={`dq-field-fill dq-field-fill--${toneForPercent(row.pct, thresholds)}`}
          style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
        />
      </span>
      <span className="dq-field-value">{row.pct}%</span>
    </div>
  );

  return (
    <div>
      <div className="dq-field-head">
        <span className="dq-scope-note">
          <MapPin size={13} strokeWidth={2} aria-hidden="true" /> {scopeLabel}
        </span>
        {selected ? (
          <button type="button" className="ui-btn-outline ui-btn--sm" onClick={onShowProvince}>
            Show province-wide
          </button>
        ) : null}
      </div>

      {below.length === 0 ? (
        <p className="dq-calm">
          All {fields.length} required fields are at least {thresholds.ok}% filled.
        </p>
      ) : (
        <div>{below.map(renderRow)}</div>
      )}

      {rest.length > 0 ? (
        <>
          <button
            type="button"
            className="ui-btn-text ui-btn--sm dq-toggle-btn"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? <ChevronUp size={14} strokeWidth={2.2} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />}
            {open ? 'Show fewer fields' : `Show all ${fields.length} fields`}
          </button>
          <Collapse in={open}>
            <div>{rest.map(renderRow)}</div>
          </Collapse>
        </>
      ) : null}
    </div>
  );
}
