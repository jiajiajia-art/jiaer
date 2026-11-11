import type { TermKey, Terminology } from "../mods/types";
import { termFallback } from "../mods/live";

/**
 * 功能注释：玩法叫法——让同一个玩法包在不同题材里复用。
 * 写进 content.terms，局内所有用 liveTerm 的地方（通告板、榜单、合约、周报、AI 提示）都会跟着变；
 * 留空 = 用默认叫法（娱乐圈底座用原版叫法，其他题材用通用叫法）。
 */
const ROWS: { k: TermKey; label: string; where: string; ent: string; example: string }[] = [
  { k: "gig", label: "工作单", where: "通告板 · 日程 · 违约", ent: "通告", example: "委托 / 任务 / 订单" },
  { k: "fee", label: "报酬", where: "通告酬劳 · 谈判", ent: "片酬", example: "赏金 / 佣金" },
  { k: "company", label: "机构", where: "行业榜 · 合约甲方", ent: "经纪公司", example: "门派 / 公会 / 公司" },
  { k: "member", label: "成员", where: "旗下名单 · 人气榜", ent: "艺人", example: "弟子 / 冒险者 / 员工" },
  { k: "contract", label: "合约", where: "签约文书标题", ent: "经纪合约", example: "入门契约 / 劳动合同" },
  { k: "fame", label: "名气", where: "门槛 · 奖励 · 榜单", ent: "名气", example: "声望 / 江湖地位" },
  { k: "fans", label: "关注者", where: "形象页 · 舆情", ent: "粉丝", example: "追随者 / 信众" },
  { k: "reputation", label: "口碑", where: "舆情 · 结算", ent: "口碑", example: "风评 / 名声" },
  { k: "industry", label: "行业名", where: "行业页 · AI 角色设定", ent: "娱乐圈", example: "江湖 / 商界" },
  { k: "works", label: "成果", where: "履历 · 统计", ent: "作品", example: "战绩 / 业绩" },
];

const inp = "w-full min-w-0 rounded-xl border border-line bg-paper-2 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/55 transition focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20";

export default function PlayTermsEditor({ value, entBase, onChange }: {
  value?: Terminology;
  entBase: boolean;
  onChange: (next: Terminology | undefined) => void;
}) {
  const set = (k: TermKey, v: string) => {
    const next: Terminology = { ...(value ?? {}) };
    if (v.trim()) next[k] = v; else delete next[k];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] leading-relaxed text-ink-soft">
        同一个玩法可以用在任何题材：把这些叫法改成你的世界里的说法，游戏里所有相关界面和 AI 对话都会跟着变。留空就用默认叫法（灰字）。
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ROWS.map((r) => (
          <label key={r.k} className="block rounded-xl border border-line bg-paper px-3 py-2">
            <span className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-bold text-ink">{r.label}</span>
              <span className="truncate text-[10.5px] text-ink-soft">{r.where}</span>
            </span>
            <input
              className={inp}
              value={String(value?.[r.k] ?? "")}
              placeholder={`${entBase ? r.ent : termFallback(r.k)}　如：${r.example}`}
              onChange={(e) => set(r.k, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
