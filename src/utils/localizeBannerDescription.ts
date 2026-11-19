/**
 * 功能注释：历史轮播/剧本简介常带英文 Theme:/Summary: 前缀，展示时按语言替换，避免中文界面夹英文标签。
 */
export function localizeBannerDescription(
    raw: string | null | undefined,
    labels: { theme: string; summary: string },
): string {
    const text = String(raw || '').trim();
    if (!text) return '';

    return text
        .replace(/\bTheme\s*[:：]/gi, `${labels.theme}：`)
        .replace(/\bSummary\s*[:：]/gi, `${labels.summary}：`);
}
