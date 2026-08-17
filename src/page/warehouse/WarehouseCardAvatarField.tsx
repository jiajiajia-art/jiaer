import React from 'react';
import TrimmedTransparentImg from '../../components/TrimmedTransparentImg';
import { CHARACTER_GENERATION_COST, getImageUrl } from '../../utils/constants';
import panel from './WarehousePanel.module.css';

type Props = {
  name: string;
  avatarUrl: string;
  generating: boolean;
  disabled?: boolean;
  onGenerate: () => void;
  fallbackChar?: string;
  /** 头像右侧：姓名、性别等表单项 */
  children?: React.ReactNode;
};

/** 左立绘画布占满；右侧生成按钮 + 姓名/性别等 */
const WarehouseCardAvatarField: React.FC<Props> = ({
  name,
  avatarUrl,
  generating,
  disabled,
  onGenerate,
  fallbackChar = '我',
  children,
}) => {
  const preview = avatarUrl ? getImageUrl(avatarUrl) : '';
  const label = (name || fallbackChar).trim().slice(0, 1) || '角';
  const busy = Boolean(generating);
  // 功能注释：生图后台跑时只锁本按钮，姓名/性别/保存等不受影响
  const locked = Boolean(disabled || generating);

  return (
    <section className={panel.avatarField} aria-label="角色图像">
      <div className={panel.avatarIdentityRow}>
        <div className={panel.avatarPreview} aria-busy={busy}>
          {preview ? (
            <TrimmedTransparentImg src={preview} className={panel.avatarPreviewImg} variant="bust" />
          ) : (
            <span className={panel.avatarPreviewFallback} aria-hidden>
              {label}
            </span>
          )}
        </div>

        <div className={panel.avatarAside}>
          <button
            type="button"
            className={`${panel.primaryBtn} ${panel.avatarGenBtn}`}
            disabled={locked}
            onClick={onGenerate}
          >
            {busy
              ? '后台生成中…'
              : avatarUrl
                ? `重新生成图像 · ${CHARACTER_GENERATION_COST} 积分`
                : `AI 生成图像 · ${CHARACTER_GENERATION_COST} 积分`}
          </button>
          {children}
        </div>
      </div>
    </section>
  );
};

export default WarehouseCardAvatarField;
