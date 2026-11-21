"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, shortLabel, weekdayKo } from "@/lib/date";
import type { DietStore } from "@/lib/store";
import { CATEGORIES, type AppData } from "@/lib/types";
import { Cell } from "./ui";

type Range = "7" | "30" | "all";
const RANGES: { key: Range; label: string }[] = [
  { key: "7", label: "7D" },
  { key: "30", label: "30D" },
  { key: "all", label: "ALL" },
];

interface Point {
  key: string;
  weight: number | null;
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
    out.push({ key: k, weight: data.days[k]?.weight ?? null });
  }
  return out;
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
        <dl className="grid grid-cols-3 gap-px border-y-2 border-ink bg-ink mt-3 lg:grid-cols-1 lg:border-y-0 lg:border-r-2 lg:mt-3">
          {[
            ["LOW", hasData ? min.toFixed(1) : "—"],
            ["HIGH", hasData ? max.toFixed(1) : "—"],
            ["Δ PERIOD", hasData ? `${change > 0 ? "+" : ""}${change.toFixed(1)}` : "—"],
          ].map(([k, v], i) => (
            <div key={k} className={`flex flex-col justify-between bg-paper px-4 py-3 ${i === 2 && change < 0 ? "!bg-acid" : i === 2 && change > 0 ? "!bg-blaze" : ""}`}>
              <dt className="font-mono text-[11px] tracking-[0.14em]">{k}</dt>
              <dd className="display-tight text-3xl md:text-4xl lg:text-5xl">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="relative h-[240px] px-1 pt-4 pb-2 md:h-[320px] md:px-2">
          {series.filter((p) => p.weight !== null).length < 1 ? (
            <div className="flex h-full items-center justify-center font-mono text-sm opacity-60">
              — 이 기간에 기록이 없습니다. 설정에서 샘플 데이터를 채워보세요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 16, right: 24, bottom: 0, left: 0 }}
                onClick={(s) => {
                  const i = Number(s?.activeIndex);
                  const k = Number.isInteger(i) ? series[i]?.key : undefined;
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
                <ReferenceLine x={selected} stroke="#000" strokeWidth={1} strokeDasharray="2 3" ifOverflow="hidden" />
                <Tooltip
                  cursor={{ stroke: "#000", strokeWidth: 1.5 }}
                  content={(p) => <ChartTooltip active={p.active} label={p.label as string} data={data} />}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="weight"
                  stroke="#000"
                  strokeWidth={2.5}
                  connectNulls
                  isAnimationActive={false}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props as { cx?: number; cy?: number; payload: Point; index: number };
                    if (cx == null || cy == null || payload.weight == null) return <g key={index} />;
                    const sel = payload.key === selected;
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
                  activeDot={(props: { cx?: number; cy?: number }) => {
                    const { cx = 0, cy = 0 } = props;
                    return <rect x={cx - 8} y={cy - 8} width={16} height={16} fill="#FF4D00" stroke="#000" strokeWidth={2} style={{ cursor: "pointer" }} />;
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

function ChartTooltip({ active, label, data }: { active?: boolean; label?: string; data: AppData }) {
  if (!active || !label) return null;
  const day = data.days[label];
  if (!day || day.weight === undefined) return null;
  const items = CATEGORIES.map((c) => ({ ...c, list: day.logs[c.key] ?? [] })).filter((c) => c.list.length);
  return (
    <div className="w-64 border-2 border-ink bg-paper shadow-[5px_5px_0_0_#000]">
      <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-3 py-1.5 font-mono text-[11px] font-bold text-paper">
        <span>
          {label.replaceAll("-", ".")} ({weekdayKo(label)})
        </span>
        <span className="text-acid">CLICK → OPEN</span>
      </div>
      <div className="flex items-end gap-1 px-3 pt-2">
        <span className="display-tight text-5xl">{day.weight.toFixed(1)}</span>
        <span className="display-tight pb-1 text-lg">KG</span>
      </div>
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
