"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type ActiveDotProps,
  type DotItemDotProps,
  type MouseHandlerDataParam,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { addDays, isDateKey, shortLabel, weekdayKo } from "@/lib/date";
import { weeklyStats, windowAverage, type DietStore, type WeeklyStats } from "@/lib/store";
import { MAIN_CATEGORIES, type AppData } from "@/lib/types";
import { Syringe } from "lucide-react";
import { AnimatedNumber, Cell } from "./ui";

type Range = "7" | "30" | "all";
const RANGES: { key: Range; label: string }[] = [
  { key: "7", label: "7D" },
  { key: "30", label: "30D" },
  { key: "all", label: "ALL" },
];

interface Point {
  key: string;
  weight: number | null;
  /** Trailing 7-day average (needs ≥ 3 weigh-ins in the window). */
  ma7: number | null;
  /** Day has an injection record. */
  inj: boolean;
}

const isPoint = (v: unknown): v is Point =>
  !!v &&
  typeof v === "object" &&
  isDateKey((v as Point).key) &&
  ((v as Point).weight === null || typeof (v as Point).weight === "number");

/** Date key under the pointer: prefer the hovered index into our own series, fall back to the axis label. */
function resolveKey(state: MouseHandlerDataParam | undefined, series: Point[]): string | null {
  if (!state) return null;
  const i = typeof state.activeIndex === "number" ? state.activeIndex : Number(state.activeIndex);
  if (Number.isInteger(i) && i >= 0 && i < series.length) return series[i].key;
  return isDateKey(state.activeLabel) ? state.activeLabel : null;
}

/** Date key for the tooltip: read it from the hovered point's payload, fall back to the label. */
function tooltipKey(p: TooltipContentProps<ValueType, NameType>): string | null {
  const payload: unknown = p.payload?.[0]?.payload;
  if (isPoint(payload)) return payload.key;
  return isDateKey(p.label) ? p.label : null;
}

function buildSeries(data: AppData, selected: string, range: Range): Point[] {
  const recorded = Object.keys(data.days)
    .filter((k) => data.days[k].weight !== undefined)
    .sort();
  let start: string;
  let end: string;
  if (range === "all") {
    if (!recorded.length) return [];
    start = recorded[0];
    const lastRec = recorded[recorded.length - 1];
    end = selected > lastRec ? selected : lastRec;
    if (selected < start) start = selected;
  } else {
    end = selected;
    start = addDays(end, -(Number(range) - 1));
  }
  const out: Point[] = [];
  for (let k = start, guard = 0; k <= end && guard < 2000; k = addDays(k, 1), guard++) {
    const d = data.days[k];
    const win = windowAverage(data, k, 7);
    out.push({
      key: k,
      weight: d?.weight ?? null,
      ma7: win && win.count >= 3 ? Math.round(win.avg * 100) / 100 : null,
      inj: (d?.logs.injection?.length ?? 0) > 0,
    });
  }
  return out;
}

/** Diamond marker path centred on (cx, cy). */
const diamond = (cx: number, cy: number, r: number) => `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;

/** 7D AVG bento cell: average of the 7 days ending at `selected` and Δ vs. the 7 days before. */
function WeeklyCell({ stats }: { stats: WeeklyStats }) {
  const { current, previous, delta } = stats;
  const tone = delta === null ? "bg-paper" : delta < 0 ? "bg-acid" : delta > 0 ? "bg-blaze" : "bg-paper";
  return (
    <div className="col-span-2 flex flex-col justify-between gap-2 bg-ink px-4 py-3 text-paper lg:col-span-1">
      <dt className="flex items-center justify-between font-mono text-[11px] tracking-[0.14em]">
        <span className="text-acid">7D AVG</span>
        <span className="opacity-60">{current ? `${current.count}/7일` : "—"}</span>
      </dt>
      <dd className="flex flex-wrap items-end justify-between gap-2">
        <span className="display-tight text-4xl lg:text-5xl">
          {current ? <AnimatedNumber value={current.avg} /> : "—"}
        </span>
        <span className={`border-2 border-paper px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink ${tone}`}>
          {delta === null
            ? previous
              ? "Δ 7D —"
              : "이전 7일 기록 없음"
            : `Δ 7D ${delta < 0 ? "▼" : delta > 0 ? "▲" : "■"} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
        </span>
      </dd>
    </div>
  );
}

export function TrendChart({
  store,
  selected,
  onSelect,
}: {
  store: DietStore;
  selected: string;
  onSelect: (k: string) => void;
}) {
  const { data } = store;
  const [range, setRange] = useState<Range>("30");
  const series = useMemo(() => buildSeries(data, selected, range), [data, selected, range]);
  const values = series.map((p) => p.weight).filter((v): v is number => v !== null);
  const hasData = values.length > 0;
  const min = hasData ? Math.min(...values) : 0;
  const max = hasData ? Math.max(...values) : 0;
  const first = values[0];
  const last = values[values.length - 1];
  const change = hasData ? last - first : 0;

  const goal = data.goalWeight;
  const lo = Math.floor(Math.min(min, goal >= min - 1.5 ? goal : min) - 0.5);
  const hi = Math.ceil(max + 0.5);
  const weekly = useMemo(() => weeklyStats(data, selected), [data, selected]);
  const injDays = series.filter((p) => p.inj).map((p) => p.key);

  return (
    <Cell
      index="04"
      label="Trend"
      className="col-span-6 md:col-span-12"
      right={
        <div className="flex border-2 border-ink">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className="relative px-3 py-1 font-mono text-xs font-bold [&:not(:first-child)]:border-l-2 [&:not(:first-child)]:border-ink"
            >
              {range === r.key && (
                <motion.span
                  layoutId="range-pill"
                  className="absolute inset-0 bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative ${range === r.key ? "text-acid" : ""}`}>{r.label}</span>
            </button>
          ))}
        </div>
      }
    >
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[220px_1fr]">
        <dl className="mt-3 grid grid-cols-2 gap-px border-y-2 border-ink bg-ink sm:grid-cols-[1fr_1fr_1fr] lg:grid-cols-1 lg:border-y-0 lg:border-r-2">
          {[
            ["LOW", hasData ? min.toFixed(1) : "—"],
            ["HIGH", hasData ? max.toFixed(1) : "—"],
            ["Δ PERIOD", hasData ? `${change > 0 ? "+" : ""}${change.toFixed(1)}` : "—"],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={`flex flex-col justify-between bg-paper px-4 py-2.5 ${i === 2 ? "col-span-2 sm:col-span-1" : ""} ${i === 2 && change < 0 ? "!bg-acid" : i === 2 && change > 0 ? "!bg-blaze" : ""}`}
            >
              <dt className="font-mono text-[11px] tracking-[0.14em]">{k}</dt>
              <dd className="display-tight text-3xl md:text-4xl">{v}</dd>
            </div>
          ))}
          <div className="col-span-2 grid sm:col-span-3 lg:col-span-1">
            <WeeklyCell stats={weekly} />
          </div>
        </dl>

        <div className="relative h-[260px] px-1 pt-6 pb-2 md:h-[340px] md:px-2">
          {/* legend */}
          <div className="pointer-events-none absolute top-1 left-3 z-10 flex gap-3 font-mono text-[10px] font-bold uppercase">
            <span className="flex items-center gap-1">
              <svg width="18" height="8" aria-hidden>
                <line x1="0" y1="4" x2="18" y2="4" stroke="#000" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
              7D AVG
            </span>
            <span className="flex items-center gap-1">
              <svg width="10" height="10" aria-hidden>
                <path d={diamond(5, 5, 4)} fill="#FF4D00" stroke="#000" strokeWidth="1.5" />
              </svg>
              주사
            </span>
          </div>
          {series.filter((p) => p.weight !== null).length < 1 ? (
            <div className="flex h-full items-center justify-center font-mono text-sm opacity-60">
              — 이 기간에 기록이 없습니다. 설정에서 샘플 데이터를 채워보세요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 16, right: 24, bottom: 0, left: 0 }}
                onClick={(state) => {
                  const k = resolveKey(state, series);
                  if (k) onSelect(k);
                }}
              >
                <XAxis
                  dataKey="key"
                  tickFormatter={shortLabel}
                  axisLine={{ stroke: "#000", strokeWidth: 2 }}
                  tickLine={false}
                  tick={{ fill: "#000", fontSize: 11, fontFamily: "var(--font-jetbrains)" }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  tickMargin={8}
                />
                <YAxis
                  domain={[lo, hi]}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickCount={5}
                  tick={{ fill: "#000", fontSize: 11, fontFamily: "var(--font-jetbrains)" }}
                  allowDecimals={false}
                />
                <ReferenceLine
                  y={goal}
                  stroke="#FF4D00"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  ifOverflow="hidden"
                  label={{
                    value: `GOAL ${goal.toFixed(1)}`,
                    position: "insideTopRight",
                    fill: "#FF4D00",
                    fontSize: 11,
                    fontFamily: "var(--font-jetbrains)",
                    fontWeight: 700,
                  }}
                />
                {/* injection days: thin orange guides, visible even on days without a weigh-in */}
                {injDays.map((k) => (
                  <ReferenceLine key={`inj-${k}`} x={k} stroke="#FF4D00" strokeWidth={1.5} strokeOpacity={0.55} ifOverflow="hidden" />
                ))}
                <ReferenceLine x={selected} stroke="#000" strokeWidth={1} strokeDasharray="2 3" ifOverflow="hidden" />
                <Line
                  type="monotone"
                  dataKey="ma7"
                  stroke="#000"
                  strokeWidth={1.5}
                  strokeOpacity={0.55}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Tooltip
                  cursor={{ stroke: "#000", strokeWidth: 1.5 }}
                  content={(p: TooltipContentProps<ValueType, NameType>) => (
                    <ChartTooltip active={p.active} dayKey={tooltipKey(p)} data={data} />
                  )}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="weight"
                  stroke="#000"
                  strokeWidth={2.5}
                  connectNulls
                  isAnimationActive={false}
                  dot={(props: DotItemDotProps) => {
                    const { cx, cy, payload, index } = props;
                    if (typeof cx !== "number" || typeof cy !== "number" || !isPoint(payload) || payload.weight === null)
                      return <g key={index} />;
                    const sel = payload.key === selected;
                    if (payload.inj) {
                      // injection day → orange diamond (acid when selected)
                      const r = sel ? 9 : series.length > 40 ? 5 : 7;
                      return (
                        <path key={index} d={diamond(cx, cy, r)} fill={sel ? "#CCFF00" : "#FF4D00"} stroke="#000" strokeWidth={2} />
                      );
                    }
                    const s = sel ? 12 : series.length > 40 ? 4 : 7;
                    return (
                      <rect
                        key={index}
                        x={cx - s / 2}
                        y={cy - s / 2}
                        width={s}
                        height={s}
                        fill={sel ? "#CCFF00" : "#F4F4F0"}
                        stroke="#000"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={(props: ActiveDotProps) => {
                    const { cx, cy } = props;
                    if (typeof cx !== "number" || typeof cy !== "number") return <g />;
                    return (
                      <rect
                        x={cx - 8}
                        y={cy - 8}
                        width={16}
                        height={16}
                        fill="#FF4D00"
                        stroke="#000"
                        strokeWidth={2}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Cell>
  );
}

function ChartTooltip({ active, dayKey, data }: { active?: boolean; dayKey: string | null; data: AppData }) {
  if (!active || !dayKey) return null;
  const day = data.days[dayKey];
  if (!day) return null;
  const label = dayKey;
  const injections = day.logs.injection ?? [];
  const items = MAIN_CATEGORIES.map((c) => ({ ...c, list: day.logs[c.key] ?? [] })).filter((c) => c.list.length);
  if (day.weight === undefined && !items.length && !injections.length && !day.note) return null;
  return (
    <div className="w-64 border-2 border-ink bg-paper shadow-[5px_5px_0_0_#000]">
      <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-3 py-1.5 font-mono text-[11px] font-bold text-paper">
        <span>
          {label.replaceAll("-", ".")} ({weekdayKo(label)})
        </span>
        <span className="text-acid">CLICK → OPEN</span>
      </div>
      <div className="flex items-end gap-1 px-3 pt-2">
        <span className={`display-tight text-5xl ${day.weight === undefined ? "opacity-25" : ""}`}>
          {day.weight !== undefined ? day.weight.toFixed(1) : "—"}
        </span>
        <span className="display-tight pb-1 text-lg">KG</span>
      </div>
      {injections.length > 0 && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 border-2 border-ink bg-blaze px-2 py-1 font-mono text-[11px] font-bold leading-snug">
          <Syringe size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          <span className="break-words break-keep">{injections.map((l) => l.text).join(" / ")}</span>
        </div>
      )}
      {day.note && (
        <p className="mx-3 mt-2 border-l-4 border-acid bg-ink/5 px-2 py-1 font-mono text-[11px] leading-snug break-words break-keep">
          <span className="font-bold">NOTE </span>
          {day.note}
        </p>
      )}
      <ul className="space-y-1 px-3 pt-2 pb-3 font-mono text-[11px] leading-snug">
        {items.length === 0 && <li className="opacity-50">— 식단 기록 없음</li>}
        {items.map((c) => (
          <li key={c.key} className="flex gap-2">
            <span className={`w-10 shrink-0 font-bold ${c.key === "exercise" ? "text-blaze" : ""}`}>{c.label}</span>
            <span className="truncate">{c.list.map((l) => l.text).join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
