import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiTrash2 } from 'react-icons/fi';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import navStyles from '../Sidebar.module.css';
import styles from './MorePromptNavSection.module.css';
import type { MorePromptForm } from '../../../api/galgame/EditorData.type';
import {
  buildMorePromptPanelId,
  MORE_PROMPT_NEW_PANEL,
} from '../../../utils/morePromptForms';

interface MorePromptNavSectionProps {
  /** 动态条目起始序号（Visual 固定四步后为 5） */
  numberOffset: number;
  forms: MorePromptForm[];
  activePanel: string;
  disabled: boolean;
  canAddMore: boolean;
  onPanelChange: (panelId: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Visual 侧栏：morePromptForms 有序号列表 + 「+ 补充提示词」
 */
const MorePromptNavSection: React.FC<MorePromptNavSectionProps> = ({
  numberOffset,
  forms,
  activePanel,
  disabled,
  canAddMore,
  onPanelChange,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (disabled) return;
    setPendingDeleteId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      void onDelete(pendingDeleteId);
    }
    setDeleteModalOpen(false);
    setPendingDeleteId(null);
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setPendingDeleteId(null);
  };

  return (
    <>
      <div className={styles.section}>
        {forms.map((form, index) => {
          const panelId = buildMorePromptPanelId(form.id);
          const isActive = activePanel === panelId;
          const itemNumber = numberOffset + index;

          return (
            <div
              key={form.id}
              className={`${navStyles.navBtn} ${styles.itemRow} ${isActive ? navStyles.active : ''} ${disabled ? navStyles.disabled : ''}`}
            >
              <button
                type="button"
                className={styles.itemMain}
                onClick={() => !disabled && onPanelChange(panelId)}
                disabled={disabled}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={navStyles.navBadge}>{itemNumber}</span>
                <span className={navStyles.navText}>
                  <span className={navStyles.navTitleDesktop}>
                    {itemNumber} · {form.title}
                  </span>
                  <span className={navStyles.navTitleMobile}>{form.title}</span>
                  <small>{form.description}</small>
                </span>
              </button>
              {!disabled && (
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={t('createGame.morePrompt.delete')}
                    onClick={(event) => handleDeleteClick(event, form.id)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className={`${styles.addBtn} ${!canAddMore || disabled ? styles.addBtnDisabled : ''} ${activePanel === MORE_PROMPT_NEW_PANEL ? styles.addBtnActive : ''}`}
          onClick={() => !disabled && canAddMore && onPanelChange(MORE_PROMPT_NEW_PANEL)}
          disabled={disabled || !canAddMore}
          title={!canAddMore ? t('createGame.morePrompt.maxReached') : t('createGame.morePrompt.navLabel')}
        >
          <span className={styles.addIcon}>+</span>
          <span>{t('createGame.morePrompt.navLabel')}</span>
        </button>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title={t('createGame.morePrompt.delete')}
        message={t('createGame.morePrompt.deleteConfirm')}
        confirmButtonText={t('common.confirm')}
        cancelButtonText={t('common.thinkLater')}
      />
    </>
  );
};

export default MorePromptNavSection;
