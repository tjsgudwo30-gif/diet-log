"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Database, Download, Minus, Plus, RotateCcw, Target, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { makeBackup, parseBackup, summarize, type DietStore } from "@/lib/store";
import { todayKey } from "@/lib/date";
import type { AppData } from "@/lib/types";
import { AnimatedNumber, BrutalButton } from "./ui";

export function SettingsModal({ open, onClose, store }: { open: boolean; onClose: () => void; store: DietStore }) {
  const { data, setGoal, fillSample, resetAll, replaceAll } = store;
  const [confirm, setConfirm] = useState<null | "sample" | "reset" | "import">(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recordCount = Object.values(data.days).filter((d) => d.weight !== undefined).length;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(makeBackup(data), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weight-log-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    done("백업 파일 저장 완료");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("파일이 너무 큽니다 (10MB 초과).");
      const parsed = parseBackup(JSON.parse(await file.text()));
      setPending(parsed);
      setConfirm("import");
    } catch (e) {
      setError(e instanceof SyntaxError ? "JSON 파일을 읽을 수 없습니다." : (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const pendingSummary = pending ? summarize(pending) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function done(msg: string) {
    setConfirm(null);
    setError(null);
    setFlash(msg);
    setTimeout(() => setFlash(null), 1600);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-end bg-ink/50 p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="설정"
            initial={{ x: 40, y: -20, opacity: 0, rotate: 1.5 }}
            animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto border-2 border-ink bg-paper shadow-[8px_8px_0_0_#000]"
          >
            <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-paper">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em]">[ Settings ]</span>
              <button type="button" onClick={onClose} aria-label="닫기" className="hover:text-acid">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Goal */}
            <section className="border-b-2 border-ink p-4">
              <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                <Target size={13} /> 목표 체중
              </p>
              <div className="flex items-center gap-3">
                <BrutalButton className="h-12 w-12" onClick={() => setGoal(data.goalWeight - 0.5)} aria-label="목표 -0.5">
                  <Minus size={18} strokeWidth={3} />
                </BrutalButton>
                <div className="flex flex-1 items-end justify-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    key={data.goalWeight}
                    defaultValue={data.goalWeight.toFixed(1)}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v > 20 && v < 300) setGoal(v);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="display-tight w-40 bg-transparent text-center text-7xl outline-none focus:bg-acid"
                  />
                  <span className="display-tight pb-1 text-2xl">KG</span>
                </div>
                <BrutalButton className="h-12 w-12" onClick={() => setGoal(data.goalWeight + 0.5)} aria-label="목표 +0.5">
                  <Plus size={18} strokeWidth={3} />
                </BrutalButton>
              </div>
            </section>

            {/* Data */}
            <section className="p-4">
              <p className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
                <span className="flex items-center gap-2">
                  <Database size={13} /> Data · LocalStorage
                </span>
                <span>
                  <AnimatedNumber value={recordCount} decimals={0} /> records
                </span>
              </p>

              <AnimatePresence mode="wait">
                {confirm ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`border-2 border-ink p-3 ${confirm === "sample" ? "bg-acid" : "bg-blaze"}`}
                  >
                    <p className="mb-3 font-mono text-[13px] font-bold leading-snug">
                      {confirm === "reset"
                        ? "모든 체중·식단·운동 기록과 커스텀 태그가 삭제됩니다. 되돌릴 수 없어요."
                        : confirm === "sample"
                          ? "기존 기록을 지우고 최근 14일 샘플 데이터로 교체합니다. (목표 체중은 유지)"
                          : "현재 기록을 백업 파일의 내용으로 덮어씁니다. 필요하면 먼저 현재 데이터를 내보내 두세요."}
                    </p>
                    {confirm === "import" && pendingSummary && (
                      <dl className="mb-3 grid grid-cols-3 gap-px border-2 border-ink bg-ink font-mono text-[11px]">
                        {[
                          ["DAYS", pendingSummary.days],
                          ["WEIGHTS", pendingSummary.weights],
                          ["LOGS", pendingSummary.logs],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-paper px-2 py-1.5">
                            <dt className="opacity-60">{k}</dt>
                            <dd className="display-tight text-3xl">{v}</dd>
                          </div>
                        ))}
                        <div className="col-span-3 bg-paper px-2 py-1">
                          {pendingSummary.from ? `${pendingSummary.from} → ${pendingSummary.to}` : "기록 없음"} · 목표{" "}
                          {pending!.goalWeight.toFixed(1)}kg
                        </div>
                      </dl>
                    )}
                    <div className="flex gap-2">
                      <BrutalButton
                        tone="ink"
                        className="h-10 flex-1"
                        onClick={() => {
                          if (confirm === "reset") {
                            resetAll();
                            done("초기화 완료");
                          } else if (confirm === "sample") {
                            fillSample();
                            done("샘플 14일 생성 완료");
                          } else if (pending) {
                            replaceAll(pending);
                            setPending(null);
                            done("백업 복원 완료");
                          }
                        }}
                      >
                        {confirm === "import" ? "복원하기" : "확인"}
                      </BrutalButton>
                      <BrutalButton
                        className="h-10 flex-1"
                        onClick={() => {
                          setConfirm(null);
                          setPending(null);
                        }}
                      >
                        취소
                      </BrutalButton>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <BrutalButton tone="ink" className="h-14 flex-col !gap-0.5" onClick={exportJson}>
                        <Download size={16} strokeWidth={2.5} />
                        <span>JSON 내보내기</span>
                      </BrutalButton>
                      <BrutalButton className="h-14 flex-col !gap-0.5" onClick={() => fileRef.current?.click()}>
                        <Upload size={16} strokeWidth={2.5} />
                        <span>JSON 불러오기</span>
                      </BrutalButton>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => onFile(e.target.files?.[0])}
                      />
                    </div>
                    <p className="mb-1 font-mono text-[10px] leading-snug opacity-60">
                      브라우저 캐시를 지우면 기록이 사라집니다. 주기적으로 백업 파일을 저장해 두세요.
                    </p>
                    {error && (
                      <p className="border-2 border-ink bg-blaze px-2 py-1.5 font-mono text-[11px] font-bold">✕ {error}</p>
                    )}
                    <BrutalButton
                      tone="acid"
                      className="h-12 w-full justify-between px-4"
                      onClick={() => (recordCount ? setConfirm("sample") : (fillSample(), done("샘플 14일 생성 완료")))}
                    >
                      <span>샘플 데이터 채우기</span>
                      <span className="opacity-60">14 DAYS</span>
                    </BrutalButton>
                    <BrutalButton tone="paper" className="h-12 w-full justify-between px-4 hover:!bg-blaze" onClick={() => setConfirm("reset")}>
                      <span>전체 초기화</span>
                      <RotateCcw size={16} strokeWidth={2.5} />
                    </BrutalButton>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {flash && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 inline-block bg-ink px-2 py-1 font-mono text-[11px] font-bold text-acid"
                  >
                    ✓ {flash}
                  </motion.p>
                )}
              </AnimatePresence>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
