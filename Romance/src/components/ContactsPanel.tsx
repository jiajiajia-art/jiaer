import { useMemo } from "react";
import type { AttrDef } from "../lib/types";
import type { CreationPath, StatsSlot } from "../game/data";
import { valueSources, srcValue } from "../game/valueSources";
import { CONTACT_ICONS, CONTACT_ICON_LABEL, contactsCfg, normalizeContactsSlot, type ContactMetric, type ContactsSlot, type ContactSrc, type ContactStage } from "../game/contacts";
import ContactIcon from "./ContactIcon";

const inp = "min-w-0 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-jade hover:text-jade disabled:opacity-40";
const uid = () => `stage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
const move = <T,>(xs: T[], from: number, to: number) => {
  if (to < 0 || to >= xs.length) return xs;
  const out = [...xs], [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
};

/**
 * 功能注释：紧凑关系档位 / 卡片数值编辑器，嵌在「人物」列表上方统一配一次。
 * 不做独立大页预览；数值条数由创作者自增，可隐藏，禁止写死两项槽位文案。
 */
export default function ContactsPanel({ value, onChange, statsValue, attrsValue, pathsValue }: {
  value?: ContactsSlot; onChange: (value?: ContactsSlot) => void;
  statsValue?: StatsSlot; attrsValue?: AttrDef[]; pathsValue?: CreationPath[];
}) {
  const worldDefault = useMemo(() => contactsCfg(), []);
  const cfg = normalizeContactsSlot(value, worldDefault);
  const stages = cfg.stages, metrics = cfg.metrics;
  const save = (nextStages = stages, nextMetrics = metrics) => onChange({
    stages: nextStages.map(({ groups: _groups, ...stage }) => { void _groups; return stage; }),
    metrics: nextMetrics,
  });
  const setStage = (i: number, patch: Partial<ContactStage>) =>
    save(stages.map((stage, j) => j === i ? { ...stage, ...patch, groups: undefined } : stage));
  const setMetric = (i: number, patch: Partial<ContactMetric> | null) => {
    if (patch === null) return save(stages, metrics.filter((_, j) => j !== i));
    save(stages, metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  };

  const pool = valueSources({ stats: statsValue, attrs: attrsValue, paths: pathsValue });
  const poolGroups = [...new Set(pool.map((source) => source.group))];
  const sourceKey = (source?: ContactSrc) => !source ? "" : source.kind === "rel" ? "rel" : srcValue(source);
  const parseSource = (key: string): ContactSrc | undefined => {
    if (key === "rel") return { kind: "rel" };
    const source = pool.find((item) => srcValue(item) === key);
    return source ? { kind: source.kind, key: source.key, label: source.label } : undefined;
  };
  const metricLabel = (m: ContactMetric) => (m.src.kind === "rel" ? "关系值" : m.src.label);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper-2/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div>
          <p className="text-[12.5px] font-bold text-ink">关系档位与卡片数值</p>
          <p className="text-[10.5px] text-ink-soft">统一配一次；档位只按关系值分段显示人物列表</p>
        </div>
        <button type="button" className={btn} onClick={() => onChange(undefined)}>恢复默认</button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-ink-soft">关系档位</p>
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper px-2 py-1.5">
            <input aria-label={`阶段 ${i + 1} 名称`} className={`${inp} w-24 font-bold`} value={stage.label} placeholder="阶段词" onChange={(e) => setStage(i, { label: e.target.value })} />
            <span className="text-[11px] text-ink-soft">≥</span>
            <input aria-label={`${stage.label}阈值`} className={`${inp} w-16`} type="number" value={stage.min} onChange={(e) => setStage(i, { min: Number(e.target.value) || 0 })} />
            <span className="ml-auto flex gap-1">
              <button type="button" className={btn} disabled={!i} onClick={() => save(move(stages, i, i - 1))} aria-label="上移">↑</button>
              <button type="button" className={btn} disabled={i === stages.length - 1} onClick={() => save(move(stages, i, i + 1))} aria-label="下移">↓</button>
              <button type="button" className={btn} disabled={stages.length <= 1} onClick={() => save(stages.filter((_, j) => j !== i))} aria-label="删除阶段">×</button>
            </span>
          </div>
        ))}
        <button type="button" className={btn} onClick={() => save([...stages, { id: uid(), label: "新阶段", min: 0, tone: "jade" }])}>＋ 添加档位</button>
      </div>

      <div className="space-y-1.5 border-t border-line/70 pt-2.5">
        <p className="text-[11px] font-semibold text-ink-soft">卡片数值 <span className="font-normal">· 加几个显示几个，可隐藏</span></p>
        {metrics.map((metric, i) => (
          <div key={i} className={`space-y-1.5 rounded-lg border border-line bg-paper px-2 py-1.5 ${metric.hidden ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label={`卡片数值来源 ${i + 1}`}
                className={`${inp} min-w-[7rem] flex-1`}
                value={sourceKey(metric.src)}
                onChange={(e) => {
                  const source = parseSource(e.target.value);
                  if (source) setMetric(i, { src: source });
                }}
              >
                <option value="rel">关系值</option>
                {poolGroups.map((group) => (
                  <optgroup key={group} label={group}>
                    {pool.filter((source) => source.group === group).map((source) => (
                      <option key={srcValue(source)} value={srcValue(source)}>{source.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="truncate text-[11px] text-ink-soft">{metricLabel(metric)}</span>
              <label className="flex cursor-pointer items-center gap-1 text-[11.5px] text-ink-soft">
                <input type="checkbox" className="accent-jade" checked={!!metric.hidden} onChange={(e) => setMetric(i, { hidden: e.target.checked || undefined })} />
                隐藏
              </label>
              <button type="button" className={btn} onClick={() => setMetric(i, null)} aria-label={`删除 ${metricLabel(metric)}`}>×</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {CONTACT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  title={CONTACT_ICON_LABEL[icon]}
                  aria-pressed={metric.icon === icon}
                  onClick={() => setMetric(i, { icon })}
                  className={`grid h-7 w-7 place-items-center rounded-full border ${metric.icon === icon ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}
                >
                  <ContactIcon kind={icon} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className={btn}
          onClick={() => save(stages, [...metrics, { src: { kind: "rel" }, icon: "dot", tone: "jade" }])}
        >
          ＋ 添加数值
        </button>
      </div>
    </div>
  );
}
