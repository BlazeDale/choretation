import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoreList } from './components/ChoreList';
import { ALL_LOCATIONS, EVERYONE, choresToShow } from './components/PersonFilter';
import { areaLevel, floorFilter, floorLabel, floorsOf } from './locations';
import type { Chore, Member, Room } from './types';

vi.mock('./db', () => ({}));

const chore = (id: string, area: string, assigneeId: string, owner: string | null = null): Chore => ({
  id,
  key: id,
  name: `Chore ${id}`,
  area,
  minutes: 10,
  everyDays: 7,
  assigneeId,
  owner,
  nextDue: '2026-11-02',
  lastDone: null,
  lastDoneBy: null,
  active: true,
});

const room = (name: string, level: number): Room => ({ id: name, type: 'other', name, level, size: 'medium', flooring: 'hard' });

const members: Member[] = [
  { id: 'a', name: 'Ann' },
  { id: 'b', name: 'Bo' },
];
const rooms = [room('Kitchen', 1), room('Bathroom 2', 2), room('Attic', 3)];
const chores = [
  chore('1', 'Kitchen', 'a'),
  chore('2', 'Kitchen', 'b'),
  chore('3', 'Bathroom 2', 'a'),
  chore('4', 'Pets', 'a', 'b'),
  chore('5', 'Floor 2', 'b'),
  chore('6', 'Attic', 'a'),
];
const ids = (list: Chore[]) => list.map((c) => c.id);

describe('floors', () => {
  it('finds an area from its room or per-floor name, and leaves the rest off any floor', () => {
    expect(areaLevel('kitchen ', rooms)).toBe(1);
    expect(areaLevel('Floor 2', rooms)).toBe(2);
    expect(areaLevel('Basement level', rooms)).toBe(0);
    expect(areaLevel('Pets', rooms)).toBeNull();
  });

  it('lists the floors with chores, in order', () => {
    expect(floorsOf(['Attic', 'Pets', 'Kitchen', 'Floor 2', 'Bathroom 2'], rooms)).toEqual([1, 2, 3]);
  });

  it('names floors the way people say them', () => {
    expect([0, 1, 2, 3, 4].map(floorLabel)).toEqual(['Basement', '1st floor', '2nd floor', '3rd floor', '4th floor']);
  });
});

describe('choresToShow', () => {
  it('shows everything with no filters', () => {
    expect(ids(choresToShow(chores, EVERYONE, ALL_LOCATIONS, rooms))).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('filters by floor, including its rooms and its per-floor chores', () => {
    expect(ids(choresToShow(chores, EVERYONE, floorFilter(2), rooms))).toEqual(['3', '5']);
    expect(ids(choresToShow(chores, EVERYONE, floorFilter(1), rooms))).toEqual(['1', '2']);
  });

  it('filters by a single room or area', () => {
    expect(ids(choresToShow(chores, EVERYONE, 'Pets', rooms))).toEqual(['4']);
  });

  it('combines location with person, using owner over turn', () => {
    expect(ids(choresToShow(chores, 'a', floorFilter(1), rooms))).toEqual(['1']);
    expect(ids(choresToShow(chores, 'b', 'Pets', rooms))).toEqual(['4']);
    expect(ids(choresToShow(chores, 'a', 'Pets', rooms))).toEqual([]);
  });

  it('keeps the chore being edited even when the filters would hide it', () => {
    expect(ids(choresToShow(chores, 'a', floorFilter(1), rooms, '', '2'))).toEqual(['1', '2']);
    expect(ids(choresToShow(chores, EVERYONE, ALL_LOCATIONS, rooms, 'nothing like this', '2'))).toEqual(['2']);
  });

  it('searches names and areas, ignoring case and word order', () => {
    const list = [chore('1', 'Kitchen', 'a'), chore('2', 'Bathroom 2', 'a')];
    list[0].name = 'Mop floor';
    list[1].name = 'Scrub shower / tub';
    expect(ids(choresToShow(list, EVERYONE, ALL_LOCATIONS, rooms, 'MOP'))).toEqual(['1']);
    expect(ids(choresToShow(list, EVERYONE, ALL_LOCATIONS, rooms, 'bathroom'))).toEqual(['2']);
    expect(ids(choresToShow(list, EVERYONE, ALL_LOCATIONS, rooms, 'tub scrub'))).toEqual(['2']);
    expect(ids(choresToShow(list, EVERYONE, ALL_LOCATIONS, rooms, 'mop tub'))).toEqual([]);
    expect(ids(choresToShow(list, EVERYONE, ALL_LOCATIONS, rooms, ''))).toEqual(['1', '2']);
  });

  it('combines search with person and location', () => {
    expect(ids(choresToShow(chores, 'b', floorFilter(1), rooms, 'chore'))).toEqual(['2']);
    expect(ids(choresToShow(chores, 'a', floorFilter(1), rooms, 'chore 2'))).toEqual([]);
  });
});

describe('ChoreList location filter', () => {
  const stored = new Map<string, string>();
  const render = () => renderToString(<ChoreList uid="u" chores={chores} members={members} rooms={rooms} dailyLimit={60} />);
  const sections = (html: string) => html.match(/<h3>/g)?.length ?? 0;

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => stored.set(k, v),
    });
  });

  it('offers floors and areas, and shows every chore by default', () => {
    const html = render();
    for (const label of ['All locations', '1st floor', '2nd floor', '3rd floor', 'Kitchen', 'Pets']) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(sections(html)).toBe(5);
  });

  it('skips the floors in a one-floor home', () => {
    const html = renderToString(
      <ChoreList uid="u" chores={[chore('1', 'Kitchen', 'a')]} members={members} rooms={rooms} dailyLimit={60} />,
    );
    expect(html).not.toContain('1st floor');
  });

  it('applies a remembered floor', () => {
    stored.set('choretation.location', floorFilter(2));
    const html = render();
    expect(html).toContain('<h3>Bathroom 2</h3>');
    expect(html).toContain('<h3>Floor 2</h3>');
    expect(html).not.toContain('<h3>Kitchen</h3>');
  });

  it('falls back to all when the remembered location has no chores left', () => {
    stored.set('choretation.location', floorFilter(9));
    expect(sections(render())).toBe(5);
    stored.set('choretation.location', 'Garage');
    expect(sections(render())).toBe(5);
  });

  it('says so when a person has nothing on that floor', () => {
    stored.set('choretation.location', floorFilter(3));
    stored.set('choretation.filter', 'b');
    expect(render()).toContain('Nothing for 3rd floor on Bo&#x27;s list right now.');
  });
});
