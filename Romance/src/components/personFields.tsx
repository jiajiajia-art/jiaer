/* 人物档案·统一字段块——「人脉」与「艺人」两处详情共用同一套字段，
 * 保证每个人展示的属性集合一致（缺省一律显示占位，不会这人有那人没有）。
 * 纯展示、确定性，不调用 AI。 */
import { useState } from "react";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { looksTier, npcLooksFromStats } from "../game/logic";
import { BlockBar, Chip, Modal } from "./ui";
import type { Credit, FamilyRef } from "../worlds/star2005/content";

const UNKNOWN = "尚未得知";

/* 八维能力：有数值则画条，缺省整齐地显示「尚未得知」——字段永远齐全 */
export function StatBars({ stats }: { stats?: Record<string, number> | null }) {
  const looks = stats ? npcLooksFromStats(stats) : undefined;
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
      {/* 容貌：由已知八维派生的统一数值（所有人物档案均含此栏） */}
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="w-14 shrink-0 text-ink">容貌</span>
        {looks === undefined ? (
          <span className="flex-1 text-[12px] text-ink-soft/70">{UNKNOWN}</span>
        ) : (
          <>
            <BlockBar value={looks} max={999} />
            <span className="w-9 shrink-0 text-right font-medium tabular-nums text-ink">{looks}</span>
          </>
        )}
      </div>
      {STAT_ORDER.map((k) => {
        const v = stats?.[k];
        return (
          <div key={k} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-14 shrink-0 text-ink">{STAT_LABELS[k]}</span>
            {v === undefined ? (
              <span className="flex-1 text-[12px] text-ink-soft/70">{UNKNOWN}</span>
            ) : (
              <>
                <BlockBar value={v} max={999} />
                <span className="w-9 shrink-0 text-right font-medium tabular-nums text-ink">{v}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* 亲属/主演引用：命中花名册者可点击跳转，否则纯文本（附备注） */
function RefName({ r, onOpenPerson }: { r: FamilyRef; onOpenPerson?: (id: string) => void }) {
  const label = r.note ? `${r.name}（${r.note}）` : r.name;
  if (r.id && onOpenPerson)
    return (
      <button onClick={() => onOpenPerson(r.id!)} className="text-jade underline decoration-dotted underline-offset-2 transition hover:text-coral">
        {label} ↗
      </button>
    );
  return <span className="text-ink">{label}</span>;
}

/* 作品详情弹窗：角色分工 + 剧情 + 主演联动（确定性静态数据，不调用 AI） */
export function WorkModal({ credit, onOpenPerson, onClose }: { credit: Credit; onOpenPerson?: (id: string) => void; onClose: () => void }) {
  const c = credit;
  return (
    <Modal title={`《${c.title}》`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone="jade">{c.role}</Chip>
        {c.genre && <Chip>{c.genre}</Chip>}
        {c.year && <Chip tone="gold">{c.year} 年</Chip>}
      </div>
      {c.synopsis && (
        <>
          <p className="mb-1.5 text-[12px] font-bold tracking-[0.2em] text-jade">▌剧情</p>
          <p className="story-prose mb-4 text-[13.5px] leading-relaxed text-ink/90">{c.synopsis}</p>
        </>
      )}
      {(c.lead || (c.costars?.length ?? 0) > 0) && (
        <>
          <p className="mb-1.5 text-[12px] font-bold tracking-[0.2em] text-jade">▌主演</p>
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            {c.lead && <RefName r={c.lead} onOpenPerson={onOpenPerson} />}
            {c.costars?.map((r, i) => <RefName key={i} r={r} onOpenPerson={onOpenPerson} />)}
          </div>
        </>
      )}
      {c.note && <p className="text-[12px] italic text-ink-soft">{c.note}</p>}
    </Modal>
  );
}

/* 详版代表作：可点击的作品条，点开看剧情/主演；区分执导与主演由内容池 role 决定 */
export function CreditsList({ credits, onOpenPerson }: { credits: Credit[]; onOpenPerson?: (id: string) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  if (!credits.length) return <span className="text-[13px] text-ink-soft/70">暂无</span>;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {credits.map((c, i) => (
          <button
            key={i}
            onClick={() => setSel(i)}
            className="rounded-sm border border-dashed border-coral/50 px-2.5 py-1 text-[12.5px] text-coral transition hover:bg-coral/10"
          >
            《{c.title}》<span className="ml-1 text-[10px] text-ink-soft">{c.role}</span>
          </button>
        ))}
      </div>
      {sel !== null && <WorkModal credit={credits[sel]} onOpenPerson={onOpenPerson} onClose={() => setSel(null)} />}
    </>
  );
}

/* 代表作：去重后铺开；无则「暂无」 */
export function WorksChips({ works }: { works: string[] }) {
  const uniq = [...new Set(works)];
  return (
    <div className="flex flex-wrap gap-2">
      {uniq.length ? (
        uniq.map((t) => (
          <Chip key={t} tone="coral">
            《{t}》
          </Chip>
        ))
      ) : (
        <span className="text-[13px] text-ink-soft/70">暂无</span>
      )}
    </div>
  );
}
