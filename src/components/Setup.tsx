import { useEffect, useState } from 'react';
import { addChores, saveHousehold } from '../db';
import { newId } from '../format';
import { DEFAULT_HOME, generateChores } from '../generator';
import { DEFAULT_DAILY_LIMIT, redistribute, scheduleNew } from '../rotation';
import type { ChoreDraft, HomeConfig, Member } from '../types';
import { ChorePicker } from './ChorePicker';
import { HomeForm } from './HomeForm';

/** First-run wizard: people → home → review generated chores. */
const DRAFT_KEY = 'choretation-setup-draft';

interface Draft {
  step: number;
  name: string;
  members: Member[];
  home: HomeConfig;
  dailyLimit: number;
}

function loadDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    return d?.home?.rooms ? d : null;
  } catch {
    return null;
  }
}

export function Setup({ uid }: { uid: string }) {
  const [draft] = useState(loadDraft);
  const [step, setStep] = useState(draft?.step ?? 1);
  const [name, setName] = useState(draft?.name ?? 'Our home');
  const [members, setMembers] = useState<Member[]>(draft?.members ?? [{ id: newId(), name: '' }]);
  const [home, setHome] = useState<HomeConfig>(draft?.home ?? DEFAULT_HOME);
  const [dailyLimit, setDailyLimit] = useState(draft?.dailyLimit ?? DEFAULT_DAILY_LIMIT);

  // Keep progress across reloads until setup finishes.
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, name, members, home, dailyLimit } satisfies Draft));
  }, [step, name, members, home, dailyLimit]);

  const named = members.filter((m) => m.name.trim()).map((m) => ({ ...m, name: m.name.trim() }));

  async function finish(chosen: ChoreDraft[]) {
    // Chores first: saving the household is what flips the app out of setup mode.
    // Spread the first schedule across days to fit the daily limit.
    const scheduled = scheduleNew(chosen, [], named).map((c, i) => ({ ...c, id: String(i) }));
    const placed = new Map(redistribute(scheduled, named, dailyLimit));
    await addChores(uid, scheduled.map(({ id, ...c }) => ({ ...c, ...placed.get(id) })));
    await saveHousehold(uid, { name: name.trim() || 'Our home', members: named, home, dailyLimit });
    localStorage.removeItem(DRAFT_KEY);
  }

  return (
    <div className="page">
      <h1>Set up your household</h1>
      <ol className="steps">
        {['People', 'Home', 'Chores'].map((s, i) => (
          <li key={s} className={step === i + 1 ? 'current' : ''}>
            {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="card-panel">
          <label>
            Household name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <h3>Who shares the chores?</h3>
          {members.map((m, i) => (
            <div key={m.id} className="inline">
              <input
                placeholder={`Person ${i + 1}`}
                value={m.name}
                autoFocus={i === members.length - 1}
                onChange={(e) => setMembers(members.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
              />
              {members.length > 1 && (
                <button className="link" onClick={() => setMembers(members.filter((x) => x.id !== m.id))}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <label>
            Max chore time per person per day (minutes)
            <input
              type="number"
              min={10}
              max={480}
              step={5}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Math.min(480, Math.max(10, Math.round(Number(e.target.value) || 0))))}
            />
          </label>
          <div className="actions">
            <button onClick={() => setMembers([...members, { id: newId(), name: '' }])}>+ Add person</button>
            <button className="primary" disabled={!named.length} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card-panel">
          <p className="hint">Describe your home and we'll build a chore list where nothing takes more than 2 hours.</p>
          <HomeForm value={home} onChange={setHome} showLayouts />
          <div className="actions">
            <button onClick={() => setStep(1)}>Back</button>
            <button className="primary" onClick={() => setStep(3)}>
              Generate chores
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <ChorePicker
          drafts={generateChores(home, named.length)}
          peopleCount={named.length}
          confirmLabel="Start rotation"
          onBack={() => setStep(2)}
          onConfirm={finish}
        />
      )}
    </div>
  );
}
