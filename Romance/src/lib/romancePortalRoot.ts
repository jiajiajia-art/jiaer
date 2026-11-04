/**
 * 功能注释：Romance 浮层统一挂载点。
 * 生成世界在 `.romance-platform` 上覆写了暗红 token；若挂到外层 `.romance-host` / body，
 * 会吃到宣纸浅色 `--paper` / 墨绿 `--jade`，出现白底绿按钮。
 *
 * 作者预览时向导壳会 `hidden` 保活草稿，但弹窗绝不能再挂进去——否则建角 Modal
 * 整页 display:none，背后进度卡又 invisible，预览看起来「什么都没有」。
 * 预览游玩区用 `[data-author-preview-shell]`（局内纸色），优先于暗红平台壳。
 */
function isUsablePortalHost(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el) return false;
  let node: HTMLElement | null = el;
  while (node) {
    if (node.hidden) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.classList.contains("hidden")) return false;
    node = node.parentElement;
  }
  return true;
}

export function romancePortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const prefer = [
    ...document.querySelectorAll<HTMLElement>("[data-author-preview-shell='1']"),
    ...document.querySelectorAll<HTMLElement>("[data-platform-ui='1']"),
    ...document.querySelectorAll<HTMLElement>(".romance-platform"),
  ];
  for (const el of prefer) {
    if (isUsablePortalHost(el)) return el;
  }
  const host = document.querySelector<HTMLElement>(".romance-host");
  if (isUsablePortalHost(host)) return host;
  return document.body;
}
