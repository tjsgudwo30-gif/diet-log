"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, Send, Syringe, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortLabel, todayKey, weekdayKo } from "@/lib/date";
import {
  appendNoteToken,
  cleanNote,
  dayIndex,
  lastInjection,
  latestWeight,
  NOTE_SEP,
  noteTokens,
  parseKg,
  type DietStore,
} from "@/lib/store";
import { MAIN_CATEGORIES, NOTE_MAX, NOTE_PRESETS, type Category } from "@/lib/types";
import { Chip, Dot, Label } from "./ui";

const SAVED_FEEDBACK_MS = 1200;
const HINT_MS = 2000;
/** Weekly GLP-1 style schedule: an injection is "due" 7+ days after the last one. */
const INJECTION_INTERVAL_DAYS = 7;

/** Text-entry modes: meals + exercise, plus the one-line day note. (Injection is the toggle chip.) */
type Mode = Exclude<Category, "injection"> | "note";
const MODES: { key: Mode; label: string }[] = [
  ...MAIN_CATEGORIES.map((c) => ({ key: c.key as Mode, label: c.label })),
  { key: "note", label: "메모" },
];

const PLACEHOLDER: Record<Mode, string> = {
  breakfast: "아침에 먹은 것",
  lunch: "점심 메뉴",
  dinner: "저녁 식사",
  snack: "간식 · 음료 · 커피",
  exercise: "운동 종류와 시간",
  note: "오늘 컨디션 한 줄",
};

/** Pick the meal slot that fits the current time of day. */
function defaultMode(): Mode {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

const scrollToLog = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Phone-only "오늘 기록" card, placed right under the header so the day can be logged
 * without scrolling: weight → condition / injection → meal, exercise or memo text.
 * (Hidden on md+, where the hero and the Daily Log columns do the same job.)
 */
export function QuickBar({ store, selected }: { store: DietStore; selected: string }) {
  const { data, setWeight, addLog, addTagEntry, removeLog, setNote, addTag, removeTag } = store;
  const day = data.days[selected];
  const weight = day?.weight;
  const note = day?.note ?? "";
  const noteParts = noteTokens(note);
  const base = weight ?? latestWeight(data, selected) ?? data.goalWeight + 5;
  const isToday = selected === todayKey();
  const firstRun = dayIndex(data).weights.length === 0;

  const injections = day?.logs.injection ?? [];
  const injected = injections.length > 0;
  const lastInj = lastInjection(data, selected, { strict: true });
  // The reminder is about *today*: browsing a past/future day never shows "예정일".
  const injectionDue = isToday && !!lastInj && !injected && lastInj.daysAgo >= INJECTION_INTERVAL_DAYS;

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [tagEdit, setTagEdit] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [hint, setHint] = useState<{ text: string; warn: boolean } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // A new day starts clean: no half-typed weight, text or hint from the previous day.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per-day drafts when the day changes
    setDraft(null);
    setText("");
    setHint(null);
  }, [selected]);

  // Never leave a pending timer behind after unmount.
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    []
  );

  // The memo box stays one line until it has more to show, then grows with its content.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const flashSaved = () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setJustSaved(true);
    savedTimer.current = setTimeout(() => {
      setJustSaved(false);
      savedTimer.current = null;
    }, SAVED_FEEDBACK_MS);
  };
  const showHint = (t: string, warn = false) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint({ text: t, warn });
    hintTimer.current = setTimeout(() => setHint(null), HINT_MS);
  };

  /* ---------- weight ---------- */
  const nudge = (d: number) => {
    setDraft(null);
    setWeight(selected, Math.max(20, Math.min(300, Math.round((base + d) * 10) / 10)));
  };
  /** Returns false (and explains) when the typed value is not a weight. */
  const commitWeight = (): boolean => {
    if (draft === null) return true;
    if (draft.trim() === "") {
      setDraft(null); // empty never deletes — that's the explicit "지우기"
      return true;
    }
    const v = parseKg(draft);
    if (v === null) {
      showHint("20–300kg 사이 숫자를 입력하세요 · 예: 68.4", true);
      return false;
    }
    setWeight(selected, v);
    setDraft(null);
    return true;
  };
  const saveWeight = () => {
    if (draft === null && weight === undefined) {
      weightRef.current?.focus();
      return;
    }
    if (commitWeight()) {
      weightRef.current?.blur();
      flashSaved();
    }
  };

  /* ---------- condition + injection ---------- */
  const togglePreset = (p: string) => {
    if (noteParts.includes(p)) {
      setNote(selected, noteParts.filter((x) => x !== p).join(NOTE_SEP));
      return;
    }
    const r = appendNoteToken(note, p);
    if (r.ok) setNote(selected, r.next);
    else if (r.reason === "max") showHint(`메모 ${NOTE_MAX}자 한도 — 메모를 줄여 주세요`, true);
  };

  /**
   * On: record the same drug/dose as last time (first time → open the injection column for tags).
   * Off: only undoes that plain one-tap record; anything more detailed is edited in the log below.
   */
  const toggleInjection = () => {
    if (!injected) {
      if (lastInj) {
        addLog(selected, "injection", lastInj.text);
        showHint(`주사 기록 · ${lastInj.text}`);
      } else {
        showHint("첫 투약은 아래 주사 칸에서 약품·용량을 골라 주세요");
        scrollToLog("log-injection");
      }
      return;
    }
    const only = injections.length === 1 ? injections[0] : null;
    if (only && lastInj && only.text === lastInj.text) {
      removeLog(selected, "injection", only.id);
      showHint("주사 기록을 취소했어요");
    } else {
      showHint("주사 기록 수정·삭제는 아래 주사 칸에서");
      scrollToLog("log-injection");
    }
  };

  /* ---------- text ---------- */
  const submitText = (value = text) => {
    const v = value.replace(/\s+/g, " ").trim();
    if (!v) return;
    if (mode === "note") {
      const r = appendNoteToken(note, v);
      if (!r.ok) {
        if (r.reason === "dup") showHint(`'${cleanNote(v)}' 이미 있어요`);
        if (r.reason === "max") showHint(`메모 ${NOTE_MAX}자 한도 (${note.length}/${NOTE_MAX})`, true);
        return;
      }
      setNote(selected, r.next);
    } else {
      addLog(selected, mode, v);
    }
    if (value === text) setText("");
    flashSaved();
  };
  const tapTag = (t: string) => {
    if (mode === "note") return;
    if (tagEdit) {
      removeTag(mode, t);
      return;
    }
    addTagEntry(selected, mode, t);
    flashSaved();
  };

  const counts = (m: Mode) => (m === "note" ? (note ? 1 : 0) : (day?.logs[m]?.length ?? 0));
  const tags = mode === "note" ? [] : data.tags[mode];

  return (
    <section aria-label={isToday ? "오늘 기록" : `${shortLabel(selected)} 기록`} className="col-span-6 md:hidden">
      {/* Title row */}
      <header className="flex h-11 items-center justify-between gap-3 pl-4">
        <Label className="flex items-center gap-2">
          {isToday && <Dot tone="acid" />}
          <span className="text-ink">{isToday ? "오늘 기록" : `${shortLabel(selected)} ${weekdayKo(selected)} 기록`}</span>
        </Label>
        <AnimatePresence mode="wait" initial={false}>
          {justSaved ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              className="mr-4 flex items-center gap-1 bg-acid px-2 py-1 font-mono text-[11px] font-bold"
            >
              <Check size={13} strokeWidth={2.5} /> 저장됨
            </motion.span>
          ) : weight !== undefined ? (
            <motion.button
              key="clear"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setDraft(null);
                setWeight(selected, undefined);
              }}
              className="flex h-11 items-center px-4 font-mono text-[11px] text-ink/45"
            >
              체중 지우기
            </motion.button>
          ) : null}
        </AnimatePresence>
      </header>

      {/* 1 · Weight: big decimal field + save */}
      <form
        className="flex items-stretch gap-2 px-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveWeight();
        }}
      >
        <StepButton label="0.1kg 감소" onClick={() => nudge(-0.1)}>
          <Minus size={18} strokeWidth={2} />
        </StepButton>
        <label className="flex min-w-0 flex-1 items-end justify-center gap-1 border-b-[3px] border-ink">
          <input
            ref={weightRef}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            aria-label="체중 (kg)"
            value={draft ?? (weight !== undefined ? weight.toFixed(1) : "")}
            placeholder={base.toFixed(1)}
            onFocus={(e) => {
              setDraft(weight !== undefined ? weight.toFixed(1) : "");
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
            onBlur={() => commitWeight()}
            className="display-tight h-14 w-full min-w-0 bg-transparent text-center text-[clamp(2rem,11vw,2.75rem)] outline-none placeholder:text-ink/20"
          />
          <span className="shrink-0 pb-2 font-mono text-[12px] text-ink/50">kg</span>
        </label>
        <StepButton label="0.1kg 증가" onClick={() => nudge(0.1)}>
          <Plus size={18} strokeWidth={2} />
        </StepButton>
        <motion.button
          type="submit"
          whileTap={{ scale: 0.94 }}
          // keep the field focused until the submit itself commits it
          onMouseDown={(e) => e.preventDefault()}
          className="h-14 shrink-0 bg-ink px-4 font-mono text-[13px] font-bold text-paper"
        >
          저장
        </motion.button>
      </form>
      {firstRun && (
        <p className="px-4 pt-2 font-mono text-[11px] leading-relaxed text-ink/50">
          체중을 넣고 저장하면 기록이 시작돼요. 둘러보려면 ⚙ 설정에서 샘플 데이터를 채워 보세요.
        </p>
      )}

      {/* 2 · Condition presets + injection toggle */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={injected} danger={injectionDue} aria-pressed={injected} onClick={toggleInjection}>
          <Syringe size={13} strokeWidth={2} />
          {injected ? "주사 ✓" : injectionDue ? "주사 예정일" : "주사"}
        </Chip>
        <span aria-hidden className="w-px shrink-0 self-stretch bg-ink/15" />
        {NOTE_PRESETS.map((p) => {
          const on = noteParts.includes(p);
          return (
            <Chip key={p} active={on} aria-pressed={on} onClick={() => togglePreset(p)}>
              {p}
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
            className={`overflow-hidden px-4 font-mono text-[11px] ${hint.warn ? "text-blaze" : "text-ink/60"}`}
          >
            <span className="block pt-2">{hint.text}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* 3 · Meal / exercise / memo text */}
      <div className="mt-4 border-t border-ink/15">
        <div role="tablist" aria-label="기록 종류" className="grid grid-cols-6">
          {MODES.map((m) => {
            const on = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setMode(m.key);
                  setTagEdit(false);
                }}
                className={`relative h-11 text-[13px] font-bold transition-colors ${on ? "text-ink" : "text-ink/40"}`}
              >
                {m.label}
                {counts(m.key) > 0 && <span aria-hidden className="ml-0.5 inline-block h-1 w-1 -translate-y-1.5 bg-ink" />}
                {on && (
                  <motion.span
                    layoutId="today-tab"
                    className="absolute inset-x-1.5 bottom-1 h-[2px] bg-ink"
                    transition={{ type: "spring", stiffness: 600, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <form
          className="flex items-end gap-2 px-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitText();
          }}
        >
          <textarea
            ref={textRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends (Shift+Enter = new line); never while the Korean IME is composing
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                submitText();
              }
            }}
            enterKeyHint="send"
            maxLength={mode === "note" ? NOTE_MAX : 500}
            aria-label={`${MODES.find((m) => m.key === mode)?.label} 입력`}
            placeholder={PLACEHOLDER[mode]}
            className="min-h-11 min-w-0 flex-1 resize-none border-b border-ink/25 bg-transparent py-2.5 font-mono text-base leading-snug outline-none placeholder:text-ink/30 focus:border-ink"
          />
          <motion.button
            type="submit"
            aria-label="기록 추가"
            whileTap={{ scale: 0.88 }}
            disabled={!text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper transition-opacity disabled:opacity-25"
          >
            <Send size={16} strokeWidth={2} />
          </motion.button>
        </form>

        {mode === "note" ? (
          <p className="flex items-start gap-2 px-4 pt-3 pb-4 font-mono text-[11px] text-ink/55">
            <span className="min-w-0 flex-1 break-words break-keep">{note || "메모 없음 · 위 컨디션 칩으로도 남길 수 있어요"}</span>
            {note && (
              <span className={`shrink-0 tabular-nums ${note.length >= NOTE_MAX * 0.9 ? "text-blaze" : "text-ink/40"}`}>
                {note.length}/{NOTE_MAX}
              </span>
            )}
          </p>
        ) : (
          <div className="pt-3 pb-4">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              {tags.map((t) => (
                <Chip key={t} danger={tagEdit} onClick={() => tapTag(t)}>
                  {tagEdit && <X size={11} strokeWidth={2} />}
                  {t}
                </Chip>
              ))}
              <button
                type="button"
                onClick={() => setTagEdit((v) => !v)}
                className="h-10 shrink-0 border border-dashed border-ink/30 px-2.5 font-mono text-[11px] text-ink/55"
              >
                {tagEdit ? "완료" : "태그 편집"}
              </button>
            </div>
            {tagEdit && (
              <form
                className="mx-4 mt-2 flex border-b border-ink"
                onSubmit={(e) => {
                  e.preventDefault();
                  addTag(mode, tagDraft);
                  setTagDraft("");
                }}
              >
                <input
                  autoFocus
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  placeholder="#새태그"
                  aria-label="새 태그"
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-base outline-none placeholder:text-ink/30"
                />
                <button type="submit" aria-label="태그 추가" className="flex w-11 items-center justify-center">
                  <Plus size={16} strokeWidth={2} />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      className="flex h-14 w-11 shrink-0 items-center justify-center border border-ink/25 active:bg-ink active:text-paper"
    >
      {children}
    </motion.button>
  );
}
