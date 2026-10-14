import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME, FEATURES, MAX_MINUTES, generateChores, makeRoom } from './generator';
import { addDays, completion, coverFreeDays, headsUps, daysUntil, memberLoads, projectMonth, rebalance, redistribute, scheduleNew } from './rotation';
import type { Chore, HomeConfig, Member, Room } from './types';

const big: HomeConfig = {
  homeType: 'house',
  floors: 3,
  yard: 'large',
  rooms: ([
    ['kitchen', 1], ['living', 1], ['dining', 1], ['halfBath', 1], ['entry', 1], ['garage', 1],
    ['bedroom', 2], ['bedroom', 2], ['bathroom', 2], ['bathroom', 2], ['office', 2],
    ['bedroom', 3], ['bedroom', 3], ['bedroom', 3], ['bathroom', 3], ['living', 3],
    ['basement', 0], ['playroom', 0],
  ] as const).reduce<Room[]>((rs, [t, l]) => [...rs, makeRoom(t, rs, l)], []),
  features: FEATURES.map(([k]) => k),
  pets: { dogs: 2, cats: 1, fishTanks: 1, birds: 1, smallPets: 2, chickens: 4 },
  vehicles: 2,
};
const members: Member[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
];

describe('generateChores', () => {
  it('never produces a chore longer than the max', () => {
    for (const home of [DEFAULT_HOME, big]) {
      for (const c of generateChores(home, 4)) expect(c.minutes).toBeLessThanOrEqual(MAX_MINUTES);
    }
  });

  it('splits oversized jobs into parts', () => {
    const mow = generateChores(big, 3).filter((c) => c.name.startsWith('Mow lawn'));
    expect(mow.map((c) => c.name)).toEqual(['Mow lawn (part 1 of 2)', 'Mow lawn (part 2 of 2)']);
  });

  it('gives every chore a unique key', () => {
    const keys = generateChores(big, 3).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('skips house-only chores for apartments', () => {
    const names = generateChores({ ...DEFAULT_HOME, homeType: 'apartment' }, 2).map((c) => c.name);
    expect(names).not.toContain('Clean gutters');
  });

  it('names rooms uniquely and keeps duplicate names apart', () => {
    const rooms = [makeRoom('bedroom', [])];
    rooms.push(makeRoom('bedroom', rooms));
    expect(rooms.map((r) => r.name)).toEqual(['Bedroom', 'Bedroom 2']);
    const clash = generateChores({ ...DEFAULT_HOME, rooms: [rooms[0], { ...rooms[1], name: 'Bedroom' }] }, 2);
    const keys = clash.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only mops levels with hard floors and shampoos levels with carpet', () => {
    const names = generateChores(big, 3).map((c) => c.name);
    expect(names).toContain('Mop hard floors - floor 1');
    expect(names).not.toContain('Shampoo carpets - floor 1');
    expect(names).toContain('Shampoo carpets - floor 2');
    expect(names).toContain('Vacuum stairs');
  });

  it('uses listed stairwells instead of the generic stairs job', () => {
    const rooms = [...big.rooms, makeRoom('stairwell', big.rooms, 1)];
    const names = generateChores({ ...big, rooms }, 3).map((c) => c.name);
    expect(names).toContain('Vacuum stairs & landing - Stairwell');
    expect(names).not.toContain('Vacuum stairs');
  });
});

describe('rotation', () => {
  const today = '2026-10-12';
  const scheduled = (): Chore[] =>
    scheduleNew(generateChores(big, 3), [], members, today).map((c, i) => ({ ...c, id: String(i) }));

  it('balances weekly load within a small margin', () => {
    const loads = [...memberLoads(scheduled(), members).values()];
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThan(30);
  });

  it('staggers first due dates within each period', () => {
    for (const c of scheduled()) {
      const d = daysUntil(c.nextDue, today);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(c.everyDays);
    }
  });

  it('passes a completed chore to someone else and reschedules it', () => {
    const all = scheduled();
    const chore = all.find((c) => c.everyDays === 1)!;
    const next = completion(chore, all, members, chore.assigneeId!, today);
    expect(next.assigneeId).not.toBe(chore.assigneeId);
    expect(next.nextDue).toBe(addDays(today, 1));
  });

  it('keeps a solo member assigned', () => {
    const solo = [members[0]];
    const all = scheduleNew(generateChores(DEFAULT_HOME, 1), [], solo, today).map((c, i) => ({ ...c, id: String(i) }));
    expect(completion(all[0], all, solo, 'a', today).assigneeId).toBe('a');
  });

  it('rebalance is a no-op on a freshly scheduled list', () => {
    expect(rebalance(scheduled(), members)).toEqual([]);
  });

  it('projects the rest of a month from today: daily chores every day, rotating between people', () => {
    const all = scheduled();
    const occ = projectMonth(all, members, 2026, 9, today); // October 2026, mid-month
    const daily = all.find((c) => c.everyDays === 1)!;
    const mine = occ.filter((o) => o.choreId === daily.id);
    expect(mine.map((o) => o.date)).toEqual(Array.from({ length: 20 }, (_, i) => addDays(today, i)));
    expect(new Set(mine.map((o) => o.memberId)).size).toBeGreaterThan(1);
    expect(occ.every((o) => o.date >= today && o.date <= '2026-10-31')).toBe(true);
    const weekly = all.find((c) => c.everyDays === 7)!;
    expect(occ.filter((o) => o.choreId === weekly.id).length).toBeGreaterThanOrEqual(2);
  });

  it('redistributes due dates within one cycle and flattens the busiest day', () => {
    const all = scheduled();
    const busiest = (cs: Chore[]) => {
      const total = new Map<string, number>();
      for (let d = 0; d < 28; d++) {
        const date = addDays(today, d);
        for (const c of cs) if (c.active && daysUntil(date, c.nextDue) >= 0 && daysUntil(date, c.nextDue) % c.everyDays === 0)
          total.set(date, (total.get(date) ?? 0) + c.minutes);
      }
      return Math.max(...total.values());
    };
    const changes = new Map(redistribute(all, members, 60, today));
    const after = all.map((c) => ({ ...c, ...changes.get(c.id) }));
    for (const c of after) expect(daysUntil(c.nextDue, today)).toBeLessThan(c.everyDays);
    expect(busiest(after)).toBeLessThanOrEqual(busiest(all));
    expect(redistribute(after, members, 60, today)).toEqual([]);
  });

  describe('chores pinned to a weekday', () => {
    const wed = '2026-10-14';
    const pinned = (): Chore[] => {
      const [trash, recycling] = scheduleNew(
        [
          { key: '', area: 'Outdoor', name: 'Trash to curb', minutes: 10, everyDays: 7, weekday: 1 },
          { key: '', area: 'Outdoor', name: 'Recycling to curb', minutes: 10, everyDays: 14, weekday: 1 },
        ],
        [],
        members,
        wed,
      ).map((c, i) => ({ ...c, id: `p${i}` }));
      return [{ ...trash }, { ...recycling }];
    };

    it('starts on the next matching weekday', () => {
      expect(pinned().map((c) => c.nextDue)).toEqual(['2026-10-19', '2026-10-19']);
    });

    it('keeps its weekday and week when done late', () => {
      const [trash, recycling] = pinned();
      expect(completion(trash, [trash, recycling], members, 'a', '2026-10-20').nextDue).toBe('2026-10-26');
      expect(completion(recycling, [trash, recycling], members, 'a', '2026-10-20').nextDue).toBe('2026-11-02');
    });

    it('is not moved by redistribute', () => {
      const all = [...scheduled(), ...pinned()];
      const moved = new Map(redistribute(all, members, 60, wed));
      expect(moved.get('p0')?.nextDue ?? '2026-10-19').toBe('2026-10-19');
      expect(moved.get('p1')?.nextDue ?? '2026-10-19').toBe('2026-10-19');
    });

    it('shows up only on its Mondays in the printed month', () => {
      const occ = projectMonth(pinned(), members, 2026, 10, wed); // November
      expect(occ.filter((o) => o.choreId === 'p1').map((o) => o.date)).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
      expect(occ.filter((o) => o.choreId === 'p0').length).toBe(5);
    });
  });

  describe('free days', () => {
    const wed = '2026-10-14';
    // B is off on Mondays, everyone is off on Sundays.
    const crew: Member[] = [
      { id: 'a', name: 'A', freeDays: [0] },
      { id: 'b', name: 'B', freeDays: [0, 1] },
      { id: 'c', name: 'C', freeDays: [0] },
    ];
    const weekday = (date: string) => new Date(`${date}T12:00`).getDay();
    const plan = () => {
      const all = scheduleNew(generateChores(big, 3), [], crew, wed).map((c, i) => ({ ...c, id: String(i) }));
      const moved = new Map(redistribute(all, crew, 60, wed));
      return all.map((c) => ({ ...c, ...moved.get(c.id) }));
    };

    it('never gives anyone a chore on their free day after redistributing', () => {
      for (const c of plan()) {
        if (c.everyDays === 1) continue; // daily chores still happen every day, whoever is around
        const day = weekday(c.nextDue);
        expect(crew.find((m) => m.id === c.assigneeId)!.freeDays).not.toContain(day);
      }
    });

    it('keeps the rotation off free days when passing chores on', () => {
      const all = plan();
      const daily = all.find((c) => c.everyDays === 1)!;
      for (let d = 0; d < 14; d++) {
        const date = addDays(wed, d);
        const next = completion({ ...daily, nextDue: date }, all, crew, 'a', date);
        if (weekday(next.nextDue) === 1) expect(next.assigneeId).not.toBe('b');
      }
    });

    it('hands over chores already on a newly chosen free day, and the calendar agrees', () => {
      const before = crew.map(({ id, name }) => ({ id, name }));
      const all = scheduleNew(generateChores(big, 3), [], before, wed).map((c, i) => ({ ...c, id: String(i) }));
      const after = before.map((m) => (m.id === 'c' ? { ...m, freeDays: [3] } : m));
      const moved = new Map(coverFreeDays(all, after));
      const fixed = all.map((c) => ({ ...c, ...moved.get(c.id) }));
      expect(fixed.filter((c) => c.assigneeId === 'c' && weekday(c.nextDue) === 3)).toEqual([]);
      const nov = projectMonth(all, after, 2026, 10, wed); // even without saving the handover
      expect(nov.filter((o) => o.memberId === 'c' && weekday(o.date) === 3)).toEqual([]);
    });

    it('treats overdue chores as due today when checking free days', () => {
      const before = crew.map(({ id, name }) => ({ id, name }));
      // Scheduled two weeks ago and never done, so lots is overdue on Wednesday the 14th.
      const all = scheduleNew(generateChores(big, 3), [], before, '2026-10-01').map((c, i) => ({ ...c, id: String(i) }));
      const after = before.map((m) => (m.id === 'c' ? { ...m, freeDays: [3] } : m));
      const oct = projectMonth(all, after, 2026, 9, wed);
      expect(oct.filter((o) => o.memberId === 'c' && weekday(o.date) === 3)).toEqual([]);
      const moved = new Map(coverFreeDays(all, after, 60, wed));
      const overdueOnHer = all.filter((c) => c.nextDue < wed && (moved.get(c.id)?.assigneeId ?? c.assigneeId) === 'c');
      expect(overdueOnHer).toEqual([]);
    });

    it('moves chores to another day in a one-person home on its day off', () => {
      const solo: Member[] = [{ id: 'c', name: 'Charlotte', freeDays: [3] }];
      const all = scheduleNew(generateChores(big, 1), [], solo, wed).map((c, i) => ({ ...c, id: String(i) }));
      const flexible = all.filter((c) => c.weekday == null && c.everyDays > 1);
      expect(flexible.filter((c) => weekday(c.nextDue) === 3)).toEqual([]);
      // Done on Tuesday, a weekly chore would be due next Tuesday; done on a Tuesday two weeks
      // from now, a 15-day chore lands on a Wednesday and moves to Thursday.
      const chore = { ...flexible[0], everyDays: 15 };
      expect(completion(chore, all, solo, 'c', '2026-10-13').nextDue).toBe('2026-10-29');
      const nov = projectMonth(all, solo, 2026, 10, wed);
      const onWed = nov.filter((o) => weekday(o.date) === 3).map((o) => all.find((c) => c.id === o.choreId)!);
      expect(onWed.every((c) => c.everyDays === 1)).toBe(true);
      // Something already sitting on her day off gets moved.
      const stuck = { ...flexible[0], nextDue: '2026-10-21' };
      expect(coverFreeDays([stuck], solo, 60, wed)).toEqual([[stuck.id, { nextDue: '2026-10-22' }]]);
    });

    it('moves flexible chores off days when everyone is free', () => {
      const flexibleOnSundays = plan().filter((c) => c.everyDays >= 7 && weekday(c.nextDue) === 0);
      expect(flexibleOnSundays).toEqual([]);
    });
  });

  it('gives rare chores a heads-up a week before, even across a month boundary', () => {
    const base = { key: '', area: 'Bathroom', lastDone: null, lastDoneBy: null, active: true, weekday: null };
    const chores: Chore[] = [
      { ...base, id: 'q', name: 'Deep clean', minutes: 75, everyDays: 90, nextDue: '2026-11-03', assigneeId: 'b' },
      { ...base, id: 'w', name: 'Clean', minutes: 30, everyDays: 7, nextDue: '2026-10-20', assigneeId: 'a' },
    ];
    expect(headsUps(chores, members, 2026, 9, today)).toEqual([{ choreId: 'q', date: '2026-10-27', memberId: 'b' }]);
    expect(headsUps(chores, members, 2026, 10, today)).toEqual([]);
  });

  it('handles month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2);
  });
});
