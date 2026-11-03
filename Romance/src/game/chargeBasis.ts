/**
 * 功能注释：扣费依据条目与过滤。创作者自填；未勾选 / 空名不得进入说明。
 * 独立小模块，避免单测拉整份 data.ts（通告库等重依赖）。
 */
export type ChargeBasisItem = {
  id: string;
  label: string;
  /** active = 主动消费（余额不足拒绝）；passive = 被动扣费（可透支） */
  mode: "active" | "passive";
  /** 缺省 true；false = 本作品没有这项 */
  on?: boolean;
};

export function enabledChargeItems(items?: ChargeBasisItem[] | null): ChargeBasisItem[] {
  return (items ?? []).filter((x) => x.on !== false && String(x.label ?? "").trim().length > 0);
}
