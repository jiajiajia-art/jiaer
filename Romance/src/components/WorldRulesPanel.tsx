import { useGame } from "../store/gameCtx";
import { defaultWorldRules } from "../game/data";
import { getWorldRuleDims, hasWorldGigs, useMods } from "../mods/registry";
import { activeGender, ruleEffects } from "../game/worldRules";
import { ScopeBanner } from "./EditorKit";
import type { WorldRules } from "../lib/types";

/* 世界规则选择器：所有维度合并在一张卡里，每行「规则名 + 可选项」。
 * 没有单独的总开关——任一维度偏离默认即视为启用，全部为默认即沿用现实设定。
 * （开局与游戏内共用） */
export function WorldRuleCards({ rules, onChange, female }: { rules: WorldRules; onChange: (r: WorldRules) => void; female?: boolean; compact?: boolean }) {
  // 功能注释：AI 脏 worldRules 可能含 null/缺 options；一律收成可渲染维度，禁止预览建角再炸 reading 'length'
  const rawDims = getWorldRuleDims();
  const dims = (Array.isArray(rawDims) ? rawDims : [])
    .filter((d): d is NonNullable<typeof d> => !!d && typeof d === "object" && Array.isArray(d.options) && d.options.length > 0);
  if (!dims.length) return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-soft">当前世界观没有定义规则维度。</p>;
  // 旧存档可能存有选择但总开关关闭：此时按默认显示，与引擎实际结算一致
  const choiceMap = rules?.choices && typeof rules.choices === "object" ? rules.choices : {};
  const curOf = (id: string, def: string) => (rules?.enabled ? choiceMap[id] ?? def : def);
  const pick = (dim: string, opt: string) => {
    const choices = { ...Object.fromEntries(dims.map((d) => [d.id, curOf(d.id, d.def)])), [dim]: opt };
    onChange({ enabled: dims.some((d) => choices[d.id] !== d.def), choices });
  };

  return (
    <div className="rounded-2xl border border-line bg-paper/80 px-3.5" data-world-rule-cards="1">
      {dims.map((d, i) => {
        const options = d.options;
        const cur = curOf(d.id, d.def);
        const fx = ruleEffects(d.id, cur, female ?? activeGender() === "女", hasWorldGigs()) ?? [];
        return (
          <div key={d.id} className={`py-3 ${i ? "border-t border-line" : ""}`}>
            <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-ink-soft">{d.label}</p>
            <div role="radiogroup" aria-label={d.label} className="grid overflow-hidden rounded-lg border border-line" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
              {options.map((o, j) => {
                if (!o) return null;
                const on = !!o.id && o.id === cur;
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={on} title={o.desc}
                    onClick={() => pick(d.id, o.id)}
                    className={`truncate px-1 py-2 text-[12.5px] transition-colors ${j ? "border-l border-line" : ""} ${
                      on ? "bg-ink font-semibold text-paper" : "bg-paper text-ink-soft hover:bg-paper-2 hover:text-ink"
                    }`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {fx.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-relaxed text-ink-soft">
                {fx.map((t) => <li key={t} className="before:mr-1 before:text-jade before:content-['·']">{t}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* 游戏内（☰ 菜单）世界规则设置 */
export default function WorldRulesPanel() {
  const { game, setWorldRules } = useGame();
  useMods();
  if (!game) return null;
  const wr = game.worldRules ?? defaultWorldRules();

  return (
    <div className="space-y-3">
      <ScopeBanner scope="save">世界规则只作用于当前存档，切换即时生效。</ScopeBanner>
      <WorldRuleCards rules={wr} onChange={setWorldRules} />
      {wr.enabled && (
        <button onClick={() => setWorldRules(defaultWorldRules())} className="w-full rounded-xl border border-line py-2 text-[12.5px] font-medium text-ink-soft transition hover:text-ink">恢复默认规则</button>
      )}
    </div>
  );
}
