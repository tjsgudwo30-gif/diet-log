"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Minus, Plus, Send, Syringe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortLabel, todayKey, weekdayKo } from "@/lib/date";
import { cleanNote, lastInjection, latestWeight, parseKg, type DietStore } from "@/lib/store";
import { CATEGORIES, NOTE_MAX, NOTE_PRESETS, type Category } from "@/lib/types";

const SAVED_FEEDBACK_MS = 1200;
/** Weekly GLP-1 style schedule: an injection is "due" 7+ days after the last one. */
const INJECTION_INTERVAL_DAYS = 7;

/** Quick-bar input modes: every log category plus the one-line day note. */
type Mode = Category | "note";
const MODES: { key: Mode; label: string }[] = [...CATEGORIES.map((c) => ({ key: c.key, label: c.label })), { key: "note", label: "메모" }];

const PLACEHOLDER: Partial<Record<Mode, string>> = {
  exercise: "운동 메모…",
  injection: "약품·용량·부위 (위고비 0.5mg 복부)",
  note: "오늘 컨디션 한 줄 (회식, 붓기…)",
};

/** Pick the meal slot that fits the current time of day. */
function defaultCategory(): Category {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

/**
 * Mobile-only bottom bar: weight (± / direct input) + category + memo + one-tap tags,
 * all within thumb reach. Hidden on md+ where the full dashboard is comfortable.
 */
export function QuickBar({ store, selected }: { store: DietStore; selected: string }) {
  const { data, setWeight, addLog, addTagEntry, setNote } = store;
  const day = data.days[selected];
  const weight = day?.weight;
  const note = day?.note ?? "";
  const base = weight ?? latestWeight(data, selected) ?? data.goalWeight + 5;

  const lastInj = lastInjection(data, selected, { strict: true });
  const injectedToday = (day?.logs.injection?.length ?? 0) > 0;
  const injectionDue = !!lastInj && !injectedToday && lastInj.daysAgo >= INJECTION_INTERVAL_DAYS;

  // Open straight on the injection tab on an injection day; otherwise on the meal for this hour.
  const [cat, setCat] = useState<Mode>(() => (injectionDue ? "injection" : defaultCategory()));
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  /** true for SAVED_FEEDBACK_MS after an entry is stored → shows the Check state. */
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drop a stale draft when the day changes
    setDraft(null);
  }, [selected]);

  // Never leave a pending timer behind after unmount.
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const flashSaved = () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setJustSaved(true);
    savedTimer.current = setTimeout(() => {
      setJustSaved(false);
      savedTimer.current = null;
    }, SAVED_FEEDBACK_MS);
  };

  const nudge = (d: number) => setWeight(selected, Math.max(20, Math.min(300, base + d)));
  const commitWeight = () => {
    if (draft === null) return;
    const v = parseKg(draft);
    if (v !== null) setWeight(selected, v);
    setDraft(null);
  };
  /** Note mode appends to the day's note ("회식 · 붓기"), skipping duplicates and the length cap. */
  const appendNote = (value: string) => {
    const v = cleanNote(value);
    if (!v || note.includes(v)) return false;
    const next = note ? `${note} · ${v}` : v;
    if (next.length > NOTE_MAX) return false;
    setNote(selected, next);
    return true;
  };

  const submit = (value = text) => {
    if (!value.trim()) return;
    if (cat === "note") {
      if (!appendNote(value)) return;
    } else {
      addLog(selected, cat, value);
    }
    if (value === text) setText("");
    flashSaved();
  };

  /** Tag chip: injection tags merge into one record; note presets append; others add a line. */
  const tapTag = (t: string) => {
    if (cat === "note") {
      if (appendNote(t)) flashSaved();
      return;
    }
    if (cat === "injection") {
      addTagEntry(selected, cat, t);
      flashSaved();
      return;
    }
    submit(t);
  };

  const isToday = selected === todayKey();
  const count = cat === "note" ? (note ? 1 : 0) : (day?.logs[cat]?.length ?? 0);
  const chips = cat === "note" ? NOTE_PRESETS : data.tags[cat];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_0_0_rgba(0,0,0,0.08)] md:hidden">
      {/* Row 0: injection-day reminder */}
      <AnimatePresence initial={false}>
        {injectionDue && lastInj && (
          <motion.button
            type="button"
            initial={{ height: 0 }}
            animate={{ height: 32 }}
            exit={{ height: 0 }}
            onClick={() => {
              setCat("injection");
              setExpanded(true);
            }}
            className="flex w-full items-center justify-between gap-2 overflow-hidden border-b-2 border-ink bg-blaze px-3 font-mono text-[11px] font-bold"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Syringe size={13} strokeWidth={2.5} className="shrink-0" />
              <span className="truncate">
                주사 예정일 · 지난 투약 {shortLabel(lastInj.key)} (D+{lastInj.daysAgo})
              </span>
            </span>
            <span className="shrink-0 bg-ink px-1.5 text-acid">기록 →</span>
          </motion.button>
        )}
      </AnimatePresence>
      {/* Row 1: date chip + weight controls */}
      <div className="flex h-14 items-stretch border-b-2 border-ink">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "퀵 입력 접기" : "퀵 입력 펼치기"}
          className={`flex w-14 shrink-0 flex-col items-center justify-center border-r-2 border-ink font-mono text-[10px] font-bold leading-tight ${isToday ? "bg-acid" : "bg-ink text-paper"}`}
        >
          {shortLabel(selected)}
          <span className="flex items-center gap-0.5">
            {weekdayKo(selected)}
            {expanded ? <ChevronDown size={11} strokeWidth={3} /> : <ChevronUp size={11} strokeWidth={3} />}
          </span>
        </button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88, backgroundColor: "#CCFF00" }}
          onClick={() => nudge(-0.1)}
          aria-label="0.1kg 감소"
          className="flex w-14 shrink-0 items-center justify-center border-r-2 border-ink"
        >
          <Minus size={22} strokeWidth={3} />
        </motion.button>
        <form
          className="flex min-w-0 flex-1 items-center justify-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            commitWeight();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label="체중 (kg)"
            value={draft ?? (weight !== undefined ? weight.toFixed(1) : "")}
            placeholder={base.toFixed(1)}
            onFocus={(e) => {
              setDraft(weight !== undefined ? weight.toFixed(1) : "");
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitWeight}
            className="display-tight w-full min-w-0 bg-transparent text-center text-[2.6rem] outline-none placeholder:text-ink/25 focus:bg-acid"
          />
          <span className="display-tight shrink-0 pr-1 text-lg">KG</span>
        </form>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88, backgroundColor: "#CCFF00" }}
          onClick={() => nudge(0.1)}
          aria-label="0.1kg 증가"
          className="flex w-14 shrink-0 items-center justify-center border-l-2 border-ink"
        >
          <Plus size={22} strokeWidth={3} />
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="overflow-hidden"
          >
            {/* Row 2: category segmented control */}
            <div className="grid grid-cols-7 border-b-2 border-ink">
              {MODES.map((c, i) => {
                const on = cat === c.key;
                const isInj = c.key === "injection";
                const done =
                  c.key === "note" ? !!note : c.key === "injection" ? injectedToday : false;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setCat(c.key);
                      inputRef.current?.focus({ preventScroll: true });
                    }}
                    className={`relative h-10 text-[13px] font-black ${i ? "border-l-2 border-ink" : ""} ${isInj && !on ? "text-blaze" : ""}`}
                  >
                    {on && (
                      <motion.span
                        layoutId="qb-cat"
                        className={`absolute inset-0 ${isInj ? "bg-blaze" : "bg-ink"}`}
                        transition={{ type: "spring", stiffness: 600, damping: 40 }}
                      />
                    )}
                    <span className={`relative ${on && !isInj ? "text-acid" : ""}`}>{c.label}</span>
                    {done && (
                      <span aria-hidden className="absolute top-0.5 right-0.5 h-1.5 w-1.5 border border-ink bg-acid" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Row 3: one-tap chips (horizontal scroll) */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b-2 border-ink px-2 py-2">
              {cat === "injection" && lastInj && !injectedToday && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => submit(lastInj.text)}
                  className="h-8 shrink-0 border-2 border-ink bg-blaze px-2.5 font-mono text-xs font-bold"
                  title={lastInj.text}
                >
                  ↺ 지난번과 동일
                </motion.button>
              )}
              {chips.map((t) => (
                <motion.button
                  key={t}
                  type="button"
                  whileTap={{ scale: 0.9, backgroundColor: "#CCFF00" }}
                  onClick={() => tapTag(t)}
                  className="h-8 shrink-0 border-2 border-ink px-2.5 font-mono text-xs font-bold"
                >
                  {t}
                </motion.button>
              ))}
            </div>
            {cat === "note" && note && (
              <p className="truncate border-b-2 border-ink px-3 py-1.5 font-mono text-[11px]">
                <span className="mr-1 bg-ink px-1 font-bold text-acid">NOTE</span>
                {note}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 4: memo input */}
      {expanded && (
        <form
          className="flex h-12 items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span className="flex w-14 shrink-0 items-center justify-center border-r-2 border-ink font-mono text-[11px] font-bold">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${cat}-${count}`}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
              >
                {cat === "note" ? (count ? "✓" : "—") : count > 0 ? `${count}건` : "—"}
              </motion.span>
            </AnimatePresence>
          </span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="send"
            maxLength={cat === "note" ? NOTE_MAX : 500}
            placeholder={PLACEHOLDER[cat] ?? `${MODES.find((c) => c.key === cat)?.label ?? ""} 메모 입력…`}
            className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[15px] outline-none placeholder:text-ink/35 focus:bg-acid/30"
          />
          <motion.button
            type="submit"
            aria-label={justSaved ? "저장됨" : "저장"}
            whileTap={{ scale: 0.85 }}
            animate={{ backgroundColor: justSaved ? "#CCFF00" : "#000000", color: justSaved ? "#000000" : "#CCFF00" }}
            transition={{ duration: 0.15 }}
            className="flex w-14 shrink-0 items-center justify-center border-l-2 border-ink"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={justSaved ? "saved" : "send"}
                initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 18 }}
              >
                {justSaved ? <Check size={22} strokeWidth={3.5} /> : <Send size={18} strokeWidth={2.5} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </form>
      )}
    </div>
  );
}
