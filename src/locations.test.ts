import { describe, expect, it } from 'vitest';
import { compactName, locationsFor } from './locations';
import type { Room } from './types';

describe('compactName', () => {
  it.each([
    ['Scrub Bathroom 2 shower / tub', 'Bathroom 2', 'Scrub shower / tub'],
    ['Clean Bathroom 2: toilet, sink, mirror, floor', 'Bathroom 2', 'Clean'],
    ['Change sheets - Bedroom 2', 'Bedroom 2', 'Change sheets'],
    ['Kitchen reset: counters, stovetop, sink', 'Kitchen', 'Kitchen reset'],
    ['Laundry: wash, dry, fold & put away one load', 'Laundry', 'Laundry'],
    ['Vacuum all rooms - floor 2', 'Floor 2', 'Vacuum all rooms'],
    ['Dust & tidy Living room', 'Living room', 'Dust & tidy'],
    ['Walk dog', 'Pets', 'Walk dog'],
  ])('%s', (name, area, expected) => expect(compactName(name, area)).toBe(expected));
});

describe('locationsFor', () => {
  it('numbers areas that share an icon and uses room types for custom names', () => {
    const rooms = [
      { id: '1', type: 'bedroom', name: "Sam's room", level: 1, size: 'medium', flooring: 'carpet' },
      { id: '2', type: 'bedroom', name: 'Bedroom 2', level: 1, size: 'medium', flooring: 'carpet' },
    ] as Room[];
    const locs = locationsFor(["Sam's room", 'Bedroom 2', 'Pets', 'Pets'], rooms);
    expect(locs.get("Sam's room")?.key).toBe('bedroom');
    expect(locs.get('Bedroom 2')?.key).toBe('bedroom');
    expect([locs.get('Bedroom 2')?.n, locs.get("Sam's room")?.n]).toEqual([1, 2]);
    expect(locs.get('Pets')).toEqual({ key: 'pets', emoji: '🐾' });
  });
});
