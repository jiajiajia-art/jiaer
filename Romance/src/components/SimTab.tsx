import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { Trait } from "../lib/types";
import { Avatar, Chip, Modal, SectionHead } from "./ui";
import { TITLES, CARS, carById, resaleValue, fameTier } from "../game/data";
import { computeLooks, looksTier } from "../game/logic";
import { locOf } from "../game/mud";
import Backpack from "./Backpack";
import { DEFAULT_PLAYER_ATTRIBUTES } from "../lib/playerAttributes";

function ProfileBar({ value, max }: { value: number; max: number }) {
  const percent = Math.max(0, Math.min(100, value / max * 100));
  return <span className="block h-2 w-full overflow-hidden rounded-full bg-[#ded7ed] shadow-inner" aria-hidden><span className="block h-full rounded-full bg-gradient-to-r from-[#b49be9] to-[#9278d1] transition-[width]" style={{ width: `${percent}%` }} /></span>;
}

const STAT_ICONS: Record<string, string> = { yanji: "◉", gey: "♪", wudao: "✦", yibiao: "♙", koucai: "◇", caizhi: "◆", tineng: "♢", qizhi: "✧" };

export default function SimTab() {
  const { game, equipTitle, setActiveCar, setPlayerAvatar, lastChanges } = useGame();
  const [openHistory, setOpenHistory] = useState(false);
  const [trait, setTrait] = useState<Trait | null>(null); // 点开查看的特质详情
  const [panel, setPanel] = useState<"profile" | "bag">("profile");
  if (!game || !game.sim) return null;
  const s = game.sim;
  const p = game.player;
  const changedLabels = new Set(lastChanges.map((c) => c.replace(/\s*[+-]?\d+$/, "").replace(/好感.*/, "").trim()));
  const basicInfo: [string, string][] = [
    ["年龄", p.age ? `${p.age} 岁` : "—"],
    ["性别", p.gender],
    ["身份", p.identity],
    ["阶层", p.klass],
    ["家世背景", p.background],
    ["当前地点", locOf(s.room ?? "apartment")?.name ?? "天光公寓"],
    ["当前周数", `第 ${s.week ?? 1} 周`],
  ];
  const presetFields: [string, string][] = p.extra.map((e) => [e.label, e.value]);
  const tier = fameTier(s.fame);
  const looks = computeLooks(s);
  const earnedTitles = TITLES.filter((t) => s.titles.includes(t.id));
  const wornTitle = earnedTitles.find((t) => t.id === s.equippedTitle) ?? null;
  const attributeSchema = game.playerAttributeSchema ?? DEFAULT_PLAYER_ATTRIBUTES;
  const attributeValue = (id: string) => id in s.stats ? s.stats[id as keyof typeof s.stats] : (s as unknown as Record<string, number>)[id] ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-0 py-1 font-serif">
      {/* 人物档案头 + 基础信息（合并，避免重复字段） */}
      <section className="rounded-[26px] border border-[#d9cff0] bg-[radial-gradient(circle_at_12%_10%,rgba(231,218,255,.8),transparent_38%),linear-gradient(145deg,rgba(255,255,255,.94),rgba(247,242,255,.9))] p-4 shadow-[0_16px_42px_rgba(112,82,172,.15)] sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(180px,.9fr)_minmax(0,1.1fr)]">
          <div className="mx-auto w-full max-w-[230px]">
            <div className="aspect-[4/5] overflow-hidden rounded-[24px] border-2 border-white bg-gradient-to-br from-[#e3d3fb] to-[#a991dc] p-1 shadow-[0_12px_28px_rgba(103,74,164,.22)] [&>button]:!h-full [&>button]:!w-full [&>button]:!rounded-[20px] [&>button]:!border-0">
              <Avatar src={p.avatar} name={p.name} size={230} onPick={setPlayerAvatar} />
            </div>
            <p className="mt-2 text-center text-[11px] text-[#8e7baa]">点击头像 · 更换造型</p>
          </div>
          <div className="rounded-[22px] border border-white/80 bg-white/55 p-5 shadow-[inset_0_1px_0_white]">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-3xl font-black tracking-wide text-[#554187]">{p.name}</h2>{wornTitle && <Chip tone="gold">{wornTitle.name}</Chip>}</div>
            <div className="mt-4 divide-y divide-[#e0d8ed] text-[14px] text-[#665b7e]">
              <p className="flex justify-between gap-4 py-3"><span>年龄</span><strong>{p.age || "—"} 岁</strong></p>
              <p className="flex justify-between gap-4 py-3"><span>性别</span><strong>{p.gender || "—"}</strong></p>
              <p className="flex justify-between gap-4 py-3"><span>身份</span><strong>{p.identity || "—"}</strong></p>
              <p className="flex justify-between gap-4 py-3"><span>所属公司</span><strong>{game.contract?.company || "尚未签约"}</strong></p>
            </div>
            <span className="mt-3 inline-flex rounded-full bg-[#e8ddfb] px-4 py-1.5 text-xs font-bold text-[#7154ae]">{p.klass}</span>
          </div>
        </div>
        <div className="mt-4 rounded-[20px] border border-white/80 bg-white/55 p-4">
          <p className="mb-2 font-bold text-[#655092]">◉ 人物小传</p>
          <p className="text-[13px] leading-relaxed text-[#655b76]">{p.description || "尚未写下人物简介"}</p>
        </div>
        <div className="mt-3 space-y-2">
          <ProfileSection title="详细资料" rows={basicInfo} initiallyOpen={false} />
          <ProfileSection title="用户预设字段" rows={presetFields} empty="建角时没有额外字段" initiallyOpen={false} />
        </div>
          {/* 特质与天赋：并入头部信息，不再单列一栏 */}
          {p.traits.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1.5">
              {p.traits.map((t) => (
                <button key={t.name} type="button" onClick={() => setTrait(t)} className="transition hover:-translate-y-0.5">
                  <Chip tone={t.kind === "positive" ? "jade" : t.kind === "negative" ? "danger" : "gold"}>
                    {t.name}
                    {t.desc && <span className="ml-1 opacity-60">›</span>}
                  </Chip>
                </button>
              ))}
            </div>
          )}
      </section>

      <div className="mb-3 grid grid-cols-2 rounded-xl bg-ink-soft/10 p-1">
        <button onClick={() => setPanel("profile")} aria-pressed={panel === "profile"} className={`rounded-lg py-2 text-[14px] font-semibold transition ${panel === "profile" ? "bg-paper-2 text-ink shadow-sm" : "text-ink-soft"}`}>档案</button>
        <button onClick={() => setPanel("bag")} aria-pressed={panel === "bag"} className={`rounded-lg py-2 text-[14px] font-semibold transition ${panel === "bag" ? "bg-paper-2 text-ink shadow-sm" : "text-ink-soft"}`}>背包 · {(s.bag ?? []).length}</button>
      </div>

      {panel === "bag" ? <Backpack embedded /> : <>

      {/* 双亲已并入统一「人脉」花名册（家人 · 双亲），此处不再另立独立档案 */}

      {/* 作品 / 奖项与信任不再在此外显：作品移入 ☰ 菜单「我的作品」；信任按每位负责人各自独立（见「人脉」） */}

      {/* 八维能力 + 名气 / 容貌 / 压力（并入同一能力盘） */}
      <SectionHead code="STATS" cn="核心属性" right={<span className="text-[11px] text-ink-soft">数值越高，机会越多</span>} />
      <div className="mb-6 rounded-[24px] border border-[#ddd3ef] bg-gradient-to-br from-white/75 to-[#f1ebfa]/80 p-3 shadow-[0_12px_30px_rgba(103,74,164,.1)]">
        <p className="mb-2 text-[11px] font-bold tracking-[0.2em] text-[#8b78b5]">PRIMARY · 主属性</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {attributeSchema.filter((field) => field.enabled && field.group === "primary").map((field) => {
          const value = attributeValue(field.id);
          const flash = changedLabels.has(field.label);
          return (
            <div key={field.id} className={`min-w-0 rounded-2xl border border-white/80 bg-white/60 px-3 py-3 text-center shadow-sm ${flash ? "animate-flash" : ""}`}>
              <div className="mb-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6c5c91]"><span className="text-base text-[#a78edb]">{STAT_ICONS[field.id] ?? "✦"}</span>{field.label}</div>
              <div className="mb-2 text-2xl font-black tabular-nums text-[#4b4262]">{value}</div>
              <ProfileBar value={value} max={field.max} />
            </div>
          );
        })}
        </div>
        <p className="mb-2 mt-4 text-[11px] font-bold tracking-[0.2em] text-[#8b78b5]">SECONDARY · 次要属性</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {attributeSchema.filter((field) => field.enabled && field.group === "secondary").map((field) => {
            const value = attributeValue(field.id);
            return <div key={field.id} className={`min-w-0 rounded-2xl border px-3 py-3 shadow-sm ${field.id === "stress" && value >= 75 ? "border-danger/35 bg-danger/8" : "border-white/80 bg-white/60"}`}>
              <div className="mb-2 flex items-center justify-between gap-2 text-[12px]"><span className="truncate font-semibold text-[#6c5c91]">{field.label}</span><span className="font-bold tabular-nums text-[#4b4262]">{value}</span></div>
              <ProfileBar value={value} max={field.max} />
            </div>;
          })}
        </div>
      </div>
      <p className="-mt-4 mb-6 text-[11px] text-ink-soft">名气 {tier.label} · 容貌 {looksTier(looks)}</p>

      {/* 背包已在顶部标签中呈现，档案页保留能力与履历信息。 */}

      {/* 财务 · 支票与账单已移入右上角 ☰ 菜单 */}

      {/* 头衔：达标即获得，可自由佩戴 / 更换 / 摘下（佩戴的头衔展示在名字旁） */}
      <SectionHead code="TITLE" cn="我的头衔" right={
        <span className="text-[11px] text-ink-soft">{earnedTitles.length ? `${earnedTitles.length} 枚 · 点选佩戴/摘下` : "尚未解锁"}</span>
      } />
      <div className="mb-5">
        {earnedTitles.length ? (
          <div className="flex flex-wrap gap-2">
            {earnedTitles.map((t) => {
              const worn = s.equippedTitle === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => equipTitle(t.id)}
                  title={t.desc}
                  aria-pressed={worn}
                  className={`rounded-sm border px-3 py-1.5 text-left transition ${
                    worn ? "border-solid border-gold bg-gold/12" : "border-dashed border-line hover:border-gold/60 hover:bg-gold/5"
                  }`}
                >
                  <span className={`block text-[13px] font-bold ${worn ? "text-gold" : "text-ink"}`}>
                    {worn ? "◉ " : "○ "}{t.name}
                  </span>
                  <span className="block text-[10.5px] text-ink-soft">{t.tier} · {t.desc}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-soft">尚未解锁头衔——在名气、口碑、作品与奖项上争一席之地，达标即可获得并佩戴。</p>
        )}
      </div>

      {/* ═══ 座驾：选定后出行可「自己开车」（免费）；车辆在星辉 4S 汽车城购入 ═══ */}
      <SectionHead code="RIDE" cn="我的座驾" right={
        <span className="text-[11px] text-ink-soft">{(s.cars ?? []).length ? "点选设为座驾 / 取消" : "尚无车 · 去 4S 汽车城选购"}</span>
      } />
      <div className="mb-6">
        {(s.cars ?? []).length ? (
          <div className="flex flex-wrap gap-2">
            {(s.cars ?? []).map((id) => {
              const c = carById(id);
              if (!c) return null;
              const on = s.activeCar === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveCar(on ? null : id)}
                  aria-pressed={on}
                  title={`${c.desc} · 回收价 ¥${resaleValue(c).toLocaleString("zh-CN")}`}
                  className={`rounded-sm border px-3 py-1.5 text-left transition ${
                    on ? "border-solid border-jade bg-jade/12" : "border-dashed border-line hover:border-jade/60 hover:bg-jade/5"
                  }`}
                >
                  <span className={`block text-[13px] font-bold ${on ? "text-jade" : "text-ink"}`}>{on ? "◉ " : "○ "}{c.name}</span>
                  <span className="block text-[10.5px] text-ink-soft">{c.tag} · {on ? "出行可自己开车（免费）" : "点选设为座驾"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-soft">你还没有车——出行只能步行 / 公交 / 地铁 / 打车。去星辉 4S 汽车城买一辆，选为座驾后即可「自己开车」，免费又自在。（全 {CARS.length} 款可选）</p>
        )}
      </div>

      {/* 特质与天赋详情：点击头部的特质胶囊打开 */}
      {trait && (
        <Modal title="特质与天赋" onClose={() => setTrait(null)} heavyBackdrop>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] font-bold ${
              trait.kind === "positive" ? "bg-jade/15 text-jade" : trait.kind === "negative" ? "bg-danger/15 text-danger" : "bg-gold/15 text-gold"
            }`}>
              {trait.name}
            </span>
            <span className="mt-1.5 text-[11px] font-medium text-ink-soft">
              {trait.kind === "positive" ? "正面天赋" : trait.kind === "negative" ? "负面特质" : "中性特质"}
            </span>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink">
            {trait.desc || "这是她与生俱来（或一路修得）的特质，会在剧情与养成中悄然生效。"}
          </p>
        </Modal>
      )}

      {/* 本周日程板已提升为全局弹窗（见 GameShell），由「世界」页入口直接唤出，此处不再渲染 */}

      {/* 通告公告已并入「通告·职业履历」；头衔与月榜、人气/票房/代言榜迁至底栏「娱乐圈」页 */}

      {/* 通告 · 职业履历（含作品库）已并入 ☰ 菜单「我的作品」 */}

      {/* 背景履历 */}
      <button onClick={() => setOpenHistory((v) => !v)} className="mb-1 mt-6 flex w-full items-center gap-2 text-left">
        <span className="text-jade">▌</span>
        <span className="text-[11px] font-bold tracking-[0.25em] text-jade">LOG</span>
        <span className="text-[12px] text-ink-soft">背景履历</span>
        <span className="h-px flex-1 border-t border-dashed border-line" />
        <span className="text-[11px] text-ink-soft">{openHistory ? "[-]" : "[+]"} {p.history.length}</span>
      </button>
      {openHistory && (
        p.history.length ? (
          <ol className="relative space-y-1.5 border-l border-line pl-4">
            {[...p.history].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[19px] top-1.5 text-[10px] text-jade">▸</span>
                <p className="text-[10.5px] text-ink-soft">{h.time} · 第 {h.turn} 回合</p>
                <p className="text-[13px] font-medium text-ink">{h.title}</p>
                <p className="text-[12px] text-ink-soft">{h.detail}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12.5px] text-ink-soft">履历空白，等待被书写。</p>
        )
      )}
      </>}
    </div>
  );
}

function ProfileSection({ title, rows, empty, initiallyOpen = true }: { title: string; rows: [string, string][]; empty?: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-line/60 bg-paper/50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-jade/5">
        <span className="text-[12px] font-bold tracking-wide text-ink">{title}</span>
        <span className="text-[13px] text-ink-soft">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (rows.length ? (
        <dl className="grid grid-cols-1 divide-y divide-line/50 border-t border-line/50 sm:grid-cols-2 sm:divide-y-0">
          {rows.map(([k, v]) => (
            <div key={`${k}-${v}`} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 text-[12px] sm:border-b sm:border-line/40 even:sm:border-l">
              <dt className="shrink-0 text-ink-soft">{k}</dt>
              <dd className="min-w-0 break-words text-right font-medium text-ink">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="border-t border-line/50 px-3 py-3 text-[12px] text-ink-soft">{empty ?? "暂无资料"}</p>)}
    </section>
  );
}
