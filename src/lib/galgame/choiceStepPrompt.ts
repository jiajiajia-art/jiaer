/**
 * 功能注释：拼装选项步画布引导文案。
 * 部分 Aliyun 流式结果只把旁白写在 content/text，description 为空；需回退避免只剩按钮。
 */
export function resolveChoiceStepPromptMessage(input: {
  title?: unknown;
  description?: unknown;
  content?: unknown;
  text?: unknown;
  message?: unknown;
  fallback?: string;
}): string {
  const title = String(input.title ?? '').trim();
  const description = String(input.description ?? '').trim();
  const stepText = String(input.content ?? input.text ?? input.message ?? '').trim();
  const choiceBody = description || stepText;
  const fallback = String(input.fallback ?? '请选择你的行动').trim() || '请选择你的行动';
  if (title) {
    return choiceBody ? `${title}\n${choiceBody}` : title;
  }
  return choiceBody || fallback;
}
