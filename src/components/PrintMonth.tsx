import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { artKey, artUrls } from '../choreArt';
import { compactName, locationsFor, type Location } from '../locations';
import { ArtImg, LocationMark } from './Art';
import { projectMonth, todayStr } from '../rotation';
import type { Chore, Member, Room } from '../types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHEERS = ['You shine!', 'Superstar mode', 'Reach for the stars', 'Sparkle on', 'Shoot for the moon'];

/** Text and pictures shrink as a day gets busier so every chore still fits in its cell. */
const DENSITY = ['roomy', 'snug', 'snug one-line', 'tight one-line'];
const startDensity = (n: number) => (n <= 3 ? 0 : n <= 5 ? 1 : 3);

export function PrintMonth({
  chores,
  members,
  rooms,
  dailyLimit,
}: {
  chores: Chore[];
  members: Member[];
  rooms: Room[];
  dailyLimit: number;
}) {
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));

  const year = new Date(now.getFullYear(), now.getMonth() + offset, 1).getFullYear();
  const month0 = new Date(now.getFullYear(), now.getMonth() + offset, 1).getMonth();
  const monthName = new Date(year, month0, 1).toLocaleString(undefined, { month: 'long' });
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const lead = new Date(year, month0, 1).getDay();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1);
  const today = todayStr(now);
  const isPast = (d: number) => todayStr(new Date(year, month0, d)) < today;
  // Weeks that are already over get squeezed so the weeks ahead have room for their chores.
  const weekRows = Array.from({ length: cells.length / 7 }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7).every((d) => d < 1 || d > daysInMonth || isPast(d)) ? 'minmax(0, 0.3fr)' : 'minmax(0, 1fr)',
  ).join(' ');

  // memberId -> day of month -> chores due that day
  const byMember = useMemo(() => {
    const byId = new Map(chores.map((c) => [c.id, c]));
    const result = new Map<string, Map<number, Chore[]>>();
    for (const o of projectMonth(chores, members, year, month0, today, dailyLimit)) {
      if (!o.memberId) continue;
      const days = result.get(o.memberId) ?? new Map<number, Chore[]>();
      const day = Number(o.date.slice(8));
      days.set(day, [...(days.get(day) ?? []), byId.get(o.choreId)!]);
      result.set(o.memberId, days);
    }
    return result;
  }, [chores, members, year, month0, today, dailyLimit]);

  // Same icons on everyone's sheet, so numbering comes from every chore's area.
  const locations = useMemo(() => locationsFor(chores.map((c) => c.area), rooms), [chores, rooms]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <div className="card-panel no-print print-controls">
        <div className="inline">
          <select value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label="Month">
            <option value={0}>This month</option>
            <option value={1}>Next month</option>
          </select>
          {members.map((m) => (
            <label key={m.id} className="check">
              <input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m.id)} />
              {m.name}
            </label>
          ))}
        </div>
        <button className="primary" disabled={!picked.size} onClick={() => window.print()}>
          🖨️ Print chore calendars
        </button>
        <p className="hint">
          One landscape page per person for the whole month, with each day's chores written in. Color in a chore's
          picture when it's done. Past days are greyed out.
        </p>
      </div>

      <div className="sheets">
        {members
          .filter((m) => picked.has(m.id))
          .map((m) => {
            const days = byMember.get(m.id) ?? new Map<number, Chore[]>();
            const cheer = CHEERS[(m.name.length + month0) % CHEERS.length];
            const areas = new Set<string>();
            for (const [d, list] of days) if (!isPast(d)) for (const c of list) areas.add(c.area);
            const legend = [...areas].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            return (
              <div className="sheet-scroll" key={m.id}>
                <section className="sheet">
                  <header className="sheet-head">
                    <Banner />
                    <div className="sheet-title">
                      <span className="sheet-name hollow">{m.name}'s</span>
                      <span className="sheet-sub hollow">Chore Calendar</span>
                    </div>
                    <div className="sheet-month">
                      <span className="hollow">{monthName}</span>
                      <span className="sheet-year">{year}</span>
                    </div>
                  </header>

                  <div className="cal" style={{ gridTemplateRows: `auto ${weekRows}` }}>
                    {DOW.map((d) => (
                      <div key={d} className="cal-dow hollow">
                        {d}
                      </div>
                    ))}
                    {cells.map((d, i) => {
                      if (d < 1 || d > daysInMonth) return <div key={i} className="cal-cell out" />;
                      const past = isPast(d);
                      const list = past ? [] : (days.get(d) ?? []);
                      const cls = past ? 'cal-cell past' : 'cal-cell';
                      return (
                        <DayCell key={i} className={cls} day={d} chores={list} locations={locations} free={!past && !list.length} />
                      );
                    })}
                  </div>

                  {legend.length > 0 && (
                    <div className="legend">
                      <strong>Where:</strong>
                      {legend.map((a) => (
                        <span key={a} className="legend-item">
                          <LocationMark loc={locations.get(a)} /> {a}
                        </span>
                      ))}
                    </div>
                  )}
                  <footer className="sheet-foot">
                    <span>Color in the picture for your biggest chore when you've done the day!</span>
                    <span className="reward">
                      When I finish my chores this month I get:
                      <span className="line" />
                    </span>
                    <span className="cheer hollow">{cheer}</span>
                  </footer>
                </section>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/** One calendar day. Steps down to smaller text until its chores fit (measured on screen, kept for print). */
function DayCell({
  className,
  day,
  chores,
  locations,
  free,
}: {
  className: string;
  day: number;
  chores: Chore[];
  locations: Map<string, Location>;
  free: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(() => startDensity(chores.length));
  const [fontsReady, setFontsReady] = useState(false);
  useLayoutEffect(() => {
    setLevel(startDensity(chores.length));
  }, [chores.length]);
  useLayoutEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && level < DENSITY.length - 1) setLevel(level + 1);
  }, [level, fontsReady, chores]);

  const biggest = chores.reduce<Chore | null>((b, c) => (!b || c.minutes > b.minutes ? c : b), null);

  return (
    <div ref={ref} className={`${className} lvl-${level}`}>
      <span className="cal-num hollow">{day}</span>
      {biggest && (
        <div className="cal-pic">
          <ArtImg artKey={artKey(biggest.name)} />
        </div>
      )}
      {chores.length > 0 && (
        <ul className={`cal-list ${DENSITY[level]}`}>
          {chores.map((c, j) => (
            <li key={j}>
              <LocationMark loc={locations.get(c.area)} />
              <span>{compactName(c.name, c.area)}</span>
            </li>
          ))}
        </ul>
      )}
      {free && <span className="cal-free hollow">Free day!</span>}
    </div>
  );
}

/** Coloring-page banner behind the header, falling back to the drawn doodles. */
function Banner() {
  const [missing, setMissing] = useState(false);
  if (missing) return <Doodles />;
  return <img className="banner" src={artUrls('banner')[1]} alt="" onError={() => setMissing(true)} />;
}

/** Hand-drawn style sparkles, a moon and a swoosh for the header. */
function Doodles() {
  return (
    <svg className="doodles" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
      <path d="M20 100 C 180 40, 320 130, 500 80 S 820 30, 985 90" className="swoosh" />
      {[
        [330, 34, 10],
        [420, 18, 7],
        [610, 100, 8],
        [930, 28, 11],
        [760, 70, 6],
      ].map(([x, y, r], i) => (
        <path
          key={i}
          className={i % 2 ? 'sparkle alt' : 'sparkle'}
          d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`}
        />
      ))}
      <path d="M865 58 a20 20 0 1 0 22 26 a16 16 0 1 1 -22 -26z" className="moon" />
      {[
        [560, 40],
        [470, 92],
        [690, 20],
        [370, 70],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" className="dot" />
      ))}
    </svg>
  );
}
