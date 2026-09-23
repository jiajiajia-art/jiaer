import NpcProfile from "./NpcProfile";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import starCityMap from "../assets/star-city-map.png";
import { Segments, PacedSegments, LiveNarration } from "./StoryTab";
import ProducerParley from "./ProducerParley";
import GigBoard from "./GigBoard";
import { Modal, Chip, Avatar } from "./ui";
import { IconSend, IconSparkle } from "../lib/icons";
import {
  ROOM_DESC,
  directionHint,
  encountersHere,
  exitsOf,
  intelOf,
  itemsHere,
  locOf,
  mobsHere,
  roomStatus,
  travelPlan,
  fareFor,
  TRANSPORT,
} from "../game/mud";
import { CARS, carById, resaleValue } from "../game/data";
import { customItemsOf, spotBackground, spotDesc, spotEventsOf, spotName } from "../game/mapedits";
import { PEOPLE, PERSON_BY_ID, activitiesOfRoom, profileOf, resumeOf, type FamilyRef } from "../worlds/star2005/content";
import { factsOf, isManager, knows, producerProjects } from "../game/producer";
import { categoryLabel, roleLabel } from "../game/projects";
import { type GameState as SimState } from "../game/logic";


/* 星辉 4S 汽车城：买车 / 置换 / 卖车（残值回收，差价即折旧）。座驾在「主角」页选定。
 * 以弹窗形式呈现——在 4S 店点「进店选购」唤出。 */
function Dealership({ s, onClose }: { s: SimState; onClose: () => void }) {
  const { buyCar, sellCar, setActiveCar, busy } = useGame();
  const owned = s.cars ?? [];
  const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
  return (
    <Modal title="星辉 4S 汽车城" onClose={onClose} wide>
      <p className="mb-3 text-[12px] text-ink-soft">
        现金 <b className="text-ink">{yuan(s.money)}</b>。买车后到「主角」页把它选为座驾，出行就能「自己开车」——免费又体面。
      </p>

      {owned.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11.5px] font-bold text-ink">我的车库（{owned.length}）</p>
          <div className="space-y-1.5">
            {owned.map((id) => {
              const c = carById(id);
              if (!c) return null;
              const on = s.activeCar === id;
              return (
                <div key={id} className="flex items-center gap-2 rounded-sm border border-line/70 bg-paper px-2.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      {c.name}
                      {on ? <span className="text-[10px] text-jade">◉ 当前座驾</span> : null}
                    </span>
                    <span className="block text-[10.5px] text-ink-soft">回收价 {yuan(resaleValue(c))} · 折旧 {yuan(c.price - resaleValue(c))}</span>
                  </span>
                  <button
                    onClick={() => setActiveCar(on ? null : id)}
                    className={`shrink-0 rounded-sm border px-2 py-1 text-[11.5px] transition ${on ? "border-solid border-jade bg-jade/10 text-jade" : "border-dashed border-jade/50 text-jade hover:bg-jade/8"}`}
                  >
                    {on ? "取消座驾" : "设为座驾"}
                  </button>
                  <button
                    onClick={() => sellCar(id)}
                    disabled={busy}
                    className="shrink-0 rounded-sm border border-dashed border-danger/50 px-2 py-1 text-[11.5px] text-danger transition hover:bg-danger/8 disabled:opacity-50"
                  >
                    卖车
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mb-1.5 text-[11.5px] font-bold text-ink">展厅新车</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {CARS.map((c) => {
          const have = owned.includes(c.id);
          const afford = s.money >= c.price;
          return (
            <div key={c.id} className="rounded-sm border border-dashed border-line p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-ink">{c.name}</span>
                <Chip tone="gold">{c.tag}</Chip>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{c.desc}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink">{yuan(c.price)}</span>
                {have ? (
                  <span className="rounded-sm bg-jade/10 px-2 py-1 text-[11.5px] font-medium text-jade">已拥有</span>
                ) : (
                  <button
                    onClick={() => buyCar(c.id)}
                    disabled={busy || !afford}
                    className="rounded-sm border border-solid border-gold bg-gold/10 px-2.5 py-1 text-[11.5px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-40"
                  >
                    {afford ? "购入" : "资金不足"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* 剧本资料袋：查看在此地已解锁的项目资料（只读，由 s.knownFacts 派生，不调用 AI）。 */
function ScriptDossier({ s }: { s: SimState }) {
  const room = s.room ?? "apartment";
  const managers = PEOPLE.filter((m) => m.home === room && isManager(m.id));
  const rows: { tpl: ReturnType<typeof producerProjects>[number]; manager: string }[] = [];
  for (const m of managers) {
    for (const tpl of producerProjects(s, m.id)) {
      if ((factsOf(s, tpl.id).length ?? 0) > 0) rows.push({ tpl, manager: m.name });
    }
  }
  if (!rows.length) {
    return (
      <p className="mt-2.5 rounded-sm border border-dashed border-line px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
        袋里还是空的——这里的项目你尚未打听过。找片场负责人「洽谈通告」，问到的细节才会归档到这里。
      </p>
    );
  }
  return (
    <div className="mt-2.5 space-y-2">
      <p className="text-[11px] text-ink-soft">已归档的项目资料（问到多少记多少，翻阅不产生新进展）：</p>
      {rows.map(({ tpl, manager }) => (
        <div key={tpl.id} className="rounded-sm border border-dashed border-line p-3">
          <p className="text-[14px] font-bold text-ink">
            {knows(s, tpl.id, "starLevel") ? "★".repeat(tpl.starLevel) + " " : ""}
            {tpl.title}
            <span className="ml-1.5 text-[11px] font-normal text-ink-soft">· {manager}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {knows(s, tpl.id, "category") && <Chip tone="jade">{categoryLabel(tpl.category)}</Chip>}
            {knows(s, tpl.id, "roleType") && <Chip>{roleLabel(tpl.roleSlot.roleType)}</Chip>}
            {knows(s, tpl.id, "deadline") && <Chip tone="gold">截止第 {tpl.deadlineWeek} 周</Chip>}
          </div>
          {knows(s, tpl.id, "synopsis") && (
            <p className="story-prose mt-1.5 text-[12px] leading-relaxed text-ink/80">{tpl.synopsis}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* 舆图坐标：把已知房间铺在一张手绘网格上（列 x，行 y），连线取自真实出口图 exitsOf。 */
const MAP_LAYOUT: Record<string, [number, number]> = {
  fours: [0, 1],
  apartment: [2, 0],
  tianguang: [2, 1],
  bookstore: [1, 1],
  redcarpet: [3, 1],
  lounge: [4, 1],
  gym: [0, 2],
  street: [2, 2],
  beauty: [3, 2],
  cafe: [4, 2],
  dieyin: [0, 3],
  academy: [1, 3],
  agency: [2, 3],
  wardrobe: [3, 3],
  yuntai: [4, 3],
  cancan: [0, 4],
  airport: [1, 4],
  theater: [2, 4],
  fuguang: [4, 4],
};
const MAP_COLS = 5;
const MAP_ROWS = 5;

/* 地点实景：进入某地后不再看舆图，而是看这一处的实景照片（Unsplash），照片上叠场景名。 */
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&h=520&fit=crop&auto=format&q=80`;
const ROOM_IMAGE: Record<string, string> = {
  apartment: U("1680416124510-5eae1beca412"),
  tianguang: U("1560448204-e02f11c3d0e2"),
  bookstore: U("1699443817739-cf2f7cbcd18d"),
  redcarpet: U("1779696413497-ed3af0ac7161"),
  lounge: U("1756981168649-0e3c3c8a32f3"),
  gym: U("1761971976282-b2bb051a5474"),
  street: U("1601042879364-f3947d3f9c16"),
  beauty: U("1706629503634-2de20b65080e"),
  cafe: U("1624583338957-4d155ca886dc"),
  dieyin: U("1531651008558-ed1740375b39"),
  academy: U("1501684399321-1dc61aaea760"),
  agency: U("1686100510540-4c29a46de6e9"),
  wardrobe: U("1771919318996-f5ebc2319881"),
  yuntai: U("1684285746670-3d2eeed72192"),
  cancan: U("1612544409025-e1f6a56c1152"),
  airport: U("1553619948-505cc1cdc320"),
  theater: U("1514306191717-452ec28c7814"),
  fuguang: U("1780913363783-59bb4357e277"),
  fours: U("1567818735868-e71b99932e29"),
};
const roomImage = (id: string) => ROOM_IMAGE[id] ?? U("1684285746670-3d2eeed72192");
// 横屏（橙光式）背景：同一批场景图，改用顶天立地的大尺寸裁切。
const RAW_ID = (id: string) => (ROOM_IMAGE[id] ?? U("1684285746670-3d2eeed72192")).match(/photo-([^?]+)/)?.[1] ?? "1684285746670-3d2eeed72192";
export const sceneImageWide = (id: string) => `https://images.unsplash.com/photo-${RAW_ID(id)}?w=1600&h=1000&fit=crop&auto=format&q=80`;
// 留出边距，避免节点卡片贴边被裁切。
const mapPos = (id: string) => {
  const [c, r] = MAP_LAYOUT[id] ?? [Math.floor(MAP_COLS / 2), Math.floor(MAP_ROWS / 2)];
  return {
    x: 9 + (c / (MAP_COLS - 1)) * 82,
    y: 12 + (r / (MAP_ROWS - 1)) * 76,
  };
};

function MapNode({ s, id, current, onPick }: { s: SimState; id: string; current: boolean; onPick: (id: string) => void }) {
  const loc = locOf(id);
  const rs = roomStatus(s, id);
  // 副标题：当前位置 / 忙碌 / 休息 / 活动，其余显示可探访提示
  const hint = current
    ? "◆ 你在此"
    : rs.kind === "busy" ? "拍摄中"
    : rs.kind === "closed" ? "休息中"
    : rs.kind === "event" ? "活动进行"
    : "可偶遇NPC";
  const p = mapPos(id);
  return (
    <button
      onClick={() => onPick(id)}
      title={loc?.func}
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
      className={`dream-map-node group absolute z-10 flex h-[34px] w-[68px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden rounded-[9px] text-center shadow-[0_4px_10px_-8px_rgba(91,70,150,0.68)] transition duration-200 ease-out hover:brightness-105 active:scale-[0.98] ${
        current
          ? "ring-2 ring-fuchsia-300 ring-offset-1 ring-offset-white/40"
          : "ring-1 ring-white/60 hover:ring-fuchsia-300/80"
      }`}
    >
      {/* 实景底图 */}
      <img src={roomImage(id)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      {/* 紫调渐变罩：压暗底图、保证白字清晰，呼应星城主题 */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: current
          ? "linear-gradient(160deg, rgba(120,60,180,0.45) 0%, rgba(40,20,60,0.72) 100%)"
          : "linear-gradient(160deg, rgba(90,70,150,0.42) 0%, rgba(30,20,50,0.68) 100%)" }}
        aria-hidden
      />
      <span className="relative z-10 max-w-[63px] truncate px-1 text-[9px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
        {loc?.name}
      </span>
      <span className={`relative z-10 mt-0.5 text-[7px] leading-none tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] ${
        current ? "text-fuchsia-200" : "text-white/90"
      }`}>
        {hint}
      </span>
    </button>
  );
}

function CityMap({ s, onPick, wide }: { s: SimState; onPick: (id: string) => void; wide?: boolean }) {
  const cur = s.room ?? "apartment";
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const id of Object.keys(MAP_LAYOUT)) {
      for (const e of exitsOf(id)) {
        if (!MAP_LAYOUT[e.to]) continue;
        const key = [id, e.to].sort().join(">");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([id, e.to]);
      }
    }
    return out;
  }, []);
  return (
    <div className="w-full overflow-x-hidden">
      <div
        className={`dream-city-map relative w-full overflow-hidden rounded-[28px] border border-white/80 bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.7),transparent_42%),linear-gradient(145deg,#c7c7fa_0%,#d9bdf3_45%,#b9d7fa_100%)] shadow-[0_18px_38px_-24px_rgba(91,70,150,0.8)] ${wide ? "min-h-[360px]" : "min-h-[260px]"}`}
        style={{ height: wide ? "clamp(360px, 48vw, 440px)" : "clamp(260px, 62vw, 320px)" }}
      >
        <img src={starCityMap} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
        {/* 轻薄遮罩保持路线与地点标记清晰。 */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 50% 110%, rgba(255,255,255,0.72), transparent 60%), radial-gradient(80% 60% at 15% -10%, rgba(255,218,247,0.75), transparent)",
          }}
          aria-hidden
        />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {edges.map(([a, b]) => {
            const pa = mapPos(a);
            const pb = mapPos(b);
            return (
              <line
                key={a + b}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgba(255,255,255,0.78)"
                strokeWidth={1}
                strokeDasharray="3 2.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {Object.keys(MAP_LAYOUT).map((id) => (
          <MapNode key={id} s={s} id={id} current={id === cur} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

/* 场景点位：叠在实景照片上的可点标记（居家活动 / 物件 / 探索）。 */
type Spot = {
  key: string;
  label: string;
  glyph: string;
  tone: "explore" | "act" | "item" | "event";
  locked?: boolean;
  owned?: boolean;
  onClick: () => void;
};
/* 点位落点（百分比坐标）——避开底部场景名区域，散布在画面中上部。 */
const SPOT_ANCHORS: Array<[number, number]> = [
  [20, 30], [48, 24], [76, 32], [30, 50], [60, 46], [84, 40], [16, 62], [66, 62],
];

function SceneSpot({ spot, active, anchor }: { spot: Spot; active: boolean; anchor: [number, number] }) {
  const [x, y] = anchor;
  const dim = spot.tone === "item" ? spot.owned : spot.locked;
  const dot = active
    ? "border-white bg-gold text-ink shadow-lg shadow-black/50 ring-2 ring-gold/50"
    : spot.tone === "explore"
      ? "border-coral/70 bg-coral/90 text-white"
      : spot.tone === "event"
      ? "border-gold/80 bg-gradient-to-br from-coral to-gold text-white shadow-md shadow-black/40"
      : spot.locked
        ? "border-gold/60 bg-black/55 text-gold"
        : "border-white/45 bg-black/55 text-white";
  return (
    <button
      onClick={spot.onClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 transition"
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold backdrop-blur-sm transition ${dot} ${active ? "" : "group-hover:border-gold group-hover:bg-black/75"}`}>
        {spot.glyph}
      </span>
      <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-bold leading-none backdrop-blur-sm drop-shadow transition ${
        active ? "bg-gold text-ink" : dim ? "bg-black/45 text-white/60" : "bg-black/55 text-white group-hover:bg-black/75"
      }`}>
        {spot.label}
        {spot.locked && <span className="ml-1 text-[9px] text-gold">·需购书</span>}
        {spot.owned && <span className="ml-1 text-[9px] text-white/50">·已收</span>}
      </span>
    </button>
  );
}

/* 角色卡牌：以名字哈希取一组梦幻渐变，头像用姓氏首字做花体字牌，供实景图左上角浮层使用。 */
const CARD_GRADS = [
  ["#a68bec", "#e2a6d6"], ["#7fb8ec", "#b39ff0"], ["#f0a8c8", "#f6c99a"],
  ["#8ad6c4", "#7fb8ec"], ["#c79ae4", "#e79ac9"], ["#e4b062", "#e79ac9"],
];
function cardGrad(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CARD_GRADS[h % CARD_GRADS.length] as [string, string];
}
function PersonCard({ name, role, known, active, onClick }: { name: string; role: string; known: boolean; active: boolean; onClick: () => void }) {
  // 未结识前不泄露真实姓名与身份，显示为「陌生人」占位
  const [c1, c2] = known ? cardGrad(name) : ["#9c93b8", "#c8bfe0"];
  const face = known ? name.slice(0, 1) : "?";
  const title = known ? name : "陌生人";
  const sub = known ? role : "尚未结识";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group flex w-[62px] shrink-0 flex-col overflow-hidden rounded-xl border text-center backdrop-blur-md transition-all duration-200 ${
        active
          ? "border-white/80 bg-white/85 shadow-[0_12px_28px_-8px_rgba(120,80,200,0.75)]"
          : "border-white/55 bg-white/70 shadow-[0_8px_20px_-10px_rgba(60,40,110,0.5)] hover:-translate-y-0.5 hover:bg-white/85"
      }`}
    >
      {/* 花体字头像牌（竖版卡面上部） */}
      <span
        className="relative flex h-[50px] w-full items-center justify-center font-serif text-[23px] font-black text-white"
        style={{ backgroundImage: `linear-gradient(150deg, ${c1}, ${c2})` }}
      >
        {face}
        <span className="pointer-events-none absolute right-1 top-1 text-[10px] text-white/85">✦</span>
      </span>
      <span className="flex flex-col px-1 pb-1.5 pt-1.5">
        <span className={`truncate text-[10px] font-bold leading-tight ${active ? "text-jade" : known ? "text-ink" : "text-ink-soft"}`}>{title}</span>
        <span className="truncate text-[8px] leading-tight text-ink-soft">{sub}</span>
      </span>
    </button>
  );
}

/* 地点实景横幅：进入一处后展示该地实景照片 + 场景名 + 营业状态 + 可点位标记，右下角可切回星城舆图。 */
function LocationHero({ s, spots, activeKey, onOpenMap, overlay, fill, narration, bg, name }: { s: SimState; spots: Spot[]; activeKey: string | null; onOpenMap: () => void; overlay?: ReactNode; fill?: boolean; narration?: ReactNode; bg?: string; name?: string }) {
  const room = s.room ?? "apartment";
  const loc = locOf(room);
  const rs = roomStatus(s, room);
  const title = name ?? loc?.name;
  return (
    <div className={`relative overflow-hidden bg-jade-deep/80 shadow-inner ${fill ? "h-full rounded-2xl border border-white/15 shadow-2xl" : "rounded-sm border border-line/70"}`}>
      <img
        src={bg || roomImage(room)}
        alt={title ?? "所在地"}
        loading="lazy"
        className={fill ? "h-[calc(50dvh-4rem)] min-h-[190px] w-full object-cover" : "h-[31.5vh] max-h-[284px] min-h-[182px] w-full object-cover"}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/80" aria-hidden />
      {/* 右上角：你现在的位置 + 星城舆图 */}
      <div className="absolute right-3 top-3 z-10 flex max-w-[70%] flex-col items-end gap-2 text-right">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-gold/85 drop-shadow">◆ 你现在的位置</p>
          <p className="truncate font-serif text-[22px] font-black leading-tight text-white drop-shadow-lg">{title}</p>
          <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-white/80 drop-shadow">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${rs.open ? "bg-emerald-400" : "bg-amber-400"}`} />
            {rs.label}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onOpenMap}
            aria-label="打开星城地图"
            title="打开星城地图"
            className="group flex items-center gap-1.5 rounded-full border border-white/45 bg-slate-950/35 px-2 py-1.5 text-left text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-gold hover:bg-slate-950/55"
          >
            <span className="relative grid h-8 w-8 place-items-center rounded-full border border-white/35 bg-gradient-to-br from-fuchsia-300/80 to-indigo-500/80 shadow-[0_0_14px_rgba(214,178,255,0.45)]">
              <svg viewBox="0 0 32 32" className="h-[18px] w-[18px] drop-shadow" aria-hidden="true">
                <path d="M16 28s8-7.2 8-14A8 8 0 1 0 8 14c0 6.8 8 14 8 14Z" fill="none" stroke="white" strokeWidth="1.8" />
                <circle cx="16" cy="14" r="2.6" fill="#ffe38a" stroke="white" strokeWidth="1.4" />
                <path d="M11 8.5 13 6.8M19 6.8 21 8.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
              </svg>
              <span className="pointer-events-none absolute inset-0 rounded-full border border-white/30 opacity-0 transition group-hover:scale-125 group-hover:opacity-100" />
            </span>
            <span className="pr-0.5 text-[12px] font-black leading-none tracking-wide">星城地图</span>
          </button>
        </div>
      </div>
      {/* 场景点位：把居家活动 / 物件 / 探索铺成照片上的可点标记 */}
      {spots.map((sp, i) => (
        <SceneSpot key={sp.key} spot={sp} active={activeKey === sp.key} anchor={SPOT_ANCHORS[i % SPOT_ANCHORS.length]} />
      ))}
      {/* 左下角浮层卡片：此处 · 点击互动（人物角色卡）；沉浸态上抬，为底部旁白让位 */}
      {overlay && (
        <div className={`pointer-events-none absolute left-3 z-10 w-[min(17rem,80%)] ${fill && narration ? "bottom-[5.5rem]" : "bottom-3"}`}>{overlay}</div>
      )}
      {/* 横屏沉浸态：底部 AVG 旁白条，把场景描述读作画外音 */}
      {fill && narration && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-black/40 px-5 py-3 shadow-lg backdrop-blur-md">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.35em] text-gold/85">◆ 此地</p>
            <p className="story-prose text-[13px] leading-relaxed text-white/90">{narration}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* 人物档案卡：闲聊之外，可展开确定性生平——哪年哪月做了什么、现任/前任是谁（全取自内容池，不调用 AI）。 */
function PersonDossier({ pid, onJump }: { pid: string; onJump?: (id: string) => void }) {
  const profile = profileOf(pid);
  const resume = resumeOf(pid).filter((e) => !e.hidden);
  const fam = profile?.family;
  const refLine = (label: string, refs?: FamilyRef[] | FamilyRef | null) => {
    const arr = Array.isArray(refs) ? refs : refs ? [refs] : [];
    if (!arr.length) return null;
    return (
      <div className="flex gap-2 text-[12px]">
        <span className="w-12 shrink-0 text-ink-soft">{label}</span>
        <span className="flex flex-wrap gap-1.5">
          {arr.map((r, i) => {
            const jumpable = r.id && onJump;
            const text = r.note ? `${r.name}（${r.note}）` : r.name;
            return jumpable ? (
              <button key={i} onClick={() => onJump!(r.id!)} className="rounded-sm border border-dashed border-jade/50 px-1.5 text-jade transition hover:bg-jade/10">{text} ↗</button>
            ) : (
              <span key={i} className="text-ink">{text}</span>
            );
          })}
        </span>
      </div>
    );
  };
  const hasFam = fam && (fam.spouse || fam.parents?.length || fam.children?.length);
  return (
    <div className="mt-2.5 space-y-3 border-l border-line pl-3">
      {hasFam && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-jade/70">情感关系</p>
          {refLine("现任", fam!.spouse)}
          {refLine("父母", fam!.parents)}
          {refLine("子女", fam!.children)}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-jade/70">生平履历</p>
        {resume.length === 0 ? (
          <p className="text-[12px] text-ink-soft/70">履历尚未得知——多来往几回，才会听 TA 说起过往。</p>
        ) : (
          resume.map((e, i) => (
            <div key={i} className="flex gap-2 text-[12px] leading-relaxed">
              <span className="w-16 shrink-0 tabular-nums text-gold">{e.year}{e.month ? `.${e.month}` : ""}</span>
              <span className="min-w-0 flex-1">
                <span className="font-bold text-ink">{e.title}</span>
                {e.detail && <span className="text-ink/75"> — {e.detail}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* 世界 Tab：图形化房间制 MUD 主入口。
 * 星城舆图（战争迷雾）→ 点击节点看详情/确认前往 → 当前场景（在场人物·物品·行动）→ 故事线。 */
export default function HomeTab() {
  const { game, busy, theme, submit, simMove, simVisit, simEvent, simPickup, simActivity, simBuy, simAskIntel, playSpotEvent } = useGame();
  const landscape = theme.orient === "landscape";
  const [input, setInput] = useState("");
  const [custom, setCustom] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [companion, setCompanion] = useState<string | null>(null);
  const [modeId, setModeId] = useState<string>("subway"); // 玩家所选交通方式
  const [note, setNote] = useState<string>("");
  const [showMap, setShowMap] = useState(true); // 主页优先展示可点击星城地图，实景作为地点内页
  const [carShopOpen, setCarShopOpen] = useState(false); // 星辉 4S 汽车城以弹窗呈现
  // 已逐句读完的最新 AI 回合 id：初值设为载入时的最新回合，使既有历史不重新逐句、只有新回合才逐拍显示
  const [readTurnId, setReadTurnId] = useState<string | null>(() => {
    const la = [...(game?.story ?? [])].reverse().find((t) => t.role === "ai");
    return la ? la.id : null;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.story.length, busy]);

  const s = game?.sim;
  const plan = useMemo(() => (s && pending ? travelPlan(s, pending) : null), [s, pending]);

  if (!game || !s) return null;
  const room = s.room ?? "apartment";
  const loc = locOf(room);
  // 玩家在地图编辑器里对本点位的覆写（名称/描述/背景图/自定义物件）
  const bgOverride = spotBackground(game, room);
  const nameOverride = spotName(game, room);
  const descText = spotDesc(game, room) ?? ROOM_DESC[room] ?? loc?.func;
  const people = mobsHere(s, room).filter((p) => p.present);
  const encounters = encountersHere(s, room); // 同处一地方可触发的条件邂逅
  // 内容池物件 + 玩家自定义物件，统一带上是否已入行囊
  const items = [
    ...itemsHere(s, room),
    ...customItemsOf(game, room).map((it) => ({ id: it.id, name: it.name, icon: it.icon ?? "◇", desc: it.desc, owned: (s.bag ?? []).includes(it.id), price: undefined as number | undefined, linksProjects: false })),
  ];
  const acts = activitiesOfRoom(room);
  // 玩家在此点位自建的剧情事件（一次性事件触发后隐去；已收进剧情志的按 srcId 判定）
  const firedEvents = (game.journal ?? []).filter((e) => e.kind === "spot").map((e) => e.srcId);
  const spotEvents = spotEventsOf(game, room, firedEvents.filter((x): x is string => !!x));
  // 当前被点选的人物（点石牌弹出行动条：交谈/洽谈/打听/端详）
  const activePid = openId && /^(menu|bio|intel|parley):/.test(openId) ? openId.slice(openId.indexOf(":") + 1) : null;

  // 场景点位：探索 + 居家活动 + 物件，铺在实景照片上作可点标记
  const spots = [
    {
      key: "explore",
      label: `◈ ${loc?.action ?? "探索四周"}`,
      glyph: "◈",
      tone: "explore" as const,
      onClick: () => { if (!busy) setNote(simVisit(room)); },
    },
    // 天光公寓：书桌上的日程本 —— 点开直达「人物」页的本周日程板
    ...(room === "apartment"
      ? [{
          key: "schedule",
          label: "排本周日程",
          glyph: "▦",
          tone: "act" as const,
          onClick: () => window.dispatchEvent(new CustomEvent("star:navschedule")),
        }]
      : []),
    // 玩家自建的剧情事件：点击即交 AI 演绎，落入剧情志
    ...spotEvents.map((ev) => ({
      key: `evt:${ev.id}`,
      label: `✦ ${ev.title}`,
      glyph: "✦",
      tone: "event" as const,
      onClick: () => { if (!busy) playSpotEvent(ev.id); },
    })),
    ...acts.map((a) => ({
      key: `act:${a.id}`,
      label: a.name,
      glyph: "✦",
      tone: "act" as const,
      locked: !!a.requiresItem && !(s.bag ?? []).includes(a.requiresItem),
      onClick: () => setOpenId(openId === `act:${a.id}` ? null : `act:${a.id}`),
    })),
    // 已收进行囊的物件不再在场景里列出（拿走即消失）；可购的标价商品不受影响
    ...items
      .filter((it) => !(it.owned && it.price == null))
      .map((it) => ({
        key: `item:${it.id}`,
        label: it.name,
        glyph: "◇",
        tone: "item" as const,
        owned: it.owned,
        onClick: () => setOpenId(openId === `item:${it.id}` ? null : `item:${it.id}`),
      })),
  ];

  // 传统文字游戏式逐句显示：最新 AI 回合未读完前，一句一句轻触推进，读完才浮现选项
  const lastAi = [...game.story].reverse().find((t) => t.role === "ai");
  const paceActive = !!lastAi && !busy && readTurnId !== lastAi.id;
  const scrollToEnd = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    setCustom(false);
    void submit(text.trim());
  };
  const confirmMove = () => {
    if (!pending || busy || !plan) return;
    const myCar = carById(s?.activeCar);
    const picked = TRANSPORT.find((m) => m.id === modeId) ?? TRANSPORT[0];
    const mode = picked.ownCar && !myCar ? (TRANSPORT.find((m) => m.id === "subway") ?? TRANSPORT[0]) : picked;
    const t = fareFor(plan, mode);
    simMove(pending, companion ?? undefined, { fee: t.fee, minutes: t.minutes, modeLabel: mode.label }); // 抵达叙事已落入下方对话框
    setPending(null);
    setCompanion(null);
    setOpenId(null);
    setNote("");
    setShowMap(false); // 抵达新地点后收起舆图，直接看新场景实景
  };
  // 可邀同行者：此刻与你同处一地、已结识、关系≥20 的在场人物
  const companions = people.filter((p) => (s.metPeople ?? []).includes(p.id) && (s.rel?.[p.id] ?? 0) >= 20);
  const talk = (name: string, role: string, known: boolean) => {
    if (busy) return;
    const verb = known
      ? `你在这里遇见了${role}${name}，主动上前与${name}交谈。请描写这段对话并据此推进关系。`
      : `你在这里注意到${role}${name}，虽然还不相熟，你礼貌地上前搭话，试着结识。请描写这次初次照面。`;
    void submit(`【场景：${loc?.name}】${verb}`, true);
  };


  return (
    <div className={`flex h-full flex-col ${landscape ? "[&_.story-scene-scroll]:pt-14" : ""}`}>
      {/* 上半：场景 + 星城舆图（占据剩余空间，独立滚动） */}
      <div className="story-scene-scroll min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto space-y-5 ${landscape && !showMap ? "max-w-none px-3 py-3" : landscape && showMap ? "max-w-5xl px-4 py-5" : "max-w-2xl px-4 py-5"}`}>
          {/* ═══ 当前场景（纯文字 MUD 控制台，直接铺在纸面上） ═══ */}
          <section>
            {/* 地点名已在顶部栏呈现，此处不再重复，直接以场景描述开篇；横屏沉浸态让实景铺满，描述改为图内旁白 */}
            <p className={`story-prose text-[13.5px] leading-relaxed text-ink/90 ${landscape && !showMap ? "hidden" : ""} ${showMap ? "hidden" : ""}`} style={{ textIndent: "2em" }}>
              {descText}
            </p>
            {/* ═══ 所在地实景 / 星城舆图（默认看实景，点按钮切到舆图规划前往） ═══ */}
            <div className={showMap || landscape ? "" : "mt-5"}>
              {showMap ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-ink-soft/70">星城全图 · 点选前往</p>
                    <button
                      onClick={() => setShowMap(false)}
                      className="rounded-sm border border-dashed border-jade/50 px-2.5 py-1 text-[11px] font-bold text-jade transition hover:bg-jade/10"
                    >
                      ‹ 返回此地
                    </button>
                  </div>
                  <CityMap s={s} wide={landscape} onPick={(id) => (id === room ? setShowMap(false) : setPending(id))} />
                </>
              ) : (
                <LocationHero
                  s={s}
                  spots={spots}
                  activeKey={openId}
                  onOpenMap={() => setShowMap(true)}
                  fill={landscape && !showMap}
                  bg={bgOverride}
                  name={nameOverride}
                  narration={descText}
                  overlay={
                    /* ═══ 此处 · 点击互动 —— 浮于实景图左上角，在场人物以角色卡牌呈现；无人时整块不显示 ═══ */
                    people.length > 0 ? (
                      <div className="pointer-events-auto">
                        <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white [text-shadow:0_1px_6px_rgba(40,20,70,0.9)]">
                          <span className="text-[11px] text-gold">✦</span> 此处 · 点击互动
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {people.map((p) => {
                            const known = (s.metPeople ?? []).includes(p.id);
                            const active = activePid === p.id;
                            return (
                              <PersonCard
                                key={`p:${p.id}`}
                                name={p.name}
                                role={p.role}
                                known={known}
                                active={active}
                                onClick={() => setOpenId(active ? null : `menu:${p.id}`)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null
                  }
                />
              )}
            </div>

            {/* 居家活动 / 物件的详情与操作已改到下半部分「对话框」里展开（见下方场景点位卡片） */}

            {room === "fours" && (
              <div className="mt-3 rounded-sm border border-dashed border-gold/50 bg-gold/[0.04] p-3">
                <p className="mb-1 text-[11px] font-bold tracking-widest text-gold/80">星辉 4S 汽车城</p>
                <p className="mb-2.5 text-[12px] text-ink-soft">锃亮的展车列成一排，销售迎了上来。要不要进店挑一辆座驾？</p>
                <button
                  onClick={() => setCarShopOpen(true)}
                  className="rounded-sm border border-solid border-gold bg-gold/10 px-3 py-1.5 text-[12px] font-semibold text-gold transition hover:bg-gold/20"
                >
                  进店选购 →
                </button>
              </div>
            )}
            {carShopOpen && room === "fours" && <Dealership s={s} onClose={() => setCarShopOpen(false)} />}

            {people.map((p) => {
              if (activePid !== p.id) return null;
              const known = (s.metPeople ?? []).includes(p.id);
              const intel = known ? intelOf(s, p.id) : [];
              return (
                <div key={p.id} className="mt-3 rounded-sm border border-dashed border-line p-3">
                  <div className="flex flex-wrap gap-2 text-[12.5px] font-medium">
                    <button onClick={() => talk(p.name, p.role, known)} disabled={busy} className="rounded-sm border border-dashed border-jade bg-jade/10 px-3 py-1.5 text-jade transition hover:bg-jade/20 disabled:opacity-50">
                      [ {known ? "交谈" : "搭话"} ]
                    </button>
                    {known && isManager(p.id) && (
                      <button onClick={() => setOpenId(openId === `parley:${p.id}` ? `menu:${p.id}` : `parley:${p.id}`)} className={`rounded-sm border border-dashed px-3 py-1.5 transition ${openId === `parley:${p.id}` ? "border-solid border-coral bg-coral/10 text-coral" : "border-coral/50 text-coral hover:bg-coral/8"}`}>
                        查看通告
                      </button>
                    )}
                    {/* 接洽通告：当面查看 TA 手上的通告（内容/男女主配/角色/固定档期）并就地交涉接单 */}
                    {known && PERSON_BY_ID[p.id]?.offers && (
                      <button onClick={() => setOpenId(openId === `gigs:${p.id}` ? `menu:${p.id}` : `gigs:${p.id}`)} className={`rounded-sm border border-dashed px-3 py-1.5 transition ${openId === `gigs:${p.id}` ? "border-solid border-jade bg-jade/10 text-jade" : "border-jade/50 text-jade hover:bg-jade/8"}`}>
                        接洽通告
                      </button>
                    )}
                    {intel.length > 0 && (
                      <button onClick={() => setOpenId(openId === `intel:${p.id}` ? `menu:${p.id}` : `intel:${p.id}`)} className={`rounded-sm border border-dashed px-3 py-1.5 transition ${openId === `intel:${p.id}` ? "border-solid border-gold bg-gold/10 text-gold" : "border-gold/50 text-gold hover:bg-gold/8"}`}>
                        打听
                      </button>
                    )}
                    <button onClick={() => setOpenId(openId === `bio:${p.id}` ? `menu:${p.id}` : `bio:${p.id}`)} className={`rounded-sm border border-dashed px-3 py-1.5 transition ${openId === `bio:${p.id}` ? "border-solid border-ink bg-ink/8 text-ink" : "border-line text-ink-soft hover:border-ink/40"}`}>
                      端详
                    </button>
                    <button onClick={() => setOpenId(openId === `dossier:${p.id}` ? `menu:${p.id}` : `dossier:${p.id}`)} className={`rounded-sm border border-dashed px-3 py-1.5 transition ${openId === `dossier:${p.id}` ? "border-solid border-gold bg-gold/8 text-gold" : "border-line text-ink-soft hover:border-gold/40"}`}>
                      履历详情
                    </button>
                    {/* 条件邂逅：仅在与 TA 同处一地、且年岁/性格/关系达标时才出现 */}
                    {encounters.filter((e) => e.personId === p.id).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => { if (!busy) simEvent(e.id); }}
                        disabled={busy}
                        className="rounded-sm border border-solid border-coral bg-coral/10 px-3 py-1.5 font-bold text-coral transition hover:bg-coral/20 disabled:opacity-50"
                      >
                        ✦ {e.label}
                      </button>
                    ))}
                  </div>

                  {openId === `bio:${p.id}` && (
                    <p className="story-prose mt-2.5 border-l border-line pl-3 text-[12.5px] leading-relaxed text-ink/85">{p.bio}</p>
                  )}
                  {openId === `dossier:${p.id}` && <NpcProfile pid={p.id} onClose={() => setOpenId(null)} />}
                  {openId === `intel:${p.id}` && (
                    <div className="mt-2.5 space-y-1.5 border-l border-line pl-3">
                      <p className="text-[11px] text-ink-soft">向{p.name}打听——TA 只知道与自己相关的事。</p>
                      {intel.map((it) => (
                        <div key={it.id}>
                          <button
                            onClick={() => { if (it.available && !it.unlocked) setNote(simAskIntel(p.id, it.id)); }}
                            disabled={!it.available && !it.unlocked}
                            className={`text-left text-[12.5px] font-medium transition ${it.unlocked ? "text-ink" : it.available ? "text-gold hover:brightness-110" : "cursor-not-allowed text-ink-soft"}`}
                          >
                            {it.unlocked ? "· " : it.available ? "› " : ""}{it.topic}
                            {!it.available && !it.unlocked && it.hint && <span className="ml-1 text-[11px]">（{it.hint}）</span>}
                          </button>
                          {it.unlocked && <p className="story-prose mt-1 text-[12.5px] leading-relaxed text-ink/85">{it.text}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {openId === `parley:${p.id}` && known && isManager(p.id) && (
                    <div className="mt-2.5 border-l border-coral/40 pl-3">
                      <ProducerParley pid={p.id} name={p.name} />
                    </div>
                  )}
                  {openId === `gigs:${p.id}` && known && PERSON_BY_ID[p.id]?.offers && (
                    <div className="mt-2.5 border-l border-jade/40 pl-3">
                      <GigBoard pid={p.id} name={p.name} />
                    </div>
                  )}
                </div>
              );
            })}

          </section>
        </div>
      </div>

      {/* ═══ 下半：对话框（约 1/3 屏高，内部滚动；一切点击/对话的叙事都在此显示） ═══ */}
      <div className="dream-story-panel flex h-[17vh] shrink-0 flex-col border-t border-line bg-paper/50 font-serif text-ink">
        <p className="shrink-0 border-b border-line/60 px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.3em] text-jade/70">
          对话 · 叙事
        </p>
        {/* ═══ 场景点位详情：点地图上的点位后，在对话框顶部展开描述与操作 ═══ */}
        {(() => {
          const actSel = acts.find((a) => openId === `act:${a.id}`);
          const itemSel = items.find((it) => openId === `item:${it.id}`);
          if (!actSel && !itemSel) return null;
          const close = () => { setNote(""); setOpenId(null); };
          const run = (fn: () => string) => { if (busy) return; const m = fn(); if (m) setNote(m); else close(); };
          return (
            <div className="mx-auto w-full max-w-2xl shrink-0 border-b border-line/60 bg-jade/[0.04] px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-[0.2em] text-jade/80">◆ {actSel?.name ?? itemSel?.name}</p>
                <button onClick={close} aria-label="收起" className="rounded-sm border border-dashed border-line px-2 py-0.5 text-[11px] text-ink-soft transition hover:border-jade/60 hover:text-jade">收起 ✕</button>
              </div>
              {actSel && (() => {
                const locked = !!actSel.requiresItem && !(s.bag ?? []).includes(actSel.requiresItem);
                return (
                  <>
                    <p className="story-prose text-[12.5px] leading-relaxed text-ink/85">{actSel.desc}</p>
                    <button
                      onClick={() => run(() => simActivity(actSel.id))}
                      disabled={busy}
                      className={`mt-2 rounded-sm border border-dashed px-3 py-1.5 text-[12.5px] font-medium transition disabled:opacity-50 ${
                        locked ? "border-gold/60 text-gold hover:bg-gold/10" : "border-jade/60 text-jade hover:bg-jade/10"
                      }`}
                    >
                      [ {actSel.name}{locked ? " ·需先购书" : ""} ]
                    </button>
                  </>
                );
              })()}
              {itemSel && (
                <>
                  <p className="story-prose text-[12.5px] leading-relaxed text-ink/85">{itemSel.desc}</p>
                  {itemSel.linksProjects && <ScriptDossier s={s} />}
                  {!itemSel.owned && itemSel.price ? (
                    <button
                      onClick={() => run(() => simBuy(itemSel.id))}
                      disabled={busy || s.money < itemSel.price}
                      className="mt-2 rounded-sm border border-dashed border-gold/60 px-3 py-1.5 text-[12.5px] font-medium text-gold transition hover:bg-gold/10 disabled:opacity-50"
                    >
                      [ 购买 · ¥{itemSel.price}{s.money < itemSel.price ? "（现金不足）" : ""} ]
                    </button>
                  ) : !itemSel.owned ? (
                    <button
                      onClick={() => run(() => simPickup(itemSel.id))}
                      className="mt-2 rounded-sm border border-dashed border-jade/60 px-3 py-1.5 text-[12.5px] font-medium text-jade transition hover:bg-jade/10"
                    >
                      [ 收入行囊 ]
                    </button>
                  ) : (
                    <p className="mt-2 text-[11.5px] text-ink-soft">已收入行囊。</p>
                  )}
                </>
              )}
              {note && <p className="mt-2 border-l-2 border-gold pl-2.5 text-[12px] leading-relaxed text-gold">{note}</p>}
            </div>
          );
        })()}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-1 px-3 py-1.5 font-serif text-ink [&_.space-y-3]:space-y-1 [&_.story-prose]:leading-relaxed">
          {game.story.length === 0 && !busy && (
            <p className="py-2 text-center text-sm text-ink-soft">序幕即将拉开……</p>
          )}
          {game.story.map((t) =>
            t.role === "player" ? (
              <div key={t.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-jade/90 px-3.5 py-2 text-[14px] text-paper-2 shadow-sm">
                  {t.segments.map((seg) => (seg.kind === "narration" ? seg.text : "")).join("")}
                </div>
              </div>
            ) : paceActive && lastAi && t.id === lastAi.id ? (
              <div key={t.id} className="animate-pop">
                <PacedSegments
                  segments={t.segments}
                  npcs={game.npcs}
                  playerAvatar={game.player.avatar}
                  playerName={game.player.name}
                  onAdvance={scrollToEnd}
                  onComplete={() => setReadTurnId(t.id)}
                />
              </div>
            ) : (
              <div key={t.id} className="animate-pop">
                <Segments segments={t.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
              </div>
            ),
          )}
          {busy && <LiveNarration scrollRef={scrollRef} />}
          </div>
        </div>
      </div>

      {/* ═══ 钉底：行动选项 / 输入 ═══ */}
      <div className="dream-action-bar shrink-0 border-t border-line bg-paper-2/90 px-3 py-2 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {!busy && !paceActive && game.options.length > 0 && !custom && (
            <div className="mb-2 grid gap-2">
              {game.options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => send(o.value)}
                  className="group flex items-center gap-2 rounded-sm border border-dashed border-line px-3.5 py-2.5 text-left text-[14px] text-ink transition hover:border-jade hover:bg-jade/8"
                >
                  <IconSparkle width={15} height={15} className="shrink-0 text-jade opacity-60 transition group-hover:opacity-100" />
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {custom || game.options.length === 0 ? (
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                placeholder="写下行动或台词……"
                aria-label="写下你的行动或台词"
                title="Enter 发送 / Shift+Enter 换行"
                style={{ minHeight: 42, height: 42 }}
                rows={1}
                disabled={busy}
                className="min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink outline-none transition focus:border-jade disabled:opacity-60"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                aria-label="发送"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-sm bg-jade text-paper-2 transition hover:brightness-110 disabled:opacity-40"
              >
                <IconSend width={18} height={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCustom(true)}
              disabled={busy}
              className="w-full rounded-xl border border-dashed border-line py-2 text-[13px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-50"
            >
              ✎ 自定义行动
            </button>
          )}
        </div>
      </div>

      {/* ═══ 移动确认 ═══ */}
      {pending && plan && (() => {
        const dest = locOf(pending);
        const myCar = carById(s.activeCar);
        const picked = TRANSPORT.find((m) => m.id === modeId) ?? TRANSPORT[0];
        const mode = picked.ownCar && !myCar ? (TRANSPORT.find((m) => m.id === "subway") ?? TRANSPORT[0]) : picked;
        const trip = fareFor(plan, mode);
        const afford = s.money >= trip.fee;
        const rowCls = "flex justify-between gap-3 text-[13px]";
        const blocked = !plan.reachable;
        const previewRStatus = plan.explore ? null : roomStatus(s, pending);
        return (
          <Modal title={plan.explore ? "前往探索" : blocked ? "暂时无法前往" : "确认前往"} onClose={() => { setPending(null); setCompanion(null); }}>
            <div className="space-y-3">
              <p className="font-serif text-[19px] font-black text-ink">
                {plan.explore ? `未知地点 · ${directionHint(s, pending)}` : dest?.name}
              </p>
              {!plan.explore && <p className="text-[12.5px] text-ink-soft">{dest?.func}</p>}
              {!blocked && companions.length > 0 && (
                <div className="rounded-xl border border-dashed border-jade/40 bg-jade/[0.04] px-3.5 py-3">
                  <p className="mb-2 text-[11px] font-bold tracking-widest text-jade/80">邀人同行（关系升温 · 舒缓压力）</p>
                  <div className="flex flex-wrap gap-2">
                    {companions.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCompanion(companion === c.id ? null : c.id)}
                        className={`rounded-sm border px-2.5 py-1 text-[12.5px] font-medium transition ${
                          companion === c.id ? "border-solid border-jade bg-jade/15 text-jade" : "border-dashed border-line text-ink-soft hover:border-jade/60"
                        }`}
                      >
                        {companion === c.id ? "✓ " : ""}{c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {blocked ? (
                <p className="rounded-xl border border-gold/40 bg-gold/8 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink/85">{plan.reason}</p>
              ) : (
                <div className="space-y-3 rounded-xl border border-line/70 bg-paper px-3.5 py-3">
                  {/* 交通方式：玩家自选，费用随之变化（自己的车免费） */}
                  <div>
                    <p className="mb-2 text-[11px] font-bold tracking-widest text-ink-soft">怎么去</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TRANSPORT.filter((m) => !m.ownCar || myCar).map((m) => {
                        const t = fareFor(plan, m);
                        const on = modeId === m.id;
                        const label = m.ownCar && myCar ? `开${myCar.name}` : m.label;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setModeId(m.id)}
                            title={m.note}
                            className={`rounded-sm border px-2.5 py-1.5 text-left transition ${
                              on ? "border-solid border-jade bg-jade/12" : "border-dashed border-line hover:border-jade/60"
                            }`}
                          >
                            <span className={`block text-[12.5px] font-semibold ${on ? "text-jade" : "text-ink"}`}>{label}</span>
                            <span className={`block text-[10.5px] ${t.fee > 0 ? "text-ink-soft" : "text-jade/80"}`}>{t.fee > 0 ? `¥${t.fee}` : "免费"}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-soft">
                      {mode.note}
                      {!myCar && <span className="text-gold/80"> · 想「自己开车」？去星辉 4S 汽车城买辆车，再到「主角」页选为座驾。</span>}
                    </p>
                  </div>
                  <div className={rowCls}>
                    <span className="text-ink-soft">交通费</span>
                    <span className={afford ? "text-ink" : "text-danger"}>{trip.fee > 0 ? `¥${trip.fee}` : "免费"}{afford ? "" : "（现金不足）"}</span>
                  </div>
                  {plan.explore && (() => {
                    const roamingNow = (s.schedule ?? [])[(s.day ?? 0) % 7] === "freeroam";
                    return (
                      <div className={rowCls}>
                        <span className="text-ink-soft">探索</span>
                        <span className={roamingNow ? "text-jade" : "text-danger"}>
                          {roamingNow ? "新地点 · 将点亮地图" : "当天日程需为「自由活动」"}
                        </span>
                      </div>
                    );
                  })()}
                  {previewRStatus && (
                    <div className={rowCls}><span className="text-ink-soft">营业状态</span><span className="text-ink">{previewRStatus.label}</span></div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setPending(null)} className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink transition hover:bg-line/40">{blocked ? "知道了" : "再想想"}</button>
                {!blocked && (
                  <button
                    onClick={confirmMove}
                    disabled={busy || !afford}
                    className="flex-1 rounded-lg bg-jade py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  >
                    {plan.explore ? "前往探索" : "确认前往"}
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
