/**
 * 功能注释：Romance 浮层统一挂载点。
 * 生成世界在 `.romance-platform` 上覆写了暗红 token；若挂到外层 `.romance-host` / body，
 * 会吃到宣纸浅色 `--paper` / 墨绿 `--jade`，出现白底绿按钮。
 */
export function romancePortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector<HTMLElement>("[data-platform-ui='1']")
    || document.querySelector<HTMLElement>(".romance-platform")
    || document.querySelector<HTMLElement>(".romance-host")
    || document.body
  );
}
