import { useState } from 'react';
import type { Chore, Member } from '../types';

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
