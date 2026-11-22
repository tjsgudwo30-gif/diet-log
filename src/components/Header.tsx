"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Settings2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { fromKey, todayKey, weekday } from "@/lib/date";
import type { AppData } from "@/lib/types";
import { TAGLINE } from "./Achievements";
import { CalendarPopover } from "./CalendarPopover";
import { AnimatedNumber, Dot, Label } from "./ui";

/** The five things this tracker records, shown under the wordmark. */
const TRACKS = ["체중", "식단", "운동", "주사", "컨디션"];

/**
 * Header cells are direct children of the page bento grid (6 cols mobile / 12 cols desktop).
 * DOM order is YM → Streak → Nav so that on mobile YM + Streak share the first row and
 * navigation sits full-width below; on desktop explicit col-starts restore YM | Nav | Streak.
 */
export function Header({
  selected,
  onMove,
  onToday,
  streak,
  onOpenSettings,
  data,
  calendarOpen,
  onCalendarOpenChange,
  onPick,
}: {
  selected: string;
  onMove: (delta: number) => void;
  onToday: () => void;
  streak: number;
  onOpenSettings: () => void;
  data: AppData;
  /** Lifted to Dashboard so global ← → T shortcuts pause while the calendar is open. */
  calendarOpen: boolean;
  onCalendarOpenChange: (open: boolean) => void;
  onPick: (key: string) => void;
}) {
  const calTrigger = useRef<HTMLButtonElement>(null);
  const closeCalendar = useCallback(() => onCalendarOpenChange(false), [onCalendarOpenChange]);
  const d = fromKey(selected);
  const ym = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const isToday = selected === todayKey();
  const isFuture = selected > todayKey();

  return (
    <>
      {/* Year / Month — the poster headline */}
      <div className="relative col-span-4 flex flex-col justify-between gap-3 overflow-hidden px-5 pt-4 pb-3 max-md:hidden md:col-span-5 md:px-6 md:pt-5 md:pb-4">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[12px] font-bold tracking-[0.08em]">WEIGHT/LOG</span>
            <span className="hidden text-[12px] text-ink/60 sm:inline">{TAGLINE}</span>
          </span>
          {/* what this app records — read before the big date */}
          <ul aria-label="기록 항목" className="flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-ink/55">
            {TRACKS.map((t, i) => (
              <li key={t} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-ink/25">·</span>}
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative h-[clamp(3rem,13vw,8.5rem)] md:h-[clamp(3.75rem,6.5vw,6.25rem)]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1
              key={ym}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="display-tight absolute inset-x-0 bottom-0 text-[clamp(3rem,13vw,8.5rem)] md:text-[clamp(3.75rem,6.5vw,6.25rem)]"
            >
              {ym}
            </motion.h1>
          </AnimatePresence>
        </div>
      </div>

      {/* Streak + settings (desktop; on phones the streak lives in the summary details) */}
      <div className="col-span-2 flex items-stretch max-md:hidden md:col-span-3 md:col-start-10 md:row-start-1">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4">
          <Label>
            <span className="md:hidden">연속</span>
            <span className="hidden md:inline">연속 기록</span>
          </Label>
          <div className="flex items-end gap-2">
            <AnimatedNumber value={streak} decimals={0} className="display-tight text-[2.75rem] md:text-[3.75rem]" />
            <span className="pb-1.5 font-mono text-[11px] leading-tight text-ink/55">
              일<span className="hidden md:inline">째</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="설정 열기"
          onClick={onOpenSettings}
          className="group flex w-11 shrink-0 items-start justify-center border-l border-ink/15 pt-4 transition-colors hover:bg-ink hover:text-paper md:w-14 md:pt-5"
        >
          <Settings2 size={20} strokeWidth={1.75} className="transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>

      {/* Date navigation */}
      <div
        className={`relative col-span-6 flex flex-col justify-between gap-3 px-2 py-2 md:col-span-4 md:col-start-6 md:row-start-1 md:px-6 md:pt-5 md:pb-4 ${calendarOpen ? "z-50" : ""}`}
      >
        <div className="hidden items-center justify-between md:flex">
          <Label>기록 날짜</Label>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]">
            <Dot tone={isToday ? "acid" : isFuture ? "blaze" : "ink"} />
            {isToday ? "Today" : isFuture ? "Future" : "Past"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NavButton label="이전 날" onClick={() => onMove(-1)}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </NavButton>
          {/* The date itself opens the month calendar */}
          <button
            ref={calTrigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={calendarOpen}
            aria-label={`${selected} — 달력 열기`}
            onClick={() => onCalendarOpenChange(!calendarOpen)}
            className={`group flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden transition-colors md:items-baseline ${
              calendarOpen ? "bg-ink text-paper" : "hover:bg-ink/5"
            }`}
          >
            <span className="display-tight shrink-0 text-[clamp(1.25rem,6.5vw,1.75rem)] md:hidden">
              {d.getMonth() + 1}.{d.getDate()}
            </span>
            <AnimatedNumber value={d.getDate()} decimals={0} className="display-tight text-[3.25rem] max-md:hidden" />
            {/* very narrow phones keep just the date */}
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-[0.12em] max-[359px]:hidden">
              {weekday(selected)}
              <CalendarDays size={14} strokeWidth={1.75} className={calendarOpen ? "" : "text-ink/50 group-hover:text-ink"} />
            </span>
          </button>
          <NavButton label="다음 날" onClick={() => onMove(1)}>
            <ArrowRight size={20} strokeWidth={1.75} />
          </NavButton>
          {/* Phones: today + settings join the same row */}
          <button
            type="button"
            onClick={onToday}
            disabled={isToday}
            aria-label={isToday ? "오늘" : "오늘로 이동"}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink bg-acid font-mono text-[11px] font-bold transition-colors disabled:border-ink/20 disabled:bg-transparent disabled:text-ink/35 md:hidden"
          >
            오늘
          </button>
          <button
            type="button"
            aria-label="설정 열기"
            onClick={onOpenSettings}
            className="flex h-11 w-11 shrink-0 items-center justify-center md:hidden"
          >
            <Settings2 size={20} strokeWidth={1.75} />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          disabled={isToday}
          className="-my-2 self-center px-3 py-2.5 max-md:hidden font-mono text-[11px] uppercase tracking-[0.12em] underline md:my-0 md:py-0 decoration-ink/30 underline-offset-4 transition hover:decoration-ink disabled:no-underline disabled:opacity-35"
        >
          {isToday ? "오늘" : "← 오늘로 이동"}
        </button>
        <AnimatePresence>
          {calendarOpen && (
            <CalendarPopover
              data={data}
              selected={selected}
              triggerRef={calTrigger}
              onClose={closeCalendar}
              onPick={(k) => {
                onPick(k);
                closeCalendar();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink/20 transition-colors hover:border-ink hover:bg-ink hover:text-paper"
    >
      {children}
    </motion.button>
  );
}
