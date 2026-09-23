import { careersOf } from "../game/careers";
import LifeSettings from "./LifeSettings";
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { PEOPLE, profileOf } from "../worlds/star2005/content";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { NpcFieldSettings } from "./NpcProfile";
import WorldRulesPanel from "./WorldRulesPanel";
import WorldBookPanel from "./WorldBookPanel";
import MapEditorPanel from "./MapEditorPanel";
import DebutPathSettings from "./DebutPathSettings";
import CoverSettings from "./CoverSettings";
import PlayerAttributeSettings from "./PlayerAttributeSettings";
import type { MainlineBranch } from "../lib/types";

export const ATTRIBUTE_FIELDS = STAT_ORDER.map(id => ({ id, label: STAT_LABELS[id], enabled: true }));
function MainlineEditor({ game, commitGame }: { game: any; commitGame: (g:any)=>void }) { const b=game.mainline??{title:"",synopsis:"",chapters:[],branches:[]}; const save=(x:any)=>commitGame({...game,mainline:{...b,...x}}); return <div className="space-y-2"><input placeholder="主线名称" value={b.title} onChange={e=>save({title:e.target.value})} className="w-full rounded border border-line bg-paper p-2"/><textarea placeholder="主线简介" value={b.synopsis} onChange={e=>save({synopsis:e.target.value})} className="w-full rounded border border-line bg-paper p-2" rows={2}/><button onClick={()=>save({branches:[...b.branches,{id:`branch_${Date.now()}`,title:"新分支",location:"apartment",chance:20,seed:"",enabled:true}]})} className="rounded border border-dashed border-jade px-2 py-1 text-xs text-jade">＋添加分支</button></div>; }
export default function EditorPanel() {
  const { game, commitGame } = useGame();
  const [tab, setTab] = useState("cover");
  const [pid, setPid] = useState("");
  const [careerSearch, setCareerSearch] = useState("");
  const [name, setName] = useState("");
  if (!game) return null;
  const people = [...new Map([...PEOPLE, ...game.sim.npcs, ...game.npcs].map(n => [n.id, n])).values()];
  const fields = game.npcAttributeSchema ?? ATTRIBUTE_FIELDS;
  const careers = careersOf(game);
  const saveValue = (id: string, raw: string) => {
    const values = { ...game.npcAttributeValues?.[pid] };
    if (!raw) delete values[id]; else values[id] = Math.max(0, Math.min(999, Number(raw)));
    commitGame({ ...game, npcAttributeValues: { ...game.npcAttributeValues, [pid]: values }, sim: { ...game.sim, npcs: game.sim.npcs.map(n => n.id === pid && raw && STAT_ORDER.includes(id as typeof STAT_ORDER[number]) ? { ...n, stats: { ...n.stats, [id]: values[id] } } : n) } });
  };
  return <div className="space-y-3 text-sm text-ink">
    <div className="sticky top-0 z-10 flex flex-wrap gap-1 bg-paper-2 pb-2">
      {[["cover", "封面配置"], ["debut", "开局线路"], ["playerStats", "主角属性"], ["map", "地点与事件库"], ["life", "年龄与寿命"], ["attributes", "NPC 属性字段"], ["profile", "NPC 资料字段"], ["careers", "职业库"], ["mainline", "主线剧情"], ["rules", "世界规则"], ["book", "世界书"]].map(([id,label]) => <button key={id} onClick={() => {setTab(id);setName("");}} className={`rounded-lg border px-2 py-1 text-xs ${tab === id ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{label}</button>)}
    </div>
    {tab === "life" && <LifeSettings />}
    {tab === "cover" && <CoverSettings />}
    {tab === "playerStats" && <PlayerAttributeSettings />}
    {tab === "debut" && <DebutPathSettings />}
    {tab === "profile" && <NpcFieldSettings />}
    {tab === "global" && <GlobalPromptEditor game={game} commitGame={commitGame} />}
    {tab === "rules" && <WorldRulesPanel />}
    {tab === "book" && <WorldBookPanel />}
    {tab === "map" && <MapEditorPanel />} {tab === "mainline" && <MainlineEditor game={game} commitGame={commitGame} />}
    {tab === "spawn" && <SpawnEditor game={game} commitGame={commitGame} people={people} />}
    {tab === "attributes" && <>
      <p className="text-xs text-ink-soft">数值属性与文字资料分开管理。八维属性用于艺人数值；自定义属性用于档案展示，不自动产生玩法效果。关系与攻略状态在人物互动中调整。</p>
      {fields.map(f => <div key={f.id} className="flex gap-2"><input type="checkbox" aria-label={`显示${f.label}`} checked={f.enabled} onChange={e => commitGame({ ...game, npcAttributeSchema: fields.map(x => x.id === f.id ? {...x, enabled:e.target.checked} : x) })}/><input aria-label="属性名称" value={f.label} onChange={e => commitGame({...game,npcAttributeSchema:fields.map(x => x.id===f.id ? {...x,label:e.target.value}:x)})} className="min-w-0 flex-1 rounded border border-line bg-paper p-2" /></div>)}
      <div className="flex gap-2"><input placeholder="新增数值属性" value={name} onChange={e=>setName(e.target.value)} className="min-w-0 flex-1 rounded border border-line bg-paper p-2"/><button disabled={!name.trim()} onClick={()=>{commitGame({...game,npcAttributeSchema:[...fields,{id:`custom_${Date.now()}`,label:name.trim(),enabled:true}]});setName("");}}>添加</button></div>
      <select aria-label="选择 NPC" value={pid} onChange={e=>setPid(e.target.value)} className="w-full border border-line bg-paper p-2"><option value="">选择人物编辑数值</option>{people.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select>
      {pid && fields.map(f=><label key={f.id} className="flex items-center justify-between gap-2">{f.label}<input type="number" min={0} max={999} value={game.npcAttributeValues?.[pid]?.[f.id] ?? ""} placeholder={String(((profileOf(pid)?.stats ?? game.sim.npcs.find(n=>n.id===pid)?.stats) as Record<string, number | undefined> | undefined)?.[f.id] ?? "未设置")} onChange={e=>saveValue(f.id,e.target.value)} className="w-28 rounded border border-line bg-paper p-2" /></label>)}
    </>}
    {tab === "careers" && <>
      <p className="text-xs text-ink-soft">汇总世界职业方向、家庭职业、固定人物及当前存档中的职业，重复名称合并。支持编辑、新增和分配；修改职业资料不自动改变通告规则。</p>
      <input aria-label="搜索职业" placeholder={`搜索职业 · 共 ${careers.length} 项`} value={careerSearch} onChange={e=>setCareerSearch(e.target.value)} className="w-full rounded-lg border border-line bg-paper p-2" />
      {careers.filter(c => `${c.name} ${c.description}`.includes(careerSearch.trim())).map(c=><div key={c.id} className="space-y-2 rounded-lg border border-line p-2"><input aria-label="职业名称" value={c.name} onChange={e=>commitGame({...game,careerLibrary:careers.map(x=>x.id===c.id?{...x,name:e.target.value}:x)})} className="w-full border border-line bg-paper p-2"/><textarea aria-label="职业说明" value={c.description} onChange={e=>commitGame({...game,careerLibrary:careers.map(x=>x.id===c.id?{...x,description:e.target.value}:x)})} className="w-full border border-line bg-paper p-2"/><button onClick={()=>commitGame({...game,careerLibrary:careers.filter(x=>x.id!==c.id),hiddenCareerIds:[...(game.hiddenCareerIds??[]),c.id],npcCareerIds:Object.fromEntries(Object.entries(game.npcCareerIds??{}).filter(([,id])=>id!==c.id))})} className="text-danger">删除职业</button></div>)}
      <div className="flex gap-2"><input value={name} placeholder="职业名称" onChange={e=>setName(e.target.value)} className="min-w-0 flex-1 border border-line bg-paper p-2"/><button disabled={!name.trim()} onClick={()=>{commitGame({...game,careerLibrary:[...careers,{id:`career_${Date.now()}`,name:name.trim(),description:""}]});setName("");}}>添加职业</button></div>
      <select aria-label="选择人物" value={pid} onChange={e=>setPid(e.target.value)} className="w-full border border-line bg-paper p-2"><option value="">选择人物分配职业</option>{people.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select>
      {pid && <select aria-label="分配职业" value={game.npcCareerIds?.[pid]??""} onChange={e=>commitGame({...game,npcCareerIds:{...game.npcCareerIds,[pid]:e.target.value}})} className="w-full border border-line bg-paper p-2"><option value="">沿用原职业</option>{careers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
    </>}
  </div>;
}

function SpawnEditor({ game, commitGame, people }: { game: any; commitGame: (g: any) => void; people: any[] }) {
  const [pid, setPid] = useState("");
  const person = people.find((n) => n.id === pid);
  const profile = pid ? profileOf(pid) : undefined;
  if (!person) return <div className="space-y-3"><p className="text-xs text-ink-soft">编辑人物在哪些地点出现，以及玩家初遇前需要满足的条件。运行时由世界规则统一裁决。</p><select value={pid} onChange={(e) => setPid(e.target.value)} className="w-full rounded border border-line bg-paper p-2"><option value="">选择人物</option>{people.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>;
  const save = (field: string, value: any) => commitGame({ ...game, npcSpawnOverrides: { ...(game.npcSpawnOverrides ?? {}), [pid]: { ...(game.npcSpawnOverrides?.[pid] ?? {}), [field]: value } } });
  const override = game.npcSpawnOverrides?.[pid] ?? {};
  return <div className="space-y-3"><p className="text-xs text-ink-soft">人物：{person.name} · 原始常驻地点：{profile?.home ?? person.home ?? "未设置"}</p><label className="block text-xs text-ink-soft">出现地点<input value={override.home ?? profile?.home ?? person.home ?? ""} onChange={(e) => save("home", e.target.value)} className="mt-1 w-full rounded border border-line bg-paper p-2" /></label><label className="block text-xs text-ink-soft">初遇/登场提示<textarea rows={2} value={override.presentHint ?? profile?.presentHint ?? ""} onChange={(e) => save("presentHint", e.target.value)} className="mt-1 w-full rounded border border-line bg-paper p-2" placeholder="例如：第 3 周后前往片场即可遇见" /></label><p className="text-[11px] text-ink-soft">当前初遇条件：{profile?.requires?.map((r) => r.hint).join(" · ") || "无额外条件，进入对应地点即可初遇"}</p></div>;
}

function GlobalPromptEditor({ game, commitGame }: { game: any; commitGame: (g: any) => void }) {
  return <div className="space-y-3"><div><p className="text-sm font-bold text-ink">全局系统提示词</p><p className="mt-1 text-xs leading-relaxed text-ink-soft">这段内容会作为所有 AI 互动共用的表达基调。它只影响文风、主持原则和回应方式，不会写入世界书，也不会成为世界事实。</p></div><textarea value={game.globalSystemPrompt ?? ""} onChange={(e) => commitGame({ ...game, globalSystemPrompt: e.target.value })} rows={12} placeholder="例如：保持细腻克制的中文叙事；人物有自己的动机，不无条件服从；每次回应都推动关系、信息或局面至少一项……" className="w-full rounded-xl border border-line bg-paper p-3 text-sm leading-relaxed text-ink outline-none focus:border-jade" /><p className="text-[11px] text-ink-soft">保存后立即对主线剧情、人物互动、手机聊天和赠礼反应生效。</p></div>;
}

