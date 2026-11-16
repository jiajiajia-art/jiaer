import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
  title,
  subjectLabel,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('warehouse.avatars.generateTitle');
  const resolvedSubject = subjectLabel ?? t('warehouse.avatars.generateSubjectDefault');
  const pointsUnit = t('common.points');

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

  const promptCueLabel = t('warehouse.avatars.generatePromptCue');

  const modal = (
    <GameConfirmModal
      isOpen={isOpen}
      variant="dossier"
      overlayZIndex={1300}
      title={resolvedTitle}
      confirmText={t('warehouse.avatars.generateConfirm')}
      cancelText={t('warehouse.cards.cancel')}
      message={(
        <div className={styles.confirmMsgStack}>
          <p className={styles.confirmMsgText}>
            {t('warehouse.avatars.generateDeductMessage', {
              cost,
              pointsUnit,
              subject: resolvedSubject,
            })}
          </p>
          <button
            type="button"
            className={`${styles.promptCueBtn} ${promptOpen ? styles.promptCueBtnActive : ''}`}
            onClick={() => setPromptOpen((open) => !open)}
            aria-expanded={promptOpen}
          >
            <span>
              {promptOpen
                ? t('warehouse.avatars.generatePromptCueCollapse')
                : promptCueLabel}
            </span>
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
        <div className={styles.promptCuePanel} role="region" aria-label={promptCueLabel}>
          <div className={styles.promptCueSection}>
            <div className={styles.promptCueLabelRow}>
              <span className={styles.promptCueLabel}>{t('warehouse.avatars.generateStylePickLabel')}</span>
              <span className={styles.promptCueHint}>{t('warehouse.avatars.generateStylePickHint')}</span>
            </div>
            <div
              className={styles.styleChipRow}
              role="radiogroup"
              aria-label={t('warehouse.avatars.generateStyleRadioAria')}
            >
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
              <span className={styles.promptCueLabel}>{t('warehouse.avatars.generateAppearanceLabel')}</span>
              <span className={styles.promptCueHint}>{promptSupplement.trim().length}/500</span>
            </div>
            <textarea
              className={styles.promptCueInput}
              value={promptSupplement}
              maxLength={500}
              rows={3}
              placeholder={t('warehouse.avatars.generateAppearancePlaceholder')}
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
