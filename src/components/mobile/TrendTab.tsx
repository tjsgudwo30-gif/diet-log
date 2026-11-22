"use client";

import { motion } from "framer-motion";
import { Bike, ChevronRight, NotebookPen, Syringe, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { shortLabel, weekdayKo } from "@/lib/date";
import { goalEta, goalProgress, hasDayRecord, prevWeight, weightPace, type DietStore } from "@/lib/store";
import type { AppData, Category } from "@/lib/types";
import { buildSeries, etaText, RANGES, signed, trendTone, WeightPlot, type Point, type Range } from "../TrendChart";
import { Dot, Label } from "../ui";

/** Rows in the "기록 흐름" list (most recent first). */
const FLOW_ROWS = 14;
const MEALS: Category[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * Phone "추이" tab, read top to bottom: period → key figures → chart → day-by-day flow.
 * Same data and rules as the desktop chart card (series, 7-day average, pace, ETA).
 */
export function TrendTab({
  store,
  selected,
  onGoToDay,
}: {
  store: DietStore;
  selected: string;
  /** Open a day in the 오늘 tab. */
  onGoToDay: (key: string) => void;
}) {
  const { data } = store;
  const [range, setRange] = useState<Range>("30");
  const series = useMemo(() => buildSeries(data, selected, range), [data, selected, range]);
  const weighIns = useMemo(() => series.filter((p): p is Point & { weight: number } => p.weight !== null), [series]);
  const pace = useMemo(() => weightPace(weighIns), [weighIns]);

  const values = weighIns.map((p) => p.weight);
  const hasData = values.length > 0;
  const first = weighIns[0];
  const last = weighIns[weighIns.length - 1];
  const avg = hasData ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const change = hasData ? last.weight - first.weight : null;
  const min = hasData ? Math.min(...values) : null;
  const max = hasData ? Math.max(...values) : null;
  const goal = data.goalWeight;
  const toGoal = last ? last.weight - goal : null;
  const progress = last ? goalProgress(data, last.weight) : null;
  const eta = pace.ok && last ? goalEta(last.weight, goal, pace.perWeek) : null;
  const injections = series.filter((p) => p.inj).length;
  const rangeLabel = range === "all" ? "전체 기간" : `최근 ${range}일`;

  /** A tapped point: shown under the chart with an explicit "이 날 보기" (taps never jump). */
  const [picked, setPicked] = useState<{ key: string; on: string; range: Range } | null>(null);
  const pickedKey = picked && picked.on === selected && picked.range === range ? picked.key : null;

  const flow = useMemo(
    () => series.filter((p) => hasDayRecord(data, p.key)).map((p) => p.key).reverse().slice(0, FLOW_ROWS),
    [series, data]
  );

  return (
    <div className="space-y-4">
      {/* Period */}
      <div role="tablist" aria-label="기간" className="grid grid-cols-3 border-[1.5px] border-ink">
        {RANGES.map((r, i) => {
          const on = range === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setRange(r.key)}
              className={`h-11 font-mono text-[13px] font-bold tracking-[0.06em] ${i > 0 ? "border-l border-ink/20" : ""} ${
                on ? "bg-ink text-paper" : "text-ink/55"
              }`}
            >
              {r.key === "all" ? "전체" : `${r.key}일`}
            </button>
          );
        })}
      </div>

      {/* Key figures */}
      <section aria-label={`${rangeLabel} 요약`} className="border-[1.5px] border-ink">
        <div className="grid grid-cols-2">
          <Figure label="최근 체중" value={last ? last.weight.toFixed(1) : null} unit="kg" sub={last ? `${shortLabel(last.key)} 기록` : "기록 없음"} />
          <Figure
            label="기간 평균"
            value={avg !== null ? avg.toFixed(1) : null}
            unit="kg"
            sub={`체중 ${weighIns.length}일 기록`}
            divider
          />
          <Figure
            label="기간 변화"
            value={change !== null ? signed(change) : null}
            unit="kg"
            warn={trendTone(change) === "blaze"}
            sub={first ? `${shortLabel(first.key)} ${first.weight.toFixed(1)}부터` : "—"}
            top
          />
          <div className="flex min-w-0 flex-col gap-1.5 border-t border-l border-ink/15 p-4">
            <Label>목표 {goal.toFixed(1)}</Label>
            <span className="flex items-end gap-1">
              <span className={`display-tight text-[2rem] ${toGoal === null ? "text-ink/20" : ""}`}>
                {toGoal === null ? "—" : toGoal <= 0 ? "달성" : toGoal.toFixed(1)}
              </span>
              {toGoal !== null && toGoal > 0 && (
                <>
                  <span className="display-tight pb-1 text-base text-ink/60">kg</span>
                  <span className="pb-1.5 font-mono text-[11px] text-ink/50">남음</span>
                </>
              )}
            </span>
            <div className="mt-auto flex items-center gap-2">
              <div className="relative h-1.5 flex-1 bg-ink/10" aria-hidden>
                <motion.div
                  className="absolute inset-y-0 left-0 bg-acid"
                  animate={{ width: `${(progress?.pct ?? (toGoal !== null && toGoal <= 0 ? 1 : 0)) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              {progress && <span className="font-mono text-[10.5px] tabular-nums text-ink/55">{Math.round(progress.pct * 100)}%</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink/15 px-4 py-3 font-mono text-[11px]">
          <span className="flex items-baseline gap-2">
            <span className="text-ink/55">주간 페이스</span>
            <b className={`text-[14px] tabular-nums ${pace.ok && trendTone(pace.perWeek) === "blaze" ? "text-blaze" : ""}`}>
              {pace.ok ? `${signed(pace.perWeek)}kg/주` : "—"}
            </b>
          </span>
          <span className="flex items-center gap-1.5 text-ink/60">
            {pace.ok ? (
              <>
                <Dot tone={trendTone(pace.perWeek)} />
                {etaText(eta)}
              </>
            ) : (
              "체중 기록 3회·4일 이상 필요"
            )}
          </span>
        </div>
      </section>

      {/* Chart */}
      <section aria-label="체중 그래프" className="border-[1.5px] border-ink">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3 font-mono text-[10.5px] text-ink/55">
          <span>
            {min !== null && max !== null ? `최저 ${min.toFixed(1)} · 최고 ${max.toFixed(1)}` : rangeLabel}
            {injections > 0 && ` · 주사 ${injections}회`}
          </span>
          <span className="flex items-center gap-3" aria-hidden>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 border-[1.5px] border-ink bg-paper" /> 체중
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 border-t-[1.5px] border-dashed border-ink/40" /> 7일 평균
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rotate-45 border border-ink bg-blaze" /> 주사
            </span>
          </span>
        </div>
        <div className="h-64 touch-pan-y px-1 pt-2 pb-1">
          {hasData ? (
            <WeightPlot
              series={series}
              data={data}
              selected={selected}
              goal={goal}
              compact
              onPoint={(k) => setPicked({ key: k, on: selected, range })}
            />
          ) : (
            <p className="flex h-full items-center justify-center px-6 text-center font-mono text-[12px] text-ink/45">
              이 기간에 체중 기록이 없어요
            </p>
          )}
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-ink/15 pl-4 font-mono text-[12px]">
          {pickedKey ? (
            <>
              <span className="min-w-0 truncate">
                {shortLabel(pickedKey)} {weekdayKo(pickedKey)}
                {data.days[pickedKey]?.weight !== undefined && <b className="ml-2">{data.days[pickedKey].weight!.toFixed(1)}kg</b>}
              </span>
              <button type="button" onClick={() => onGoToDay(pickedKey)} className="flex h-12 shrink-0 items-center bg-ink px-4 font-bold text-paper">
                이 날 보기 →
              </button>
            </>
          ) : (
            <span className="text-[11px] text-ink/45">점을 누르면 그날 체중이 보여요</span>
          )}
        </div>
      </section>

      {/* Day-by-day flow */}
      <section aria-label="기록 흐름" className="border-[1.5px] border-ink">
        <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
          <Label>기록 흐름</Label>
          <span className="font-mono text-[10.5px] text-ink/45">{flow.length ? `최근 ${flow.length}일` : rangeLabel}</span>
        </div>
        {flow.length ? (
          <ul>
            {flow.map((k) => (
              <FlowRow key={k} dayKey={k} data={data} onOpen={() => onGoToDay(k)} />
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 font-mono text-[12px] text-ink/45">이 기간에 기록이 없어요</p>
        )}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  unit,
  sub,
  warn = false,
  divider = false,
  top = false,
}: {
  label: string;
  value: string | null;
  unit: string;
  sub: string;
  warn?: boolean;
  divider?: boolean;
  top?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 p-4 ${divider ? "border-l border-ink/15" : ""} ${top ? "border-t border-ink/15" : ""}`}>
      <Label>{label}</Label>
      <span className="flex items-end gap-1">
        <span className={`display-tight text-[2rem] tabular-nums ${value === null ? "text-ink/20" : warn ? "text-blaze" : ""}`}>{value ?? "—"}</span>
        {value !== null && <span className="display-tight pb-1 text-base text-ink/60">{unit}</span>}
      </span>
      <span className="truncate font-mono text-[10.5px] text-ink/50">{sub}</span>
    </div>
  );
}

/** One day: date · weight (+ change from the previous weigh-in) · what was recorded. */
function FlowRow({ dayKey, data, onOpen }: { dayKey: string; data: AppData; onOpen: () => void }) {
  const day = data.days[dayKey];
  const w = day?.weight;
  const prev = w !== undefined ? prevWeight(data, dayKey) : null;
  const d = w !== undefined && prev ? w - prev.weight : null;
  const meals = MEALS.reduce((n, c) => n + (day?.logs[c]?.length ?? 0), 0);
  const ex = (day?.logs.exercise?.length ?? 0) > 0;
  const inj = (day?.logs.injection?.length ?? 0) > 0;
  return (
    <li className="border-t border-ink/10">
      <button type="button" onClick={onOpen} className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-ink/5">
        <span className="w-14 shrink-0 font-mono text-[12px] tabular-nums">
          {shortLabel(dayKey)} <span className="text-ink/45">{weekdayKo(dayKey)}</span>
        </span>
        <span className="flex w-24 shrink-0 items-baseline gap-1.5 font-mono tabular-nums">
          <b className={`text-[14px] ${w === undefined ? "text-ink/25" : ""}`}>{w !== undefined ? w.toFixed(1) : "—"}</b>
          {d !== null && (
            <span className={`text-[10.5px] ${trendTone(d) === "blaze" ? "text-blaze" : "text-ink/45"}`}>{signed(d)}</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-ink/55" aria-label="기록 항목">
          {meals > 0 && (
            <span className="flex items-center gap-0.5 font-mono text-[10.5px]">
              <UtensilsCrossed size={13} strokeWidth={1.75} aria-label="식단" />
              {meals}
            </span>
          )}
          {ex && <Bike size={14} strokeWidth={1.75} aria-label="운동" />}
          {inj && <Syringe size={13} strokeWidth={2} aria-label="주사" className="text-blaze" />}
          {day?.note && <NotebookPen size={13} strokeWidth={1.75} aria-label="메모" />}
        </span>
        <ChevronRight size={15} strokeWidth={1.75} className="shrink-0 text-ink/30" />
      </button>
    </li>
  );
}
