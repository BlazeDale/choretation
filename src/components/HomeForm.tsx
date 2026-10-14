import { useState } from 'react';
import { FEATURES, LAYOUTS, PETS, ROOM_TYPES, levelName, makeRoom } from '../generator';
import type { Flooring, HomeConfig, HomeType, PetKey, Room, RoomSize, RoomType, YardSize } from '../types';

const clampInt = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

export function HomeForm({
  value,
  onChange,
  showLayouts,
}: {
  value: HomeConfig;
  onChange: (h: HomeConfig) => void;
  /** Offer starting layouts (first-run only: picking one replaces the room list). */
  showLayouts?: boolean;
}) {
  // Picking a layout replaces the rooms, so keep what was there until the next edit.
  const [undo, setUndo] = useState<{ label: string; home: HomeConfig } | null>(null);
  const change = (h: HomeConfig) => {
    setUndo(null);
    onChange(h);
  };
  const set = <K extends keyof HomeConfig>(k: K, v: HomeConfig[K]) => change({ ...value, [k]: v });
  const { rooms } = value;
  const setRoom = (id: string, p: Partial<Room>) => set('rooms', rooms.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const levels = [0, ...Array.from({ length: value.floors }, (_, i) => i + 1)];
  const usedLevels = levels.filter((l) => rooms.some((r) => r.level === l));

  function setFloors(floors: number) {
    change({ ...value, floors, rooms: rooms.map((r) => (r.level > floors ? { ...r, level: floors } : r)) });
  }

  return (
    <div className="home-form">
      {showLayouts && (
        <>
          <h3>Start from a layout</h3>
          <p className="hint">Replaces the rooms below.</p>
          <div className="filters">
            {LAYOUTS.map((l) => (
              <button
                key={l.label}
                className="chip"
                onClick={() => {
                  if (rooms.length && !undo && !confirm(`Replace your ${rooms.length} rooms with the "${l.label}" layout?`)) return;
                  setUndo({ label: l.label, home: undo?.home ?? value });
                  onChange({ ...value, ...l.build() });
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          {undo && (
            <p className="notice">
              Switched to "{undo.label}".{' '}
              <button className="link" onClick={() => change(undo.home)}>
                Undo
              </button>
            </p>
          )}
        </>
      )}

      <div className="form-grid">
        <label>
          Home type
          <select value={value.homeType} onChange={(e) => set('homeType', e.target.value as HomeType)}>
            <option value="house">House</option>
            <option value="townhouse">Townhouse</option>
            <option value="apartment">Apartment / condo</option>
          </select>
        </label>
        <label>
          Floors (above ground)
          <input type="number" min={1} max={5} value={value.floors} onChange={(e) => setFloors(clampInt(e.target.value, 1, 5))} />
        </label>
        <label>
          Yard
          <select value={value.yard} onChange={(e) => set('yard', e.target.value as YardSize)}>
            <option value="none">None</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
      </div>

      <h3>Rooms</h3>
      {!rooms.length && <p className="empty">No rooms yet. Add some below.</p>}
      {usedLevels.map((level) => (
        <section key={level} className="group">
          {(usedLevels.length > 1 || level !== 1) && <h4 className="level">{levelName(level)}</h4>}
          <ul className="rows">
            {rooms
              .filter((r) => r.level === level)
              .map((r) => (
                <li key={r.id} className="room-row">
                  <input
                    className="room-name"
                    value={r.name}
                    aria-label="Room name"
                    placeholder={ROOM_TYPES[r.type].label}
                    onChange={(e) => setRoom(r.id, { name: e.target.value })}
                  />
                  <span className="unit">{ROOM_TYPES[r.type].label}</span>
                  <div className="row-controls">
                    <select value={r.level} aria-label="Level" onChange={(e) => setRoom(r.id, { level: Number(e.target.value) })}>
                      {levels.map((l) => (
                        <option key={l} value={l}>
                          {levelName(l)}
                        </option>
                      ))}
                    </select>
                    <select value={r.size} aria-label="Size" onChange={(e) => setRoom(r.id, { size: e.target.value as RoomSize })}>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                    <select
                      value={r.flooring}
                      aria-label="Flooring"
                      onChange={(e) => setRoom(r.id, { flooring: e.target.value as Flooring })}
                    >
                      <option value="hard">Hard floor</option>
                      <option value="carpet">Carpet</option>
                    </select>
                    <button className="link danger" onClick={() => set('rooms', rooms.filter((x) => x.id !== r.id))}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="hint">Add a room (rename it to anything, e.g. "Sam's room"):</p>
      <div className="filters">
        {(Object.keys(ROOM_TYPES) as RoomType[]).map((t) => (
          <button key={t} className="chip" onClick={() => set('rooms', [...rooms, makeRoom(t, rooms)])}>
            + {ROOM_TYPES[t].label}
          </button>
        ))}
      </div>

      <h3>Features & appliances</h3>
      <div className="toggles">
        {FEATURES.map(([k, label]) => (
          <label key={k} className="check">
            <input
              type="checkbox"
              checked={value.features.includes(k)}
              onChange={(e) => set('features', e.target.checked ? [...value.features, k] : value.features.filter((f) => f !== k))}
            />
            {label}
          </label>
        ))}
      </div>

      <h3>Pets & vehicles</h3>
      <div className="form-grid">
        {PETS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type="number"
              min={0}
              max={20}
              value={value.pets[k] ?? 0}
              onChange={(e) => set('pets', { ...value.pets, [k as PetKey]: clampInt(e.target.value, 0, 20) })}
            />
          </label>
        ))}
        <label>
          Cars
          <input type="number" min={0} max={6} value={value.vehicles} onChange={(e) => set('vehicles', clampInt(e.target.value, 0, 6))} />
        </label>
      </div>
    </div>
  );
}
