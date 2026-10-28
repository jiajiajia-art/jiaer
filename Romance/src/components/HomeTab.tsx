import { wallet } from "../game/wallet";
import IntelAsk from "./IntelAsk";
import { shopPrice } from "../game/factions";
import DiyIcon from "./DiyIcon";
import { GLYPHS } from "../lib/iconGlyphs";
import { saveGlobal } from "../lib/saveScope";
import { relOf } from "../game/relations";
import { romanticCapOf } from "../worlds/star2005/content";
import { ageLabel, moodLine, ownField } from "@/lib/npcIdentity";
import { STAT_LABELS } from "../game/data";
import { limitDays } from "../lib/types";
import { resolveStart, spotUnlocked } from "../game/mapStart";
import { autoPos } from "../game/mapPos";
import { MAIN_SHEET, jumpOf, mapSheets, sheetOf } from "../game/mapSheets";
import { homePlaceOf } from "../game/homeSpot";
import { ProfileRelations, ProfileHero, RelTag, ProfileBasics, ProfileBio, ProfilePlaces, ProfileMemory, affiliationOf, PLAYER_REF, relationRefsOf } from "./personFields";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import TalkPanel from "./TalkPanel";
import { pregWeeks } from "../game/pregnancy";
import { wxResolve } from "../game/phone";
import { Segments, PacedSegments, LiveNarration, Thoughts, ErrorBanner, SpeakerAvatar, SpeechWithActions } from "./StoryTab";
import NewcomerCards from "./NewcomerCards";
import { newcomerSlots } from "../game/npcIntro";
import ProducerParley from "./ProducerParley";
import GigBoard from "./GigBoard";
import { HeartMeter, Modal, Chip, Avatar } from "./ui";
import PersonProfile from "./PersonProfile";
import { IconCheck, IconChevronDown, IconExternal, IconRefresh, IconSparkle, StarRating } from "../lib/icons";
import { repairSegments } from "../lib/ai";
import {
  roomDesc,
  directionHint,
  arcMomentHere,
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
  fareText,
  travelText,
  defaultTransport,
  transportOn,
  carShopId,
  childEntries,
  roomBgOf,
  roomParent,
  roomPath,
  roomUpLabel,
} from "../game/mud";
import { CARS, carById, resaleValue } from "../game/data";
import { BRANCH_POINTS } from "../store/GameContext";
import { tripPoints, apPerMove } from "../game/mud";
import { customActsOf, customItemsOf, firedOf, spotBackground, spotDesc, spotEventsOf, spotName, activityApCost } from "../game/mapedits";
import type { FamilyRef } from "../worlds/star2005/content";
import { LIVE_PEOPLE as PEOPLE, LIVE_PERSON_BY_ID as PERSON_BY_ID, feature, getWorldMap, getWorldRooms, getWorldStartRoom, worldActivitiesOfRoom as activitiesOfRoom } from "../mods/registry";
import { factsOf, isManager, knows, producerProjects } from "../game/producer";
import { categoryLabel, roleLabel } from "../game/projects";
import { dowOf, nextStep, pendingTodos, startDateLabel, type GameState as SimState } from "../game/logic";
import { liveTerm as T } from "../mods/live";


const fmtBonus = (b: Record<string, number>) => Object.entries(b).map(([k, v]) => `${(STAT_LABELS as Record<string, string>)[k] ?? ({ stress: "压力", mood: "心情", energy: "体力", money: "资金" } as Record<string, string>)[k] ?? k}${v > 0 ? "+" : ""}${v}`).join(" ");
/* 交通工具售卖点：买车 / 置换 / 卖车（残值回收，差价即折旧）。座驾在「主角」页选定。
 * 以弹窗形式呈现——在 4S 店点「进店选购」唤出。 */
function Dealership({ s, onClose }: { s: SimState; onClose: () => void }) {
  const { game, buyCar, sellCar, setActiveCar, busy } = useGame();
  const owned = s.cars ?? [];
  const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
  return (
    <Modal title={(game && spotName(game, carShopId() ?? "")) || locOf(carShopId() ?? "")?.name || "汽车城"} onClose={onClose} wide>
      <p className="mb-3 text-[12px] text-ink-soft">
        {wallet.name(undefined, "现金")} <b className="text-ink">{wallet.fmt(wallet.balance(s), undefined, yuan)}</b>。买车后到「主角」页把它选为座驾，出行就能「自己开车」——免费又体面。
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
                      {on ? <span className="inline-flex items-center gap-0.5 text-[10px] text-jade"><IconCheck size={10} /> 当前座驾</span> : null}
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
          const afford = wallet.can(s, c.price);
          return (
            <div key={c.id} className="rounded-sm border border-dashed border-line p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-ink">{c.name}</span>
                <Chip tone="gold">{c.tag}</Chip>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{c.desc}</p>
              {(c.buyBonus || c.tripBonus) && (
                <p className="mt-1 flex flex-wrap gap-1 text-[10.5px]">
                  {c.buyBonus && <span className="rounded-full bg-gold/12 px-1.5 py-px text-gold">购入 {fmtBonus(c.buyBonus)}</span>}
                  {c.tripBonus && <span className="rounded-full bg-jade/12 px-1.5 py-px text-jade">每次驾驶 {fmtBonus(c.tripBonus)}</span>}
                </p>
              )}
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
  const room = s.room ?? getWorldStartRoom();
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
        袋里还是空的——这里的项目你尚未打听过。找片场负责人「洽谈{T("gig")}」，问到的细节才会归档到这里。
      </p>
    );
  }
  return (
    <div className="mt-2.5 space-y-2">
      <p className="text-[11px] text-ink-soft">已归档的项目资料（问到多少记多少，翻阅不产生新进展）：</p>
      {rows.map(({ tpl, manager }) => (
        <div key={tpl.id} className="rounded-sm border border-dashed border-line p-3">
          <p className="text-[14px] font-bold text-ink">
            {knows(s, tpl.id, "starLevel") ? <><StarRating n={tpl.starLevel} className="mr-1 inline-flex align-middle" /> </> : null}
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

/* 地点实景 / 舆图点位：取自世界观模组的 map 槽（娱乐圈 = worlds/star2005/map.ts）。
 * 未声明照片的世界用中性占位底色；未声明点位的世界自动铺点。 */
const roomImage = (id: string): string | undefined => { const m = getWorldMap(); return m.photos?.[id] ?? m.defaultPhoto; };
// 横屏（橙光式）背景：同一批场景图，Unsplash 图改用顶天立地的大尺寸裁切；其他 URL 原样返回。
export const sceneImageWide = (id: string): string | undefined => {
  const url = roomImage(id);
  const pid = url?.match(/images\.unsplash\.com\/photo-([^?]+)/)?.[1];
  return pid ? `https://images.unsplash.com/photo-${pid}?w=1600&h=1000&fit=crop&auto=format&q=80` : url;
};

function MapNode({
  s,
  id,
  current,
  onPick,
  mode,
  mapEdits,
  jump,
}: {
  s: SimState;
  id: string;
  current: boolean;
  onPick: (id: string) => void;
  jump?: { name: string; go: () => void };
  mode: "panorama" | "single";
  mapEdits?: import("../lib/types").MapEdits;
}) {
  const loc = locOf(id);
  const edits = mapEdits?.[id];
  const hs = getWorldMap().hotspots?.[mode]?.[id];
  const defaultPos = hs ? { label: loc?.name ?? id, ...hs } : { ...autoPos(id, mode), label: loc?.name ?? id };

  const x = edits?.x ?? defaultPos.x;
  const y = edits?.y ?? defaultPos.y;
  const displayName = edits?.name?.trim() || defaultPos.label || loc?.name || id;

  // 突发事件：此地有未触发的剧情事件 / 条件邂逅，或当前危机发生在你所在之处
  const { game } = useGame();
  const fired = game ? firedOf(game, "spot") : [];
  const isHome = id === homeRoomOf(game);
  const alert = (game ? spotEventsOf(game, id, fired).length > 0 : false) || encountersHere(s, id, game?.npcs).length > 0 || (current && !!s.crisis);

  // 地标：主题色水滴图钉 + 地名；颜色取局部皮肤的 jade / coral，随皮肤切换。按钮外圈留出触控余量
  return (
    <button
      onClick={() => (jump ? jump.go() : onPick(id))}
      title={jump ? `进入「${jump.name}」` : isHome && !current ? `回家（${displayName}）` : current ? `${displayName}（你在这里）` : `前往「${displayName}」`}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label={`${displayName}${current ? "（你在这里）" : ""}${alert ? "（有事件）" : ""}${jump ? `，进入「${jump.name}」` : ""}`}
      className={`group absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center rounded-xl px-1.5 pt-1 transition-transform duration-200 hover:-translate-y-[calc(100%+3px)] focus-visible:z-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-jade ${current ? "z-20" : ""}`}
    >
      <span className={`mb-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-bold leading-none shadow-lg ring-1 ring-black/10 backdrop-blur-md ${
        current ? "border-coral bg-coral text-white" : "border-white/80 bg-paper/95 text-ink group-hover:border-jade group-hover:text-jade"
      }`}>
        {current && <span className="mr-1 text-[10px] font-semibold opacity-90">你在</span>}
        {isHome && <span className={`mr-1 rounded-full px-1 text-[10px] font-black ${current ? "bg-white/25" : "bg-coral/15 text-coral"}`}>家</span>}
        {displayName}{jump && <span className="ml-1 inline-flex opacity-80"><IconExternal size={10} /></span>}
      </span>
      <span className="relative">
        <svg width={current ? 26 : 21} height={current ? 33 : 27} viewBox="0 0 28 35" aria-hidden className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
          <path d="M14 1C6.8 1 1 6.6 1 13.6 1 23 14 34 14 34s13-11 13-20.4C27 6.6 21.2 1 14 1z"
            fill={current ? "var(--coral)" : "var(--jade)"} stroke="white" strokeWidth="1.6" />
          {!edits?.icon && <circle cx="14" cy="13.5" r="4.6" fill="white" />}
        </svg>
        {edits?.icon && (/^(data:|https?:|\/)/.test(edits.icon)
          ? <img src={(edits.icon) || undefined} alt="" className="pointer-events-none absolute left-1/2 top-[38%] h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover" />
          : <span className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none">{edits.icon}</span>)}
        {current && <span className="pointer-events-none absolute left-1/2 top-[34%] h-7 w-7 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-coral/30" />}
        {alert && <span className="pointer-events-none absolute -right-2 -top-1 h-[14px] w-[14px] animate-ping rounded-full bg-red-500/60" />}
        {alert && (
          <span className="absolute -right-2 -top-1 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-red-600 text-[10px] font-black leading-none text-white shadow ring-2 ring-white">
            !
          </span>
        )}
      </span>
    </button>
  );
}

/** 主角的家：开局住处（推进日子后也会回到这里）；旧存档无设定时回落到世界起点 */
export function homeRoomOf(game: import("../lib/types").GameState | null | undefined): string {
  return (game && resolveStart(game.mapEdits, game.player)) || getWorldStartRoom();
}

/* 交通方式图标（线性，随 currentColor 着色） */
function TransportIcon({ id }: { id: string }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "walk") return <svg {...p}><circle cx="13" cy="4" r="2" /><path d="m9 21 2-6 3 3v3M7 12l3-4 4 1 2 3h3M11 15l1-6" /></svg>;
  if (id === "bus") return <svg {...p}><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M4 11h16M8 21v-4M16 21v-4" /><circle cx="8" cy="14" r=".6" /><circle cx="16" cy="14" r=".6" /></svg>;
  if (id === "subway") return <svg {...p}><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 10h14M8 21l2-4M16 21l-2-4" /><circle cx="9" cy="13.5" r=".6" /><circle cx="15" cy="13.5" r=".6" /></svg>;
  if (id === "bike") return <svg {...p}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17l4-8h5l3 8M10 9l-1-3H7M12 17l3-8" /></svg>;
  if (id === "taxi") return <svg {...p}><path d="M5 17V12l2-5h10l2 5v5M3 12h18M9 4h6" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="16.5" cy="17" r="1.6" /></svg>;
  return <svg {...p}><path d="M3 16v-3l2-5h14l2 5v3H3z" /><circle cx="7" cy="16.5" r="1.8" /><circle cx="17" cy="16.5" r="1.8" /></svg>;
}

function CityMap({ s, onPick }: { s: SimState; onPick: (id: string) => void; wide?: boolean }) {
  const { game } = useGame();
  const cur = s?.room ?? getWorldStartRoom();
  const mapEdits = game?.mapEdits;
  const config = mapEdits?._config;

  // 地图显示形式：360° 全景卷轴已移除，统一一屏全貌
  const [mode, setModeRaw] = useState<"panorama" | "single">("single");
  const setMode = (fn: (m: "panorama" | "single") => "panorama" | "single") =>
    setModeRaw((m) => { const n = fn(m); saveGlobal("map-view-mode", n); return n; });
  const scrollRef = useRef<HTMLDivElement>(null);

  const worldMap = getWorldMap();
  // 多底图：箭头切换；开图时停在玩家所在地点的底图
  const sheets = mapSheets(config);
  const [sheetId, setSheetId] = useState(() => sheetOf(mapEdits, cur, sheets));
  const sheetIdx = Math.max(0, sheets.findIndex((x) => x.id === sheetId));
  const sheet = sheets[sheetIdx];
  const stepSheet = (d: number) => setSheetId(sheets[(sheetIdx + d + sheets.length) % sheets.length].id);
  const mapBg = sheet.bgUrl || (sheet.id === MAIN_SHEET ? worldMap.background : undefined);
  const mapAlt = worldMap.backgroundAlt ?? "地图";
  // 娱乐圈沿用手绘点位；其它世界观铺出全部房间（自动排布）
  // 点位跟随模组：当前世界的全部房间都上图；有手绘坐标的用手绘，没有的自动排布（叠加包新增地点也会出现）
  // 舆图只放顶层地点；子地点（正殿、禅房……）在所属地点里逐层进入
  const roomIds = Object.keys(getWorldRooms()).filter((id) => !roomParent(id));
  const hotspotIds = Object.keys(getWorldMap().hotspots?.panorama ?? {}).filter((id) => roomIds.includes(id));
  const displayNodes = [...hotspotIds, ...roomIds.filter((id) => !hotspotIds.includes(id))].filter((id) => (sheets.length < 2 || sheetOf(mapEdits, id, sheets) === sheet.id) && (id === homeRoomOf(game) || spotUnlocked(mapEdits, id, s))); // 家永远在地图上
  const jumpFor = (id: string) => {
    const to = jumpOf(mapEdits, id, sheets);
    const t = to ? sheets.find((x) => x.id === to) : undefined;
    return t ? { name: t.name, go: () => { setSheetId(t.id); scrollRef.current?.scrollTo({ left: 0 }); } } : undefined;
  };

  const handlePan = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 380;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border-b border-line bg-paper-2">
      {/* 多底图切换 */}
      {sheets.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-paper/95 p-1 shadow-lg backdrop-blur-md">
          <button type="button" onClick={() => stepSheet(-1)} aria-label="上一张底图" className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-jade/15 hover:text-jade active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-jade">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className="min-w-[6.5rem] px-1 text-center text-[13px] font-bold text-ink" aria-live="polite">
            {sheet.name}<span className="ml-1.5 text-[11.5px] font-medium text-ink-soft tabular-nums">{sheetIdx + 1}/{sheets.length}</span>
          </span>
          <button type="button" onClick={() => stepSheet(1)} aria-label="下一张底图" className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-jade/15 hover:text-jade active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-jade">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      )}

      {/* 360° 全景左右平移控制按钮 */}
      {mode === "panorama" && (
        <>
          <button
            type="button"
            onClick={() => handlePan("left")}
            aria-label="视角向左平移"
            className="group absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-lg backdrop-blur-md transition hover:border-jade hover:text-jade active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-jade"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="group-hover:-translate-x-0.5 transition-transform">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handlePan("right")}
            aria-label="视角向右平移"
            className="group absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-lg backdrop-blur-md transition hover:border-jade hover:text-jade active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-jade"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="group-hover:translate-x-0.5 transition-transform">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* 地图内容画布 */}
      {mode === "panorama" ? (
        <div ref={scrollRef} className="relative min-h-0 w-full flex-1 overflow-x-auto overflow-y-hidden scrollbar-none">
          <div className="relative h-full min-h-[240px] w-[1800px] select-none">
            {mapBg ? <img
              src={(mapBg) || undefined}
              alt={mapAlt}
              className="absolute inset-0 h-full w-full object-cover object-center opacity-100"
            /> : <div className="absolute inset-0 bg-gradient-to-br from-paper via-line/40 to-paper" />}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />

            {displayNodes.map((id) => (
              <MapNode key={id} s={s} id={id} current={id === cur} onPick={onPick} mode="panorama" mapEdits={mapEdits} jump={jumpFor(id)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative min-h-[240px] w-full flex-1 overflow-hidden select-none">
          {mapBg ? <img
            src={(mapBg) || undefined}
            alt={mapAlt}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-100"
          /> : <div className="absolute inset-0 bg-gradient-to-br from-paper via-line/40 to-paper" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />

          {displayNodes.map((id) => (
            <MapNode key={id} s={s} id={id} current={id === cur} onPick={onPick} mode="single" mapEdits={mapEdits} jump={jumpFor(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* 场景点位：叠在实景照片上的可点标记（居家活动 / 物件 / 探索）。 */
export type Spot = {
  key: string;
  label: string;
  glyph: string;
  tone: "explore" | "act" | "item" | "event";
  locked?: boolean;
  owned?: boolean;
  onClick: () => void;
};
/* 点位落点（百分比坐标）——避开底部场景名区域，散布在画面中上部。 */
/* 点位错落感：在自由区内换行排布（保证不压文字、彼此不重叠），只做轻微上下错位 */

export function SceneSpot({ spot, active, index }: { spot: Spot; active: boolean; index: number }) {
  const { look } = useGame();
  const ic = look.icons ?? {};
  const x = index * 37, y = index * 13;
  const dim = spot.tone === "item" ? spot.owned : spot.locked;
  const style = ic.spot ?? "glint";
  const size = ic.spotSize ?? (style === "glint" ? 14 : style === "dot" ? 12 : 16);
  // 点位颜色：玩家自定 → 按类型（探索珊瑚 / 事件流金 / 其余白）；选中恒为金
  const tint = active ? "var(--gold)" : ic.spotColor ?? (spot.tone === "explore" ? "var(--coral)" : spot.tone === "event" || spot.locked ? "var(--gold)" : "#fff");
  const dot = active
    ? "border-white bg-gold text-ink shadow-lg shadow-black/50 ring-2 ring-gold/50"
    : ic.spotColor ? "border-white/60"
    : spot.tone === "explore"
      ? "border-coral/70 bg-coral/90 text-white"
      : spot.tone === "event"
      ? "border-gold/80 bg-gradient-to-br from-coral to-gold text-white shadow-md shadow-black/40"
      : spot.locked
        ? "border-gold/60 bg-black/55 text-gold"
        : "border-white/45 bg-black/55 text-white";
  const SHAPE = { star: GLYPHS.star, heart: GLYPHS.heart, diamond: GLYPHS.diamond, sparkle: GLYPHS.sparkle, flower: GLYPHS.flower } as const;
  const shape = SHAPE[style as keyof typeof SHAPE];
  const mark = style === "img" && ic.spotImg
    ? <img src={ic.spotImg} alt="" style={{ width: size * 1.4, height: size * 1.4 }} className="spot-shape object-contain" />
    : shape
      ? <shape.C width={size * 1.3} height={size * 1.3} fill="currentColor" stroke="rgba(255,255,255,.85)" strokeWidth={1.2} className="spot-shape" />
      // 细小亮光：size 是星芒长度，光核约为其三成；负延迟让各点错落闪烁、首帧不跳
      : style === "glint" ? <span className={`spot-glint ${active ? "is-on" : dim ? "is-still" : ""}`} style={{ width: size, height: size, "--gc": `${Math.max(3, Math.round(size * 0.3))}px`, animationDelay: `-${(x * 37 + y * 13) % 2400}ms` } as React.CSSProperties} />
      : style === "glow" ? <span className="spot-glow block" style={{ width: size * 0.8, height: size * 0.8 }} />
      : style === "ring" ? <span className="spot-ring block" style={{ width: size, height: size }} />
      : <span className={`relative block shrink-0 rounded-full border transition ${dot} ${dim ? "" : "spot-shine"}`} style={{ width: size, height: size, animationDelay: `${(x * 37 + y * 13) % 1800}ms`, ...(ic.spotColor && !active ? { background: ic.spotColor } : {}) }} />;
  const lab = ic.spotLabel ?? "dark";
  const labCls = active ? "bg-gold text-ink"
    : lab === "light" ? `bg-white/85 text-ink ${dim ? "opacity-60" : "group-hover:bg-white"}`
    : lab === "accent" ? `bg-jade/85 text-white ${dim ? "opacity-60" : "group-hover:bg-jade"}`
    : lab === "outline" ? `border border-white/70 bg-black/10 text-white ${dim ? "opacity-60" : "group-hover:bg-black/30"}`
    : dim ? "bg-black/45 text-white/60" : "bg-black/55 text-white group-hover:bg-black/75";
  return (
    <button
      type="button"
      onClick={spot.onClick}
      aria-label={spot.locked ? `${spot.label}（未解锁）` : spot.label}
      className="group pointer-events-auto flex max-w-full items-center gap-1.5 transition active:scale-95"
    >
      <span aria-hidden className={`spot-mark ${dim ? "opacity-60" : ""}`} style={{ "--spot-c": tint } as React.CSSProperties}>{mark}</span>
      <span className={`truncate rounded-sm px-1.5 py-1 text-[11px] font-bold leading-none backdrop-blur-sm drop-shadow transition ${labCls} ${lab === "hidden" && !active ? "hidden" : ""}`}>
        {spot.label}
        {spot.locked && <span className="ml-1 text-[9px] text-gold">·未解锁</span>}
        {spot.owned && <span className="ml-1 text-[9px] opacity-60">·已收</span>}
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
function PersonCard({ name, known, active, onClick, avatar }: { name: string; role?: string; known: boolean; active: boolean; onClick: () => void; avatar?: string }) {
  // 头像式：认识显示头像+名字；未结识显示问号
  const [c1, c2] = known ? cardGrad(name) : ["#9c93b8", "#c8bfe0"];
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={known ? name : "陌生人"} className="flex w-14 shrink-0 flex-col items-center gap-1">
      <span className={`grid h-11 w-11 place-items-center overflow-hidden rounded-[10px] font-serif text-[16px] font-black text-white shadow-md ring-2 transition ${active ? "ring-coral scale-105" : "ring-white/80"}`}
        style={{ backgroundImage: `linear-gradient(150deg, ${c1}, ${c2})` }}>
        {known && avatar ? <img src={(avatar) || undefined} alt="" className="h-full w-full object-cover" /> : known ? name.slice(0, 1) : (
          // 未结识：人形剪影，比一个问号更像「有个人在这儿」
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white/90" aria-hidden><circle cx="12" cy="8.2" r="4" /><path d="M4.5 20.5c.8-4 3.9-6.3 7.5-6.3s6.7 2.3 7.5 6.3z" /></svg>
        )}
      </span>
      <span className={`max-w-full truncate rounded-full px-1.5 py-px text-[10.5px] font-bold leading-tight backdrop-blur ${active ? "bg-coral text-white" : "bg-white/80 text-ink"}`}>{known ? name : "陌生人"}</span>
    </button>
  );
}

/* 线下见面弹窗：五颗心表示关系值（满 / 半 / 空） */
/* 线下见面弹窗：互动选项卡片（图标 + 文案 + 右箭头） */
function MeetOption({ icon, label, onClick, disabled, active, highlight }: { icon?: string; label: string; onClick: () => void; disabled?: boolean; active?: boolean; highlight?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-expanded={active}
      className={`flex min-w-0 items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition hover:border-coral/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${active || highlight ? "border-coral bg-coral/10" : "border-line bg-paper"}`}>
      {icon && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-line bg-paper-2">
          <img src={(icon) || undefined} alt="" width={14} height={14} className="size-3.5" />
        </span>
      )}
      <span className={`min-w-px flex-1 truncate text-[13px] font-medium ${highlight ? "text-coral" : "text-ink"}`}>{label}</span>
      <img src="/assets/7a61d.svg" alt="" width={14} height={14} className={`size-3.5 shrink-0 transition-transform duration-200 ${active ? "rotate-90" : ""}`} />
    </button>
  );
}

/* 地点实景横幅：进入一处后展示该地实景照片 + 场景名 + 营业状态 + 可点位标记，右下角可切回星城舆图。 */
/* 地点树导航：面包屑（任意一层可点回）+ 入口区（返回上层 · 直接子地点胶囊）。只在多级地点里出现 */
function TreeNav({ s, onGo }: { s: SimState; onGo: (id: string) => void }) {
  const room = s.room ?? getWorldStartRoom();
  const path = roomPath(room);
  const kids = childEntries(s, room);
  const up = roomParent(room);
  if (path.length < 2 && !kids.length) return null;
  const upName = up ? path[path.length - 2]?.name : "";
  const pill = "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-bold backdrop-blur-md transition active:scale-95";
  return (
    <div className="mx-3 mt-2 shrink-0 space-y-1.5">
      {path.length > 1 && (
        <nav aria-label="所在位置" className="flex flex-wrap items-center gap-1 text-[11.5px]">
          {path.map((p, i) => {
            const last = i === path.length - 1;
            return (
              <span key={p.id} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="rounded-full bg-white/90 px-2.5 py-0.5 font-bold text-ink shadow">{p.name}</span>
                ) : (
                  <button type="button" onClick={() => onGo(p.id)} className="rounded-full border border-white/25 bg-black/40 px-2.5 py-0.5 text-white/90 backdrop-blur-md transition hover:bg-black/60">{p.name}</button>
                )}
                {!last && <span className="text-white/60" aria-hidden>›</span>}
              </span>
            );
          })}
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {up && (
          <button type="button" onClick={() => onGo(up)} className={`${pill} border-white/30 bg-black/50 text-white hover:bg-black/70`} title={`返回${upName}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
            {roomUpLabel(room) || `返回${upName}`}
          </button>
        )}
        {kids.map((k) => (
          <button key={k.id} type="button" onClick={() => k.ok && onGo(k.id)} disabled={!k.ok} title={k.ok ? k.desc.slice(0, 60) : k.note}
            className={`${pill} ${k.ok ? "border-white/70 bg-white/85 text-ink hover:bg-white" : "cursor-not-allowed border-white/20 bg-black/40 text-white/55"}`}>
            {!k.ok && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
            {k.name}
            {k.ok && !k.visited && <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-label="未去过" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function LocationHero({ s, spots, activeKey, onOpenMap, onGo, overlay, fill, grow, narration, novelKey, bg: bgProp, name }: { novelKey?: string; onGo?: (id: string) => void; grow?: boolean; s: SimState; spots: Spot[]; activeKey: string | null; onOpenMap: () => void; overlay?: ReactNode; fill?: boolean; narration?: ReactNode; bg?: string; name?: string }) {
  const { look: theme } = useGame(); // 实际生效外观（含剧情美化）
  // 剧情指定的背景优先；其次是玩家在「场景背景与立绘」里设的自定义背景
  const room = s.room ?? getWorldStartRoom();
  // 剧情背景 > 本地点（含子地点）自己的背景图 > 玩家自定义背景
  const bg = bgProp || roomBgOf(room) || theme.sceneBg || undefined;
  const loc = locOf(room);
  const rs = roomStatus(s, room);
  const title = name ?? loc?.name;
  // 叙事卡默认收起，只留地名条，不挡实景与点位；换地点时重新收起
  const [open, setOpen] = useState(false);
  // 剧情模式：每段新剧情到来时自动展开场景卡，直接读 AI 写的进场剧情
  useEffect(() => { if (novelKey) setOpen(true); }, [novelKey]);
  useEffect(() => { setOpen(false); }, [room]);
  // 「外出」：独立按钮打开舆图（不嵌进地名条的展开按钮里，避免 button 套 button）
  const mapBtn = (
    <button
      type="button"
      onClick={onOpenMap}
      data-tour="map"
      aria-label={`外出：打开${T("city")}舆图，选择要去的地方`}
      title="外出 · 打开舆图"
      className="flex h-[52px] min-w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/70 bg-jade px-2 text-[11.5px] font-bold leading-none text-paper-2 shadow-lg shadow-black/30 transition hover:brightness-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </svg>
      <span>外出</span>
    </button>
  );
  return (
    <div className={`relative overflow-hidden bg-jade-deep/80 shadow-inner ${fill ? "min-h-[360px] flex-1 rounded-2xl border border-white/15 shadow-2xl" : grow ? "min-h-[220px] flex-1 rounded-sm border border-line/70" : "rounded-sm border border-line/70"}`}>
      {(bg || roomImage(room)) ? <img
        src={(bg || roomImage(room)) || undefined}
        alt={title ?? "所在地"}
        loading="lazy"
        className="scene-img absolute inset-0 h-full w-full object-cover object-center"
      /> : <div className="absolute inset-0" aria-hidden />}
      <div className="scene-dim pointer-events-none absolute inset-0 bg-black" aria-hidden />
      <div className={`scene-shade pointer-events-none absolute inset-0 bg-gradient-to-b ${narration ? "from-black/10 via-transparent" : "from-black/55 via-black/10"} to-black/80`} aria-hidden />
      {/* 前景层：地名 → 描述 → 点位自由区 → 底部卡片，纵向排布互不遮挡 */}
      <div className={`z-10 flex flex-col ${fill || grow ? "absolute inset-0" : "relative min-h-[312px] sm:min-h-[340px]"}`}>
        {narration ? (
          /* 毛玻璃折叠卡：默认只显示地名条，点开看场景叙事（限高、卡内滚动），不盖住整张实景；右侧并排「外出」 */
          <div className="mx-3 mt-3 flex shrink-0 items-start gap-2">
          <div data-tour="loc" className="ui-glass min-w-0 flex-1 overflow-hidden">
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "收起场景描述" : "展开场景描述"} className="flex w-full items-center gap-2 px-3.5 py-2 text-left">
              <span className="shrink-0 text-ink"><DiyIcon slot="scene.loc" size={18}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
              </DiyIcon></span>
              {/* 地名优先完整显示；营业时段放到地名下方小字，不再挤掉地名 */}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[17px] font-black leading-tight tracking-wide">{title}</span>
                {rs.label.includes(" · ") && <span className="mt-0.5 block truncate text-[10.5px] text-ink-soft">{rs.label.split(" · ").slice(1).join(" · ")}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[10.5px] text-ink-soft">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${rs.open ? "bg-emerald-500" : "bg-amber-500"}`} />
                {rs.label.split(" · ")[0]}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 text-ink transition-transform duration-300 ${open ? "" : "rotate-180"}`}><path d="m6 15 6-6 6 6" /></svg>
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className={`${novelKey ? "max-h-[min(55vh,26rem)]" : "max-h-[min(28vh,9.5rem)]"} overflow-y-auto px-4 pb-3 [scrollbar-width:thin]`}>
                  <p className="story-prose whitespace-pre-line text-[13.5px] leading-[1.85] tracking-[0.02em] text-ink/80 [text-indent:2em]">{narration}</p>
                </div>
              </div>
            </div>
          </div>
          {mapBtn}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <p className="min-w-0 truncate px-1 py-1 font-serif text-[17px] font-black leading-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.7),0_0_14px_rgba(245,205,120,0.5)]">{title}</p>
            <div className="flex shrink-0 items-center gap-2">
              <p className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10.5px] text-white/85 backdrop-blur-md">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${rs.open ? "bg-emerald-400" : "bg-amber-400"}`} />
                {rs.label}
              </p>
              {mapBtn}
            </div>
          </div>
        )}
        {onGo && <TreeNav s={s} onGo={onGo} />}
        {/* 场景点位：只在剩余空间里排布 */}
        {fill || grow ? (
          <div data-tour="spots" className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-x-4 gap-y-3 overflow-y-auto px-4 py-3">
            {spots.map((sp, i) => <SceneSpot key={sp.key} spot={sp} active={activeKey === sp.key} index={i} />)}
          </div>
        ) : (
          /* 竖屏实景：点位自然换行、错落散布在画面里（按序号做固定偏移，不随渲染跳动）；放不下时纵向滚动 */
          <div data-tour="spots" className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-x-4 gap-y-5 overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {spots.map((sp, i) => {
              // 轻微错落：只做上下小偏移（小于行距一半），保证标签彼此不压
              const dy = [0, 6, -4, 8, -2, 5, -6][i % 7];
              const dx = 0;
              return (
                <span key={sp.key} style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                  <SceneSpot spot={sp} active={activeKey === sp.key} index={i} />
                </span>
              );
            })}
          </div>
        )}
        {overlay && <div className="pointer-events-none shrink-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-4 pt-6">{overlay}</div>}
      </div>
    </div>
  );
}

/* 人物档案卡：闲聊之外，可展开确定性生平——哪年哪月做了什么、现任/前任是谁（取自内容池与当前存档，不调用 AI；未结识也直接可见）。 */
function PersonDossier({ pid, onClose, onJump }: { pid: string; onClose: () => void; onJump?: (id: string) => void }) {
  const { game } = useGame();
  const p = PERSON_BY_ID[pid];
  const npc = game?.npcs.find((n) => n.id === pid);
  const rels = relationRefsOf(game, pid);
  const name = npc?.name ?? p?.name ?? pid;
  // 基础资料：编辑器里改过的存档值优先，其次内容池原设定；自定义人物没有原设定，直接用存档值
  const age = ageLabel(ownField(npc, "age", p?.age ? String(p.age) : undefined));
  const home = game ? homePlaceOf(game, npc, p) : undefined;
  const refNode = (refs?: FamilyRef[] | FamilyRef | null) => {
    const arr = Array.isArray(refs) ? refs : refs ? [refs] : [];
    if (!arr.length) return undefined;
    return (
      <span className="flex flex-wrap gap-1.5">
        {arr.map((r, i) => {
          const text = r.note ? `${r.name}（${r.note}）` : r.name;
          return r.id && r.id !== PLAYER_REF && onJump ? (
            <button key={i} onClick={() => onJump(r.id!)} className="inline-flex items-center gap-0.5 rounded-sm border border-dashed border-jade/50 px-1.5 text-jade transition hover:bg-jade/10">{text} <IconExternal size={10} /></button>
          ) : <span key={i} className="text-ink">{text}</span>;
        })}
      </span>
    );
  };
  return (
    <Modal title={`${name} · 人物资料`} onClose={onClose} wide>
      <ProfileHero name={name} avatarSrc={npc?.avatar || undefined} facts={{ 性别: npc?.persona?.gender ?? p?.gender, 年龄: age, 所属: affiliationOf(ownField(npc, "identity", p?.role)) }} />
      <ProfileBio bio={ownField(npc, "bio", p?.bio)} />
      {home && <ProfilePlaces places={[home]} />}
      {(npc?.id ?? p?.id) && <ProfileMemory pid={(npc?.id ?? p?.id) as string} />}
      <ProfileRelations values={{ 现任: refNode(rels.现任), 前任: refNode(rels.前任), 父母: refNode(rels.父母), 子女: refNode(rels.子女), 其他: refNode(rels.其他) }} noParents={rels.noParents} />
    </Modal>
  );
}

/* 世界 Tab：图形化房间制 MUD 主入口。
 * 星城舆图（战争迷雾）→ 点击节点看详情/确认前往 → 当前场景（在场人物·物品·行动）→ 故事线。 */
const IDEAS = ["环顾四周，看看这里", "给经纪人林宜打个电话", "翻开今天的日程本"]; // 没有剧情选项时的灵感

export default function HomeTab() {
  const { game, busy, look: theme, commitGame, submit, simMove, simVisit, simEvent, simChooseArc, simConfirmDating, simPickup, simActivity, simBuy, simAskIntel, playSpotEvent } = useGame();
  const landscape = theme.orient === "landscape";
  const [input, setInput] = useState("");
  const [ideasOpen, setIdeasOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState(false);
  // 选项面板展开时按 1~9 直接选择（输入框里打字时不拦截）
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    const opts = game?.options ?? [];
    if (!ideasOpen || busy || !opts.length) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") { setIdeasOpen(false); return; }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > opts.length) return;
      e.preventDefault();
      setIdeasOpen(false);
      setInput("");
      void submitRef.current(opts[n - 1].value.trim());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ideasOpen, busy, game?.options]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [todoOpen, setTodoOpen] = useState(false);
  const [todoDismissed, setTodoDismissed] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [companion, setCompanion] = useState<string | null>(null);
  const [modeId, setModeId] = useState<string>(() => defaultTransport().id); // 玩家所选交通方式（默认值随模组）
  const [note, setNote] = useState<string>("");
  // 进入游戏 / 开新局 / 读档：先展示主角此刻所在地点（开局即设定的开局地点）的实景，舆图从地名条旁的「外出」按钮打开
  const [showMap, setShowMap] = useState(false);
  useEffect(() => { setShowMap(false); }, [game?.id]);
  const [carShopOpen, setCarShopOpen] = useState(false); // 星辉 4S 汽车城以弹窗呈现
  // 已逐句读完的最新 AI 回合 id：初值设为载入时的最新回合，使既有历史不重新逐句、只有新回合才逐拍显示
  const [readTurnId, setReadTurnId] = useState<string | null>(() => {
    const la = [...(game?.story ?? [])].reverse().find((t) => t.role === "ai");
    return la ? la.id : null;
  });
  // 纯文字模式下整段已直接显示：记为已读，切回立绘模式时不重播
  useEffect(() => {
    if (theme.portrait !== "off") return;
    const la = [...(game?.story ?? [])].reverse().find((t) => t.role === "ai");
    if (la) setReadTurnId(la.id);
  }, [theme.portrait, game?.story]); // eslint-disable-line react-hooks/exhaustive-deps
  const scrollRef = useRef<HTMLDivElement>(null);
  // 竖屏：对话面板可收成底部细栏，把空间让给场景；有新剧情 / 开始演绎时自动展开
  const [dlgFolded, setDlgFolded] = useState(false);
  useEffect(() => { setDlgFolded(false); }, [game?.story.length]);
  useEffect(() => { if (busy) setDlgFolded(false); }, [busy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.story.length, busy, dlgFolded]);

  const s = game?.sim;
  const plan = useMemo(() => (s && pending ? travelPlan(s, pending) : null), [s, pending]);

  const [talkWith, setTalkWith] = useState<{ pid: string; name: string; role: string } | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  // 连续提示时重置计时，避免上一条的计时器把新提示提前关掉
  const flash = (t: string) => { setToast(t); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 3200); };

  // 新人物进入世界：npc 名单出现新面孔时弹出「进入世界」提示
  const seenNpc = useRef<Set<string> | null>(null);
  const [arrivals, setArrivals] = useState<{ id: string; name: string; identity: string }[]>([]);
  useEffect(() => {
    if (!game) return;
    if (!seenNpc.current) { seenNpc.current = new Set(game.npcs.map((n) => n.id)); return; }
    const fresh = game.npcs.filter((n) => !seenNpc.current!.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seenNpc.current!.add(n.id));
    setArrivals((a) => [...a, ...fresh.map((n) => ({ id: n.id, name: n.name, identity: n.identity }))]);
  }, [game?.npcs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!arrivals.length) return;
    const t = window.setTimeout(() => setArrivals((a) => a.slice(1)), 4200);
    return () => window.clearTimeout(t);
  }, [arrivals]);

  // 虚拟时间后台处理好友申请：每过一天，按好感决定同意 / 拒绝 / 继续搁置
  const lastDay = useRef(game?.sim.day);
  useEffect(() => {
    if (!game) return;
    const prev = lastDay.current;
    lastDay.current = game.sim.day;
    if (prev === undefined || game.sim.day <= prev || !(game.phone?.pending ?? []).length) return;
    let g = game;
    const msgs: string[] = [];
    for (const pid of game.phone!.pending!) {
      const r = (game.sim.rel?.[pid] ?? 0) / 100;
      const roll = Math.random();
      const nm = game.npcs.find((n) => n.id === pid)?.name ?? PERSON_BY_ID[pid]?.name ?? "对方";
      if (roll < 0.15 + r * 0.5) { g = wxResolve(g, pid, "agree"); msgs.push(`${nm} 通过了你的微信好友申请`); }
      else if (roll > 0.9 - r * 0.2) { g = wxResolve(g, pid, "reject"); msgs.push(`${nm} 没有通过你的好友申请`); }
    }
    if (g !== game) { commitGame(g); flash(msgs.join("；")); }
  }, [game?.sim.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // 新一轮选项真正可选时（逐句读完 / 剧情生成完）直接展开，不必再去点小羽毛；数字键 1~9 随之可用
  const lastAiId = game ? [...game.story].reverse().find((t) => t.role === "ai")?.id : undefined;
  const pacingNow = !!game && theme.portrait !== "off" && game.playPrefs?.mode !== "novel" && !!lastAiId && !busy && readTurnId !== lastAiId;
  const optsReady = !!game && !busy && !pacingNow && game.options.length > 0 && !custom;
  useEffect(() => { setIdeasOpen(optsReady); }, [optsReady, game?.options]);
  if (!game || !s) return null;
  const room = s.room ?? getWorldStartRoom();
  const loc = locOf(room);
  // 玩家在地图编辑器里对本点位的覆写（名称/描述/背景图/自定义物件）
  const bgOverride = spotBackground(game, room);
  const nameOverride = spotName(game, room);
  const descText = spotDesc(game, room) ?? roomDesc(room) ?? loc?.func;
  const people = mobsHere(s, room, game.npcs).filter((p) => p.present); // 含设了常驻地点的自定义 / 剧情新增人物
  const encounters = encountersHere(s, room, game.npcs); // 同处一地方可触发的条件邂逅
  // 内容池物件 + 玩家自定义物件，统一带上是否已入行囊
  const items = [
    ...itemsHere(s, room),
    ...customItemsOf(game, room).map((it) => ({ id: it.id, name: it.name, icon: it.icon ?? "", desc: it.desc, owned: (s.bag ?? []).includes(it.id), price: undefined as number | undefined, linksProjects: false })),
  ];
  const acts = [
    ...activitiesOfRoom(room),
    ...customActsOf(game, room).map((a) => {
      const lbl = (k: string) => (STAT_LABELS as Record<string, string>)[k] ?? ({ fame: "名气", looks: "容貌", stress: "压力", mood: "心情", energy: "体力", money: "资金" } as Record<string, string>)[k] ?? k;
      const valOf = (k: string) => Number((s.stats as Record<string, number>)[k] ?? (s as unknown as Record<string, unknown>)[k] ?? s.cattrs?.[k] ?? 0) || 0;
      const pay = -(a.effects?.money ?? 0);
      const lack = Object.entries(a.require ?? {}).filter(([k, v]) => valOf(k) < v);
      const used = s.actUses?.[a.id];
      const usedN = used && used.week === s.week ? used.n : 0;
      const tags = [
        pay > 0 ? `${wallet.fmt(pay)}${!wallet.can(s, pay) ? "（钱不够）" : ""}` : "",
        ...Object.entries(a.effects ?? {}).filter(([k, v]) => k !== "money" && v).map(([k, v]) => `${lbl(k)}${v > 0 ? "+" : ""}${v}`),
        ...Object.entries(a.require ?? {}).map(([k, v]) => `${lack.some(([x]) => x === k) ? "未达成 " : ""}${lbl(k)}≥${v}`),
        a.perWeek ? `本周 ${usedN}/${a.perWeek}` : "",
        a.id.startsWith("good_") && (s.bag ?? []).includes(a.id) ? "已在行囊" : "",
      ].filter(Boolean);
      const base = a.hint || (a.id.startsWith("good_") ? "" : a.prompt) || `在此地进行「${a.label}」`;
      return {
      id: a.id,
      name: a.label,
      icon: a.id.startsWith("good_") ? "¥" : "",
      desc: [base, tags.join(" · ")].filter(Boolean).join(" ｜ "),
      msg: `你进行了「${a.label}」${a.hint ? `（${a.hint}）` : ""}。`,
      requiresItem: undefined as string | undefined,
      };
    }),
  ];
  // 玩家在此点位自建的剧情事件（一次性事件触发后隐去；已收进剧情志的按 srcId 判定）
  const spotEvents = spotEventsOf(game, room, firedOf(game, "spot"));
  // 当前被点选的人物（点石牌弹出行动条：交谈/洽谈/打听/端详）
  // 前缀须覆盖行动条里所有子面板（含接洽通告 gigs / 档案 dossier / 情感线 arc），否则点开即被当成关闭
  const activePid = openId && /^(menu|bio|intel|parley|gigs|dossier|arc):/.test(openId) ? openId.slice(openId.indexOf(":") + 1) : null;
  /* 在场人物卡片：onImage=浮于实景图（横屏）；否则作为实景下方的独立卡片行（竖屏）。无人时不显示 */
  const peopleStrip = (onImage: boolean) => people.length > 0 ? (
    <div className={onImage ? "pointer-events-auto" : "mt-3 px-1"}>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1.5 pb-1.5 pt-1.5 [scrollbar-width:none]">
        {people.map((p) => {
          const active = activePid === p.id;
          return (
            <PersonCard key={`p:${p.id}`} name={p.name} role="" known={(s.metPeople ?? []).includes(p.id)}
              avatar={game?.npcs.find((n) => n.id === p.id)?.avatar || undefined}
              active={active} onClick={() => setOpenId(active ? null : `menu:${p.id}`)} />
          );
        })}
      </div>
    </div>
  ) : null;

  // 场景点位：探索 + 居家活动 + 物件，铺在实景照片上作可点标记
  // 「踩点」只在该地定义了专属行动时出现；没有定义的地点点进去只会得到空结果，故不显示
  const exploreLabel = loc?.action?.split(/[：:]/)[0]?.trim();
  const spots = [
    ...(exploreLabel ? [{
      key: "explore",
      label: exploreLabel,
      glyph: "",
      tone: "explore" as const,
      onClick: () => { if (!busy) setNote(simVisit(room)); },
    }] : []),
    // 本周日程不再作为场景点位出现：由底栏「推进」唤出；舆图改由地名条旁的「外出」按钮打开，也不再占场景点位
    // 剧情事件：点击进入支线（入口扣体力，支线内行动免体力），结束后落入剧情志
    ...spotEvents.map((ev) => ({
      key: `evt:${ev.id}`,
      label: ev.title,
      glyph: "",
      tone: "event" as const,
      onClick: () => { if (!busy) playSpotEvent(ev.id); },
    })),
    ...acts.map((a) => ({
      key: `act:${a.id}`,
      label: a.name,
      glyph: "",
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
        glyph: "",
        tone: "item" as const,
        owned: it.owned,
        onClick: () => setOpenId(openId === `item:${it.id}` ? null : `item:${it.id}`),
      })),
  ];

  // 立绘模式 = galgame 式逐句显示：最新 AI 回合未读完前，一句一句轻触推进，读完才浮现选项。
  // 纯文字模式不走逐句对话框，整段剧情直接铺在叙事流里，选项立刻可选。
  const lastAi = [...game.story].reverse().find((t) => t.role === "ai");
  const introSlots = newcomerSlots(game.story); // 初遇名片挂在该人物最近一次登场的回合底部
  // 剧情模式（小说模式）= AI 文游：不走逐句对话框，最新剧情整段铺进地点描述卡里
  const novelMode = game.playPrefs?.mode === "novel";
  const novelProse = novelMode && lastAi && !lastAi.error
    ? lastAi.segments.map((g) => g.kind === "dialogue" ? `${g.speaker}：“${g.text}”` : g.text).filter(Boolean).join("\n")
    : "";
  const galMode = theme.portrait !== "off" && !novelMode;
  const novelDock = novelMode && !busy; // 小说模式非书写期：底部只留输入栏
  const paceActive = galMode && !!lastAi && !busy && readTurnId !== lastAi.id;
  const hasOpts = !busy && !paceActive && game.options.length > 0 && !custom;
  const folded = dlgFolded && !landscape;
  // 收起态细栏里显示的「最后一句剧情」
  const lastLine = (() => {
    const segs = lastAi && !lastAi.error ? repairSegments(lastAi.segments) : [];
    const seg = [...segs].reverse().find((x) => x.text?.trim());
    if (!seg) return { who: "", text: game.story.length ? "剧情已收起" : "故事尚未开始" };
    const text = seg.text.replace(/\s+/g, " ").trim();
    return { who: seg.kind === "dialogue" ? seg.speaker : "", text };
  })();
  const scrollToEnd = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    setCustom(false);
    void submit(text.trim());
  };
  // 地点树内逐层进出：免路费、免行动点，不弹出行面板；去不了时就地提示原因
  const goLocal = (id: string) => {
    if (busy || !s) return;
    const p = travelPlan(s, id);
    if (!p.reachable) { flash(p.reason ?? "去不了那里。"); return; }
    simMove(id);
    setOpenId(null);
  };
  const confirmMove = () => {
    if (!pending || busy || !plan) return;
    const myCar = feature("cars") ? carById(s?.activeCar) : undefined; // 座驾包关闭：已有车辆也不能开
    const picked = TRANSPORT.find((m) => m.id === modeId) ?? TRANSPORT[0];
    const mode = picked.ownCar && !myCar ? defaultTransport() : picked;
    const t = fareFor(plan, mode);
    simMove(pending, companion ?? undefined, { fee: t.fee, minutes: t.minutes, modeLabel: mode.label, ownCar: !!mode.ownCar }); // 抵达叙事已落入下方对话框
    setPending(null);
    setCompanion(null);
    setOpenId(null);
    setNote("");
    setShowMap(false); // 抵达新地点后收起舆图，直接看新场景实景
  };
  // 可邀同行者：此刻与你同处一地、已结识、关系≥20 的在场人物
  const companions = people.filter((p) => (s.metPeople ?? []).includes(p.id) && (s.rel?.[p.id] ?? 0) >= 20);
  // 线下【对话】：同处一地才可发起；离开此地由面板自行强制结束


  const daysLeft = game.timeLimit ? Math.max(0, limitDays(game.timeLimit, game.startDate || startDateLabel()) - s.day) : null;
  const TONE = { coral: "var(--coral)", gold: "var(--gold)", jade: "var(--jade)" };

  return (
    <div className="flex h-full flex-col">
      {/* 上半：场景 + 星城舆图（占据剩余空间，独立滚动） */}
      {/* 看场景时上半只占内容高度，余下空间留给对话框；看地图时地图占满 */}
      <div className={`story-scene-scroll flex min-h-0 flex-col overflow-y-auto ${showMap || landscape || folded || novelDock ? "flex-1" : "shrink grow-0"}`}>
        <div className={`mx-auto flex w-full min-h-0 flex-1 flex-col space-y-5 ${landscape && !showMap ? "max-w-none px-3 py-3" : landscape && showMap ? "max-w-5xl px-4 py-5" : "max-w-2xl px-4 py-3"}`}>
          {/* ═══ 当前场景（纯文字 MUD 控制台，直接铺在纸面上） ═══ */}
          <section className="flex min-h-0 flex-1 flex-col">
            {/* 待办：悬而未决的事件线（违约追责 / 危机 / 通告截止 / 透支 / 孕期），保证每条线都有可见的后续；情感线由玩家自己去推进，不在这里催 */}
            {/* 主线「下一步」：进入游戏即可见，紧急事项优先 */}
            {!showMap && !busy && (() => {
              const n = nextStep(s);
              return (
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("star:navtab", { detail: "quest" }))}
                  className="mb-2 flex w-full items-start gap-2.5 rounded-2xl border border-coral/25 bg-paper/80 px-3 py-2 text-left shadow-[0_4px_16px_-8px_rgba(0,0,0,0.25)] backdrop-blur-md transition hover:border-coral/50">
                  <span className="mt-0.5 shrink-0 rounded-full bg-coral px-2 py-0.5 text-[10px] font-black tracking-[0.14em] text-white">主线</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-snug text-ink">{n.title}</span>
                    <span className="block text-[11.5px] leading-snug text-ink-soft">{n.hint}</span>
                  </span>
                  <span aria-hidden className="self-center text-[12px] text-ink-soft">›</span>
                </button>
              );
            })()}
            {!showMap && (() => {
              const todos = pendingTodos(s);
              const sig = todos.map((t) => t.id).join("|");
              if (!todos.length || todoDismissed === sig) return null; // 关闭后，出现新事项才再次提示
              const C = { danger: "var(--danger, #c0392b)", gold: "var(--gold)", jade: "var(--jade)" };
              const urgent = todos.some((t) => t.tone === "danger");
              return (
                <div className="mb-2 flex flex-col items-start">
                  <div className="flex items-center gap-1 rounded-full border border-white/40 bg-paper/70 py-1 pl-3 pr-1 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.25)] backdrop-blur-md">
                    <button onClick={() => setTodoOpen((v) => !v)} className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-ink" aria-expanded={todoOpen}>
                      <span className={`inline-block h-2 w-2 rounded-full ${urgent ? "animate-pulse" : ""}`} style={{ background: C[urgent ? "danger" : todos[0].tone] }} />
                      <span>待办 · {todos.length}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${todoOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                    <button onClick={() => { setTodoDismissed(sig); setTodoOpen(false); }} aria-label="关闭待办" className="grid h-6 w-6 place-items-center rounded-full text-ink-soft transition hover:bg-ink/10 hover:text-ink">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                  {todoOpen && (
                    <ul className="mt-2 w-full space-y-1 rounded-2xl border border-white/40 bg-paper/80 p-2 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.3)] backdrop-blur-md">
                      {todos.map((t) => (
                        <li key={t.id} className="flex items-start gap-2 rounded-xl px-2 py-1.5 text-[12px] leading-snug text-ink/90" style={{ background: `color-mix(in srgb, ${C[t.tone]} 8%, transparent)` }}>
                          <span className="mt-[5px] inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C[t.tone] }} />
                          <span>{t.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}
            {/* 地点名已在顶部栏呈现，此处不再重复，直接以场景描述开篇；横屏沉浸态让实景铺满，描述改为图内旁白 */}
            <p className={`story-prose text-[13.5px] leading-relaxed text-ink/90 hidden`} style={{ textIndent: "2em" }}>
              {descText}
            </p>
            <div className={landscape && !showMap ? "flex min-h-0 flex-1 flex-col" : showMap ? "-mx-4 -mt-3 -mb-3 flex min-h-0 flex-1 flex-col sm:-mx-6" : descText ? "flex min-h-0 flex-1 flex-col" : "mt-4 flex min-h-0 flex-1 flex-col"}>
              {showMap ? (
                <div data-tour="map" className="relative flex min-h-0 w-full flex-1 flex-col">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-paper-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-[16px] font-black leading-tight text-ink">{T("city")}舆图</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">点地点即可前往 · 换地点会扣行动点</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMap(false)}
                      className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-bold text-paper-2 shadow-md transition hover:brightness-125 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      <span>返回此地</span>
                    </button>
                    {homeRoomOf(game) !== room && (
                      <button type="button" disabled={busy} onClick={() => setPending(homeRoomOf(game))}
                        className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-coral/40 bg-paper px-4 text-[13.5px] font-bold text-coral shadow-md transition hover:bg-coral/10 active:scale-95 disabled:opacity-50">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></svg>
                        <span>回家</span>
                      </button>
                    )}
                  </div>
                  <CityMap s={s} wide={landscape} onPick={(id) => (id === room ? setShowMap(false) : setPending(id))} />
                </div>
              ) : (
                <LocationHero
                  s={s}
                  spots={spots}
                  activeKey={openId}
                  onOpenMap={() => setShowMap(true)}
                  onGo={goLocal}
                  fill={landscape && !showMap}
                  bg={bgOverride}
                  name={nameOverride}
                  narration={novelProse || descText}
                  novelKey={novelProse ? lastAi?.id : undefined}
                  overlay={peopleStrip(true)}
                />
              )}
            </div>

            {/* 竖屏：实景下方是「在场人物」卡片 */}
            {/* 竖屏的在场人物也叠在实景图底部，不再另占一行 */}

            {/* 居家活动 / 物件的详情与操作已改到下半部分「对话框」里展开（见下方场景点位卡片） */}

            {room === carShopId() && feature("cars") && (
              <div className="mt-3 rounded-sm border border-dashed border-gold/50 bg-gold/[0.04] p-3">
                <p className="mb-1 text-[11px] font-bold tracking-widest text-gold/80">{locOf(room)?.name}</p>
                <p className="mb-2.5 text-[12px] text-ink-soft">这里可以购买属于自己的交通工具。要不要进去挑一挑？</p>
                <button
                  onClick={() => setCarShopOpen(true)}
                  className="rounded-sm border border-solid border-gold bg-gold/10 px-3 py-1.5 text-[12px] font-semibold text-gold transition hover:bg-gold/20"
                >
                  进店选购 →
                </button>
              </div>
            )}
            {carShopOpen && room === carShopId() && feature("cars") && <Dealership s={s} onClose={() => setCarShopOpen(false)} />}

            {!showMap && ((daysLeft !== null && !landscape) || s.pregnancy?.known || (s.children?.length ?? 0) > 0) && (
              <p className="mt-3 flex flex-wrap gap-x-2 text-[11.5px] text-ink-soft">
                {daysLeft !== null && !landscape && <span>主线剩 <b className="tabular-nums" style={{ color: "var(--coral)" }}>{daysLeft}</b> 天</span>}
                {s.pregnancy?.known && <span>· 孕 <b className="tabular-nums" style={{ color: "var(--coral)" }}>{pregWeeks(s)}</b> 周（{s.pregnancy.fatherName}）</span>}
                {(s.children?.length ?? 0) > 0 && <span>· 子女 {s.children!.map((c) => c.name).join("、")}</span>}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ═══ 下半：对话·叙事 面板（完全跟随全局皮肤换肤，高级柔光卡片） ═══ */}
      <div data-tour="story" data-dstyle={theme.dialogStyle ?? "soft"}
        className={novelDock
          // 小说模式：正文已整段铺在上方，底部不要对话框，只留一条贴底的输入栏（选项 + 自由输入）
          ? "relative mx-4 mb-3 mt-2 flex shrink-0 flex-col text-ink sm:mx-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl"
          : `dialogue-panel mt-2 flex flex-col border border-line/70 text-ink relative overflow-hidden transition-colors duration-300 ${
          landscape
            ? "mx-3 mb-3 shrink-0 px-4 py-3"
            : folded
              ? "mx-4 mb-4 shrink-0 px-3.5 py-2 sm:mx-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl"
              : showMap
                ? "mx-4 mb-4 shrink-0 px-4 pb-3.5 pt-2.5 sm:mx-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl"
                : "mx-4 mb-4 min-h-0 flex-1 px-4 pb-3.5 pt-2.5 sm:mx-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl"
        }`}
        style={novelDock ? undefined : { borderRadius: theme.dialogRadius ?? 20, ...(folded ? {} : (() => {
          const h = ({ low: { height: "24vh", minHeight: 170, maxHeight: 240 }, std: { height: "31vh", minHeight: 205, maxHeight: 310 }, high: { height: "42vh", minHeight: 265, maxHeight: 440 } } as const)[theme.dialogHeight ?? "std"];
          // 竖屏看场景：对话框吃掉剩余空间，设定高度作为下限
          return showMap || landscape ? h : { minHeight: h.minHeight };
        })()) }}>
        {!novelDock && <><div className="dlg-glow pointer-events-none absolute -right-14 -bottom-14 h-40 w-40 rounded-full bg-gradient-to-br from-coral/20 to-jade/10 blur-3xl" />
        <div className="dlg-glow pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-gradient-to-br from-jade/18 to-transparent blur-3xl" /></>}

        {/* 展开态独立顶栏：左状态微标 + 中间独立折叠把手（不遮挡下方文字） */}
        {!novelDock && !folded && (!landscape || busy) && (
          <div className="relative z-10 mb-1.5 flex shrink-0 items-center justify-between">
            <div className="flex min-w-[64px] items-center">
              {busy ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-jade/12 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-jade">
                  <span className="h-1.5 w-1.5 rounded-full bg-jade animate-pulse" />
                  演绎中…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium tracking-[0.14em] text-ink-soft/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] opacity-75" />
                  剧情纪事
                </span>
              )}
            </div>
            {!landscape && (
              <button
                type="button"
                onClick={() => setDlgFolded(true)}
                aria-label="收起剧情面板"
                aria-expanded
                className="group flex items-center gap-1 rounded-full px-3 py-0.5 text-[10.5px] text-ink-soft/60 transition hover:bg-jade/10 hover:text-jade"
              >
                <span className="h-1 w-6 rounded-full bg-ink-soft/25 transition group-hover:bg-jade/50" />
                <svg width="11" height="7" viewBox="0 0 14 8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m2 2 5 4 5-4" />
                </svg>
              </button>
            )}
            <div className="min-w-[64px]" />
          </div>
        )}

        {folded && (
          <button type="button" onClick={() => setDlgFolded(false)} aria-label="展开剧情面板" aria-expanded={false}
            className="relative flex w-full items-center gap-2 py-0.5 text-left">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-[var(--jade)] to-[var(--coral)]" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] leading-snug text-ink/85">
              {lastLine.who && <b className="mr-1 font-bold text-jade">{lastLine.who}</b>}
              {lastLine.text}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-jade/10 py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-jade">
              展开
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 15 6-6 6 6" /></svg>
            </span>
          </button>
        )}

        {/* 点位操作信息（若有） */}
        {(() => {
          const actSel = acts.find((a) => openId === `act:${a.id}`);
          const itemSel = items.find((it) => openId === `item:${it.id}`);
          if (!actSel && !itemSel) return null;
          const close = () => { setNote(""); setOpenId(null); };
          const run = (fn: () => string) => { if (busy) return; const m = fn(); if (m) setNote(m); else close(); };
          const btn = "mt-4 w-full rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] py-2.5 text-[13.5px] font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50";
          return (
            <Modal title={actSel?.name ?? itemSel?.name ?? ""} onClose={close}>
              <div className="text-center [&_p]:text-[13px] [&_p]:leading-relaxed">
              {actSel && (
                <>
                  <p className="text-[12px] text-ink-soft">{actSel.desc}</p>
                  {(() => {
                    const cost = activityApCost(game, room, actSel.id);
                    const short = tripPoints(s) < cost;
                    // 与结算逻辑（doActivity）同口径：缺道具 / 现金不足时直接说明并禁用，而不是点了才失败
                    const ex = actSel as { requiresItem?: string; lockedMsg?: string; money?: number };
                    const lockedNow = !!ex.requiresItem && !(s.bag ?? []).includes(ex.requiresItem);
                    const fee = ex.money && ex.money < 0 ? -ex.money : 0;
                    const broke = !wallet.can(s, fee);
                    return (
                      <>
                        {lockedNow && <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-[12px] text-ink">{ex.lockedMsg ?? "还差点什么才能做这件事。"}</p>}
                        <p className="mt-3 text-[12px] font-bold text-jade-deep">
                          {cost > 0 ? `消耗 ${cost} 行动点 · 剩余 ${tripPoints(s)}` : "不消耗行动点"}
                          {fee > 0 && <span className={broke ? "text-coral" : ""}> · 花费 ¥{fee}</span>}
                        </p>
                        <button type="button" onClick={() => run(() => simActivity(actSel.id))} disabled={busy || short || lockedNow || broke} className={btn}>
                          {lockedNow ? "尚未解锁" : short ? "行动点不足" : broke ? "现金不足" : busy ? "剧情进行中…" : actSel.name}
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
              {itemSel && (
                <>
                  <p className="text-[12px] text-ink-soft">{itemSel.desc}</p>
                  {!itemSel.owned && itemSel.price ? (
                    <button type="button" onClick={() => run(() => simBuy(itemSel.id))} disabled={busy || !wallet.can(s, shopPrice(s, itemSel.price))} className={btn}>
                      {!wallet.can(s, shopPrice(s, itemSel.price)) ? `${wallet.name(undefined, "现金")}不足（余 ${wallet.fmt(wallet.balance(s))}）· ` : ""}购买 · ¥{shopPrice(s, itemSel.price)}{shopPrice(s, itemSel.price) !== itemSel.price && <s className="ml-1 opacity-60">¥{itemSel.price}</s>}
                    </button>
                  ) : !itemSel.owned ? (
                    <button type="button" onClick={() => run(() => simPickup(itemSel.id))} disabled={busy} className={btn}>
                      收入行囊
                    </button>
                  ) : (
                    <p className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-full bg-paper py-2 text-[12px] text-ink-soft"><IconCheck size={14} /> 已在行囊中</p>
                  )}
                </>
              )}
                {note && <p className="mt-2 text-[12px] text-coral">{note}</p>}
              </div>
            </Modal>
          );
        })()}

        {/* 内部主区：空幕时居中「序幕」邀约，有剧情时胶卷盘 + 内容流 */}
        {folded || novelDock ? null : novelMode ? (
          /* 剧情模式：剧情已整段铺在上方地点卡里，这里只留输入框与选项 */
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {busy && (
              <div ref={scrollRef} className="dialogue-scroll max-h-full w-full overflow-y-auto py-1 pr-1">
                <LiveNarration scrollRef={scrollRef} />
              </div>
            )}
          </div>
        ) : game.story.length === 0 && !busy ? (
          <div className="min-h-0 flex-1" />
        ) : (
          <div className="relative flex min-h-0 flex-1 items-stretch gap-3">
            {paceActive && lastAi && !lastAi.error ? (
              <GalPlayer key={lastAi.id} turn={lastAi} npcs={game.npcs} playerName={game.player.name} playerAvatar={game.player.avatar} introIds={introSlots.get(lastAi.id)} onDone={() => setReadTurnId(lastAi.id)} />
            ) : (
            <div ref={scrollRef} className="dialogue-scroll h-full min-h-0 min-w-0 flex-1 overflow-y-auto py-1 pr-1">
              <div className="space-y-3">
                {game.story.map((t) =>
                  t.role === "player" ? (
                    <div key={t.id} className="flex justify-end">
                      <div className="dlg-bubble-me max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-3.5 py-2 text-[13.5px] text-white shadow-sm font-medium">
                        {t.segments.map((seg) => (seg.kind === "narration" ? seg.text : "")).join("")}
                      </div>
                    </div>
                  ) : t.error ? (
                    <ErrorBanner key={t.id} error={t.error} />
                  ) : (
                    <div key={t.id} className="text-[13px] text-ink leading-relaxed">
                      <Segments segments={t.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
                      <Thoughts thoughts={t.thoughts} npcs={game.npcs} />
                      <NewcomerCards ids={introSlots.get(t.id)} />
                      {t.id === lastAi?.id && !busy && <TurnTools onReplay={galMode ? () => setReadTurnId(null) : undefined} />}
                    </div>
                  )
                )}
                {busy && <LiveNarration scrollRef={scrollRef} />}
              </div>
            </div>
            )}
          </div>
        )}

        {/* 人物互动：点人物后行动条直接出现在对话框里，结果落入下方叙事 */}
            {people.map((p) => {
              if (activePid !== p.id) return null;
              const known = (s.metPeople ?? []).includes(p.id);
              const intel = known ? intelOf(s, p.id) : [];
              // 情感线这一段：只在与 TA 当面、时机到了且今天还没经历过一段时出现
              const arcNow = arcMomentHere(s, room, p.id, game.npcs);
              return (
                <Modal key={p.id} title="线下见面" onClose={() => setOpenId(null)}>
                <div className="relative">
                  <PersonProfile pid={p.id} name={p.name} known={known} />
                  {/* 互动区 */}
                  <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                    <p className="font-serif text-[14px] font-semibold text-ink">互动</p>
                    <div className="grid grid-cols-2 gap-2">
                      <MeetOption icon="/assets/b058c.svg" label="对话" disabled={busy} onClick={() => setTalkWith({ pid: p.id, name: p.name, role: p.role })} />
                      {/* 查看 / 接洽通告属于「演艺事业包」：未启用时不出现，避免关掉扩展包仍能接单 */}
                      {known && feature("career") && isManager(p.id) && (
                        <MeetOption icon="/assets/1cddb.svg" label={`查看${T("gig")}`} active={openId === `parley:${p.id}`}
                          onClick={() => setOpenId(openId === `parley:${p.id}` ? `menu:${p.id}` : `parley:${p.id}`)} />
                      )}
                      {/* 接洽通告：当面查看 TA 手上的通告（内容/男女主配/角色/固定档期）并就地交涉接单 */}
                      {known && feature("career") && PERSON_BY_ID[p.id]?.offers && (
                        <MeetOption icon="/assets/78511.svg" label={`接洽${T("gig")}`} active={openId === `gigs:${p.id}`}
                          onClick={() => setOpenId(openId === `gigs:${p.id}` ? `menu:${p.id}` : `gigs:${p.id}`)} />
                      )}
                      {known && (
                        <MeetOption icon="/assets/b974e.svg" label="打听" active={openId === `intel:${p.id}`}
                          onClick={() => setOpenId(openId === `intel:${p.id}` ? `menu:${p.id}` : `intel:${p.id}`)} />
                      )}
                      {/* 条件邂逅：仅在与 TA 同处一地、且年岁/性格/关系达标时才出现 */}
                      {encounters.filter((e) => e.personId === p.id).map((e) => (
                        <MeetOption key={e.id} label={e.label} highlight disabled={busy} onClick={() => { if (!busy) simEvent(e.id); }} />
                      ))}
                      {arcNow && (
                        <MeetOption label={arcNow.stage ? arcNow.stage.name : "确认关系"} highlight active={openId === `arc:${p.id}`} disabled={busy}
                          onClick={() => setOpenId(openId === `arc:${p.id}` ? `menu:${p.id}` : `arc:${p.id}`)} />
                      )}
                    </div>
                  </div>

                  {/* 展开的子面板在按钮网格下方，自动滚入视野，免得点了「打听 / 通告」以为没反应 */}
                  {openId && openId !== `menu:${p.id}` && <span key={openId} aria-hidden ref={(el) => { el?.nextElementSibling?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }} />}
                  {openId === `dossier:${p.id}` && <PersonDossier pid={p.id} onClose={() => setOpenId(`menu:${p.id}`)} />}
                  {/* 情感线：固定分支、确定性结算（不交给 AI 自由发挥），选完关掉行动条，结果由「情感线推进」弹窗呈现 */}
                  {openId === `arc:${p.id}` && arcNow && (
                    <div className="mt-2.5 border-l border-coral/40 pl-3">
                      <p className="text-[14px] font-bold text-ink">{arcNow.stage ? `第 ${arcNow.stage.id} 段 · ${arcNow.stage.name}` : `和${p.name}确认关系`}</p>
                      <p className="mt-0.5 text-[12px] text-ink-soft">{arcNow.stage ? `${p.name}就在眼前——你会怎么做？` : `火候到了。确认后获得专属状态「${arcNow.buff}」。`}</p>
                      <div className="mt-2 space-y-2">
                        {arcNow.stage ? arcNow.stage.choices.map((c, i) => (
                          <button key={i} type="button" disabled={busy} onClick={() => { if (!busy) { setOpenId(null); simChooseArc(p.id, i); } }}
                            className="block w-full rounded-xl border border-dashed border-line p-3 text-left transition hover:border-coral hover:bg-coral/5 disabled:cursor-not-allowed disabled:opacity-50">
                            <p className="text-[14px] font-medium text-ink">{c.label}</p>
                            <p className="mt-0.5 text-[12px] text-ink-soft">→ {c.result}</p>
                          </button>
                        )) : (
                          <button type="button" disabled={busy} onClick={() => { if (!busy) { setOpenId(null); simConfirmDating(p.id); } }}
                            className="w-full rounded-xl border border-dashed border-coral bg-coral/10 py-3 text-sm font-semibold text-coral transition hover:bg-coral/20 disabled:cursor-not-allowed disabled:opacity-50">确认交往</button>
                        )}
                      </div>
                    </div>
                  )}
                  {openId === `intel:${p.id}` && known && <IntelAsk pid={p.id} name={p.name} role={p.role} intel={intel} />}
                  {openId === `parley:${p.id}` && known && feature("career") && isManager(p.id) && (
                    <div className="mt-2.5 border-l border-coral/40 pl-3">
                      <ProducerParley pid={p.id} name={p.name} />
                    </div>
                  )}
                  {openId === `gigs:${p.id}` && known && feature("career") && PERSON_BY_ID[p.id]?.offers && (
                    <div className="mt-2.5 border-l border-jade/40 pl-3">
                      <GigBoard pid={p.id} name={p.name} />
                    </div>
                  )}
                </div>
                </Modal>
              );
            })}

        {/* ═══ 行动输入区：与对话内容合并进同一张柔光卡片 ═══ */}
        <div className={`relative mt-2 pt-1 ${folded ? "hidden" : ""}`}>
          {ideasOpen && (
            <div id="action-ideas" className="mb-2 animate-pop">
              <p className="mb-2 flex items-center justify-between px-0.5 text-[10.5px] font-semibold tracking-[0.18em] text-jade-deep/70">
                <span className="flex items-center gap-1.5">
                  <IconSparkle width={11} height={11} />
                  {hasOpts ? "剧情选项" : "行动灵感"}
                  <span className="font-normal tracking-normal text-ink-soft/55">{hasOpts ? "点选或按数字键" : "点一下填入"}</span>
                </span>
                <button type="button" onClick={() => setIdeasOpen(false)} aria-label="收起选项" className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-coral/10 hover:text-coral">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M2 2l8 8M10 2l-8 8" /></svg>
                </button>
              </p>
              <div className="grid max-h-[36vh] gap-1.5 overflow-y-auto">
                {(hasOpts ? game.options.slice(0, 3) : IDEAS.map((t) => ({ label: t, value: t }))).map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setIdeasOpen(false); if (hasOpts) send(o.value); else { setInput(o.value); inputRef.current?.focus(); } }}
                    className="option-btn group flex items-center gap-2.5 rounded-xl border border-jade/12 bg-paper/70 py-2 pl-2 pr-3 text-left text-[13px] leading-snug text-ink shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-jade/35 hover:bg-paper active:scale-[0.99]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jade/10 text-[11px] font-semibold tabular-nums text-jade transition group-hover:bg-jade group-hover:text-paper">
                      {hasOpts ? <kbd className="font-sans">{i + 1}</kbd> : <IconSparkle width={11} height={11} />}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{o.label}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 -translate-x-1 text-jade opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="action-capsule flex items-center gap-2 rounded-2xl border border-jade/20 p-1.5 backdrop-blur-xl transition-all duration-300">
            <div className="flex flex-1 items-center gap-2 pl-0.5">
              {/* 小羽毛：有剧情选项时展开选项（点选即发送），没有时展开灵感（点选填入输入框） */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIdeasOpen((v) => !v)}
                  aria-label={hasOpts ? `展开剧情选项（${Math.min(game.options.length, 3)} 个）` : "灵感提示"}
                  aria-expanded={ideasOpen}
                  aria-controls="action-ideas"
                  className={`flex h-8 items-center justify-center gap-1 rounded-xl transition ${
                    ideasOpen
                      ? "bg-gradient-to-r from-jade/20 to-coral/20 px-2.5 text-jade-deep ring-1 ring-jade/30"
                      : hasOpts
                        ? "bg-gradient-to-r from-coral/14 to-jade/12 px-2.5 text-coral hover:from-coral/22 hover:to-jade/18 ring-1 ring-coral/25"
                        : "w-8 bg-jade/[0.08] text-jade/85 hover:bg-jade/15"
                  }`}
                >
                  <DiyIcon slot="input.pen" size={15}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L3 12.5V21h8.5z" />
                      <line x1="16" y1="8" x2="2" y2="22" />
                      <line x1="17.5" y1="15" x2="9" y2="15" />
                    </svg>
                  </DiyIcon>
                  {hasOpts && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold leading-none text-white shadow-xs">
                      {Math.min(game.options.length, 3)}
                    </span>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
                  else if (e.key === "Escape" && ideasOpen) setIdeasOpen(false);
                }}
                ref={inputRef}
                placeholder="写下你的行动，或说一句台词……"
                disabled={busy}
                className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-soft/55 outline-none"
              />
            </div>
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              aria-label="发送"
              className="send-btn diy-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-all hover:brightness-110 active:scale-[0.94] disabled:bg-jade/12 disabled:text-jade/40 disabled:shadow-none"
            >
              <DiyIcon slot="input.send" size={15}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 1z" />
                </svg>
              </DiyIcon>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 移动确认 ═══ */}
      {pending && plan && (() => {
        const dest = locOf(pending);
        const myCar = feature("cars") ? carById(s.activeCar) : undefined;
        const picked = TRANSPORT.find((m) => m.id === modeId) ?? TRANSPORT[0];
        const mode = picked.ownCar && !myCar ? defaultTransport() : picked;
        const trip = fareFor(plan, mode);
        const legsOk = tripPoints(s) >= apPerMove(); // 换地点扣固定行动点
        const cashOk = wallet.can(s, trip.fee); // 免费出行（步行）不看余额，欠款时也能走
        const afford = cashOk && legsOk;
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
                        {companion === c.id ? <IconCheck size={12} className="mr-0.5 inline" /> : null}{c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {blocked ? (
                <p className="rounded-xl border border-gold/40 bg-gold/8 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink/85">{plan.reason}</p>
              ) : (
                <div className="space-y-3">
                  {/* 交通方式：仅在模组内置交通系统时出现；花费由作者为每种方式配置 */}
                  <div>
                    {transportOn() && (<>
                    <p className="mb-2 text-[11px] font-bold tracking-[0.2em] text-ink-soft">{travelText().title}</p>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(5, Math.max(2, TRANSPORT.filter((m) => !m.ownCar || myCar).length))}, minmax(0, 1fr))` }}>
                      {TRANSPORT.filter((m) => !m.ownCar || myCar).map((m) => {
                        const t = fareFor(plan, m);
                        const on = mode.id === m.id;
                        const label = m.ownCar && myCar ? myCar.name : m.label;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setModeId(m.id)}
                            aria-pressed={on}
                            className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 transition active:scale-[0.97] ${
                              on ? "border-jade bg-jade/10 shadow-sm ring-1 ring-jade/40" : "border-line bg-paper hover:border-jade/50"
                            }`}
                          >
                            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-jade text-paper-2" : "bg-paper-2 text-ink-soft"}`}>
                              <TransportIcon id={m.icon ?? m.id} />
                            </span>
                            <span className={`max-w-full truncate text-[12.5px] font-bold ${on ? "text-jade" : "text-ink"}`}>{label}</span>
                            <span className={`text-[11px] tabular-nums ${t.fee > 0 ? "text-ink-soft" : "font-semibold text-jade"}`}>{fareText(t.fee)}</span>
                          </button>
                        );
                      })}
                    </div>
                    </>)}
                    {/* 合并摘要：方式说明 · 耗时 · 费用 · 营业/探索状态，一行看完 */}
                    {(() => {
                      const roamingNow = (s.schedule ?? [])[dowOf(s.day ?? 0)] === "freeroam";
                      const open = previewRStatus ? /开放|营业/.test(previewRStatus.label) : true;
                      const sub = previewRStatus?.label.match(/[（(]([^）)]*)[）)]/)?.[1] ?? previewRStatus?.label.replace(/^[^·]*·\s*/, "");
                      return (
                        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11.5px] text-ink-soft">
                          {transportOn() && <><span>{mode.note}</span>
                          <span className="text-line">|</span></>}
                          {transportOn() && <><span className={`font-bold tabular-nums ${cashOk ? "text-ink" : "text-danger"}`}>{fareText(trip.fee)}{!cashOk && " · 现金不足"}</span>
                          <span className="text-line">|</span></>}
                          <span className={`font-bold tabular-nums ${legsOk ? "text-ink" : "text-danger"}`}>{legsOk ? `行动点 -${apPerMove()}` : `行动点不足：需 ${apPerMove()}，现有 ${tripPoints(s)}`}</span>
                          {plan.explore ? (
                            <><span className="text-line">|</span><span className={`font-semibold ${roamingNow ? "text-jade" : "text-danger"}`}>{roamingNow ? "新地点 · 将点亮地图" : "当天日程需为「自由活动」"}</span></>
                          ) : previewRStatus ? (
                            <><span className="text-line">|</span>
                              <span className="flex items-center gap-1 font-semibold text-ink">
                                <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-jade" : "bg-danger"}`} />
                                {previewRStatus.label.split(/[·（(]/)[0].trim()}
                                {sub && sub !== previewRStatus.label && <span className="font-normal text-ink-soft">（{sub}）</span>}
                              </span>
                            </>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>

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
                    {!legsOk ? "行动点不足 · 先点「日程」" : !afford ? "现金不足" : plan.explore ? "前往探索" : "确认前往"}
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}
      {talkWith && <TalkPanel pid={talkWith.pid} name={talkWith.name} role={talkWith.role} onClose={(msg) => { setTalkWith(null); if (msg) flash(msg); }} />}
      {(toast || arrivals[0]) && (
        <div className="pointer-events-none fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
          {arrivals[0] && (
            <div key={arrivals[0].id} className="animate-pop pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-gold/50 bg-paper-2/95 px-4 py-3 shadow-xl backdrop-blur">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 font-serif font-bold text-gold">{arrivals[0].name.slice(0, 1)}</span>
              <div className="min-w-0">
                <p className="text-[10.5px] tracking-[0.2em] text-gold">新人物 · 进入世界</p>
                <p className="truncate text-[14px] font-semibold text-ink">{arrivals[0].name}<span className="ml-1.5 text-[12px] font-normal text-ink-soft">{arrivals[0].identity}</span></p>
              </div>
            </div>
          )}
          {toast && <div className="animate-pop rounded-full bg-ink/85 px-4 py-2 text-[13px] text-paper shadow-lg">{toast}</div>}
        </div>
      )}
    </div>
  );
}

/* ═══ galgame 式逐句播放：转场卡 → 旁白 / 台词一句一拍，点击推进 ═══ */
type Beat = { kind: "scene"; text: string } | { kind: "narration"; text: string } | { kind: "dialogue"; speaker: string; text: string } | { kind: "system"; text: string };
// 按句末标点切句，再把过短的句子并拢，每拍约一两句
function sentences(t: string, max = 64): string[] {
  const parts = t.match(/[^。！？!?…]+[。！？!?…]+[」』”"）)]*|[^。！？!?…]+$/g) ?? [t];
  const out: string[] = [];
  for (const p0 of parts) {
    const p = p0.trim();
    if (!p) continue;
    if (out.length && out[out.length - 1].length + p.length <= max && out[out.length - 1].length < 22) out[out.length - 1] += p;
    else out.push(p);
  }
  return out;
}
function beatsOf(turn: import("../lib/types").Turn): Beat[] {
  const b: Beat[] = turn.scene ? [{ kind: "scene", text: turn.scene }] : [];
  for (const sg of repairSegments(turn.segments)) {
    if (sg.kind === "dialogue") sentences(sg.text, 80).forEach((t) => b.push({ kind: "dialogue", speaker: sg.speaker, text: t }));
    else if (sg.kind === "narration") sentences(sg.text).forEach((t) => b.push({ kind: "narration", text: t }));
    else b.push({ kind: "system", text: sg.text });
  }
  return b;
}
/* 回合工具：重新生成本回合；逐句模式下可重新逐句播放 */
function TurnTools({ onReplay }: { onReplay?: () => void }) {
  const { regenerate, busy } = useGame();
  // 只放图标：文字说明交给悬停提示与读屏标签，不占对话框空间
  const btn = "turn-tool-btn grid h-7 w-7 place-items-center rounded-full text-ink-soft/70 transition hover:bg-jade/12 hover:text-jade active:scale-95 disabled:opacity-40";
  return (
    <div className="mt-1.5 flex justify-end gap-0.5">
      {onReplay && (
        <button type="button" className={btn} onClick={onReplay} title="逐句重播" aria-label="逐句重播">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden><path d="M2.5 1.8v8.4L10 6z" /></svg>
        </button>
      )}
      <button type="button" className={btn} disabled={busy} onClick={() => regenerate()} title="重新生成" aria-label="重新生成">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
        </svg>
      </button>
    </div>
  );
}

function GalPlayer({ turn, npcs, playerName, playerAvatar, introIds, onDone }: { turn: import("../lib/types").Turn; npcs: import("../lib/types").Npc[]; playerName: string; playerAvatar: string; introIds?: string[]; onDone: () => void }) {
  const { regenerate, busy } = useGame();
  const beats = useMemo(() => beatsOf(turn), [turn]);
  const [i, setI] = useState(0);
  const cur = beats[i];
  const last = i + 1 >= beats.length;
  const next = () => (last ? onDone() : setI(i + 1));
  const prev = () => setI((x) => Math.max(0, x - 1));
  useEffect(() => { if (!beats.length) onDone(); }, [beats.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // 转场卡自动翻过
  useEffect(() => {
    if (cur?.kind !== "scene") return;
    const t = setTimeout(() => setI((x) => Math.min(beats.length - 1, x + 1)), 1800);
    return () => clearTimeout(t);
  }, [cur, beats.length]);
  if (!cur) return null;
  const npc = cur.kind === "dialogue" ? npcs.find((n) => n.name === cur.speaker) : undefined;
  // 立绘只用人物单独上传的抠图（不拿头像顶替）；最近一位有立绘的说话人留在台上，旁白 / 玩家说话时压暗，转场后清场
  let stage: import("../lib/types").Npc | undefined;
  for (let k = i; k >= 0 && beats[k].kind !== "scene"; k--) {
    const b = beats[k];
    if (b.kind !== "dialogue" || b.speaker === playerName) continue;
    const n = npcs.find((x) => x.name === b.speaker);
    if (n?.portrait) stage = n;
    break; // 最近一位 NPC 说话人没有立绘就清场，不让上一位的立绘顶着别人的台词
  }
  const portrait = stage?.portrait ?? "";
  const speaking = !!stage && stage.id === npc?.id;
  // 每一拍用与普通对话框相同的 Segments 渲染（头像、名牌、气泡一致）
  const seg: import("../lib/types").Segment | null = cur.kind === "scene" ? null
    : cur.kind === "dialogue" ? { kind: "dialogue", speaker: cur.speaker, text: cur.text } as import("../lib/types").Segment
    : { kind: cur.kind, text: cur.text } as import("../lib/types").Segment;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const tool = "transition hover:text-coral disabled:opacity-30 disabled:hover:text-ink-soft";
  return (
    <div role="button" tabIndex={0} onClick={next}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); } }}
      className={`relative flex h-full min-h-0 min-w-0 flex-1 cursor-pointer select-none flex-col outline-none ${portrait ? "pr-[26%]" : ""}`} style={{ outline: "none" }}>
      {portrait && (
        <img key={stage!.id} src={portrait} alt="" aria-hidden
          className={`portrait-standee pointer-events-none absolute bottom-0 right-0 h-full w-[24%] object-contain object-bottom ${speaking ? "" : "is-idle"}`} />
      )}
      {cur.kind === "scene" ? (
        <div key={i} className="m-auto flex flex-col items-center gap-2 text-center animate-pop">
          <span className="text-[10.5px] font-bold tracking-[0.5em] text-coral">— 转 场 —</span>
          <span className="font-serif text-[22px] font-black text-ink">{cur.text}</span>
          <span className="h-px w-24 bg-gradient-to-r from-transparent via-coral/60 to-transparent" />
        </div>
      ) : (
        <div key={i} className="dialogue-scroll min-h-0 flex-1 overflow-y-auto pr-1 text-[13px] leading-relaxed text-ink animate-pop">
          {cur.kind === "dialogue" ? (() => {
            // 视觉小说式对话框：名牌压在框顶，头像在旁，台词占满整框
            const me = cur.speaker === playerName;
            const av = me ? playerAvatar : npc?.avatar;
            return (
              <div className={`relative mt-3 ${me ? "pr-1" : "pl-1"}`}>
                <div className={`absolute -top-3 z-10 flex items-center gap-1.5 ${me ? "right-3 flex-row-reverse" : "left-3"}`}>
                  {av ? <img src={av} alt="" className="dlg-avatar h-7 w-7 rounded-full object-cover object-top ring-2 ring-white shadow" />
                    : <span className="dlg-avatar grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-[12px] font-bold text-white ring-2 ring-white shadow">{cur.speaker.slice(0, 1)}</span>}
                  <span className={`rounded-full px-3 py-0.5 text-[12px] font-bold tracking-wide text-white shadow-sm ${me ? "bg-gradient-to-r from-[var(--coral)] to-[var(--jade)]" : "bg-gradient-to-r from-[var(--jade)] to-[var(--coral)]"}`}>{cur.speaker}</span>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 pb-3 pt-5 text-[14.5px] leading-[1.8] text-ink shadow-[0_6px_18px_-10px_rgba(0,0,0,0.25)] backdrop-blur-sm">
                  <SpeechWithActions text={cur.text} />
                </div>
              </div>
            );
          })() : (
            <Segments segments={[seg!]} npcs={npcs} playerAvatar={playerAvatar} playerName={playerName} />
          )}
          {/* 最后一拍：和普通对话框一样附上心事与初遇名片 */}
          {last && (
            <div onClick={stop} className="cursor-auto">
              <Thoughts thoughts={turn.thoughts} npcs={npcs} />
              <NewcomerCards ids={introIds} />
            </div>
          )}
        </div>
      )}
      <div className="mt-1 flex shrink-0 items-center justify-between gap-2 text-[11px] text-ink-soft">
        <span className="flex items-center gap-3">
          <span className="tabular-nums">{i + 1} / {beats.length}</span>
          <button type="button" disabled={i === 0} onClick={(e) => { stop(e); prev(); }} className={tool} aria-label="上一句">‹ 上一句</button>
        </span>
        <span className="flex items-center gap-3">
          <button type="button" disabled={busy} onClick={(e) => { stop(e); regenerate(); }} className={tool}><span className="inline-flex items-center gap-1"><IconRefresh size={12} /> 重新生成</span></button>
          <button type="button" onClick={(e) => { stop(e); onDone(); }} className={tool} title="跳到末尾，查看完整剧情">跳过 »</button>
          <span className="animate-pulse text-coral"><IconChevronDown size={12} /></span>
        </span>
      </div>
    </div>
  );
}
