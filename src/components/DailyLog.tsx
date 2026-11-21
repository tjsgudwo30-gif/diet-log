"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bike, Coffee, CornerDownLeft, Moon, Plus, Sun, UtensilsCrossed, X } from "lucide-react";
import { useState, type ComponentType } from "react";
import type { DietStore } from "@/lib/store";
import { shortLabel, todayKey, weekday } from "@/lib/date";
import { CATEGORIES, type Category } from "@/lib/types";
import { BrutalButton, Cell } from "./ui";

const ICONS: Record<Category, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  breakfast: Sun,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Coffee,
  exercise: Bike,
};

export function DailyLog({ store, selected, pulse = 0 }: { store: DietStore; selected: string; pulse?: number }) {
  const day = store.data.days[selected];
  const total = CATEGORIES.reduce((n, c) => n + (day?.logs[c.key]?.length ?? 0), 0);
  const isToday = selected === todayKey();
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
          <p className="pb-1 font-mono text-[11px] uppercase tracking-[0.14em] md:text-right">
            식단 & 운동 · {total} entries {!isToday && <span className="bg-blaze px-1 font-bold">과거 기록 편집 중</span>}
            <br />
            <span className="opacity-60">Enter로 저장 · 태그 클릭으로 원클릭 추가</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[2px] bg-ink sm:grid-cols-2 col-span-6 md:col-span-12 lg:grid-cols-5">
        {CATEGORIES.map((c, i) => (
          <LogColumn key={c.key} cat={c.key} label={c.label} en={c.en} idx={i} store={store} selected={selected} />
        ))}
      </div>
    </>
  );
}

function LogColumn({
  cat,
  label,
  en,
  idx,
  store,
  selected,
}: {
  cat: Category;
  label: string;
  en: string;
  idx: number;
  store: DietStore;
  selected: string;
}) {
  const { data, addLog, removeLog, addTag, removeTag } = store;
  const items = data.days[selected]?.logs[cat] ?? [];
  const tags = data.tags[cat];
  const [text, setText] = useState("");
  const [tagMode, setTagMode] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const Icon = ICONS[cat];
  const isEx = cat === "exercise";

  const submit = () => {
    if (!text.trim()) return;
    addLog(selected, cat, text);
    setText("");
  };

  return (
    <Cell className={`bg-paper md:min-h-[360px] ${isEx ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <div className={`flex items-center justify-between border-b-2 border-ink px-4 py-3 ${isEx ? "bg-ink text-paper" : ""}`}>
        <div className="flex items-center gap-2">
          <Icon size={18} strokeWidth={2.5} />
          <span className="whitespace-nowrap text-lg font-black">{label}</span>
        </div>
        <span className={`truncate pl-2 font-mono text-[10px] tracking-[0.14em] ${isEx ? "text-acid" : "opacity-60"}`}>
          {String(idx + 1).padStart(2, "0")} / {en}
        </span>
      </div>

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
              className="group/item flex items-start justify-between gap-2 border-b border-dashed border-ink/40 py-2 font-mono text-[13px] leading-snug"
            >
              <span className="flex gap-2">
                <span className={isEx ? "text-blaze" : "opacity-40"}>{isEx ? "▲" : "—"}</span>
                <span className="break-all">{it.text}</span>
              </span>
              <button
                type="button"
                aria-label="삭제"
                onClick={() => removeLog(selected, cat, it.id)}
                className="shrink-0 opacity-30 transition hover:bg-blaze hover:opacity-100 group-hover/item:opacity-70"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
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
          placeholder={isEx ? "운동 메모…" : "무엇을 먹었나요?"}
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
          <span>Quick tags</span>
          <button type="button" onClick={() => setTagMode((v) => !v)} className={`px-1 ${tagMode ? "bg-ink text-acid" : "hover:bg-acid"}`}>
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
                  onClick={() => (tagMode ? removeTag(cat, t) : addLog(selected, cat, t))}
                  className={`h-7 px-2 text-[11px] normal-case tracking-normal ${isEx ? "hover:!text-ink" : ""} ${tagMode ? "!bg-blaze !text-ink" : ""}`}
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
