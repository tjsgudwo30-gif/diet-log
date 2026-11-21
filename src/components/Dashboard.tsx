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
    <main className="mx-auto max-w-[1600px] p-2 pb-[290px] sm:p-5 sm:pb-[290px] md:pb-5">
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
      <footer className="hidden justify-between md:flex px-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] opacity-60">
        <span>← → 날짜 이동 · T 오늘</span>
        <span>Saved locally · LocalStorage</span>
      </footer>
      <QuickBar store={store} selected={selected} />
      <SettingsModal open={settingsOpen} onClose={closeSettings} store={store} />
    </main>
  );
}
