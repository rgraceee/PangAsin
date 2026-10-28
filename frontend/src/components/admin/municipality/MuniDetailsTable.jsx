// WHAT: "Municipality Details" as a sortable, plain-white table.
// WHY: the numbers were left-aligned with three decimals and the header showed
//      a literal "m\u00B2". Rows are sorted on click and numbers are right-aligned
//      with tabular figures; the table itself stays neutral so the data reads
//      first.
import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import { fmtInt, fmtMT } from './muniData';

const COLUMNS = [
  { key: 'name', label: 'Municipality', align: 'left' },
  { key: 'volumeMT', label: 'Production (Metric Tons (MT))', align: 'right' },
  { key: 'producers', label: 'Salt Farmers', align: 'right' },
  { key: 'beds', label: 'Salt beds', align: 'right' },
  { key: 'area', label: 'Area (m²)', align: 'right' },
  { key: 'records', label: 'Approved Records', align: 'right' },
];

export default function MuniDetailsTable({ rows, scopeLabel }) {
  const [sort, setSort] = useState({ key: 'volumeMT', dir: 'desc' });

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [rows, sort]);

  const toggle = (key) => {
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  };

  return (
    <MuniCard
      icon={ArrowUpDown}
      title="Municipality Details"
      sub="Production volume from municipality data; other fields retain their operational sources"
      chips={<MuniChip label={scopeLabel} meta />}
    >
      <div className="muni-table-wrap">
        <table className="muni-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={col.align === 'right' ? 'is-right' : ''}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className={`muni-sort${active ? ' is-active' : ''}`} onClick={() => toggle(col.key)}>
                      {col.label}
                      {active
                        ? (sort.dir === 'asc' ? <ChevronUp size={13} strokeWidth={2.2} /> : <ChevronDown size={13} strokeWidth={2.2} />)
                        : <ArrowUpDown size={13} strokeWidth={1.8} />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <td className="muni-cell-name">{row.name}</td>
                <td className="is-right">{fmtMT(row.volumeMT)}</td>
                <td className="is-right">{fmtInt(row.producers)}</td>
                <td className="is-right">{fmtInt(row.beds)}</td>
                <td className="is-right">{fmtInt(row.area)}</td>
                <td className="is-right">{fmtInt(row.records)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MuniCard>
  );
}
