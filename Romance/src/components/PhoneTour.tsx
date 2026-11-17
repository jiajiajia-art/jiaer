import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import { loadGlobal, saveGlobal } from "../lib/saveScope";

/* 功能注释：首次进手机的新手引导——讲清「右上角刷新」可按当前剧情刷新应用。
 * 目标用 data-tour；看完或跳过后不再自动出现。 */

const KEY = "star.tour.phone.v1";

interface Step {
  id: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    id: "phone-guide",
    title: "刷新应用",
    text: "打开绿信、微博、短信等应用后，右上角会出现圆形刷新按钮。点一下，就会按当前剧情重新生成消息、动态等内容。",
  },
];

const pick = (id: string) => {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 20)));
    const hit = document.elementFromPoint(x, y);
    if (hit && (el === hit || el.contains(hit))) return el;
  }
  return null;
};

export default function PhoneTour({ active }: { active: boolean }) {
  const [list, setList] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const els = useRef(new Map<string, HTMLElement>());

  const start = useCallback(() => {
    els.current.clear();
    for (const s of STEPS) {
      const el = pick(s.id);
      if (el) els.current.set(s.id, el);
    }
    // 功能注释：手机引导只需一步即可开讲（刷新说明）
    const avail = STEPS.filter((s) => els.current.has(s.id));
    if (!avail.length) return false;
    setI(0);
    setList(avail);
    return true;
  }, []);

  const finish = useCallback(() => {
    saveGlobal(KEY, true);
    setList(null);
    setRect(null);
  }, []);

  useEffect(() => {
    if (!active || loadGlobal(KEY, false)) return;
    let n = 0;
    const t = window.setInterval(() => {
      if (start() || ++n > 12) window.clearInterval(t);
    }, 700);
    return () => window.clearInterval(t);
  }, [active, start]);

  useEffect(() => {
    const h = () => { start(); };
    window.addEventListener("star:phone-tour", h);
    return () => window.removeEventListener("star:phone-tour", h);
  }, [start]);

  const step = list?.[i];
  const measure = useCallback(() => {
    if (!step) return;
    const el = els.current.get(step.id);
    const r = el?.isConnected ? el.getBoundingClientRect() : null;
    setRect(r && r.width > 0 ? r : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    els.current.get(step.id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
    nextBtn.current?.focus();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const t = window.setInterval(measure, 400);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(t);
    };
  }, [step, measure]);

  useEffect(() => {
    if (!list) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [list, finish]);

  if (!list || !step) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const hole = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  const cardW = Math.min(320, vw - 24);
  const below = !hole || vh - (hole.top + hole.height) > 200;
  const cardLeft = hole
    ? Math.max(12, Math.min(vw - cardW - 12, hole.left + hole.width / 2 - cardW / 2))
    : (vw - cardW) / 2;
  const cardPos = !hole
    ? { top: vh / 2 - 90 }
    : below
      ? { top: Math.min(vh - 190, hole.top + hole.height + 12) }
      : { bottom: Math.max(12, vh - hole.top + 12) };

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="手机新手引导">
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-[color:var(--coral)] transition-all duration-300 ease-out"
          style={{
            ...hole,
            /* 功能注释：不用白光晕，避免把状态栏时间/信号冲白看不清 */
            boxShadow: "0 0 0 9999px rgba(24,16,44,0.66), 0 0 0 1px color-mix(in srgb, var(--coral) 55%, white)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(24,16,44,0.66)]" />
      )}
      <div
        className="absolute animate-pop rounded-2xl border border-white/60 bg-paper p-4 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.45)]"
        style={{ left: cardLeft, width: cardW, ...cardPos }}
      >
        <p className="text-[15px] font-bold text-ink">{step.title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">{step.text}</p>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={finish}
            className="rounded-full px-2 py-1 text-[12px] text-ink-soft transition hover:text-ink"
          >
            跳过
          </button>
          <span className="flex-1" />
          <button
            ref={nextBtn}
            type="button"
            onClick={finish}
            className="rounded-full bg-gradient-to-br from-[var(--coral)] to-[var(--jade)] px-4 py-1.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-8px_var(--coral)] transition hover:brightness-105"
          >
            知道了
          </button>
        </div>
      </div>
    </div>,
    romancePortalRoot()!,
  );
}
