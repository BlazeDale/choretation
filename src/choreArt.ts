/**
 * Picks a coloring-book drawing for a chore from its name. Drawings live in
 * public/coloring/<key>.png. Order matters: the first matching rule wins.
 */
const RULES: Array<[RegExp, string]> = [
  [/\bcar\b|tire/, 'car'],
  [/stairs/, 'stairs'],
  [/pool|hot tub/, 'pool'],
  [/fish|aquarium/, 'fish'],
  [/bird/, 'bird'],
  [/small pet/, 'bunny'],
  [/chicken|coop/, 'chicken'],
  [/litter/, 'cat'],
  [/\bdogs?\b|dog waste/, 'dog'],
  [/feed pets|pet bedding/, 'petfood'],
  [/dishwasher|dishes/, 'dishes'],
  [/trash|bins|recycl|compost/, 'trash'],
  [/fridge/, 'fridge'],
  [/oven|range hood|microwave/, 'oven'],
  [/toilet/, 'toilet'],
  [/shower|tub|grout|bath mats/, 'shower'],
  [/sheets|mattress|under bed/, 'bed'],
  [/kitchen reset|counter|cabinet|table/, 'counters'],
  [/laundr|towels|washer|dryer/, 'laundry'],
  [/houseplant/, 'plants'],
  [/mow|edge, trim/, 'lawn'],
  [/vegetable|garden/, 'garden'],
  [/rake|gutter/, 'rake'],
  [/grocer|meal plan/, 'groceries'],
  [/toys/, 'toys'],
  [/fireplace|hearth|chimney|ashes/, 'fireplace'],
  [/shoes|coats|doormat/, 'shoes'],
  [/grill/, 'grill'],
  [/window/, 'window'],
  [/vacuum|carpet/, 'vacuum'],
  [/mop|sweep/, 'mop'],
  [/papers|desk/, 'desk'],
  [/filter|detector|softener|leaks|equipment|chimney sweep/, 'tools'],
  [/dust|tidy|declutter|organize|wipe/, 'duster'],
];

export function artKey(choreName: string): string {
  const name = choreName.toLowerCase();
  return RULES.find(([re]) => re.test(name))?.[1] ?? 'sparkle';
}

const COLORING = `${import.meta.env.BASE_URL}coloring`;

/** Someone doing the chore first, then the plain object drawing. */
export const artUrls = (key: string) => [`${COLORING}/doing/${key}.png`, `${COLORING}/${key}.png`];

/** Name for a calendar cell: drops the detail after a colon ("Laundry: wash, dry, fold…" -> "Laundry"). */
export const cellName = (choreName: string) => choreName.replace(/:[^-]*/, '').trim();
