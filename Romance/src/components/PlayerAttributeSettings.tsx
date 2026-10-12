import { useGame } from "../store/gameCtx";
import { DEFAULT_PLAYER_ATTRIBUTES } from "../lib/playerAttributes";
import { STAT_ORDER } from "../game/data";

export default function PlayerAttributeSettings() {
  const { game, commitGame } = useGame();
  if (!game) return null;
  const fields = game.playerAttributeSchema ?? DEFAULT_PLAYER_ATTRIBUTES;
  const updateSchema = (id: string, patch: Partial<(typeof fields)[number]>) => commitGame({ ...game, playerAttributeSchema: fields.map((field) => field.id === id ? { ...field, ...patch } : field) });
  const valueOf = (id: string) => id in game.sim.stats ? game.sim.stats[id as keyof typeof game.sim.stats] : (game.sim as unknown as Record<string, number>)[id] ?? 0;
  const setValue = (id: string, raw: string) => {
    const field = fields.find((item) => item.id === id);
    const value = Math.max(0, Math.min(field?.max ?? 999, Number(raw) || 0));
    const sim = STAT_ORDER.includes(id as typeof STAT_ORDER[number]) ? { ...game.sim, stats: { ...game.sim.stats, [id]: value } } : { ...game.sim, [id]: value };
    commitGame({ ...game, sim });
  };
  return <div className="space-y-3 text-sm text-ink">
    <p className="rounded-xl border border-jade/30 bg-jade/5 p-3 text-xs leading-relaxed text-ink-soft">主属性与次要属性都读取真实游戏数值。这里可调整名称、分组、显示状态、上限和当前存档数值；不会创建无法被规则引擎识别的假属性。</p>
    {(["primary", "secondary"] as const).map((group) => <section key={group} className="rounded-xl border border-line p-3">
      <h3 className="mb-2 font-bold text-jade">{group === "primary" ? "主属性" : "次要属性"}</h3>
      <div className="space-y-2">{fields.filter((field) => field.group === group).map((field) => <div key={field.id} className="grid grid-cols-[auto_minmax(0,1fr)_82px] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_88px_72px_72px]">
        <input type="checkbox" checked={field.enabled} onChange={(e) => updateSchema(field.id, { enabled: e.target.checked })} aria-label={`显示${field.label}`} />
        <input value={field.label} onChange={(e) => updateSchema(field.id, { label: e.target.value })} className="min-w-0 rounded-lg border border-line bg-paper px-2 py-1.5" aria-label="属性名称" />
        <select value={field.group} onChange={(e) => updateSchema(field.id, { group: e.target.value as "primary" | "secondary" })} className="rounded-lg border border-line bg-paper px-1 py-1.5 text-xs"><option value="primary">主属性</option><option value="secondary">次要属性</option></select>
        <input type="number" min={1} value={field.max} onChange={(e) => updateSchema(field.id, { max: Math.max(1, Number(e.target.value) || 1) })} className="rounded-lg border border-line bg-paper px-2 py-1.5" title="数值上限" />
        <input type="number" min={0} max={field.max} value={valueOf(field.id)} onChange={(e) => setValue(field.id, e.target.value)} className="rounded-lg border border-line bg-paper px-2 py-1.5" title="当前数值" />
      </div>)}</div>
    </section>)}
    <p className="text-[11px] text-ink-soft">每行依次为：显示开关、属性名称、主/次分组、数值上限、当前数值。</p>
  </div>;
}
