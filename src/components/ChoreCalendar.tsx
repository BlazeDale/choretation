import { useMemo, useState, type CSSProperties } from 'react';
import { artKey } from '../choreArt';
import { formatMinutes } from '../format';
import { compactName, locationsFor } from '../locations';
import { headsUps, projectMonth, todayStr, weekdayOf } from '../rotation';
import type { Chore, Member, Room } from '../types';
import { ArtImg, LocationMark } from './Art';

/** One crayon per person, in member order. */
const CRAYONS = ['#4BA3E3', '#5DB760', '#F2B632', '#EE6FA6', '#8A6BDB', '#F28A3C'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_AHEAD = 5;
/** Lines shown in a cell before "+ N more". */
const SHOWN = 4;

interface Due {
  chore: Chore;
  memberId: string | null;
}

/**
 * The month's chores as a colored-in calendar: each person has a crayon, each day shows a picture
 * of its biggest chore on that person's color, and tapping a day lists everything in full.
 * Hollow crayon rings by the date mark who has the day off.
 */
export function ChoreCalendar({
  chores,
  members,
  rooms,
  dailyLimit,
  onEdit,
}: {
  chores: Chore[];
  members: Member[];
  rooms: Room[];
  dailyLimit: number;
  onEdit: (choreId: string) => void;
}) {
  const now = new Date();
  const today = todayStr(now);
  const [offset, setOffset] = useState(0);
  const [who, setWho] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = first.getFullYear();
  const month0 = first.getMonth();
  const monthName = first.toLocaleString(undefined, { month: 'long' });
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const lead = first.getDay();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1);
  const dateOf = (d: number) => todayStr(new Date(year, month0, d));

  const crayon = (id: string | null) => {
    const i = members.findIndex((m) => m.id === id);
    return i < 0 ? 'var(--muted)' : CRAYONS[i % CRAYONS.length];
  };
  const avatarOf = (id: string | null) => members.find((m) => m.id === id)?.avatar;
  const locations = useMemo(() => locationsFor(chores.map((c) => c.area), rooms), [chores, rooms]);

  const byDay = useMemo(() => {
    const byId = new Map(chores.map((c) => [c.id, c]));
    const map = new Map<number, Due[]>();
    for (const o of projectMonth(chores, members, year, month0, today, dailyLimit)) {
      if (who && o.memberId !== who) continue;
      const d = Number(o.date.slice(8));
      map.set(d, [...(map.get(d) ?? []), { chore: byId.get(o.choreId)!, memberId: o.memberId }]);
    }
    for (const list of map.values()) list.sort((a, b) => b.chore.minutes - a.chore.minutes);
    return map;
  }, [chores, members, year, month0, today, dailyLimit, who]);

  const soonByDay = useMemo(() => {
    const byId = new Map(chores.map((c) => [c.id, c]));
    const map = new Map<number, Due[]>();
    for (const o of headsUps(chores, members, year, month0, today, dailyLimit)) {
      if (who && o.memberId !== who) continue;
      const d = Number(o.date.slice(8));
      map.set(d, [...(map.get(d) ?? []), { chore: byId.get(o.choreId)!, memberId: o.memberId }]);
    }
    return map;
  }, [chores, members, year, month0, today, dailyLimit, who]);

  const person = members.find((m) => m.id === who);
  const goMonth = (n: number) => {
    setOffset(n);
    setPicked(null);
  };
  const pickedList = picked ? (byDay.get(picked) ?? []) : [];
  const pickedOff = picked ? members.filter((m) => m.freeDays?.includes(weekdayOf(dateOf(picked)))) : [];

  return (
    <div className="ccal">
      <div className="ccal-bar">
        <div className="ccal-month">
          <button className="ccal-arrow" onClick={() => goMonth(offset - 1)} disabled={offset === 0} aria-label="Previous month">
            ‹
          </button>
          <h2>
            {monthName} <span>{year}</span>
          </h2>
          <button
            className="ccal-arrow"
            onClick={() => goMonth(offset + 1)}
            disabled={offset === MONTHS_AHEAD}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="ccal-people" role="group" aria-label="Show chores for">
          <button className={who ? 'ccal-person' : 'ccal-person on'} onClick={() => setWho(null)}>
            Everyone
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              className={who === m.id ? 'ccal-person on' : 'ccal-person'}
              style={{ '--c': crayon(m.id) } as CSSProperties}
              onClick={() => setWho(who === m.id ? null : m.id)}
            >
              <span className="ccal-dot" />
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="ccal-grid">
        {DOW.map((d) => (
          <div key={d} className="ccal-dow">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d < 1 || d > daysInMonth) return <div key={i} className="ccal-cell blank" />;
          const date = dateOf(d);
          const past = date < today;
          const list = byDay.get(d) ?? [];
          const soon = past ? [] : (soonByDay.get(d) ?? []);
          const offPeople = members.filter((m) => m.freeDays?.includes(weekdayOf(date)));
          const off = !!person && offPeople.includes(person);
          const cls = ['ccal-cell', past && 'past', date === today && 'today', picked === d && 'picked'].filter(Boolean).join(' ');
          return (
            <button
              key={i}
              className={cls}
              disabled={past}
              onClick={() => setPicked(picked === d ? null : d)}
              aria-label={`${monthName} ${d}: ${list.length ? `${list.length} chores` : off ? 'day off' : 'no chores'}`}
              aria-expanded={picked === d}
            >
              <span className="ccal-num">{d}</span>
              {!past && !person && offPeople.length > 0 && (
                <span className="ccal-offs" title={`Day off: ${offPeople.map((m) => m.name).join(', ')}`}>
                  {offPeople.map((m) => (
                    <span key={m.id} className="ccal-ring" style={{ '--c': crayon(m.id) } as CSSProperties} />
                  ))}
                </span>
              )}
              {list.length > 0 && (
                <span className="ccal-patch" style={{ '--c': crayon(list[0].memberId) } as CSSProperties}>
                  <ArtImg key={avatarOf(list[0].memberId)} artKey={artKey(list[0].chore.name)} avatar={avatarOf(list[0].memberId)} />
                </span>
              )}
              {list.length + soon.length > 0 && (
                <ul className="ccal-lines">
                  {soon.map((x) => (
                    <li key={`h${x.chore.id}`} className="ccal-heads-up" style={{ '--c': crayon(x.memberId) } as CSSProperties}>
                      <span className="ccal-ring" />
                      <span className="ccal-name">Next week: {compactName(x.chore.name, x.chore.area)}</span>
                    </li>
                  ))}
                  {list.slice(0, SHOWN).map((x, j) => (
                    <li key={j} style={{ '--c': crayon(x.memberId) } as CSSProperties}>
                      <span className="ccal-dot" />
                      <LocationMark loc={locations.get(x.chore.area)} />
                      <span className="ccal-name">{compactName(x.chore.name, x.chore.area)}</span>
                    </li>
                  ))}
                  {list.length > SHOWN && <li className="ccal-more">+ {list.length - SHOWN} more</li>}
                </ul>
              )}
              {list.length > 0 && (
                <span className="ccal-dots" aria-hidden>
                  {list.map((x, j) => (
                    <span key={j} className="ccal-dot" style={{ '--c': crayon(x.memberId) } as CSSProperties} />
                  ))}
                </span>
              )}
              {!past && !list.length && !soon.length && <span className="ccal-free">{off ? 'day off' : 'free'}</span>}
            </button>
          );
        })}
      </div>

      {picked && (
        <section className="ccal-day" aria-live="polite">
          <header>
            <h3>{new Date(year, month0, picked).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            <span className="meta">
              {pickedOff.length > 0 && `Day off: ${pickedOff.map((m) => m.name).join(', ')}. `}
              {pickedList.length
                ? `${pickedList.length} chores, ${formatMinutes(pickedList.reduce((s, x) => s + x.chore.minutes, 0))}`
                : 'Nothing due'}
            </span>
          </header>
          <ul>
            {pickedList.map((x, j) => (
              <li key={j} style={{ '--c': crayon(x.memberId) } as CSSProperties}>
                <span className="ccal-patch small">
                  <ArtImg key={avatarOf(x.memberId)} artKey={artKey(x.chore.name)} avatar={avatarOf(x.memberId)} />
                </span>
                <span className="ccal-day-main">
                  <strong>{x.chore.name}</strong>
                  <span className="meta">
                    <LocationMark loc={locations.get(x.chore.area)} /> {x.chore.area}, {formatMinutes(x.chore.minutes)}
                  </span>
                </span>
                <span className="ccal-who">
                  <span className="ccal-dot" />
                  {members.find((m) => m.id === x.memberId)?.name ?? 'Unassigned'}
                </span>
                <button className="link" onClick={() => onEdit(x.chore.id)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
