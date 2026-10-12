import { useGame } from "../store/gameCtx";
import { WORLD_RULE_DIMS, defaultWorldRules } from "../game/data";

/* 世界·社会规则设定：总开关 + 各维度下拉选择。
 * 关闭时 AI 沿用现实默认；开启后所选规则会注入叙事系统提示。 */
export default function WorldRulesPanel() {
  const { game, setWorldRules } = useGame();
  if (!game) return null;
  const wr = game.worldRules ?? defaultWorldRules();
  const enabled = wr.enabled;

  const setChoice = (dimId: string, optId: string) =>
    setWorldRules({ ...wr, choices: { ...wr.choices, [dimId]: optId } });

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        为本局设定专属的世界观。开启后，AI 演绎剧情、婚恋与人物关系时会严格遵循你选择的社会规则；关闭则沿用贴近现实的默认设定。
      </p>

      {/* 总开关 */}
      <button
        onClick={() => setWorldRules({ ...wr, enabled: !enabled })}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
          enabled ? "border-jade/60 bg-jade/10" : "border-line bg-paper/50"
        }`}
      >
        <span>
          <span className="block text-[14px] font-bold text-ink">启用自定世界规则</span>
          <span className="block text-[11.5px] text-ink-soft">{enabled ? "叙事将遵循下方设定" : "当前沿用现实默认规则"}</span>
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-jade" : "bg-line"}`}
          aria-hidden
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* 各维度下拉 */}
      <div className={`space-y-3 transition ${enabled ? "" : "pointer-events-none opacity-45"}`}>
        {WORLD_RULE_DIMS.map((d) => {
          const cur = wr.choices[d.id] ?? d.def;
          const curOpt = d.options.find((o) => o.id === cur) ?? d.options[0];
          return (
            <div key={d.id} className="rounded-2xl border border-line bg-paper/40 p-3.5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-bold text-ink">{d.label}</span>
                <span className="text-[11px] text-ink-soft">{d.hint}</span>
              </div>
              <div className="relative">
                <select
                  value={cur}
                  onChange={(e) => setChoice(d.id, e.target.value)}
                  disabled={!enabled}
                  className="w-full appearance-none rounded-xl border border-line bg-paper-2 px-3 py-2.5 pr-9 text-[13.5px] font-medium text-ink transition focus:border-jade focus:outline-none"
                >
                  {d.options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-soft">▾</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">{curOpt.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
