"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bike,
  Check,
  Coffee,
  CornerDownLeft,
  Moon,
  NotebookPen,
  Pencil,
  Plus,
  Sun,
  Syringe,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { appendNoteToken, lastInjection, NOTE_SEP, noteTokens, type DietStore } from "@/lib/store";
import { shortLabel, todayKey, weekday } from "@/lib/date";
import { MAIN_CATEGORIES, NOTE_MAX, NOTE_PRESETS, type Category } from "@/lib/types";
import { BrutalButton, Cell } from "./ui";

export const CATEGORY_ICONS: Record<Category, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  breakfast: Sun,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Coffee,
  exercise: Bike,
  injection: Syringe,
};

const PLACEHOLDER: Partial<Record<Category, string>> = {
  exercise: "운동 메모…",
  injection: "약품·용량·부위 (예: 위고비 0.5mg 복부)",
};

export function DailyLog({ store, selected, pulse = 0 }: { store: DietStore; selected: string; pulse?: number }) {
  const day = store.data.days[selected];
  const count = (keys: Category[]) => keys.reduce((n, k) => n + (day?.logs[k]?.length ?? 0), 0);
  const meals = count(["breakfast", "lunch", "dinner", "snack"]);
  const workouts = count(["exercise"]);
  const shots = count(["injection"]);
  const hasNote = !!day?.note;
  const isToday = selected === todayKey();
  const summary: { label: string; value: string; on: boolean; tone?: "blaze" }[] = [
    { label: "식단", value: `${meals}`, on: meals > 0 },
    { label: "운동", value: `${workouts}`, on: workouts > 0 },
    { label: "주사", value: shots ? `${shots}` : "—", on: shots > 0, tone: "blaze" },
    { label: "메모", value: hasNote ? "✓" : "—", on: hasNote },
  ];
  return (
    <>
      <div id="daily-log" className="relative col-span-6 scroll-mt-3 overflow-hidden md:col-span-12">
        {/* flash when arriving from the chart */}
        <motion.div
          key={pulse}
          aria-hidden
          initial={{ x: pulse ? "-100%" : "100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 0.7, ease: [0.7, 0, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 bg-acid"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-3 py-3 md:px-4">
          <div className="flex items-baseline gap-3">
            <span className="border-[1.5px] border-ink px-1.5 py-px font-mono text-[11px] font-bold">05</span>
            <h2 className="display-tight text-[clamp(2.5rem,6vw,5rem)]">DAILY LOG</h2>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={selected}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                className={`display-tight border-2 border-ink px-2 py-1 text-[clamp(1.5rem,3vw,2.5rem)] ${isToday ? "bg-acid" : "bg-ink text-paper"}`}
              >
                {shortLabel(selected)} {weekday(selected)}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="flex flex-col gap-1.5 pb-1 font-mono text-[11px] md:items-end">
            <ul className="flex flex-wrap gap-1" aria-label="오늘 기록 요약">
              {summary.map((s) => (
                <li
                  key={s.label}
                  className={`flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 font-bold ${
                    s.on ? (s.tone === "blaze" ? "bg-blaze" : "bg-ink text-acid") : "bg-paper opacity-60"
                  }`}
                >
                  <span>{s.label}</span>
                  <span className="tabular-nums">{s.value}</span>
                </li>
              ))}
              {!isToday && <li className="border-2 border-ink bg-blaze px-1.5 py-0.5 font-bold">과거 기록 편집 중</li>}
            </ul>
            <span className="tracking-[0.08em] opacity-60">항목 클릭 → 수정 · Enter 저장 · Esc 취소 · 태그 원클릭 추가</span>
          </div>
        </div>
      </div>
      <div className="col-span-6 grid grid-cols-1 gap-[2px] bg-ink sm:grid-cols-2 md:col-span-12 lg:grid-cols-5">
        {MAIN_CATEGORIES.map((c, i) => (
          <LogColumn key={c.key} cat={c.key} label={c.label} en={c.en} idx={i} store={store} selected={selected} />
        ))}
      </div>
      {/* Row 2: condition note + injection log */}
      <div className="col-span-6 grid grid-cols-1 gap-[2px] bg-ink md:col-span-12 md:grid-cols-5">
        <NoteCell store={store} selected={selected} />
        <LogColumn cat="injection" label="주사" en="INJECTION" idx={6} store={store} selected={selected} wide />
      </div>
    </>
  );
}

/* ---------- One-line condition / memo ---------- */

function NoteCell({ store, selected }: { store: DietStore; selected: string }) {
  const note = store.data.days[selected]?.note ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<{ text: string; tone: "warn" | "info" } | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const restoreFocus = useRef(false);
  const viewRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    []
  );

  const showHint = (text: string, tone: "warn" | "info") => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint({ text, tone });
    hintTimer.current = setTimeout(() => setHint(null), 1800);
  };

  const start = () => {
    cancelled.current = false;
    setDraft(note);
    setEditing(true);
  };
  const finish = () => {
    if (!cancelled.current) store.setNote(selected, draft);
    cancelled.current = false;
    setEditing(false);
    // keyboard users (Enter / Esc) land back on the note, not at the top of the page
    if (restoreFocus.current) {
      restoreFocus.current = false;
      requestAnimationFrame(() => viewRef.current?.focus());
    }
  };
  /**
   * Preset chips toggle a " · " segment: tap to append, tap again to remove.
   * Matching is per segment, so "좋음" inside "컨디션 좋음" is never mistaken for a duplicate.
   */
  const togglePreset = (p: string) => {
    const base = editing ? draft : note;
    const apply = (next: string) => (editing ? setDraft(next) : store.setNote(selected, next));
    const tokens = noteTokens(base);
    if (tokens.includes(p)) {
      apply(tokens.filter((t) => t !== p).join(NOTE_SEP));
      showHint(`'${p}' 뺐어요`, "info");
      return;
    }
    const r = appendNoteToken(base, p);
    if (!r.ok) {
      if (r.reason === "max") showHint(`${NOTE_MAX}자 한도 — 내용을 줄여 주세요`, "warn");
      return;
    }
    apply(r.next);
  };
  const len = editing ? draft.length : note.length;
  const nearMax = len >= NOTE_MAX * 0.9;

  return (
    <Cell className="bg-paper md:col-span-3">
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
        <div className="flex items-center gap-2">
          <NotebookPen size={18} strokeWidth={2.5} />
          <span className="whitespace-nowrap text-lg font-black">컨디션 · 메모</span>
        </div>
        <span className="truncate pl-2 font-mono text-[10px] tracking-[0.14em] opacity-60">06 / CONDITION</span>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4 py-3">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            <div className="flex border-2 border-ink">
              <input
                autoFocus
                value={draft}
                maxLength={NOTE_MAX}
                aria-label="오늘의 컨디션 메모"
                placeholder="예: 회식 다음날, 붓기 있음, 공복 컨디션 좋음"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={finish}
                onKeyDown={(e) => {
                  if (e.key === "Enter") restoreFocus.current = true;
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelled.current = true;
                    restoreFocus.current = true;
                    e.currentTarget.blur();
                  }
                }}
                className="min-w-0 flex-1 bg-acid/30 px-3 py-2.5 font-mono text-[14px] outline-none"
              />
              <button
                type="submit"
                aria-label="메모 저장"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (restoreFocus.current = true)}
                className="min-w-11 border-l-2 border-ink bg-ink px-3 text-acid"
              >
                <Check size={16} strokeWidth={3} />
              </button>
            </div>
            <p className="mt-1 flex justify-between gap-2 font-mono text-[10px]">
              <span className="opacity-60">Enter 저장 · Esc 취소 · 비우면 삭제</span>
              <span
                aria-live="polite"
                className={`tabular-nums ${draft.length >= NOTE_MAX ? "bg-blaze px-1 font-bold" : nearMax ? "font-bold text-blaze" : "opacity-60"}`}
              >
                {draft.length}/{NOTE_MAX}
              </span>
            </p>
          </form>
        ) : note ? (
          <div className="group/note flex items-start gap-2">
            <button
              ref={viewRef}
              type="button"
              onClick={start}
              title="클릭해서 수정"
              className="min-w-0 flex-1 py-1 text-left font-mono text-[15px] leading-snug break-words break-keep hover:bg-acid/30"
            >
              <span className="mr-2 bg-ink px-1 text-[11px] font-bold text-acid">NOTE</span>
              {note}
            </button>
            <span className="flex shrink-0">
              <IconButton label="메모 수정" onClick={start} tone="acid">
                <Pencil size={14} strokeWidth={2.5} />
              </IconButton>
              <IconButton label="메모 삭제" onClick={() => store.setNote(selected, "")} tone="blaze">
                <X size={15} strokeWidth={2.5} />
              </IconButton>
            </span>
          </div>
        ) : (
          <button
            ref={viewRef}
            type="button"
            onClick={start}
            className="w-full border-2 border-dashed border-ink/40 px-3 py-3 text-left font-mono text-[13px] opacity-60 hover:border-ink hover:bg-acid/30 hover:opacity-100"
          >
            + 오늘 컨디션 한 줄 남기기 (회식, 붓기, 공복 상태…)
          </button>
        )}
      </div>

      <div className="border-t-2 border-ink px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
          <span className="opacity-70">Quick condition · 탭하면 ‘ · ’로 이어 붙음</span>
          <AnimatePresence mode="wait">
            {hint ? (
              <motion.span
                key={hint.text}
                role="status"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`shrink-0 border-2 border-ink px-1.5 font-bold normal-case tracking-normal ${hint.tone === "warn" ? "bg-blaze" : "bg-acid"}`}
              >
                {hint.text}
              </motion.span>
            ) : (
              !editing &&
              note && (
                <motion.span
                  key="len"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`shrink-0 tabular-nums ${nearMax ? "font-bold text-blaze" : "opacity-50"}`}
                >
                  {len}/{NOTE_MAX}
                </motion.span>
              )
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_PRESETS.map((p) => {
            const used = noteTokens(editing ? draft : note).includes(p);
            return (
              <BrutalButton
                key={p}
                shadow={false}
                aria-pressed={used}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => togglePreset(p)}
                className={`h-9 px-2.5 text-[11px] normal-case tracking-normal md:h-7 md:px-2 ${used ? "!bg-ink !text-acid" : ""}`}
              >
                {used && <Check size={11} strokeWidth={3} />}
                {p}
              </BrutalButton>
            );
          })}
        </div>
      </div>
    </Cell>
  );
}

/**
 * Square icon button: 36px touch target on mobile, compact 28px on desktop,
 * always visible on touch screens (no hover there), dimmed until hover on desktop.
 */
function IconButton({
  label,
  onClick,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  tone: "acid" | "blaze";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center opacity-70 transition md:h-7 md:w-7 md:opacity-35 md:group-hover/item:opacity-80 md:group-hover/note:opacity-80 ${
        tone === "acid" ? "hover:bg-acid" : "hover:bg-blaze"
      } hover:opacity-100 focus-visible:opacity-100`}
    >
      {children}
    </button>
  );
}

/**
 * One log line. Click the text (or the pencil) to edit inline:
 * Enter / ✓ / blur saves, Esc cancels, an emptied value is ignored (use × to delete).
 * After Enter / Esc, keyboard focus returns to the line instead of jumping to <body>.
 */
function LogEntry({
  text,
  isEx,
  marker,
  onSave,
  onRemove,
}: {
  text: string;
  isEx: boolean;
  marker?: string;
  onSave: (t: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const cancelled = useRef(false);
  const restoreFocus = useRef(false);
  const viewRef = useRef<HTMLButtonElement>(null);

  const start = () => {
    cancelled.current = false;
    setDraft(text);
    setEditing(true);
  };
  const finish = () => {
    if (!cancelled.current && draft.trim() && draft.trim() !== text) onSave(draft);
    cancelled.current = false;
    setEditing(false);
    if (restoreFocus.current) {
      restoreFocus.current = false;
      requestAnimationFrame(() => viewRef.current?.focus());
    }
  };

  if (editing) {
    return (
      <form
        className="flex items-stretch gap-0 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          finish();
        }}
      >
        <input
          autoFocus
          value={draft}
          aria-label="항목 수정"
          maxLength={500}
          enterKeyHint="done"
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === "Enter") restoreFocus.current = true;
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelled.current = true;
              restoreFocus.current = true;
              e.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 border-2 border-ink bg-acid/40 px-2 py-2 font-mono text-[14px] outline-none md:py-1 md:text-[13px]"
        />
        <button
          type="submit"
          aria-label="수정 저장"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (restoreFocus.current = true)}
          className="min-w-10 border-2 border-l-0 border-ink bg-ink px-2 text-acid"
        >
          <Check size={14} strokeWidth={3} className="mx-auto" />
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-1 py-1">
      <button
        ref={viewRef}
        type="button"
        onClick={start}
        title="클릭해서 수정"
        className="flex min-h-9 min-w-0 flex-1 items-start gap-2 py-1 text-left hover:bg-acid/30 md:min-h-0"
      >
        <span className={`shrink-0 ${isEx ? "text-blaze" : "opacity-40"}`}>{marker ?? (isEx ? "▲" : "—")}</span>
        <span className="min-w-0 break-words break-keep">{text}</span>
      </button>
      <span className="flex shrink-0">
        <IconButton label="수정" onClick={start} tone="acid">
          <Pencil size={13} strokeWidth={2.5} />
        </IconButton>
        <IconButton label="삭제" onClick={onRemove} tone="blaze">
          <X size={14} strokeWidth={2.5} />
        </IconButton>
      </span>
    </div>
  );
}

function LogColumn({
  cat,
  label,
  en,
  idx,
  store,
  selected,
  wide = false,
}: {
  cat: Category;
  label: string;
  en: string;
  idx: number;
  store: DietStore;
  selected: string;
  /** Used for the injection cell in the second Daily Log row. */
  wide?: boolean;
}) {
  const { data, addLog, addTagEntry, updateLog, removeLog, addTag, removeTag } = store;
  const items = data.days[selected]?.logs[cat] ?? [];
  const tags = data.tags[cat];
  const [text, setText] = useState("");
  const [tagMode, setTagMode] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const Icon = CATEGORY_ICONS[cat];
  const isEx = cat === "exercise";
  const isInj = cat === "injection";
  const last = isInj ? lastInjection(data, selected, { strict: true }) : null;
  // "due" colouring only makes sense for today; on past days D+N is just informational
  const injectionDue = !!last && selected === todayKey() && !items.length && last.daysAgo >= 7;

  const submit = () => {
    if (!text.trim()) return;
    addLog(selected, cat, text);
    setText("");
  };

  const headerTone = isEx ? "bg-ink text-paper" : isInj ? "bg-blaze text-ink" : "";
  return (
    <Cell className={`bg-paper ${wide ? "md:col-span-2" : "md:min-h-[360px]"} ${isEx ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <div className={`flex items-center justify-between border-b-2 border-ink px-4 py-3 ${headerTone}`}>
        <div className="flex items-center gap-2">
          <Icon size={18} strokeWidth={2.5} />
          <span className="whitespace-nowrap text-lg font-black">{label}</span>
          {isInj && items.length > 0 && (
            <span className="border-2 border-ink bg-paper px-1.5 font-mono text-[10px] font-bold">✓ 투약함</span>
          )}
        </div>
        <span className={`truncate pl-2 font-mono text-[10px] tracking-[0.14em] ${isEx ? "text-acid" : isInj ? "font-bold" : "opacity-60"}`}>
          {String(idx + 1).padStart(2, "0")} / {en}
        </span>
      </div>

      {isInj && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-4 py-2 font-mono text-[11px]">
          {last ? (
            <>
              <span className="min-w-0 truncate">
                <span className="opacity-60">LAST</span> {shortLabel(last.key)} · {last.text}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`border-2 border-ink px-1.5 font-bold ${injectionDue ? "bg-blaze" : "bg-acid"}`}>
                  D+{last.daysAgo}
                </span>
                {!items.length && (
                  <button
                    type="button"
                    onClick={() => addLog(selected, cat, last.text)}
                    className="border-2 border-ink px-1.5 font-bold hover:bg-ink hover:text-acid"
                    title="지난번과 같은 약품·용량으로 기록"
                  >
                    ↺ 지난번과 동일
                  </button>
                )}
              </span>
            </>
          ) : (
            <span className="opacity-60">이전 투약 기록 없음 · 태그로 약품/용량/부위를 한 번에 기록하세요</span>
          )}
        </div>
      )}

      {/* Entries */}
      <ul className="flex-1 space-y-0 px-4 py-2">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.id}
              layout
              initial={{ opacity: 0, x: -12, backgroundColor: "#CCFF00" }}
              animate={{ opacity: 1, x: 0, backgroundColor: "rgba(204,255,0,0)" }}
              exit={{ opacity: 0, x: 12, height: 0 }}
              transition={{ duration: 0.25, backgroundColor: { duration: 0.9 } }}
              className="group/item border-b border-dashed border-ink/40 font-mono text-[13px] leading-snug"
            >
              <LogEntry
                text={it.text}
                isEx={isEx || isInj}
                marker={isInj ? "◆" : undefined}
                onSave={(t) => updateLog(selected, cat, it.id, t)}
                onRemove={() => removeLog(selected, cat, it.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && <li className="py-2 font-mono text-[12px] opacity-35">— empty</li>}
      </ul>

      {/* Input */}
      <form
        className="flex border-t-2 border-ink"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER[cat] ?? "무엇을 먹었나요?"}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[13px] outline-none placeholder:text-ink/35 focus:bg-acid/40"
        />
        <motion.button
          type="submit"
          aria-label="저장"
          whileTap={{ scale: 0.85 }}
          className="border-l-2 border-ink px-3 transition-colors hover:bg-ink hover:text-acid"
        >
          <CornerDownLeft size={16} strokeWidth={2.5} />
        </motion.button>
      </form>

      {/* Quick tags */}
      <div className="border-t-2 border-ink px-3 py-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
          <span>{isInj ? "Quick tags · 탭하면 한 기록에 합쳐짐" : "Quick tags"}</span>
          <button type="button" onClick={() => setTagMode((v) => !v)} className={`px-2 py-1.5 md:px-1 md:py-0 ${tagMode ? "bg-ink text-acid" : "hover:bg-acid"}`}>
            {tagMode ? "done" : "edit"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {tags.map((t) => (
              <motion.div
                key={t}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className="flex"
              >
                <BrutalButton
                  shadow={false}
                  tone={isEx ? "ink" : "paper"}
                  onClick={() => (tagMode ? removeTag(cat, t) : addTagEntry(selected, cat, t))}
                  className={`h-9 px-2.5 text-[11px] normal-case tracking-normal md:h-7 md:px-2 ${isEx ? "hover:!text-ink" : ""} ${tagMode ? "!bg-blaze !text-ink" : ""}`}
                >
                  {tagMode && <X size={11} strokeWidth={3} />}
                  {t}
                </BrutalButton>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {tagMode && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 flex overflow-hidden border-2 border-ink"
              onSubmit={(e) => {
                e.preventDefault();
                addTag(cat, tagDraft);
                setTagDraft("");
              }}
            >
              <input
                autoFocus
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="#새태그"
                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-[12px] outline-none"
              />
              <button type="submit" aria-label="태그 추가" className="border-l-2 border-ink bg-acid px-2">
                <Plus size={14} strokeWidth={3} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </Cell>
  );
}
