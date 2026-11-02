import { useState } from 'react';
import { floorFilter, floorLabel, floorsOf, inLocation } from '../locations';
import type { Chore, Member, Room } from '../types';

const FILTER_KEY = 'choretation.filter';
export const EVERYONE = 'all';

/** The person picked on Today and Chores, shared between them and remembered on this device. */
export function usePersonFilter(members: Member[]): [string, (id: string) => void] {
  const [filter, setFilter] = useState(() => {
    try {
      return localStorage.getItem(FILTER_KEY) ?? EVERYONE;
    } catch {
      return EVERYONE;
    }
  });
  const choose = (id: string) => {
    setFilter(id);
    try {
      localStorage.setItem(FILTER_KEY, id);
    } catch {
      /* per-device convenience only */
    }
  };
  // Someone removed from the household falls back to everyone.
  return [members.some((m) => m.id === filter) ? filter : EVERYONE, choose];
}

/** A person's chores: the ones that are always theirs, plus rotating ones where it's their turn. */
export const isTheirs = (c: Chore, id: string) => id === EVERYONE || (c.owner ? c.owner === id : c.assigneeId === id);

export function PersonFilter({ members, value, onChange }: { members: Member[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="filters" role="group" aria-label="Show chores for">
      {[{ id: EVERYONE, name: 'Everyone' }, ...members].map((m) => (
        <button key={m.id} className={`chip ${value === m.id ? 'on' : ''}`} aria-pressed={value === m.id} onClick={() => onChange(m.id)}>
          {m.name}
        </button>
      ))}
    </div>
  );
}

const LOCATION_KEY = 'choretation.location';
export const ALL_LOCATIONS = '';

/** The floor or area picked on the Chores list, remembered on this device. */
export function useLocationFilter(areas: string[], rooms: Room[]): [string, (location: string) => void] {
  const [location, setLocation] = useState(() => {
    try {
      return localStorage.getItem(LOCATION_KEY) ?? ALL_LOCATIONS;
    } catch {
      return ALL_LOCATIONS;
    }
  });
  const choose = (next: string) => {
    setLocation(next);
    try {
      localStorage.setItem(LOCATION_KEY, next);
    } catch {
      /* per-device convenience only */
    }
  };
  // A location with no chores left falls back to all of them.
  const valid = areas.includes(location) || floorsOf(areas, rooms).some((l) => floorFilter(l) === location);
  return [valid ? location : ALL_LOCATIONS, choose];
}

/** What the list shows. The chore being edited always stays, so opening one from the calendar can't hide it. */
export const choresToShow = (chores: Chore[], who: string, location: string, rooms: Room[], editing: string | null = null) =>
  chores.filter(
    (c) => c.id === editing || (isTheirs(c, who) && (location === ALL_LOCATIONS || inLocation(c.area, location, rooms))),
  );

export function LocationFilter({
  areas,
  rooms,
  value,
  onChange,
}: {
  areas: string[];
  rooms: Room[];
  value: string;
  onChange: (location: string) => void;
}) {
  const floors = floorsOf(areas, rooms);
  return (
    <div className="filters">
      <select aria-label="Show chores in" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL_LOCATIONS}>All locations</option>
        {floors.length > 1 && (
          <optgroup label="Floors">
            {floors.map((l) => (
              <option key={l} value={floorFilter(l)}>
                {floorLabel(l)}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Rooms and areas">
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
