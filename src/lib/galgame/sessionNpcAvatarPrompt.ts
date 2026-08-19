/**
 * 与后端 services/visual/sessionAvatarPromptParts.js 对齐。
 * 用于确认弹窗风格选项；真正生图以后端拼接为准。
 */

export const AVATAR_STYLE_IDS = ['A', 'B', 'C', 'D'] as const;
export type AvatarStyleId = (typeof AVATAR_STYLE_IDS)[number];
export const DEFAULT_AVATAR_STYLE: AvatarStyleId = 'A';

/** 固定构图（用户不可改；与后端 AVATAR_FIXED_PROMPT 同文） */
export const AVATAR_FIXED_PROMPT = [
  'Create a single full-body character sprite for a game.',
  'The image must show one solo character only, fully visible from head to shoes. The character is standing in a natural neutral pose, centered in the frame, facing forward or slight 3/4 view. The face must be clearly visible. The whole body must be uncropped, including head, hands, legs, and feet.',
  'Use a vertical character-sheet composition, suitable for use as an in-game character standing portrait. The character should occupy most of the canvas height with small margins around the body.',
  'Plain clean background only, suitable for cutout. No scene illustration, no room, no landscape, no furniture, no props in the background.',
].join(' ');

export const AVATAR_STYLE_OPTIONS: ReadonlyArray<{
  id: AvatarStyleId;
  label: string;
  prompt: string;
}> = [
  {
    id: 'A',
    label: '日系视觉小说风格',
    prompt:
      'Style: polished Japanese anime visual novel character art, clean elegant linework, soft cel shading, refined facial features, detailed but readable outfit design, high-quality game character sprite.',
  },
  {
    id: 'B',
    label: '乙女向',
    prompt:
      'Style: elegant otome game character art, delicate facial features, graceful silhouette, refined hair rendering, beautiful expressive eyes, soft romantic lighting, polished anime shading, premium visual novel sprite quality.',
  },
  {
    id: 'C',
    label: '暗黑风格',
    prompt:
      'Style: dark fantasy visual novel character art, refined anime linework, muted color palette, subtle dramatic shadows, elegant gothic mood, detailed clothing textures, mysterious but readable character design.',
  },
  {
    id: 'D',
    label: '古风水彩风格',
    prompt:
      'Style: hand-painted ancient Chinese watercolor character sprite, with an elegant East Asian classical aesthetic and delicate paper watercolor texture. The linework should be soft but clear. The colors should be pale, refined, and translucent. Ink tones and watercolor washes should blend naturally. The clothing should have layered ancient Chinese styling, flowing fabric, and graceful details. The overall mood should be warm, elegant, restrained, and poetic, like a refined guofeng otome game or ancient Chinese visual novel character design. The character silhouette must remain clear, the facial features must be readable, and the outfit details must stay visible. Do not turn the image into a blurry landscape painting, pure ink-wash background art, or scenery-focused illustration.',
  },
];

export const AVATAR_GENDER_LOCK_PROMPT =
  "The gender must strictly remain as specified above. Do not change or reinterpret the character's gender based on the name, relationship, occupation, persona, personality, or art style.";

export const AVATAR_HARD_REQUIREMENTS_PROMPT =
  '硬性要求：必须是正确性别；只能有一个角色；必须是全身立绘；必须从头到脚完整可见；角色站立；身体不能被裁切；脸部清晰；构图居中；背景干净简洁；适合游戏角色立绘使用；不要文字；不要 logo；不要水印；不要签名；不要任何可读文字。';

export const AVATAR_NEGATIVE_PROMPT =
  'Negative prompt: cropped body, cropped head, cropped feet, cut off legs, cut off hands, close-up, bust portrait, headshot, half body, upper body only, sitting, lying down, dynamic action pose, extreme perspective, multiple characters, extra people, duplicate character, chibi, childlike body unless specified, old person unless specified, gender swap, wrong gender, inaccurate anatomy, deformed hands, extra fingers, missing fingers, extra limbs, bad feet, distorted face, blurry, low quality, messy lines, text, logo, watermark, signature, speech bubble, subtitles, UI, frame, border, background scene, room interior, landscape, dark background, black background, gradient background, furniture, large props';

export type SessionNpcAvatarPromptProfile = {
  name?: string | null;
  gender?: string | null;
  relationship?: string | null;
  summary?: string | null;
  attitudeToPlayer?: string | null;
  detailedBio?: string | null;
};

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeAvatarStyleId(raw: unknown): AvatarStyleId {
  const id = String(raw || '').trim().toUpperCase();
  if ((AVATAR_STYLE_IDS as readonly string[]).includes(id)) {
    return id as AvatarStyleId;
  }
  return DEFAULT_AVATAR_STYLE;
}

function genderLabel(gender: unknown): string {
  const g = trimStr(gender);
  if (g === 'male') return 'male';
  if (g === 'female') return 'female';
  if (g === 'other') return 'non-binary presenting';
  return 'androgynous or unspecified gender';
}

/** 功能注释：拼局内头像完整提示词（固定+风格+动态人设外貌+禁止词）。 */
export function buildSessionNpcAvatarPrompt(
  profile: SessionNpcAvatarPromptProfile | null | undefined,
  options?: { supplement?: string | null; styleId?: string | null },
): string {
  const name = trimStr(profile?.name) || 'character';
  const gender = genderLabel(profile?.gender);
  const relationship = trimStr(profile?.relationship);
  const appearance = trimStr(profile?.summary).slice(0, 400);
  const styleId = normalizeAvatarStyleId(options?.styleId);
  const styleBlock =
    AVATAR_STYLE_OPTIONS.find((item) => item.id === styleId)?.prompt
    || AVATAR_STYLE_OPTIONS[0].prompt;
  const supplement = trimStr(options?.supplement).slice(0, 500);

  const identityLines = [
    'Character identity:',
    `Name: ${name}`,
    `Gender: ${gender}`,
  ];
  if (relationship) identityLines.push(`Relationship to player: ${relationship}`);
  if (appearance) identityLines.push(`Appearance and role: ${appearance}`);

  const parts = [
    AVATAR_FIXED_PROMPT,
    styleBlock,
    identityLines.join('\n'),
    AVATAR_GENDER_LOCK_PROMPT,
    'The character appearance, clothing, hairstyle, age, and body type must match the Appearance and role description. Do not invent a conflicting look.',
  ];
  if (supplement) {
    parts.push(`User appearance notes (override conflicting details): ${supplement}.`);
  }
  parts.push(AVATAR_HARD_REQUIREMENTS_PROMPT);
  parts.push(AVATAR_NEGATIVE_PROMPT);
  return parts.filter(Boolean).join('\n\n');
}

/**
 * 功能注释：局内「我的档案」主角头像；人设映射为 Appearance and role。
 */
export function buildPlayerArchiveAvatarBasePrompt(input: {
  name?: string | null;
  gender?: string | null;
  persona?: string | null;
  styleId?: string | null;
  supplement?: string | null;
}): string {
  const persona = trimStr(input?.persona);
  return buildSessionNpcAvatarPrompt(
    {
      name: input?.name,
      gender: input?.gender,
      relationship: '主角',
      summary: persona.slice(0, 400) || '本局主角',
    },
    {
      styleId: input?.styleId,
      supplement: input?.supplement,
    },
  );
}
