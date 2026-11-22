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
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  appendNoteToken,
  fmtDays,
  hasDayRecord,
  injectionCycle,
  lastInjection,
  NOTE_SEP,
  noteTokens,
  type DietStore,
} from "@/lib/store";
import { shortLabel, todayKey, weekday } from "@/lib/date";
import { MAIN_CATEGORIES, NOTE_MAX, NOTE_PRESETS, type Category, type DayEntry } from "@/lib/types";
import { Chip, Dot, Label } from "./ui";

export const CATEGORY_ICONS: Record<Category, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  breakfast: Sun,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Coffee,
  exercise: Bike,
  injection: Syringe,
};

const PLACEHOLDER: Partial<Record<Category, string>> = {
  exercise: "운동 메모",
  injection: "약품 · 용량 · 부위",
};

/** Empty-state copy: says what each slot is for, in one short line. */
const EMPTY: Record<Category, string> = {
  breakfast: "아침에 먹은 것을 적어 주세요",
  lunch: "점심 메뉴를 남겨 보세요",
  dinner: "저녁 식사를 기록하세요",
  snack: "간식 · 음료 · 커피",
  exercise: "운동 종류와 시간",
  injection: "이 날은 투약 기록이 없어요",
};

/** Full-width group caption that splits the day into "what I ate / did" and "how I felt / dosed". */
function GroupCaption({ letter, title, hint, summary }: { letter: string; title: string; hint: string; summary?: string }) {
  return (
    <div className="col-span-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 bg-paper px-5 py-2.5 md:col-span-12 md:px-6">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-mono text-[10.5px] font-bold">{letter}</span>
        <span className="text-[13px] font-bold">{title}</span>
        <span className="font-mono text-[11px] text-ink/45">{hint}</span>
      </span>
      {summary && <span className="font-mono text-[11px] tabular-nums text-ink/60">{summary}</span>}
    </div>
  );
}

/* ---------- Section header + layout ---------- */

export function DailyLog({ store, selected, pulse = 0 }: { store: DietStore; selected: string; pulse?: number }) {
  const isToday = selected === todayKey();
  const undoState = useClearDayUndo(store);
  const day = store.data.days[selected];
  const n = (keys: Category[]) => keys.reduce((acc, k) => acc + (day?.logs[k]?.length ?? 0), 0);
  const meals = n(["breakfast", "lunch", "dinner", "snack"]);
  const workouts = n(["exercise"]);
  const shots = n(["injection"]);
  const summaryA = `식단 ${meals}건 · 운동 ${workouts}건`;
  const summaryB = `컨디션 ${day?.note ? "기록함" : "—"} · 주사 ${shots ? "투약함" : "—"}`;

  return (
    <>
      <div id="daily-log" className="relative col-span-6 scroll-mt-3 overflow-hidden md:col-span-12">
        {/* thin sweep when arriving from the chart */}
        <motion.span
          key={pulse}
          aria-hidden
          initial={{ x: pulse ? "-100%" : "100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 0.8, ease: [0.7, 0, 0.3, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-acid"
        />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-4 pb-4 md:px-6 md:pt-5">
          <div>
            <Label className="flex items-center gap-2">
              <span className="text-ink">06</span>
              <span aria-hidden className="h-px w-4 bg-ink/30" />
              <span>하루 기록</span>
            </Label>
            <h2 className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <span className="display-tight text-[clamp(2.25rem,5vw,3.25rem)]">Daily Log</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={selected}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  className="display-tight text-[clamp(2.25rem,5vw,3.25rem)] text-ink/30"
                >
                  {shortLabel(selected)} {weekday(selected)}
                </motion.span>
              </AnimatePresence>
            </h2>
          </div>
          <div className="flex flex-col gap-1.5 pb-1 md:items-end">
            <p className="max-w-sm font-mono text-[11px] leading-relaxed text-ink/55 md:text-right">
              먹은 것과 움직인 것, 그리고 몸 상태와 투약을 하루 단위로 남깁니다. 항목을 누르면 바로 수정돼요.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:justify-end">
              {!isToday && (
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink/55">
                  <Dot tone="blaze" /> 과거 기록 편집 중
                </span>
              )}
              {undoState.pending ? (
                <span role="status" className="flex items-center gap-1 font-mono text-[11px] text-ink/60">
                  <b className="text-ink">{shortLabel(undoState.pending.key)}</b> 기록을 삭제했어요
                  <button
                    type="button"
                    onClick={undoState.undo}
                    className="-my-2 px-2 py-2 font-bold text-ink underline underline-offset-4"
                  >
                    되돌리기
                  </button>
                  <button
                    type="button"
                    aria-label="알림 닫기"
                    onClick={undoState.dismiss}
                    className="-my-2 flex h-8 w-8 items-center justify-center text-ink/40 hover:text-ink"
                  >
                    <X size={13} strokeWidth={1.75} />
                  </button>
                </span>
              ) : (
                <ClearDayControl key={selected} store={store} selected={selected} onConfirm={undoState.clear} />
              )}
            </div>
          </div>
        </div>
      </div>

      <GroupCaption letter="A" title="식단 · 운동" hint="아침 → 점심 → 저녁 → 간식, 그리고 오늘 움직인 것" summary={summaryA} />
      <div className="col-span-6 grid grid-cols-1 gap-[1.5px] bg-ink sm:grid-cols-2 md:col-span-12 lg:grid-cols-5">
        {MAIN_CATEGORIES.map((c) => (
          // keyed by date: unsent input, tag drafts and tag-edit mode never leak into another day
          <LogColumn key={`${c.key}:${selected}`} cat={c.key} label={c.label} store={store} selected={selected} />
        ))}
      </div>

      {/* Row 2: condition note + injection log */}
      <GroupCaption letter="B" title="컨디션 · 주사" hint="몸 상태 한 줄과 다이어트 주사 투약 기록" summary={summaryB} />
      <div className="col-span-6 grid grid-cols-1 gap-[1.5px] bg-ink md:col-span-12 md:grid-cols-5">
        <NoteCell key={`note:${selected}`} store={store} selected={selected} />
        <LogColumn key={`injection:${selected}`} cat="injection" label="주사" store={store} selected={selected} wide />
      </div>
    </>
  );
}

const UNDO_MS = 8000;

/**
 * Delete-with-undo, owned by DailyLog (which is *not* re-keyed per date), so the undo
 * survives moving to another day. The removed entry is remembered with its own date key.
 */
function useClearDayUndo(store: DietStore) {
  const [pending, setPending] = useState<{ key: string; entry: DayEntry } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const clear = (key: string) => {
    const entry = store.data.days[key];
    if (!entry) return;
    store.clearDay(key);
    setPending({ key, entry });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPending(null), UNDO_MS);
  };
  const undo = () => {
    if (pending) store.restoreDay(pending.key, pending.entry);
    if (timer.current) clearTimeout(timer.current);
    setPending(null);
  };
  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    setPending(null);
  };
  return { pending, clear, undo, dismiss };
}

/**
 * "이 날 기록 삭제": only shown when the day has something to delete.
 * idle → confirm (취소 focused by default, Esc cancels) → onConfirm. Keyed by date by the parent,
 * so an open confirmation never carries over to another day.
 * Goal weight and tags are untouched (see store.clearDay).
 */
function ClearDayControl({
  store,
  selected,
  onConfirm,
}: {
  store: DietStore;
  selected: string;
  onConfirm: (key: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "confirm">("idle");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const has = hasDayRecord(store.data, selected);

  useEffect(() => {
    if (phase === "confirm") cancelRef.current?.focus();
  }, [phase]);

  const cancel = () => {
    setPhase("idle");
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const confirm = () => {
    onConfirm(selected);
    setPhase("idle");
  };

  if (phase === "confirm") {
    return (
      <div
        role="alertdialog"
        aria-label="이 날 기록 삭제 확인"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            cancel();
          }
        }}
        className="flex w-full max-w-sm flex-col gap-2 border-l-[3px] border-blaze py-1 pl-3 md:items-end md:text-right"
      >
        <p className="font-mono text-[11px] leading-relaxed text-ink/70">
          <b className="text-ink">{shortLabel(selected)}</b>의 체중 · 식단 · 운동 · 주사 · 컨디션을 모두 지울까요?
          <span className="block text-ink/45">목표 체중과 태그는 그대로 유지돼요.</span>
        </p>
        <span className="flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className="h-9 border border-ink/25 px-3 font-mono text-[11px] font-bold transition-colors hover:border-ink md:h-8"
          >
            취소
          </button>
          <button
            type="button"
            onClick={confirm}
            className="h-9 border border-blaze bg-blaze px-3 font-mono text-[11px] font-bold text-ink transition-colors hover:bg-ink hover:text-paper hover:border-ink md:h-8"
          >
            삭제
          </button>
        </span>
      </div>
    );
  }

  if (!has) return null;
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setPhase("confirm")}
      className="-my-2 flex items-center gap-1.5 px-1 py-2 font-mono text-[11px] text-ink/50 transition-colors hover:text-blaze"
    >
      <Trash2 size={12} strokeWidth={1.75} /> 이 날 기록 삭제
    </button>
  );
}

/** Column header shared by every log cell: icon + name, quiet count on the right. */
function ColumnHeader({ icon, label, right, mark }: { icon: ReactNode; label: string; right?: ReactNode; mark?: ReactNode }) {
  return (
    <div className="mx-5 flex items-center justify-between gap-3 border-b border-ink/10 pt-4 pb-2.5">
      <div className="flex items-center gap-2">
        <span className="text-ink/70">{icon}</span>
        <span className="whitespace-nowrap text-[15px] font-bold">{label}</span>
        {mark}
      </div>
      {right}
    </div>
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
    <section className="flex flex-col bg-paper md:col-span-3">
      <ColumnHeader
        icon={<NotebookPen size={16} strokeWidth={1.75} />}
        label="컨디션 · 메모"
        right={
          (editing || note) && (
            <span className={`font-mono text-[10.5px] tabular-nums ${nearMax ? "text-blaze" : "text-ink/40"}`}>
              {len}/{NOTE_MAX}
            </span>
          )
        }
      />

      <div className="flex flex-1 flex-col justify-center px-5 py-3">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            <div className="flex items-stretch border-b-[1.5px] border-ink">
              <input
                autoFocus
                value={draft}
                maxLength={NOTE_MAX}
                aria-label="오늘의 컨디션 메모"
                placeholder="회식 다음날, 붓기 있음, 공복 컨디션 좋음…"
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
                className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[14px] outline-none placeholder:text-ink/30"
              />
              <button
                type="submit"
                aria-label="메모 저장"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (restoreFocus.current = true)}
                className="flex w-10 items-center justify-center text-ink/70 hover:text-ink"
              >
                <Check size={16} strokeWidth={2.25} />
              </button>
            </div>
            <p className="mt-1.5 font-mono text-[10.5px] text-ink/45">Enter 저장 · Esc 취소 · 비우면 삭제</p>
          </form>
        ) : note ? (
          <div className="group/note flex items-start gap-2">
            <button
              ref={viewRef}
              type="button"
              onClick={start}
              title="클릭해서 수정"
              className="min-w-0 flex-1 py-1 text-left text-[15px] leading-relaxed break-words break-keep transition-colors hover:text-ink/70"
            >
              {note}
            </button>
            <span className="flex shrink-0">
              <IconButton label="메모 수정" onClick={start}>
                <Pencil size={13} strokeWidth={1.75} />
              </IconButton>
              <IconButton label="메모 삭제" onClick={() => store.setNote(selected, "")} danger>
                <X size={14} strokeWidth={1.75} />
              </IconButton>
            </span>
          </div>
        ) : (
          <button
            ref={viewRef}
            type="button"
            onClick={start}
            className="w-full border border-dashed border-ink/25 px-4 py-3 text-left font-mono text-[12px] text-ink/45 transition-colors hover:border-ink hover:text-ink"
          >
            + 컨디션 한 줄 — 붓기, 수면, 공복감, 회식 여부 등
          </button>
        )}
      </div>

      <div className="px-5 pt-2 pb-5">
        <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
          <Label>Quick condition</Label>
          <AnimatePresence mode="wait">
            {hint && (
              <motion.span
                key={hint.text}
                role="status"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`font-mono text-[10.5px] ${hint.tone === "warn" ? "text-blaze" : "text-ink/55"}`}
              >
                {hint.text}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_PRESETS.map((p) => {
            const used = noteTokens(editing ? draft : note).includes(p);
            return (
              <Chip key={p} active={used} aria-pressed={used} onMouseDown={(e) => e.preventDefault()} onClick={() => togglePreset(p)}>
                {p}
              </Chip>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Square ghost icon button: 36px touch target on mobile, compact 28px on desktop,
 * always visible on touch screens (no hover there), faint until hover on desktop.
 */
function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center text-ink/45 transition md:h-7 md:w-7 md:text-ink/25 md:group-hover/item:text-ink/60 md:group-hover/note:text-ink/60 ${
        danger ? "hover:!text-blaze" : "hover:!text-ink"
      } focus-visible:text-ink`}
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
  marker,
  onSave,
  onRemove,
}: {
  text: string;
  marker?: ReactNode;
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
        className="flex items-stretch border-b-[1.5px] border-ink py-0.5"
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
          className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-[14px] outline-none md:text-[13px]"
        />
        <button
          type="submit"
          aria-label="수정 저장"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (restoreFocus.current = true)}
          className="flex w-9 items-center justify-center text-ink/70 hover:text-ink"
        >
          <Check size={14} strokeWidth={2.25} />
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-1">
      <button
        ref={viewRef}
        type="button"
        onClick={start}
        title="클릭해서 수정"
        className="flex min-h-9 min-w-0 flex-1 items-start gap-2 py-2 text-left transition-colors hover:text-ink/70 md:min-h-0"
      >
        {marker}
        <span className="min-w-0 break-words break-keep">{text}</span>
      </button>
      <span className="flex shrink-0 pt-0.5">
        <IconButton label="수정" onClick={start}>
          <Pencil size={13} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="삭제" onClick={onRemove} danger>
          <X size={14} strokeWidth={1.75} />
        </IconButton>
      </span>
    </div>
  );
}

/* ---------- Meal / exercise / injection column ---------- */

function LogColumn({
  cat,
  label,
  store,
  selected,
  wide = false,
}: {
  cat: Category;
  label: string;
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
  const isInj = cat === "injection";
  const last = isInj ? lastInjection(data, selected, { strict: true }) : null;
  // "due" colouring only makes sense for today; on past days D+N is just informational
  const injectionDue = !!last && selected === todayKey() && !items.length && last.daysAgo >= 7;
  // rhythm up to and including the selected day (on a dose day its own interval is D+N above)
  const cycle = isInj ? injectionCycle(data, selected) : null;
  const rhythm = cycle
    ? [
        !items.length && cycle.lastGap !== null && `최근 간격 ${fmtDays(cycle.lastGap)}`,
        cycle.avgGap !== null && `평균 ${fmtDays(cycle.avgGap)} 주기`,
        cycle.gaps > 0 && `${cycle.gaps + 1}회 기준`,
      ].filter(Boolean)
    : [];

  const submit = () => {
    if (!text.trim()) return;
    addLog(selected, cat, text);
    setText("");
  };

  return (
    <section className={`flex flex-col bg-paper ${wide ? "md:col-span-2" : "md:min-h-[300px]"} ${cat === "exercise" ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <ColumnHeader
        icon={<Icon size={16} strokeWidth={1.75} />}
        label={label}
        mark={isInj && items.length > 0 ? <span className="font-mono text-[10.5px] text-ink/55">· 투약함</span> : null}
        right={<span className="font-mono text-[11px] tabular-nums text-ink/35">{items.length || ""}</span>}
      />

      {isInj && (
        <div className="mx-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-ink/10 py-2.5 font-mono text-[11px]">
          {last ? (
            <>
              <span className="min-w-0 truncate text-ink/55">
                지난 투약 {shortLabel(last.key)} · {last.text}
              </span>
              <span className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 font-bold ${injectionDue ? "text-blaze" : ""}`}>
                  {injectionDue && <Dot tone="blaze" />}D+{last.daysAgo}
                </span>
                {!items.length && (
                  <Chip onClick={() => addLog(selected, cat, last.text)} title="지난번과 같은 약품·용량으로 기록">
                    ↺ 지난번과 동일
                  </Chip>
                )}
              </span>
              {/* injection rhythm: one quiet line, only once there are two dose days to compare */}
              {rhythm.length > 0 && (
                <span className="basis-full text-[10.5px] tabular-nums text-ink/50">
                  <span className="mr-2 uppercase tracking-[0.12em] text-ink/40">주기</span>
                  {rhythm.join(" · ")}
                </span>
              )}
            </>
          ) : (
            <span className="text-ink/45">이전 투약 기록 없음 · 아래 태그로 약품/용량/부위를 기록하세요</span>
          )}
        </div>
      )}

      {/* Entries */}
      <ul className="flex-1 px-5 pt-1 font-mono text-[13px] leading-snug">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.id}
              layout
              initial={{ opacity: 0, y: -4, backgroundColor: "rgba(204,255,0,0.55)" }}
              animate={{ opacity: 1, y: 0, backgroundColor: "rgba(204,255,0,0)" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, backgroundColor: { duration: 1 } }}
              className="group/item border-b border-ink/10"
            >
              <LogEntry
                text={it.text}
                marker={isInj ? <Dot tone="blaze" className="mt-[5px]" /> : undefined}
                onSave={(t) => updateLog(selected, cat, it.id, t)}
                onRemove={() => removeLog(selected, cat, it.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <li className="py-2 text-[12px] leading-snug text-ink/40">
            {isInj && injectionDue ? <span className="text-blaze">오늘 투약 예정일이에요</span> : EMPTY[cat]}
          </li>
        )}
      </ul>

      {/* Input */}
      <form
        className="mx-5 mt-2 flex items-stretch border-b border-ink/20 transition-colors focus-within:border-ink"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER[cat] ?? "무엇을 먹었나요?"}
          aria-label={`${label} 추가`}
          className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-[13px] outline-none placeholder:text-ink/30"
        />
        <motion.button
          type="submit"
          aria-label="저장"
          whileTap={{ scale: 0.85 }}
          disabled={!text.trim()}
          className="flex w-9 items-center justify-center text-ink transition-opacity disabled:opacity-25"
        >
          <CornerDownLeft size={15} strokeWidth={1.75} />
        </motion.button>
      </form>

      {/* Quick tags */}
      <div className="px-5 pt-3 pb-5">
        <div className="mb-2 flex items-center justify-between">
          <Label>{isInj ? "태그 · 한 기록에 합쳐짐" : "Quick tags"}</Label>
          <button
            type="button"
            onClick={() => setTagMode((v) => !v)}
            className="-my-2.5 px-2 py-2.5 font-mono text-[10.5px] text-ink/45 underline-offset-4 hover:text-ink hover:underline md:-my-1 md:px-1.5 md:py-1"
          >
            {tagMode ? "완료" : "편집"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {tags.map((t) => (
              <motion.div
                key={t}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex"
              >
                <Chip danger={tagMode} onClick={() => (tagMode ? removeTag(cat, t) : addTagEntry(selected, cat, t))}>
                  {tagMode && <X size={11} strokeWidth={2} />}
                  {t}
                </Chip>
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
              className="mt-2 flex overflow-hidden border-b border-ink"
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
                aria-label="새 태그"
                className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[12px] outline-none placeholder:text-ink/30"
              />
              <button type="submit" aria-label="태그 추가" className="flex w-9 items-center justify-center hover:text-ink">
                <Plus size={14} strokeWidth={2} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
