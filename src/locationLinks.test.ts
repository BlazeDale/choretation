import { describe, expect, it } from 'vitest';
import { generateChores } from './generator';
import {
  keepRoomsAsPlaces,
  linkChore,
  locationIdFor,
  locationName,
  migrateChores,
  removedRoomsInUse,
  resolveChore,
} from './locations';
import type { HomeConfig, Room } from './types';

const room = (id: string, name: string, type: Room['type'], level: number): Room => ({
  id,
  type,
  name,
  level,
  size: 'medium',
  flooring: 'hard',
});

// The real household's rooms.
const rooms = [
  room('entry', 'Entryway', 'entry', 1),
  room('hall', 'Hallway', 'hallway', 2),
  room('st1', 'Stairwell', 'stairwell', 1),
  room('st2', 'Stairwell 2', 'stairwell', 2),
  room('din', 'Dining room', 'dining', 1),
  room('bath', 'Bathroom', 'bathroom', 2),
];
const home = { rooms };
let n = 0;
const newId = () => `new${++n}`;

const stored = (id: string, area: string, name: string, key = '') => ({ id, area, name, key });

describe('finding a location', () => {
  it('matches rooms, floors, and built-in areas by name', () => {
    expect(locationIdFor('Bathroom', home)).toBe('bath');
    expect(locationIdFor('stairwell 2', home)).toBe('st2');
    expect(locationIdFor('Floor 2', home)).toBe('floor:2');
    expect(locationIdFor('Basement level', home)).toBe('floor:0');
    expect(locationIdFor('Whole home', home)).toBe('home');
    expect(locationIdFor('Other', home)).toBe('other');
    expect(locationIdFor('Shed', home)).toBeNull();
  });

  it('gets each name back from its id', () => {
    for (const name of ['Bathroom', 'Floor 2', 'Whole home', 'Outdoor']) expect(locationName(locationIdFor(name, home)!, home)).toBe(name);
    expect(locationName('gone', home)).toBeNull();
  });
});

describe('migrating the real chore list', () => {
  const chores = [
    stored('1', 'Bathroom', 'Clean Bathroom: toilet, sink, mirror, floor', 'bathroom-clean-bathroom-toilet-sink-mirror-floor'),
    stored('2', 'Dining room', 'Wipe table & chairs, tidy Dining room', 'dining-room-wipe-table-chairs-tidy-dining-room'),
    stored('3', 'Stairwell 2', 'Vacuum stairs & landing - Stairwell 2', 'stairwell-2-vacuum-stairs-landing-stairwell-2'),
    stored('4', 'Stairwell', 'Sweep & mop stairs - Stairwell', 'stairwell-sweep-mop-stairs-stairwell'),
    stored('5', 'Floor 1', 'Dust Corners & light fixtures - floor 1', 'floor-1-clean-ceiling-fans-light-fixtures-floor-1'),
    stored('6', 'Other', 'Trash/Recycling'),
    stored('7', 'Outdoor', 'Roll Up Bins', 'outdoor-bins-to-curb-back'),
    stored('8', 'Entryway', 'Dust shelves & light fixture'),
    stored('9', 'Whole home', 'Replace HVAC / air filter', 'whole-home-replace-hvac-air-filter'),
  ];
  const { patches, places } = migrateChores(chores, home, newId);
  const byId = new Map(patches);

  it('links every chore to its location, with no new places needed', () => {
    expect(places).toEqual([]);
    expect(patches.map(([, p]) => p.locationId)).toEqual(['bath', 'din', 'st2', 'st1', 'floor:1', 'other', 'outdoor', 'entry', 'home']);
  });

  it('shows every chore exactly as it read before', () => {
    for (const c of chores) expect(resolveChore({ ...c, ...byId.get(c.id) }, home).name).toBe(c.name);
  });

  it('keeps a Stairwell chore apart from Stairwell 2', () => {
    expect(byId.get('3')!.task).toBe('Vacuum stairs & landing - {place}');
    expect(byId.get('4')!.task).toBe('Sweep & mop stairs - {place}');
    expect(byId.get('3')!.locationId).not.toBe(byId.get('4')!.locationId);
  });

  it('runs once: linked chores are left alone', () => {
    const linked = chores.map((c) => ({ ...c, ...byId.get(c.id) }));
    expect(migrateChores(linked, home, newId)).toEqual({ patches: [], places: [] });
  });

  it('makes one new place for a typed area, however many chores use it', () => {
    const out = migrateChores([stored('a', 'Shed', 'Sweep Shed'), stored('b', 'Shed', 'Oil tools')], home, () => 'shed1');
    expect(out.places).toEqual([{ id: 'shed1', name: 'Shed' }]);
    expect(out.patches.map(([, p]) => p.locationId)).toEqual(['shed1', 'shed1']);
    expect(out.patches[0][1].task).toBe('Sweep {place}');
  });
});

describe('renaming a room', () => {
  const link = linkChore(stored('1', 'Bathroom', 'Scrub Bathroom shower / tub'), home, newId);
  const c = { area: 'Bathroom', name: 'Scrub Bathroom shower / tub', ...link };
  const renamed = { rooms: rooms.map((r) => (r.id === 'bath' ? { ...r, name: 'Main bath' } : r)) };

  it('carries through to its chores', () => {
    expect(resolveChore(c, renamed)).toMatchObject({ area: 'Main bath', name: 'Scrub Main bath shower / tub' });
  });

  it('leaves chores in other rooms alone', () => {
    const other = { area: 'Hallway', name: 'Wipe walls - Hallway', ...linkChore(stored('2', 'Hallway', 'Wipe walls - Hallway'), home, newId) };
    expect(resolveChore(other, renamed).name).toBe('Wipe walls - Hallway');
  });

  it("doesn't make its chores look new to the generator", () => {
    const base: HomeConfig = { homeType: 'house', floors: 2, yard: 'none', rooms, features: [], pets: {}, vehicles: 0 };
    const keys = (h: HomeConfig) => generateChores(h, 1).map((d) => d.key).sort();
    expect(keys({ ...base, rooms: renamed.rooms })).toEqual(keys(base));
  });

  it('keeps the same key for chores migrated from before', () => {
    const base: HomeConfig = { homeType: 'house', floors: 2, yard: 'none', rooms, features: [], pets: {}, vehicles: 0 };
    const generated = new Set(generateChores(base, 1).map((d) => d.key));
    const { patches } = migrateChores(
      [
        stored('1', 'Bathroom', 'Clean Bathroom: toilet, sink, mirror, floor', 'bathroom-clean-bathroom-toilet-sink-mirror-floor'),
        stored('2', 'Floor 1', 'Mop hard floors - floor 1', 'floor-1-mop-hard-floors-floor-1'),
        stored('3', 'Outdoor', 'Roll Up Bins', 'outdoor-bins-to-curb-back'),
      ],
      home,
      newId,
    );
    for (const [, p] of patches) expect(generated).toContain(p.key);
  });
});

describe('generated chores', () => {
  it('all arrive linked, with no stray places', () => {
    const base: HomeConfig = { homeType: 'house', floors: 2, yard: 'small', rooms, features: ['errands', 'pool', 'hotTub', 'laundryInUnit'], pets: { dogs: 1 }, vehicles: 1 };
    for (const d of generateChores(base, 2)) {
      expect(locationName(d.locationId!, base)).toBe(d.area);
      expect(resolveChore(d, base).name).toBe(d.name);
    }
  });
});

describe('removing a room', () => {
  const chores = [{ locationId: 'bath' }, { locationId: 'home' }];

  it('only flags rooms that have chores', () => {
    expect(removedRoomsInUse(rooms, rooms.filter((r) => r.id !== 'bath' && r.id !== 'hall'), chores).map((r) => r.id)).toEqual(['bath']);
    expect(removedRoomsInUse(rooms, rooms, chores)).toEqual([]);
  });

  it('keeps its chores linked, under the same name', () => {
    const base: HomeConfig = { homeType: 'house', floors: 2, yard: 'none', rooms: rooms.filter((r) => r.id !== 'bath'), features: [], pets: {}, vehicles: 0 };
    const after = keepRoomsAsPlaces(base, [rooms.find((r) => r.id === 'bath')!]);
    expect(locationName('bath', after)).toBe('Bathroom');
    const c = { area: 'Bathroom', name: 'Scrub Bathroom', locationId: 'bath', task: 'Scrub {place}' };
    expect(resolveChore(c, after).name).toBe('Scrub Bathroom');
  });
});
