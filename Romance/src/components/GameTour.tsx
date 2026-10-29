import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { romancePortalRoot } from "../lib/romancePortalRoot"
import { loadGlobal, saveGlobal } from "../lib/saveScope"

/* 首次游玩引导：依次高亮世界页上的关键位置，每处一句话讲清用途。
 * 目标元素用 data-tour 标记；当前界面上看不到的步骤自动跳过（如正在看地图时没有场景光点）。
 * 看完或跳过后不再自动出现；菜单「玩法引导」派发 star:tour 事件可随时重看。 */

const KEY = "star.tour.world.v1"
interface Step {
  id: string
  title: string
  text: string
}
const STEPS: Step[] = [
  {
    id: "map",
    title: "外出",
    text: "点「外出」打开地图，再点图上的地点就能前往（换地点会扣行动点）；不想走了，点「返回此地」回到当前场景。",
  },
  {
    id: "loc",
    title: "你在哪儿",
    text: "地名条显示所在地点和营业状态。点一下展开这里的场景描述，再点收起。",
  },
  {
    id: "spots",
    title: "场景里能做的事",
    text: "图上的光点就是可以做的事：珊瑚色是踩点探索，带 的是剧情事件，其余是活动和物件。一行放不下时左右滑。",
  },
  {
    id: "story",
    title: "和 AI 一起推剧情",
    text: "剧情在这里一句一句出现，轻点继续读。读完会出现推荐选项，点一个就往下走；也可以在输入框里自己写行动或台词。",
  },
  {
    id: "ap",
    title: "行动点",
    text: "换地点、进剧情事件都会扣点。点数快用完，或者今天的事办完了，就该推进了。",
  },
  {
    id: "advance",
    title: "日程",
    text: "打开本周日程，排好要做的事，再推进一天或过完本周。时间往前走，行动点回满。",
  },
]

/** 同名标记可能有多处（横屏外壳盖在竖屏外壳之上）：取尺寸非零、且确实露在最上层的那一个 */
const pick = (id: string) => {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-tour="${id}"]`,
  )) {
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2))
    const y = Math.min(
      window.innerHeight - 1,
      Math.max(0, r.top + Math.min(r.height / 2, 20)),
    )
    const hit = document.elementFromPoint(x, y)
    if (hit && (el === hit || el.contains(hit))) return el
  }
  return null
}

export default function GameTour({ active }: { active: boolean }) {
  const [list, setList] = useState<Step[] | null>(null)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const els = useRef(new Map<string, HTMLElement>()) // 开始时选定的目标元素（遮罩出现后就无法再做「最上层」判断）

  const start = useCallback(() => {
    els.current.clear()
    for (const s of STEPS) {
      const el = pick(s.id)
      if (el) els.current.set(s.id, el)
    }
    const avail = STEPS.filter((s) => els.current.has(s.id))
    if (avail.length < 2) return false
    setI(0)
    setList(avail)
    return true
  }, [])
  const finish = useCallback(() => {
    saveGlobal(KEY, true)
    setList(null)
    setRect(null)
  }, [])

  // 首次进入世界页：等界面稳定后自动开始；当下没有可讲的位置就稍后再试
  useEffect(() => {
    if (!active || loadGlobal(KEY, false)) return
    let n = 0
    const t = window.setInterval(() => {
      if (start() || ++n > 10) window.clearInterval(t)
    }, 900)
    return () => window.clearInterval(t)
  }, [active, start])
  useEffect(() => {
    const h = () => {
      start()
    }
    window.addEventListener("star:tour", h)
    return () => window.removeEventListener("star:tour", h)
  }, [start])

  const step = list?.[i]
  const measure = useCallback(() => {
    if (!step) return
    const el = els.current.get(step.id)
    const r = el?.isConnected ? el.getBoundingClientRect() : null
    setRect(r && r.width > 0 ? r : null)
  }, [step])
  useLayoutEffect(() => {
    if (!step) return
    els.current
      .get(step.id)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
    measure()
    nextBtn.current?.focus()
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    const t = window.setInterval(measure, 400) // 跟随动画 / 布局变化
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
      window.clearInterval(t)
    }
  }, [step, measure])

  useEffect(() => {
    if (!list) return
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish()
      else if (e.key === "ArrowRight")
        setI((v) => Math.min(list.length - 1, v + 1))
      else if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [list, finish])

  if (!list || !step) return null
  const last = i === list.length - 1
  const vw = window.innerWidth,
    vh = window.innerHeight
  const pad = 6
  const hole = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
  // 说明卡放在高亮区下方；下方放不下就放上方；横向夹在屏幕内
  const cardW = Math.min(320, vw - 24)
  const below = !hole || vh - (hole.top + hole.height) > 200
  const cardLeft = hole
    ? Math.max(
        12,
        Math.min(vw - cardW - 12, hole.left + hole.width / 2 - cardW / 2),
      )
    : (vw - cardW) / 2
  const cardPos = !hole
    ? { top: vh / 2 - 90 }
    : below
      ? { top: Math.min(vh - 190, hole.top + hole.height + 12) }
      : { bottom: Math.max(12, vh - hole.top + 12) }

  return createPortal(
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="玩法引导"
    >
      {/* 拦截点击：引导期间不误触底下的按钮 */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/85 transition-all duration-300 ease-out"
          style={{
            ...hole,
            boxShadow:
              "0 0 0 9999px rgba(24,16,44,0.62), 0 0 24px 4px rgba(255,255,255,0.25)",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-[rgba(24,16,44,0.62)]"
        />
      )}
      <div
        className="absolute animate-pop rounded-2xl border border-white/60 bg-paper p-4 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.45)]"
        style={{ left: cardLeft, width: cardW, ...cardPos }}
      >
        <div className="flex items-center gap-2">
          <span className="font-serif text-[12px] font-black tabular-nums text-coral">
            {i + 1}
            <span className="text-ink-soft/60"> / {list.length}</span>
          </span>
          <span className="flex flex-1 gap-1" aria-hidden>
            {list.map((_, n) => (
              <span
                key={n}
                className={`h-1 flex-1 rounded-full transition ${
                  n <= i ? "bg-[var(--coral)]" : "bg-ink/10"
                }`}
              />
            ))}
          </span>
        </div>
        <p className="mt-2.5 text-[15px] font-bold text-ink">{step.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink/80">
          {step.text}
        </p>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={finish}
            className="rounded-full px-2 py-1 text-[12px] text-ink-soft transition hover:text-ink"
          >
            跳过
          </button>
          <span className="flex-1" />
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-ink/30"
            >
              上一步
            </button>
          )}
          <button
            ref={nextBtn}
            type="button"
            onClick={() => (last ? finish() : setI(i + 1))}
            className="rounded-full bg-gradient-to-br from-[var(--coral)] to-[var(--jade)] px-4 py-1.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-8px_var(--coral)] transition hover:brightness-105"
          >
            {last ? "开始游玩" : "下一步"}
          </button>
        </div>
      </div>
    </div>,
    romancePortalRoot()!,
  )
}
