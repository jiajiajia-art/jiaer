import { careersOf } from "../game/careers";
import { STAT_ORDER, STAT_LABELS } from "../game/data";
import { useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { PEOPLE, profileOf, companyMeta, MOVIE_TITLES } from "../worlds/star2005/content";
import { Modal, Avatar } from "./ui";
import { relOf } from "../game/relations";
import { romanticCapOf } from "../worlds/star2005/content";

export const NPC_FIELDS = [
  ["identity", "职业"], ["gender", "性别"], ["age", "年龄"], ["relation", "与你的关系"],
  ["bio", "人物背景"], ["tags", "性格与标签"], ["company", "所属公司"],
  ["spouse", "现任"], ["ex", "前任"], ["parents", "父母"], ["children", "子女"],
  ["works", "代表作"], ["resume", "人物履历"],
].map(([id, label]) => ({ id, label, enabled: true }));

export default function NpcProfile({ pid, onClose, children }: { pid: string; onClose: () => void; children?: ReactNode }) {
  const { game, commitGame, setNpcAvatar, simContact } = useGame();
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!game) return null;
  const n = game.npcs.find(n => n.id === pid);
  const star = game.sim.npcs.find(n => n.id === pid);
  const p = profileOf(pid);
  const name = n?.name ?? star?.name ?? p?.name ?? "人物档案";
  const refs = (value: unknown): string => !value ? "" : (Array.isArray(value) ? value : [value]).map(v => typeof v === "object" && v && "name" in v ? String(v.name) : String(v)).join("、");
  const personName = (id?: string | null) => game.sim.npcs.find(n => n.id === id)?.name ?? "";
  const values: Record<string, string> = {
    identity: n?.identity || p?.role || star?.dir || "", gender: p?.gender || star?.gender || "",
    age: String(p?.age ?? n?.age ?? ""), relation: n?.relation ?? "",
    bio: p?.bio || n?.bio || "", tags: (p?.tags ?? n?.tags ?? (star ? [star.personality, star.pref] : [])).join("、"),
    company: star ? companyMeta(star.companyId).name : "",
    spouse: refs(p?.family?.spouse) || personName(star?.partnerId), ex: refs(p?.ex) || personName(star?.exId),
    parents: refs(p?.family?.parents), children: refs(p?.family?.children),
    works: (p?.works ?? star?.works?.map(w => MOVIE_TITLES[w % MOVIE_TITLES.length]) ?? []).join("、"),
    resume: (p?.resume ?? []).filter(r => !r.hidden).map(r => `${r.year}年 · ${r.title}${r.detail ? "：" + r.detail : ""}`).join("\n"),
    ...game.npcFieldValues?.[pid],
  };
  const career = careersOf(game).find(c => c.id === game.npcCareerIds?.[pid]);
  if (career) values.identity = career.name;
  const attributes = { ...p?.stats, ...star?.stats, ...game.npcAttributeValues?.[pid] } as Record<string, number | undefined>;
  const life = game.sim.npcLives?.[pid];
  if (life?.age != null) values.age = String(Math.floor(life.age));
  const band = game.sim.lifeRules?.bands.find(b => life?.age != null && Math.floor(life.age) >= b.min && Math.floor(life.age) <= b.max);
  const enabled = game.sim.romanceEnabled?.[pid] !== false;
  const relation = relOf(game.sim, pid);
  const loveMax = romanticCapOf(pid);
  const love = Math.max(0, Math.min(loveMax, relation.romantic));
  const friendly = Math.max(0, Math.min(100, n?.affinity ?? game.sim.rel?.[pid] ?? 0));
  const occupation = values.identity || "身份尚未公开";
  const age = values.age ? `${values.age.replace(/\s*岁$/, "")} 岁` : "年龄未知";
  const bio = values.bio || "你们尚未熟悉到足以了解彼此的过去。继续相处，也许会听见更多故事。";
  const relationshipLabel = game.sim.dating === pid ? "恋爱对象" : enabled ? "暧昧对象" : "重要人物";

  const meter = (label: string, icon: string, value: number, max: number, gradient: string) => (
    <div className="grid grid-cols-[6.2rem_minmax(0,1fr)_4.3rem] items-center gap-3">
      <span className="flex items-center gap-2 text-[15px] font-semibold text-[#675887]"><span className="text-xl">{icon}</span>{label}</span>
      <span className="h-4 overflow-hidden rounded-full bg-[#e8e1f5] shadow-inner">
        <span className={`block h-full rounded-full ${gradient} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} />
      </span>
      <span className="text-right text-[15px] font-semibold tabular-nums text-[#675887]">{value}/{max}</span>
    </div>
  );

  return <Modal title="人物档案" onClose={onClose} wide>
    <div className="-m-2 rounded-[28px] border border-[#d9cdf4] bg-[radial-gradient(circle_at_78%_12%,rgba(230,206,255,.56),transparent_31%),linear-gradient(145deg,#fff_0%,#f9f5ff_48%,#f5f0ff_100%)] p-3 font-serif text-[#3f3558] shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_18px_55px_rgba(120,83,185,.15)] sm:p-6">
      <section className="grid gap-5 sm:grid-cols-[minmax(180px,0.85fr)_minmax(0,1.15fr)] sm:items-center">
        <div className="mx-auto w-full max-w-[240px]">
          <div className="rounded-[24px] border-2 border-white bg-gradient-to-br from-[#e2c8ff] to-[#a88add] p-1 shadow-[0_10px_26px_rgba(105,72,165,.22)] [&>button]:!h-auto [&>button]:!w-full [&>button]:!aspect-[4/5] [&>button]:!rounded-[20px] [&>button]:!border-0">
            <Avatar src={n?.avatar} name={name} size={220} onPick={(dataUrl) => setNpcAvatar(pid, dataUrl)} />
          </div>
          <p className="mt-2 text-center text-[11px] text-[#9485b6]">点击头像即可更换</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-black tracking-wide text-[#403555] sm:text-4xl">{name}</h2>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#b49ae8] text-base text-white shadow">★</span>
          </div>
          <div className="mt-5 divide-y divide-[#ded4ef] text-[17px] text-[#766993]">
            <p className="flex items-center gap-3 py-3"><span className="text-xl text-[#ad98da]">▦</span> 年龄：{age}</p>
            <p className="flex items-center gap-3 py-3"><span className="text-xl text-[#ad98da]">▣</span> 职业：{occupation}</p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => commitGame({ ...game, sim: { ...game.sim, romanceEnabled: { ...game.sim.romanceEnabled, [pid]: !enabled } } })}
            className={`mt-4 rounded-full px-5 py-2 text-sm font-bold text-white shadow-[0_8px_18px_rgba(179,101,211,.22)] transition hover:-translate-y-0.5 ${enabled ? "bg-gradient-to-r from-[#be62d7] to-[#ba91e8]" : "bg-[#aaa1b8]"}`}
          >
            ♥ {relationshipLabel}
          </button>
        </div>
      </section>

      <section className="mt-6 space-y-5 rounded-[22px] border border-[#ddd2f2] bg-white/52 p-5 shadow-[inset_0_1px_0_white]">
        {meter("爱慕值", "♥", love, loveMax, "bg-gradient-to-r from-[#eb7bd2] to-[#df79c2]")}
        {meter("友善值", "◆", friendly, 100, "bg-gradient-to-r from-[#86dce1] to-[#8bd4d9]")}
      </section>

      <section className="mt-5 rounded-[22px] border border-[#ddd2f2] bg-white/48 p-5">
        <div className="mb-3 flex items-center gap-2 text-[17px] font-black tracking-wider text-[#695892]"><span className="text-[#b397e8]">✦</span> 人物介绍 <span className="h-px flex-1 bg-gradient-to-r from-[#cdbfeb] to-transparent" /></div>
        <p className={`whitespace-pre-wrap text-[15px] leading-[2] text-[#493f5e] ${detailsOpen ? "" : "line-clamp-4"}`}>{bio}</p>
        <button onClick={() => setDetailsOpen(!detailsOpen)} className="ml-auto mt-1 block px-1 text-sm font-semibold text-[#9a82cf]">{detailsOpen ? "收起⌃" : "展开⌄"}</button>

        {detailsOpen && (
          <div className="mt-4 border-t border-[#e2d9f1] pt-4">
            <dl className="space-y-2">
              {(game.npcFieldSchema ?? NPC_FIELDS).filter(f => f.enabled && !["identity", "age", "bio"].includes(f.id)).map(f => <div key={f.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 border-b border-[#e9e2f3] pb-2 text-[13px]"><dt className="text-[#9485aa]">{f.label}</dt><dd className="whitespace-pre-wrap break-words">{values[f.id] || "尚未得知"}</dd></div>)}
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2">{(game.npcAttributeSchema ?? STAT_ORDER.map(id => ({id,label:STAT_LABELS[id],enabled:true}))).filter(f=>f.enabled).map(f=><div key={f.id} className="flex justify-between gap-2 rounded-xl border border-[#e1d7ef] bg-white/55 p-2.5 text-xs"><span className="text-[#9485aa]">{f.label}</span><span>{attributes[f.id] ?? "尚未得知"}</span></div>)}</div>
            <p className="mt-3 text-[11px] text-[#9a8eaa]">{life?.dead ? "已故" : "在世"} · 健康 {life?.health.toFixed(1) ?? "100"} · 年龄段 {band ? `${band.min}–${band.max} 岁` : "未匹配"}</p>
          </div>
        )}
      </section>

      {!life?.dead && <button onClick={() => simContact(pid, name)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-[#9779d8] via-[#8f70cf] to-[#a588e1] py-4 text-lg font-bold tracking-wider text-white shadow-[0_12px_26px_rgba(105,75,170,.3)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0">☁ 与TA互动</button>}

      <div className="mt-6 border-t border-[#ded4ef] pt-2">{children}</div>
    </div>
  </Modal>;
}

export function NpcFieldSettings() {
  const { game, commitGame } = useGame();
  const [label, setLabel] = useState("");
  const [pid, setPid] = useState("");
  if (!game) return null;
  const fields = game.npcFieldSchema ?? NPC_FIELDS;
  const people = [...new Map([...PEOPLE, ...game.sim.npcs, ...game.npcs].map(n => [n.id, n])).values()];
  return <div className="space-y-3 text-sm text-ink">
    <p className="text-xs text-ink-soft">所有 NPC 共用以下字段。可改字段名称、隐藏字段或添加自定义字段；未填写时显示“尚未得知”。资料文本随本局存档保存，不改动数值规则。</p>
    {fields.map((f, i) => <div key={f.id} className="flex items-center gap-2"><input type="checkbox" aria-label={`显示${f.label}`} checked={f.enabled} onChange={e => commitGame({ ...game, npcFieldSchema: fields.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x) })} /><input aria-label="字段名称" className="min-w-0 flex-1 rounded border border-line bg-paper px-2 py-1" value={f.label} onChange={e => commitGame({ ...game, npcFieldSchema: fields.map((x,j) => j === i ? { ...x, label: e.target.value } : x) })} /></div>)}
    <div className="flex gap-2"><input placeholder="新字段名称" value={label} onChange={e => setLabel(e.target.value)} className="min-w-0 flex-1 rounded border border-line bg-paper px-2" /><button disabled={!label.trim()} onClick={() => { commitGame({ ...game, npcFieldSchema: [...fields, { id: `custom_${Date.now()}`, label: label.trim(), enabled: true }] }); setLabel(""); }} className="text-jade">添加字段</button></div>
    <select aria-label="选择编辑人物" value={pid} onChange={e => setPid(e.target.value)} className="w-full rounded border border-line bg-paper p-2"><option value="">选择人物填写资料</option>{people.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
    {pid && fields.map(f => <label key={f.id} className="block text-xs text-ink-soft">{f.label}<textarea rows={2} value={game.npcFieldValues?.[pid]?.[f.id] ?? ""} placeholder="留空沿用原资料" onChange={e => { const next = { ...game.npcFieldValues?.[pid] }; if (e.target.value) next[f.id] = e.target.value; else delete next[f.id]; commitGame({ ...game, npcFieldValues: { ...game.npcFieldValues, [pid]: next } }); }} className="mt-1 w-full rounded border border-line bg-paper p-2 text-ink" /></label>)}
  </div>;
}
