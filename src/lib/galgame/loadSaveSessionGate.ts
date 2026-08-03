/**
 * 加载存档进 Galgame 前写入 store 的字段校验。
 * clearAll 后若只写 sessionId、漏写 fileId，页面会永久停在「正在获取数据」。
 */
export function shouldEnterGalgameAfterLoadSave(input: {
  fileId?: string | null;
  sessionId?: string | null;
}): boolean {
  return Boolean(String(input.fileId || '').trim() && String(input.sessionId || '').trim());
}

/** 规范化加载存档成功后应写入 gameStore 的一对 ID。 */
export function buildLoadedSaveStorePatch(input: {
  fileId: string;
  sessionId: string;
}): { fileId: string; sessionId: string } | null {
  const fileId = String(input.fileId || '').trim();
  const sessionId = String(input.sessionId || '').trim();
  if (!fileId || !sessionId) return null;
  return { fileId, sessionId };
}
