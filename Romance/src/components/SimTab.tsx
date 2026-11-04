import { lazyPanel } from "../lib/lazyPanel";
const ImageTab = lazyPanel(() => import("./ImageTab"));
import { useMemo, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { spotName } from "../game/mapedits";
import { Avatar, Modal } from "./ui";
import { CARS, TITLES, carById, resaleValue } from "../game/data";
import { carShopId, locOf, transportOn, TRANSPORT } from "../game/mud";
import Backpack from "./Backpack";
import AttrValueEdit from "./AttrValueEdit";
import { feature, term } from "../mods/registry";
import { IconCamera, IconCheck, IconClose } from "../lib/icons";
import {
  dossierAttrPct,
  dossierAttrWarn,
  dossierFactLine,
} from "../lib/playerDossier";
import type { AttrDef } from "../lib/types";
import { customAttrValue } from "../game/wallet";

function IconCrown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 8.5l4 3.2L12 5l5 6.7 4-3.2-1.5 10.3a1.2 1.2 0 0 1-1.19 1H5.69a1.2 1.2 0 0 1-1.19-1L3 8.5z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="21" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="4.6" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconCar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 16v-3.6l1.6-4.1A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.9 1.3L20 12.4V16" />
      <path d="M4 16h1.9M10 16h4M18.1 16H20M5.2 12.2h13.6" />
      <circle cx="8" cy="16.2" r="2" />
      <circle cx="16" cy="16.2" r="2" />
    </svg>
  );
}

/** 功能注释：分区卡——中文标题 + 右侧 meta，无英文眉题、无序号 */
function Block({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line/70 bg-paper/95 px-3.5 py-3 shadow-sm">
      <header className="mb-2.5 flex items-baseline gap-2">
        <h3 className="text-[14px] font-bold tracking-wide text-ink">{title}</h3>
        {meta != null && <span className="ml-auto min-w-0 text-right text-[11px] text-ink-soft">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

/**
 * 功能注释：属性进度条——约 6px 高、通栏；深色底轨 + 深色已达段（警戒用危险色）。
 * 禁止用与粉底同淡的粉色轨，否则 0 值时整行只剩一条看不见的浅线。
 * 比例按内部上限算，页面不展示满值数字。
 */
function AttrBar({ pct, warn }: { pct: number; warn: boolean }) {
  const w = pct <= 0 ? 0 : Math.max(2, Math.min(100, pct * 100));
  return (
    <span className="relative mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-ink/20" aria-hidden>
      <span
        className={`absolute inset-y-0 left-0 rounded-full ${warn ? "bg-danger" : "bg-ink/70"}`}
        style={{ width: `${w}%` }}
      />
    </span>
  );
}

export default function SimTab({ embedded = false }: { embedded?: boolean }) {
  const { game, equipTitle, setActiveCar, setPlayerAvatar, lastChanges } = useGame();
  const [openTitles, setOpenTitles] = useState(false);
  const [openImage, setOpenImage] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const p = game?.player;
  const factLine = useMemo(
    () => (p ? dossierFactLine(p) : ""),
    [p?.age, p?.gender, JSON.stringify(p?.extra ?? [])],
  );

  if (!game || !game.sim || !p) return null;
  const s = game.sim;
  const defs = game.attrDefs ?? [];
  const changedLabels = new Set(lastChanges.map((c) => c.replace(/\s*[+-]?\d+$/, "").replace(/好感.*/, "").trim()));

  const bagCount = (s.bag ?? []).length + (game.contract ? 1 : 0);
  const bagEmpty = bagCount === 0;
  const history = p.history ?? [];
  const histEmpty = history.length === 0;

  const earnedTitles = TITLES.filter((t) => s.titles.includes(t.id));
  const wornTitle = earnedTitles.find((t) => t.id === s.equippedTitle) ?? null;
  const showCars = feature("cars") && transportOn() && CARS.length > 0 && TRANSPORT.some((m: { ownCar?: boolean }) => m.ownCar) && (!!(s.cars ?? []).length || (!!carShopId() && !!locOf(carShopId()!)));
  const cars = s.cars ?? [];
  const shop = carShopId() ? locOf(carShopId()!) : undefined;
  const shopName = shop ? (spotName(game, shop.id) ?? shop.name) : undefined;

  const openDetail = (d: AttrDef) => {
    setFocusId(d.id);
    setDetailId(d.id);
  };
  const detailDef = detailId ? defs.find((d) => d.id === detailId) : undefined;

  return (
    <div className={embedded ? "w-full" : "w-full pb-5"}>
      {openImage && (
        <Modal title={term("tabImage", "形象")} onClose={() => setOpenImage(false)}>
          <ImageTab />
        </Modal>
      )}
      <div className={`mx-auto max-w-lg space-y-3 ${embedded ? "pt-0.5" : "px-4 py-4"}`}>
        {/* ═══ 头卡：左头像 · 右名字 / 年龄·性别·生日·星座 ═══ */}
        <section className="rounded-2xl border border-line/70 bg-[#FFF7F8]/80 px-3.5 py-3.5 shadow-sm dark:bg-paper/95">
          <div className="flex items-start gap-3">
            <Avatar src={p.avatar} name={p.name} size={64} square onPick={setPlayerAvatar} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-[20px] font-black tracking-wide text-ink">{p.name}</h2>
                {(wornTitle || earnedTitles.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setOpenTitles(true)}
                    className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-gold"
                    aria-label="查看头衔"
                  >
                    <IconCrown className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[6rem]">{wornTitle?.name ?? "头衔"}</span>
                  </button>
                )}
                {feature("imageCrisis") && (
                  <button
                    type="button"
                    onClick={() => setOpenImage(true)}
                    className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${s.crisis ? "border-danger/45 text-danger" : "border-line text-ink-soft"}`}
                  >
                    <IconCamera width={11} height={11} />
                    {term("tabImage", "形象")}
                  </button>
                )}
              </div>
              {factLine ? <p className="mt-1 text-[12px] leading-snug text-ink-soft">{factLine}</p> : null}
            </div>
          </div>
        </section>

        {/* ═══ 属性：每行「深色名 + 深色当前值 + 下方通栏深色进度条」；不展示满值；行底分隔线加深 ═══ */}
        {defs.length > 0 && (
          <Block title="属性">
            <ul>
              {defs.map((d, i) => {
                const v = customAttrValue(game, d);
                const warn = dossierAttrWarn(d, v);
                const pct = dossierAttrPct(v, d.max, d.min ?? 0);
                const on = focusId === d.id;
                const last = i === defs.length - 1;
                return (
                  <li
                    key={d.id}
                    className={last ? undefined : "border-b border-ink/25"}
                  >
                    <button
                      type="button"
                      onClick={() => openDetail(d)}
                      className={`w-full min-w-0 rounded-xl px-1.5 py-2.5 text-left transition hover:bg-ink/[0.04] ${on ? "bg-ink/[0.05]" : ""}`}
                      title={d.desc || `查看${d.label}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        {/* 功能注释：名/值一律深色墨字，禁止浅粉 text-coral（可爱皮肤下与粉底糊在一起） */}
                        <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">{d.label}</span>
                        <span
                          className={`shrink-0 text-[13.5px] font-bold tabular-nums ${warn ? "text-danger" : "text-ink"} ${changedLabels.has(d.label) ? "animate-flash" : ""}`}
                        >
                          {v}
                        </span>
                      </div>
                      <AttrBar pct={pct} warn={!!warn} />
                    </button>
                    {warn ? (
                      <p className="mt-1 px-1.5 pb-1.5 text-[11px] leading-snug text-danger">{warn}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Block>
        )}

        {/* ═══ 随身 ═══ */}
        <Block title="随身" meta={`${bagCount} 件`}>
          {bagEmpty ? (
            <div className="rounded-xl border border-dashed border-line/80 px-3 py-3 text-center text-[12px] leading-relaxed text-ink-soft">
              行囊空空 · 沿途拾取的物件会收纳在此
            </div>
          ) : (
            <Backpack embedded />
          )}
          {showCars && (
            <div className={`${bagEmpty ? "mt-3" : "mt-3 border-t border-dashed border-line/60 pt-3"}`}>
              <p className="mb-2 text-[12px] font-bold text-ink">私人座驾</p>
              {cars.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {cars.map((id) => {
                    const c = carById(id);
                    if (!c) return null;
                    const on = s.activeCar === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveCar(on ? null : id)}
                        aria-pressed={on}
                        title={`${c.desc} · 回收价 ¥${resaleValue(c).toLocaleString("zh-CN")}`}
                        className={`relative flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${on ? "border-jade/55 bg-jade/[0.07]" : "border-line/70"}`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-jade/15 text-jade" : "bg-ink/[0.04] text-ink-soft"}`}>
                          <IconCar size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate text-[12.5px] font-bold ${on ? "text-jade-deep" : "text-ink"}`}>{c.name}</span>
                          <span className="block truncate text-[10.5px] text-ink-soft">{on ? "出行座驾" : c.tag}</span>
                        </span>
                        {on && <IconCheck width={12} height={12} className="absolute right-1.5 top-1.5 text-jade" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11.5px] leading-snug text-ink-soft">
                  {shopName ? <>去「{shopName}」挑一辆，出行更自在。</> : "还没有座驾。"}
                </p>
              )}
            </div>
          )}
        </Block>

        {/* ═══ 背景履历 ═══ */}
        <Block title="背景履历" meta={`${history.length} 条`}>
          {histEmpty ? (
            <div className="rounded-xl border border-dashed border-line/80 px-3 py-3 text-center text-[12px] leading-relaxed text-ink-soft">
              暂无履历 · 人生刚刚开始
            </div>
          ) : (
            <ol className="relative space-y-3.5 pl-5">
              <span aria-hidden className="absolute bottom-1 left-[5px] top-1 w-px bg-gradient-to-b from-coral/40 via-line to-transparent" />
              {[...history].reverse().map((h, i) => (
                <li key={`${h.turn}-${i}`} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-5 top-[4px] h-2.5 w-2.5 rounded-full border bg-paper ${i === 0 ? "border-coral" : "border-line"}`}
                  />
                  <p className="text-[10.5px] text-ink-soft">
                    {h.time}
                    <span className="mx-1 text-line">·</span>
                    第 {h.turn} 回合
                    {i === 0 && <span className="ml-1.5 rounded-full border border-coral/30 px-1.5 text-[9.5px] font-bold text-coral">最新</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] font-bold leading-snug text-ink">{h.title}</p>
                  {h.detail ? <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{h.detail}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </Block>

        {/* 属性详情：当前值 · 进度条 · 说明 · 警戒提醒（不展示满值） */}
        {detailDef && (
          <Modal title={detailDef.label} onClose={() => setDetailId(null)}>
            <div className="space-y-3">
              <div className="rounded-xl border border-line/70 bg-paper-2/50 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink">{detailDef.label}</span>
                  <AttrValueEdit def={detailDef} className="text-[16px] font-bold text-ink no-underline" flash={changedLabels.has(detailDef.label)} />
                </div>
                <AttrBar
                  pct={dossierAttrPct(customAttrValue(game, detailDef), detailDef.max, detailDef.min ?? 0)}
                  warn={!!dossierAttrWarn(detailDef, customAttrValue(game, detailDef))}
                />
              </div>
              {dossierAttrWarn(detailDef, customAttrValue(game, detailDef)) && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
                  {dossierAttrWarn(detailDef, customAttrValue(game, detailDef))}
                </p>
              )}
              {detailDef.desc ? (
                <p className="text-[13px] leading-relaxed text-ink/90">{detailDef.desc}</p>
              ) : (
                <p className="text-[12.5px] text-ink-soft">创作者未填写说明。点右侧数字可直接修改当前值。</p>
              )}
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="flex w-full items-center justify-center gap-1 rounded-xl border border-line py-2.5 text-[13px] font-semibold text-ink-soft"
              >
                <IconClose size={14} />
                关闭
              </button>
            </div>
          </Modal>
        )}

        {openTitles && (
          <Modal title="我的头衔" onClose={() => setOpenTitles(false)}>
            {earnedTitles.length ? (
              <>
                <p className="mb-3 text-[12px] text-ink-soft">已解锁 {earnedTitles.length} 枚 · 点选佩戴 / 摘下。</p>
                <div className="flex flex-wrap gap-2">
                  {earnedTitles.map((t) => {
                    const worn = s.equippedTitle === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => equipTitle(t.id)}
                        title={t.desc}
                        aria-pressed={worn}
                        className={`rounded-sm border px-3 py-1.5 text-left transition ${worn ? "border-solid border-gold bg-gold/12" : "border-dashed border-line hover:border-gold/60"}`}
                      >
                        <span className={`block text-[13px] font-bold ${worn ? "text-gold" : "text-ink"}`}>
                          {worn ? (
                            <span className="inline-flex items-center gap-1">
                              <IconCheck size={12} />
                              {t.name}
                            </span>
                          ) : (
                            t.name
                          )}
                        </span>
                        <span className="block text-[10.5px] text-ink-soft">
                          {t.tier} · {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-[13px] text-ink-soft">尚未解锁头衔</p>
            )}
          </Modal>
        )}
      </div>
    </div>
  );
}
