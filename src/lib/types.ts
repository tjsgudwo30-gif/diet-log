export type Category = "breakfast" | "lunch" | "dinner" | "snack" | "exercise";

export const CATEGORIES: { key: Category; label: string; en: string }[] = [
  { key: "breakfast", label: "아침", en: "BREAKFAST" },
  { key: "lunch", label: "점심", en: "LUNCH" },
  { key: "dinner", label: "저녁", en: "DINNER" },
  { key: "snack", label: "간식", en: "SNACK" },
  { key: "exercise", label: "운동", en: "EXERCISE" },
];

export interface LogItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface DayEntry {
  weight?: number;
  logs: Partial<Record<Category, LogItem[]>>;
}

export interface AppData {
  version: 1;
  goalWeight: number;
  days: Record<string, DayEntry>; // key: YYYY-MM-DD
  tags: Record<Category, string[]>;
}

export const DEFAULT_TAGS: Record<Category, string[]> = {
  breakfast: ["#그릭요거트", "#오트밀", "#삶은계란2개", "#바나나"],
  lunch: ["#닭가슴살", "#현미밥반공기", "#샐러드", "#포케"],
  dinner: ["#연어구이", "#두부스테이크", "#고구마", "#야채볶음"],
  snack: ["#아몬드한줌", "#프로틴쉐이크", "#아메리카노", "#방울토마토"],
  exercise: ["#유산소40분", "#웨이트60분", "#걷기1만보", "#러닝5km"],
};

export const emptyData = (): AppData => ({
  version: 1,
  goalWeight: 65,
  days: {},
  tags: structuredClone(DEFAULT_TAGS),
});
