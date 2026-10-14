import { useEffect, useState } from 'react';
import { watchHistory } from '../db';
import { formatMinutes } from '../format';
import { addDays, todayStr } from '../rotation';
import type { HistoryEntry, Member } from '../types';

export function History({ uid, members }: { uid: string; members: Member[] }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  useEffect(() => watchHistory(uid, 200, setEntries), [uid]);

  if (!entries) return <p className="empty">Loading…</p>;

  const since = addDays(todayStr(), -30);
  const recent = entries.filter((e) => e.date >= since);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

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
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing completed yet.</p>
      )}
    </div>
  );
}
