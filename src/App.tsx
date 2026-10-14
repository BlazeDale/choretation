import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ChoreList } from './components/ChoreList';
import { History } from './components/History';
import { Login } from './components/Login';
import { PrintMonth } from './components/PrintMonth';
import { Settings } from './components/Settings';
import { Setup } from './components/Setup';
import { Today } from './components/Today';
import { fireAndForget, saveHousehold, updateChores, watchChores, watchHousehold } from './db';
import { auth, firebaseConfigured } from './firebase';
import type { Chore, Household } from './types';
import { DEFAULT_DAILY_LIMIT, coverFreeDays, todayStr } from './rotation';

export default function App() {
  return firebaseConfigured ? <Main /> : <NotConfigured />;
}

function NotConfigured() {
  return (
    <div className="center">
      <div className="card-panel">
        <h1>Firebase isn't configured</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Firebase web app config, and restart{' '}
          <code>npm run dev</code>. See the README for the full steps.
        </p>
      </div>
    </div>
  );
}

const TABS = ['Today', 'Chores', 'Print', 'History', 'Settings'] as const;
type Tab = (typeof TABS)[number];

function Main() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [chores, setChores] = useState<Chore[]>([]);
  const [tab, setTab] = useState<Tab>('Today');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setHousehold(undefined);
      setChores([]);
      return;
    }
    const offHousehold = watchHousehold(user.uid, setHousehold);
    const offChores = watchChores(user.uid, setChores);
    return () => {
      offHousehold();
      offChores();
    };
  }, [user]);

  // Chores due (or overdue) on someone's free day pass to someone who's around. Re-checked as
  // data changes, so a chore left undone doesn't land on its owner's day off.
  useEffect(() => {
    if (!user || !household?.members?.length || !chores.length) return;
    const moved = coverFreeDays(chores, household.members, household.dailyLimit ?? DEFAULT_DAILY_LIMIT, todayStr());
    if (moved.length) fireAndForget(updateChores(user.uid, moved));
  }, [user, household, chores]);

  if (user === undefined) return <div className="center">Loading…</div>;
  if (user === null) return <Login />;
  if (household === undefined) return <div className="center">Loading…</div>;
  if (!household?.home || !household.members?.length) return <Setup uid={user.uid} />;

  const dailyLimit = household.dailyLimit ?? DEFAULT_DAILY_LIMIT;
  const props = { uid: user.uid, chores, members: household.members, dailyLimit };

  return (
    <div className="page">
      <header className="top no-print">
        <h1>{household.name}</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
      </header>
      {tab === 'Today' && <Today {...props} />}
      {tab === 'Chores' && <ChoreList {...props} rooms={household.home?.rooms ?? []} />}
      {tab === 'Print' && (
        <PrintMonth
          chores={chores}
          members={household.members}
          rooms={household.home?.rooms ?? []}
          dailyLimit={dailyLimit}
          notes={household.notes ?? {}}
          onNote={(key, text) => fireAndForget(saveHousehold(user.uid, { notes: { [key]: text } }))}
        />
      )}
      {tab === 'History' && <History uid={user.uid} members={household.members} />}
      {tab === 'Settings' && <Settings uid={user.uid} household={household} chores={chores} />}
    </div>
  );
}
