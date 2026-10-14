import { fireAndForget, recordCompletion, updateChore } from '../db';
import { dueLabel, formatEvery, formatMinutes } from '../format';
import { addDays, completion, daysUntil, todayStr } from '../rotation';
import type { Chore, Member } from '../types';
import { MemberSelect } from './inputs';
import { EVERYONE, PersonFilter, usePersonFilter } from './PersonFilter';

export function Today({
  uid,
  chores,
  members,
  dailyLimit,
}: {
  uid: string;
  chores: Chore[];
  members: Member[];
  dailyLimit: number;
}) {
  const [filter, setFilter] = usePersonFilter(members);

  const today = todayStr();
  const visible = chores
    // Whoever is doing it this time, including one-off swaps.
    .filter((c) => c.active && (filter === EVERYONE || c.assigneeId === filter))
    .map((c) => ({ c, days: daysUntil(c.nextDue, today) }))
    .sort((a, b) => a.days - b.days || a.c.area.localeCompare(b.c.area));
  const due = visible.filter((x) => x.days <= 0);
  const upcoming = visible.filter((x) => x.days > 0 && x.days <= 7);

  function done(c: Chore) {
    const by = c.assigneeId ?? (filter !== EVERYONE ? filter : members[0]?.id);
    if (!by) return;
    fireAndForget(recordCompletion(uid, c, completion(c, chores, members, by, today, dailyLimit), by, today));
  }

  const card = ({ c, days }: { c: Chore; days: number }) => (
    <li key={c.id} className={`card ${days < 0 ? 'overdue' : ''}`}>
      <div className="card-main">
        <div className="card-title">{c.name}</div>
        <div className="meta">
          {c.area} · {formatMinutes(c.minutes)} · {formatEvery(c.everyDays)} · <span className="due">{dueLabel(days)}</span>
        </div>
      </div>
      <div className="card-actions">
        <MemberSelect
          members={members}
          value={c.assigneeId}
          onChange={(assigneeId) => fireAndForget(updateChore(uid, c.id, { assigneeId }))}
        />
        {days <= 0 && (
          <button title="Push to tomorrow" onClick={() => fireAndForget(updateChore(uid, c.id, { nextDue: addDays(today, 1) }))}>
            Snooze
          </button>
        )}
        <button className="primary" onClick={() => done(c)}>
          Done
        </button>
      </div>
    </li>
  );

  const total = (xs: typeof visible) => formatMinutes(xs.reduce((s, x) => s + x.c.minutes, 0));

  return (
    <div>
      <PersonFilter members={members} value={filter} onChange={setFilter} />

      <h2>
        Due now <span className="count">{due.length ? `${due.length} · ${total(due)}` : ''}</span>
      </h2>
      {due.length ? <ul className="cards">{due.map(card)}</ul> : <p className="empty">All caught up 🎉</p>}

      <h2>
        Next 7 days <span className="count">{upcoming.length ? `${upcoming.length} · ${total(upcoming)}` : ''}</span>
      </h2>
      {upcoming.length ? <ul className="cards">{upcoming.map(card)}</ul> : <p className="empty">Nothing scheduled.</p>}
    </div>
  );
}
