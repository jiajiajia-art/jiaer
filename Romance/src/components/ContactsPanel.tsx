import { useState, type ReactNode } from "react";
import type { AttrDef } from "../lib/types";
import type { CreationPath, StatsSlot } from "../game/data";
import { valueSources, srcValue } from "../game/valueSources";
import {
  CONTACT_ICONS, CONTACT_ICON_LABEL, CONTACT_TONES, contactsDefaults,
  type ContactGroup, type ContactMetric, type ContactOrg, type ContactsSlot, type ContactStage, type ContactSrc, type ContactTone,
} from "../game/contacts";
import ContactIcon from "./ContactIcon";
import IntInput from "./IntInput";

const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const lbl = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";
const TONE_LABEL: Record<ContactTone, string> = { jade: "主色", coral: "珊瑚", gold: "暖金", danger: "警示", ink: "中性" };
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* 起步模板：只是数据示例，载入后可任意改名 / 删除 */
const TEMPLATES: { name: string; make: () => ContactsSlot }[] = [
  { name: "通用", make: contactsDefaults.generic },
  { name: "娱乐圈", make: () => ({ ...contactsDefaults.ent(), title: "人脉" }) },
  { name: "校园", make: () => ({
    title: "同窗", subtitle: "校园往来",
    groups: [{ id: "family", label: "家人" }, { id: "teacher", label: "任课老师", keywords: ["老师", "教师", "班主任"] }, { id: "class", label: "同班同学", keywords: ["同学"] }, { id: "club", label: "社团伙伴", keywords: ["社团", "社长"] }, { id: "rest", label: "其他", rest: true }],
    metrics: [{ src: { kind: "rel" }, icon: "heart", tone: "coral" }],
    stages: [{ id: "a", label: "形影不离", min: 60, tone: "jade" }, { id: "b", label: "熟悉", min: 20, tone: "jade" }, { id: "c", label: "面熟", min: 0, tone: "gold" }, { id: "d", label: "不对付", min: -100, tone: "danger" }],
  }) },
  { name: "修仙", make: () => ({
    title: "道缘", subtitle: "师门与江湖",
    groups: [{ id: "blood", label: "血亲" }, { id: "elder", label: "师门长辈", keywords: ["师父", "长老", "掌门"] }, { id: "peer", label: "同门弟子", keywords: ["师兄", "师姐", "师弟", "师妹", "弟子"] }, { id: "jianghu", label: "江湖相识", rest: true }],
    metrics: [{ src: { kind: "rel" }, icon: "gem", tone: "jade" }],
    stages: [{ id: "a", label: "生死之交", min: 70, tone: "jade" }, { id: "b", label: "道友", min: 30, tone: "jade" }, { id: "c", label: "萍水相逢", min: 0, tone: "gold" }, { id: "d", label: "宿敌", min: -100, tone: "danger" }],
  }) },
];

function Card({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-paper-2 p-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[12.5px] font-bold text-ink">{title}</p>
        {hint && <p className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{hint}</p>}
        {action}
      </div>
      {children}
    </div>
  );
}
const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length || from === to) return list;
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
};
const words = (s: string) => s.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);

export default function ContactsPanel({ value, onChange, statsValue, attrsValue, pathsValue }: {
  value?: ContactsSlot; onChange: (v?: ContactsSlot) => void;
  statsValue?: StatsSlot; attrsValue?: AttrDef[]; pathsValue?: CreationPath[];
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const v = value ?? {};
  const set = (p: Partial<ContactsSlot>) => onChange({ ...v, ...p });
  const groups = v.groups ?? [];
  const metrics = v.metrics ?? [];
  const stages = v.stages ?? [];
  const orgs = v.orgs ?? [];
  const setGroup = (i: number, p: Partial<ContactGroup>) => set({ groups: groups.map((g, j) => (j === i ? { ...g, ...p } : g)) });
  const setStage = (i: number, p: Partial<ContactStage>) => set({ stages: stages.map((g, j) => (j === i ? { ...g, ...p } : g)) });
  const setOrg = (i: number, p: Partial<ContactOrg>) => set({ orgs: orgs.map((g, j) => (j === i ? { ...g, ...p } : g)) });
  const setMetric = (i: number, m?: ContactMetric) => {
    const next: (ContactMetric | undefined)[] = [metrics[0], metrics[1]];
    next[i] = m;
    set({ metrics: next.filter(Boolean) as ContactMetric[] });
  };

  // 数值来源：此人与主角的关系值 + 全局属性池（与人物线路 / 结局编辑器同一套）
  const pool = valueSources({ stats: statsValue, attrs: attrsValue, paths: pathsValue });
  const poolGroups = [...new Set(pool.map((p) => p.group))];
  const srcKey = (s?: ContactSrc) => (!s ? "" : s.kind === "rel" ? "rel" : srcValue(s));
  const parseSrc = (k: string): ContactSrc | undefined => {
    if (k === "rel") return { kind: "rel" };
    const hit = pool.find((p) => srcValue(p) === k);
    return hit ? { kind: hit.kind, key: hit.key, label: hit.label } : undefined;
  };

  if (!value) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-ink-soft">尚未配置：沿用世界默认的人脉页。选一个起步模板后可任意改名、增删分组与阶段词。</p>
        <div className="flex flex-wrap gap-1.5">{TEMPLATES.map((t) => <button key={t.name} className={btn} onClick={() => onChange(t.make())}>载入「{t.name}」模板</button>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Card title="页面" hint="标题同时用作底部标签（留空沿用「术语」里的叫法）"
        action={<button className={`${btn} shrink-0`} onClick={() => onChange(undefined)}>恢复默认</button>}>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lbl}>标题 / 标签名</span><input className={inp} value={v.title ?? ""} placeholder="如：人脉、同窗、道缘" onChange={(e) => set({ title: e.target.value || undefined })} /></label>
          <label><span className={lbl}>副标题</span><input className={inp} value={v.subtitle ?? ""} placeholder="如：往来人物" onChange={(e) => set({ subtitle: e.target.value || undefined })} /></label>
        </div>
      </Card>

      <Card title="分组" hint="拖动排序 · 人物可在「人物」里勾选多个分组；未勾选时按名单 / 关键词归类">
        {groups.length === 0 && <p className="text-[11.5px] text-ink-soft">还没有分组，列表将使用通用兜底分组。</p>}
        {groups.map((g, i) => (
          <div key={g.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag !== null) set({ groups: move(groups, drag, i) }); setDrag(null); }}
            className={`space-y-1.5 rounded-lg border bg-paper p-2 ${drag === i ? "border-jade" : "border-line"}`}>
            <div className="flex items-center gap-1.5">
              <span className="cursor-grab select-none px-0.5 text-ink-soft/60" aria-hidden>⋮⋮</span>
              <input className={inp} value={g.label} placeholder="分组名 *" onChange={(e) => setGroup(i, { label: e.target.value })} />
              <button className={`${btn} shrink-0`} disabled={i === 0} onClick={() => set({ groups: move(groups, i, i - 1) })} aria-label="上移">↑</button>
              <button className={`${btn} shrink-0`} disabled={i === groups.length - 1} onClick={() => set({ groups: move(groups, i, i + 1) })} aria-label="下移">↓</button>
              <button className={`${btn} shrink-0`} onClick={() => set({ groups: groups.filter((_, j) => j !== i) })} aria-label="删除分组">×</button>
            </div>
            <input className={inp} value={(g.keywords ?? []).join("、")} placeholder="身份关键词（顿号分隔，可留空），如：老师、班主任"
              onChange={(e) => setGroup(i, { keywords: words(e.target.value).length ? words(e.target.value) : undefined })} />
            <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink">
              <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!g.rest} onChange={(e) => setGroup(i, { rest: e.target.checked || undefined })} />兜底组（收纳未归类的人）</label>
              <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!g.pool} onChange={(e) => setGroup(i, { pool: e.target.checked || undefined })} />收纳自动生成的人物</label>
              <label className="flex items-center gap-1">超过<IntInput className="w-14" label="折叠阈值" value={g.fold ?? 0} onChange={(n) => setGroup(i, { fold: n > 0 ? n : undefined })} />人折叠（0 = 不折叠）</label>
            </div>
          </div>
        ))}
        <button className={btn} onClick={() => set({ groups: [...groups, { id: uid("g"), label: `分组 ${groups.length + 1}` }] })}>＋ 添加分组</button>
      </Card>

      <Card title="卡片数值" hint="每张人物卡右侧显示的两项数值与图标，与数值含义无固定绑定">
        {[0, 1].map((i) => {
          const m = metrics[i];
          return (
            <div key={i} className="space-y-1.5 rounded-lg border border-line bg-paper p-2">
              <div className="flex items-center gap-1.5">
                <span className="w-10 shrink-0 text-[11.5px] font-bold text-ink-soft">{i === 0 ? "左侧" : "右侧"}</span>
                <select className={inp} value={srcKey(m?.src)} onChange={(e) => { const src = parseSrc(e.target.value); setMetric(i, src ? { icon: m?.icon ?? "dot", tone: m?.tone, src } : undefined); }}>
                  <option value="">（不显示）</option>
                  <option value="rel">与主角的关系值（阶段词依据此值）</option>
                  {poolGroups.map((pg) => (
                    <optgroup key={pg} label={pg}>{pool.filter((p) => p.group === pg).map((p) => <option key={srcValue(p)} value={srcValue(p)}>{p.label}</option>)}</optgroup>
                  ))}
                </select>
                {m && (
                  <select className={`${inp} w-20 shrink-0`} value={m.tone ?? "jade"} onChange={(e) => setMetric(i, { ...m, tone: e.target.value as ContactTone })}>
                    {CONTACT_TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
                  </select>
                )}
              </div>
              {m && (
                <div className="flex flex-wrap gap-1">
                  {CONTACT_ICONS.map((ic) => (
                    <button key={ic} title={CONTACT_ICON_LABEL[ic]} aria-label={CONTACT_ICON_LABEL[ic]} aria-pressed={m.icon === ic} onClick={() => setMetric(i, { ...m, icon: ic })}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${m.icon === ic ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft hover:border-jade"}`}>
                      <ContactIcon kind={ic} size={13} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-ink-soft">属性按 key / 名称在人物自身的属性与关系维度里取值；某人没有该项时卡片上自动隐藏。</p>
      </Card>

      <Card title="关系阶段词" hint="关系值 ≥ 下限时取下限最高的一条；可限定只对某些分组生效">
        {stages.map((st, i) => (
          <div key={st.id} className="space-y-1.5 rounded-lg border border-line bg-paper p-2">
            <div className="flex items-center gap-1.5">
              <input className={inp} value={st.label} placeholder="阶段词，如：萍水相逢" onChange={(e) => setStage(i, { label: e.target.value })} />
              <span className="shrink-0 text-[11.5px] text-ink-soft">≥</span>
              <IntInput className="w-16 shrink-0" label="下限" value={st.min} onChange={(n) => setStage(i, { min: n })} />
              <select className={`${inp} w-20 shrink-0`} value={st.tone ?? "jade"} onChange={(e) => setStage(i, { tone: e.target.value as ContactTone })}>
                {CONTACT_TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
              </select>
              <button className={`${btn} shrink-0`} onClick={() => set({ stages: stages.filter((_, j) => j !== i) })} aria-label="删除阶段词">×</button>
            </div>
            {groups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="text-ink-soft">仅限分组：</span>
                {groups.map((g) => {
                  const on = !!st.groups?.includes(g.id);
                  return <button key={g.id} onClick={() => { const next = on ? st.groups!.filter((x) => x !== g.id) : [...(st.groups ?? []), g.id]; setStage(i, { groups: next.length ? next : undefined }); }}
                    className={`rounded-full border px-2 py-0.5 ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{g.label || "未命名"}</button>;
                })}
                {!st.groups?.length && <span className="text-ink-soft/70">（全部）</span>}
              </div>
            )}
          </div>
        ))}
        <button className={btn} onClick={() => set({ stages: [...stages, { id: uid("s"), label: "", min: 0, tone: "jade" }] })}>＋ 添加阶段词</button>
      </Card>

      <Card title="所属组织" hint="可选 · 显示在身份后；人物可在「人物」里选择所属">
        {orgs.map((o, i) => (
          <div key={o.id} className="flex items-center gap-1.5">
            <input className={inp} value={o.label} placeholder="如：青云宗、星光传媒、高二（3）班" onChange={(e) => setOrg(i, { label: e.target.value })} />
            <button className={`${btn} shrink-0`} onClick={() => set({ orgs: orgs.filter((_, j) => j !== i) })} aria-label="删除组织">×</button>
          </div>
        ))}
        <button className={btn} onClick={() => set({ orgs: [...orgs, { id: uid("o"), label: "" }] })}>＋ 添加组织</button>
      </Card>
    </div>
  );
}
