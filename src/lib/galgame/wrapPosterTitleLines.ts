/**
 * 海报标题换行：优先在标点处断行，避免末行只剩 1 个字。
 */

const BREAK_AFTER = new Set(['：', ':', '、', '，', ',', '！', '!', '？', '?', '—', '-', ' ']);

/**
 * 功能注释：按测宽结果折成最多 maxLines 行；海报标题优先在冒号等处断开。
 */
export function wrapPosterTitleLines(
  title: string,
  maxWidth: number,
  measure: (text: string) => number,
  maxLines = 2,
): string[] {
  const text = String(title || '').trim();
  if (!text) return [];
  if (measure(text) <= maxWidth) return [text];

  const chars = [...text];
  const preferBreakAt = (index: number): boolean => {
    if (index < 0 || index >= chars.length) return false;
    return BREAK_AFTER.has(chars[index]);
  };

  /** 在 [start, end) 内找尽量靠近目标宽度的断点 */
  const findBreak = (start: number, end: number, hardMax: number): number => {
    let lastFit = start + 1;
    let lastPrefer = -1;
    let chunk = '';
    for (let i = start; i < end; i += 1) {
      chunk += chars[i];
      if (measure(chunk) <= hardMax) {
        lastFit = i + 1;
        if (preferBreakAt(i)) lastPrefer = i + 1;
      } else {
        break;
      }
    }
    if (lastPrefer > start && lastPrefer < end) return lastPrefer;
    return Math.min(Math.max(lastFit, start + 1), end);
  };

  if (maxLines <= 1) {
    let one = text;
    while (one.length > 1 && measure(`${one}…`) > maxWidth) {
      one = [...one].slice(0, -1).join('');
    }
    return measure(one) <= maxWidth ? [one] : [`${one}…`];
  }

  // 两行：先按宽度切首行，再处理孤儿字
  const firstEnd = findBreak(0, chars.length, maxWidth);
  let line1 = chars.slice(0, firstEnd).join('');
  let line2 = chars.slice(firstEnd).join('');

  // 功能注释：末行只剩 1 字时，从上行挪字过来，避免「…送外 / 卖」
  if ([...line2].length === 1 && [...line1].length > 2) {
    const moved = [...line1];
    const orphan = [...line2][0];
    line2 = `${moved.pop()}${orphan}`;
    line1 = moved.join('');
  }

  // 第二行仍超宽则截断加省略
  if (measure(line2) > maxWidth) {
    let last = line2;
    const lastChars = [...last];
    while (lastChars.length > 1 && measure(`${lastChars.join('')}…`) > maxWidth) {
      lastChars.pop();
    }
    line2 = lastChars.length < [...line2].length ? `${lastChars.join('')}…` : lastChars.join('');
  }

  if (!line2) return [line1];
  return [line1, line2];
}
