/** 仓库人设/角色卡立绘约束（与后端 cardAvatarGenerate 对齐） */

export const WAREHOUSE_CARD_AVATAR_MAX_BYTES = 500 * 1024;
export const WAREHOUSE_CARD_AVATAR_MAX_WIDTH = 800;
export const WAREHOUSE_CARD_AVATAR_FORMAT = 'webp' as const;

/** 用户上传：与局内上传一致，1MB / 质量 100 */
export const WAREHOUSE_CARD_UPLOAD_AVATAR_MAX_BYTES = 1024 * 1024;

export function warehouseCardAvatarConstraintHint(): string {
  return `生成图为 WebP，宽度≤${WAREHOUSE_CARD_AVATAR_MAX_WIDTH}，体积≤${Math.round(WAREHOUSE_CARD_AVATAR_MAX_BYTES / 1024)}KB`;
}

export function warehouseCardUploadHint(): string {
  return `上传转 WebP（质量 100）；超过 ${Math.round(WAREHOUSE_CARD_UPLOAD_AVATAR_MAX_BYTES / (1024 * 1024))}MB 等比缩小`;
}
