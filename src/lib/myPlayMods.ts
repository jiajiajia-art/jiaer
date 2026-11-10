/**
 * 功能注释：C2.3 「我的玩法 Mod」纯逻辑——状态分组、能否继续编辑、.kkmod 文件解析。
 * 只处理创作者本人记录；运营/管理员列表不在此出现。
 */

export type MyPlayModItem = {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  version?: string;
  status: string;
  componentKind?: string;
  origin?: string;
  updatedAt?: string;
};

export type MyPlayModGroupKey = 'draft' | 'private' | 'published';

export const MY_PLAY_MOD_GROUP_LABEL: Record<MyPlayModGroupKey, string> = {
  draft: '草稿',
  private: '私有 / 审核中',
  published: '已上架',
};

/** 功能注释：后端 status → 创作者视角三组；下架/停用归入私有，便于继续修改后重新提交 */
export function groupKeyOfPlayModStatus(status: string): MyPlayModGroupKey {
  const s = String(status || '').toLowerCase();
  if (s === 'listed') return 'published';
  if (s === 'draft') return 'draft';
  return 'private';
}

export const MY_PLAY_MOD_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  private_test: '私有测试',
  pending: '审核中',
  listed: '已上架',
  delisted: '已下架',
  disabled: '已停用',
};

/** 功能注释：仅玩法类（gameplay）可回对话工坊继续编辑；手机应用走 /create/app */
export function isGameplayMod(item: Pick<MyPlayModItem, 'componentKind'>): boolean {
  return String(item.componentKind || 'gameplay') === 'gameplay';
}

/** 功能注释：过滤并分组；剔除官方来源与非玩法类，防止运营数据混入创作者页 */
export function groupMyPlayMods(items: MyPlayModItem[]): Record<MyPlayModGroupKey, MyPlayModItem[]> {
  const out: Record<MyPlayModGroupKey, MyPlayModItem[]> = { draft: [], private: [], published: [] };
  for (const item of items || []) {
    if (!item || !item.id) continue;
    if (String(item.origin || '') === 'official') continue;
    if (!isGameplayMod(item)) continue;
    out[groupKeyOfPlayModStatus(item.status)].push(item);
  }
  return out;
}

/** 功能注释：解析用户选的 .kkmod / .json 文本；必须是含 manifest 的对象，否则返回错误文案 */
export function parseKkmodFileText(
  text: string,
  fileName = 'component.kkmod',
): { ok: true; filename: string; pkg: Record<string, unknown> } | { ok: false; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: '玩法包不是合法 JSON，请选择导出的 .kkmod 文件' };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, message: '玩法包内容无效' };
  }
  const pkg = json as Record<string, unknown>;
  if (!pkg.manifest || typeof pkg.manifest !== 'object') {
    return { ok: false, message: '玩法包缺少 manifest，无法上传' };
  }
  const slug = String((pkg.manifest as { slug?: unknown }).slug || '').trim();
  const base = String(fileName || '').trim() || 'component.kkmod';
  const filename = slug ? `${slug}.kkmod` : base.endsWith('.kkmod') ? base : `${base}.kkmod`;
  return { ok: true, filename, pkg };
}
