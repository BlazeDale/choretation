import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME, generateChores } from './generator';
import { completion, coverFreeDays, projectMonth, rebalance, redistribute, scheduleNew } from './rotation';
import type { Chore, Member } from './types';

const today = '2026-10-14'; // a Wednesday
const members: Member[] = [
  { id: 'c', name: 'Charlotte', freeDays: [3, 6] },
  { id: 'w', name: 'Partner' },
];
const weekday = (d: string) => new Date(`${d}T12:00`).getDay();

// Charlotte's chores were fixed to her before a second person joined; the rest rotate.
function household(): Chore[] {
  return scheduleNew(generateChores(DEFAULT_HOME, 2), [], [members[0]], today).map((c, i) => ({
    ...c,
    id: String(i),
    ...(i % 3 === 0 && { owner: 'c', assigneeId: 'c' }),
  }));
}

describe('chores fixed to one person', () => {
  it('stay theirs through redistribute, rebalance and completion', () => {
    const all = household();
    const fixed = all.filter((c) => c.owner === 'c');
    const moved = new Map(redistribute(all, members, 60, today));
    for (const c of fixed) expect(moved.get(c.id)?.assigneeId ?? c.assigneeId).toBe('c');
    for (const [id] of rebalance(all, members)) expect(fixed.map((c) => c.id)).not.toContain(id);
    for (const c of fixed) expect(completion(c, all, members, 'c', today).assigneeId).toBe('c');
  });

  it('only rotating chores are shared with the new person', () => {
    const all = household();
    const moved = new Map(redistribute(all, members, 60, today));
    const toPartner = all.filter((c) => (moved.get(c.id)?.assigneeId ?? c.assigneeId) === 'w');
    expect(toPartner.length).toBeGreaterThan(0);
    expect(toPartner.every((c) => !c.owner)).toBe(true);
  });

  it("wait for the owner's next working day instead of going to someone else", () => {
    const all = household();
    const chore = { ...all.find((c) => c.owner === 'c' && c.everyDays === 7)!, nextDue: '2026-10-17' }; // Saturday
    expect(coverFreeDays([chore], members, 60, today)).toEqual([[chore.id, { nextDue: '2026-10-18' }]]);
    const next = completion({ ...chore, nextDue: '2026-10-13' }, all, members, 'c', '2026-10-13'); // Tue + 7 = Tue
    expect(next).toMatchObject({ assigneeId: 'c', nextDue: '2026-10-20' });
    const nov = projectMonth(all, members, 2026, 10, today);
    const hers = nov.filter((o) => all.find((c) => c.id === o.choreId)!.owner === 'c');
    expect(hers.every((o) => o.memberId === 'c' && ![3, 6].includes(weekday(o.date)))).toBe(true);
  });
});
