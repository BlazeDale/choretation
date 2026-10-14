import { FREQUENCIES, formatEvery } from '../format';
import type { Member } from '../types';

export function FrequencySelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const options = FREQUENCIES.includes(value) ? FREQUENCIES : [...FREQUENCIES, value].sort((a, b) => a - b);
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Frequency">
      {options.map((d) => (
        <option key={d} value={d}>
          {formatEvery(d)}
        </option>
      ))}
    </select>
  );
}

export function MemberSelect({
  members,
  value,
  onChange,
  allowNone,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Assigned to">
      {(allowNone || !value) && <option value="">Unassigned</option>}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

/** Number input that only reports valid values, on blur, so typing doesn't save every keystroke. */
export function MinutesInput({ value, onCommit, max }: { value: number; onCommit: (m: number) => void; max: number }) {
  return (
    <input
      type="number"
      className="minutes"
      min={5}
      max={max}
      step={5}
      defaultValue={value}
      key={value}
      aria-label="Minutes"
      onBlur={(e) => {
        const m = Math.min(max, Math.max(5, Math.round(Number(e.target.value) || value)));
        if (m !== value) onCommit(m);
        else e.target.value = String(value);
      }}
    />
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Optional day-of-week pin. */
export function WeekdaySelect({ value, onChange }: { value: number | null | undefined; onChange: (day: number | null) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      aria-label="Day of week"
    >
      <option value="">Any day</option>
      {WEEKDAYS.map((d, i) => (
        <option key={d} value={i}>
          {d}s
        </option>
      ))}
    </select>
  );
}

/** Who a chore belongs to: one person for good, or anyone (it rotates). */
export function OwnerSelect({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: string | null | undefined;
  onChange: (owner: string | null) => void;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Whose chore">
      <option value="">Anyone (rotates)</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          Always {m.name}
        </option>
      ))}
    </select>
  );
}
