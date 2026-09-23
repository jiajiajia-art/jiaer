import { useState } from "react";
import { IDENTITIES } from "../game/data";
import { DEFAULT_DEBUT_PATHS, loadDebutPaths, resetDebutPaths, saveDebutPaths, type DebutPath } from "../lib/debutPaths";

const field = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-jade";

export default function DebutPathSettings() {
  const [paths, setPaths] = useState<DebutPath[]>(loadDebutPaths);
  const [expanded, setExpanded] = useState<string | null>(paths[0]?.id ?? null);
  const commit = (next: DebutPath[]) => { setPaths(next); saveDebutPaths(next); };
  const update = (id: string, patch: Partial<DebutPath>) => commit(paths.map((path) => path.id === id ? { ...path, ...patch } : path));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= paths.length) return;
    const next = [...paths];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const add = () => {
    const id = `custom_${Date.now()}`;
    commit([...paths, { ...DEFAULT_DEBUT_PATHS[0], id, name: "新出道路径", tag: "自定义线路", open: false, choose: [...DEFAULT_DEBUT_PATHS[0].choose], fixed: [], blurb: "填写这条线路的开局特色。", about: "填写玩家选择这条线路后所面对的处境、偏见与目标。", perks: "填写数值倾向；实际加成由下方基础模板决定。" }]);
    setExpanded(id);
  };
  return <div className="space-y-3 text-sm text-ink">
    <div className="rounded-xl border border-jade/30 bg-jade/5 p-3 text-xs leading-relaxed text-ink-soft">这里控制新游戏的“选择出道路径”页面。修改会自动保存到本机，并在下一次进入建角页时生效；基础模板决定实际开局数值，文案不会直接修改数值。</div>
    {paths.map((path, index) => <section key={path.id} className="rounded-xl border border-line bg-paper-2/60">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => setExpanded(expanded === path.id ? null : path.id)} className="min-w-0 flex-1 text-left"><span className="font-bold text-ink">{path.name}</span><span className="ml-2 text-xs text-ink-soft">{path.tag}</span></button>
        <label className="flex items-center gap-1 text-xs text-ink-soft"><input type="checkbox" checked={path.open} onChange={(e) => update(path.id, { open: e.target.checked })} /> 玩家可选</label>
        <button onClick={() => move(index, -1)} disabled={index === 0} className="px-1 text-ink-soft disabled:opacity-25">↑</button>
        <button onClick={() => move(index, 1)} disabled={index === paths.length - 1} className="px-1 text-ink-soft disabled:opacity-25">↓</button>
      </div>
      {expanded === path.id && <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
        <label className="text-xs text-ink-soft">线路名称<input className={`${field} mt-1`} value={path.name} onChange={(e) => update(path.id, { name: e.target.value })} /></label>
        <label className="text-xs text-ink-soft">副标题 / 标签<input className={`${field} mt-1`} value={path.tag} onChange={(e) => update(path.id, { tag: e.target.value })} /></label>
        <label className="text-xs text-ink-soft">固定年龄<input className={`${field} mt-1`} value={path.age} onChange={(e) => update(path.id, { age: e.target.value })} /></label>
        <label className="text-xs text-ink-soft">母校 / 来源<input className={`${field} mt-1`} value={path.school} onChange={(e) => update(path.id, { school: e.target.value })} /></label>
        <label className="text-xs text-ink-soft sm:col-span-2">卡片摘要<textarea className={`${field} mt-1`} rows={2} value={path.blurb} onChange={(e) => update(path.id, { blurb: e.target.value })} /></label>
        <label className="text-xs text-ink-soft sm:col-span-2">线路详情<textarea className={`${field} mt-1`} rows={4} value={path.about} onChange={(e) => update(path.id, { about: e.target.value })} /></label>
        <label className="text-xs text-ink-soft">玩家可自由决定（每行一项）<textarea className={`${field} mt-1`} rows={6} value={path.choose.join("\n")} onChange={(e) => update(path.id, { choose: e.target.value.split("\n").filter(Boolean) })} /></label>
        <label className="text-xs text-ink-soft">固定不可更改（每行一项）<textarea className={`${field} mt-1`} rows={6} value={path.fixed.join("\n")} onChange={(e) => update(path.id, { fixed: e.target.value.split("\n").filter(Boolean) })} /></label>
        <label className="text-xs text-ink-soft sm:col-span-2">数值倾向说明<textarea className={`${field} mt-1`} rows={2} value={path.perks} onChange={(e) => update(path.id, { perks: e.target.value })} /></label>
        <label className="text-xs text-ink-soft sm:col-span-2">实际数值基础模板<select className={`${field} mt-1`} value={path.identityId} onChange={(e) => update(path.id, { identityId: e.target.value })}>{IDENTITIES.map((identity) => <option key={identity.id} value={identity.id}>{identity.name} · {identity.desc}</option>)}</select></label>
        <button onClick={() => commit(paths.filter((item) => item.id !== path.id))} disabled={paths.length <= 1} className="justify-self-start text-xs text-danger disabled:opacity-30">删除这条线路</button>
      </div>}
    </section>)}
    <div className="flex flex-wrap gap-2"><button onClick={add} className="rounded-lg border border-dashed border-jade px-3 py-2 text-xs font-semibold text-jade">＋新增线路</button><button onClick={() => { resetDebutPaths(); const next = loadDebutPaths(); setPaths(next); setExpanded(next[0]?.id ?? null); }} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-soft">恢复默认线路</button></div>
  </div>;
}
