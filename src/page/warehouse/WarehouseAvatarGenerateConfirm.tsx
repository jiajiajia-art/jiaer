import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GameConfirmModal from '../../components/Galgame/GameConfirmModal';
import {
  AVATAR_STYLE_OPTIONS,
  DEFAULT_AVATAR_STYLE,
  type AvatarStyleId,
} from '../../lib/galgame/sessionNpcAvatarPrompt';
import styles from './WarehouseAvatarGenerateConfirm.module.css';

export type WarehouseAvatarGenerateConfirmResult = {
  avatarStyleId: AvatarStyleId;
  promptSupplement: string;
};

type Props = {
  isOpen: boolean;
  cost: number;
  title?: string;
  subjectLabel?: string;
  onCancel: () => void;
  onConfirm: (result: WarehouseAvatarGenerateConfirmResult) => void;
};

/**
 * 功能注释：仓库人设/角色卡生图确认——对齐局内「画风与提示词」A–D 选择。
 */
const WarehouseAvatarGenerateConfirm: React.FC<Props> = ({
  isOpen,
  cost,
  title = '确认生成图像',
  subjectLabel = '立绘',
  onCancel,
  onConfirm,
}) => {
  const [promptOpen, setPromptOpen] = useState(true);
  const [avatarStyleId, setAvatarStyleId] = useState<AvatarStyleId>(DEFAULT_AVATAR_STYLE);
  const [promptSupplement, setPromptSupplement] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPromptOpen(true);
    setAvatarStyleId(DEFAULT_AVATAR_STYLE);
    setPromptSupplement('');
  }, [isOpen]);

  if (!isOpen) return null;

  const modal = (
    <GameConfirmModal
      isOpen={isOpen}
      variant="dossier"
      overlayZIndex={1300}
      title={title}
      confirmText="确认生成"
      cancelText="取消"
      message={(
        <div className={styles.confirmMsgStack}>
          <p className={styles.confirmMsgText}>
            {`将扣除 ${cost} 织梦豆生成 ${subjectLabel}，是否继续？`}
          </p>
          <button
            type="button"
            className={`${styles.promptCueBtn} ${promptOpen ? styles.promptCueBtnActive : ''}`}
            onClick={() => setPromptOpen((open) => !open)}
            aria-expanded={promptOpen}
          >
            <span>{promptOpen ? '收起画风与提示词' : '画风与提示词'}</span>
            <span className={styles.promptCueChevron} aria-hidden>
              {promptOpen ? '▴' : '▾'}
            </span>
          </button>
        </div>
      )}
      onCancel={onCancel}
      onConfirm={() => onConfirm({
        avatarStyleId,
        promptSupplement: promptSupplement.trim().slice(0, 500),
      })}
    >
      {promptOpen ? (
        <div className={styles.promptCuePanel} role="region" aria-label="画风与提示词">
          <div className={styles.promptCueSection}>
            <div className={styles.promptCueLabelRow}>
              <span className={styles.promptCueLabel}>风格选择</span>
              <span className={styles.promptCueHint}>点选即可 · 默认 A</span>
            </div>
            <div className={styles.styleChipRow} role="radiogroup" aria-label="立绘画风">
              {AVATAR_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={avatarStyleId === opt.id}
                  className={`${styles.styleChip} ${avatarStyleId === opt.id ? styles.styleChipActive : ''}`}
                  onClick={() => setAvatarStyleId(opt.id)}
                >
                  <span className={styles.styleChipId}>{opt.id}</span>
                  <span className={styles.styleChipLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.promptCueSection}>
            <div className={styles.promptCueLabelRow}>
              <span className={styles.promptCueLabel}>外貌补充（可选）</span>
              <span className={styles.promptCueHint}>{promptSupplement.trim().length}/500</span>
            </div>
            <textarea
              className={styles.promptCueInput}
              value={promptSupplement}
              maxLength={500}
              rows={3}
              placeholder="短发、校服、冷白皮、侧分刘海…"
              onChange={(e) => setPromptSupplement(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </GameConfirmModal>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
};

export default WarehouseAvatarGenerateConfirm;
