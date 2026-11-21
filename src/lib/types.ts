export type Category = "breakfast" | "lunch" | "dinner" | "snack" | "exercise" | "injection";

export interface CategoryMeta {
  key: Category;
  label: string;
  en: string;
}

/** All log categories, in display order. */
export const CATEGORIES: CategoryMeta[] = [
  { key: "breakfast", label: "아침", en: "BREAKFAST" },
  { key: "lunch", label: "점심", en: "LUNCH" },
  { key: "dinner", label: "저녁", en: "DINNER" },
  { key: "snack", label: "간식", en: "SNACK" },
  { key: "exercise", label: "운동", en: "EXERCISE" },
  { key: "injection", label: "주사", en: "INJECTION" },
];

/** The five diet/exercise columns of the Daily Log grid. */
export const MAIN_CATEGORIES = CATEGORIES.filter((c) => c.key !== "injection");
export const CATEGORY_KEYS: Category[] = CATEGORIES.map((c) => c.key);

/** Max length of the one-line daily condition note. */
export const NOTE_MAX = 200;

export interface LogItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface DayEntry {
  weight?: number;
  logs: Partial<Record<Category, LogItem[]>>;
  /** One-line condition / memo for the day (≤ NOTE_MAX chars). */
  note?: string;
}

export interface AppData {
  version: 1;
  goalWeight: number;
  days: Record<string, DayEntry>; // key: YYYY-MM-DD
  tags: Record<Category, string[]>;
}

export const DEFAULT_GOAL = 65;

export const DEFAULT_TAGS: Record<Category, string[]> = {
  breakfast: ["#그릭요거트", "#오트밀", "#삶은계란2개", "#바나나"],
  lunch: ["#닭가슴살", "#현미밥반공기", "#샐러드", "#포케"],
  dinner: ["#연어구이", "#두부스테이크", "#고구마", "#야채볶음"],
  snack: ["#아몬드한줌", "#프로틴쉐이크", "#아메리카노", "#방울토마토"],
  exercise: ["#유산소40분", "#웨이트60분", "#걷기1만보", "#러닝5km"],
  injection: ["#위고비0.25mg", "#위고비0.5mg", "#마운자로2.5mg", "#복부", "#허벅지", "#팔"],
};

/** One-tap condition chips for the daily note. */
export const NOTE_PRESETS = ["회식", "붓기", "컨디션 좋음", "컨디션 나쁨", "공복 상쾌", "수면 부족", "생리 중", "메스꺼움"];

export const emptyData = (): AppData => ({
  version: 1,
  goalWeight: DEFAULT_GOAL,
  days: {},
  tags: structuredClone(DEFAULT_TAGS),
});
