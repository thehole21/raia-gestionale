import { isWorkClosed, type Order, workDue } from './data';

const SOLICITATION_NOTICE_MS = 48 * 60 * 60 * 1000;

export function automaticSolicitationKey(order: Order, now = Date.now()): string | null {
  const dueDates = [...new Set(order.lines
    .filter(line => !isWorkClosed(line))
    .map(line => workDue(line, order))
    .filter((due): due is string => !!due)
    .filter(due => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
      if (!match) return false;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const dueStart = new Date(year, month - 1, day);
      if (dueStart.getFullYear() !== year || dueStart.getMonth() !== month - 1 || dueStart.getDate() !== day) return false;
      const deadline = new Date(year, month - 1, day + 1).getTime() - 1;
      return now >= deadline - SOLICITATION_NOTICE_MS;
    }))].sort();

  return dueDates.length ? dueDates.join(',') : null;
}

export function isOrderAutomaticallySolicited(order: Order, now = Date.now()): boolean {
  const key = automaticSolicitationKey(order, now);
  return !!key && order.solicitedAutoDismissedDue !== key;
}

export function isOrderSolicited(order: Order, now = Date.now()): boolean {
  return !!order.solicited || isOrderAutomaticallySolicited(order, now);
}
