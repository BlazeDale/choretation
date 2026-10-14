import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_AVATAR, artKey } from '../choreArt';
import { compactName, locationsFor, type Location } from '../locations';
import { ArtImg, LocationMark } from './Art';
import { projectMonth, todayStr } from '../rotation';
import type { Chore, Member, Room } from '../types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHEERS = ['You shine!', 'Superstar mode', 'Reach for the stars', 'Sparkle on', 'Shoot for the moon'];

/** Text and pictures shrink as a day gets busier so every chore still fits in its cell. */
const DENSITY = ['roomy', 'snug', 'snug one-line', 'tight one-line'];
const startDensity = (n: number) => (n <= 3 ? 0 : n <= 5 ? 1 : 3);

const NOTE_MAX = 160;
/** One note per person per month, so last month's note doesn't print on this month's page. */
export const noteKey = (memberId: string, year: number, month0: number) =>
  `${memberId}_${year}-${String(month0 + 1).padStart(2, '0')}`;

export function PrintMonth({
  chores,
  members,
  rooms,
  dailyLimit,
  notes,
  onNote,
}: {
  chores: Chore[];
  members: Member[];
  rooms: Room[];
  dailyLimit: number;
  notes: Record<string, string>;
  onNote: (key: string, text: string) => void;
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
        {members
          .filter((m) => picked.has(m.id))
          .map((m) => {
            const key = noteKey(m.id, year, month0);
            return (
              <label key={key} className="note-field">
                Note on {m.name}'s {monthName} page (optional)
                <input
                  defaultValue={notes[key] ?? ''}
                  maxLength={NOTE_MAX}
                  placeholder="e.g. Great job last month! Piano is on Tuesdays now."
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    if (text !== (notes[key] ?? '')) onNote(key, text);
                  }}
                />
              </label>
            );
          })}
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
            const note = notes[noteKey(m.id, year, month0)]?.trim();
            const areas = new Set<string>();
            for (const [d, list] of days) if (!isPast(d)) for (const c of list) areas.add(c.area);
            const legend = [...areas].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            return (
              <div className="sheet-scroll" key={m.id}>
                <section className="sheet">
                  <header className="sheet-head">
                    <Banner key={`${month0}-${m.avatar ?? ''}`} month0={month0} avatar={m.avatar} />
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
                        <DayCell key={i} className={cls} day={d} chores={list} avatar={m.avatar} locations={locations} free={!past && !list.length} fitKey={note ?? ''} />
                      );
                    })}
                  </div>

                  {note && (
                    <div className="sheet-note">
                      <span className="hollow">Note</span>
                      <span>{note}</span>
                    </div>
                  )}
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
  avatar,
  locations,
  free,
  fitKey,
}: {
  className: string;
  day: number;
  chores: Chore[];
  avatar?: string;
  locations: Map<string, Location>;
  free: boolean;
  /** Changes when something else on the page takes space (a note), so the cell re-fits. */
  fitKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(() => startDensity(chores.length));
  // As a last resort, list fewer chores and end with "+ N more" rather than clipping.
  const [shown, setShown] = useState(chores.length);
  const [fontsReady, setFontsReady] = useState(false);
  useLayoutEffect(() => {
    setLevel(startDensity(chores.length));
    setShown(chores.length);
  }, [chores.length, fitKey]);
  useLayoutEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.scrollHeight <= el.clientHeight + 1) return;
    if (level < DENSITY.length - 1) setLevel(level + 1);
    else if (shown > 1) setShown(shown - 1);
  }, [level, shown, fontsReady, chores]);

  const biggest = chores.reduce<Chore | null>((b, c) => (!b || c.minutes > b.minutes ? c : b), null);

  return (
    <div ref={ref} className={`${className} lvl-${level}`}>
      <span className="cal-num hollow">{day}</span>
      {biggest && (
        <div className="cal-pic">
          <ArtImg key={avatar} artKey={artKey(biggest.name)} avatar={avatar} />
        </div>
      )}
      {chores.length > 0 && (
        <ul className={`cal-list ${DENSITY[level]}`}>
          {chores.slice(0, shown).map((c, j) => (
            <li key={j}>
              <LocationMark loc={locations.get(c.area)} />
              <span>{compactName(c.name, c.area)}</span>
            </li>
          ))}
          {shown < chores.length && <li className="cal-more">+ {chores.length - shown} more</li>}
        </ul>
      )}
      {free && <span className="cal-free hollow">Free day!</span>}
    </div>
  );
}

/** The month's seasonal scene with the person's avatar, then with the kid, then the everyday banner, then doodles. */
function Banner({ month0, avatar }: { month0: number; avatar?: string }) {
  const base = `${import.meta.env.BASE_URL}coloring`;
  const month = `months/${String(month0 + 1).padStart(2, '0')}.png`;
  const urls = [`${base}/${month}`, `${base}/banner.png`];
  if (avatar && avatar !== DEFAULT_AVATAR) urls.unshift(`${base}/avatars/${avatar}/${month}`);
  const [tries, setTries] = useState(0);
  if (tries >= urls.length) return <Doodles />;
  return <img key={urls[tries]} className="banner" src={urls[tries]} alt="" onError={() => setTries((t) => t + 1)} />;
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
