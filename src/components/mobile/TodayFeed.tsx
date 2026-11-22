"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, NotebookPen, Plus, X } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { shortLabel, todayKey } from "@/lib/date";
import {
  checkpointProgress,
  computeMilestones,
  computeStreak,
  dailyHeadline,
  dayIndex,
  dayStamp,
  goalProgress,
  lastInjection,
  latestWeight,
  prevWeight,
  type DietStore,
} from "@/lib/store";
import type { AppData, Category } from "@/lib/types";
import { BadgeTile, badgeCount, BRAND, CheckpointGauge, HeadlineText, StampRow, TAGLINE } from "../Achievements";
import { CATEGORY_ICONS } from "../DailyLog";
import { AnimatedNumber, Dot, Label } from "../ui";
import type { SheetRequest } from "./EntrySheet";

/** Feed sections, in the order of a day. Each "+" opens the sheet on its own category. */
const SECTIONS: { cat: Category; label: string; req: SheetRequest }[] = [
  { cat: "breakfast", label: "아침", req: { tab: "meal", meal: "breakfast" } },
  { cat: "lunch", label: "점심", req: { tab: "meal", meal: "lunch" } },
  { cat: "dinner", label: "저녁", req: { tab: "meal", meal: "dinner" } },
  { cat: "snack", label: "간식", req: { tab: "meal", meal: "snack" } },
  { cat: "exercise", label: "운동", req: { tab: "exercise" } },
  { cat: "injection", label: "주사", req: { tab: "injection" } },
];

/**
 * "오늘" tab: the weight card on top, then every part of the day as a section with its
 * entries. Tap an entry to edit it, ✕ to delete (with undo), "+" to add to that section.
 */
export function TodayFeed({
  store,
  selected,
  onOpen,
  onRemoveLog,
  onClearNote,
}: {
  store: DietStore;
  selected: string;
  onOpen: (req: SheetRequest) => void;
  onRemoveLog: (cat: Category, id: string) => void;
  onClearNote: () => void;
}) {
  const { data } = store;
  const day = data.days[selected];
  const isToday = selected === todayKey();
  const lastInj = lastInjection(data, selected, { strict: true });
  const injected = (day?.logs.injection?.length ?? 0) > 0;
  const injectionDue = isToday && !injected && !!lastInj && lastInj.daysAgo >= 7;

  return (
    <div className="space-y-4">
      <IdentityCard data={data} selected={selected} />
      <WeightCard store={store} selected={selected} onOpen={() => onOpen({ tab: "weight" })} />

      <section aria-label="하루 기록" className="divide-y divide-ink/15 border-[1.5px] border-ink">
        {SECTIONS.map((s) => {
          const items = day?.logs[s.cat] ?? [];
          const Icon = CATEGORY_ICONS[s.cat];
          const isInj = s.cat === "injection";
          return (
            <Section
              key={s.cat}
              Icon={Icon}
              label={s.label}
              count={items.length}
              onAdd={() => onOpen(s.req)}
              note={
                isInj && !injected && lastInj ? (
                  <span className={`flex items-center gap-1.5 ${injectionDue ? "text-blaze" : ""}`}>
                    {injectionDue && <Dot tone="blaze" />}
                    {injectionDue ? "투약 예정일 · " : ""}지난 {shortLabel(lastInj.key)} D+{lastInj.daysAgo}
                  </span>
                ) : undefined
              }
            >
              {items.map((it) => (
                <Entry
                  key={it.id}
                  text={it.text}
                  marker={isInj ? <Dot tone="blaze" className="mt-[7px]" /> : undefined}
                  onEdit={() => onOpen({ tab: s.req.tab, edit: { cat: s.cat, id: it.id } })}
                  onRemove={() => onRemoveLog(s.cat, it.id)}
                />
              ))}
            </Section>
          );
        })}

        {/* Condition / memo: one line per day */}
        <Section Icon={NotebookPen} label="컨디션 · 메모" count={day?.note ? 1 : 0} onAdd={() => onOpen({ tab: "note" })}>
          {day?.note && <Entry text={day.note} onEdit={() => onOpen({ tab: "note" })} onRemove={onClearNote} />}
        </Section>
      </section>

      <BadgesCard data={data} />
    </div>
  );
}

/* ---------- Identity bar: brand + streak, then the day's headline and stamp ---------- */

function IdentityCard({ data, selected }: { data: AppData; selected: string }) {
  const headline = dailyHeadline(data, selected);
  const stamp = dayStamp(data, selected);
  const streak = computeStreak(data);
  const isToday = selected === todayKey();
  return (
    <section aria-label="오늘 한눈에" className="border-[1.5px] border-ink">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-paper">
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-bold tracking-[0.08em]">{BRAND}</p>
          <p className="truncate text-[11.5px] text-paper/60">{TAGLINE}</p>
        </div>
        <p className="flex shrink-0 items-baseline gap-1" aria-label={`연속 기록 ${streak}일`}>
          <span className={`display-tight text-[2rem] ${streak > 0 ? "text-acid" : "text-paper/40"}`}>{streak}</span>
          <span className="font-mono text-[10.5px] text-paper/60">일 연속</span>
        </p>
      </div>
      <div className="space-y-3 p-4">
        <HeadlineText headline={headline} />
        <div>
          <Label className="mb-1.5 block">{isToday ? "오늘 스탬프" : `${shortLabel(selected)} 스탬프`}</Label>
          <StampRow stamp={stamp} />
        </div>
      </div>
    </section>
  );
}

/* ---------- Badges: folded by default, the count always visible ---------- */

function BadgesCard({ data }: { data: AppData }) {
  const [open, setOpen] = useState(false);
  const milestones = useMemo(() => computeMilestones(data), [data]);
  const done = badgeCount(milestones);
  const latest = milestones
    .filter((m) => m.achieved && m.at)
    .sort((a, b) => (a.at! < b.at! ? 1 : -1))[0];
  return (
    <section aria-label="성취 배지" className="border-[1.5px] border-ink">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-ink/5"
      >
        <Label>성취 배지</Label>
        <b className="font-mono text-[14px] tabular-nums">
          {done}
          <span className="text-ink/40">/{milestones.length}</span>
        </b>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink/50">
          {latest ? `최근 · ${latest.label}` : "기록이 쌓이면 자동으로 달성돼요"}
        </span>
        <ChevronDown size={18} strokeWidth={1.75} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-2 overflow-hidden px-4"
          >
            {milestones.map((m) => (
              <BadgeTile key={m.id} m={m} />
            ))}
            <li aria-hidden className="col-span-2 h-2" />
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------- Weight card ---------- */

function WeightCard({ store, selected, onOpen }: { store: DietStore; selected: string; onOpen: () => void }) {
  const { data } = store;
  const weight = data.days[selected]?.weight;
  const prev = prevWeight(data, selected);
  const goal = data.goalWeight;
  const delta = weight !== undefined && prev ? weight - prev.weight : null;
  const toGoal = weight !== undefined ? weight - goal : null;
  const progress = weight !== undefined ? goalProgress(data, weight) : null;
  const isToday = selected === todayKey();
  const firstRun = dayIndex(data).weights.length === 0;
  const up = delta !== null && delta > 0.04;
  // checkpoints follow the latest known weight, so a day without a weigh-in still shows the path
  const cp = checkpointProgress(data, weight ?? latestWeight(data, selected));

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.985 }}
      aria-label={weight !== undefined ? `체중 ${weight.toFixed(1)}kg, 눌러서 수정` : "체중 입력하기"}
      className="block w-full border-[1.5px] border-ink bg-paper text-left"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <Label>{isToday ? "오늘 체중" : `${shortLabel(selected)} 체중`}</Label>
        <span className="font-mono text-[11px] text-ink/45">{weight !== undefined ? "탭해서 수정" : "탭해서 입력"}</span>
      </div>
      <div className="flex items-end gap-2 px-4 pt-2">
        {weight !== undefined ? (
          <AnimatedNumber value={weight} className="display-tight text-[4.5rem]" />
        ) : (
          <span className="display-tight text-[4.5rem] text-ink/12">00.0</span>
        )}
        <span className="display-tight pb-2 text-2xl text-ink/60">kg</span>
      </div>
      {firstRun && (
        <p className="px-4 pt-2 font-mono text-[11px] leading-relaxed text-ink/50">
          첫 체중을 입력하면 기록이 시작돼요. 둘러보려면 ⚙ 설정에서 샘플 데이터를 채워 보세요.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 border-t border-ink/15">
        <div className="border-r border-ink/15 px-4 py-3">
          <Label>직전 대비</Label>
          <p className={`mt-1 font-mono text-[15px] font-bold tabular-nums ${up ? "text-blaze" : delta === null ? "text-ink/30" : ""}`}>
            {delta === null ? "—" : `${delta > 0.04 ? "+" : delta < -0.04 ? "−" : "±"}${Math.abs(delta).toFixed(1)}kg`}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink/45">
            {prev ? `${shortLabel(prev.key)} ${prev.weight.toFixed(1)}` : "이전 기록 없음"}
          </p>
        </div>
        <div className="px-4 py-3">
          <Label>목표 {goal.toFixed(1)}</Label>
          <p className={`mt-1 font-mono text-[15px] font-bold tabular-nums ${toGoal === null ? "text-ink/30" : ""}`}>
            {toGoal === null ? "—" : toGoal <= 0 ? "달성" : `${toGoal.toFixed(1)}kg 남음`}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 bg-ink/10" aria-hidden>
              <motion.div
                className="absolute inset-y-0 left-0 bg-acid"
                animate={{ width: `${(progress?.pct ?? (toGoal !== null && toGoal <= 0 ? 1 : 0)) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            {progress && <span className="font-mono text-[10.5px] tabular-nums text-ink/55">{Math.round(progress.pct * 100)}%</span>}
          </div>
        </div>
      </div>
      {cp && (
        <div className={`border-t border-ink/15 px-4 py-3 ${cp.reached ? "bg-acid/25" : ""}`}>
          <CheckpointGauge cp={cp} />
        </div>
      )}
    </motion.button>
  );
}

/* ---------- Section + entry rows ---------- */

function Section({
  Icon,
  label,
  count,
  note,
  onAdd,
  children,
}: {
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  count: number;
  note?: React.ReactNode;
  onAdd: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex min-h-14 items-center gap-2.5 pl-4">
        <span className={count ? "text-ink" : "text-ink/40"}>
          <Icon size={17} strokeWidth={1.75} />
        </span>
        <span className={`text-[15px] font-bold ${count ? "" : "text-ink/45"}`}>{label}</span>
        {count > 0 && <span className="font-mono text-[11px] tabular-nums text-ink/40">{count}</span>}
        <span className="min-w-0 flex-1 truncate text-right font-mono text-[10.5px] text-ink/50">{note}</span>
        <button
          type="button"
          aria-label={`${label} 추가`}
          onClick={onAdd}
          className="flex h-14 w-14 shrink-0 items-center justify-center active:bg-ink active:text-paper"
        >
          <span className="flex h-8 w-8 items-center justify-center border-[1.5px] border-ink">
            <Plus size={16} strokeWidth={2.25} />
          </span>
        </button>
      </div>
      {count > 0 && <ul className="px-4 pb-2">{children}</ul>}
    </div>
  );
}

function Entry({
  text,
  marker,
  onEdit,
  onRemove,
}: {
  text: string;
  marker?: React.ReactNode;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start border-t border-ink/10 first:border-t-0">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-11 min-w-0 flex-1 items-start gap-2 py-2.5 text-left font-mono text-[14px] leading-snug active:bg-ink/5"
      >
        {marker}
        <span className="min-w-0 break-words break-keep">{text}</span>
      </button>
      <button
        type="button"
        aria-label="삭제"
        onClick={onRemove}
        className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center text-ink/40 active:text-blaze"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </li>
  );
}
