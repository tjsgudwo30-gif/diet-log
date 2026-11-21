"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AppData,
  Category,
  CATEGORY_KEYS,
  DayEntry,
  DEFAULT_GOAL,
  emptyData,
  LogItem,
  NOTE_MAX,
} from "./types";
import { addDays, diffDays, isDateKey, todayKey } from "./date";

const STORAGE_KEY = "plugplay-diet:v1";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const round1 = (n: number) => Math.round(n * 10) / 10;

export const GOAL_MIN = 20;
export const GOAL_MAX = 300;

/** Parses user-typed kg values: accepts "65,5" or "65.5"; returns null when invalid or out of range. */
export function parseKg(raw: string, min = GOAL_MIN, max = GOAL_MAX): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d*)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) && v >= min && v <= max ? round1(v) : null;
}

/** Single-line, trimmed, length-capped note ("" when empty). */
export const cleanNote = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);

export const NOTE_SEP = " · ";

/** Splits a note into its " · "-separated tokens (trimmed, empty ones dropped). */
export const noteTokens = (note: string) =>
  note
    .split("·")
    .map((t) => t.trim())
    .filter(Boolean);

export type AppendNoteResult = { ok: true; next: string } | { ok: false; reason: "empty" | "dup" | "max" };

/**
 * Appends `token` to `note` as a new " · " segment.
 * Duplicate check is per segment (so "컨디션 좋음" doesn't block "좋음", and vice versa),
 * and the result must fit in NOTE_MAX.
 */
export function appendNoteToken(note: string, token: string): AppendNoteResult {
  const t = cleanNote(token);
  if (!t) return { ok: false, reason: "empty" };
  const tokens = noteTokens(note);
  if (tokens.some((x) => x === t)) return { ok: false, reason: "dup" };
  const next = tokens.length ? [...tokens, t].join(NOTE_SEP) : t;
  if (next.length > NOTE_MAX) return { ok: false, reason: "max" };
  return { ok: true, next };
}

/* ---------- Load (corruption-safe) ---------- */

/**
 * Reads LocalStorage through the same validator as backup import, so a damaged value
 * (bad goalWeight, malformed days, wrong types) is normalised instead of breaking the UI.
 * Unparseable JSON is moved aside to a recovery key before the app starts fresh,
 * so the next autosave cannot silently overwrite it.
 */
function load(): AppData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyData(); // storage blocked (private mode etc.)
  }
  if (!raw) return emptyData();
  try {
    return parseBackup(JSON.parse(raw));
  } catch {
    try {
      localStorage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
    } catch {
      /* best effort */
    }
    return emptyData();
  }
}

/* ---------- Sample data ---------- */

/** Generates 14 days of plausible, gently-declining weight data with meals, weekly injections and notes. */
export function makeSample(goal = DEFAULT_GOAL): AppData {
  const data = emptyData();
  data.goalWeight = goal;
  const meals: Record<Exclude<Category, "injection">, string[][]> = {
    breakfast: [["그릭요거트 + 블루베리"], ["오트밀 40g, 아몬드우유"], ["삶은계란 2개, 바나나"], ["통밀토스트 1장, 아보카도"]],
    lunch: [["닭가슴살 샐러드"], ["현미밥 반공기, 제육 소량"], ["포케 (연어)"], ["쌀국수 (면 반만)"], ["김밥 반줄, 두유"]],
    dinner: [["연어구이, 브로콜리"], ["두부스테이크, 고구마 1개"], ["소고기 우둔 150g, 샐러드"], ["닭가슴살 볶음밥"], ["회식 - 삼겹살 2인분 😇"]],
    snack: [["아몬드 한 줌"], ["프로틴쉐이크"], ["아메리카노"], [], ["방울토마토 10알"]],
    exercise: [["유산소 40분 (인클라인 워킹)"], ["웨이트 60분 — 하체"], ["걷기 1만보"], [], ["러닝 5km 31:20"], ["웨이트 60분 — 등/이두"]],
  };
  const injections: Record<number, string> = { 14: "위고비 0.25mg · 복부 왼쪽", 7: "위고비 0.25mg · 복부 오른쪽" };
  const notes: Record<number, string> = {
    13: "주사 다음날 — 약간 메스꺼움",
    8: "회식 — 내일 붓기 예상",
    6: "붓기, 물 많이 마심",
    2: "공복 상쾌, 컨디션 좋음",
  };
  const now = Date.now();
  const today = todayKey();
  for (let i = 14; i >= 0; i--) {
    const key = addDays(today, -i);
    // downward trend (~0.2kg/day) + daily water-weight noise + a post-dinner-party bump
    const trend = goal + 4.1 + i * 0.21;
    const noise = (Math.sin(i * 2.3) + Math.cos(i * 1.7)) * 0.18;
    const bump = i === 7 ? 0.8 : i === 6 ? 0.4 : 0;
    const entry: DayEntry = { weight: round1(trend + noise + bump), logs: {} };
    (Object.keys(meals) as (keyof typeof meals)[]).forEach((cat, ci) => {
      const pick = cat === "dinner" && i === 8 ? meals.dinner[4] : meals[cat][(i + ci * 3) % meals[cat].length];
      if (pick.length) entry.logs[cat] = pick.map((text) => ({ id: uid(), text, createdAt: now }));
    });
    if (injections[i]) entry.logs.injection = [{ id: uid(), text: injections[i], createdAt: now }];
    if (notes[i]) entry.note = notes[i];
    data.days[key] = entry;
  }
  return data;
}

/* ---------- Store hook ---------- */

export function useDietStore() {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked */
    }
  }, [data, ready]);

  const updateDay = useCallback((key: string, fn: (d: DayEntry) => DayEntry) => {
    setData((prev) => {
      const cur = prev.days[key] ?? { logs: {} };
      return { ...prev, days: { ...prev.days, [key]: fn(cur) } };
    });
  }, []);

  const setWeight = useCallback(
    (key: string, weight: number | undefined) =>
      updateDay(key, (d) => ({ ...d, weight: weight === undefined ? undefined : round1(weight) })),
    [updateDay]
  );

  const addLog = useCallback(
    (key: string, cat: Category, text: string) => {
      const t = text.trim();
      if (!t) return;
      const item: LogItem = { id: uid(), text: t, createdAt: Date.now() };
      updateDay(key, (d) => ({ ...d, logs: { ...d.logs, [cat]: [...(d.logs[cat] ?? []), item] } }));
    },
    [updateDay]
  );

  /**
   * One-tap tag entry. Injection tags (drug / dose / site) are merged into the day's
   * latest injection record ("위고비0.5mg · 복부") instead of creating a new line each tap.
   */
  const addTagEntry = useCallback(
    (key: string, cat: Category, tag: string) => {
      // injection records read as prose ("위고비0.5mg · 복부"), so drop the leading #
      const t = (cat === "injection" ? tag.replace(/^#/, "") : tag).trim();
      if (!t) return;
      updateDay(key, (d) => {
        const list = d.logs[cat] ?? [];
        const last = list[list.length - 1];
        if (cat === "injection" && last) {
          if (last.text.includes(t)) return d;
          const merged = { ...last, text: `${last.text} · ${t}`.slice(0, 500) };
          return { ...d, logs: { ...d.logs, [cat]: [...list.slice(0, -1), merged] } };
        }
        return { ...d, logs: { ...d.logs, [cat]: [...list, { id: uid(), text: t, createdAt: Date.now() }] } };
      });
    },
    [updateDay]
  );

  const removeLog = useCallback(
    (key: string, cat: Category, id: string) =>
      updateDay(key, (d) => ({ ...d, logs: { ...d.logs, [cat]: (d.logs[cat] ?? []).filter((l) => l.id !== id) } })),
    [updateDay]
  );

  const updateLog = useCallback(
    (key: string, cat: Category, id: string, text: string) => {
      const t = text.trim();
      if (!t) return;
      updateDay(key, (d) => ({
        ...d,
        logs: { ...d.logs, [cat]: (d.logs[cat] ?? []).map((l) => (l.id === id ? { ...l, text: t } : l)) },
      }));
    },
    [updateDay]
  );

  /** Sets the day's one-line note; an empty string removes it. */
  const setNote = useCallback(
    (key: string, text: string) => {
      const n = cleanNote(text);
      updateDay(key, (d) => {
        const next = { ...d };
        if (n) next.note = n;
        else delete next.note;
        return next;
      });
    },
    [updateDay]
  );

  const setGoal = useCallback(
    (goalWeight: number) =>
      setData((p) => ({ ...p, goalWeight: round1(Math.min(GOAL_MAX, Math.max(GOAL_MIN, goalWeight))) })),
    []
  );

  const addTag = useCallback((cat: Category, tag: string) => {
    let t = tag.trim().replace(/\s+/g, "");
    if (!t) return;
    if (!t.startsWith("#")) t = "#" + t;
    setData((p) => (p.tags[cat].includes(t) ? p : { ...p, tags: { ...p.tags, [cat]: [...p.tags[cat], t] } }));
  }, []);

  const removeTag = useCallback(
    (cat: Category, tag: string) =>
      setData((p) => ({ ...p, tags: { ...p.tags, [cat]: p.tags[cat].filter((x) => x !== tag) } })),
    []
  );

  const fillSample = useCallback(() => setData((p) => makeSample(p.goalWeight)), []);
  const resetAll = useCallback(() => setData(emptyData()), []);
  const replaceAll = useCallback((next: AppData) => setData(next), []);

  return {
    data,
    ready,
    setWeight,
    addLog,
    addTagEntry,
    updateLog,
    removeLog,
    setNote,
    setGoal,
    addTag,
    removeTag,
    fillSample,
    resetAll,
    replaceAll,
  };
}

export type DietStore = ReturnType<typeof useDietStore>;

/* ---------- Backup / restore ---------- */

export const BACKUP_APP_ID = "weight-log";

export function makeBackup(data: AppData) {
  return { app: BACKUP_APP_ID, exportedAt: new Date().toISOString(), data };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Validates and normalises an imported backup (also used for LocalStorage on load).
 * Accepts the wrapped export format ({ app, exportedAt, data }) or a bare AppData object.
 * Older data without `injection` logs or `note` stays valid. Throws with a Korean message on failure.
 */
export function parseBackup(raw: unknown): AppData {
  const src = isObj(raw) && isObj(raw.data) ? raw.data : raw;
  if (!isObj(src) || !isObj(src.days)) throw new Error("체중 기록 백업 파일 형식이 아닙니다.");

  const out = emptyData();
  const g = src.goalWeight;
  if (typeof g === "number" && Number.isFinite(g) && g >= GOAL_MIN && g <= GOAL_MAX) out.goalWeight = round1(g);
  // otherwise the default goal from emptyData() is kept

  for (const [key, val] of Object.entries(src.days)) {
    if (!isDateKey(key) || !isObj(val)) continue;
    const entry: DayEntry = { logs: {} };
    if (typeof val.weight === "number" && Number.isFinite(val.weight) && val.weight >= 20 && val.weight <= 300)
      entry.weight = round1(val.weight);
    if (isObj(val.logs)) {
      for (const cat of CATEGORY_KEYS) {
        const list = val.logs[cat];
        if (!Array.isArray(list)) continue;
        const items = list
          .filter((it): it is Record<string, unknown> => isObj(it) && typeof it.text === "string" && !!it.text.trim())
          .map((it) => ({
            id: typeof it.id === "string" && it.id ? it.id : uid(),
            text: String(it.text).trim().slice(0, 500),
            createdAt: typeof it.createdAt === "number" ? it.createdAt : Date.now(),
          }));
        if (items.length) entry.logs[cat] = items;
      }
    }
    if (typeof val.note === "string") {
      const n = cleanNote(val.note);
      if (n) entry.note = n;
    }
    if (entry.weight !== undefined || Object.keys(entry.logs).length || entry.note) out.days[key] = entry;
  }

  if (isObj(src.tags)) {
    for (const cat of CATEGORY_KEYS) {
      const t = src.tags[cat];
      if (Array.isArray(t)) out.tags[cat] = [...new Set(t.filter((x): x is string => typeof x === "string" && !!x.trim()))];
    }
  }
  return out;
}

export function summarize(data: AppData) {
  const keys = Object.keys(data.days).sort();
  let weights = 0;
  let logs = 0;
  let injections = 0;
  let notes = 0;
  for (const k of keys) {
    const d = data.days[k];
    if (d.weight !== undefined) weights++;
    for (const [cat, list] of Object.entries(d.logs)) {
      const n = list?.length ?? 0;
      if (cat === "injection") injections += n;
      else logs += n;
    }
    if (d.note) notes++;
  }
  return { days: keys.length, weights, logs, injections, notes, from: keys[0], to: keys[keys.length - 1] };
}

/* ---------- Derived metrics ---------- */

const hasAnything = (d: DayEntry | undefined) =>
  !!d && (d.weight !== undefined || !!d.note || Object.values(d.logs).some((l) => l && l.length));

/** Consecutive days with any record, ending today (or yesterday if today is empty). */
export function computeStreak(data: AppData): number {
  let k = todayKey();
  if (!hasAnything(data.days[k])) k = addDays(k, -1);
  let n = 0;
  while (hasAnything(data.days[k])) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

/** Most recent recorded weight strictly before `key`. */
export function prevWeight(data: AppData, key: string): { key: string; weight: number } | null {
  const keys = Object.keys(data.days)
    .filter((k) => k < key && data.days[k].weight !== undefined)
    .sort();
  const k = keys[keys.length - 1];
  return k ? { key: k, weight: data.days[k].weight! } : null;
}

/** Latest weight at or before key (for prefilling the editor). */
export function latestWeight(data: AppData, key: string): number | undefined {
  if (data.days[key]?.weight !== undefined) return data.days[key].weight;
  return prevWeight(data, key)?.weight;
}

/**
 * Progress toward the goal, measured from the first weight ever recorded (the starting point)
 * to the goal. Returns null when there is no start above the goal to measure from.
 */
export function goalProgress(
  data: AppData,
  current: number
): { start: number; startKey: string; lost: number; total: number; pct: number } | null {
  const keys = Object.keys(data.days)
    .filter((k) => data.days[k].weight !== undefined)
    .sort();
  if (!keys.length) return null;
  const startKey = keys[0];
  const start = data.days[startKey].weight!;
  const total = start - data.goalWeight;
  if (total <= 0.05) return null;
  const lost = start - current;
  return { start, startKey, lost: round1(lost), total: round1(total), pct: Math.max(0, Math.min(1, lost / total)) };
}

/** Mean of recorded weights in [end − days + 1, end]; null when the window has no weights. */
export function windowAverage(data: AppData, end: string, days = 7): { avg: number; count: number } | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const w = data.days[addDays(end, -i)]?.weight;
    if (w !== undefined) {
      sum += w;
      count++;
    }
  }
  return count ? { avg: sum / count, count } : null;
}

export interface WeeklyStats {
  /** Average of the 7 days ending at `selected` (inclusive). */
  current: { avg: number; count: number } | null;
  /** Average of the 7 days before that (selected−13 … selected−7). */
  previous: { avg: number; count: number } | null;
  /** current − previous, rounded to 0.1; null if either window is empty. */
  delta: number | null;
}

/** 7-day average weight at `selected` and its change vs. the preceding 7 days (Δ 7D AVG). */
export function weeklyStats(data: AppData, selected: string): WeeklyStats {
  const current = windowAverage(data, selected, 7);
  const previous = windowAverage(data, addDays(selected, -7), 7);
  const delta = current && previous ? round1(current.avg - previous.avg) : null;
  return { current, previous, delta };
}

/** Latest injection on or before `key`, with days elapsed since it. */
export function lastInjection(
  data: AppData,
  key: string,
  { strict = false }: { strict?: boolean } = {}
): { key: string; text: string; daysAgo: number } | null {
  const keys = Object.keys(data.days)
    .filter((k) => (strict ? k < key : k <= key) && (data.days[k].logs.injection?.length ?? 0) > 0)
    .sort();
  const k = keys[keys.length - 1];
  if (!k) return null;
  const list = data.days[k].logs.injection!;
  return { key: k, text: list[list.length - 1].text, daysAgo: diffDays(k, key) };
}
