import { useMemo, useState } from 'react';
import { formatMinutes } from '../format';
import { MAX_MINUTES } from '../generator';
import { weeklyMinutes } from '../rotation';
import type { ChoreDraft } from '../types';
import { FrequencySelect, MinutesInput } from './inputs';

interface Row extends ChoreDraft {
  selected: boolean;
}

/** Review generated chores: untick ones you don't want, tweak time and frequency. */
export function ChorePicker({
  drafts,
  peopleCount,
  confirmLabel,
  onConfirm,
  onBack,
}: {
  drafts: ChoreDraft[];
  peopleCount: number;
  confirmLabel: string;
  onConfirm: (chosen: ChoreDraft[]) => void;
  onBack?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => drafts.map((d) => ({ ...d, selected: true })));
  const [busy, setBusy] = useState(false);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.area, [...(m.get(r.area) ?? []), r]);
    return [...m.entries()];
  }, [rows]);

  const chosen = rows.filter((r) => r.selected);
  const weekly = chosen.reduce((sum, r) => sum + weeklyMinutes(r), 0);

  if (!drafts.length) {
    return (
      <div className="card-panel">
        <p>No new chores to add. Everything for this home is already on your list.</p>
        {onBack && <button onClick={onBack}>Back</button>}
      </div>
    );
  }

  return (
    <div>
      <p className="summary">
        {chosen.length} chores ≈ <strong>{formatMinutes(weekly)}</strong> per week total,{' '}
        <strong>{formatMinutes(weekly / Math.max(1, peopleCount))}</strong> per person.
      </p>
      {groups.map(([area, items]) => (
        <section key={area} className="group">
          <h3>{area}</h3>
          <ul className="rows">
            {items.map((r) => (
              <li key={r.key} className={r.selected ? '' : 'muted'}>
                <label className="check grow">
                  <input type="checkbox" checked={r.selected} onChange={(e) => patch(r.key, { selected: e.target.checked })} />
                  {r.name}
                </label>
                <span className="row-controls">
                  <MinutesInput value={r.minutes} max={MAX_MINUTES} onCommit={(minutes) => patch(r.key, { minutes })} />
                  <span className="unit">min</span>
                  <FrequencySelect value={r.everyDays} onChange={(everyDays) => patch(r.key, { everyDays })} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="actions sticky">
        {onBack && <button onClick={onBack}>Back</button>}
        <button
          className="primary"
          disabled={busy || !chosen.length}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(chosen.map(({ selected: _, ...d }) => d));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </div>
  );
}
