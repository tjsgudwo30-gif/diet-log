"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Minus, Plus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortLabel, todayKey, weekdayKo } from "@/lib/date";
import {
  appendNoteToken,
  cleanNote,
  lastInjection,
  latestWeight,
  NOTE_SEP,
  noteTokens,
  parseKg,
  type DietStore,
} from "@/lib/store";
import { CATEGORIES, NOTE_MAX, NOTE_PRESETS, type Category } from "@/lib/types";
import { Chip, Dot } from "./ui";

const SAVED_FEEDBACK_MS = 1200;
/** Weekly GLP-1 style schedule: an injection is "due" 7+ days after the last one. */
const INJECTION_INTERVAL_DAYS = 7;

/** Quick-bar input modes: every log category plus the one-line day note. */
type Mode = Category | "note";
const MODES: { key: Mode; label: string }[] = [...CATEGORIES.map((c) => ({ key: c.key, label: c.label })), { key: "note", label: "컨디션" }];

const PLACEHOLDER: Partial<Record<Mode, string>> = {
  exercise: "운동 메모…",
  injection: "약품 · 용량 · 부위",
  note: "오늘 컨디션 한 줄",
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

  const isToday = selected === todayKey();
  const lastInj = lastInjection(data, selected, { strict: true });
  const injectedToday = (day?.logs.injection?.length ?? 0) > 0;
  // The reminder is about *today*: browsing a past/future day never shows "주사 예정일".
  const injectionDue = isToday && !!lastInj && !injectedToday && lastInj.daysAgo >= INJECTION_INTERVAL_DAYS;

  // Publish the bar's real height as --quickbar-h so the page can reserve exactly that much
  // bottom space (collapsed ≈ 56px, expanded ≈ 200–260px, + reminder strip).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty("--quickbar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--quickbar-h");
    };
  }, []);

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
  /** Short status line under the chips (duplicate / length limit); auto-clears. */
  const [hint, setHint] = useState<{ text: string; warn: boolean } | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    []
  );
  const showHint = (text: string, warn: boolean) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint({ text, warn });
    hintTimer.current = setTimeout(() => setHint(null), 1800);
  };

  /** Note mode appends a " · " segment ("회식 · 붓기"); duplicates are checked per segment. */
  const appendNote = (value: string) => {
    const r = appendNoteToken(note, value);
    if (r.ok) {
      setNote(selected, r.next);
      return true;
    }
    if (r.reason === "dup") showHint(`'${cleanNote(value)}' 이미 있어요`, false);
    if (r.reason === "max") showHint(`${NOTE_MAX}자 한도 — 메모를 줄여 주세요 (${note.length}/${NOTE_MAX})`, true);
    return false;
  };
  const noteParts = noteTokens(note);

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
      // presets toggle: a chip that is already in the note is removed again
      if (noteParts.includes(t)) {
        setNote(selected, noteParts.filter((x) => x !== t).join(NOTE_SEP));
        showHint(`'${t}' 뺐어요`, false);
        return;
      }
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

  const count = cat === "note" ? (note ? 1 : 0) : (day?.logs[cat]?.length ?? 0);
  const chips = cat === "note" ? NOTE_PRESETS : data.tags[cat];

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-ink bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      {/* Injection-day reminder (today only) */}
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
            className="flex w-full items-center justify-between gap-2 overflow-hidden border-b border-ink/15 px-4 font-mono text-[11px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Dot tone="blaze" />
              <span className="truncate">
                주사 예정일 · 지난 투약 {shortLabel(lastInj.key)} (D+{lastInj.daysAgo})
              </span>
            </span>
            <span className="shrink-0 font-bold underline underline-offset-4">기록</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Row 1: date / weight stepper */}
      <div className="flex h-12 items-stretch">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "퀵 입력 접기" : "퀵 입력 펼치기"}
          aria-expanded={expanded}
          className="flex w-[4.25rem] shrink-0 items-center justify-center gap-1 border-r border-ink/15 font-mono text-[11px] font-bold"
        >
          {isToday && <Dot tone="acid" />}
          <span className="leading-tight">
            {shortLabel(selected)}
            <span className="block text-[10px] font-normal text-ink/50">{weekdayKo(selected)}</span>
          </span>
          {expanded ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronUp size={12} strokeWidth={2} />}
        </button>
        <StepButton label="0.1kg 감소" onClick={() => nudge(-0.1)}>
          <Minus size={18} strokeWidth={2} />
        </StepButton>
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
            className="display-tight w-full min-w-0 bg-transparent text-center text-[2.1rem] outline-none placeholder:text-ink/20 focus:underline focus:decoration-2 focus:underline-offset-4"
          />
          <span className="shrink-0 pr-1 font-mono text-[11px] text-ink/50">kg</span>
        </form>
        <StepButton label="0.1kg 증가" onClick={() => nudge(0.1)} right>
          <Plus size={18} strokeWidth={2} />
        </StepButton>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            className="overflow-hidden border-t border-ink/15"
          >
            {/* Mode tabs: text + underline, dot = already recorded */}
            <div role="tablist" aria-label="입력 종류" className="grid grid-cols-7 px-1">
              {MODES.map((c) => {
                const on = cat === c.key;
                const done = c.key === "note" ? !!note : c.key === "injection" ? injectedToday : false;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setCat(c.key);
                      inputRef.current?.focus({ preventScroll: true });
                    }}
                    className={`relative h-10 text-[12.5px] font-bold transition-colors ${on ? "text-ink" : "text-ink/40"}`}
                  >
                    {c.label}
                    {done && <span aria-hidden className="absolute top-2 right-1.5 h-1 w-1 bg-ink" />}
                    {on && (
                      <motion.span
                        layoutId="qb-tab"
                        className={`absolute inset-x-2 bottom-1 h-[2px] ${c.key === "injection" ? "bg-blaze" : "bg-ink"}`}
                        transition={{ type: "spring", stiffness: 600, damping: 40 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* One-tap chips */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5">
              {cat === "injection" && lastInj && !injectedToday && (
                <Chip onClick={() => submit(lastInj.text)} title={lastInj.text} className="border-ink">
                  ↺ 지난번과 동일
                </Chip>
              )}
              {chips.map((t) => {
                const used = cat === "note" && noteParts.includes(t);
                return (
                  <Chip key={t} active={used} aria-pressed={cat === "note" ? used : undefined} onClick={() => tapTag(t)}>
                    {t}
                  </Chip>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {hint && (
                <motion.p
                  key={hint.text}
                  role="status"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`overflow-hidden px-4 font-mono text-[11px] ${hint.warn ? "text-blaze" : "text-ink/55"}`}
                >
                  <span className="block pb-2">{hint.text}</span>
                </motion.p>
              )}
            </AnimatePresence>
            {cat === "note" && note && (
              <p className="flex items-center gap-2 px-4 pb-2 font-mono text-[11px] text-ink/60">
                <span className="min-w-0 flex-1 truncate">{note}</span>
                <span className={`shrink-0 tabular-nums ${note.length >= NOTE_MAX * 0.9 ? "text-blaze" : "text-ink/40"}`}>
                  {note.length}/{NOTE_MAX}
                </span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memo input */}
      {expanded && (
        <form
          className="flex h-11 items-stretch border-t border-ink/15"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span className="flex w-12 shrink-0 items-center justify-center font-mono text-[11px] text-ink/45">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={`${cat}-${count}`} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
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
            aria-label={`${MODES.find((c) => c.key === cat)?.label ?? ""} 입력`}
            placeholder={PLACEHOLDER[cat] ?? `${MODES.find((c) => c.key === cat)?.label ?? ""} 기록`}
            className="min-w-0 flex-1 bg-transparent px-1 font-mono text-[15px] outline-none placeholder:text-ink/30"
          />
          <motion.button
            type="submit"
            aria-label={justSaved ? "저장됨" : "저장"}
            whileTap={{ scale: 0.88 }}
            initial={false}
            animate={{ backgroundColor: justSaved ? "#CCFF00" : "#000000", color: justSaved ? "#000000" : "#F4F4F0" }}
            transition={{ duration: 0.15 }}
            className="flex w-12 shrink-0 items-center justify-center"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={justSaved ? "saved" : "send"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
              >
                {justSaved ? <Check size={20} strokeWidth={2.5} /> : <Send size={16} strokeWidth={2} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </form>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  right = false,
  children,
}: {
  label: string;
  onClick: () => void;
  right?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      className={`flex w-12 shrink-0 items-center justify-center border-ink/15 active:bg-ink active:text-paper ${right ? "border-l" : "border-r"}`}
    >
      {children}
    </motion.button>
  );
}
