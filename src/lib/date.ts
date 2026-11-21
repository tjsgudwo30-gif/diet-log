const pad = (n: number) => String(n).padStart(2, "0");

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-31 etc.). */
export const isDateKey = (v: unknown): v is string => {
  if (typeof v !== "string" || !KEY_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

/** Whole calendar days from `a` to `b` (b − a), DST-safe. */
export const diffDays = (a: string, b: string) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];

export const weekday = (k: string) => WEEK[fromKey(k).getDay()];
export const weekdayKo = (k: string) => WEEK_KO[fromKey(k).getDay()];

export const shortLabel = (k: string) => {
  const d = fromKey(k);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
