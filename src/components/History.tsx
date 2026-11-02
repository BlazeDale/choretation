import { useEffect, useState } from 'react';
import { fireAndForget, undoCompletion, watchHistory } from '../db';
import { formatMinutes } from '../format';
import { undoPatch, undoableEntries } from '../ledger';
import { addDays, todayStr } from '../rotation';
import type { Chore, HistoryEntry, Member } from '../types';

export function History({ uid, members, chores }: { uid: string; members: Member[]; chores: Chore[] }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  useEffect(() => watchHistory(uid, 200, setEntries), [uid]);

  if (!entries) return <p className="empty">Loading…</p>;

  const since = addDays(todayStr(), -30);
  const recent = entries.filter((e) => e.date >= since);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';
  const undoable = undoableEntries(entries, chores, todayStr());

  function undo(e: HistoryEntry) {
    const chore = chores.find((c) => c.id === e.choreId);
    if (!chore) return;
    const previous = entries!.slice(entries!.indexOf(e) + 1).find((x) => x.choreId === e.choreId);
    fireAndForget(undoCompletion(uid, e.id, e.choreId, undoPatch(e, chore, previous)));
  }

  return (
    <div>
      <h2>Last 30 days</h2>
      <div className="loads">
        {members.map((m) => {
          const mine = recent.filter((e) => e.memberId === m.id);
          return (
            <span key={m.id} className="load">
              {m.name}: <strong>{formatMinutes(mine.reduce((s, e) => s + e.minutes, 0))}</strong> · {mine.length} chores
            </span>
          );
        })}
      </div>

      <h2>Recent</h2>
      {entries.length ? (
        <ul className="rows history">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="grow">{e.choreName}</span>
              <span className="meta">
                {nameOf(e.memberId)} · {formatMinutes(e.minutes)} · {e.date}
                {e.assumed && ' · not ticked, counted as done'}
              </span>
              {undoable.has(e.id) && (
                <button className="link" onClick={() => undo(e)}>
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing completed yet.</p>
      )}
    </div>
  );
}
