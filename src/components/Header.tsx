"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Settings2 } from "lucide-react";
import { fromKey, todayKey, weekday } from "@/lib/date";
import { AnimatedNumber, Dot, Label } from "./ui";

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
      {/* Year / Month — the poster headline */}
      <div className="relative col-span-4 flex flex-col justify-between gap-3 overflow-hidden px-5 pt-4 pb-3 md:col-span-5 md:px-6 md:pt-5 md:pb-4">
        <Label>Weight / Log</Label>
        <div className="relative h-[clamp(3rem,13vw,8.5rem)] md:h-[clamp(4.5rem,10vw,8.5rem)]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1
              key={ym}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="display-tight absolute inset-x-0 bottom-0 text-[clamp(3rem,13vw,8.5rem)] md:text-[clamp(4.5rem,10vw,8.5rem)]"
            >
              {ym}
            </motion.h1>
          </AnimatePresence>
        </div>
      </div>

      {/* Streak + settings */}
      <div className="col-span-2 flex items-stretch md:col-span-3 md:col-start-10 md:row-start-1">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4">
          <Label>Streak</Label>
          <div className="flex items-end gap-2">
            <AnimatedNumber value={streak} decimals={0} className="display-tight text-[2.75rem] md:text-[4.5rem]" />
            <span className="hidden pb-1.5 font-mono text-[11px] leading-tight text-ink/55 md:block">
              days
              <br />
              연속 기록
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
      <div className="col-span-6 flex flex-col justify-between gap-3 px-4 py-3 md:col-span-4 md:col-start-6 md:row-start-1 md:px-6 md:pt-5 md:pb-4">
        <div className="hidden items-center justify-between md:flex">
          <Label>Date</Label>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]">
            <Dot tone={isToday ? "acid" : isFuture ? "blaze" : "ink"} />
            {isToday ? "Today" : isFuture ? "Future" : "Past"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NavButton label="이전 날" onClick={() => onMove(-1)}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </NavButton>
          <div className="flex flex-1 items-baseline justify-center gap-2">
            <AnimatedNumber value={d.getDate()} decimals={0} className="display-tight text-[2.75rem] md:text-[3.5rem]" />
            <span className="font-mono text-[11px] font-bold tracking-[0.12em]">{weekday(selected)}</span>
          </div>
          <NavButton label="다음 날" onClick={() => onMove(1)}>
            <ArrowRight size={20} strokeWidth={1.75} />
          </NavButton>
        </div>
        <button
          type="button"
          onClick={onToday}
          disabled={isToday}
          className="self-center font-mono text-[11px] uppercase tracking-[0.12em] underline decoration-ink/30 underline-offset-4 transition hover:decoration-ink disabled:no-underline disabled:opacity-35"
        >
          {isToday ? "오늘" : "← 오늘로 이동"}
        </button>
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
      className="flex h-11 w-11 items-center justify-center border border-ink/20 transition-colors hover:border-ink hover:bg-ink hover:text-paper"
    >
      {children}
    </motion.button>
  );
}
