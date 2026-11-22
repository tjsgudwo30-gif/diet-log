"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, LineChart, NotebookPen, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fromKey, todayKey, weekdayKo } from "@/lib/date";
import type { DietStore } from "@/lib/store";
import type { Category } from "@/lib/types";
import { CalendarPopover } from "../CalendarPopover";
import { PhoneSummary } from "../Hero";
import { TrendChart } from "../TrendChart";
import { Dot } from "../ui";
import { EntrySheet, type SheetRequest } from "./EntrySheet";
import { TodayFeed } from "./TodayFeed";

type Tab = "today" | "trend";
const SNACK_MS = 5000;

/**
 * Phone app shell (< md): slim date header, one screen per tab, a fixed bottom tab bar,
 * and the entry bottom sheet. Uses the same store and selected-day state as the desktop view.
 */
export function MobileApp({
  store,
  selected,
  onMove,
  onToday,
  onPick,
  onOpenSettings,
  calendarOpen,
  onCalendarOpenChange,
}: {
  store: DietStore;
  selected: string;
  onMove: (delta: number) => void;
  onToday: () => void;
  onPick: (key: string) => void;
  onOpenSettings: () => void;
  calendarOpen: boolean;
  onCalendarOpenChange: (open: boolean) => void;
}) {
  const { data } = store;
  const [tab, setTab] = useState<Tab>("today");

  /* ---------- entry sheet (request kept while it animates out) ---------- */
  const [sheet, setSheet] = useState<{ req: SheetRequest; n: number; open: boolean } | null>(null);
  const openSheet = useCallback((req: SheetRequest) => {
    onCalendarOpenChange(false);
    setSheet((s) => ({ req, n: (s?.n ?? 0) + 1, open: true }));
  }, [onCalendarOpenChange]);
  const closeSheet = useCallback(() => setSheet((s) => (s ? { ...s, open: false } : s)), []);

  /* ---------- snackbar: confirmations + undo for deletes ---------- */
  const [snack, setSnack] = useState<{ id: number; text: string; undo?: () => void } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSnack = useCallback((text: string, undo?: () => void) => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnack({ id: Date.now(), text, undo });
    snackTimer.current = setTimeout(() => setSnack(null), undo ? SNACK_MS : 1800);
  }, []);
  useEffect(
    () => () => {
      if (snackTimer.current) clearTimeout(snackTimer.current);
    },
    []
  );

  /**
   * Deletes keep a copy of the day; "되돌리기" merges it back (restoreDay keeps anything
   * recorded meanwhile, so undo never wipes a newer entry).
   */
  const withUndo = (text: string, act: () => void) => {
    const key = selected;
    const snapshot = data.days[key];
    act();
    closeSheet();
    if (snapshot) showSnack(text, () => store.restoreDay(key, snapshot));
  };
  const removeLog = (cat: Category, id: string) => withUndo("삭제했어요", () => store.removeLog(selected, cat, id));
  const clearNote = () => withUndo("메모를 지웠어요", () => store.setNote(selected, ""));
  const clearWeight = () => withUndo("체중을 지웠어요", () => store.setWeight(selected, undefined));

  const switchTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh bg-paper">
      <MobileHeader
        selected={selected}
        onMove={onMove}
        onToday={onToday}
        onPick={onPick}
        onOpenSettings={onOpenSettings}
        calendarOpen={calendarOpen}
        onCalendarOpenChange={onCalendarOpenChange}
        store={store}
      />

      <main className="px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]">
        {tab === "today" ? (
          <TodayFeed store={store} selected={selected} onOpen={openSheet} onRemoveLog={removeLog} onClearNote={clearNote} />
        ) : (
          <div className="space-y-4">
            <div className="border-[1.5px] border-ink">
              <PhoneSummary store={store} selected={selected} />
            </div>
            <div className="border-[1.5px] border-ink">
              <TrendChart
                store={store}
                selected={selected}
                onSelect={(k) => {
                  onPick(k);
                  switchTab("today");
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Snackbar, just above the tab bar */}
      <AnimatePresence>
        {snack && (
          <motion.div
            key={snack.id}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-50 flex min-h-12 items-center justify-between gap-3 bg-ink pl-4 font-mono text-[12px] text-paper"
          >
            <span className="min-w-0 truncate py-3">{snack.text}</span>
            {snack.undo && (
              <button
                type="button"
                onClick={() => {
                  snack.undo?.();
                  setSnack(null);
                }}
                className="h-12 shrink-0 px-4 font-bold text-acid"
              >
                되돌리기
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <TabBar tab={tab} onChange={switchTab} />

      <EntrySheet
        store={store}
        selected={selected}
        state={sheet}
        onClose={closeSheet}
        onSaved={(msg) => {
          closeSheet();
          showSnack(msg);
        }}
        onRemoveLog={removeLog}
        onClearNote={clearNote}
        onClearWeight={clearWeight}
      />
    </div>
  );
}

/* ---------- Top: date bar (52px) ---------- */

function MobileHeader({
  selected,
  onMove,
  onToday,
  onPick,
  onOpenSettings,
  calendarOpen,
  onCalendarOpenChange,
  store,
}: {
  selected: string;
  onMove: (delta: number) => void;
  onToday: () => void;
  onPick: (key: string) => void;
  onOpenSettings: () => void;
  calendarOpen: boolean;
  onCalendarOpenChange: (open: boolean) => void;
  store: DietStore;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => onCalendarOpenChange(false), [onCalendarOpenChange]);
  const d = fromKey(selected);
  const isToday = selected === todayKey();

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper pt-[env(safe-area-inset-top)]">
      <div className="relative flex h-[52px] items-center gap-0.5 px-1">
        <IconButton label="이전 날" onClick={() => onMove(-1)}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </IconButton>
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
          aria-label={`${selected} — 달력 열기`}
          onClick={() => onCalendarOpenChange(!calendarOpen)}
          className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-2 ${calendarOpen ? "bg-ink text-paper" : ""}`}
        >
          {isToday && <Dot tone="acid" />}
          <span className="display-tight truncate text-[1.5rem]">
            {d.getMonth() + 1}.{d.getDate()}
          </span>
          <span className="font-mono text-[12px] font-bold">{weekdayKo(selected)}</span>
          <CalendarDays size={15} strokeWidth={1.75} className={calendarOpen ? "" : "text-ink/45"} />
        </button>
        <IconButton label="다음 날" onClick={() => onMove(1)}>
          <ArrowRight size={20} strokeWidth={1.75} />
        </IconButton>
        <button
          type="button"
          onClick={onToday}
          disabled={isToday}
          aria-label={isToday ? "오늘" : "오늘로 이동"}
          className="h-11 shrink-0 px-2.5 font-mono text-[11px] font-bold disabled:text-ink/30"
        >
          오늘
        </button>
        <IconButton label="설정 열기" onClick={onOpenSettings}>
          <Settings2 size={20} strokeWidth={1.75} />
        </IconButton>

        <AnimatePresence>
          {calendarOpen && (
            <CalendarPopover
              data={store.data}
              selected={selected}
              triggerRef={trigger}
              onClose={close}
              onPick={(k) => {
                onPick(k);
                close();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-11 w-11 shrink-0 items-center justify-center active:bg-ink/10">
      {children}
    </button>
  );
}

/* ---------- Bottom: tab bar ---------- */

const TABS: { key: Tab; label: string; Icon: typeof NotebookPen }[] = [
  { key: "today", label: "오늘", Icon: NotebookPen },
  { key: "trend", label: "추이", Icon: LineChart },
];

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label="화면 전환" className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-ink bg-paper pb-[env(safe-area-inset-bottom)]">
      <div role="tablist" className="grid h-14 grid-cols-2">
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(key)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${on ? "text-ink" : "text-ink/40"}`}
            >
              {on && <motion.span layoutId="tabbar-mark" className="absolute inset-x-8 top-0 h-[3px] bg-ink" />}
              <Icon size={20} strokeWidth={on ? 2 : 1.75} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
