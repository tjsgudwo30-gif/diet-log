"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { shortLabel, weekdayKo } from "@/lib/date";
import { latestWeight, prevWeight, type DietStore } from "@/lib/store";
import { AnimatedNumber, BrutalButton, Cell, Tag } from "./ui";

export function Hero({ store, selected }: { store: DietStore; selected: string }) {
  const { data, setWeight } = store;
  const weight = data.days[selected]?.weight;
  const prev = prevWeight(data, selected);
  const goal = data.goalWeight;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const base = weight ?? latestWeight(data, selected) ?? goal + 5;
  const nudge = (d: number) => setWeight(selected, Math.max(20, Math.min(300, base + d)));

  const startEdit = () => {
    setDraft(weight !== undefined ? weight.toFixed(1) : "");
    setEditing(true);
  };
  const commit = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (draft.trim() === "") setWeight(selected, undefined);
    else if (!Number.isNaN(v) && v >= 20 && v <= 300) setWeight(selected, v);
    setEditing(false);
  };

  const delta = weight !== undefined && prev ? weight - prev.weight : undefined;
  const toGoal = weight !== undefined ? weight - goal : undefined;

  return (
    <>
      {/* Main weight */}
      <Cell
        index="01"
        label={`Body Weight — ${shortLabel(selected)} (${weekdayKo(selected)})`}
        className="col-span-6 min-h-[220px] md:col-span-8 md:min-h-[340px]"
        right={
          weight !== undefined && (
            <button
              type="button"
              onClick={() => setWeight(selected, undefined)}
              className="flex items-center gap-1 font-mono text-[11px] uppercase opacity-50 hover:opacity-100"
            >
              <Trash2 size={12} /> clear
            </button>
          )
        }
      >
        <div className="flex flex-1 flex-col justify-end px-4 pb-4">
          <div className="flex items-end gap-3">
            <div className="relative min-w-0 flex-1">
              <AnimatePresence mode="popLayout" initial={false}>
                {editing ? (
                  <motion.form
                    key="edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      commit();
                    }}
                  >
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={draft}
                      placeholder="00.0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
                      className="display-tight w-full bg-acid text-[clamp(7rem,19vw,17rem)] outline-none placeholder:text-ink/20"
                    />
                  </motion.form>
                ) : (
                  <motion.button
                    key="view"
                    type="button"
                    onClick={startEdit}
                    title="클릭해서 직접 입력"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="block w-full cursor-text text-left"
                  >
                    {weight !== undefined ? (
                      <AnimatedNumber value={weight} className="display-tight block text-[clamp(7rem,19vw,17rem)]" />
                    ) : (
                      <span className="display-tight block text-[clamp(7rem,19vw,17rem)] text-ink/15">00.0</span>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <span className="display-tight pb-[0.12em] text-[clamp(2.5rem,5vw,4.5rem)]">KG</span>
          </div>

          <div className="mt-4 hidden flex-wrap items-center gap-2 border-t-2 border-ink pt-4 md:flex">
            <BrutalButton onClick={() => nudge(-0.1)} className="h-12 w-16" aria-label="0.1kg 감소">
              <Minus size={18} strokeWidth={3} />
              <span>0.1</span>
            </BrutalButton>
            <BrutalButton onClick={() => nudge(0.1)} className="h-12 w-16" aria-label="0.1kg 증가">
              <Plus size={18} strokeWidth={3} />
              <span>0.1</span>
            </BrutalButton>
            <span className="ml-2 hidden font-mono text-xs uppercase opacity-60 sm:inline">
              {weight === undefined ? "숫자를 클릭해 입력 · ± 버튼으로 이전 기록에서 시작" : "숫자 클릭 → 직접 수정 · Enter 저장 · Esc 취소"}
            </span>
          </div>
        </div>
      </Cell>

      {/* Side stack */}
      <div className="col-span-6 grid grid-cols-2 md:col-span-4 md:flex md:flex-col [&>*]:flex-1">
        <Cell index="02" label="vs. Previous" className="min-h-[150px] border-r-2 border-ink md:min-h-[170px] md:border-r-0 md:border-b-2">
          <div className="flex flex-1 flex-col justify-end gap-3 px-4 pb-4">
            {delta !== undefined ? (
              <>
                <div className="flex items-end gap-2">
                  <motion.span
                    key={Math.sign(delta)}
                    initial={{ y: delta < 0 ? -20 : 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`display-tight text-4xl md:text-6xl ${delta > 0 ? "text-blaze" : ""}`}
                  >
                    {delta < -0.04 ? "▼" : delta > 0.04 ? "▲" : "■"}
                  </motion.span>
                  <AnimatedNumber value={delta} signed className="display-tight text-[clamp(2.5rem,6vw,5.5rem)]" />
                  <span className="display-tight pb-1 text-2xl">KG</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tag tone={delta <= 0 ? "acid" : "blaze"}>
                    {delta < -0.04 ? "▼" : delta > 0.04 ? "▲" : "■"} {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}kg
                  </Tag>
                  <span className="self-center font-mono text-[11px] uppercase opacity-60">
                    from {shortLabel(prev!.key)} · {prev!.weight.toFixed(1)}
                  </span>
                </div>
              </>
            ) : (
              <p className="font-mono text-sm opacity-60">{weight === undefined ? "— 오늘 체중 미입력" : "— 이전 기록 없음"}</p>
            )}
          </div>
        </Cell>
        <Cell
          index="03"
          label="To Goal"
          className="min-h-[150px] md:min-h-[170px]"
          right={
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Target size={12} /> {goal.toFixed(1)}KG
            </span>
          }
        >
          <div className="flex flex-1 flex-col justify-end gap-3 px-4 pb-4">
            {toGoal !== undefined ? (
              <>
                <div className="flex items-end gap-2">
                  <AnimatedNumber
                    value={Math.abs(toGoal)}
                    className="display-tight text-[clamp(2.5rem,6vw,5.5rem)]"
                  />
                  <span className="display-tight pb-1 text-2xl">KG</span>
                  <span className="pb-1 font-mono text-xs font-bold uppercase">{toGoal > 0 ? "left" : "below"}</span>
                </div>
                <GoalBar weight={weight!} goal={goal} />
                <div>
                  <Tag tone={toGoal <= 0 ? "acid" : "blaze"}>
                    {toGoal <= 0 ? "★ GOAL REACHED" : `목표까지 ${toGoal.toFixed(1)}kg`}
                  </Tag>
                </div>
              </>
            ) : (
              <p className="font-mono text-sm opacity-60">— 체중을 입력하면 목표까지 남은 수치가 표시됩니다</p>
            )}
          </div>
        </Cell>
      </div>
    </>
  );
}

function GoalBar({ weight, goal }: { weight: number; goal: number }) {
  // progress relative to a 10kg window above goal
  const pct = Math.max(0, Math.min(1, 1 - (weight - goal) / 10));
  return (
    <div className="relative h-4 border-2 border-ink">
      <motion.div
        className="absolute inset-y-0 left-0 bg-acid"
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="absolute top-0 bottom-0 w-px bg-ink/40" style={{ left: `${(i + 1) * 10}%` }} />
      ))}
    </div>
  );
}
