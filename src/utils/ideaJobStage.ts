/**
 * 一句话 / 文档解析 job stage 展示文案（后端 stage key → i18n）
 */
export const IDEA_JOB_STAGE_KEYS = [
  'queued',
  'generating_world',
  'generating_scenes',
  'generating_npcs',
  'generating_more_prompts',
  'writing',
  'done',
] as const;

export type IdeaJobStageKey = typeof IDEA_JOB_STAGE_KEYS[number];

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const STAGE_I18N_MAP: Record<string, string> = {
  queued: 'createGame.ideaStageQueued',
  generating_world: 'createGame.ideaStageGeneratingWorld',
  generating_scenes: 'createGame.ideaStageGeneratingScenes',
  generating_npcs: 'createGame.ideaStageGeneratingNpcs',
  generating_more_prompts: 'createGame.ideaStageGeneratingMorePrompts',
  writing: 'createGame.ideaStageWriting',
  done: 'createGame.ideaStageDone',
};

/**
 * 将后端 KV stage 转为用户可见文案；未知 stage 原样返回
 */
export function formatIdeaJobStage(stage: string | undefined | null, t: TranslateFn): string {
  const raw = String(stage || '').trim();
  if (!raw) return t('createGame.statusProcessing');

  const i18nKey = STAGE_I18N_MAP[raw];
  if (i18nKey) {
    return t(i18nKey);
  }

  return raw;
}

/**
 * 是否为一句话生成 pipeline 的已知 stage
 */
export function isKnownIdeaJobStage(stage: string | undefined | null): boolean {
  const raw = String(stage || '').trim();
  return IDEA_JOB_STAGE_KEYS.includes(raw as IdeaJobStageKey);
}
