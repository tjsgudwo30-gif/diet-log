"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, todayKey } from "@/lib/date";
import { computeStreak, useDietStore } from "@/lib/store";
import { DailyLog } from "./DailyLog";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { SettingsModal } from "./SettingsModal";
import { TrendChart } from "./TrendChart";
import { QuickBar } from "./QuickBar";

export function Dashboard() {
  const store = useDietStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pulse, setPulse] = useState(0);

  // Chart point click: jump to that day, then bring its diet/exercise log into view.
  const selectFromChart = useCallback((k: string) => {
    setSelected(k);
    setPulse((p) => p + 1);
    requestAnimationFrame(() =>
      document.getElementById("daily-log")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, []);

  // Resolve "today" on the client to avoid server/client timezone mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only date
    setSelected(todayKey());
  }, []);

  const move = useCallback((d: number) => setSelected((s) => (s ? addDays(s, d) : s)), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // Keyboard: ← / → to move days, T for today (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || settingsOpen) return;
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key.toLowerCase() === "t") setSelected(todayKey());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, settingsOpen]);

  if (!store.ready || !selected) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="display-tight animate-pulse text-6xl">LOADING—</span>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] p-2 pb-[calc(var(--quickbar-h,0px)+1.5rem)] transition-[padding] duration-200 sm:p-5 sm:pb-[calc(var(--quickbar-h,0px)+1.5rem)] md:pb-5">
      <div className="bento grid-cols-6 md:grid-cols-12">
        <Header
          selected={selected}
          onMove={move}
          onToday={() => setSelected(todayKey())}
          streak={computeStreak(store.data)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <Hero store={store} selected={selected} />
        <TrendChart store={store} selected={selected} onSelect={selectFromChart} />
        <DailyLog store={store} selected={selected} pulse={pulse} />
      </div>
      <footer className="flex flex-col gap-1 px-1 pt-3 font-mono text-[10.5px] text-ink/50 md:flex-row md:justify-between">
        <span>
          <b className="font-bold text-ink/70">WEIGHT/LOG</b> · 체중 · 식단 · 운동 · 주사 · 컨디션 다이어트 데일리 트래커
        </span>
        <span>
          <span className="hidden md:inline">← → 날짜 이동 · T 오늘 · </span>기록은 이 기기에만 저장돼요 (설정에서 백업)
        </span>
      </footer>
      <QuickBar store={store} selected={selected} />
      <SettingsModal open={settingsOpen} onClose={closeSettings} store={store} />
    </main>
  );
}
