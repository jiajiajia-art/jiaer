/**
 * 功能注释：开局是否展示人物线路弹窗——只看开放路径条数，不读旧稿 pathPicker。
 */
export type PathOpenish = { open?: boolean } | null | undefined;

export function shouldShowPathPicker(paths?: PathOpenish[] | null): boolean {
  const list = Array.isArray(paths) ? paths : [];
  return list.filter((p) => p?.open).length > 1;
}
