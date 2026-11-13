import PersonProfile from "./PersonProfile";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { Modal, Chip } from "./ui";
import { exitsOf, locOf, mobsHere, roomBgOf, roomStatus } from "../game/mud";
import { spotBackground, spotName } from "../game/mapedits";
import { getWorldItems, getWorldLocations, getWorldMap, worldItemById } from "../mods/registry";

/* ═══ 纪事实体高亮：人物靛 / 地点青 / 物品金，皆可点选（只读详情，不自动移动/对话） ═══
 * 名录取自内容池（LOCATIONS / 各房间物品 ）与当前存档人物（game.npcs）。 */

type EntityType = "person" | "loc" | "item";
type EntityRef = { type: EntityType; id: string };

const TYPE_STYLE: Record<EntityType, { color: string }> = {
  person: { color: "var(--char)" },
  loc: { color: "var(--jade)" },
  item: { color: "var(--gold)" },
};

/* 静态名录（地点/物品在内容池里恒定） */
/* 地点 / 物品随生效世界变化：按需读取，不在模块加载期求值 */
/** 功能注释：AI 脏数据常缺 name；禁止 .name.length 炸预览/剧情 EntityText useMemo */
const namedEnough = (name: unknown): name is string => typeof name === "string" && name.length >= 2;
const locEntries = () => getWorldLocations().filter((l) => namedEnough(l.name)).map((l) => ({ name: l.name, type: "loc" as const, id: l.id }));
const itemEntries = () => getWorldItems().filter((it) => namedEnough(it.name)).map((it) => ({ name: it.name, type: "item" as const, id: it.id }));

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
    const n = game.npcs.find((x) => x.id === refr.id);
    if (!n) return null;
    const known = (s?.metPeople ?? []).includes(n.id) || n.affinity !== 0;
    return (
      <Modal panelClassName="ui-dialog-game" title="人物档案" onClose={onClose}>
        <PersonProfile pid={n.id} known={known} />
      </Modal>
    );
  }
  if (refr.type === "loc") return <LocDetail id={refr.id} onClose={onClose} />;
  if (refr.type === "item") {
    const it = worldItemById(refr.id);
    if (!it) return null;
    return (
      <Modal panelClassName="ui-dialog-game" title={it.name} onClose={onClose}>
        <p className="story-prose text-[13px] leading-relaxed text-ink/85">{it.desc}</p>
      </Modal>
    );
  }
  return null;
}

/* 地点详情：实景横幅 + 状态 · 功能标签 · 今日可做（行动名 + 效果拆成胶囊）· 此刻在场 · 关键人物线索 · 相邻出口 · 舆图点亮状态 */
function LocDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { game } = useGame();
  const open = useOpenEntity();
  const loc = locOf(id);
  if (!loc || !game) return null;
  const s = game.sim;
  const rs = s ? roomStatus(s, id) : null;
  const lit = (s?.visited ?? []).includes(id);
  const here = s?.room === id;
  const map = getWorldMap();
  // 功能注释：横幅取图与场景 LocationHero 同一优先级——地图覆写背景 → 地点自带背景 → 旧舆图 photos → 默认图；都没有才是渐变占位
  const photo = spotBackground(game, id) || roomBgOf(id) || map.photos?.[id] || map.defaultPhoto;
  const title = spotName(game, id) ?? loc.name;
  const funcs = (loc.func ?? "").split(/\s*[·・|/]\s*/).map((x) => x.trim()).filter(Boolean);
  // 「深度休息：行动力 +40、压力 -12」→ 行动名 + 效果列表
  const [actName, actFx] = (() => {
    const a = (loc.action ?? "").trim();
    const i = a.search(/[：:]/);
    return i < 0 ? [a, [] as string[]] : [a.slice(0, i).trim(), a.slice(i + 1).split(/[、，,；;]/).map((x) => x.trim()).filter(Boolean)];
  })();
  const present = lit && s ? mobsHere(s, id, game.npcs).filter((p) => p.present) : [];
  const exits = exitsOf(id);
  const tone = rs?.kind === "open" ? "var(--jade)" : rs?.kind === "event" ? "var(--coral)" : "var(--gold)";
  return (
    <Modal panelClassName="ui-dialog-game" title={title} onClose={onClose}>
      <div className="space-y-3">
        {/* 实景横幅：有照片用照片，没有用柔和渐变；状态与「你在这里」浮在左下 */}
        <div className="relative h-32 overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-br from-[var(--jade)]/25 via-[var(--gold)]/10 to-[var(--coral)]/20">
          {photo && <img src={photo} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className={`absolute inset-0 h-full w-full object-cover ${lit ? "" : "grayscale"}`} />}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-3 bottom-2.5 flex flex-wrap items-center gap-1.5">
            {rs && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />{rs.label}
              </span>
            )}
            {here && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink">你在这里</span>}
          </div>
        </div>

        {funcs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {funcs.map((f) => <span key={f} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11.5px] text-ink-soft">{f}</span>)}
          </div>
        )}

        {actName && (
          <section className="rounded-2xl border border-jade/30 bg-jade/[0.06] px-3.5 py-3">
            <p className="text-[10.5px] font-bold tracking-[0.16em] text-jade">今日可做</p>
            <p className="mt-1 text-[15px] font-black text-ink">{actName}</p>
            {actFx.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {actFx.map((f) => {
                  const m = f.match(/^(.*?)\s*([+-]\s*\d+%?)$/);
                  return (
                    <span key={f} className="inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1 text-[12px] text-ink shadow-sm">
                      {m ? <>{m[1]}<b className="font-bold tabular-nums text-jade">{m[2].replace(/\s+/g, "")}</b></> : f}
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {present.length > 0 && (
          <section>
            <p className="mb-1.5 text-[11.5px] font-bold text-ink">此刻在场</p>
            <div className="flex flex-wrap gap-1.5">
              {present.map((p) => (
                <button key={p.id} type="button" onClick={() => open({ type: "person", id: p.id })}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition hover:brightness-110"
                  style={{ color: "var(--char)", borderColor: "color-mix(in srgb, var(--char) 35%, transparent)", background: "color-mix(in srgb, var(--char) 8%, transparent)" }}>
                  {p.name}{p.role && <span className="font-normal opacity-70">· {p.role}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {loc.hint && (
          <p className="rounded-xl bg-gold/[0.08] px-3 py-2 text-[12px] leading-relaxed text-ink/80">
            <span className="mr-1 font-bold text-gold">人物线索</span>{loc.hint}
          </p>
        )}

        {exits.length > 0 && (
          <section>
            <p className="mb-1.5 text-[11.5px] font-bold text-ink">相邻出口</p>
            <div className="flex flex-wrap gap-1.5">
              {exits.map((e) => {
                const known = (s?.visited ?? []).includes(e.to);
                return (
                  <button key={e.to} type="button" onClick={() => open({ type: "loc", id: e.to })}
                    className={`rounded-full border px-2.5 py-0.5 text-[11.5px] transition hover:border-jade hover:text-jade ${known ? "border-line bg-paper text-ink" : "border-dashed border-line text-ink-soft"}`}>
                    {e.name}{!known && " ·未到访"}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <p className={`flex items-center gap-2 border-t border-line/60 pt-2.5 text-[11.5px] ${lit ? "text-ink-soft" : "text-gold"}`}>
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${lit ? "bg-jade shadow-[0_0_6px_var(--jade)]" : "border border-gold"}`} />
          {lit ? "已在舆图上点亮，可从舆图规划前往。" : "尚未探索：沿出口走到这里，才会在舆图上点亮。"}
        </p>
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
    // 功能注释：存档/草稿 NPC 可能无 name；filter 内读 .length 会让作者预览整页 ErrorBoundary
    const npcList = Array.isArray(game?.npcs) ? game.npcs : [];
    const people = npcList.filter((n) => namedEnough(n.name)).map((n) => ({ name: n.name, type: "person" as const, id: n.id }));
    const all = [...people, ...locEntries(), ...itemEntries()];
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
          className="inline appearance-none border-0 bg-transparent p-0 font-medium no-underline outline-none transition hover:brightness-110"
          style={{ color: style.color }}
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
