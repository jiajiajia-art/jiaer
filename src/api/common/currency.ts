/**
 * 共享货币类型定义
 * 用于统一项目中所有涉及 'points' | 'diamonds' 的类型定义
 */

/**
 * 基础货币类型（不含 'all' 选项）
 */
export type Currency = 'points' | 'diamonds';

/**
 * 包含全部选项的货币类型（用于筛选/查询场景）
 */
export type CurrencyWithAll = 'all' | Currency;

/**
 * 货币选项（用于下拉选择等 UI 场景）
 */
export const CURRENCY_OPTIONS: readonly { value: Currency; label: string }[] = [
  { value: 'points', label: '积分' },
  { value: 'diamonds', label: '钻石' },
] as const;

/**
 * 格式化货币显示
 */
export function formatCurrency(currency: Currency): string {
  return currency === 'points' ? '积分' : '钻石';
}
