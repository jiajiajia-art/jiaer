/* 剧情初遇名片：本回合第一次登场、还没结识的人物，在正文底部弹出一张名片，由玩家决定「结识」或「暂不结识」。
 * 状态只认 game.npcIntro / sim.metPeople（game/npcIntro）；这里只记下本次刚做过决定的人，好留一行回执。 */
import { useState } from "react"
import { useGame } from "../store/gameCtx"
import { introState, meetPerson, skipPerson } from "../game/npcIntro"
import {
  PLAYER_REF,
  REL_FIELDS,
  personGender,
  relationsOf,
} from "../game/relNet"
import type { GameState, Npc } from "../lib/types"
import { IconCheck } from "../lib/icons"
import { Avatar } from "./ui"
import { affiliationOf } from "./personFields"

const ageText = (a?: string) => {
  const t = a?.trim()
  return !t ? undefined : /^\d+$/.test(t) ? `${t} 岁` : t
}

/* 名片上的关系只列关系网里明确设定的（relationsOf），没有就不显示，绝不推断 */
function relationLine(g: GameState, id: string): string {
  const r = relationsOf(g, id)
  return REL_FIELDS.filter((f) => r[f].length)
    .map(
      (f) =>
        `${f} ${r[f].map((x) => (x.id === PLAYER_REF ? "你" : x.name)).join("、")}`,
    )
    .join(" · ")
}

function Card({
  n,
  g,
  busy,
  onDecide,
}: {
  n: Npc
  g: GameState
  busy: boolean
  onDecide: (how: "met" | "skip") => void
}) {
  const facts = [
    personGender(g, n.id),
    ageText(n.age),
    affiliationOf(n.identity),
  ].filter((x): x is string => !!x)
  const rel = relationLine(g, n.id)
  return (
    <article
      aria-label={`初遇 · ${n.name}`}
      className="ui-card animate-pop flex flex-col overflow-hidden"
    >
      <div className="flex items-start gap-3 px-3 pt-3">
        <Avatar
          src={n.avatar || undefined}
          name={n.name}
          size={52}
          editable={false}
        />
        <div className="min-w-0 flex-1">
          <p className="ui-title truncate font-serif">{n.name}</p>
          {n.identity && (
            <p className="truncate text-xs text-ink-soft">{n.identity}</p>
          )}
          {(facts.length > 0 || n.relation) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {facts.map((f) => (
                <span key={f} className="ui-chip">
                  {f}
                </span>
              ))}
              {n.relation && (
                <span className="ui-chip tone-coral">与你 · {n.relation}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {n.bio && (
        <p className="line-clamp-2 px-3 pt-2 text-xs leading-relaxed text-ink-soft">
          {n.bio}
        </p>
      )}
      {rel && (
        <p className="truncate px-3 pt-1 text-xs text-ink-soft">
          <span className="font-semibold text-ink">关系</span> {rel}
        </p>
      )}
      <div className="mt-auto flex items-center justify-end gap-1.5 px-3 pb-3 pt-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide("skip")}
          aria-label={`暂不结识${n.name}`}
          className="ui-btn ui-btn-ghost ui-btn-sm"
        >
          暂不结识
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide("met")}
          aria-label={`结识${n.name}`}
          className="ui-btn ui-btn-primary ui-btn-sm tone-coral"
        >
          结识
        </button>
      </div>
    </article>
  )
}

function Receipt({
  n,
  met,
  busy,
  onMeet,
}: {
  n: Npc
  met: boolean
  busy: boolean
  onMeet: () => void
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full border border-line/70 bg-paper/70 py-1 pl-1 pr-1.5 text-xs text-ink-soft"
    >
      <Avatar
        src={n.avatar || undefined}
        name={n.name}
        size={24}
        editable={false}
      />
      <span className="min-w-0 flex-1 truncate">
        {met ? (
          <>
            已结识 <b className="text-ink">{n.name}</b> · 已记入人脉
          </>
        ) : (
          <>
            暂不结识 <b className="text-ink">{n.name}</b> · 之后登场不再提醒
          </>
        )}
      </span>
      {met ? (
        <IconCheck aria-hidden className="mr-1 size-4 shrink-0 text-jade" />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onMeet}
          className="ui-btn ui-btn-ghost ui-btn-sm shrink-0"
        >
          改为结识
        </button>
      )}
    </div>
  )
}

export default function NewcomerCards({ ids }: { ids?: string[] }) {
  const { game, busy, patchGame } = useGame()
  const [decided, setDecided] = useState<string[]>([])
  if (!game || !ids?.length) return null
  const people = ids
    .map((id) => game.npcs.find((n) => n.id === id))
    .filter((n): n is Npc => !!n)
  const open = people.filter((n) => introState(game, n.id) === "pending")
  const done = people.filter(
    (n) => decided.includes(n.id) && introState(game, n.id) !== "pending",
  )
  if (!open.length && !done.length) return null
  const decide = (id: string, how: "met" | "skip") => {
    patchGame((g) => (how === "met" ? meetPerson(g, id) : skipPerson(g, id)))
    setDecided((d) => (d.includes(id) ? d : [...d, id]))
  }
  // 生成剧情时按钮禁用（busy）：回合落地以开局快照为准，生成期间做的决定会被覆盖
  return (
    <section aria-label="初遇人物名片" className="@container mt-3 space-y-2">
      {open.length > 0 && (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="ui-kicker">初 遇</span>
            <span className="text-xs text-ink-soft">
              {open.length > 1
                ? `剧情里来了 ${open.length} 位新面孔，要结识吗？`
                : "剧情里来了一位新面孔，要结识 TA 吗？"}
            </span>
          </p>
          <div className="grid gap-2 @xl:grid-cols-2">
            {open.map((n) => (
              <Card
                key={n.id}
                n={n}
                g={game}
                busy={busy}
                onDecide={(how) => decide(n.id, how)}
              />
            ))}
          </div>
        </>
      )}
      {done.map((n) => (
        <Receipt
          key={n.id}
          n={n}
          met={introState(game, n.id) === "met"}
          busy={busy}
          onMeet={() => decide(n.id, "met")}
        />
      ))}
    </section>
  )
}
