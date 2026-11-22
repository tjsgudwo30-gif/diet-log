"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * How much of the layout viewport the on-screen keyboard covers.
 * iOS Safari overlays the keyboard instead of resizing, so a bottom-anchored sheet would sit
 * behind it; on Android (viewport `interactive-widget=resizes-content`) this stays 0.
 */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return active ? inset : 0;
}

/**
 * Page scroll lock shared by every open sheet (counted, so one sheet closing while another
 * opens never unlocks too early). `overflow: hidden` on <html> stops wheel / desktop scroll;
 * on touch screens the backdrop and the sheet frame are `touch-none`, so a drag that starts
 * there can't scroll the page behind, while the sheet's own content area is `touch-pan-y`.
 */
let scrollLocks = 0;
let savedOverflow = "";
function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (--scrollLocks === 0) document.documentElement.style.overflow = savedOverflow;
}

/**
 * Generic phone bottom sheet: dimmed backdrop, slides up from the bottom, lifts above the
 * keyboard. Closes on backdrop tap, ✕, Esc, or dragging the handle / title down.
 * Children fill a flex column; whatever should scroll inside it gets `<SheetScroll>`
 * (or `overflow-y-auto touch-pan-y overscroll-contain`).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const kb = useKeyboardInset(open);
  const drag = useDragControls();

  // Esc to close, lock the page behind, give focus back to whatever opened the sheet.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      unlockScroll();
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            aria-hidden
            className="absolute inset-0 touch-none bg-ink/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            className="absolute inset-x-0 flex max-h-[calc(100dvh-3rem)] touch-none flex-col border-t-[1.5px] border-ink bg-paper"
            style={{ bottom: kb }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Handle + title: the drag area (buttons inside still just click) */}
            <div
              className="shrink-0 touch-none"
              onPointerDown={(e) => {
                if (!(e.target as HTMLElement).closest("button")) drag.start(e);
              }}
            >
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="h-1 w-10 bg-ink/25" />
              </div>
              <div className="flex items-center justify-between gap-3 pl-4">
                <h2 className="min-w-0 truncate text-[15px] font-bold">{title}</h2>
                <button type="button" aria-label="닫기" onClick={onClose} className="flex h-11 w-12 shrink-0 items-center justify-center">
                  <X size={20} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** The scrolling part of a sheet (everything else in the sheet stays put). */
export function SheetScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain ${className}`}>{children}</div>;
}
