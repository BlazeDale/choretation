import { addDays, completion, monthBounds, projectMonth } from './rotation';
import type { Chore, ChoreTurn, HistoryEntry, Member, MonthRecord, PlannedChore } from './types';

export const monthKey = (date: string) => date.slice(0, 7);

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return monthKey(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`);
}

function boundsOf(month: string) {
  const [y, m] = month.split('-').map(Number);
  return monthBounds(y, m - 1);
}

const byDateThenChore = (a: PlannedChore, b: PlannedChore) => a.date.localeCompare(b.date) || a.choreId.localeCompare(b.choreId);

/**
 * This month's plan as of today: days already past stay exactly as they were, today onward follows
 * the live rotation. An overdue chore keeps its original day rather than being re-added to each new day.
 */
export function planMonth(
  chores: Chore[],
  members: Member[],
  existing: PlannedChore[],
  today: string,
  dailyLimit: number,
): PlannedChore[] {
  const [y, m] = monthKey(today).split('-').map(Number);
  const past = existing.filter((p) => p.date < today);
  const byId = new Map(chores.map((c) => [c.id, c]));
  const ahead = projectMonth(chores, members, y, m - 1, today, dailyLimit).flatMap((o): PlannedChore[] => {
    const c = byId.get(o.choreId)!;
    const stillWaiting = o.date === today && c.nextDue < today && past.some((p) => p.choreId === c.id && p.date >= c.nextDue);
    return stillWaiting ? [] : [{ choreId: c.id, name: c.name, area: c.area, minutes: c.minutes, date: o.date, memberId: o.memberId }];
  });
  return [...past, ...ahead].sort(byDateThenChore);
}

export interface MonthClosing {
  /** Every month closed here, in order: their plans are final from now on. */
  months: MonthRecord[];
  /** Chores that weren't ticked, counted as done on their planned dates. */
  history: HistoryEntry[];
  patches: Array<[string, Partial<Chore>]>;
}

/**
 * Closes every month that has ended. A chore still waiting at the end of its month is counted as done
 * on the day it was planned, by whoever it was planned for, and carries on from that date, so its
 * cadence holds whether or not it was ticked in the app (the paper charts don't tick anything).
 * Starts after the last closed month; a household with no records yet has nothing to close.
 */
export function closeMonths(
  chores: Chore[],
  members: Member[],
  records: MonthRecord[],
  today: string,
  dailyLimit: number,
): MonthClosing {
  const result: MonthClosing = { months: [], history: [], patches: [] };
  if (!records.length || !members.length) return result;
  const open = records.filter((r) => !r.closed).map((r) => r.month).sort();
  const closed = records.filter((r) => r.closed).map((r) => r.month).sort();
  const after = closed.length ? nextMonth(closed[closed.length - 1]) : null;
  const start = [open[0], after].filter((m): m is string => !!m).sort()[0];

  const sim: Chore[] = chores.filter((c) => c.active).map((c) => ({ ...c }));
  const touched = new Set<string>();
  const thisMonth = monthKey(today);

  for (let month = start; month < thisMonth; month = nextMonth(month)) {
    const record = records.find((r) => r.month === month);
    const planned = record?.planned ?? [];
    const { first, last } = boundsOf(month);
    // One left over from before this month goes on the day this month's plan gave it, or the 1st.
    const dueOf = (c: Chore) =>
      c.nextDue >= first ? c.nextDue : (planned.filter((p) => p.choreId === c.id).map((p) => p.date).sort()[0] ?? first);

    for (let d = first; d <= last; d = addDays(d, 1)) {
      for (const c of sim) {
        if (dueOf(c) !== d) continue;
        const by = planned.find((p) => p.choreId === c.id && p.date === d)?.memberId ?? c.assigneeId;
        if (!by) continue; // Nobody to credit, so it stays visibly waiting.
        result.history.push({
          id: `assumed_${c.id}_${d}`,
          choreId: c.id,
          choreName: c.name,
          area: c.area,
          memberId: by,
          minutes: c.minutes,
          date: d,
          at: new Date(`${d}T12:00`).getTime(),
          assumed: true,
        });
        Object.assign(c, completion(c, sim, members, by, d, dailyLimit));
        touched.add(c.id);
      }
    }
    result.months.push({ month, planned, closed: true });
  }

  for (const c of sim) {
    if (touched.has(c.id)) {
      result.patches.push([c.id, { nextDue: c.nextDue, assigneeId: c.assigneeId, lastDone: c.lastDone, lastDoneBy: c.lastDoneBy }]);
    }
  }
  return result;
}

export type LogStatus = 'ticked' | 'assumed' | 'waiting';

export interface LogItem {
  choreId: string;
  name: string;
  area: string;
  minutes: number;
  date: string;
  memberId: string | null;
  status: LogStatus;
}

/**
 * What happened on the days before today: everything completed, plus anything planned that hasn't been.
 * A late tick replaces the plan it fulfils, so a chore planned on the 20th and ticked on the 22nd shows once.
 */
export function monthLog(planned: PlannedChore[], history: HistoryEntry[], today: string): LogItem[] {
  const waiting = planned.filter((p) => p.date < today);
  const items: LogItem[] = [];
  for (const e of [...history].sort((a, b) => a.date.localeCompare(b.date)).filter((h) => h.date < today)) {
    const plan = waiting.filter((p) => p.choreId === e.choreId && p.date <= e.date).pop();
    if (plan) waiting.splice(waiting.indexOf(plan), 1);
    items.push({
      choreId: e.choreId,
      name: e.choreName,
      area: e.area ?? plan?.area ?? '',
      minutes: e.minutes,
      date: e.date,
      memberId: e.memberId,
      status: e.assumed ? 'assumed' : 'ticked',
    });
  }
  return [...items, ...waiting.map((p): LogItem => ({ ...p, status: 'waiting' }))];
}

/** History is kept until the longest chore period has passed, so even the rarest chore's last turn stays on record. */
export function keepSince(chores: Pick<Chore, 'everyDays'>[], today: string): string | null {
  if (!chores.length) return null;
  return addDays(today, -Math.max(...chores.map((c) => c.everyDays)));
}

/** Months that have entirely fallen off. */
export function expiredMonths(records: Pick<MonthRecord, 'month'>[], since: string): string[] {
  return records.map((r) => r.month).filter((m) => boundsOf(m).last < since);
}

/**
 * Which ticks can still be undone: each chore's latest one, if it was really ticked and is from this
 * month. Closed months are final. `entries` is newest first.
 */
export function undoableEntries(entries: HistoryEntry[], chores: Pick<Chore, 'id'>[], today: string): Set<string> {
  const out = new Set<string>();
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.choreId)) continue;
    seen.add(e.choreId);
    if (!e.assumed && monthKey(e.date) === monthKey(today) && chores.some((c) => c.id === e.choreId)) out.add(e.id);
  }
  return out;
}

/**
 * How a chore goes back to before a tick. Ticks that didn't save their "before" get it worked out: one
 * period back from its next date, and last done from the tick before (`previous`), if there was one.
 */
export function undoPatch(entry: HistoryEntry, chore: Pick<Chore, 'nextDue' | 'everyDays'>, previous?: HistoryEntry): ChoreTurn {
  return (
    entry.before ?? {
      nextDue: addDays(chore.nextDue, -chore.everyDays),
      assigneeId: entry.memberId,
      lastDone: previous?.date ?? null,
      lastDoneBy: previous?.memberId ?? null,
    }
  );
}

export const samePlan =(a: PlannedChore[], b: PlannedChore[]) => JSON.stringify(a) === JSON.stringify(b);
