"use client";

import { useCallback, useEffect, useState } from "react";
import { AppData, Category, DayEntry, emptyData, LogItem } from "./types";
import { addDays, todayKey } from "./date";

const STORAGE_KEY = "plugplay-diet:v1";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as AppData;
    const base = emptyData();
    return {
      ...base,
      ...parsed,
      tags: { ...base.tags, ...(parsed.tags ?? {}) },
      days: parsed.days ?? {},
    };
  } catch {
    return emptyData();
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Generates 14 days of plausible, gently-declining weight data with meals. */
export function makeSample(goal = 65): AppData {
  const data = emptyData();
  data.goalWeight = goal;
  const meals: Record<Category, string[][]> = {
    breakfast: [["그릭요거트 + 블루베리"], ["오트밀 40g, 아몬드우유"], ["삶은계란 2개, 바나나"], ["통밀토스트 1장, 아보카도"]],
    lunch: [["닭가슴살 샐러드"], ["현미밥 반공기, 제육 소량"], ["포케 (연어)"], ["쌀국수 (면 반만)"], ["김밥 반줄, 두유"]],
    dinner: [["연어구이, 브로콜리"], ["두부스테이크, 고구마 1개"], ["소고기 우둔 150g, 샐러드"], ["닭가슴살 볶음밥"], ["회식 - 삼겹살 2인분 😇"]],
    snack: [["아몬드 한 줌"], ["프로틴쉐이크"], ["아메리카노"], [], ["방울토마토 10알"]],
    exercise: [["유산소 40분 (인클라인 워킹)"], ["웨이트 60분 — 하체"], ["걷기 1만보"], [], ["러닝 5km 31:20"], ["웨이트 60분 — 등/이두"]],
  };
  const today = todayKey();
  for (let i = 13; i >= 0; i--) {
    const key = addDays(today, -i);
    // downward trend (~0.2kg/day) + daily water-weight noise + a post-dinner-party bump
    const trend = goal + 4.1 + i * 0.21;
    const noise = (Math.sin(i * 2.3) + Math.cos(i * 1.7)) * 0.18;
    const bump = i === 6 ? 0.8 : i === 5 ? 0.4 : 0;
    const w = trend + noise + bump;
    const entry: DayEntry = { weight: round1(w), logs: {} };
    (Object.keys(meals) as Category[]).forEach((cat, ci) => {
      const pick = meals[cat][(i + ci * 3) % meals[cat].length];
      if (cat === "dinner" && i === 7) {
        entry.logs[cat] = [{ id: uid(), text: meals.dinner[4][0], createdAt: Date.now() }];
        return;
      }
      if (pick.length) entry.logs[cat] = pick.map((text) => ({ id: uid(), text, createdAt: Date.now() }));
    });
    data.days[key] = entry;
  }
  return data;
}

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

  const removeLog = useCallback(
    (key: string, cat: Category, id: string) =>
      updateDay(key, (d) => ({ ...d, logs: { ...d.logs, [cat]: (d.logs[cat] ?? []).filter((l) => l.id !== id) } })),
    [updateDay]
  );

  const setGoal = useCallback((goalWeight: number) => setData((p) => ({ ...p, goalWeight: round1(goalWeight) })), []);

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

  return { data, ready, setWeight, addLog, removeLog, setGoal, addTag, removeTag, fillSample, resetAll, replaceAll };
}

export type DietStore = ReturnType<typeof useDietStore>;

/* ---------- Backup / restore ---------- */

export const BACKUP_APP_ID = "weight-log";

export function makeBackup(data: AppData) {
  return { app: BACKUP_APP_ID, exportedAt: new Date().toISOString(), data };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATS: Category[] = ["breakfast", "lunch", "dinner", "snack", "exercise"];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Validates and normalises an imported backup. Accepts the wrapped export format
 * ({ app, exportedAt, data }) or a bare AppData object. Throws with a Korean message on failure.
 */
export function parseBackup(raw: unknown): AppData {
  const src = isObj(raw) && isObj(raw.data) ? raw.data : raw;
  if (!isObj(src) || !isObj(src.days)) throw new Error("체중 기록 백업 파일 형식이 아닙니다.");

  const out = emptyData();
  if (typeof src.goalWeight === "number" && src.goalWeight > 20 && src.goalWeight < 300) out.goalWeight = round1(src.goalWeight);

  for (const [key, val] of Object.entries(src.days)) {
    if (!DATE_RE.test(key) || !isObj(val)) continue;
    const entry: DayEntry = { logs: {} };
    if (typeof val.weight === "number" && val.weight >= 20 && val.weight <= 300) entry.weight = round1(val.weight);
    if (isObj(val.logs)) {
      for (const cat of CATS) {
        const list = val.logs[cat];
        if (!Array.isArray(list)) continue;
        const items = list
          .filter((it): it is Record<string, unknown> => isObj(it) && typeof it.text === "string" && !!it.text.trim())
          .map((it) => ({
            id: typeof it.id === "string" ? it.id : uid(),
            text: String(it.text).slice(0, 500),
            createdAt: typeof it.createdAt === "number" ? it.createdAt : Date.now(),
          }));
        if (items.length) entry.logs[cat] = items;
      }
    }
    if (entry.weight !== undefined || Object.keys(entry.logs).length) out.days[key] = entry;
  }

  if (isObj(src.tags)) {
    for (const cat of CATS) {
      const t = src.tags[cat];
      if (Array.isArray(t)) out.tags[cat] = [...new Set(t.filter((x): x is string => typeof x === "string" && !!x.trim()))];
    }
  }
  return out;
}

export function summarize(data: AppData) {
  const keys = Object.keys(data.days).sort();
  const weights = keys.filter((k) => data.days[k].weight !== undefined).length;
  const logs = keys.reduce((n, k) => n + Object.values(data.days[k].logs).reduce((m, l) => m + (l?.length ?? 0), 0), 0);
  return { days: keys.length, weights, logs, from: keys[0], to: keys[keys.length - 1] };
}

/** Consecutive days with a recorded weight, ending today (or yesterday if today is empty). */
export function computeStreak(data: AppData): number {
  const has = (k: string) => {
    const d = data.days[k];
    return !!d && (d.weight !== undefined || Object.values(d.logs).some((l) => l && l.length));
  };
  let k = todayKey();
  if (!has(k)) k = addDays(k, -1);
  let n = 0;
  while (has(k)) {
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
