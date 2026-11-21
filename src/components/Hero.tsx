"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { shortLabel, weekdayKo } from "@/lib/date";
import { latestWeight, parseKg, prevWeight, type DietStore } from "@/lib/store";
import { AnimatedNumber, Cell, Dot, Label } from "./ui";

export function Hero({ store, selected }: { store: DietStore; selected: string }) {
  const { data, setWeight } = store;
  const weight = data.days[selected]?.weight;
  const prev = prevWeight(data, selected);
  const goal = data.goalWeight;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  /** Set by Esc so the blur that follows (input lingers during its exit animation) can't save. */
  const done = useRef(false);
  const viewRef = useRef<HTMLButtonElement>(null);

  const base = weight ?? latestWeight(data, selected) ?? goal + 5;
  const nudge = (d: number) => setWeight(selected, Math.max(20, Math.min(300, base + d)));

  const startEdit = () => {
    done.current = false;
    setInvalid(false);
    setDraft(weight !== undefined ? weight.toFixed(1) : "");
    setEditing(true);
  };
  const close = (refocus: boolean) => {
    done.current = true;
    setEditing(false);
    setInvalid(false);
    if (refocus) requestAnimationFrame(() => viewRef.current?.focus());
  };
  /**
   * Enter: save a valid value (20–300, "68,4" ok); an invalid one keeps the editor open and flags it.
   * Blur: save if valid, otherwise quietly keep the old value. Empty input never deletes —
   * deleting is the explicit "clear" button, so a stray tap can't wipe the day's weight.
   */
  const commit = (fromKeyboard: boolean) => {
    if (done.current) return;
    const v = draft.trim() === "" ? null : parseKg(draft);
    if (v === null && draft.trim() !== "" && fromKeyboard) {
      setInvalid(true);
      return;
    }
    if (v !== null) setWeight(selected, v);
    close(fromKeyboard);
  };

  const delta = weight !== undefined && prev ? weight - prev.weight : undefined;
  const toGoal = weight !== undefined ? weight - goal : undefined;

  const trend = delta === undefined ? null : delta < -0.04 ? "down" : delta > 0.04 ? "up" : "flat";

  return (
    <>
      {/* Main weight */}
      <Cell
        index="01"
        label={`Body weight · ${shortLabel(selected)} ${weekdayKo(selected)}`}
        className="col-span-6 min-h-[230px] md:col-span-8 md:min-h-[360px]"
        right={
          weight !== undefined && (
            <button
              type="button"
              onClick={() => setWeight(selected, undefined)}
              aria-label="이 날의 체중 기록 지우기"
              className="-my-2 -mr-2 flex items-center gap-1 px-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/45 transition-colors hover:text-blaze"
            >
              <Trash2 size={12} strokeWidth={1.75} /> clear
            </button>
          )
        }
      >
        <div className="flex flex-1 flex-col justify-end px-5 pb-5 md:px-6 md:pb-6">
          <div className="flex items-end gap-3 md:gap-4">
            <div className={`relative min-w-0 ${editing ? "flex-1" : ""}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                {editing ? (
                  <motion.form
                    key="edit"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      commit(true);
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-label="체중 (kg)"
                      aria-invalid={invalid || undefined}
                      aria-describedby="weight-edit-hint"
                      value={draft}
                      placeholder="00.0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setInvalid(false);
                        setDraft(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6));
                      }}
                      onBlur={() => commit(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          close(true);
                        }
                      }}
                      className={`display-tight w-full border-b-[3px] bg-transparent text-[clamp(6.5rem,18vw,15rem)] outline-none placeholder:text-ink/15 ${
                        invalid ? "border-blaze text-blaze" : "border-ink"
                      }`}
                    />
                    <p id="weight-edit-hint" role={invalid ? "alert" : undefined} className="mt-2 font-mono text-[11px]">
                      {invalid ? (
                        <span className="text-blaze">20–300kg 사이 숫자를 입력하세요 · 예: 68.4 / 68,4</span>
                      ) : (
                        <span className="text-ink/50">Enter 저장 · Esc 취소</span>
                      )}
                    </p>
                  </motion.form>
                ) : (
                  <motion.button
                    key="view"
                    ref={viewRef}
                    type="button"
                    onClick={startEdit}
                    title="클릭해서 직접 입력"
                    aria-label={weight !== undefined ? `체중 ${weight.toFixed(1)}kg, 눌러서 수정` : "체중 입력하기"}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    whileTap={{ scale: 0.985 }}
                    transition={{ duration: 0.12 }}
                    className="group block w-full cursor-text text-left"
                  >
                    {weight !== undefined ? (
                      <AnimatedNumber value={weight} className="display-tight block text-[clamp(6.5rem,18vw,15rem)]" />
                    ) : (
                      <span className="display-tight block text-[clamp(6.5rem,18vw,15rem)] text-ink/12">00.0</span>
                    )}
                    <span className="mt-1 block h-[3px] w-0 bg-ink transition-[width] duration-300 group-hover:w-full" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <span className="display-tight pb-[0.35em] text-[clamp(1.75rem,3.5vw,3rem)] text-ink/70">kg</span>
          </div>

          <div className="mt-5 hidden items-center gap-2 md:flex">
            <StepButton label="0.1kg 감소" onClick={() => nudge(-0.1)}>
              <Minus size={16} strokeWidth={2} />
            </StepButton>
            <StepButton label="0.1kg 증가" onClick={() => nudge(0.1)}>
              <Plus size={16} strokeWidth={2} />
            </StepButton>
            <Label className="ml-2">±0.1 kg</Label>
          </div>
        </div>
      </Cell>

      {/* Side stack: change + goal */}
      <div className="col-span-6 grid grid-cols-2 md:col-span-4 md:flex md:flex-col [&>*]:flex-1">
        <Cell index="02" label="vs. 이전" className="min-h-[160px] border-r border-ink/15 md:min-h-[180px] md:border-r-0 md:border-b">
          <div className="flex flex-1 flex-col justify-end gap-2 px-5 pb-5 md:px-6 md:pb-6">
            {delta !== undefined && prev ? (
              <>
                <div className="flex items-end gap-2">
                  <AnimatedNumber
                    value={delta}
                    signed
                    className={`display-tight text-[clamp(2.75rem,5.5vw,4.75rem)] ${trend === "up" ? "text-blaze" : ""}`}
                  />
                  <span className="display-tight pb-[0.3em] text-xl text-ink/70">kg</span>
                </div>
                <p className="flex items-center gap-2 font-mono text-[11px] text-ink/55">
                  <Dot tone={trend === "down" ? "acid" : trend === "up" ? "blaze" : "ink"} />
                  {trend === "down" ? "감소" : trend === "up" ? "증가" : "유지"} · {shortLabel(prev.key)} {prev.weight.toFixed(1)}
                </p>
              </>
            ) : (
              <p className="font-mono text-[12px] text-ink/45">{weight === undefined ? "체중을 입력하세요" : "이전 기록 없음"}</p>
            )}
          </div>
        </Cell>

        <Cell index="03" label="목표까지" className="min-h-[160px] md:min-h-[180px]">
          <div className="flex flex-1 flex-col justify-end gap-3 px-5 pb-5 md:px-6 md:pb-6">
            {toGoal !== undefined ? (
              <>
                <div className="flex items-end gap-2">
                  {toGoal <= 0 ? (
                    <span className="display-tight text-[clamp(2.75rem,5.5vw,4.75rem)]">달성</span>
                  ) : (
                    <>
                      <AnimatedNumber value={toGoal} className="display-tight text-[clamp(2.75rem,5.5vw,4.75rem)]" />
                      <span className="display-tight pb-[0.3em] text-xl text-ink/70">kg</span>
                    </>
                  )}
                </div>
                <GoalBar weight={weight!} goal={goal} />
              </>
            ) : (
              <p className="font-mono text-[12px] text-ink/45">목표 {goal.toFixed(1)}kg</p>
            )}
          </div>
        </Cell>
      </div>
    </>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.9, y: 1 }}
      transition={{ type: "spring", stiffness: 700, damping: 28, mass: 1.2 }}
      className="flex h-10 w-10 items-center justify-center border border-ink/25 transition-colors hover:border-ink hover:bg-ink hover:text-paper"
    >
      {children}
    </motion.button>
  );
}

/** Thin progress rule: acid fill over a 10 kg window above the goal, with start/goal captions. */
function GoalBar({ weight, goal }: { weight: number; goal: number }) {
  const pct = Math.max(0, Math.min(1, 1 - (weight - goal) / 10));
  return (
    <div>
      <div className="relative h-1.5 bg-ink/10">
        <motion.div
          className="absolute inset-y-0 left-0 bg-acid"
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        <motion.span
          aria-hidden
          className="absolute top-1/2 h-3 w-[3px] -translate-y-1/2 bg-ink"
          animate={{ left: `calc(${pct * 100}% - 1.5px)` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-ink/50">
        <span>{weight.toFixed(1)}</span>
        <span>목표 {goal.toFixed(1)}</span>
      </div>
    </div>
  );
}
