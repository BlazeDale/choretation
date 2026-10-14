export const FREQUENCIES = [1, 2, 3, 7, 14, 30, 60, 90, 180, 365];

export function formatEvery(days: number): string {
  switch (days) {
    case 1: return 'Daily';
    case 7: return 'Weekly';
    case 14: return 'Every 2 weeks';
    case 30: return 'Monthly';
    case 60: return 'Every 2 months';
    case 90: return 'Quarterly';
    case 180: return 'Every 6 months';
    case 365: return 'Yearly';
    default: return `Every ${days} days`;
  }
}

export function formatMinutes(m: number): string {
  m = Math.round(m);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function dueLabel(days: number): string {
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export const newId = () => crypto.randomUUID().slice(0, 8);
