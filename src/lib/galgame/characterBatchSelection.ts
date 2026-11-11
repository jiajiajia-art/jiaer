/**
 * 角色立绘批量生成：选中项解析（无选中 = 全量）
 */

export type CharacterBatchSelection = {
  /** 是否显式传了选中列表；false 表示未勾选，走全量 */
  hasSelection: boolean;
  generatePlayer: boolean;
  generateNPCs: boolean;
  /** 仅 NPC id；不含 player */
  npcIds: string[];
};

/** 功能注释：勾选为空 → 全量；有勾选 → 只生成勾中的主角/NPC。 */
export function resolveCharacterBatchSelection(
  selectedIds: Iterable<string> | null | undefined,
): CharacterBatchSelection {
  const ids = [...(selectedIds || [])].map((id) => String(id || '').trim()).filter(Boolean);
  if (ids.length === 0) {
    return {
      hasSelection: false,
      generatePlayer: true,
      generateNPCs: true,
      npcIds: [],
    };
  }
  const generatePlayer = ids.includes('player');
  const npcIds = ids.filter((id) => id !== 'player');
  return {
    hasSelection: true,
    generatePlayer,
    generateNPCs: npcIds.length > 0,
    npcIds,
  };
}
