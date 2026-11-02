import { useEffect, useMemo, useState } from 'react';
import { watchHistoryBetween, watchMonth, watchOldestHistory } from '../db';
import { keepSince, monthLog, monthsBack } from '../ledger';
import { monthBounds } from '../rotation';
import type { Chore, HistoryEntry, MonthRecord } from '../types';

/** What the locked record says happened in a month, on the days before today. */
export function useMonthLog(uid: string, year: number, month0: number, today: string, enabled: boolean) {
  const { first, last } = monthBounds(year, month0);
  const [record, setRecord] = useState<MonthRecord | null>(null);
  const [done, setDone] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    setRecord(null);
    setDone([]);
    if (!enabled) return;
    const offMonth = watchMonth(uid, first.slice(0, 7), setRecord);
    const offDone = watchHistoryBetween(uid, first, last, setDone);
    return () => {
      offMonth();
      offDone();
    };
  }, [uid, first, last, enabled]);
  const items = useMemo(() => monthLog(record?.planned ?? [], done, today), [record, done, today]);
  return { items, hasPlan: !!record };
}

/** How many months back there's anything to see: to the first record, within how long records are kept. */
export function useMonthsBack(uid: string, chores: Pick<Chore, 'everyDays'>[], today: string) {
  const [oldest, setOldest] = useState<string | null>(null);
  useEffect(() => watchOldestHistory(uid, setOldest), [uid]);
  return monthsBack(oldest, keepSince(chores, today), today);
}
