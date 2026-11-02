import type { Chore, ChoreDraft, HomeConfig, Place, Room } from './types';

const BUILT_IN: Record<string, string> = {
  home: 'Whole home',
  outdoor: 'Outdoor',
  yard: 'Yard',
  laundry: 'Laundry',
  pets: 'Pets',
  errands: 'Errands',
  vehicles: 'Vehicles',
  pool: 'Pool',
  hotTub: 'Hot tub',
  other: 'Other',
};
const PLACE_TOKEN = '{place}';
const floorId = (level: number) => `floor:${level}`;
export const floorName = (level: number) => (level === 0 ? 'Basement level' : `Floor ${level}`);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const regexEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type LinkHome = Pick<HomeConfig, 'rooms' | 'places'>;

/** A location's current name, or null if nothing has that id any more. */
export function locationName(id: string, home: LinkHome): string | null {
  const floor = /^floor:(\d+)$/.exec(id);
  if (floor) return floorName(Number(floor[1]));
  return (
    home.rooms.find((r) => r.id === id)?.name.trim() || home.places?.find((p) => p.id === id)?.name || BUILT_IN[id] || null
  );
}

/** The location with this name, if there is one. */
export function locationIdFor(area: string, home: LinkHome): string | null {
  const name = area.trim().toLowerCase();
  const room = home.rooms.find((r) => r.name.trim().toLowerCase() === name);
  if (room) return room.id;
  if (name === 'basement level') return floorId(0);
  const floor = /^floor (\d+)$/.exec(name);
  if (floor) return floorId(Number(floor[1]));
  const place = home.places?.find((p) => p.name.trim().toLowerCase() === name);
  if (place) return place.id;
  return Object.keys(BUILT_IN).find((id) => BUILT_IN[id].toLowerCase() === name) ?? null;
}

/** Only rooms and places can be renamed, so only they need their name replaced by the token. */
const isRenamable = (id: string, home: LinkHome) =>
  home.rooms.some((r) => r.id === id) || !!home.places?.some((p) => p.id === id);

/** A chore name as stored for a location, with that location's name swapped for {place}. */
export function toTask(name: string, id: string, home: LinkHome): string {
  const place = locationName(id, home);
  if (!place || !isRenamable(id, home)) return name;
  return name.replace(new RegExp(`(?<![\\w])${regexEscape(place)}(?![\\w])`, 'g'), PLACE_TOKEN);
}

/**
 * The link between a generated or existing chore and its location. A name no location has becomes a
 * new place (returned, to be saved with the home). The key follows the location too, so renaming a
 * room doesn't make its chores look new.
 */
export function linkChore(
  c: Pick<ChoreDraft, 'area' | 'name' | 'key'>,
  home: LinkHome,
  newId: () => string,
): { locationId: string; task: string; key: string; newPlace?: Place } {
  const area = c.area.trim() || BUILT_IN.other;
  const found = locationIdFor(area, home);
  const newPlace = found ? undefined : { id: newId(), name: area };
  const locationId = found ?? newPlace!.id;
  const withPlace = newPlace ? { ...home, places: [...(home.places ?? []), newPlace] } : home;
  const slug = slugify(area);
  const key = c.key ? `${locationId}/${c.key.replace(new RegExp(`(^|-)${regexEscape(slug)}(?=-|$)`, 'g'), '$1place')}` : '';
  return { locationId, task: toTask(c.name, locationId, withPlace), key, ...(newPlace && { newPlace }) };
}

/** What to show for a chore: its location's current name, filled into its task. */
export function resolveChore<T extends Pick<Chore, 'area' | 'name' | 'locationId' | 'task'>>(c: T, home: LinkHome): T {
  if (!c.locationId) return c;
  const area = locationName(c.locationId, home) ?? c.area;
  return { ...c, area, name: (c.task ?? c.name).split(PLACE_TOKEN).join(area) };
}

/** Links chores saved before locations were relational. Their old fields stay as they are. */
export function migrateChores(
  chores: Array<Pick<Chore, 'id' | 'area' | 'name' | 'key' | 'locationId'>>,
  home: LinkHome,
  newId: () => string,
): { patches: Array<[string, Pick<Chore, 'locationId' | 'task' | 'key'>]>; places: Place[] } {
  const places: Place[] = [];
  const patches: Array<[string, Pick<Chore, 'locationId' | 'task' | 'key'>]> = [];
  for (const c of chores) {
    if (c.locationId) continue;
    const known = { ...home, places: [...(home.places ?? []), ...places] };
    const { newPlace, ...link } = linkChore(c, known, newId);
    if (newPlace) places.push(newPlace);
    patches.push([c.id, link]);
  }
  return { patches, places };
}

/** Rooms being removed that still have chores. */
export const removedRoomsInUse = (before: Room[], after: Room[], chores: Array<Pick<Chore, 'locationId'>>) =>
  before.filter((r) => !after.some((x) => x.id === r.id) && chores.some((c) => c.locationId === r.id));

/** Keeps a removed room's chores linked: the room lives on as a place, under the same id and name. */
export const keepRoomsAsPlaces = (home: HomeConfig, rooms: Room[]): HomeConfig =>
  rooms.length
    ? { ...home, places: [...(home.places ?? []), ...rooms.map((r) => ({ id: r.id, name: r.name.trim() || 'Other' }))] }
    : home;

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

/** The floor an area is on: its room's level, or the generator's per-floor areas. Null for "Pets", "Whole home" and so on. */
export function areaLevel(area: string, rooms: Room[]): number | null {
  const name = area.trim().toLowerCase();
  const room = rooms.find((r) => r.name.trim().toLowerCase() === name);
  if (room) return room.level;
  if (name === 'basement level') return 0;
  const floor = /^floor (\d+)$/.exec(name);
  return floor ? Number(floor[1]) : null;
}

/** "1st floor", "2nd floor"; level 0 is the basement. */
export const floorLabel = (level: number) =>
  level === 0 ? 'Basement' : `${['1st', '2nd', '3rd'][level - 1] ?? `${level}th`} floor`;

/** Floors that have chores, lowest first. */
export const floorsOf = (areas: string[], rooms: Room[]) =>
  [...new Set(areas.map((a) => areaLevel(a, rooms)).filter((l) => l != null))].sort((a, b) => a - b);

const FLOOR_PREFIX = 'floor:';
/** A location filter is either an area's name or one of these. */
export const floorFilter = (level: number) => `${FLOOR_PREFIX}${level}`;

export const inLocation = (area: string, location: string, rooms: Room[]) =>
  location.startsWith(FLOOR_PREFIX) ? floorFilter(areaLevel(area, rooms) ?? -1) === location : area === location;

export const locationLabel = (location: string) =>
  location.startsWith(FLOOR_PREFIX) ? floorLabel(Number(location.slice(FLOOR_PREFIX.length))) : location;

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
