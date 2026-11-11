/**
 * 功能注释：P4.1 通讯 App 按世界题材换皮——现代「绿信」/ 古代·仙侠「传讯」。
 * 应用 id 仍可用 wechat；展示名与书信风 CSS 由皮肤决定。
 */

export type CommsSkinId = "modern" | "letter";

export type CommsBrand = {
  skin: CommsSkinId;
  /** 桌面 / 顶栏名 */
  appName: string;
  /** 「绿信号」类账号文案 */
  accountLabel: string;
  aboutTitle: string;
  safetyCenter: string;
};

const MODERN: CommsBrand = {
  skin: "modern",
  appName: "绿信",
  accountLabel: "绿信号",
  aboutTitle: "关于绿信",
  safetyCenter: "绿信安全中心",
};

const LETTER: CommsBrand = {
  skin: "letter",
  appName: "传讯",
  accountLabel: "传讯号",
  aboutTitle: "关于传讯",
  safetyCenter: "传讯安全中心",
};

/** 功能注释：题材名 / code / 显式覆盖 → 通讯皮肤；无题材不猜时代 */
export function resolveCommsSkin(input?: {
  themeLabel?: string | null;
  themeCode?: string | null;
  /** 创作者在世界设置里覆盖：modern | letter */
  override?: string | null;
}): CommsSkinId {
  const ov = String(input?.override || "").trim().toLowerCase();
  if (ov === "letter" || ov === "ancient" || ov === "传讯") return "letter";
  if (ov === "modern" || ov === "绿信") return "modern";

  const blob = `${input?.themeCode || ""} ${input?.themeLabel || ""}`.toLowerCase();
  if (!blob.trim()) return "modern";
  if (/古代|仙侠|宫斗|玄幻|武侠|ancient|xianxia|historical/.test(blob)) return "letter";
  if (/现代|都市|娱乐|当代|modern|urban/.test(blob)) return "modern";
  return "modern";
}

export function resolveCommsBrand(input?: Parameters<typeof resolveCommsSkin>[0]): CommsBrand {
  return resolveCommsSkin(input) === "letter" ? { ...LETTER } : { ...MODERN };
}

/** 功能注释：把界面串里的「绿信」按皮肤替换（关于页 / 日志等） */
export function applyCommsBrandText(text: string, brand: CommsBrand): string {
  if (brand.skin === "modern") return text;
  return String(text || "")
    .replace(/绿信安全中心/g, brand.safetyCenter)
    .replace(/关于绿信/g, brand.aboutTitle)
    .replace(/绿信号/g, brand.accountLabel)
    .replace(/绿信/g, brand.appName);
}
