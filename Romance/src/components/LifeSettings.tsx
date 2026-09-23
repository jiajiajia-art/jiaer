import { useGame } from "../store/gameCtx";
import { LIFE_DEFAULT, type LifeRules } from "../game/lifecycle";
export default function LifeSettings(){
 const {game,commitGame}=useGame(); if(!game)return null;
 const r=game.sim.lifeRules??LIFE_DEFAULT;
 const save=(part:Partial<LifeRules>)=>commitGame({...game,sim:{...game.sim,lifeRules:{...r,...part}}});
 return <div className="space-y-4 text-sm">
 <label className="flex gap-2"><input type="checkbox" checked={r.enabled} onChange={e=>save({enabled:e.target.checked})}/>启用 NPC 生命周期</label>
 <p className="text-xs text-ink-soft">每游戏日结算一次；加载、编辑不重复判定。年龄未知的人物需先在 NPC 资料中填写年龄。死亡后保留档案，停止出场及恋爱互动。</p>
 <h3 className="font-bold">年龄段边界</h3><p className="text-xs text-ink-soft">最小年龄 ≤ 最大年龄，重叠时按顺序匹配。</p>
 {r.bands.map((b,i)=><div key={i} className="flex items-center gap-2">从<input aria-label="最小年龄" type="number" min={0} max={b.max} value={b.min} onChange={e=>save({bands:r.bands.map((x,j)=>i===j?{...x,min:Math.max(0,Math.min(x.max,Number(e.target.value)))}:x)})} className="w-16 border border-line bg-paper p-1"/>到<input aria-label="最大年龄" type="number" min={b.min} value={b.max} onChange={e=>save({bands:r.bands.map((x,j)=>i===j?{...x,max:Math.max(x.min,Number(e.target.value))}:x)})} className="w-16 border border-line bg-paper p-1"/>岁<button aria-label="删除年龄段" onClick={()=>save({bands:r.bands.filter((_,j)=>j!==i)})}>×</button></div>)}
 <button className="text-jade" onClick={()=>save({bands:[...r.bands,{min:0,max:120}]})}>＋ 添加年龄段</button>
 <h3 className="font-bold">寿命与健康</h3>
 {([["maxAge","最大寿命（岁）",1,200],["declineAge","健康开始衰减年龄",0,200],["threshold","死亡健康阈值",0,100],["decline","每年健康衰减值",0,100]] as const).map(([key,label,min,max])=><label key={key} className="flex justify-between gap-2">{label}<input type="number" min={min} max={max} value={r[key]} onChange={e=>save({[key]:Math.max(min,Math.min(max,Number(e.target.value)))})} className="w-24 border border-line bg-paper p-1"/></label>)}
 <h3 className="font-bold">死亡率模型 · 每日百分比</h3>
 {([["base","基础死亡率 (%)"],["ageRate","超龄每岁增加 (%)"],["healthWeight","健康风险权重 (%)"],["cap","死亡率封顶 (%)"]] as const).map(([key,label])=><label key={key} className="flex justify-between gap-2">{label}<input type="number" min={0} max={100} step={0.001} value={r[key]} onChange={e=>save({[key]:Math.max(0,Math.min(100,Number(e.target.value)))})} className="w-24 border border-line bg-paper p-1"/></label>)}
 <p className="text-xs text-ink-soft">每日概率 = 基础率 + 超过衰减年龄的岁数 × 超龄增量 + (100 − 健康) ÷ 100 × 健康权重，最高不超过封顶值。达到最大寿命或健康阈值直接判定死亡，不受概率封顶影响。</p>
 </div>;
}
