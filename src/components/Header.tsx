"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CornerDownLeft, Flame, Settings2 } from "lucide-react";
import { fromKey, todayKey, weekday } from "@/lib/date";
import { AnimatedNumber, BrutalButton } from "./ui";

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
}: {
  selected: string;
  onMove: (delta: number) => void;
  onToday: () => void;
  streak: number;
  onOpenSettings: () => void;
}) {
  const d = fromKey(selected);
  const ym = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const isToday = selected === todayKey();
  const isFuture = selected > todayKey();

  return (
    <>
      {/* Year / Month */}
      <div className="relative col-span-4 overflow-hidden px-3 pt-3 pb-2 md:col-span-5 md:px-4">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] md:text-[11px]">
          [ WEIGHT/LOG ] <span className="hidden sm:inline">— Personal Studio</span>
        </p>
        <div className="relative h-[clamp(3rem,13vw,9.5rem)] md:h-[clamp(4.5rem,11vw,9.5rem)]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1
              key={ym}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="display-tight absolute inset-x-0 bottom-0 text-[clamp(3rem,13vw,9.5rem)] md:text-[clamp(4.5rem,11vw,9.5rem)]"
            >
              {ym}
            </motion.h1>
          </AnimatePresence>
        </div>
      </div>

      {/* Streak + settings */}
      <div className="col-span-2 flex items-stretch md:col-span-3 md:col-start-10 md:row-start-1">
        <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-3 md:px-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] md:text-[11px]">Streak</span>
          <div className="flex items-end gap-1.5 md:gap-2">
            <motion.div
              key={streak}
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className={`hidden h-12 w-12 items-center justify-center border-2 border-ink md:flex ${streak > 0 ? "bg-blaze" : "bg-paper"}`}
            >
              <Flame size={26} strokeWidth={2.5} />
            </motion.div>
            <Flame size={18} strokeWidth={2.5} className={`mb-1 shrink-0 md:hidden ${streak > 0 ? "text-blaze" : ""}`} />
            <AnimatedNumber value={streak} decimals={0} className="display-tight text-[2.5rem] md:text-[4.5rem]" />
            <span className="hidden pb-1 font-mono text-xs font-bold md:inline">
              DAYS
              <br />
              연속
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="설정 열기"
          onClick={onOpenSettings}
          className="flex w-11 shrink-0 items-center justify-center border-l-2 border-ink transition-colors hover:bg-ink hover:text-acid md:w-16"
        >
          <motion.span whileHover={{ rotate: 90 }} whileTap={{ scale: 0.8 }} className="block">
            <Settings2 size={22} strokeWidth={2.25} />
          </motion.span>
        </button>
      </div>

      {/* Navigation */}
      <div className="col-span-6 flex flex-col justify-between gap-2 px-3 py-3 md:col-span-4 md:col-start-6 md:row-start-1 md:gap-3 md:px-4">
        <div className="hidden items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] md:flex">
          <span>Navigate</span>
          <span className={isToday ? "bg-acid px-1.5 font-bold" : isFuture ? "bg-blaze px-1.5 font-bold" : ""}>
            {isToday ? "● TODAY" : isFuture ? "FUTURE" : "PAST"}
          </span>
        </div>
        <div className="flex items-stretch gap-2">
          <BrutalButton aria-label="이전 날" onClick={() => onMove(-1)} className="h-12 w-12 shrink-0 md:h-14 md:w-14">
            <ArrowLeft size={22} strokeWidth={2.5} />
          </BrutalButton>
          <div className="flex flex-1 items-center justify-center gap-2 border-2 border-ink bg-paper">
            <AnimatedNumber value={d.getDate()} decimals={0} className="display-tight text-4xl md:text-5xl" />
            <span className="font-mono text-xs font-bold leading-tight">
              {weekday(selected)}
              <br />
              <span className={isToday ? "bg-acid" : isFuture ? "bg-blaze" : ""}>
                {isToday ? "TODAY" : "DAY"}
              </span>
            </span>
          </div>
          <BrutalButton aria-label="다음 날" onClick={() => onMove(1)} className="h-12 w-12 shrink-0 md:h-14 md:w-14">
            <ArrowRight size={22} strokeWidth={2.5} />
          </BrutalButton>
          {/* Mobile: compact today button inline */}
          <BrutalButton
            tone={isToday ? "paper" : "acid"}
            onClick={onToday}
            disabled={isToday}
            aria-label="오늘로 이동"
            className="h-12 w-12 shrink-0 md:hidden"
          >
            <CornerDownLeft size={18} strokeWidth={2.5} />
          </BrutalButton>
        </div>
        <div className="hidden md:block">
          <BrutalButton tone={isToday ? "paper" : "acid"} onClick={onToday} disabled={isToday} className="h-9 w-full">
            <CornerDownLeft size={14} strokeWidth={2.5} /> 오늘로 이동
          </BrutalButton>
        </div>
      </div>
    </>
  );
}
