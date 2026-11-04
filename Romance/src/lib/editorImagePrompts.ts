/**
 * 功能注释：编辑器四处「生图」共用提示词拼装。
 * 只拼当前项已有文字，不另起网关；实际请求仍走 platformImageGen → generateImage。
 */

function clip(s: unknown, max = 280): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function joinParts(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join("。");
}

/** 功能注释：人物卡头像——姓名 / 性别 / 年龄 / 简介(关系或身份) / 小传 */
export function buildNpcAvatarPrompt(n: {
  name?: string;
  gender?: string;
  age?: number | string;
  /** 简介：优先用 relation，空则回落身份 role */
  summary?: string;
  role?: string;
  relation?: string;
  bio?: string;
}): string {
  const name = clip(n.name, 40);
  const gender = clip(n.gender, 8);
  const ageRaw = n.age;
  const age =
    ageRaw === undefined || ageRaw === null || ageRaw === ""
      ? ""
      : `约${String(ageRaw).trim()}岁`;
  const summary = clip(n.summary || n.relation || n.role, 120);
  const bio = clip(n.bio, 320);
  const who = joinParts([
    name ? `角色名「${name}」` : "",
    gender,
    age,
    summary ? `简介：${summary}` : "",
    bio ? `小传：${bio}` : "",
  ]);
  if (!who) return "";
  return `${who}。半身或胸像头像，面部清晰，适合角色卡，竖构图或方构图，不要文字、不要水印、不要 UI 边框。`;
}

/** 功能注释：大地图——名称 + 简介 */
export function buildWorldMapPrompt(m: { name?: string; desc?: string }): string {
  const name = clip(m.name, 60);
  const desc = clip(m.desc, 240);
  const body = joinParts([
    name ? `地图名「${name}」` : "",
    desc ? `简介：${desc}` : "",
  ]);
  if (!body) return "";
  return `${body}。俯视或斜俯视角的游戏大地图插画，地点可辨，氛围统一，不要文字、不要水印、不要 UI。`;
}

/** 功能注释：地点场景——地点名 + 场景描述；竖图 9:16 */
export function buildLocationScenePrompt(r: { name?: string; desc?: string }): string {
  const name = clip(r.name, 60);
  const desc = clip(r.desc, 360);
  const body = joinParts([
    name ? `地点「${name}」` : "",
    desc ? `场景：${desc}` : "",
  ]);
  if (!body) return "";
  return `${body}。竖屏 9:16 场景背景插画，可作游戏地点背景，不要文字、不要水印、不要 UI。`;
}

/** 功能注释：作品封面——作品名 + 简介；竖屏封面 */
export function buildWorkCoverPrompt(w: { title?: string; summary?: string }): string {
  const title = clip(w.title, 60);
  const summary = clip(w.summary, 280);
  const body = joinParts([
    title ? `作品名「${title}」` : "",
    summary ? `简介：${summary}` : "",
  ]);
  if (!body) return "";
  return `${body}。竖屏 9:16 游戏封面插画，有氛围与主体，画面里不要文字、不要水印、不要 UI。`;
}
