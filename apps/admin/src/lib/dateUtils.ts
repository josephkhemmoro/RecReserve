/**
 * Returns a local ISO-like string for a Date, preserving the local timezone.
 * e.g., 9 PM EDT March 30 → "2026-03-30T21:00:00-04:00"
 */
export function toLocalISO(d: Date): string {
  const offset = d.getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const absOff = Math.abs(offset);
  const tzH = String(Math.floor(absOff / 60)).padStart(2, "0");
  const tzM = String(absOff % 60).padStart(2, "0");
  const tz = `${sign}${tzH}:${tzM}`;

  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");

  return `${y}-${mo}-${day}T${h}:${mi}:${s}${tz}`;
}

/**
 * Returns the local start-of-day as an ISO string with timezone offset.
 */
export function localDayStart(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  return toLocalISO(start);
}

/**
 * Returns the local end-of-day as an ISO string with timezone offset.
 */
export function localDayEnd(d: Date = new Date()): string {
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return toLocalISO(end);
}

/**
 * Returns the local start of month as an ISO string with timezone offset.
 */
export function localMonthStart(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
  return toLocalISO(start);
}

/**
 * Returns YYYY-MM-DD for a date using local time (not UTC).
 */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
