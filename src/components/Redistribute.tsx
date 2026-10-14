import { useState } from 'react';
import { fireAndForget, updateChores } from '../db';
import { redistribute } from '../rotation';
import type { Chore, Member, NewChore } from '../types';

/** Spreads chores across days to fit the daily limit, with an undo for the previous schedule. */
export function RedistributeButton({
  uid,
  chores,
  members,
  dailyLimit,
  label = 'Redistribute schedule',
}: {
  uid: string;
  chores: Chore[];
  members: Member[];
  dailyLimit: number;
  label?: string;
}) {
  const [result, setResult] = useState<{ moved: number; undo: Array<[string, Partial<NewChore>]> } | null>(null);

  function run() {
    const byId = new Map(chores.map((c) => [c.id, c]));
    const changes = redistribute(chores, members, dailyLimit);
    const undo = changes.map(([id]): [string, Partial<NewChore>] => {
      const c = byId.get(id)!;
      return [id, { nextDue: c.nextDue, assigneeId: c.assigneeId }];
    });
    fireAndForget(updateChores(uid, changes));
    setResult({ moved: changes.length, undo });
  }

  return (
    <span className="row-controls">
      <button className="primary" onClick={run}>
        {label}
      </button>
      {result && (
        <span>
          {result.moved ? `Rescheduled ${result.moved} chores.` : 'Already evenly spread.'}
          {result.moved > 0 && (
            <button
              className="link"
              onClick={() => {
                fireAndForget(updateChores(uid, result.undo));
                setResult(null);
              }}
            >
              Undo
            </button>
          )}
        </span>
      )}
    </span>
  );
}
