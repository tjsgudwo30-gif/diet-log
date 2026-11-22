"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { addDays, shortLabel, todayKey, weekdayKo } from "@/lib/date";
import {
  computeStreak,
  dayIndex,
  fmtDays,
  goalEta,
  goalProgress,
  injectionCycle,
  lastInjection,
  latestWeight,
  parseKg,
  prevWeight,
  weeklyStats,
  weightPace,
  type DietStore,
} from "@/lib/store";
import type { Category } from "@/lib/types";
import { etaText } from "./TrendChart";
import { AnimatedNumber, Cell, Dot, Label } from "./ui";

export function Hero({ store, selected }: { store: DietStore; selected: string }) {
  const { data, setWeight } = store;
  const weight = data.days[selected]?.weight;
  const prev = prevWeight(data, selected);
  const goal = data.goalWeight;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  /** Set by Esc so the blur that follows (input lingers during its exit animation) can't save. */
  const done = useRef(false);
  const viewRef = useRef<HTMLButtonElement>(null);

  const base = weight ?? latestWeight(data, selected) ?? goal + 5;
  const nudge = (d: number) => setWeight(selected, Math.max(20, Math.min(300, base + d)));

  const startEdit = () => {
    done.current = false;
    setInvalid(false);
    setDraft(weight !== undefined ? weight.toFixed(1) : "");
    setEditing(true);
  };
  const close = (refocus: boolean) => {
    done.current = true;
    setEditing(false);
    setInvalid(false);
    if (refocus) requestAnimationFrame(() => viewRef.current?.focus());
  };
  /**
   * Enter: save a valid value (20–300, "68,4" ok); an invalid one keeps the editor open and flags it.
   * Blur: save if valid, otherwise quietly keep the old value. Empty input never deletes —
   * deleting is the explicit "clear" button, so a stray tap can't wipe the day's weight.
   */
  const commit = (fromKeyboard: boolean) => {
    if (done.current) return;
    const v = draft.trim() === "" ? null : parseKg(draft);
    if (v === null && draft.trim() !== "" && fromKeyboard) {
      setInvalid(true);
      return;
    }
    if (v !== null) setWeight(selected, v);
    close(fromKeyboard);
  };

  const delta = weight !== undefined && prev ? weight - prev.weight : undefined;
  const toGoal = weight !== undefined ? weight - goal : undefined;

  const trend = delta === undefined ? null : delta < -0.04 ? "down" : delta > 0.04 ? "up" : "flat";
  const isToday = selected === todayKey();
  const firstRun = dayIndex(data).weights.length === 0;
  const progress = weight !== undefined ? goalProgress(data, weight) : null;

  // Day facts: meals / exercise / injection status / note — links the weight to the rest of the log
  const day = data.days[selected];
  const n = (keys: Category[]) => keys.reduce((s, k) => s + (day?.logs[k]?.length ?? 0), 0);
  const meals = n(["breakfast", "lunch", "dinner", "snack"]);
  const workouts = n(["exercise"]);
  const injectedToday = n(["injection"]) > 0;

  const lastInj = lastInjection(data, selected, { strict: true });
  const injDue = isToday && !injectedToday && !!lastInj && lastInj.daysAgo >= 7;
  const cycle = injectionCycle(data, selected);
  // rhythm first: the detail line truncates, and the drug text is the long part
  const cycleText = cycle.avgGap !== null ? `평균 ${fmtDays(cycle.avgGap)} 주기 · ` : "";
  const firstText = (keys: Category[]) =>
    keys
      .flatMap((k) => day?.logs[k] ?? [])
      .map((l) => l.text)
      .join(", ");

  /** Today panel rows: what was eaten / done / dosed / felt — the rest of the diary at a glance. */
  const status: { key: string; label: string; value: string; detail: string; on: boolean; dot?: "acid" | "blaze" }[] = [
    { key: "meal", label: "식단", value: meals ? `${meals}건` : "—", detail: firstText(["breakfast", "lunch", "dinner", "snack"]) || "아직 기록 없음", on: meals > 0 },
    { key: "ex", label: "운동", value: workouts ? `${workouts}건` : "—", detail: firstText(["exercise"]) || "아직 기록 없음", on: workouts > 0 },
    {
      key: "inj",
      label: "주사",
      value: injectedToday ? "투약함" : lastInj ? `D+${lastInj.daysAgo}` : "—",
      detail: injectedToday
        ? `${cycle.lastGap !== null ? `간격 ${fmtDays(cycle.lastGap)} · ` : ""}${cycleText}${firstText(["injection"])}`
        : lastInj
          ? `${injDue ? "투약 예정일 · " : ""}${cycleText}지난 ${shortLabel(lastInj.key)} ${lastInj.text}`
          : "투약 기록 없음",
      on: injectedToday || !!lastInj,
      dot: injectedToday ? "acid" : injDue ? "blaze" : undefined,
    },
    { key: "note", label: "컨디션", value: day?.note ? "✓" : "—", detail: day?.note || "한 줄 메모 없음", on: !!day?.note },
  ];
  const goToLog = () => document.getElementById("daily-log")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>

      {/* 01 · Main weight — the headline figure */}
      <Cell
        index="01"
        label={`${isToday ? "오늘의 체중" : "체중"} · ${shortLabel(selected)} ${weekdayKo(selected)}`}
        className="col-span-6 min-h-[230px] max-md:hidden md:col-span-7 md:min-h-[300px] xl:col-span-5"
        right={
          weight !== undefined && (
            <button
              type="button"
              onClick={() => setWeight(selected, undefined)}
              aria-label="이 날의 체중 기록 지우기"
              className="-my-2 -mr-2 flex items-center gap-1 px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/45 transition-colors hover:text-blaze"
            >
              <Trash2 size={12} strokeWidth={1.75} /> clear
            </button>
          )
        }
      >
        <div className="flex flex-1 flex-col justify-end px-5 pb-5 md:px-6 md:pb-6">
          <div className="flex items-end gap-3">
            <div className={`relative min-w-0 ${editing ? "flex-1" : ""}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                {editing ? (
                  <motion.form
                    key="edit"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      commit(true);
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-label="체중 (kg)"
                      aria-invalid={invalid || undefined}
                      aria-describedby="weight-edit-hint"
                      value={draft}
                      placeholder="00.0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setInvalid(false);
                        setDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6));
                      }}
                      onBlur={() => commit(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          close(true);
                        }
                      }}
                      className={`display-tight w-full border-b-[3px] bg-transparent text-[clamp(6.5rem,18vw,8rem)] outline-none placeholder:text-ink/15 md:text-[clamp(7rem,11vw,11rem)] ${
                        invalid ? "border-blaze text-blaze" : "border-ink"
                      }`}
                    />
                    <p id="weight-edit-hint" role={invalid ? "alert" : undefined} className="mt-2 font-mono text-[11px]">
                      {invalid ? (
                        <span className="text-blaze">20–300kg 사이 숫자를 입력하세요 · 예: 68.4 / 68,4</span>
                      ) : (
                        <span className="text-ink/50">Enter 저장 · Esc 취소</span>
                      )}
                    </p>
                  </motion.form>
                ) : (
                  <motion.button
                    key="view"
                    ref={viewRef}
                    type="button"
                    onClick={startEdit}
                    title="클릭해서 직접 입력"
                    aria-label={weight !== undefined ? `체중 ${weight.toFixed(1)}kg, 눌러서 수정` : "체중 입력하기"}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    whileTap={{ scale: 0.985 }}
                    transition={{ duration: 0.12 }}
                    className="group block cursor-text text-left"
                  >
                    {weight !== undefined ? (
                      <AnimatedNumber
                        value={weight}
                        className="display-tight block text-[clamp(6.5rem,18vw,8rem)] md:text-[clamp(7rem,11vw,11rem)]"
                      />
                    ) : (
                      <span className="display-tight block text-[clamp(6.5rem,18vw,8rem)] text-ink/12 md:text-[clamp(7rem,11vw,11rem)]">
                        00.0
                      </span>
                    )}
                    <span className="mt-1 block h-[3px] w-0 bg-ink transition-[width] duration-300 group-hover:w-full" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <span className="display-tight pb-[0.35em] text-[clamp(1.75rem,3vw,2.75rem)] text-ink/70">kg</span>
          </div>

          {firstRun && !editing && (
            <p className="mt-3 max-w-md font-mono text-[12px] leading-relaxed text-ink/55">
              숫자를 눌러 첫 체중을 입력하면 기록이 시작됩니다. 둘러보려면 오른쪽 위 설정에서 샘플 데이터를 채워 보세요.
            </p>
          )}

          <div className="mt-5 hidden items-center gap-2 md:flex">
            <StepButton label="0.1kg 감소" onClick={() => nudge(-0.1)}>
              <Minus size={16} strokeWidth={2} />
            </StepButton>
            <StepButton label="0.1kg 증가" onClick={() => nudge(0.1)}>
              <Plus size={16} strokeWidth={2} />
            </StepButton>
            <Label className="ml-1">±0.1 kg</Label>
          </div>
        </div>
      </Cell>

      {/* 02 + 03 · Change and goal — second priority, stacked */}
      <div className="col-span-6 grid grid-cols-2 max-md:hidden md:col-span-5 md:flex md:flex-col xl:col-span-3 [&>*]:flex-1">
        <Cell index="02" label="직전 기록 대비" className="min-h-[150px] border-r border-ink/15 md:border-r-0 md:border-b">
          <div className="flex flex-1 flex-col justify-end gap-2 px-5 pb-5 md:px-6">
            {delta !== undefined && prev ? (
              <>
                <div className="flex items-end gap-2">
                  <AnimatedNumber
                    value={delta}
                    signed
                    className={`display-tight text-[clamp(2.75rem,4.5vw,4rem)] ${trend === "up" ? "text-blaze" : ""}`}
                  />
                  <span className="display-tight pb-[0.3em] text-xl text-ink/70">kg</span>
                </div>
                <p className="flex items-center gap-2 font-mono text-[11px] text-ink/55">
                  <Dot tone={trend === "down" ? "acid" : trend === "up" ? "blaze" : "ink"} />
                  {trend === "down" ? "감소" : trend === "up" ? "증가" : "유지"} · {shortLabel(prev.key)} {prev.weight.toFixed(1)}
                </p>
              </>
            ) : (
              <p className="font-mono text-[12px] text-ink/45">{weight === undefined ? "체중을 입력하세요" : "이전 기록 없음"}</p>
            )}
          </div>
        </Cell>

        <Cell index="03" label="목표까지" className="min-h-[150px]">
          <div className="flex flex-1 flex-col justify-end gap-3 px-5 pb-5 md:px-6">
            {toGoal !== undefined ? (
              <>
                <div className="flex items-end gap-2">
                  {toGoal <= 0 ? (
                    <span className="display-tight text-[clamp(2.75rem,4.5vw,4rem)]">달성</span>
                  ) : (
                    <>
                      <AnimatedNumber value={toGoal} className="display-tight text-[clamp(2.75rem,4.5vw,4rem)]" />
                      <span className="display-tight pb-[0.3em] text-xl text-ink/70">kg</span>
                    </>
                  )}
                </div>
                <GoalBar weight={weight!} goal={goal} progress={progress} />
              </>
            ) : (
              <p className="font-mono text-[12px] text-ink/45">목표 {goal.toFixed(1)}kg · 체중을 입력하면 남은 양과 진행률이 보여요</p>
            )}
          </div>
        </Cell>
      </div>

      {/* 04 · Today's diary status — third priority; links down to the full log */}
      <Cell
        index="04"
        label={isToday ? "오늘의 현황" : "이 날의 현황"}
        className="col-span-6 max-md:hidden md:col-span-12 xl:col-span-4"
        right={
          <button
            type="button"
            onClick={goToLog}
            className="-my-2.5 px-2 py-2.5 font-mono text-[10.5px] text-ink/45 underline-offset-4 hover:text-ink hover:underline md:-my-1 md:py-1"
          >
            하루 기록 ↓
          </button>
        }
      >
        <ul className="grid flex-1 grid-cols-2 gap-px px-5 pt-3 pb-5 md:grid-cols-4 md:px-6 xl:grid-cols-1 xl:content-end xl:gap-0">
          {status.map((s) => (
            <li key={s.key} className="border-ink/10 py-2 xl:border-b xl:py-2.5 xl:last:border-b-0">
              <button type="button" onClick={goToLog} className="group flex w-full min-w-0 flex-col items-start gap-0.5 text-left xl:flex-row xl:items-baseline xl:gap-3">
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-ink/55 xl:w-14">
                  {s.dot && <Dot tone={s.dot} />}
                  {s.label}
                </span>
                <b className={`shrink-0 font-mono text-[13px] tabular-nums xl:w-14 ${s.on ? "" : "text-ink/30"} ${s.dot === "blaze" ? "text-blaze" : ""}`}>
                  {s.value}
                </b>
                <span className={`w-full min-w-0 truncate text-[12px] group-hover:text-ink ${s.on ? "text-ink/70" : "text-ink/35"}`}>
                  {s.detail}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Cell>
    </>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.9, y: 1 }}
      transition={{ type: "spring", stiffness: 700, damping: 28, mass: 1.2 }}
      className="flex h-10 w-10 items-center justify-center border border-ink/25 transition-colors hover:border-ink hover:bg-ink hover:text-paper"
    >
      {children}
    </motion.button>
  );
}

/**
 * Thin progress rule from the starting weight (first record) to the goal.
 * Falls back to a 10 kg window above the goal when there is no usable start.
 */
function GoalBar({
  weight,
  goal,
  progress,
}: {
  weight: number;
  goal: number;
  progress: ReturnType<typeof goalProgress>;
}) {
  const pct = progress ? progress.pct : Math.max(0, Math.min(1, 1 - (weight - goal) / 10));
  return (
    <div>
      {progress && (
        <p className="mb-1.5 flex items-baseline justify-between gap-2 font-mono text-[11px]">
          <span>
            진행 <b className="tabular-nums">{Math.round(pct * 100)}%</b>
          </span>
          <span className="text-ink/50">
            {progress.lost > 0 ? `${progress.lost.toFixed(1)}kg 감량` : "시작 체중 대비"}
          </span>
        </p>
      )}
      <div className="relative h-1.5 bg-ink/10">
        <motion.div
          className="absolute inset-y-0 left-0 bg-acid"
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        <motion.span
          aria-hidden
          className="absolute top-1/2 h-3 w-[3px] -translate-y-1/2 bg-ink"
          animate={{ left: `calc(${pct * 100}% - 1.5px)` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-ink/50">
        <span>{progress ? `시작 ${progress.start.toFixed(1)}` : weight.toFixed(1)}</span>
        <span>목표 {goal.toFixed(1)}</span>
      </div>
    </div>
  );
}

const signedKg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;
const toneOf = (n: number | null): "acid" | "blaze" | "ink" =>
  n === null || Math.abs(n) < 0.05 ? "ink" : n < 0 ? "acid" : "blaze";

/**
 * Phone-only summary: "목표까지" and "7일 평균" side by side; everything else
 * (change, pace, ETA, injection rhythm, streak) folded under "자세히 보기".
 */
export function PhoneSummary({ store, selected }: { store: DietStore; selected: string }) {
  const { data } = store;
  const [open, setOpen] = useState(false);
  const goal = data.goalWeight;
  const weight = data.days[selected]?.weight;
  const current = latestWeight(data, selected);
  const toGoal = current !== undefined ? current - goal : undefined;
  const progress = current !== undefined ? goalProgress(data, current) : null;
  const weekly = weeklyStats(data, selected);

  const prev = prevWeight(data, selected);
  const delta = weight !== undefined && prev ? weight - prev.weight : null;
  // pace over the 30 days ending at the selected day (same rule as the chart's 30D view)
  const from = addDays(selected, -29);
  const pace = weightPace(
    dayIndex(data)
      .weights.filter((k) => k >= from && k <= selected)
      .map((k) => ({ key: k, weight: data.days[k].weight! }))
  );
  const eta = pace.ok && current !== undefined ? goalEta(current, goal, pace.perWeek) : null;
  const lastInj = lastInjection(data, selected);
  const cycle = injectionCycle(data, selected);
  const streak = computeStreak(data);

  const rows: { label: string; value: string; warn?: boolean }[] = [
    {
      label: "직전 기록 대비",
      value: delta !== null && prev ? `${signedKg(delta)}kg · ${shortLabel(prev.key)} ${prev.weight.toFixed(1)}` : "—",
      warn: toneOf(delta) === "blaze",
    },
    {
      label: "주간 페이스",
      value: pace.ok ? `${signedKg(pace.perWeek)}kg/주 · 최근 30일` : "체중 기록 3회 이상 필요",
      warn: pace.ok && toneOf(pace.perWeek) === "blaze",
    },
    { label: "목표 예상", value: pace.ok ? etaText(eta) : "—" },
    {
      label: "진행률",
      value: progress
        ? `${Math.round(progress.pct * 100)}% · 시작 ${progress.start.toFixed(1)} → ${goal.toFixed(1)}`
        : `목표 ${goal.toFixed(1)}kg`,
    },
    {
      label: "주사",
      value: lastInj
        ? `${lastInj.daysAgo === 0 ? "이 날 투약" : `D+${lastInj.daysAgo}`}${cycle.avgGap !== null ? ` · 평균 ${fmtDays(cycle.avgGap)} 주기` : ""}`
        : "기록 없음",
    },
    { label: "연속 기록", value: `${streak}일` },
  ];

  return (
    <section aria-label="요약">
      <div className="grid grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2 border-r border-ink/15 p-4">
          <Label>목표까지</Label>
          <div className="flex items-end gap-1">
            {toGoal === undefined ? (
              <span className="display-tight text-[2.5rem] text-ink/20">—</span>
            ) : toGoal <= 0 ? (
              <span className="display-tight text-[2.5rem]">달성</span>
            ) : (
              <>
                <AnimatedNumber value={toGoal} className="display-tight text-[2.5rem]" />
                <span className="display-tight pb-1 text-lg text-ink/60">kg</span>
              </>
            )}
          </div>
          <div className="relative mt-auto h-1.5 bg-ink/10" aria-hidden>
            <motion.div
              className="absolute inset-y-0 left-0 bg-acid"
              animate={{ width: `${(progress?.pct ?? 0) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 p-4">
          <Label>7일 평균</Label>
          <div className="flex items-end gap-1">
            {weekly.current ? (
              <>
                <AnimatedNumber value={weekly.current.avg} className="display-tight text-[2.5rem]" />
                <span className="display-tight pb-1 text-lg text-ink/60">kg</span>
              </>
            ) : (
              <span className="display-tight text-[2.5rem] text-ink/20">—</span>
            )}
          </div>
          <span className="mt-auto flex items-center gap-1.5 font-mono text-[11px] text-ink/55">
            {weekly.delta !== null ? (
              <>
                <Dot tone={toneOf(weekly.delta)} />
                지난주 대비 {signedKg(weekly.delta)}
              </>
            ) : (
              "비교할 기록 없음"
            )}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between border-t border-ink/15 px-4 font-mono text-[11px] font-bold"
      >
        {open ? "접기" : "자세히 보기"}
        <ChevronDown size={16} strokeWidth={2} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.dl
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-4"
          >
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 border-t border-ink/10 py-3 font-mono text-[12px]">
                <dt className="shrink-0 text-ink/55">{r.label}</dt>
                <dd className={`min-w-0 text-right tabular-nums ${r.warn ? "text-blaze" : ""}`}>{r.value}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </AnimatePresence>
    </section>
  );
}
