/**
 * 模型配置 Hub：根据路由解析生图 / 文案轨。
 */

export type ModelConfigPane = 'image' | 'text';

/** 功能注释：/admin/text-llm → 文案轨；其余模型配置路径 → 生图轨。 */
export function resolveModelConfigPane(pathname: string): ModelConfigPane {
  return String(pathname || '').includes('/admin/text-llm') ? 'text' : 'image';
}
