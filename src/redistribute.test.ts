import { expect, it } from 'vitest';
import { addDays, projectMonth, redistribute, weekdayOf } from './rotation';
import type { Chore, Member } from './types';

// A real household's chores: one person, free Wednesdays and Saturdays, 60-minute limit, 14 Oct 2026.
// Redistributing used to pile its monthly and quarterly chores onto two days (175 minutes each).
const ROWS: Array<[string, number, number, number | null, string]> = [
  ['Wash interior windows 2', 25, 90, null, '10-15'], ['Scrub shower', 30, 14, null, '10-26'], ['Sweep porch', 15, 14, null, '10-16'],
  ['Wash interior windows 1', 25, 90, null, '10-15'], ['Disinfect switches', 15, 14, null, '10-19'], ['Clean Bathroom', 30, 7, null, '10-15'],
  ['Dust shelves entry', 30, 30, null, '10-16'], ['Shampoo stair carpet', 45, 365, null, '10-23'], ['Deep clean Bathroom', 75, 90, null, '10-15'],
  ['Bins to curb', 10, 7, null, '10-20'], ['Trash/Recycling', 10, 14, 1, '10-19'], ['Dust shelves dining', 20, 30, null, '10-16'],
  ['Dust corners floor 1', 15, 60, null, '10-22'], ['Tidy shoes', 5, 14, null, '10-20'], ['Vacuum stairs 2', 20, 7, null, '10-18'],
  ['Mop floor 1', 20, 14, null, '10-15'], ['Clean gutters', 90, 180, null, '11-05'], ['Trash', 10, 14, 1, '10-26'],
  ['Sweep and mop stairs', 20, 7, null, '10-20'], ['Dust baseboards 1', 20, 60, null, '11-01'], ['Wipe handrail 1', 20, 30, null, '10-16'],
  ['Wipe table dining', 15, 7, null, '10-18'], ['Empty small trash', 10, 7, null, '10-16'], ['Wipe handrail 2', 20, 30, null, '10-16'],
  ['Mop floor 2', 20, 14, null, '10-27'], ['Vacuum floor 1', 20, 7, null, '10-16'], ['Replace HVAC filter', 10, 90, null, '10-16'],
  ['Dust baseboards 2', 20, 60, null, '11-29'], ['Test smoke detectors', 15, 180, null, '11-19'], ['Vacuum floor 2', 20, 7, null, '10-19'],
  ['Wash bath mats', 15, 30, null, '10-16'], ['Wipe walls hallway', 15, 30, null, '10-16'],
];
const today = '2026-10-14';
const members: Member[] = [{ id: 'c', name: 'Charlotte', freeDays: [3, 6] }];
const chores: Chore[] = ROWS.map(([name, minutes, everyDays, weekday, due], i) => ({
  id: String(i), key: '', area: 'x', name, minutes, everyDays, weekday,
  nextDue: `2026-${due}`, assigneeId: 'c', lastDone: null, lastDoneBy: null, active: true,
}));

function dailyLoads(cs: Chore[], days: number) {
  const totals = new Map<string, number>();
  for (const [y, m] of [[2026, 9], [2026, 10], [2026, 11]] as const)
    for (const o of projectMonth(cs, members, y, m, today, 60))
      if (o.date < addDays(today, days)) totals.set(o.date, (totals.get(o.date) ?? 0) + cs.find((c) => c.id === o.choreId)!.minutes);
  return totals;
}

it('spreads her real chores across working days after redistributing', () => {
  const moved = new Map(redistribute(chores, members, 60, today));
  const after = chores.map((c) => ({ ...c, ...moved.get(c.id) }));
  const loads = dailyLoads(after, 28);

  for (const [d] of loads) expect([3, 6]).not.toContain(weekdayOf(d));
  // Her limit is 60; only a single chore longer than that (the 75-minute deep clean) may exceed it.
  expect(Math.max(...loads.values())).toBeLessThanOrEqual(75);
});
