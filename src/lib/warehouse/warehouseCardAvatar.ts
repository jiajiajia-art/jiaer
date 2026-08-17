/** 仓库人设/角色卡立绘约束（与后端 cardAvatarGenerate 对齐） */

export const WAREHOUSE_CARD_AVATAR_MAX_BYTES = 500 * 1024;
export const WAREHOUSE_CARD_AVATAR_MAX_WIDTH = 800;
export const WAREHOUSE_CARD_AVATAR_FORMAT = 'webp' as const;

export function warehouseCardAvatarConstraintHint(): string {
  return `生成图为 WebP，宽度≤${WAREHOUSE_CARD_AVATAR_MAX_WIDTH}，体积≤${Math.round(WAREHOUSE_CARD_AVATAR_MAX_BYTES / 1024)}KB`;
}
