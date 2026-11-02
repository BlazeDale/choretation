import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { closeMonths, expiredMonths, keepSince, monthKey, planMonth, samePlan } from './ledger';
import { todayStr } from './rotation';
import type { Chore, HistoryEntry, Household, Member, MonthRecord, NewChore } from './types';

// Layout: households/{uid} with `chores`, `history` and `months` subcollections.
const householdRef = (uid: string) => doc(db, 'households', uid);
const choresCol = (uid: string) => collection(db, 'households', uid, 'chores');
const historyCol = (uid: string) => collection(db, 'households', uid, 'history');
const monthsCol = (uid: string) => collection(db, 'households', uid, 'months');

const BATCH_LIMIT = 450;

export function watchHousehold(uid: string, cb: (h: Household | null) => void) {
  return onSnapshot(householdRef(uid), (s) => cb(s.exists() ? (s.data() as Household) : null));
}

export function saveHousehold(uid: string, data: Partial<Household>) {
  return setDoc(householdRef(uid), data, { merge: true });
}

export function watchChores(uid: string, cb: (chores: Chore[]) => void) {
  return onSnapshot(choresCol(uid), (s) => cb(s.docs.map((d) => ({ ...(d.data() as NewChore), id: d.id }))));
}

export function watchHistory(uid: string, max: number, cb: (entries: HistoryEntry[]) => void) {
  const q = query(historyCol(uid), orderBy('at', 'desc'), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<HistoryEntry, 'id'>), id: d.id }))));
}

export async function addChores(uid: string, chores: NewChore[]) {
  for (let i = 0; i < chores.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const c of chores.slice(i, i + BATCH_LIMIT)) batch.set(doc(choresCol(uid)), c);
    await batch.commit();
  }
}

export function updateChore(uid: string, id: string, patch: Partial<NewChore>) {
  return updateDoc(doc(choresCol(uid), id), patch);
}

export async function updateChores(uid: string, patches: Array<[string, Partial<NewChore>]>) {
  for (let i = 0; i < patches.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const [id, patch] of patches.slice(i, i + BATCH_LIMIT)) batch.update(doc(choresCol(uid), id), patch);
    await batch.commit();
  }
}

export function deleteChore(uid: string, id: string) {
  return deleteDoc(doc(choresCol(uid), id));
}

export function recordCompletion(uid: string, chore: Chore, patch: Partial<NewChore>, memberId: string, date: string) {
  const batch = writeBatch(db);
  batch.update(doc(choresCol(uid), chore.id), patch);
  const entry: Omit<HistoryEntry, 'id'> = {
    choreId: chore.id,
    choreName: chore.name,
    memberId,
    minutes: chore.minutes,
    date,
    at: Date.now(),
    area: chore.area,
  };
  batch.set(doc(historyCol(uid)), entry);
  return batch.commit();
}

/** A month's plan (null until one's been recorded) and what was completed in it. */
export function watchMonth(uid: string, month: string, cb: (record: MonthRecord | null) => void) {
  return onSnapshot(doc(monthsCol(uid), month), (s) => cb(s.exists() ? (s.data() as MonthRecord) : null));
}

export function watchHistoryBetween(uid: string, first: string, last: string, cb: (entries: HistoryEntry[]) => void) {
  const q = query(historyCol(uid), where('date', '>=', first), where('date', '<=', last));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<HistoryEntry, 'id'>), id: d.id }))));
}

async function deleteInBatches(refs: Array<Parameters<ReturnType<typeof writeBatch>['delete']>[0]>) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + BATCH_LIMIT)) batch.delete(r);
    await batch.commit();
  }
}

/**
 * Keeps the month records up to date: closes months that have ended, drops what's older than the
 * longest chore period, and records this month's plan. Closing marks chores as done, so it only acts
 * on data fresh from the server, never on a possibly stale local cache; offline it waits for next time.
 */
export async function syncLedger(uid: string, members: Member[], dailyLimit: number) {
  const [choreDocs, monthDocs] = await Promise.all([getDocsFromServer(choresCol(uid)), getDocsFromServer(monthsCol(uid))]);
  let chores = choreDocs.docs.map((d) => ({ ...(d.data() as NewChore), id: d.id }));
  // No chores back from the server means nothing to go on, and nothing should be expired because of it.
  if (!chores.length) return;
  let records = monthDocs.docs.map((d) => d.data() as MonthRecord);
  const today = todayStr();

  const closing = closeMonths(chores, members, records, today, dailyLimit);
  // History ids are fixed per chore and day, so an interrupted close repeats safely. Closed flags go last.
  for (let i = 0; i < closing.history.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { id, ...entry } of closing.history.slice(i, i + BATCH_LIMIT)) batch.set(doc(historyCol(uid), id), entry);
    await batch.commit();
  }
  if (closing.patches.length) await updateChores(uid, closing.patches);
  if (closing.months.length) {
    const batch = writeBatch(db);
    for (const r of closing.months) batch.set(doc(monthsCol(uid), r.month), r);
    await batch.commit();
    const patches = new Map(closing.patches);
    chores = chores.map((c) => ({ ...c, ...patches.get(c.id) }));
    records = [...records.filter((r) => !closing.months.some((m) => m.month === r.month)), ...closing.months];
  }

  const since = keepSince(chores, today);
  if (since) {
    const old = await getDocsFromServer(query(historyCol(uid), where('date', '<', since)));
    await deleteInBatches([
      ...old.docs.map((d) => d.ref),
      ...expiredMonths(records, since).map((m) => doc(monthsCol(uid), m)),
    ]);
  }

  const month = monthKey(today);
  const existing = records.find((r) => r.month === month);
  const planned = planMonth(chores, members, existing?.planned ?? [], today, dailyLimit);
  if (!existing || !samePlan(existing.planned, planned)) {
    await setDoc(doc(monthsCol(uid), month), { month, planned, closed: false } satisfies MonthRecord);
  }
}

/** Writes are applied locally right away (and synced later if offline), so callers don't block on them. */
export function fireAndForget(p: Promise<unknown>) {
  p.catch((e) => {
    console.error(e);
    alert(`Couldn't save: ${e instanceof Error ? e.message : e}`);
  });
}
