import NpcProfile from "./NpcProfile";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { Modal, Chip, affinityLevel } from "./ui";
import { LOCATIONS, TRAITS } from "../game/data";
import { ALL_ROOMS, locOf, roomStatus } from "../game/mud";
import { itemsOfRoom, type RoomItem } from "../worlds/star2005/content";

/* ═══ 纪事实体高亮：人物靛 / 地点青 / 物品金 / 特质朱，皆可点选（只读详情，不自动移动/对话） ═══
 * 名录取自内容池（LOCATIONS / 各房间物品 / TRAITS）与当前存档人物（game.npcs）。 */

type EntityType = "person" | "loc" | "item" | "trait";
type EntityRef = { type: EntityType; id: string };

const TYPE_STYLE: Record<EntityType, { color: string }> = {
  person: { color: "var(--char)" },
  loc: { color: "var(--jade)" },
  item: { color: "var(--gold)" },
  trait: { color: "var(--coral)" },
};

/* 静态名录（地点/物品/特质在内容池里恒定） */
const LOC_ENTRIES = LOCATIONS.filter((l) => l.name.length >= 2).map((l) => ({ name: l.name, type: "loc" as const, id: l.id }));
const ITEM_MAP = new Map<string, RoomItem>();
for (const r of ALL_ROOMS) for (const it of itemsOfRoom(r)) if (!ITEM_MAP.has(it.id)) ITEM_MAP.set(it.id, it);
const ITEM_ENTRIES = [...ITEM_MAP.values()].filter((it) => it.name.length >= 2).map((it) => ({ name: it.name, type: "item" as const, id: it.id }));
const TRAIT_ENTRIES = TRAITS.filter((t) => t.name.length >= 2).map((t) => ({ name: t.name, type: "trait" as const, id: t.id }));

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ── 全局实体详情弹层的上下文 ── */
const EntityCtx = createContext<(ref: EntityRef) => void>(() => {});

export function EntityProvider({ children }: { children: ReactNode }) {
  const { game } = useGame();
  const [ref, setRef] = useState<EntityRef | null>(null);

  return (
    <EntityCtx.Provider value={setRef}>
      {children}
      {ref && game && <EntityDetail refr={ref} onClose={() => setRef(null)} />}
    </EntityCtx.Provider>
  );
}

function EntityDetail({ refr, onClose }: { refr: EntityRef; onClose: () => void }) {
  const { game } = useGame();
  if (!game) return null;
  const s = game.sim;

  if (refr.type === "person") {
    return <NpcProfile pid={refr.id} onClose={onClose} />;
  }
  if (refr.type === "loc") {
    const loc = locOf(refr.id);
    if (!loc) return null;
    const rs = s ? roomStatus(s, refr.id) : null;
    const lit = (s?.visited ?? []).includes(refr.id);
    return (
      <Modal title={loc.name} onClose={onClose}>
        <div className="space-y-2.5">
          {rs && <Chip tone={rs.kind === "open" ? "jade" : rs.kind === "event" ? "coral" : "gold"}>{rs.label}</Chip>}
          <p className="text-[13px] leading-relaxed text-ink/85">{loc.func}</p>
          <p className="text-[12px] text-jade">今日可做 · {loc.action}</p>
          <p className="text-[11px] text-ink-soft">
            {lit ? "此地已在你舆图上点亮，可从「出口」规划前往。" : "尚未探索——需先循出口走到才会点亮。"}
          </p>
        </div>
      </Modal>
    );
  }
  if (refr.type === "item") {
    const it = ITEM_MAP.get(refr.id);
    if (!it) return null;
    return (
      <Modal title={it.name} onClose={onClose}>
        <p className="story-prose text-[13px] leading-relaxed text-ink/85">{it.desc}</p>
      </Modal>
    );
  }
  const t = TRAITS.find((x) => x.id === refr.id);
  if (!t) return null;
  return (
    <Modal title={t.name} onClose={onClose}>
      <div className="space-y-2">
        <Chip tone="coral">{t.tag}</Chip>
        <p className="text-[13px] leading-relaxed text-ink/85">{t.desc}</p>
      </div>
    </Modal>
  );
}

export function useOpenEntity() {
  return useContext(EntityCtx);
}

/* 把一段文字按实体名录切分，命中处渲染成带色+下划线的可点选 token。 */
export function EntityText({ text, className }: { text: string; className?: string }) {
  const { game } = useGame();
  const open = useOpenEntity();

  const { re, lookup } = useMemo(() => {
    const people = (game?.npcs ?? []).filter((n) => n.name.length >= 2).map((n) => ({ name: n.name, type: "person" as const, id: n.id }));
    const all = [...people, ...LOC_ENTRIES, ...ITEM_ENTRIES, ...TRAIT_ENTRIES];
    // 同名去重（人物优先），并按长度降序，保证最长匹配优先
    const map = new Map<string, EntityRef>();
    for (const e of all) if (!map.has(e.name)) map.set(e.name, { type: e.type, id: e.id });
    const names = [...map.keys()].sort((a, b) => b.length - a.length);
    if (names.length === 0) return { re: null as RegExp | null, lookup: map };
    return { re: new RegExp(names.map(escapeRe).join("|"), "g"), lookup: map };
  }, [game?.npcs]);

  if (!re) return <span className={className}>{text}</span>;

  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    const name = m[0];
    const ref = lookup.get(name);
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (ref) {
      const style = TYPE_STYLE[ref.type];
      nodes.push(
        <button
          key={key++}
          onClick={() => open(ref)}
          className="font-medium underline decoration-dotted underline-offset-2 transition hover:brightness-110"
          style={{ color: style.color, minHeight: 0, padding: 0, lineHeight: "inherit", verticalAlign: "baseline" }}
        >
          {name}
        </button>,
      );
    } else {
      nodes.push(name);
    }
    last = m.index + name.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <span className={className}>{nodes}</span>;
}
