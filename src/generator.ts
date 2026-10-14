import { newId } from './format';
import type { ChoreDraft, FeatureKey, Flooring, HomeConfig, PetKey, Room, RoomSize, RoomType } from './types';

/** No single chore should take longer than this; bigger jobs get split into parts. */
export const MAX_MINUTES = 120;

export const ROOM_TYPES: Record<RoomType, { label: string; size: RoomSize; flooring: Flooring; level?: number }> = {
  kitchen: { label: 'Kitchen', size: 'medium', flooring: 'hard' },
  bedroom: { label: 'Bedroom', size: 'medium', flooring: 'carpet' },
  bathroom: { label: 'Bathroom', size: 'medium', flooring: 'hard' },
  halfBath: { label: 'Half bath', size: 'small', flooring: 'hard' },
  living: { label: 'Living room', size: 'large', flooring: 'hard' },
  dining: { label: 'Dining room', size: 'medium', flooring: 'hard' },
  office: { label: 'Office', size: 'small', flooring: 'hard' },
  laundry: { label: 'Laundry room', size: 'small', flooring: 'hard' },
  playroom: { label: 'Playroom', size: 'medium', flooring: 'carpet' },
  gym: { label: 'Home gym', size: 'medium', flooring: 'hard' },
  entry: { label: 'Entryway', size: 'small', flooring: 'hard' },
  hallway: { label: 'Hallway', size: 'small', flooring: 'hard' },
  stairwell: { label: 'Stairwell', size: 'medium', flooring: 'carpet' },
  sunroom: { label: 'Sunroom', size: 'medium', flooring: 'hard' },
  garage: { label: 'Garage', size: 'large', flooring: 'hard' },
  basement: { label: 'Unfinished basement', size: 'large', flooring: 'hard', level: 0 },
  attic: { label: 'Attic', size: 'medium', flooring: 'hard' },
  storage: { label: 'Storage / closet', size: 'small', flooring: 'hard' },
  other: { label: 'Other room', size: 'medium', flooring: 'hard' },
};

/** Rooms covered by the level-wide vacuum / mop / dust jobs. */
const NOT_SWEPT: RoomType[] = ['garage', 'basement', 'attic', 'storage', 'stairwell'];

export const FEATURES: Array<[FeatureKey, string]> = [
  ['dishwasher', 'Dishwasher'],
  ['laundryInUnit', 'Washer & dryer at home'],
  ['errands', 'Groceries & meal planning'],
  ['houseplants', 'Houseplants'],
  ['fireplace', 'Fireplace / wood stove'],
  ['deck', 'Deck / patio'],
  ['grill', 'Grill'],
  ['garden', 'Vegetable garden'],
  ['pool', 'Pool'],
  ['hotTub', 'Hot tub'],
  ['compost', 'Compost bin'],
  ['waterSoftener', 'Water softener'],
];

export const PETS: Array<[PetKey, string]> = [
  ['dogs', 'Dogs'],
  ['cats', 'Cats'],
  ['fishTanks', 'Fish tanks'],
  ['birds', 'Birds'],
  ['smallPets', 'Small pets (rabbit, hamster…)'],
  ['chickens', 'Chickens'],
];

/** Adds a room with a name that doesn't clash with existing ones ("Bedroom 3"). */
export function makeRoom(type: RoomType, existing: Room[], level?: number): Room {
  const t = ROOM_TYPES[type];
  const names = new Set(existing.map((r) => r.name));
  let n = existing.filter((r) => r.type === type).length + 1;
  let name = n > 1 ? `${t.label} ${n}` : t.label;
  while (names.has(name)) name = `${t.label} ${++n}`;
  return { id: newId(), type, name, level: level ?? t.level ?? 1, size: t.size, flooring: t.flooring };
}

function roomsOf(spec: Array<[RoomType, number?]>): Room[] {
  const rooms: Room[] = [];
  for (const [type, level] of spec) rooms.push(makeRoom(type, rooms, level));
  return rooms;
}

/** Starting points; everything stays editable afterwards. */
export const LAYOUTS: Array<{ label: string; build: () => Pick<HomeConfig, 'homeType' | 'floors' | 'yard' | 'rooms'> }> = [
  {
    label: 'Studio',
    build: () => ({ homeType: 'apartment', floors: 1, yard: 'none', rooms: roomsOf([['kitchen'], ['living'], ['bathroom'], ['entry']]) }),
  },
  {
    label: '2-bed apartment',
    build: () => ({
      homeType: 'apartment',
      floors: 1,
      yard: 'none',
      rooms: roomsOf([['kitchen'], ['living'], ['bedroom'], ['bedroom'], ['bathroom'], ['entry'], ['hallway']]),
    }),
  },
  {
    label: '3-bed house',
    build: () => ({
      homeType: 'house',
      floors: 1,
      yard: 'small',
      rooms: roomsOf([
        ['kitchen'], ['living'], ['dining'], ['bedroom'], ['bedroom'], ['bedroom'],
        ['bathroom'], ['bathroom'], ['laundry'], ['entry'], ['hallway'], ['garage'],
      ]),
    }),
  },
  {
    label: '2-story family home',
    build: () => ({
      homeType: 'house',
      floors: 2,
      yard: 'medium',
      rooms: roomsOf([
        ['kitchen', 1], ['living', 1], ['dining', 1], ['office', 1], ['halfBath', 1], ['entry', 1], ['laundry', 1],
        ['bedroom', 2], ['bedroom', 2], ['bedroom', 2], ['bedroom', 2], ['bathroom', 2], ['bathroom', 2], ['hallway', 2],
        ['playroom', 0], ['basement', 0], ['garage', 1],
      ]),
    }),
  },
];

export const DEFAULT_HOME: HomeConfig = {
  ...LAYOUTS[1].build(),
  features: ['dishwasher', 'laundryInUnit', 'errands'],
  pets: {},
  vehicles: 0,
};

export const levelName = (level: number) => (level === 0 ? 'Basement level' : `Floor ${level}`);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SIZE_FACTOR: Record<RoomSize, number> = { small: 0.7, medium: 1, large: 1.5 };

/** Builds a chore list for a home. Every chore takes at most MAX_MINUTES. */
export function generateChores(h: HomeConfig, peopleCount: number): ChoreDraft[] {
  const out: ChoreDraft[] = [];
  const people = Math.max(1, peopleCount);
  const has = (f: FeatureKey) => h.features.includes(f);
  const pet = (p: PetKey) => h.pets[p] ?? 0;

  const add = (area: string, name: string, minutes: number, everyDays: number) => {
    const parts = Math.ceil(minutes / MAX_MINUTES);
    const each = Math.max(5, Math.round(minutes / parts / 5) * 5);
    for (let i = 1; i <= parts; i++) {
      const fullName = parts > 1 ? `${name} (part ${i} of ${parts})` : name;
      out.push({ key: slug(`${area} ${fullName}`), area, name: fullName, minutes: each, everyDays });
    }
  };

  // Names become chore areas and keys, so make sure they're unique and non-empty.
  const seen = new Set<string>();
  const rooms = h.rooms.map((r) => {
    const base = r.name.trim() || ROOM_TYPES[r.type].label;
    let name = base;
    for (let n = 2; seen.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    seen.add(name.toLowerCase());
    return { ...r, name };
  });

  // Household-wide kitchen jobs live with the first kitchen.
  const kitchen = rooms.find((r) => r.type === 'kitchen')?.name;
  if (kitchen) {
    if (has('dishwasher')) {
      add(kitchen, 'Load / unload dishwasher', 15, 1);
      add(kitchen, 'Clean dishwasher filter', 15, 30);
    } else {
      add(kitchen, 'Wash dishes', 20 + 5 * people, 1);
    }
    add(kitchen, 'Take out trash & recycling', 10, 3);
    add(kitchen, 'Declutter pantry & check expirations', 45, 90);
  }

  const kitchens = rooms.filter((r) => r.type === 'kitchen').length;
  for (const r of rooms) {
    const n = r.name;
    const at = r.type !== 'kitchen' || kitchens > 1 ? ` - ${n}` : '';
    const sz = (m: number) => m * SIZE_FACTOR[r.size];
    switch (r.type) {
      case 'kitchen':
        add(n, `Kitchen reset: counters, stovetop, sink${at}`, sz(15), 1);
        add(n, `Clean microwave & small appliances${at}`, 20, 14);
        add(n, `Fridge purge & wipe shelves${at}`, 30, 14);
        add(n, `Wipe cabinet fronts & handles${at}`, sz(30), 30);
        add(n, `Degrease range hood & filter${at}`, 30, 60);
        add(n, `Clean oven${at}`, 60, 90);
        break;
      case 'bathroom':
        add(n, `Clean ${n}: toilet, sink, mirror, floor`, sz(30), 7);
        add(n, `Scrub ${n} shower / tub`, 30, 14);
        add(n, `Wash ${n} bath mats & shower curtain`, 15, 30);
        add(n, `Deep clean ${n}: grout, fan, cabinets`, sz(75), 90);
        break;
      case 'halfBath':
        add(n, `Clean ${n}: toilet, sink, mirror, floor`, sz(20), 7);
        add(n, `Deep clean ${n}: fan, baseboards, cabinet`, sz(30), 90);
        break;
      case 'bedroom':
        add(n, `Change sheets - ${n}`, 15, 7);
        add(n, `Dust & tidy ${n}`, sz(25), 14);
        add(n, `Vacuum under bed & furniture - ${n}`, sz(30), 60);
        add(n, `Rotate mattress - ${n}`, 10, 180);
        add(n, `Declutter closet - ${n}`, sz(60), 180);
        break;
      case 'living':
        add(n, `Dust & tidy ${n}`, sz(25), 7);
        add(n, `Vacuum upholstery & under cushions - ${n}`, sz(30), 30);
        break;
      case 'dining':
        add(n, `Wipe table & chairs, tidy ${n}`, sz(15), 7);
        add(n, `Dust shelves & light fixture - ${n}`, sz(20), 30);
        break;
      case 'office':
        add(n, `Dust & tidy ${n}`, sz(20), 14);
        add(n, `Sort papers & clear desk - ${n}`, 30, 30);
        break;
      case 'laundry':
        add(n, `Wipe machines & sweep ${n}`, sz(15), 14);
        break;
      case 'playroom':
        add(n, `Put away toys - ${n}`, sz(15), 2);
        add(n, `Wipe & sanitize toys - ${n}`, sz(30), 30);
        add(n, `Sort & donate outgrown toys - ${n}`, sz(60), 90);
        break;
      case 'gym':
        add(n, `Wipe down equipment - ${n}`, sz(15), 7);
        break;
      case 'entry':
        add(n, `Tidy shoes, coats & bags - ${n}`, sz(10), 3);
        add(n, `Shake out / wash doormats - ${n}`, 15, 30);
        break;
      case 'hallway':
        add(n, `Wipe walls, switches & handrails - ${n}`, sz(20), 30);
        break;
      case 'sunroom':
        add(n, `Dust & tidy ${n}`, sz(20), 14);
        add(n, `Wash windows - ${n}`, sz(45), 60);
        break;
      case 'garage':
        add(n, `Sweep & organize ${n}`, sz(60), 90);
        break;
      case 'basement':
        add(n, `Sweep & declutter ${n}`, sz(40), 90);
        add(n, `Check for leaks, empty dehumidifier - ${n}`, 10, 14);
        break;
      case 'attic':
        add(n, `Declutter & check for pests/leaks - ${n}`, sz(60), 365);
        break;
      case 'storage':
        add(n, `Declutter ${n}`, sz(45), 180);
        break;
      case 'stairwell':
        add(n, r.flooring === 'carpet' ? `Vacuum stairs & landing - ${n}` : `Sweep & mop stairs - ${n}`, sz(20), 7);
        add(n, `Wipe handrail, spindles & walls - ${n}`, sz(20), 30);
        if (r.flooring === 'carpet') add(n, `Shampoo stair carpet - ${n}`, sz(45), 365);
        break;
      case 'other':
        add(n, `Dust & tidy ${n}`, sz(20), 14);
        break;
    }
  }

  // Level-wide floor jobs, scaled by the rooms (and their size) on each level.
  const swept = rooms.filter((r) => !NOT_SWEPT.includes(r.type));
  const levels = [...new Set(swept.map((r) => r.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const here = swept.filter((r) => r.level === level);
    const weight = (rs: Room[]) => rs.reduce((s, r) => s + SIZE_FACTOR[r.size], 0);
    const all = weight(here);
    const hard = weight(here.filter((r) => r.flooring === 'hard'));
    const carpet = weight(here.filter((r) => r.flooring === 'carpet'));
    const area = levels.length > 1 ? levelName(level) : 'Whole home';
    const where = levels.length > 1 ? ` - ${levelName(level).toLowerCase()}` : '';
    add(area, `Vacuum all rooms${where}`, 10 + 6 * all, 7);
    if (hard) add(area, `Mop hard floors${where}`, 10 + 5 * hard, 14);
    add(area, `Dust baseboards & doors${where}`, 10 + 6 * all, 60);
    add(area, `Clean ceiling fans & light fixtures${where}`, 10 + 4 * all, 60);
    add(area, `Wash interior windows${where}`, 10 + 8 * all, 90);
    if (carpet) add(area, `Shampoo carpets${where}`, 30 + 15 * carpet, 365);
  }
  const allLevels = new Set([...levels, ...Array.from({ length: Math.max(1, h.floors) }, (_, i) => i + 1)]);
  // Homes without stairwells listed still get a generic stairs job.
  if (allLevels.size > 1 && !rooms.some((r) => r.type === 'stairwell')) add('Whole home', 'Vacuum stairs', 15 * (allLevels.size - 1), 14);

  add('Whole home', 'Empty all small trash cans', 10, 7);
  add('Whole home', 'Disinfect light switches, door handles, remotes', 15, 14);
  add('Whole home', 'Replace HVAC / air filter', 10, 90);
  add('Whole home', 'Test smoke & CO detectors', 15, 180);
  if (has('houseplants')) add('Whole home', 'Water houseplants', 15, 7);
  if (has('fireplace')) {
    add('Whole home', 'Clear ashes & clean hearth', 20, 14);
    add('Whole home', 'Book chimney sweep / inspection', 15, 365);
  }
  if (has('waterSoftener')) add('Whole home', 'Top up water softener salt', 10, 30);

  // Laundry: roughly 1.5 loads per person per week
  if (has('laundryInUnit')) {
    add('Laundry', 'Laundry: wash, dry, fold & put away one load', 45, Math.max(1, Math.round(7 / (people * 1.5))));
    add('Laundry', 'Wash towels', 45, 7);
    add('Laundry', 'Clean washer & dryer vent', 30, 90);
  } else {
    add('Laundry', 'Laundromat run', 60 + 15 * people, 7);
  }

  // Outdoors
  if (h.homeType !== 'apartment') {
    add('Outdoor', 'Bins to curb & back', 10, 7);
    add('Outdoor', 'Sweep porch & front steps', 15, 14);
  }
  if (h.homeType === 'house') {
    add('Outdoor', 'Clean gutters', 90, 180);
    add('Outdoor', 'Wash exterior windows', 30 + 15 * Math.max(1, h.floors), 365);
  }
  const yard = { none: 0, small: 1, medium: 2, large: 3.3 }[h.yard];
  if (yard) {
    add('Yard', 'Mow lawn', 45 * yard, 7);
    add('Yard', 'Weed garden beds', 30 + 15 * yard, 14);
    add('Yard', 'Edge, trim & rake', 30 + 20 * yard, 30);
  }
  if (has('garden')) {
    add('Yard', 'Water & harvest vegetable garden', 20, 2);
    add('Yard', 'Weed & tend vegetable garden', 45, 7);
  }
  if (has('deck')) {
    add('Outdoor', 'Sweep deck / patio', 20, 14);
    add('Outdoor', 'Wash outdoor furniture & cushions', 45, 90);
  }
  if (has('grill')) add('Outdoor', 'Scrub grill grates & empty grease tray', 30, 30);
  if (has('pool')) {
    add('Pool', 'Skim pool & check chemicals', 20, 3);
    add('Pool', 'Brush & vacuum pool', 60, 7);
    add('Pool', 'Clean pool filter', 30, 30);
  }
  if (has('hotTub')) {
    add('Hot tub', 'Test & balance hot tub water', 10, 3);
    add('Hot tub', 'Rinse hot tub filter', 20, 30);
    add('Hot tub', 'Drain, clean & refill hot tub', 120, 90);
  }
  if (has('compost')) add('Outdoor', 'Empty kitchen scraps & turn compost', 10, 7);

  for (let i = 1; i <= h.vehicles; i++) {
    const v = h.vehicles > 1 ? `Car ${i}` : 'Car';
    add('Vehicles', `Wash ${v.toLowerCase()} exterior`, 45, 30);
    add('Vehicles', `Vacuum & tidy ${v.toLowerCase()} interior`, 30, 30);
    add('Vehicles', `Check tire pressure & fluids - ${v.toLowerCase()}`, 15, 30);
  }

  // Pets
  const dogs = pet('dogs');
  const cats = pet('cats');
  if (dogs + cats > 0) {
    add('Pets', 'Feed pets & refresh water', 10, 1);
    add('Pets', 'Wash pet bedding & toys', 20, 14);
  }
  if (dogs > 0) {
    add('Pets', dogs > 1 ? 'Walk dogs' : 'Walk dog', 30, 1);
    add('Pets', dogs > 1 ? 'Bathe & groom dogs' : 'Bathe & groom dog', 30 + 15 * dogs, 30);
    if (h.yard !== 'none') add('Yard', 'Pick up dog waste', 15, 7);
  }
  if (cats > 0) {
    add('Pets', 'Scoop litter', 5 + 5 * cats, 1);
    add('Pets', 'Full litter change & wash box', 15 + 5 * cats, 14);
  }
  if (pet('fishTanks') > 0) {
    add('Pets', 'Feed fish', 5, 1);
    add('Pets', 'Partial water change & wipe tank glass', 30 * pet('fishTanks'), 14);
    add('Pets', 'Rinse aquarium filter', 15 * pet('fishTanks'), 30);
  }
  if (pet('birds') > 0) {
    add('Pets', 'Feed birds & change water', 10, 1);
    add('Pets', 'Clean bird cage', 20 + 5 * pet('birds'), 7);
  }
  if (pet('smallPets') > 0) {
    add('Pets', 'Feed small pets & refresh water', 5 + 2 * pet('smallPets'), 1);
    add('Pets', 'Clean small pet cages / hutch', 20 + 10 * pet('smallPets'), 7);
  }
  if (pet('chickens') > 0) {
    add('Pets', 'Feed & water chickens, collect eggs', 15, 1);
    add('Pets', 'Muck out chicken coop', 45 + 3 * pet('chickens'), 14);
  }

  if (has('errands')) {
    add('Errands', 'Meal plan & grocery list', 30, 7);
    add('Errands', 'Grocery run', 60, 7);
  }

  return out;
}
