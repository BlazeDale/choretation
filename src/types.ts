export type HomeType = 'house' | 'townhouse' | 'apartment';
export type YardSize = 'none' | 'small' | 'medium' | 'large';

export type RoomType =
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'halfBath'
  | 'living'
  | 'dining'
  | 'office'
  | 'laundry'
  | 'playroom'
  | 'gym'
  | 'entry'
  | 'hallway'
  | 'stairwell'
  | 'sunroom'
  | 'garage'
  | 'basement'
  | 'attic'
  | 'storage'
  | 'other';
export type RoomSize = 'small' | 'medium' | 'large';
export type Flooring = 'hard' | 'carpet';

export interface Room {
  id: string;
  type: RoomType;
  /** Shown as the chore area, e.g. "Kids' room". Unique within a home. */
  name: string;
  /** 0 = basement level, 1 = ground floor, and up. */
  level: number;
  size: RoomSize;
  flooring: Flooring;
}

export type FeatureKey =
  | 'dishwasher'
  | 'laundryInUnit'
  | 'houseplants'
  | 'errands'
  | 'fireplace'
  | 'deck'
  | 'grill'
  | 'garden'
  | 'pool'
  | 'hotTub'
  | 'compost'
  | 'waterSoftener';

export type PetKey = 'dogs' | 'cats' | 'fishTanks' | 'birds' | 'smallPets' | 'chickens';

export interface HomeConfig {
  homeType: HomeType;
  /** Above-ground floors. */
  floors: number;
  yard: YardSize;
  rooms: Room[];
  features: FeatureKey[];
  pets: Partial<Record<PetKey, number>>;
  vehicles: number;
}

export interface Member {
  id: string;
  name: string;
  /** Days of the week (0 = Sunday) this person gets no chores. */
  freeDays?: number[];
  /** Character shown doing their chores (see AVATARS); the default kid when unset. */
  avatar?: string;
}

export interface ChoreDraft {
  /** Stable id from the generator (empty for custom chores), used to avoid re-adding. */
  key: string;
  area: string;
  name: string;
  minutes: number;
  everyDays: number;
  /** Pin to a day of the week (0 = Sunday). Only with weekly multiples, e.g. recycling every other Monday. */
  weekday?: number | null;
}

export interface Chore extends ChoreDraft {
  id: string;
  /** Who does it next. Rotates after each completion unless the chore has an owner. */
  assigneeId: string | null;
  /** Set when the chore always belongs to one person ("Anyone" in the list when unset). */
  owner?: string | null;
  /** Local date, YYYY-MM-DD. */
  nextDue: string;
  lastDone: string | null;
  lastDoneBy: string | null;
  active: boolean;
}

export type NewChore = Omit<Chore, 'id'>;

export interface Household {
  name: string;
  members: Member[];
  home: HomeConfig | null;
  /** Max chore minutes per person per day that "Redistribute" aims for. */
  dailyLimit?: number;
  /** Notes printed on someone's calendar page, keyed by noteKey(memberId, year, month). */
  notes?: Record<string, string>;
}

export interface HistoryEntry {
  id: string;
  choreId: string;
  choreName: string;
  memberId: string;
  minutes: number;
  date: string;
  at: number;
}
