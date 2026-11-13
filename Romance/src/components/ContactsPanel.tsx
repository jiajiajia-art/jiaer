import type { ContactsSlot, ContactStage } from "../game/contacts";
import { contactsCfg, normalizeContactsSlot } from "../game/contacts";

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
 * 功能注释：紧凑关系档位编辑器，全作品共用，放在「人物」卡片列表之后单独成块。
 * 创作者只配档位；旧 metrics 字段保存时写空，界面不再提供数值条配置。
 */
export default function ContactsPanel({ value, onChange }: {
  value?: ContactsSlot; onChange: (value?: ContactsSlot) => void;
}) {
  const worldDefault = contactsCfg();
  const cfg = normalizeContactsSlot(value, worldDefault);
  const stages = cfg.stages;
  // 功能注释：只持久化档位；metrics 强制空数组，避免旧草稿把数值条写回
  const save = (nextStages = stages) => onChange({
    stages: nextStages.map(({ groups: _groups, ...stage }) => { void _groups; return stage; }),
    metrics: [],
  });
  const setStage = (i: number, patch: Partial<ContactStage>) =>
    save(stages.map((stage, j) => j === i ? { ...stage, ...patch, groups: undefined } : stage));

  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper-2/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div>
          <p className="text-[12.5px] font-bold text-ink">关系档位 · 全作品共用</p>
          <p className="text-[10.5px] text-ink-soft">对本作品所有人物生效，不属于某一个人；按关系值把人脉列表分段</p>
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
    </div>
  );
}
