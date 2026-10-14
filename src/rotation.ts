import type { Chore, ChoreDraft, Member, NewChore } from './types';

export function todayStr(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export const weekdayOf = (date: string) => parseDate(date).getDay();

/** First date on or after `from` that falls on `weekday`. */
export const nextWeekday = (from: string, weekday: number) => addDays(from, (weekday - weekdayOf(from) + 7) % 7);

const pinned = (c: Pick<ChoreDraft, 'weekday'>) => c.weekday != null;

/**
 * Next due date after a chore is done. Pinned chores step from their own due date so they keep
 * their weekday and week (every other Monday stays on its Mondays) even when done late or early.
 */
function nextDueAfter(c: Pick<Chore, 'nextDue' | 'everyDays' | 'weekday'>, today: string): string {
  if (!pinned(c)) return addDays(today, c.everyDays);
  let next = addDays(c.nextDue, c.everyDays);
  while (next <= today) next = addDays(next, c.everyDays);
  return next;
}

/** Who can take a chore on `date`: everyone not having a free day then (or everyone, if all are free). */
export function availableOn(members: Member[], date: string): Member[] {
  const day = weekdayOf(date);
  const free = members.filter((m) => !m.freeDays?.includes(day));
  return free.length ? free : members;
}

const everyoneFree = (members: Member[], date: string) =>
  members.length > 0 && members.every((m) => m.freeDays?.includes(weekdayOf(date)));

/** `date`, or the first day after it when someone is around (not everyone on a free day). */
export function nextWorkingDay(members: Member[], date: string): string {
  for (let i = 0; i < 7; i++) {
    const d = addDays(date, i);
    if (!everyoneFree(members, d)) return d;
  }
  return date;
}

/** Negative when overdue. */
export function daysUntil(date: string, today = todayStr()): number {
  return Math.round((parseDate(date).getTime() - parseDate(today).getTime()) / 86_400_000);
}

/** Average minutes per week a chore costs. This is what gets balanced across people. */
export const weeklyMinutes = (c: Pick<ChoreDraft, 'minutes' | 'everyDays'>) => (c.minutes * 7) / c.everyDays;

type Assignable = Pick<Chore, 'assigneeId' | 'minutes' | 'everyDays' | 'active'>;

export function memberLoads(chores: Assignable[], members: Member[]): Map<string, number> {
  const load = new Map(members.map((m) => [m.id, 0]));
  for (const c of chores) {
    if (c.active && c.assigneeId && load.has(c.assigneeId)) {
      load.set(c.assigneeId, load.get(c.assigneeId)! + weeklyMinutes(c));
    }
  }
  return load;
}

/** Default cap on chore minutes per person per day, used when spreading chores across days. */
export const DEFAULT_DAILY_LIMIT = 60;

/** Average chore minutes per person on the days they're working (free days excluded), if shared evenly. */
export function averageDailyMinutes(chores: Assignable[], members: Member[]) {
  const weekly = chores.filter((c) => c.active).reduce((s, c) => s + weeklyMinutes(c), 0);
  const personDays = members.reduce((s, m) => s + 7 - (m.freeDays?.length ?? 0), 0);
  return weekly / Math.max(1, personDays);
}

/** Minutes each member already has due on `date`. */
export function dayLoads(chores: Array<Assignable & Pick<Chore, 'nextDue'>>, members: Member[], date: string) {
  const load = new Map(members.map((m) => [m.id, 0]));
  for (const c of chores) {
    if (c.active && c.nextDue === date && c.assigneeId && load.has(c.assigneeId)) {
      load.set(c.assigneeId, load.get(c.assigneeId)! + c.minutes);
    }
  }
  return load;
}

/** When given, prefer people who stay within `limit` minutes on the chore's due day. */
interface DayFit {
  day: Map<string, number>;
  minutes: number;
  limit: number;
}

/** Least-loaded member, skipping `exclude` (whoever just did it) when anyone else is available. */
export function pickAssignee(load: Map<string, number>, members: Member[], exclude?: string | null, fit?: DayFit): string | null {
  let pool = exclude && members.length > 1 ? members.filter((m) => m.id !== exclude) : members;
  if (fit) {
    const fits = pool.filter((m) => (fit.day.get(m.id) ?? 0) + fit.minutes <= fit.limit);
    if (fits.length) pool = fits;
  }
  let best: string | null = null;
  let bestLoad = Infinity;
  for (const m of pool) {
    const l = load.get(m.id) ?? 0;
    if (l < bestLoad) {
      best = m.id;
      bestLoad = l;
    }
  }
  return best;
}

const GOLDEN = 0.6180339887;

/**
 * Turns drafts into scheduled chores: assigns them greedily (heaviest first) to whoever has
 * the least weekly load, and staggers first due dates across each chore's period so
 * everything doesn't land on day one.
 */
export function scheduleNew(drafts: ChoreDraft[], existing: Chore[], members: Member[], today = todayStr()): NewChore[] {
  const load = memberLoads(existing, members);
  const order = drafts.map((d, i) => ({ d, i })).sort((a, b) => weeklyMinutes(b.d) - weeklyMinutes(a.d));
  const result: NewChore[] = new Array(drafts.length);
  for (const { d, i } of order) {
    const offset = d.everyDays > 1 ? Math.floor(((i * GOLDEN) % 1) * d.everyDays) : 0;
    const nextDue = pinned(d) ? nextWeekday(today, d.weekday!) : nextWorkingDay(members, addDays(today, offset));
    const assigneeId = pickAssignee(load, availableOn(members, nextDue));
    if (assigneeId) load.set(assigneeId, (load.get(assigneeId) ?? 0) + weeklyMinutes(d));
    result[i] = { ...d, weekday: d.weekday ?? null, assigneeId, nextDue, lastDone: null, lastDoneBy: null, active: true };
  }
  return result;
}

/** What changes when `doneBy` completes a chore: next due date and the next person in rotation. */
export function completion(
  chore: Chore,
  all: Chore[],
  members: Member[],
  doneBy: string,
  today = todayStr(),
  dailyLimit = DEFAULT_DAILY_LIMIT,
) {
  const others = all.filter((c) => c.id !== chore.id);
  // When nobody's around that day (e.g. a one-person home on its day off), move to the next day someone is.
  const nextDue = pinned(chore) ? nextDueAfter(chore, today) : nextWorkingDay(members, nextDueAfter(chore, today));
  const fit = { day: dayLoads(others, members, nextDue), minutes: chore.minutes, limit: dailyLimit };
  return {
    nextDue,
    assigneeId: pickAssignee(memberLoads(others, members), availableOn(members, nextDue), doneBy, fit),
    lastDone: today,
    lastDoneBy: doneBy,
  };
}

const isFree = (members: Member[], id: string | null, date: string) =>
  !!members.find((m) => m.id === id)?.freeDays?.includes(weekdayOf(date));

/**
 * Keeps chores off people's free days. A chore due on its assignee's free day goes to someone who's
 * around; if nobody is (everyone's off, or it's a one-person home), it moves to the next day
 * someone is, unless it's pinned to that weekday. Overdue chores count as due today, since that's
 * when they still need doing. Returns only the chores that change.
 */
export function coverFreeDays(
  all: Chore[],
  members: Member[],
  dailyLimit = DEFAULT_DAILY_LIMIT,
  today = todayStr(),
): Array<[string, Partial<Pick<Chore, 'assigneeId' | 'nextDue'>>]> {
  const chores = all.map((c) => ({ ...c }));
  const changes: Array<[string, Partial<Pick<Chore, 'assigneeId' | 'nextDue'>>]> = [];
  for (const c of chores) {
    if (!c.active) continue;
    const patch: Partial<Pick<Chore, 'assigneeId' | 'nextDue'>> = {};
    let due = c.nextDue < today ? today : c.nextDue;
    if (!pinned(c) && everyoneFree(members, due)) {
      due = nextWorkingDay(members, due);
      patch.nextDue = c.nextDue = due;
    }
    if (isFree(members, c.assigneeId, due)) {
      const others = chores.filter((x) => x.id !== c.id);
      const fit = { day: dayLoads(others, members, due), minutes: c.minutes, limit: dailyLimit };
      const id = pickAssignee(memberLoads(others, members), availableOn(members, due), null, fit);
      if (id && id !== c.assigneeId) patch.assigneeId = c.assigneeId = id;
    }
    if (Object.keys(patch).length) changes.push([c.id, patch]);
  }
  return changes;
}

export interface Occurrence {
  choreId: string;
  date: string;
  memberId: string | null;
}

export function monthBounds(year: number, month0: number) {
  return { first: todayStr(new Date(year, month0, 1)), last: todayStr(new Date(year, month0 + 1, 0)) };
}

/**
 * Predicts who does what on each day of a month, for the printable chart. Simulates the
 * rotation from today, assuming every chore is done on its due date by its assignee
 * (overdue chores land on today). Days already past are left empty.
 */
export function projectMonth(
  chores: Chore[],
  members: Member[],
  year: number,
  month0: number,
  today = todayStr(),
  dailyLimit = DEFAULT_DAILY_LIMIT,
): Occurrence[] {
  const { first, last } = monthBounds(year, month0);
  const sim: Chore[] = chores.filter((c) => c.active).map((c) => ({ ...c }));
  // Chores already sitting on someone's free day go to whoever would cover them.
  for (const [id, patch] of coverFreeDays(sim, members, dailyLimit, today)) Object.assign(sim.find((c) => c.id === id)!, patch);

  const out: Occurrence[] = [];
  for (let d = today; d <= last; d = addDays(d, 1)) {
    for (const c of sim) {
      if (c.nextDue > d) continue;
      if (d >= first) out.push({ choreId: c.id, date: d, memberId: c.assigneeId });
      Object.assign(c, completion(c, sim, members, c.assigneeId ?? '', d, dailyLimit));
    }
  }
  return out;
}

/** Reassigns every active chore from scratch. Returns only the chores whose assignee changes. */
export function rebalance(all: Chore[], members: Member[]): Array<[string, string | null]> {
  const load = new Map(members.map((m) => [m.id, 0]));
  const changes: Array<[string, string | null]> = [];
  const active = all.filter((c) => c.active).sort((a, b) => weeklyMinutes(b) - weeklyMinutes(a));
  for (const c of active) {
    const id = pickAssignee(load, availableOn(members, c.nextDue));
    if (id) load.set(id, load.get(id)! + weeklyMinutes(c));
    if (id !== c.assigneeId) changes.push([c.id, id]);
  }
  return changes;
}

const HORIZON = 365;
/** Days ahead where a pile-up is weighted most, since that's what people see first. */
const NEAR = 28;

/**
 * Re-plans due dates and assignees so chores spread evenly across days. Each chore keeps its
 * frequency and is due within one period from today; chores pinned to a weekday keep their dates.
 * People's free days lower that day's capacity, and nobody is given a chore on their free day. Chores are placed on the offset that keeps
 * the busiest of its days lowest (most constrained first), aiming to keep the household under
 * `dailyLimit` per person; then each is given to whoever stays under the limit that day with the
 * least weekly load. Returns only the chores that change.
 */
export function redistribute(
  all: Chore[],
  members: Member[],
  dailyLimit: number,
  today = todayStr(),
): Array<[string, Pick<Chore, 'nextDue' | 'assigneeId'>]> {
  const active = all.filter((c) => c.active);
  // How much the household can take on each day, counting only people not on a free day.
  const firstWeekday = weekdayOf(today);
  const capByWeekday = Array.from(
    { length: 7 },
    (_, w) => dailyLimit * members.filter((m) => !m.freeDays?.includes(w)).length,
  );
  const cap = (d: number) => capByWeekday[(firstWeekday + d) % 7];
  // Where a repeat really happens: one falling on a day nobody's around moves to the next day someone is.
  const land = (d: number) => {
    for (let x = d; x < Math.min(HORIZON, d + 7); x++) if (cap(x)) return x;
    return d;
  };
  const total = new Array<number>(HORIZON).fill(0);
  const offsets = new Map<string, number>();

  // Pinned chores stay put; place them first so everything else works around them.
  for (const c of active.filter(pinned)) {
    const o = Math.max(0, daysUntil(c.nextDue, today));
    for (let d = o; d < HORIZON; d += c.everyDays) total[d] += c.minutes;
    offsets.set(c.id, o);
  }
  for (const c of [...active].filter((c) => !pinned(c)).sort((a, b) => a.everyDays - b.everyDays || b.minutes - a.minutes)) {
    const p = Math.max(1, c.everyDays);
    const current = Math.min(p - 1, Math.max(0, daysUntil(c.nextDue, today)));
    // The first date must be a day someone's around; later repeats get moved off free days as they come up.
    const starts = Array.from({ length: Math.min(p, HORIZON) }, (_, o) => o).filter((o) => cap(o));
    if (!starts.length) starts.push(land(0));
    let best = starts[0];
    let bestScore = Infinity;
    for (const o of starts) {
      let over = 0;
      let nearOver = 0;
      let sum = 0;
      let n = 0;
      for (let d = o; d < HORIZON; d += p, n++) {
        const x = d === o ? o : land(d);
        const after = total[x] + c.minutes;
        sum += after;
        over += Math.max(0, after - cap(x));
        if (x < NEAR) nearOver += Math.max(0, after - cap(x));
      }
      // Going over the limit in the next few weeks matters most, then over the year; then how busy its
      // first day and its days on average are; and a nudge to stay put avoids needless moves.
      const score = nearOver * 1000 + (over / n) * 1000 + total[o] + sum / n - (o === current ? 0.5 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    for (let d = best; d < HORIZON; d += p) total[d === best ? d : land(d)] += c.minutes;
    offsets.set(c.id, best);
  }

  const weekly = new Map(members.map((m) => [m.id, 0]));
  const byDay = new Map<string, Map<string, number>>();
  const changes: Array<[string, Pick<Chore, 'nextDue' | 'assigneeId'>]> = [];
  for (const c of [...active].sort((a, b) => weeklyMinutes(b) - weeklyMinutes(a))) {
    const nextDue = pinned(c) ? c.nextDue : addDays(today, offsets.get(c.id)!);
    const day = byDay.get(nextDue) ?? new Map<string, number>();
    byDay.set(nextDue, day);
    const assigneeId = pickAssignee(weekly, availableOn(members, nextDue), null, { day, minutes: c.minutes, limit: dailyLimit });
    if (assigneeId) {
      weekly.set(assigneeId, weekly.get(assigneeId)! + weeklyMinutes(c));
      day.set(assigneeId, (day.get(assigneeId) ?? 0) + c.minutes);
    }
    if (nextDue !== c.nextDue || assigneeId !== c.assigneeId) changes.push([c.id, { nextDue, assigneeId }]);
  }
  return changes;
}
