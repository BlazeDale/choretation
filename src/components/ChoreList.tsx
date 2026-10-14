import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { addChores, deleteChore, fireAndForget, updateChore } from '../db';
import { formatMinutes } from '../format';
import { MAX_MINUTES } from '../generator';
import { memberLoads, nextWeekday, scheduleNew, todayStr, weekdayOf } from '../rotation';
import type { Chore, ChoreDraft, Member, NewChore, Room } from '../types';
import { FrequencySelect, MinutesInput, OwnerSelect, WeekdaySelect } from './inputs';
import { ChoreCalendar } from './ChoreCalendar';
import { RedistributeButton } from './Redistribute';

type View = 'list' | 'calendar';
const VIEWS: Array<[View, string]> = [
  ['list', 'List'],
  ['calendar', 'Calendar'],
];
const VIEW_KEY = 'choretation-chores-view';
const readView = (): View => (localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list');

/** Every chore, grouped by area, editable in place, or as a month calendar. */
export function ChoreList({
  uid,
  chores,
  members,
  rooms,
  dailyLimit,
}: {
  uid: string;
  chores: Chore[];
  members: Member[];
  rooms: Room[];
  dailyLimit: number;
}) {
  const [view, setView] = useState<View>(readView);
  const [editing, setEditing] = useState<string | null>(null);
  const editRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Braces matter: scrollIntoView returns a Promise in newer browsers, and an effect may only return a cleanup.
    editRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [editing]);

  function saveEdit(c: Chore, d: ChoreFields) {
    const patch: Partial<NewChore> = { ...d, weekday: d.weekday ?? null };
    // A new weekday pin moves the chore to the next such day, like picking it in the row.
    if (d.weekday != null && d.weekday !== c.weekday) patch.nextDue = nextWeekday(todayStr(), d.weekday);
    save(c.id, patch);
    setEditing(null);
    if (d.minutes !== c.minutes || d.everyDays !== c.everyDays || patch.nextDue) setChanged(`Updated "${d.name}".`);
  }

  const setViewSaved = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };
  // Set after adding/removing a chore, to offer a redistribute.
  const [changed, setChanged] = useState<string | null>(null);
  const save = (id: string, patch: Partial<NewChore>) => fireAndForget(updateChore(uid, id, patch));

  const groups = useMemo(() => {
    const m = new Map<string, Chore[]>();
    for (const c of [...chores].sort((a, b) => a.name.localeCompare(b.name))) m.set(c.area, [...(m.get(c.area) ?? []), c]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [chores]);

  const loads = memberLoads(chores, members);

  const switcher = (
    <div className="view-switch" role="group" aria-label="View">
      {VIEWS.map(([v, label]) => (
        <button
          key={v}
          className={view === v ? 'on' : ''}
          aria-pressed={view === v}
          onClick={() => setViewSaved(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (view === 'calendar') {
    return (
      <div>
        {switcher}
        <ChoreCalendar
          chores={chores}
          members={members}
          rooms={rooms}
          dailyLimit={dailyLimit}
          onEdit={(id) => {
            setEditing(id);
            setViewSaved('list');
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {switcher}
      <div className="loads">
        {members.map((m) => (
          <span key={m.id} className="load">
            {m.name}: <strong>{formatMinutes(loads.get(m.id) ?? 0)}</strong>/week
          </span>
        ))}
      </div>
      {!changed && (
        <div className="actions">
          <RedistributeButton uid={uid} chores={chores} members={members} dailyLimit={dailyLimit} />
        </div>
      )}

      <AddChore
        areas={groups.map(([a]) => a)}
        onAdd={(draft) => {
          fireAndForget(addChores(uid, scheduleNew([draft], chores, members)));
          setChanged(`Added "${draft.name}".`);
        }}
      />
      {changed && (
        <div className="notice">
          <p>
            {changed} Redistribute the schedule around your {dailyLimit}-minute daily limit?
          </p>
          <RedistributeButton uid={uid} chores={chores} members={members} dailyLimit={dailyLimit} />
        </div>
      )}

      {groups.map(([area, items]) => (
        <section key={area} className="group">
          <h3>{area}</h3>
          <ul className="rows">
            {items.map((c) =>
              editing === c.id ? (
                <li key={c.id} ref={editRef} className="editing">
                  <ChoreForm
                    areas={groups.map(([a]) => a)}
                    initial={c}
                    submitLabel="Save changes"
                    onCancel={() => setEditing(null)}
                    onSubmit={(d) => saveEdit(c, d)}
                  />
                </li>
              ) : (
                <li key={c.id} className={c.active ? '' : 'muted'}>
                  <label className="check grow">
                    <input
                      type="checkbox"
                      title="Active"
                      checked={c.active}
                      onChange={(e) => {
                        save(c.id, { active: e.target.checked });
                        setChanged(`${e.target.checked ? 'Turned on' : 'Turned off'} "${c.name}".`);
                      }}
                    />
                    {c.name}
                  </label>
                  <span className="row-controls">
                    <MinutesInput value={c.minutes} max={MAX_MINUTES} onCommit={(minutes) => save(c.id, { minutes })} />
                    <span className="unit">min</span>
                    <FrequencySelect
                      value={c.everyDays}
                      // A weekday pin only makes sense for weekly multiples.
                      onChange={(everyDays) => save(c.id, everyDays % 7 ? { everyDays, weekday: null } : { everyDays })}
                    />
                    <WeekdaySelect
                      value={c.weekday}
                      onChange={(weekday) =>
                        save(
                          c.id,
                          weekday == null
                            ? { weekday }
                            : { weekday, everyDays: c.everyDays % 7 ? 7 : c.everyDays, nextDue: nextWeekday(todayStr(), weekday) },
                        )
                      }
                    />
                    <OwnerSelect
                      members={members}
                      value={c.owner}
                      // Fixing a chore to someone hands it to them now; "Anyone" leaves the current turn as is.
                      onChange={(owner) => save(c.id, owner ? { owner, assigneeId: owner } : { owner: null })}
                    />
                    {!c.owner && c.assigneeId && (
                      <span className="unit">next: {members.find((m) => m.id === c.assigneeId)?.name}</span>
                    )}
                    <input
                      type="date"
                      aria-label="Next due"
                      value={c.nextDue}
                      onChange={(e) => {
                        const nextDue = e.target.value;
                        // Picking a date for a pinned chore moves the pin to that weekday.
                        if (nextDue) save(c.id, c.weekday != null ? { nextDue, weekday: weekdayOf(nextDue) } : { nextDue });
                      }}
                    />
                    <button className="link" onClick={() => setEditing(c.id)}>
                      Edit
                    </button>
                    <button
                      className="link danger"
                      onClick={() => {
                        if (!confirm(`Delete "${c.name}"?`)) return;
                        fireAndForget(deleteChore(uid, c.id));
                        setChanged(`Deleted "${c.name}".`);
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AddChore({ areas, onAdd }: { areas: string[]; onAdd: (d: ChoreDraft) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="add-btn" onClick={() => setOpen(true)}>
        + Add a custom chore
      </button>
    );
  }

  return (
    <ChoreForm
      areas={areas}
      submitLabel="Add"
      onCancel={() => setOpen(false)}
      onSubmit={(d) => {
        onAdd({ key: '', ...d });
        setOpen(false);
      }}
    />
  );
}

type ChoreFields = Pick<ChoreDraft, 'name' | 'area' | 'minutes' | 'everyDays' | 'weekday'>;

/** Name, area, time and schedule of a chore: blank for adding, filled in for editing. */
function ChoreForm({
  areas,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  areas: string[];
  initial?: ChoreFields;
  submitLabel: string;
  onSubmit: (d: ChoreFields) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30);
  const [everyDays, setEveryDays] = useState(initial?.everyDays ?? 7);
  const [weekday, setWeekday] = useState<number | null>(initial?.weekday ?? null);
  const areasId = useId();

  return (
    <form
      className="card-panel add-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({ name: name.trim(), area: area.trim() || 'Other', minutes, everyDays, weekday });
      }}
    >
      <input placeholder="Chore name" aria-label="Chore name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <input
        placeholder="Area (e.g. Kitchen)"
        aria-label="Area"
        list={areasId}
        value={area}
        onChange={(e) => setArea(e.target.value)}
      />
      <datalist id={areasId}>
        {areas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <span className="row-controls">
        <MinutesInput value={minutes} max={MAX_MINUTES} onCommit={setMinutes} />
        <span className="unit">min</span>
        <FrequencySelect
          value={everyDays}
          onChange={(d) => {
            setEveryDays(d);
            if (d % 7) setWeekday(null);
          }}
        />
        <WeekdaySelect
          value={weekday}
          onChange={(w) => {
            setWeekday(w);
            if (w != null && everyDays % 7) setEveryDays(7);
          }}
        />
      </span>
      {weekday != null && everyDays > 7 && weekday !== initial?.weekday && (
        <p className="hint">It'll start on the next one; change its date in the list if it should be the week after.</p>
      )}
      <div className="actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary">{submitLabel}</button>
      </div>
    </form>
  );
}
