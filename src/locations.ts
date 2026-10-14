import type { Room } from './types';

/** Place drawings (public/coloring/places/<key>.png), with an emoji stand-in for each. */
const PLACE_EMOJI = {
  kitchen: '🍳', bedroom: '🛏️', bathroom: '🛁', halfBath: '🚽', living: '🛋️', dining: '🍽️', office: '💻',
  laundry: '🧺', playroom: '🧸', gym: '🏋️', entry: '👟', hallway: '🚪', stairwell: '🪜', sunroom: '☀️',
  garage: '🔧', basement: '🔦', attic: '🧳', storage: '📦', other: '✨', home: '🏠', outdoor: '🌳',
  yard: '🌱', pets: '🐾', errands: '🛒', vehicles: '🚗', pool: '🏊', pin: '📍',
} as const;
type PlaceKey = keyof typeof PLACE_EMOJI;

/** Areas the generator uses that aren't rooms, then guesses for hand-typed areas. */
const AREA_PLACE: Array<[RegExp, PlaceKey]> = [
  [/^whole home$|^floor \d+$|^basement level$/i, 'home'],
  [/^laundry$/i, 'laundry'],
  [/^outdoor$/i, 'outdoor'],
  [/^yard$/i, 'yard'],
  [/^pets$/i, 'pets'],
  [/^errands$/i, 'errands'],
  [/^vehicles$/i, 'vehicles'],
  [/^pool$|^hot tub$/i, 'pool'],
  [/kitchen/i, 'kitchen'],
  [/bath/i, 'bathroom'],
  [/bed/i, 'bedroom'],
  [/living|family/i, 'living'],
  [/garage/i, 'garage'],
  [/garden|yard|lawn/i, 'yard'],
];

export interface Location {
  key: PlaceKey;
  emoji: string;
  /** Set when several areas share an icon (Bedroom 1, Bedroom 2…). */
  n?: number;
}

/** Gives every area an icon, numbering areas that share one so the legend can tell them apart. */
export function locationsFor(areas: string[], rooms: Room[]): Map<string, Location> {
  const roomType = new Map(rooms.map((r) => [r.name.trim().toLowerCase(), r.type]));
  const placeOf = (area: string): PlaceKey =>
    roomType.get(area.trim().toLowerCase()) ?? AREA_PLACE.find(([re]) => re.test(area))?.[1] ?? 'pin';

  const unique = [...new Set(areas)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const byPlace = new Map<PlaceKey, string[]>();
  for (const a of unique) byPlace.set(placeOf(a), [...(byPlace.get(placeOf(a)) ?? []), a]);

  const out = new Map<string, Location>();
  for (const [key, list] of byPlace) {
    list.forEach((a, i) => out.set(a, { key, emoji: PLACE_EMOJI[key], ...(list.length > 1 && { n: i + 1 }) }));
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Chore name for a calendar cell, with the location left to the icon:
 * "Scrub Bathroom 2 shower / tub" -> "Scrub shower / tub", "Laundry: wash, dry…" -> "Laundry".
 */
export function compactName(name: string, area: string): string {
  let s = name.replace(/:[^-]*/, '');
  s = s.replace(new RegExp(`\\s*-\\s*${escape(area)}\\s*$`, 'i'), '');
  // Drop the area mid-name ("Scrub Bathroom 2 shower"), but not when it leads ("Kitchen reset").
  s = s.replace(new RegExp(`(\\S)\\s+${escape(area)}(?=\\s|$)`, 'i'), '$1');
  return s.replace(/\s{2,}/g, ' ').trim();
}
