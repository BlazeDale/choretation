import { describe, expect, it } from 'vitest';
import { closeMonths, expiredMonths, keepSince, monthLog, planMonth } from './ledger';
import { addDays, daysUntil, redistribute } from './rotation';
import type { Chore, HistoryEntry, Member, MonthRecord, PlannedChore } from './types';

const members: Member[] = [
  { id: 'a', name: 'Ann' },
  { id: 'b', name: 'Bo' },
];
const LIMIT = 60;

const chore = (id: string, everyDays: number, nextDue: string, extra: Partial<Chore> = {}): Chore => ({
  id,
  key: id,
  name: `Chore ${id}`,
  area: 'Kitchen',
  minutes: 15,
  everyDays,
  weekday: null,
  assigneeId: 'a',
  nextDue,
  lastDone: null,
  lastDoneBy: null,
  active: true,
  ...extra,
});

const plan = (choreId: string, date: string, memberId: string | null = 'a'): PlannedChore => ({
  choreId,
  name: `Chore ${choreId}`,
  area: 'Kitchen',
  minutes: 15,
  date,
  memberId,
});

const done = (choreId: string, date: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: `${choreId}${date}`,
  choreId,
  choreName: `Chore ${choreId}`,
  memberId: 'a',
  minutes: 15,
  date,
  at: 0,
  ...extra,
});

const open = (month: string, planned: PlannedChore[] = []): MonthRecord => ({ month, planned, closed: false });

describe('planMonth', () => {
  it('never changes days already past, whatever the rotation does now', () => {
    const before = [plan('gone', '2026-11-02', 'b'), plan('x', '2026-11-03', 'b'), plan('x', '2026-11-20', 'b')];
    const out = planMonth([chore('x', 30, '2026-11-25')], members, before, '2026-11-10', LIMIT);
    expect(out.filter((p) => p.date < '2026-11-10')).toEqual(before.slice(0, 2));
    expect(out.filter((p) => p.date >= '2026-11-10').map((p) => p.date)).toEqual(['2026-11-25']);
  });

  it('keeps an overdue chore on its original day instead of adding it to every day since', () => {
    const c = chore('x', 180, '2026-11-05');
    let planned: PlannedChore[] = [];
    for (let d = '2026-11-04'; d <= '2026-11-12'; d = addDays(d, 1)) planned = planMonth([c], members, planned, d, LIMIT);
    expect(planned.map((p) => p.date)).toEqual(['2026-11-05']);
  });

  it('plans an already-overdue chore on the first day it is seen', () => {
    const out = planMonth([chore('x', 180, '2026-10-01')], members, [], '2026-11-02', LIMIT);
    expect(out.map((p) => p.date)).toEqual(['2026-11-02']);
  });
});

describe('closeMonths', () => {
  it('does nothing before there are any records, so old overdue chores are not assumed done', () => {
    const out = closeMonths([chore('x', 180, '2026-09-01')], members, [], '2026-11-02', LIMIT);
    expect(out).toEqual({ months: [], history: [], patches: [] });
  });

  it('does nothing while the month is still running', () => {
    const out = closeMonths([chore('x', 180, '2026-11-05')], members, [open('2026-11')], '2026-11-30', LIMIT);
    expect(out.months).toEqual([]);
    expect(out.history).toEqual([]);
  });

  it('counts an unticked chore as done on its planned date, by its planned person', () => {
    const c = chore('x', 180, '2026-11-05');
    const out = closeMonths([c], members, [open('2026-11', [plan('x', '2026-11-05', 'b')])], '2026-12-01', LIMIT);
    expect(out.history).toMatchObject([{ id: 'assumed_x_2026-11-05', memberId: 'b', date: '2026-11-05', assumed: true }]);
    const [[, patch]] = out.patches;
    expect(patch.lastDone).toBe('2026-11-05');
    expect(daysUntil(patch.nextDue!, '2026-11-05')).toBe(180);
    expect(out.months).toMatchObject([{ month: '2026-11', closed: true }]);
  });

  it('leaves chores that moved on, and those due later, alone', () => {
    const out = closeMonths(
      [chore('ticked', 180, '2027-05-01', { lastDone: '2026-11-02' }), chore('later', 30, '2026-12-15')],
      members,
      [open('2026-11', [plan('ticked', '2026-11-02')])],
      '2026-12-01',
      LIMIT,
    );
    expect(out.history).toEqual([]);
    expect(out.patches).toEqual([]);
  });

  it('counts every turn of a frequent chore in the month', () => {
    const out = closeMonths([chore('x', 7, '2026-11-03')], members, [open('2026-11')], '2026-12-01', LIMIT);
    expect(out.history.map((h) => h.date)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
    expect(out.patches[0][1].nextDue).toBe('2026-12-01');
  });

  it('holds a six-month cadence through months of nothing ever being ticked', () => {
    let chores = [chore('x', 180, '2026-11-10'), chore('y', 7, '2026-11-02')];
    let records: MonthRecord[] = [];
    const dates: string[] = [];
    for (let today = '2026-11-02'; today < '2028-01-01'; today = addDays(today, 1)) {
      const out = closeMonths(chores, members, records, today, LIMIT);
      const patches = new Map(out.patches);
      chores = chores.map((c) => ({ ...c, ...patches.get(c.id) }));
      records = [...records.filter((r) => !out.months.some((m) => m.month === r.month)), ...out.months];
      dates.push(...out.history.filter((h) => h.choreId === 'x').map((h) => h.date));
      const month = today.slice(0, 7);
      const existing = records.find((r) => r.month === month);
      const planned = planMonth(chores, members, existing?.planned ?? [], today, LIMIT);
      records = [...records.filter((r) => r.month !== month), { month, planned, closed: false }];
    }
    expect(dates.length).toBeGreaterThanOrEqual(2);
    expect(dates[0]).toBe('2026-11-10');
    for (let i = 1; i < dates.length; i++) expect(daysUntil(dates[i], dates[i - 1])).toBe(180);
  });

  it('never changes the plan of a month it closes', () => {
    const planned = [plan('x', '2026-11-05', 'b')];
    const out = closeMonths([chore('x', 180, '2026-11-05')], members, [open('2026-11', planned)], '2026-12-01', LIMIT);
    expect(out.months[0].planned).toEqual(planned);
  });

  it('closes a skipped month too, when nobody opened the app for all of it', () => {
    const out = closeMonths([chore('x', 45, '2026-11-20')], members, [open('2026-11')], '2027-01-05', LIMIT);
    expect(out.months.map((m) => m.month)).toEqual(['2026-11', '2026-12']);
    expect(out.history.map((h) => h.date)).toEqual(['2026-11-20']);
    expect(out.patches[0][1].nextDue).toBe('2027-01-04');
  });

  it('gives the same result when an interrupted close repeats', () => {
    const c = chore('x', 7, '2026-11-03');
    const once = closeMonths([c], members, [open('2026-11')], '2026-12-01', LIMIT);
    const again = closeMonths([c], members, [open('2026-11')], '2026-12-01', LIMIT);
    expect(again.history.map((h) => h.id)).toEqual(once.history.map((h) => h.id));
  });

  it('skips turned-off chores', () => {
    const out = closeMonths([chore('x', 7, '2026-11-03', { active: false })], members, [open('2026-11')], '2026-12-01', LIMIT);
    expect(out.history).toEqual([]);
  });
});

describe('monthLog', () => {
  it('shows a late tick once, on the day it was done', () => {
    const log = monthLog([plan('x', '2026-11-20')], [done('x', '2026-11-22')], '2026-11-25');
    expect(log).toMatchObject([{ date: '2026-11-22', status: 'ticked', area: 'Kitchen' }]);
  });

  it('marks what is planned and unticked, and what was counted as done', () => {
    const log = monthLog(
      [plan('x', '2026-11-20'), plan('y', '2026-11-21')],
      [done('y', '2026-11-21', { assumed: true })],
      '2026-11-25',
    );
    expect(log.map((i) => [i.choreId, i.status])).toEqual([
      ['y', 'assumed'],
      ['x', 'waiting'],
    ]);
  });

  it('leaves today and later to the live rotation', () => {
    expect(monthLog([plan('x', '2026-11-25')], [done('y', '2026-11-25')], '2026-11-25')).toEqual([]);
  });

  it('keeps showing a deleted chore, from its copied details', () => {
    expect(monthLog([plan('gone', '2026-11-20')], [], '2026-11-25')[0].name).toBe('Chore gone');
  });
});

describe('falling off', () => {
  it('keeps everything until the longest chore period has passed', () => {
    expect(keepSince([chore('a', 7, ''), chore('b', 365, '')], '2026-11-02')).toBe('2025-11-02');
  });

  it('keeps nothing-to-go-on safe: no chores means no cutoff', () => {
    expect(keepSince([], '2026-11-02')).toBeNull();
  });

  it('only drops months that ended before the cutoff', () => {
    expect(expiredMonths([{ month: '2025-10' }, { month: '2025-11' }, { month: '2026-10' }], '2025-11-02')).toEqual(['2025-10']);
  });
});

describe('redistribute keeps rare chores on cadence', () => {
  const today = '2026-11-02';
  const others = Array.from({ length: 20 }, (_, i) => chore(`w${i}`, 7, today, { minutes: 20 }));

  it('leaves a six-month chore near when it is really due', () => {
    const all = [...others, ...[0, 1, 2, 3].map((i) => chore(`six${i}`, 180, addDays(today, 170), { lastDone: addDays(today, -10), minutes: 45 }))];
    const moved = new Map(redistribute(all, members, LIMIT, today));
    for (const i of [0, 1, 2, 3]) {
      const c = all.find((x) => x.id === `six${i}`)!;
      const gap = 10 + daysUntil(moved.get(c.id)?.nextDue ?? c.nextDue, today);
      expect(Math.abs(gap - 180)).toBeLessThanOrEqual(14);
    }
  });

  it('brings an overdue six-month chore up soon, not months away', () => {
    const c = chore('six', 180, addDays(today, -30), { lastDone: addDays(today, -210) });
    const moved = new Map(redistribute([...others, c], members, LIMIT, today));
    expect(daysUntil(moved.get('six')?.nextDue ?? c.nextDue, today)).toBeLessThanOrEqual(14);
  });

  it('restores the cadence of a rare chore an earlier press knocked out', () => {
    const c = chore('six', 180, addDays(today, 100), { lastDone: addDays(today, -10) });
    const next = new Map(redistribute([...others, c], members, LIMIT, today)).get('six')?.nextDue;
    expect(Math.abs(daysUntil(next!, today) - 170)).toBeLessThanOrEqual(14);
  });

  it('keeps a chore not done yet within half a period, however often it is pressed', () => {
    let all = [...others, chore('six', 180, addDays(today, 60), { minutes: 45 })];
    for (let i = 0; i < 5; i++) {
      const moved = new Map(redistribute(all, members, LIMIT, today));
      all = all.map((c) => ({ ...c, ...moved.get(c.id) }));
      expect(daysUntil(all.find((c) => c.id === 'six')!.nextDue, today)).toBeLessThanOrEqual(90);
    }
  });

  it('keeps a done chore on cadence however often it is pressed', () => {
    let all = [...others, chore('six', 180, addDays(today, 170), { lastDone: addDays(today, -10), minutes: 45 })];
    for (let i = 0; i < 5; i++) {
      const moved = new Map(redistribute(all, members, LIMIT, today));
      all = all.map((c) => ({ ...c, ...moved.get(c.id) }));
      expect(Math.abs(daysUntil(all.find((c) => c.id === 'six')!.nextDue, today) - 170)).toBeLessThanOrEqual(14);
    }
  });
});
