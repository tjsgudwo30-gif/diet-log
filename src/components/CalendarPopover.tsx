"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fromKey, toKey, todayKey } from "@/lib/date";
import { hasDayRecord, hasInjection } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { Label } from "./ui";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 6×7 grid of keys for the month containing (year, month); null = padding cell. */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toKey(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Month calendar popover anchored under the date navigation.
 * - Days with any record get an ink dot; injection days an orange dot.
 * - Click a day → select it and close. Esc / outside click / ✕ close.
 * - Focus moves to the selected day on open and back to the trigger on close.
 */
export function CalendarPopover({
  data,
  selected,
  onPick,
  onClose,
  triggerRef,
}: {
  data: AppData;
  selected: string;
  onPick: (key: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const sel = fromKey(selected);
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  const panelRef = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
  const recorded = cells.filter((k) => k && hasDayRecord(data, k)).length;

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  // Esc + outside click close; focus the selected day on open, return focus on close.
  useEffect(() => {
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || trigger?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    const id = requestAnimationFrame(() => {
      const p = panelRef.current;
      (
        p?.querySelector<HTMLButtonElement>('[aria-current="date"]') ??
        p?.querySelector<HTMLButtonElement>('[data-today="true"]') ??
        p?.querySelector<HTMLButtonElement>('[role="gridcell"]')
      )?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      trigger?.focus();
    };
  }, [onClose, triggerRef]);

  return (
    // Outer wrapper does the centring transform; the inner motion layer animates freely.
    <div className="absolute top-full left-1/2 z-50 mt-2 w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2">
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-label="기록 날짜 달력"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.14 }}
        className="border-[1.5px] border-ink bg-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.4)]"
      >
        {/* Month bar */}
        <div className="flex items-center justify-between gap-2 border-b border-ink/15 px-3 py-2">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => shift(-1)}
            className="flex h-9 w-9 items-center justify-center hover:bg-ink hover:text-paper"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <div className="text-center" aria-live="polite">
            <div className="display-tight text-[1.75rem]">
              {view.y}.{String(view.m + 1).padStart(2, "0")}
            </div>
            <Label>기록 {recorded}일</Label>
          </div>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => shift(1)}
            className="flex h-9 w-9 items-center justify-center hover:bg-ink hover:text-paper"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Grid */}
        <div className="px-3 pt-2 pb-1">
          <div className="grid grid-cols-7 text-center font-mono text-[10.5px] text-ink/45" aria-hidden>
            {WEEK.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div role="grid" className="grid grid-cols-7">
            {cells.map((k, i) => {
              if (!k) return <span key={`pad-${i}`} aria-hidden className="h-10" />;
              const d = fromKey(k).getDate();
              const isSel = k === selected;
              const isToday = k === today;
              const rec = hasDayRecord(data, k);
              const inj = hasInjection(data, k);
              return (
                <button
                  key={k}
                  type="button"
                  role="gridcell"
                  aria-current={isSel ? "date" : undefined}
                  data-today={isToday || undefined}
                  aria-label={`${k}${rec ? ", 기록 있음" : ""}${inj ? ", 주사" : ""}`}
                  onClick={() => onPick(k)}
                  className={`relative flex h-10 flex-col items-center justify-center font-mono text-[13px] tabular-nums transition-colors ${
                    isSel ? "bg-ink text-paper" : rec ? "text-ink hover:bg-ink/10" : "text-ink/40 hover:bg-ink/5"
                  } ${isToday && !isSel ? "font-bold underline decoration-acid decoration-[3px] underline-offset-4" : ""}`}
                >
                  {d}
                  <span className="absolute bottom-1 flex gap-0.5" aria-hidden>
                    {rec && <span className={`h-1 w-1 ${isSel ? "bg-paper" : "bg-ink"}`} />}
                    {inj && <span className="h-1 w-1 bg-blaze" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer: legend + today */}
        <div className="flex items-center justify-between gap-2 border-t border-ink/15 px-3 py-2 font-mono text-[10.5px] text-ink/55">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 bg-ink" /> 기록
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 bg-blaze" /> 주사
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-3 bg-acid" /> 오늘
            </span>
          </span>
          <span className="flex items-center">
            <button
              type="button"
              onClick={() => onPick(today)}
              className="px-2 py-2 font-bold text-ink underline-offset-4 hover:underline"
            >
              오늘로
            </button>
            <button
              type="button"
              aria-label="달력 닫기"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center hover:bg-ink hover:text-paper"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
