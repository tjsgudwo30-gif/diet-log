"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortLabel, weekdayKo } from "@/lib/date";
import { appendNoteToken, lastInjection, latestWeight, NOTE_SEP, noteTokens, parseKg, prevWeight, type DietStore } from "@/lib/store";
import { NOTE_MAX, NOTE_PRESETS, type Category } from "@/lib/types";
import { Chip, Dot } from "../ui";
import { BottomSheet } from "./BottomSheet";

export type SheetTab = "weight" | "meal" | "exercise" | "injection" | "note";
export type MealCat = "breakfast" | "lunch" | "dinner" | "snack";

/** What the sheet should open on: a tab (+ meal slot), or an existing log line to edit. */
export interface SheetRequest {
  tab: SheetTab;
  meal?: MealCat;
  edit?: { cat: Category; id: string };
}

const TABS: { key: SheetTab; label: string }[] = [
  { key: "weight", label: "체중" },
  { key: "meal", label: "식단" },
  { key: "exercise", label: "운동" },
  { key: "injection", label: "주사" },
  { key: "note", label: "메모" },
];
const MEALS: { key: MealCat; label: string }[] = [
  { key: "breakfast", label: "아침" },
  { key: "lunch", label: "점심" },
  { key: "dinner", label: "저녁" },
  { key: "snack", label: "간식" },
];
const CAT_LABEL: Record<Category, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
  exercise: "운동",
  injection: "주사",
};
const PLACEHOLDER: Record<Category, string> = {
  breakfast: "아침에 먹은 것",
  lunch: "점심 메뉴",
  dinner: "저녁 식사",
  snack: "간식 · 음료 · 커피",
  exercise: "운동 종류와 시간",
  injection: "약품 · 용량 · 부위",
};

/** Meal slot that fits the current time of day. */
export function defaultMeal(): MealCat {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

const tabOf = (cat: Category): SheetTab =>
  cat === "exercise" ? "exercise" : cat === "injection" ? "injection" : "meal";

/** Tag chips fill the text field: meals/exercise as "a, b", injection as "위고비0.5mg · 복부". */
const sepOf = (cat: Category) => (cat === "injection" ? NOTE_SEP : ", ");
const tokensOf = (cat: Category, text: string) =>
  cat === "injection" ? noteTokens(text) : text.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
const tagText = (cat: Category, tag: string) => (cat === "injection" ? tag.replace(/^#/, "") : tag);

export interface EntrySheetProps {
  store: DietStore;
  selected: string;
  /** null = closed; the request is kept while the sheet animates out. */
  state: { req: SheetRequest; n: number; open: boolean } | null;
  onClose: () => void;
  /** After a successful save: close + short confirmation. */
  onSaved: (message: string) => void;
  /** Deletes with an undo snackbar (owned by the app shell). */
  onRemoveLog: (cat: Category, id: string) => void;
  onClearNote: () => void;
  onClearWeight: () => void;
}

export function EntrySheet({ state, onClose, selected, ...rest }: EntrySheetProps) {
  const editing = !!state?.req.edit;
  return (
    <BottomSheet
      open={!!state?.open}
      onClose={onClose}
      title={`${editing ? "기록 수정" : "기록 추가"} · ${shortLabel(selected)} ${weekdayKo(selected)}`}
    >
      {/* keyed per opening: every open starts from fresh drafts */}
      {state && <EntryForm key={state.n} req={state.req} selected={selected} onClose={onClose} {...rest} />}
    </BottomSheet>
  );
}

function EntryForm({
  req,
  store,
  selected,
  onClose,
  onSaved,
  onRemoveLog,
  onClearNote,
  onClearWeight,
}: Omit<EntrySheetProps, "state"> & { req: SheetRequest }) {
  const { data, setWeight, addLog, updateLog, setNote, addTag, removeTag } = store;
  const day = data.days[selected];
  const editItem = req.edit ? day?.logs[req.edit.cat]?.find((l) => l.id === req.edit!.id) : undefined;
  const editCat = editItem ? req.edit!.cat : null;

  const [tab, setTab] = useState<SheetTab>(editCat ? tabOf(editCat) : req.tab);
  const [meal, setMeal] = useState<MealCat>(() =>
    editCat && tabOf(editCat) === "meal" ? (editCat as MealCat) : (req.meal ?? defaultMeal())
  );
  const cat: Category | null = editCat ?? (tab === "meal" ? meal : tab === "exercise" ? "exercise" : tab === "injection" ? "injection" : null);

  // one draft per field, so hopping between tabs never loses what was typed
  const [weightDraft, setWeightDraft] = useState(day?.weight !== undefined ? day.weight.toFixed(1) : "");
  const [texts, setTexts] = useState<Partial<Record<Category, string>>>(editItem && editCat ? { [editCat]: editItem.text } : {});
  const [noteDraft, setNoteDraft] = useState(day?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [tagEdit, setTagEdit] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  // Focus the tab's main field (opens the keyboard on Android). Not `autoFocus`: the sheet
  // is still sliding in from off-screen, and the browser would scroll the page to "reveal" it.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [tab, meal]);

  const text = cat ? (texts[cat] ?? "") : "";
  const setText = (v: string) => cat && setTexts((t) => ({ ...t, [cat]: v }));
  const lastInj = lastInjection(data, selected, { strict: true });
  const prev = prevWeight(data, selected);

  /* ---------- weight ---------- */
  const stepWeight = (d: number) => {
    const base = parseKg(weightDraft) ?? latestWeight(data, selected) ?? data.goalWeight + 5;
    setError(null);
    setWeightDraft(Math.max(20, Math.min(300, Math.round((base + d) * 10) / 10)).toFixed(1));
  };

  /* ---------- save ---------- */
  const canSave =
    tab === "weight" ? weightDraft.trim() !== "" : tab === "note" ? noteDraft.trim() !== (day?.note ?? "") : text.trim() !== "";

  const save = () => {
    if (!canSave) return;
    if (tab === "weight") {
      const v = parseKg(weightDraft);
      if (v === null) {
        setError("20–300kg 사이 숫자를 입력하세요 · 예: 68.4");
        return;
      }
      setWeight(selected, v);
      onSaved(`체중 ${v.toFixed(1)}kg 저장`);
      return;
    }
    if (tab === "note") {
      if (!noteDraft.trim()) onClearNote(); // emptied → delete (with undo)
      else {
        setNote(selected, noteDraft);
        onSaved("메모 저장");
      }
      return;
    }
    if (!cat) return;
    if (editItem && editCat) {
      updateLog(selected, editCat, editItem.id, text);
      onSaved(`${CAT_LABEL[editCat]} 수정`);
    } else {
      addLog(selected, cat, text);
      onSaved(`${CAT_LABEL[cat]} 추가`);
    }
  };

  /** Enter saves (Shift+Enter = new line); never while the Korean IME is composing. */
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      save();
    }
  };

  /* ---------- chips ---------- */
  const toggleTag = (tag: string) => {
    if (!cat) return;
    if (tagEdit) {
      removeTag(cat, tag);
      return;
    }
    const t = tagText(cat, tag);
    const parts = tokensOf(cat, text);
    setText((parts.includes(t) ? parts.filter((p) => p !== t) : [...parts, t]).join(sepOf(cat)).slice(0, 500));
  };
  const togglePreset = (p: string) => {
    const parts = noteTokens(noteDraft);
    if (parts.includes(p)) {
      setNoteDraft(parts.filter((x) => x !== p).join(NOTE_SEP));
      setError(null);
      return;
    }
    const r = appendNoteToken(noteDraft, p);
    if (r.ok) setNoteDraft(r.next);
    else if (r.reason === "max") setError(`메모는 ${NOTE_MAX}자까지예요`);
  };

  return (
    <form
      ref={formRef}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {/* Category tabs (hidden while editing an existing line) */}
        {editCat ? (
          <p className="pb-3 font-mono text-[12px] text-ink/55">{CAT_LABEL[editCat]} 항목</p>
        ) : (
          <div role="tablist" aria-label="기록 종류" className="grid grid-cols-5 border-[1.5px] border-ink">
            {TABS.map((t, i) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setTab(t.key);
                    setError(null);
                    setTagEdit(false);
                  }}
                  className={`h-11 text-[13px] font-bold transition-colors ${i > 0 ? "border-l border-ink/20" : ""} ${
                    on ? "bg-ink text-paper" : "text-ink/55"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {tab === "meal" && !editCat && (
          <div className="mt-3 flex gap-2">
            {MEALS.map((m) => (
              <Chip key={m.key} active={meal === m.key} aria-pressed={meal === m.key} onClick={() => setMeal(m.key)} className="flex-1 justify-center">
                {m.label}
              </Chip>
            ))}
          </div>
        )}

        {/* ---------- 체중 ---------- */}
        {tab === "weight" && (
          <div className="pt-5">
            <div className="flex items-stretch gap-2">
              <StepButton label="0.1kg 감소" onClick={() => stepWeight(-0.1)}>
                <Minus size={20} strokeWidth={2} />
              </StepButton>
              <label className="flex min-w-0 flex-1 items-end justify-center gap-1 border-b-[3px] border-ink">
                <input
                  data-autofocus
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-label="체중 (kg)"
                  aria-invalid={!!error || undefined}
                  value={weightDraft}
                  placeholder={(latestWeight(data, selected) ?? data.goalWeight + 5).toFixed(1)}
                  onFocus={(e) => requestAnimationFrame(() => e.target.select())}
                  onChange={(e) => {
                    setError(null);
                    setWeightDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6));
                  }}
                  className={`display-tight h-20 w-full min-w-0 bg-transparent text-center text-[clamp(3rem,16vw,4.25rem)] outline-none placeholder:text-ink/15 ${
                    error ? "text-blaze" : ""
                  }`}
                />
                <span className="shrink-0 pb-3 font-mono text-[13px] text-ink/50">kg</span>
              </label>
              <StepButton label="0.1kg 증가" onClick={() => stepWeight(0.1)}>
                <Plus size={20} strokeWidth={2} />
              </StepButton>
            </div>
            <div className="mt-3 flex min-h-11 items-center justify-between gap-3 font-mono text-[11px] text-ink/55">
              <span>{prev ? `직전 기록 ${shortLabel(prev.key)} · ${prev.weight.toFixed(1)}kg` : "첫 체중 기록이에요"}</span>
              {day?.weight !== undefined && (
                <button type="button" onClick={onClearWeight} className="-mr-2 h-11 px-2 text-ink/50 underline underline-offset-4">
                  체중 지우기
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------- 식단 / 운동 / 주사 ---------- */}
        {cat && (
          <div className="pt-4">
            {cat === "injection" && (
              <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink/60">
                {lastInj ? (
                  <>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {lastInj.daysAgo >= 7 && <Dot tone="blaze" />}
                      지난 투약 {shortLabel(lastInj.key)} · D+{lastInj.daysAgo}
                    </span>
                    {!editCat && (
                      <Chip onClick={() => setText(lastInj.text)} title={lastInj.text}>
                        ↺ 지난번과 동일
                      </Chip>
                    )}
                  </>
                ) : (
                  <span>첫 투약 기록 · 아래 태그로 약품/용량/부위를 고르세요</span>
                )}
              </div>
            )}
            <textarea
              data-autofocus={!!editCat || cat !== "injection" ? "" : undefined}
              rows={2}
              value={text}
              maxLength={500}
              enterKeyHint="done"
              aria-label={`${CAT_LABEL[cat]} 내용`}
              placeholder={PLACEHOLDER[cat]}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onEnter}
              className="block min-h-[4.5rem] w-full resize-none border-[1.5px] border-ink/25 bg-transparent p-3 font-mono text-base leading-snug outline-none placeholder:text-ink/30 focus:border-ink"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {data.tags[cat].map((t) => {
                const on = !tagEdit && tokensOf(cat, text).includes(tagText(cat, t));
                return (
                  <Chip key={t} active={on} danger={tagEdit} aria-pressed={tagEdit ? undefined : on} onClick={() => toggleTag(t)}>
                    {tagEdit && <X size={11} strokeWidth={2} />}
                    {t}
                  </Chip>
                );
              })}
              <button
                type="button"
                onClick={() => setTagEdit((v) => !v)}
                className="h-10 border border-dashed border-ink/30 px-2.5 font-mono text-[11px] text-ink/55"
              >
                {tagEdit ? "완료" : "태그 편집"}
              </button>
            </div>
            {tagEdit && (
              <div className="mt-2 flex border-b border-ink">
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault();
                      addTag(cat, tagDraft);
                      setTagDraft("");
                    }
                  }}
                  placeholder="#새태그"
                  aria-label="새 태그"
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-base outline-none placeholder:text-ink/30"
                />
                <button
                  type="button"
                  aria-label="태그 추가"
                  onClick={() => {
                    addTag(cat, tagDraft);
                    setTagDraft("");
                  }}
                  className="flex w-11 items-center justify-center"
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- 메모 (컨디션) ---------- */}
        {tab === "note" && (
          <div className="pt-4">
            <textarea
              data-autofocus
              rows={2}
              value={noteDraft}
              maxLength={NOTE_MAX}
              enterKeyHint="done"
              aria-label="컨디션 메모"
              placeholder="붓기, 수면, 공복감, 회식 여부 등"
              onChange={(e) => {
                setError(null);
                setNoteDraft(e.target.value);
              }}
              onKeyDown={onEnter}
              className="block min-h-[4.5rem] w-full resize-none border-[1.5px] border-ink/25 bg-transparent p-3 font-mono text-base leading-snug outline-none placeholder:text-ink/30 focus:border-ink"
            />
            <p className={`mt-1 text-right font-mono text-[10.5px] tabular-nums ${noteDraft.length >= NOTE_MAX * 0.9 ? "text-blaze" : "text-ink/40"}`}>
              {noteDraft.length}/{NOTE_MAX}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NOTE_PRESETS.map((p) => {
                const on = noteTokens(noteDraft).includes(p);
                return (
                  <Chip key={p} active={on} aria-pressed={on} onClick={() => togglePreset(p)}>
                    {p}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 font-mono text-[11px] text-blaze">
            {error}
          </p>
        )}
      </div>

      {/* Pinned actions */}
      <div className="flex shrink-0 gap-2 border-t border-ink/15 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {editItem && editCat && (
          <button
            type="button"
            onClick={() => onRemoveLog(editCat, editItem.id)}
            className="h-12 shrink-0 border-[1.5px] border-blaze px-4 font-mono text-[12px] font-bold text-blaze"
          >
            삭제
          </button>
        )}
        <button type="button" onClick={onClose} className="h-12 flex-1 border-[1.5px] border-ink font-mono text-[12px] font-bold">
          취소
        </button>
        <button
          type="submit"
          disabled={!canSave}
          // keep the keyboard's field focused until submit reads it
          onMouseDown={(e) => e.preventDefault()}
          className="h-12 flex-[2] bg-ink font-mono text-[13px] font-bold text-paper transition-opacity disabled:opacity-30"
        >
          저장
        </button>
      </div>
    </form>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className="flex w-12 shrink-0 items-center justify-center border-[1.5px] border-ink/25 active:bg-ink active:text-paper"
    >
      {children}
    </button>
  );
}
