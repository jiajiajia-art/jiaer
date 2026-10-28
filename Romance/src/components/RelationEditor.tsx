/* 人物关系网编辑器（「人物」编辑器 · 关系网分页）：只记明确设定的关系，不做任何推断。
 * 系统关系（主角的家人与恋人、出生的孩子、圈内艺人生态）只读；其余关系整体写回 game.relNet（game/relNet 是唯一入口）。
 * 一对人物只有一条关系，两边档案同时生效；备注是 TA 这一侧的称呼（「其他」的备注两边都显示）。 */
import { useEffect, useRef, useState } from "react"
import { useGame } from "../store/gameCtx"
import {
  PLAYER_REF,
  REL_FIELDS,
  REL_ROW_LABEL,
  editableRows,
  lockedRefs,
  relationsOf,
  withRows,
  type RelRef,
  type RelRow,
  type RelRowKind,
} from "../game/relNet"
import type { GameState, Npc } from "../lib/types"
import { IconClose, IconPlus } from "../lib/icons"

const KINDS: RelRowKind[] = ["partner", "ex", "parent", "child", "other"]
const NOTE_HINT: Record<RelRowKind, string> = {
  partner: "称呼（选填），如 丈夫、未婚妻",
  ex: "说明（选填），如 初恋、前妻",
  parent: "称呼（选填），如 养母、继父",
  child: "称呼（选填），如 长女、养子",
  other: "写明关系，如 兄妹、师徒、闺蜜",
}
const NOTE_MAX = 24

interface Draft {
  rows: RelRow[]
  noParents: boolean
}
const draftOf = (g: GameState, pid: string): Draft => ({
  rows: editableRows(g, pid),
  noParents: relationsOf(g, pid).noParents,
})
// 比较用：没选人物的行不算改动；有父母时「明确没有父母」自动失效
const keyOf = (d: Draft) => {
  const rows = d.rows.filter((r) => r.id)
  return JSON.stringify([
    rows.map((r) => [r.kind, r.id, r.note?.trim() ?? ""]),
    d.noParents && !rows.some((r) => r.kind === "parent"),
  ])
}
// 指向主角的系统关系备注形如「你 · 女儿」：显示成「你（女儿）」
const refText = (r: RelRef) => {
  const me = r.id === PLAYER_REF
  const note = (
    me ? (r.note ?? "").replace(/^你\s*(·\s*)?/, "") : (r.note ?? "")
  ).trim()
  return `${me ? "你" : r.name}${note ? `（${note}）` : ""}`
}

export default function RelationEditor({ npc }: { npc: Npc }) {
  const { game, patchGame } = useGame()
  const g = game!
  // 存档里的最新关系：刚保存、在别人的档案里改了与 TA 的关系、剧情新人物认了亲，都会变
  const live = draftOf(g, npc.id)
  // 只有玩家动过手才有草稿（edit）；没动过就一直显示存档里的最新关系，不会拿旧快照覆盖
  const [edit, setEdit] = useState<Draft | null>(null)
  const draft = edit ?? live
  const dirty = edit !== null && keyOf(edit) !== keyOf(live)
  const [saved, setSaved] = useState(false)
  const commit = (d: Draft) =>
    patchGame((latest) => ({
      ...latest,
      relNet: withRows(latest, npc.id, d.rows, d.noParents),
    }))

  // 切换人物 / 分页、关闭弹窗时，未保存的修改自动保存（与「人设」同一规则）
  const pending = useRef<Draft | null>(null)
  pending.current = dirty ? edit : null
  useEffect(
    () => () => {
      if (pending.current) commit(pending.current)
    },
    [],
  ) // eslint-disable-line react-hooks/exhaustive-deps

  const locked = lockedRefs(g, npc.id)
  const lockedIds = new Set(locked.map(([, r]) => r.id))
  const others = g.npcs.filter((n) => n.id !== npc.id && !lockedIds.has(n.id))
  const nameOf = (id: string) => g.npcs.find((n) => n.id === id)?.name ?? ""
  const used = new Set(draft.rows.map((r) => r.id).filter(Boolean))
  const hasParent =
    locked.some(([f]) => f === "父母") ||
    draft.rows.some((r) => r.kind === "parent" && r.id)
  const incomplete = draft.rows.filter((r) => !r.id).length

  const change = (fn: (d: Draft) => Draft) => setEdit((e) => fn(e ?? live))
  const setRow = (i: number, patch: Partial<RelRow>) =>
    change((d) => ({
      ...d,
      rows: d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }))
  const addRow = (kind: RelRowKind) =>
    change((d) => ({ ...d, rows: [...d.rows, { kind, id: "" }] }))
  const removeRow = (i: number) =>
    change((d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }))
  const save = () => {
    commit(draft)
    setEdit(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  // AI 会读到的关系（与人脉详情、角色提示词同一份 relationsOf）
  const preview = relationsOf(
    { ...g, relNet: withRows(g, npc.id, draft.rows, draft.noParents) },
    npc.id,
  )
  const parentsText = preview.父母.length
    ? preview.父母.map(refText).join("、")
    : preview.noParents
      ? "没有（已明确设定）"
      : "未知（未设定）"

  const summaryRows: [string, string][] = [
    ["父母", parentsText],
    ...REL_FIELDS.filter((f) => f !== "父母" && preview[f].length).map(
      (f) => [f, preview[f].map(refText).join("、")] as [string, string],
    ),
  ]
  const Head = ({ t, sub, n }: { t: string; sub?: string; n?: number }) => (
    <div className="mb-2.5 flex items-baseline gap-2">
      <h4 className="text-sm font-semibold text-ink">{t}</h4>
      {n !== undefined && (
        <span className="rounded-full bg-jade/10 px-1.5 text-[11px] font-medium text-jade">{n}</span>
      )}
      {sub && <span className="min-w-0 truncate text-[11px] text-ink-soft">{sub}</span>}
    </div>
  )
  const card = "rounded-2xl border border-line bg-paper/60 p-3.5"

  return (
    <div className="@container space-y-3">
      <details className="group rounded-xl bg-jade/6 px-3 py-2 text-xs text-ink-soft">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-jade">
          <span className="grid size-4 place-items-center rounded-full bg-jade/15 text-[10px]">i</span>
          只有明确设定的关系才算数
          <span className="ml-auto text-[11px] font-normal text-ink-soft group-open:hidden">展开说明</span>
        </summary>
        <p className="mt-1.5 leading-relaxed">
          AI 不会按姓氏、称谓或年龄替 {npc.name} 认亲，没设定的父母一律显示「未知」。关系两边同时生效——把某人设为 TA 的父母，对方档案里就会出现子女 {npc.name}。
        </p>
      </details>

      {locked.length > 0 && (
        <section className={card}>
          <Head t="系统关系" sub="由家庭、恋爱与圈内生态维护 · 只读" n={locked.length} />
          <ul className="flex flex-wrap gap-2">
            {locked.map(([f, r], i) => (
              <li
                key={`${f}-${r.id}-${i}`}
                className="flex items-center gap-2 rounded-full border border-line bg-paper-2 py-1 pl-1 pr-3 text-sm"
              >
                <span className="grid size-7 place-items-center rounded-full bg-jade/12 text-xs font-semibold text-jade">
                  {r.id === PLAYER_REF ? "你" : r.name.slice(0, 1)}
                </span>
                <span className="text-ink">{refText(r)}</span>
                <span className="text-[11px] text-ink-soft">· {f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <Head t="明确设定的关系" sub={`每行读作「对方是 ${npc.name} 的 ××」`} n={draft.rows.filter((r) => r.id).length} />
        {draft.rows.length ? (
          <ul className="ui-list">
            {draft.rows.map((r, i) => {
              const other = r.id ? nameOf(r.id) : ""
              return (
                <li key={i} className="flex items-start gap-2 px-3 py-2.5">
                  <div className="grid min-w-0 flex-1 gap-1.5 @lg:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="flex min-w-0 gap-1.5 @lg:contents">
                      <select
                        aria-label="关系"
                        value={r.kind}
                        onChange={(e) =>
                          setRow(i, { kind: e.target.value as RelRowKind })
                        }
                        className="ui-input w-24 shrink-0"
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {REL_ROW_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="对方"
                        value={r.id}
                        onChange={(e) => setRow(i, { id: e.target.value })}
                        className={`ui-input min-w-0 flex-1 ${
                          r.id ? "" : "text-ink-soft"
                        }`}
                      >
                        <option value="">选择人物</option>
                        {others
                          .filter((n) => n.id === r.id || !used.has(n.id))
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name}
                              {n.identity
                                ? ` · ${n.identity.slice(0, 14)}`
                                : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    <input
                      aria-label="备注"
                      value={r.note ?? ""}
                      maxLength={NOTE_MAX}
                      onChange={(e) => setRow(i, { note: e.target.value })}
                      placeholder={NOTE_HINT[r.kind]}
                      className="ui-input"
                    />
                    {other && (r.kind === "parent" || r.kind === "child") && (
                      <p className="text-xs text-ink-soft @lg:col-span-3">
                        {other} 的档案里会显示：
                        {r.kind === "parent" ? "子女" : "父母"} · {npc.name}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={`删除这条关系${other ? `（${other}）` : ""}`}
                    className="ui-icon-btn"
                  >
                    <IconClose aria-hidden className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-line px-3 py-4 text-center">
            <p className="text-sm text-ink">还没有设定任何关系</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">没设定的伴侣、前任与亲属，AI 一律当作未知，不会自行编造</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-3">
          <span className="mr-0.5 text-[11px] text-ink-soft">添加关系</span>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!others.length}
              onClick={() => addRow(k)}
              className="ui-chip border-dashed"
            >
              <IconPlus aria-hidden className="size-3" />
              {REL_ROW_LABEL[k]}
            </button>
          ))}
          {!others.length && (
            <span className="text-xs text-ink-soft">
              花名册里还没有其他人物
            </span>
          )}
        </div>
        {incomplete > 0 && (
          <p className="mt-1.5 text-xs text-coral">
            有 {incomplete} 行还没选人物，保存时会忽略。
          </p>
        )}
      </section>

      <section className={card}>
        <Head t="父母" />
        {hasParent ? (
          <p className="text-sm text-ink">{preview.父母.map(refText).join("、") || "—"}</p>
        ) : (
          <div role="group" aria-label="父母" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-paper-2 p-1">
            {([
              [false, "未知（未设定）"],
              [true, "明确没有父母"],
            ] as const).map(([v, l]) => (
              <button
                key={l}
                type="button"
                aria-pressed={draft.noParents === v}
                onClick={() => change((d) => ({ ...d, noParents: v }))}
                className={`rounded-full py-1.5 text-xs font-medium transition ${
                  draft.noParents === v ? "bg-jade text-white shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-gradient-to-br from-jade/10 to-jade/3 p-3.5">
        <p className="mb-2 text-xs font-semibold text-jade">AI 会这样理解 TA 的关系</p>
        <dl className="space-y-1.5 text-sm">
          {summaryRows.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-10 shrink-0 text-xs leading-5 text-ink-soft">{k}</dt>
              <dd className="min-w-0 flex-1 text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="sticky bottom-0 -mx-3 -mb-3 flex items-center gap-2 border-t border-line bg-paper-2/95 px-3 py-3 backdrop-blur sm:static sm:m-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={() => setEdit(null)}
          disabled={!dirty}
          className="ui-btn shrink-0"
        >
          撤销修改
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className="ui-btn ui-btn-primary flex-1"
        >
          {saved ? "已保存" : dirty ? "保存关系" : "已是最新"}
        </button>
      </div>
    </div>
  )
}
