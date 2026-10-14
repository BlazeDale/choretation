import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { addChores, fireAndForget, saveHousehold, updateChores } from '../db';
import { auth } from '../firebase';
import { newId } from '../format';
import { DEFAULT_HOME, generateChores } from '../generator';
import {
  DEFAULT_DAILY_LIMIT,
  availableOn,
  averageDailyMinutes,
  coverFreeDays,
  memberLoads,
  pickAssignee,
  rebalance,
  scheduleNew,
} from '../rotation';
import type { Chore, HomeConfig, Household, Member } from '../types';
import { ChorePicker } from './ChorePicker';
import { HomeForm } from './HomeForm';
import { RedistributeButton } from './Redistribute';

export function Settings({ uid, household, chores }: { uid: string; household: Household; chores: Chore[] }) {
  const { members } = household;
  const [newName, setNewName] = useState('');
  const [home, setHome] = useState<HomeConfig>({ ...DEFAULT_HOME, ...household.home });
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const dailyLimit = household.dailyLimit ?? DEFAULT_DAILY_LIMIT;
  const average = Math.round(averageDailyMinutes(chores, members));

  const setMembers = (next: Member[]) => fireAndForget(saveHousehold(uid, { members: next }));

  function removeMember(m: Member) {
    const remaining = members.filter((x) => x.id !== m.id);
    if (!remaining.length || !confirm(`Remove ${m.name}? Their chores will be handed to others.`)) return;
    const load = memberLoads(chores, remaining);
    const patches: Array<[string, { assigneeId: string | null }]> = [];
    for (const c of chores.filter((c) => c.assigneeId === m.id)) {
      const id = pickAssignee(load, availableOn(remaining, c.nextDue));
      if (id) load.set(id, load.get(id)! + (c.minutes * 7) / c.everyDays);
      patches.push([c.id, { assigneeId: id }]);
    }
    setMembers(remaining);
    fireAndForget(updateChores(uid, patches));
  }

  function doRebalance() {
    const changes = rebalance(chores, members);
    fireAndForget(updateChores(uid, changes.map(([id, assigneeId]) => [id, { assigneeId }])));
    setMessage(changes.length ? `Reassigned ${changes.length} chores.` : 'Already balanced.');
  }

  const existingKeys = new Set(chores.map((c) => c.key).filter(Boolean));
  const newDrafts = generateChores(home, members.length).filter((d) => !existingKeys.has(d.key));

  if (reviewing) {
    return (
      <div>
        <h2>New chores for your updated home</h2>
        <ChorePicker
          drafts={newDrafts}
          peopleCount={members.length}
          confirmLabel="Add to rotation"
          onBack={() => setReviewing(false)}
          onConfirm={async (chosen) => {
            await addChores(uid, scheduleNew(chosen, chores, members));
            await saveHousehold(uid, { home });
            setReviewing(false);
            setMessage(`Added ${chosen.length} chores.`);
            setJustAdded(chosen.length > 0);
          }}
        />
      </div>
    );
  }

  return (
    <div className="settings">
      {message && <p className="notice">{message}</p>}
      {justAdded && (
        <div className="notice">
          <p>Spread the new chores across days to fit your daily limit?</p>
          <RedistributeButton uid={uid} chores={chores} members={members} dailyLimit={dailyLimit} />
        </div>
      )}

      <section className="card-panel">
        <h2>Household</h2>
        <label>
          Name
          <input
            defaultValue={household.name}
            onBlur={(e) => e.target.value.trim() && fireAndForget(saveHousehold(uid, { name: e.target.value.trim() }))}
          />
        </label>
      </section>

      <section className="card-panel">
        <h2>People</h2>
        {members.map((m) => (
          <div key={m.id} className="member">
          <div className="inline">
            <input
              defaultValue={m.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== m.name) setMembers(members.map((x) => (x.id === m.id ? { ...x, name } : x)));
              }}
            />
            {members.length > 1 && (
              <button className="link danger" onClick={() => removeMember(m)}>
                Remove
              </button>
            )}
          </div>
          <FreeDays
            value={m.freeDays ?? []}
            onChange={(freeDays) => {
              const next = members.map((x) => (x.id === m.id ? { ...x, freeDays } : x));
              setMembers(next);
              // Hand over (or move to another day) chores they already had on their new free days.
              const moved = coverFreeDays(chores, next, dailyLimit);
              if (moved.length) fireAndForget(updateChores(uid, moved));
              setMessage(
                `Updated ${m.name}'s free days${moved.length ? ` and moved ${moved.length} chores off them` : ''}.`,
              );
            }}
          />
          </div>
        ))}
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            setMembers([...members, { id: newId(), name: newName.trim() }]);
            setNewName('');
            setMessage('Added. Use "Rebalance" to give them a fair share of the chores.');
          }}
        >
          <input placeholder="Add a person" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button>Add</button>
        </form>
        <div className="actions">
          <button onClick={doRebalance}>Rebalance assignments</button>
        </div>
        <p className="hint">Rebalancing spreads weekly minutes evenly. Due dates are kept.</p>
      </section>

      <section className="card-panel">
        <h2>Daily schedule</h2>
        <label>
          Max chore time per person per day (minutes)
          <input
            type="number"
            min={10}
            max={480}
            step={5}
            defaultValue={dailyLimit}
            key={dailyLimit}
            onBlur={(e) => {
              const v = Math.min(480, Math.max(10, Math.round(Number(e.target.value) || dailyLimit)));
              if (v !== dailyLimit) fireAndForget(saveHousehold(uid, { dailyLimit: v }));
              else e.target.value = String(v);
            }}
          />
        </label>
        <p className="hint">
          Your chores average about {average} min per person on the days they're not free.
          {average > dailyLimit && ' That is above your limit, so some days will go over. Consider fewer or less frequent chores.'}
        </p>
        <RedistributeButton uid={uid} chores={chores} members={members} dailyLimit={dailyLimit} label="Redistribute across days" />
        <p className="hint">
          Moves due dates (each within one cycle of today) and assignees so no day piles up. Frequencies and times stay the
          same.
        </p>
      </section>

      <section className="card-panel">
        <h2>Home</h2>
        <p className="hint">Changed something? Update it here and add any chores that now apply. Existing chores are untouched.</p>
        <HomeForm value={home} onChange={setHome} />
        <div className="actions">
          <button className="primary" onClick={() => setReviewing(true)}>
            Find new chores ({newDrafts.length})
          </button>
        </div>
      </section>

      <section className="card-panel">
        <button onClick={() => signOut(auth)}>Sign out</button>
      </section>
    </div>
  );
}

const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Days of the week a person gets no chores. */
function FreeDays({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="free-days">
      <span className="unit">Free days:</span>
      {DAY_LETTERS.map((d, i) => (
        <button
          key={d}
          className={value.includes(i) ? 'chip on' : 'chip'}
          aria-pressed={value.includes(i)}
          onClick={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort())}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
