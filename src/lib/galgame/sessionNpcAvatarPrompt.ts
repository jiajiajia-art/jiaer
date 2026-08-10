/**
 * 与后端 services/visual/sessionNpcAvatar.js 的 buildSessionNpcAvatarPrompt 对齐。
 * 用于确认弹窗预览；真正生图仍以后端拼接为准。
 */

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

function genderLabel(gender: unknown): string {
  const g = trimStr(gender);
  if (g === 'male') return 'male';
  if (g === 'female') return 'female';
  if (g === 'other') return 'non-binary presenting';
  return 'androgynous or unspecified gender';
}

/** 功能注释：拼局内 NPC 头像基础提示词（不含用户补充）。 */
export function buildSessionNpcAvatarPrompt(
  profile: SessionNpcAvatarPromptProfile | null | undefined,
  options?: { supplement?: string | null },
): string {
  const name = trimStr(profile?.name) || 'character';
  const relationship = trimStr(profile?.relationship);
  const summary = trimStr(profile?.summary);
  const attitude = trimStr(profile?.attitudeToPlayer);
  const bio = trimStr(profile?.detailedBio);
  const parts = [
    `Visual novel character portrait of ${name}, ${genderLabel(profile?.gender)}.`,
    relationship ? `Relationship to player: ${relationship}.` : '',
    summary ? `Appearance and role: ${summary}.` : '',
    attitude ? `Attitude vibe: ${attitude}.` : '',
    bio ? `Extra persona: ${bio.slice(0, 280)}.` : '',
    'Full-body vertical portrait, standing pose, character centered with ample empty margin on left and right sides, face clearly visible, soft lighting, clean white background for easy cutout, detailed character design, high quality anime visual novel style. DO NOT INCLUDE ANY TEXT IN THE IMAGE.',
  ];
  const supplement = trimStr(options?.supplement).slice(0, 500);
  if (supplement) {
    parts.push(`User style notes: ${supplement}.`);
  }
  return parts.filter(Boolean).join(' ');
}
