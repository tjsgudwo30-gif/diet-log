"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { shortLabel } from "@/lib/date";
import type { CheckpointProgress, DayStamp, Headline, Milestone } from "@/lib/store";
import { Dot } from "./ui";

/** Brand line shared by the phone identity bar, the desktop header and the metadata. */
export const BRAND = "WEIGHT/LOG";
export const TAGLINE = "매일 쌓이는 나만의 몸 상태 아카이브";

/* ---------- Headline: one plain sentence about the day ---------- */

export function HeadlineText({ headline, className = "" }: { headline: Headline; className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-[14px] leading-snug font-bold break-keep ${className}`}>
      <Dot tone={headline.tone === "good" ? "acid" : headline.tone === "warn" ? "blaze" : "ink"} className="mt-[5px]" />
      <span className="min-w-0">{headline.text}</span>
    </p>
  );
}

/* ---------- Day stamp: weight · meal · activity ---------- */

const STAMP_PARTS: { key: "weight" | "meal" | "activity"; label: string }[] = [
  { key: "weight", label: "체중" },
  { key: "meal", label: "식단" },
  { key: "activity", label: "활동" },
];

/**
 * Three stamp boxes that fill in as the day is recorded; all three → acid "완료".
 * `size="sm"` for the desktop status cell.
 */
export function StampRow({ stamp, size = "md" }: { stamp: DayStamp; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 px-2 text-[11px]" : "h-9 px-2.5 text-[12px]";
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`오늘 스탬프 ${stamp.filled}/${stamp.total}`}>
      {STAMP_PARTS.map((p) => {
        const on = stamp[p.key];
        return (
          <span
            key={p.key}
            className={`inline-flex items-center gap-1 border-[1.5px] font-mono font-bold ${box} ${
              on ? "border-ink bg-ink text-paper" : "border-dashed border-ink/30 text-ink/40"
            }`}
          >
            {on && <Check size={size === "sm" ? 11 : 13} strokeWidth={3} />}
            {p.label}
          </span>
        );
      })}
      <span
        className={`ml-auto inline-flex items-center border-[1.5px] font-mono font-bold tabular-nums ${box} ${
          stamp.complete ? "border-ink bg-acid text-ink" : "border-transparent text-ink/45"
        }`}
      >
        {stamp.complete ? "완료" : `${stamp.filled}/${stamp.total}`}
      </span>
    </div>
  );
}

/* ---------- 1 kg checkpoint gauge ---------- */

/** Beyond this many checkpoints the segments get too thin; draw one continuous bar instead. */
const MAX_SEGMENTS = 24;

export function CheckpointGauge({ cp, dense = false }: { cp: CheckpointProgress; dense?: boolean }) {
  const segments = cp.totalCheckpoints <= MAX_SEGMENTS;
  const pct = cp.reached ? 1 : cp.clearedCount / cp.totalCheckpoints;
  return (
    <div>
      <p className={`flex items-baseline justify-between gap-3 font-mono ${dense ? "text-[10.5px]" : "text-[11px]"}`}>
        <span className="text-ink/55">
          체크포인트 <b className="text-ink tabular-nums">{cp.clearedCount}</b>/{cp.totalCheckpoints}
        </span>
        <span className="min-w-0 truncate text-right tabular-nums">
          {cp.reached ? (
            <b className="bg-acid px-1 text-ink">목표 도달</b>
          ) : (
            <>
              다음 <b>{cp.nextTarget!.toFixed(1)}</b>
              <span className="text-ink/55">까지 {cp.remainingToCheckpoint!.toFixed(1)}kg</span>
            </>
          )}
        </span>
      </p>
      {segments ? (
        <div className={`mt-1.5 flex gap-[3px] ${dense ? "h-2" : "h-2.5"}`} aria-hidden>
          {Array.from({ length: cp.totalCheckpoints }, (_, i) => {
            const done = i < cp.clearedCount;
            const next = i === cp.clearedCount && !cp.reached;
            return (
              <motion.span
                key={i}
                initial={false}
                animate={{ backgroundColor: done ? "#CCFF00" : "rgba(0,0,0,0)" }}
                className={`flex-1 border ${done ? "border-ink" : next ? "border-ink" : "border-ink/20"}`}
              />
            );
          })}
        </div>
      ) : (
        <div className={`relative mt-1.5 border border-ink/20 ${dense ? "h-2" : "h-2.5"}`} aria-hidden>
          <motion.div className="absolute inset-y-0 left-0 bg-acid" animate={{ width: `${pct * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Badges ---------- */

/**
 * `card` (phone): achieved = ink tile with an acid check; not yet = dashed and quiet.
 * `cell` (desktop bento, drawn on the ink rules): achieved = acid cell; not yet = paper cell.
 */
export function BadgeTile({ m, variant = "card" }: { m: Milestone; variant?: "card" | "cell" }) {
  const look =
    variant === "cell"
      ? m.achieved
        ? "bg-acid text-ink"
        : "bg-paper text-ink/40"
      : m.achieved
        ? "bg-ink text-paper"
        : "border border-dashed border-ink/25 bg-paper text-ink/45";
  const subTone = m.achieved ? (variant === "cell" ? "text-ink/60" : "text-paper/60") : "";
  return (
    <li className={`flex min-h-[4.25rem] flex-col justify-between gap-1 p-3 ${look}`}>
      <span className="flex items-start justify-between gap-2">
        <b className="text-[13px] leading-tight break-keep">{m.label}</b>
        {m.achieved && (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center ${variant === "cell" ? "bg-ink text-acid" : "bg-acid text-ink"}`}
          >
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={`font-mono text-[10.5px] leading-snug ${subTone}`}>
        {m.achieved ? (m.at ? `${shortLabel(m.at)} 달성` : m.hint) : m.hint}
      </span>
    </li>
  );
}

export const badgeCount = (ms: Milestone[]) => ms.filter((m) => m.achieved).length;
