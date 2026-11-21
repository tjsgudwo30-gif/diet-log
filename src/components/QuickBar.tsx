"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Minus, Plus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortLabel, todayKey, weekdayKo } from "@/lib/date";
import { latestWeight, type DietStore } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";

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
  const { data, setWeight, addLog } = store;
  const weight = data.days[selected]?.weight;
  const base = weight ?? latestWeight(data, selected) ?? data.goalWeight + 5;
  const [cat, setCat] = useState<Category>(defaultCategory);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [saved, setSaved] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drop a stale draft when the day changes
    setDraft(null);
  }, [selected]);

  const nudge = (d: number) => setWeight(selected, Math.max(20, Math.min(300, base + d)));
  const commitWeight = () => {
    if (draft === null) return;
    const v = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(v) && v >= 20 && v <= 300) setWeight(selected, v);
    setDraft(null);
  };
  const submit = (value = text) => {
    if (!value.trim()) return;
    addLog(selected, cat, value);
    setText("");
    setSaved((n) => n + 1);
  };

  const isToday = selected === todayKey();
  const count = data.days[selected]?.logs[cat]?.length ?? 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_0_0_rgba(0,0,0,0.08)] md:hidden">
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
            type="number"
            inputMode="decimal"
            step="0.1"
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
            <div className="grid grid-cols-5 border-b-2 border-ink">
              {CATEGORIES.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setCat(c.key);
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                  className={`relative h-10 text-sm font-black ${i ? "border-l-2 border-ink" : ""}`}
                >
                  {cat === c.key && (
                    <motion.span
                      layoutId="qb-cat"
                      className={`absolute inset-0 ${c.key === "exercise" ? "bg-blaze" : "bg-ink"}`}
                      transition={{ type: "spring", stiffness: 600, damping: 40 }}
                    />
                  )}
                  <span className={`relative ${cat === c.key && c.key !== "exercise" ? "text-acid" : ""}`}>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Row 3: one-tap tags (horizontal scroll) */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b-2 border-ink px-2 py-2">
              {data.tags[cat].map((t) => (
                <motion.button
                  key={t}
                  type="button"
                  whileTap={{ scale: 0.9, backgroundColor: "#CCFF00" }}
                  onClick={() => submit(t)}
                  className="h-8 shrink-0 border-2 border-ink px-2.5 font-mono text-xs font-bold"
                >
                  {t}
                </motion.button>
              ))}
            </div>
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
                key={`${cat}-${count}-${saved}`}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
              >
                {count > 0 ? `${count}건` : "—"}
              </motion.span>
            </AnimatePresence>
          </span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="send"
            placeholder={`${CATEGORIES.find((c) => c.key === cat)!.label} 메모 입력…`}
            className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[15px] outline-none placeholder:text-ink/35 focus:bg-acid/30"
          />
          <motion.button
            type="submit"
            aria-label="저장"
            whileTap={{ scale: 0.85 }}
            className="flex w-14 shrink-0 items-center justify-center border-l-2 border-ink bg-ink text-acid"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={saved}
                initial={{ scale: 0.4, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 18 }}
              >
                {saved && !text ? <Check size={20} strokeWidth={3} /> : <Send size={18} strokeWidth={2.5} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </form>
      )}
    </div>
  );
}
