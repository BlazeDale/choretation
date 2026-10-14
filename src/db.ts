import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Chore, HistoryEntry, Household, NewChore } from './types';

// Layout: households/{uid} with `chores` and `history` subcollections.
const householdRef = (uid: string) => doc(db, 'households', uid);
const choresCol = (uid: string) => collection(db, 'households', uid, 'chores');
const historyCol = (uid: string) => collection(db, 'households', uid, 'history');

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
  };
  batch.set(doc(historyCol(uid)), entry);
  return batch.commit();
}

/** Writes are applied locally right away (and synced later if offline), so callers don't block on them. */
export function fireAndForget(p: Promise<unknown>) {
  p.catch((e) => {
    console.error(e);
    alert(`Couldn't save: ${e instanceof Error ? e.message : e}`);
  });
}
