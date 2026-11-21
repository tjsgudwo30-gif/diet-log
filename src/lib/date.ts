const pad = (n: number) => String(n).padStart(2, "0");

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

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
