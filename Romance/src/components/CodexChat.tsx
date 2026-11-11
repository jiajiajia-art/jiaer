import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconSend,
  IconStop,
  IconUndo,
} from "../lib/icons"

/* Codex 风格的对话式生成组件（装扮封面 / 开场页样式共用）：
 * 助手消息是无气泡的正文，用户消息是浅灰气泡；过程用「思考中 · 计时」状态行；
 * 每次改动给一张可折叠的变更卡（逐项 改前 → 改后，可撤销）；底部一体化输入框 + 工具条 + 圆形发送键。 */

export type ChatChange = {
  label: string
  from?: string
  to?: string
  kind?: "add" | "edit" | "del"
}

/** 对话线程：自动滚到底；没有消息时显示 empty */
export function ChatThread({
  children,
  empty,
  tick,
  className = "",
}: {
  children: ReactNode
  empty?: ReactNode
  tick: unknown
  className?: string
}) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" })
  }, [tick])
  return (
    <div
      className={`overflow-y-auto overscroll-contain px-1 [scrollbar-width:thin] ${className}`}
      role="log"
      aria-live="polite"
    >
      {empty ?? <div className="space-y-4 py-2">{children}</div>}
      <div ref={end} />
    </div>
  )
}

export function UserMsg({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-[18px] bg-ink/[0.06] px-3.5 py-2 text-[13px] leading-relaxed text-ink">
        {text}
      </p>
    </div>
  )
}

export function AssistantMsg({
  text,
  failed,
  children,
}: {
  text?: string
  failed?: boolean
  children?: ReactNode
}) {
  return (
    <div className="space-y-2 pr-4">
      {text && (
        <p
          className={`whitespace-pre-wrap text-[13px] leading-[1.7] ${
            failed ? "text-danger" : "text-ink"
          }`}
        >
          {text}
        </p>
      )}
      {children}
    </div>
  )
}

const secs = (ms: number) =>
  ms < 60_000
    ? `${Math.max(1, Math.round(ms / 1000))}s`
    : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`

/** 过程状态行：运行中转圈 + 实时计时；结束后显示用时 */
export function WorkLine({
  running,
  label,
  start,
  ms,
}: {
  running: boolean
  label: string
  start?: number
  ms?: number
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  const el = running && start ? Date.now() - start : ms
  return (
    <p className="flex items-center gap-2 text-[12px] text-ink-soft">
      {running ? (
        <span
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-ink-soft/30 border-t-ink-soft"
          aria-hidden
        />
      ) : (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-soft/50"
          aria-hidden
        />
      )}
      <span className={running ? "animate-pulse" : ""}>{label}</span>
      {el !== undefined && (
        <span className="tabular-nums opacity-70">{secs(el)}</span>
      )}
    </p>
  )
}

/** 流式输出中的正文（尾部光标） */
export function StreamText({ text }: { text: string }) {
  return text ? (
    <p className="whitespace-pre-wrap pr-4 text-[13px] leading-[1.7] text-ink">
      {text}
      <span
        className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-ink/60"
        aria-hidden
      />
    </p>
  ) : null
}

const MARK = {
  add: ["+", "text-jade"],
  edit: ["~", "text-gold"],
  del: ["−", "text-danger"],
} as const

/** 变更卡：标题行（已修改 N 项 · +a ~b −c）可折叠，展开逐项 改前 → 改后；可撤销 / 自定义操作 */
export function ChangeCard({
  title,
  changes,
  onUndo,
  undone,
  action,
  defaultOpen,
}: {
  title: string
  changes: ChatChange[]
  onUndo?: () => void
  undone?: boolean
  action?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const n = { add: 0, edit: 0, del: 0 }
  for (const c of changes) n[c.kind ?? "edit"]++
  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-paper ${
        undone ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          disabled={!changes.length}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <IconCheck width={14} height={14} className="shrink-0 text-jade" />
          <span className="truncate text-[12.5px] font-semibold text-ink">
            {undone ? `${title}（已撤销）` : title}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums">
            {n.add > 0 && <span className="text-jade">+{n.add} </span>}
            {n.edit > 0 && <span className="text-gold">~{n.edit} </span>}
            {n.del > 0 && <span className="text-danger">−{n.del}</span>}
          </span>
          {!!changes.length && (
            <IconChevronDown
              width={14}
              height={14}
              className={`shrink-0 text-ink-soft transition ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>
        {action}
        {onUndo && !undone && (
          <button
            type="button"
            onClick={onUndo}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            <IconUndo width={13} height={13} />
            撤销
          </button>
        )}
      </div>
      {open && (
        <ul className="border-t border-line bg-paper-2/60 px-3 py-1.5 font-mono text-[11.5px] leading-[1.8]">
          {changes.map((c, i) => {
            const [m, cls] = MARK[c.kind ?? "edit"]
            return (
              <li key={i} className="flex min-w-0 items-baseline gap-2">
                <span className={`w-3 shrink-0 text-center ${cls}`}>{m}</span>
                <span className="w-[5.5em] shrink-0 truncate text-ink-soft">
                  {c.label}
                </span>
                {c.from !== undefined || c.to !== undefined ? (
                  <span className="min-w-0 truncate text-ink">
                    {c.from !== undefined && (
                      <span className="text-ink-soft line-through decoration-ink-soft/40">
                        {c.from}
                      </span>
                    )}
                    {c.from !== undefined && c.to !== undefined && (
                      <span className="px-1 text-ink-soft">→</span>
                    )}
                    {c.to !== undefined && <span>{c.to}</span>}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** 空状态：标题 + 建议列表（点一下填进输入框） */
export function Suggestions({
  title,
  hint,
  items,
  onPick,
}: {
  title: string
  hint?: string
  items: [string, string][]
  onPick: (prompt: string) => void
}) {
  return (
    <div className="px-1 py-3">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-soft">{hint}</p>}
      <ul className="ui-list mt-3">
        {items.map(([l, p]) => (
          <li key={l}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="group flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-jade/5"
            >
              <span className="w-[4.5em] shrink-0 text-[12.5px] font-semibold text-ink transition group-hover:text-jade">
                {l}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft group-hover:text-ink">
                {p}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 轻量弹出菜单（点外面关闭） */
function Pop({
  trigger,
  children,
  align = "left",
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode
  children: (close: () => void) => ReactNode
  align?: "left" | "right"
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", h)
    document.addEventListener("keydown", k)
    return () => {
      document.removeEventListener("mousedown", h)
      document.removeEventListener("keydown", k)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          className={`absolute bottom-[calc(100%+6px)] z-30 min-w-[13rem] max-w-[18rem] overflow-hidden rounded-xl border border-line bg-paper p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
export const MenuItem = ({
  children,
  onClick,
  active,
  hint,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  hint?: string
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-ink transition hover:bg-ink/[0.05]"
  >
    <span className="w-3.5 shrink-0">
      {active && <IconCheck width={13} height={13} />}
    </span>
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {hint && (
      <span className="shrink-0 text-[10.5px] text-ink-soft">{hint}</span>
    )}
  </button>
)
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold tracking-wide text-ink-soft">
    {children}
  </p>
)
export const MenuSep = () => <div className="my-1 h-px bg-line" />

/** 线路 / 模型选择胶囊：● 接口 · 模型 ▾；菜单里切模型，底部「线路设置…」 */
export function LinePill({
  ok,
  host,
  model,
  models,
  onModel,
  onSettings,
  badge,
}: {
  ok: boolean
  host: string
  model: string
  models: string[]
  onModel: (m: string) => void
  onSettings: () => void
  badge?: string
}) {
  return (
    <Pop
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`flex max-w-[15rem] items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] transition ${
            open
              ? "bg-ink/[0.07] text-ink"
              : "text-ink-soft hover:bg-ink/[0.05] hover:text-ink"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              ok ? "bg-jade" : "bg-ink-soft/40"
            }`}
            aria-hidden
          />
          <span className="truncate">{ok ? model || host : "接入线路"}</span>
          <IconChevronDown width={12} height={12} className="shrink-0" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>
            线路 · {ok ? host : "未接入"}
            {badge ? ` · ${badge}` : ""}
          </MenuLabel>
          {ok &&
            models.map((m) => (
              <MenuItem
                key={m}
                active={m === model}
                onClick={() => {
                  onModel(m)
                  close()
                }}
              >
                {m}
              </MenuItem>
            ))}
          {ok && <MenuSep />}
          <MenuItem
            onClick={() => {
              onSettings()
              close()
            }}
          >
            {ok ? "线路设置…" : "接入线路…"}
          </MenuItem>
        </>
      )}
    </Pop>
  )
}

/** 「＋」菜单：快捷提示 */
export function PlusMenu({
  title,
  items,
  onPick,
  disabled,
}: {
  title: string
  items: [string, string][]
  onPick: (prompt: string) => void
  disabled?: boolean
}) {
  return (
    <Pop
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={title}
          aria-expanded={open}
          className={`grid h-7 w-7 place-items-center rounded-full transition disabled:opacity-40 ${
            open
              ? "bg-ink/[0.07] text-ink"
              : "text-ink-soft hover:bg-ink/[0.05] hover:text-ink"
          }`}
        >
          <IconPlus width={16} height={16} />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{title}</MenuLabel>
          {items.map(([l, p]) => (
            <MenuItem
              key={l}
              onClick={() => {
                onPick(p)
                close()
              }}
            >
              {l}
            </MenuItem>
          ))}
        </>
      )}
    </Pop>
  )
}

/** 一体化输入框：自适应高度；Enter 发送、Shift+Enter 换行（输入法组字时不发送）；运行中发送键变停止键 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  canStop = true,
  placeholder,
  tools,
  right,
  disabled,
  compact,
  /** 收起态：单行输入条，工具与发送键同一行 */
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop?: () => void
  busy?: boolean
  canStop?: boolean
  placeholder: string
  tools?: ReactNode
  right?: ReactNode
  disabled?: boolean
  compact?: boolean
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const maxH = compact ? 96 : 180
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
  }, [value, maxH])
  const can = !!value.trim() && !busy && !disabled
  const field = (
    <textarea
      ref={ta}
      value={value}
      rows={compact ? 1 : 2}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.nativeEvent.isComposing &&
          e.keyCode !== 229
        ) {
          e.preventDefault()
          if (can) onSend()
        }
      }}
      placeholder={placeholder}
      aria-label="输入要求"
      style={{ maxHeight: maxH }}
      className={`block w-full resize-none bg-transparent text-[13px] leading-relaxed text-ink placeholder:text-ink-soft/60 focus:outline-none disabled:opacity-60 ${
        compact ? "min-w-0 flex-1 px-1 py-[5px]" : "px-3.5 pb-1 pt-3"
      }`}
    />
  )
  // 功能注释：发送/停止用独立酒红实心圆，避开 .codex-ui 把 --jade/--coral 洗成灰墨后白底白字的丑钮
  const action = busy ? (
    <button
      type="button"
      onClick={onStop}
      disabled={!canStop}
      aria-label="停止生成"
      className="codex-composer-send size-8 min-h-0 shrink-0"
    >
      <IconStop width={13} height={13} />
    </button>
  ) : (
    <button
      type="button"
      onClick={onSend}
      disabled={!can}
      aria-label="发送"
      className="codex-composer-send size-8 min-h-0 shrink-0"
    >
      <IconSend width={15} height={15} />
    </button>
  )
  const shell =
    "rounded-[var(--radius-ui-lg)] border border-line bg-paper shadow-[var(--shadow-ui)] transition focus-within:border-jade focus-within:ring-3 focus-within:ring-jade/15"
  if (compact)
    return (
      <div className={`flex items-end gap-1 p-1.5 ${shell}`}>
        {tools}
        {field}
        {right}
        {action}
      </div>
    )
  return (
    <div className={shell}>
      {field}
      <div className="flex items-center gap-1 px-2 pb-2">
        {tools}
        <span className="flex-1" />
        {right}
        {action}
      </div>
    </div>
  )
}

/** 「预览 / 对话」分段切换：编辑器里凡能 AI 对话的生成位，统一用它在实时预览与对话间切换 */
export type GenView = "preview" | "chat"
export function ViewSwitch({
  value,
  onChange,
  labels = { preview: "实时预览", chat: "AI 对话" },
}: {
  value: GenView
  onChange: (v: GenView) => void
  labels?: Record<GenView, string>
}) {
  return (
    <div role="tablist" aria-label="预览与对话" className="flex rounded-full border border-line bg-paper p-1">
      {(["preview", "chat"] as const).map((k) => (
        <button
          key={k}
          role="tab"
          type="button"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
            value === k ? "bg-coral text-white shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {labels[k]}
        </button>
      ))}
    </div>
  )
}

/** 功能注释：计费提示须清晰可读；platform = 运营文案模型+积分，personal = 创作者本机 AI 配置。
 * 用 jade/coral 软底对齐页签与链接触感；避免 bg-paper / 浅金在暗色壳里糊成白胶囊看不清字。 */
export function AiModelBillingBadge({ mode = "personal", className = "" }: { mode?: "personal" | "platform"; className?: string }) {
  return (
    <span
      role="note"
      className={`inline-flex items-center rounded-full bg-jade/15 px-2.5 py-1 text-[12.5px] font-bold leading-snug text-coral ring-1 ring-jade/35 ${className}`.trim()}
    >
      {mode === "platform" ? "使用平台文案模型 · 按积分计费" : "使用你接入的模型 · 按接口计费"}
    </span>
  )
}
