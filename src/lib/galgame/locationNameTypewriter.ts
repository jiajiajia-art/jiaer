/**
 * 顶栏地点名 CSS 打字机：按字数生成 steps / 时长，切换时靠 remount 重播。
 */

/** 按码点计字数（中文/emoji 比 String.length 更稳）。 */
export function countLocationTypewriterSteps(name: string): number {
  const text = String(name || '').trim();
  if (!text) return 0;
  return Array.from(text).length;
}

/**
 * 生成 CSS 自定义属性：--location-type-steps、--location-type-ms。
 * 空地名不播动画。
 */
export function buildLocationNameTypewriterVars(name: string): {
  steps: number;
  durationMs: number;
} | null {
  const steps = countLocationTypewriterSteps(name);
  if (steps <= 0) return null;
  // 约 42ms/字，夹在 0.45s～2s，避免极短闪一下或极长拖沓
  const durationMs = Math.min(2000, Math.max(450, steps * 42));
  return { steps, durationMs };
}
