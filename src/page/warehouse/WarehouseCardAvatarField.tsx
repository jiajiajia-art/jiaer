import React from 'react';
import { CHARACTER_GENERATION_COST, getImageUrl } from '../../utils/constants';
import { warehouseCardAvatarConstraintHint } from '../../lib/warehouse/warehouseCardAvatar';
import panel from './WarehousePanel.module.css';

type Props = {
  name: string;
  avatarUrl: string;
  generating: boolean;
  disabled?: boolean;
  onGenerate: () => void;
  fallbackChar?: string;
};

/** 编辑卡表单：预览 + AI 生图入口 */
const WarehouseCardAvatarField: React.FC<Props> = ({
  name,
  avatarUrl,
  generating,
  disabled,
  onGenerate,
  fallbackChar = '我',
}) => {
  const preview = avatarUrl ? getImageUrl(avatarUrl) : '';
  return (
    <div className={panel.avatarField}>
      <div className={panel.avatarFieldHead}>
        <span>角色图像</span>
        <span className={panel.avatarHint}>{warehouseCardAvatarConstraintHint()}</span>
      </div>
      <div className={panel.avatarRow}>
        <div className={panel.avatarPreview}>
          {preview ? (
            <img src={preview} alt="" className={panel.avatarPreviewImg} />
          ) : (
            <span className={panel.avatarPreviewFallback}>
              {(name || fallbackChar).slice(0, 1)}
            </span>
          )}
        </div>
        <div className={panel.avatarActions}>
          <button
            type="button"
            className={panel.primaryBtn}
            disabled={disabled || generating}
            onClick={onGenerate}
          >
            {generating
              ? '生成中…'
              : `${avatarUrl ? '重新生成图像' : 'AI 生成图像'} · ${CHARACTER_GENERATION_COST} 积分`}
          </button>
          <p className={panel.avatarTip}>
            请先填写姓名与简介；生成后可继续改文案，保存时一并写入卡面。
          </p>
        </div>
      </div>
    </div>
  );
};

export default WarehouseCardAvatarField;
