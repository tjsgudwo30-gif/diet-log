"use client";

import { motion } from "framer-motion";
import { Fragment, useMemo, useState, type ReactNode } from "react";
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
import { weeklyStats, windowAverage, type DietStore } from "@/lib/store";
import { MAIN_CATEGORIES, type AppData } from "@/lib/types";
import { Syringe } from "lucide-react";
import { AnimatedNumber, Cell, Dot, Label } from "./ui";

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

const INK = "#000";
const BLAZE = "#FF4D00";
const ACID = "#CCFF00";
const PAPER = "#F4F4F0";
const AXIS_TICK = { fill: "rgba(0,0,0,0.5)", fontSize: 10.5, fontFamily: "var(--font-jetbrains)" };

/** Legend: same strokes/markers as the plot, drawn small (18×10). */
const LEGEND: { label: string; icon: ReactNode }[] = [
  {
    label: "체중",
    icon: (
      <>
        <line x1="0" y1="5" x2="18" y2="5" stroke={INK} strokeWidth="2" />
        <rect x="6.5" y="2.5" width="5" height="5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
      </>
    ),
  },
  {
    label: "7일 평균",
    icon: <line x1="0" y1="5" x2="18" y2="5" stroke={INK} strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="3 3" />,
  },
  { label: "주사", icon: <path d={diamond(9, 5, 4)} fill={BLAZE} stroke={INK} strokeWidth="1" /> },
  { label: "목표", icon: <line x1="0" y1="5" x2="18" y2="5" stroke={INK} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="1 3" /> },
];

/** One figure in the summary strip. */
function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-paper px-5 py-4 md:px-6">
      <Label>{label}</Label>
      <div className="flex items-end gap-1.5">{children}</div>
      {sub && <div className="font-mono text-[10.5px] text-ink/55">{sub}</div>}
    </div>
  );
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;
const trendTone = (n: number | null): "acid" | "blaze" | "ink" => (n === null || Math.abs(n) < 0.05 ? "ink" : n < 0 ? "acid" : "blaze");

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
  const big = "display-tight text-[2rem] md:text-[2.5rem]";

  return (
    <Cell
      index="04"
      label="Trend"
      className="col-span-6 md:col-span-12"
      right={
        <div role="tablist" aria-label="기간" className="-my-1 flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`relative px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-[0.08em] transition-colors ${
                range === r.key ? "text-ink" : "text-ink/40 hover:text-ink"
              }`}
            >
              {r.label}
              {range === r.key && (
                <motion.span
                  layoutId="range-underline"
                  className="absolute inset-x-2 bottom-0.5 h-[2px] bg-ink"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      }
    >
      {/* Summary strip: four figures side by side, hairline separated */}
      <dl className="mt-3 grid grid-cols-2 gap-px border-y border-ink/15 bg-ink/15 sm:grid-cols-4">
        <Stat label="Low">
          <span className={big}>{hasData ? min.toFixed(1) : "—"}</span>
        </Stat>
        <Stat label="High">
          <span className={big}>{hasData ? max.toFixed(1) : "—"}</span>
        </Stat>
        <Stat
          label="Δ 기간"
          sub={
            hasData && (
              <span className="flex items-center gap-1.5">
                <Dot tone={trendTone(change)} />
                {RANGES.find((r) => r.key === range)?.label} 첫 기록 대비
              </span>
            )
          }
        >
          <span className={`${big} ${trendTone(change) === "blaze" ? "text-blaze" : ""}`}>{hasData ? signed(change) : "—"}</span>
        </Stat>
        <Stat
          label="7일 평균"
          sub={
            weekly.delta !== null ? (
              <span className="flex items-center gap-1.5">
                <Dot tone={trendTone(weekly.delta)} />
                이전 7일 대비 {signed(weekly.delta)}
              </span>
            ) : (
              <span>{weekly.current ? `${weekly.current.count}/7일 기록` : "기록 없음"}</span>
            )
          }
        >
          <span className={big}>{weekly.current ? <AnimatedNumber value={weekly.current.avg} /> : "—"}</span>
        </Stat>
      </dl>

      <div className="flex h-[280px] flex-col md:h-[360px]">
        <ul aria-label="그래프 범례" className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 px-5 pt-3 md:px-6">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink/55">
              <svg width="18" height="10" aria-hidden className="shrink-0">
                {l.icon}
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
        <div className="relative min-h-0 flex-1 px-1 pt-1 pb-3 md:px-3">
          {series.filter((p) => p.weight !== null).length < 1 ? (
            <div className="flex h-full items-center justify-center font-mono text-[12px] text-ink/45">
              이 기간에 기록이 없습니다 · 설정에서 샘플 데이터를 채워 보세요
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 12, right: 20, bottom: 0, left: 0 }}
                onClick={(state) => {
                  const k = resolveKey(state, series);
                  if (k) onSelect(k);
                }}
              >
                <XAxis
                  dataKey="key"
                  tickFormatter={shortLabel}
                  axisLine={{ stroke: INK, strokeWidth: 1 }}
                  tickLine={false}
                  tick={AXIS_TICK}
                  interval="preserveStartEnd"
                  minTickGap={32}
                  tickMargin={10}
                />
                <YAxis
                  domain={[lo, hi]}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickCount={5}
                  tick={AXIS_TICK}
                  allowDecimals={false}
                />
                <ReferenceLine
                  y={goal}
                  stroke={INK}
                  strokeOpacity={0.55}
                  strokeWidth={1}
                  strokeDasharray="1 4"
                  ifOverflow="hidden"
                  label={{
                    value: `목표 ${goal.toFixed(1)}`,
                    position: "insideBottomRight",
                    fill: "rgba(0,0,0,0.55)",
                    fontSize: 10.5,
                    fontFamily: "var(--font-jetbrains)",
                  }}
                />
                {/* injection days: faint orange guides, visible even on days without a weigh-in */}
                {injDays.map((k) => (
                  <ReferenceLine key={`inj-${k}`} x={k} stroke={BLAZE} strokeWidth={1} strokeOpacity={0.35} ifOverflow="hidden" />
                ))}
                <ReferenceLine x={selected} stroke={INK} strokeOpacity={0.35} strokeWidth={1} ifOverflow="hidden" />
                <Line
                  type="monotone"
                  dataKey="ma7"
                  stroke={INK}
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                  strokeDasharray="3 4"
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Tooltip
                  cursor={{ stroke: INK, strokeOpacity: 0.3, strokeWidth: 1 }}
                  content={(p: TooltipContentProps<ValueType, NameType>) => (
                    <ChartTooltip active={p.active} dayKey={tooltipKey(p)} data={data} />
                  )}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="weight"
                  stroke={INK}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                  dot={(props: DotItemDotProps) => {
                    const { cx, cy, payload, index } = props;
                    if (typeof cx !== "number" || typeof cy !== "number" || !isPoint(payload) || payload.weight === null)
                      return <g key={index} />;
                    const sel = payload.key === selected;
                    const dense = series.length > 40;
                    if (payload.inj) {
                      const r = sel ? 7 : dense ? 4 : 5;
                      return <path key={index} d={diamond(cx, cy, r)} fill={sel ? ACID : BLAZE} stroke={INK} strokeWidth={1.5} />;
                    }
                    const s = sel ? 10 : dense ? 3 : 5;
                    return (
                      <rect
                        key={index}
                        x={cx - s / 2}
                        y={cy - s / 2}
                        width={s}
                        height={s}
                        fill={sel ? ACID : PAPER}
                        stroke={INK}
                        strokeWidth={sel ? 2 : 1.5}
                      />
                    );
                  }}
                  activeDot={(props: ActiveDotProps) => {
                    const { cx, cy } = props;
                    if (typeof cx !== "number" || typeof cy !== "number") return <g />;
                    return <rect x={cx - 6} y={cy - 6} width={12} height={12} fill={INK} style={{ cursor: "pointer" }} />;
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

/** Minimal tooltip: date + weight, then injection / note / meals as plain rows. */
function ChartTooltip({ active, dayKey, data }: { active?: boolean; dayKey: string | null; data: AppData }) {
  if (!active || !dayKey) return null;
  const day = data.days[dayKey];
  if (!day) return null;
  const injections = day.logs.injection ?? [];
  const items = MAIN_CATEGORIES.map((c) => ({ ...c, list: day.logs[c.key] ?? [] })).filter((c) => c.list.length);
  if (day.weight === undefined && !items.length && !injections.length && !day.note) return null;
  return (
    <div className="w-72 max-w-[calc(100vw-2.5rem)] border border-ink bg-paper font-mono text-[11px] leading-snug">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <span className="text-ink/55">
          {dayKey.replaceAll("-", ".")} {weekdayKo(dayKey)}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink/40">click</span>
      </div>
      <div className="flex items-end gap-1 px-4 pt-1 pb-3">
        <span className={`display-tight text-[2.5rem] ${day.weight === undefined ? "text-ink/20" : ""}`}>
          {day.weight !== undefined ? day.weight.toFixed(1) : "—"}
        </span>
        <span className="display-tight pb-1 text-base text-ink/60">kg</span>
      </div>

      <dl className="grid grid-cols-[2.75rem_1fr] gap-x-3 gap-y-1.5 border-t border-ink/15 px-4 py-3">
        {injections.length > 0 && (
          <>
            <dt className="flex items-center gap-1 text-blaze">
              <Syringe size={11} strokeWidth={2} /> 주사
            </dt>
            <dd className="line-clamp-2 min-w-0 break-words break-keep">{injections.map((l) => l.text).join(" / ")}</dd>
          </>
        )}
        {day.note && (
          <>
            <dt className="text-ink/55">메모</dt>
            <dd className="line-clamp-3 min-w-0 break-words break-keep">{day.note}</dd>
          </>
        )}
        {items.length === 0 && !injections.length && !day.note && <dd className="col-span-2 text-ink/45">식단·운동 기록 없음</dd>}
        {items.map((c) => (
          <Fragment key={c.key}>
            <dt className="text-ink/55">{c.label}</dt>
            <dd className="line-clamp-2 min-w-0 break-words break-keep">
              {c.list.map((l) => l.text).join(", ")}
              {c.list.length > 1 && <span className="ml-1 text-ink/40">({c.list.length})</span>}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
