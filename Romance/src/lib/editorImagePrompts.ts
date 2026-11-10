/**
 * 功能注释：编辑器四处「生图」共用提示词拼装（三层：画风 / 主体 / 负面词，仿 SillyTavern）。
 * - style：整部作品只有一个画风；只来自创作者填写或本作品推断；禁止常驻「二次元写实漫」。
 * - subject：只写「这一张」的主体（人物外观 / 地点空间 / 地图地点 / 封面氛围+主角外观），不混关系与剧情。
 * - negative：作品级负面词 + 世界生成禁止清单 forbidGen，单独字段，不塞进正向提示词。
 * 实际请求仍走 platformImageGen（平台 ggb / 个人兜底）；不另起网关。
 */
import { SCENE_PORTRAIT_GEN_SIZE } from "./scenePortrait.ts";

export type EditorImagePromptParts = {
  /** 作品画风（整部统一）；可空 */
  style: string;
  /** 这一张的主体描述 */
  subject: string;
  /** 负面词（不想出现的内容） */
  negative: string;
};

/**
 * 功能注释：历史常量保留导出供旧引用识别，但 resolveArtStyle 不再回落此句。
 * 禁止在预填 / 兜底里常驻「二次元写实漫」。
 */
export const DEFAULT_ART_STYLE = "";

/** 功能注释：画风输入框占位；选填，留空则按主体与设定生成 */
export const ART_STYLE_PLACEHOLDER = "选填：可写画风；留空则按主体与设定生成";

/** 功能注释：人物头像为方图；地点 / 大地图 / 封面为 9:16 竖图——请求 size 与提示词构图一致 */
export const NPC_AVATAR_GEN_SIZE = "1024x1024";
export const LOCATION_SCENE_GEN_SIZE = SCENE_PORTRAIT_GEN_SIZE;
export const WORLD_MAP_GEN_SIZE = SCENE_PORTRAIT_GEN_SIZE;
export const WORK_COVER_GEN_SIZE = SCENE_PORTRAIT_GEN_SIZE;

/** 功能注释：各类图的构图收尾句；与上面的请求尺寸一一对应 */
const FRAMING_AVATAR = "方形 1:1 构图，半身或胸像，面部清晰";
const FRAMING_SCENE = "竖屏 9:16 构图，场景背景插画";
const FRAMING_MAP = "竖屏 9:16 竖向区域图，地点可辨";
const FRAMING_COVER = "竖屏 9:16 构图，游戏封面插画，有氛围与主体";

/** 功能注释：各类图固有的负面基线（原先写在正向里的「不要文字/水印/UI」挪到这里） */
const BASE_NEGATIVE_AVATAR = "文字，水印，UI 边框，多余肢体，畸形手指";
const BASE_NEGATIVE_SCENE = "文字，水印，UI，人物特写";
const BASE_NEGATIVE_MAP = "文字，水印，UI，人物特写";
const BASE_NEGATIVE_COVER = "标题文字，任何文字，水印，UI";

function clip(s: unknown, max = 280): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function joinParts(parts: string[], sep = "，"): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(sep);
}

/**
 * 功能注释：画风——创作者填了就用；也可传 inferredFromSetting 一句短描述。
 * 都没有则留空，禁止偷偷塞平台默认二次元句。
 */
export function resolveArtStyle(workStyle?: string, inferredFromSetting?: string): string {
  const t = clip(workStyle, 80);
  if (t) return t;
  return clip(inferredFromSetting, 80);
}

/** 功能注释：负面词去重合并（作品级 + 禁止生成清单 + 本类图基线），保持顺序 */
export function mergeNegativePrompt(...chunks: Array<string | undefined | null>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    for (const piece of String(chunk ?? "").split(/[，,、；;\n]+/)) {
      const t = piece.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out.join("，");
}

/** 功能注释：作品级生图设置（落在 mod.content.imageGen；画风 + 负面词，整部统一） */
export type WorkImageStyleSettings = {
  /** 创作者自定画风；留空走默认 */
  workStyle?: string;
  /** 作品级负面词 */
  workNegative?: string;
  /** 世界生成的「禁止生成清单」；并入负面词，不进正向 */
  forbidGen?: string;
};

function makeParts(
  settings: WorkImageStyleSettings,
  subject: string,
  baseNegative: string,
): EditorImagePromptParts {
  return {
    style: resolveArtStyle(settings.workStyle),
    subject,
    negative: mergeNegativePrompt(settings.workNegative, settings.forbidGen, baseNegative),
  };
}

/** 功能注释：由年龄推「年龄感」措辞，供外观脚手架使用 */
function ageFeel(age: number): string {
  if (age < 13) return "孩童";
  if (age < 18) return "少年少女感";
  if (age < 30) return "青年";
  if (age < 45) return "壮年";
  if (age < 60) return "中年";
  return "年长";
}

/**
 * 功能注释：人物缺外观描述时，用性别+年龄给创作者一段可改的脚手架；
 * 性别/年龄都没有则返回空串（不乱编）。
 */
export function scaffoldNpcAppearance(n: { gender?: string; age?: number | string }): string {
  const gender = clip(n.gender, 8);
  const ageNum = Number(String(n.age ?? "").trim());
  const hasAge = String(n.age ?? "").trim() !== "" && Number.isFinite(ageNum) && ageNum > 0;
  if (!gender && !hasAge) return "";
  const head = joinParts([gender, hasAge ? `约${Math.round(ageNum)}岁（${ageFeel(ageNum)}）` : ""]);
  return `${head}；发型发色：；脸型五官气质：；衣着配饰：`;
}

/**
 * 功能注释：人物头像三层——
 * 主体只用外观（appearancePrompt 或由性别年龄搭的脚手架），不写关系 / 剧情 / 小传。
 */
export function buildNpcAvatarPromptParts(
  n: {
    gender?: string;
    age?: number | string;
    /** 人物外观描述（与小传 bio 分开） */
    appearancePrompt?: string;
  },
  settings: WorkImageStyleSettings = {},
): EditorImagePromptParts {
  const look = clip(n.appearancePrompt, 320) || scaffoldNpcAppearance(n);
  const subject = look ? `${look}。${FRAMING_AVATAR}` : "";
  return makeParts(settings, subject, BASE_NEGATIVE_AVATAR);
}

/**
 * 功能注释：地点场景三层——
 * 主体是「空间长什么样」（visualDesc / scenePrompt），不是进入时给玩家看的叙事 desc。
 */
export function buildLocationScenePromptParts(
  r: {
    name?: string;
    /** 地点画面描述：空间布局 / 光线 / 陈设（与玩家可见 desc 分开） */
    scenePrompt?: string;
  },
  settings: WorkImageStyleSettings = {},
): EditorImagePromptParts {
  const name = clip(r.name, 60);
  const space = clip(r.scenePrompt, 360);
  const body = joinParts([name ? `地点「${name}」` : "", space]);
  const subject = body ? `${body}。${FRAMING_SCENE}` : "";
  return makeParts(settings, subject, BASE_NEGATIVE_SCENE);
}

/** 功能注释：大地图三层——区域名 + 地点列表 + 竖向区域图；地点空时写「按设定补分区」 */
export function buildWorldMapPromptParts(
  m: { name?: string; places?: string[]; desc?: string },
  settings: WorkImageStyleSettings = {},
): EditorImagePromptParts {
  const rawName = clip(m.name, 60);
  const name = rawName && rawName !== "主地图" ? rawName : rawName || "";
  const places = (m.places ?? []).map((p) => clip(p, 20)).filter(Boolean).slice(0, 12);
  const desc = clip(m.desc, 160);
  const body = joinParts([
    name ? `区域「${name}」` : "区域图",
    places.length ? `包含地点：${places.join("、")}` : "按设定补分区",
    desc,
  ]);
  const subject = `${body}。${FRAMING_MAP}`;
  return makeParts(settings, subject, BASE_NEGATIVE_MAP);
}

/**
 * 功能注释：作品封面三层——
 * 主体 = 作品氛围（简介摘要）+ 主角外观；画面里不出现作品名（标题文字放负面词）。
 */
export function buildWorkCoverPromptParts(
  w: {
    /** 仅用于判断是否有内容；不写进画面 */
    title?: string;
    summary?: string;
    /** 主角外观（性别 / 年龄感 / 发型 / 衣着等），可空 */
    protagonistAppearance?: string;
  },
  settings: WorkImageStyleSettings = {},
): EditorImagePromptParts {
  const vibe = clip(w.summary, 280);
  const hero = clip(w.protagonistAppearance, 200);
  // 功能注释：有氛围但没填主角外观时，留一个「主角外观：」空槽给创作者补；不补则组装时自动剔除
  const body = joinParts([vibe ? `氛围：${vibe}` : "", hero ? `主角外观：${hero}` : vibe ? "主角外观：" : ""]);
  const subject = body ? `${body}。${FRAMING_COVER}` : "";
  return makeParts(settings, subject, BASE_NEGATIVE_COVER);
}

/** 功能注释：去掉脚手架里创作者没填的「标签：」空段，避免把「发型发色：」原样发给模型 */
export function stripEmptyLabels(text: string): string {
  return String(text ?? "")
    .replace(/[^\s，,；;。：:]{1,8}[：:]\s*(?=[；;，,。]|$)/g, "")
    .replace(/\s*[；;，,]\s*(?=[；;，,。])/g, "")
    .replace(/^[；;，,。\s]+|[；;，,\s]+$/g, "")
    .trim();
}

/** 功能注释：正向提示词 = 画风 + 主体（负面词单独走 negative，不并进来）；主体为空返回空串 */
export function composePositivePrompt(parts: Pick<EditorImagePromptParts, "style" | "subject">): string {
  const subject = stripEmptyLabels(parts.subject);
  if (!subject) return "";
  return joinParts([parts.style, subject], "。");
}

/** 功能注释：网关只认一条 prompt 时，把负面词以明确标注的段落并在末尾（不混进正向描述）；负面词为空不追加 */
export function appendNegativeSection(prompt: string, negative?: string): string {
  const neg = String(negative ?? "").replace(/\s+/g, " ").trim();
  const pos = String(prompt ?? "").trim();
  if (!neg) return pos;
  return `${pos}\n\n【负面词·避免出现】${neg}`;
}

// ——— 向后兼容：旧调用拿到一整段（画风 + 主体）正向字符串 ———

export function buildNpcAvatarPrompt(
  n: Parameters<typeof buildNpcAvatarPromptParts>[0],
  settings?: WorkImageStyleSettings,
): string {
  return composePositivePrompt(buildNpcAvatarPromptParts(n, settings));
}

export function buildLocationScenePrompt(
  r: Parameters<typeof buildLocationScenePromptParts>[0],
  settings?: WorkImageStyleSettings,
): string {
  return composePositivePrompt(buildLocationScenePromptParts(r, settings));
}

export function buildWorldMapPrompt(
  m: Parameters<typeof buildWorldMapPromptParts>[0],
  settings?: WorkImageStyleSettings,
): string {
  return composePositivePrompt(buildWorldMapPromptParts(m, settings));
}

export function buildWorkCoverPrompt(
  w: Parameters<typeof buildWorkCoverPromptParts>[0],
  settings?: WorkImageStyleSettings,
): string {
  return composePositivePrompt(buildWorkCoverPromptParts(w, settings));
}

// ——— 作品级画风 / 负面词的读写（落在 mod.content.imageGen） ———

/** 功能注释：外层（编辑器面板）传给各生图入口的绑定：当前作品设置 + 点「开始生成」时的保存回调 */
export type WorkImageGenBinding = {
  settings: WorkImageStyleSettings;
  onCommit?: (parts: EditorImagePromptParts) => void;
};

/** 功能注释：从 mod.content.imageGen 读出作品级设置 */
export function workImageSettingsOf(
  imageGen?: { style?: string; negative?: string } | null,
  forbidGen?: string,
): WorkImageStyleSettings {
  // 功能注释：旧稿 / AI 可能把字段写成对象，只认字符串，避免出现「[object Object]」
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    workStyle: str(imageGen?.style),
    workNegative: str(imageGen?.negative),
    forbidGen,
  };
}

const ALL_BASE_NEGATIVE = mergeNegativePrompt(
  BASE_NEGATIVE_AVATAR,
  BASE_NEGATIVE_SCENE,
  BASE_NEGATIVE_MAP,
  BASE_NEGATIVE_COVER,
);

/**
 * 功能注释：把弹窗里改过的画风 / 负面词收成可存入作品的形态：
 * 画风有内容才存；负面词剔除各类图固有基线，只存创作者自己加的。
 */
export function workImageGenFromParts(
  parts: Pick<EditorImagePromptParts, "style" | "negative">,
  forbidGen?: string,
): { style?: string; negative?: string } | undefined {
  const style = clip(parts.style, 80);
  const baseSet = new Set(
    mergeNegativePrompt(ALL_BASE_NEGATIVE, forbidGen).split("，").map((x) => x.toLowerCase()),
  );
  const extra = mergeNegativePrompt(parts.negative)
    .split("，")
    .filter((x) => x && !baseSet.has(x.toLowerCase()))
    .join("，");
  const out: { style?: string; negative?: string } = {};
  if (style) out.style = style;
  if (extra) out.negative = extra;
  return Object.keys(out).length ? out : undefined;
}
