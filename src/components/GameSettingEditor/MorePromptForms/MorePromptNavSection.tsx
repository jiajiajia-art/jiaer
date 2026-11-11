import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiTrash2 } from 'react-icons/fi';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import navStyles from '../Sidebar.module.css';
import styles from './MorePromptNavSection.module.css';
import type { MorePromptForm } from '../../../api/galgame/EditorData.type';
import {
  getPromptFormVariantConfig,
  type PromptFormVariant,
} from '../../../utils/promptFormVariant';

interface MorePromptNavSectionProps {
  variant?: PromptFormVariant;
  /** 动态条目起始序号（世界书内可不展示徽章） */
  numberOffset: number;
  /** 主侧栏横向滚动 vs 世界书内纵向列表 */
  layout?: 'sidebar' | 'worldBook';
  /** 是否展示左侧序号徽章 */
  showNavBadge?: boolean;
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
  variant = 'morePrompt',
  numberOffset,
  layout = 'sidebar',
  showNavBadge = true,
  forms,
  activePanel,
  disabled,
  canAddMore,
  onPanelChange,
  onDelete,
}) => {
  const { t } = useTranslation();
  const config = getPromptFormVariantConfig(variant);
  const i18n = (key: string) => t(`${config.i18nPrefix}.${key}`);
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
      <div className={`${styles.section} ${layout === 'worldBook' ? styles.sectionWorldBook : ''}`}>
        {forms.map((form, index) => {
          const panelId = config.buildPanelId(form.id);
          const isActive = activePanel === panelId;
          const itemNumber = numberOffset + index;

          const displayTitle = form.title || form.description;

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
                {showNavBadge && <span className={navStyles.navBadge}>{itemNumber}</span>}
                <span className={navStyles.navText}>
                  <span className={navStyles.navTitleDesktop}>
                    {showNavBadge ? `${itemNumber} · ` : ''}{displayTitle}
                  </span>
                  <span className={navStyles.navTitleMobile}>{displayTitle}</span>
                  <small>{form.description}</small>
                </span>
              </button>
              {!disabled && (
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={i18n('delete')}
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
          className={`${styles.addBtn} ${!canAddMore || disabled ? styles.addBtnDisabled : ''} ${activePanel === config.newPanel ? styles.addBtnActive : ''}`}
          onClick={() => !disabled && canAddMore && onPanelChange(config.newPanel)}
          disabled={disabled || !canAddMore}
          title={!canAddMore ? i18n('maxReached') : i18n('navLabel')}
        >
          <span className={styles.addIcon}>+</span>
          <span>{i18n('navLabel')}</span>
        </button>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title={i18n('delete')}
        message={i18n('deleteConfirm')}
        confirmButtonText={t('common.confirm')}
        cancelButtonText={t('common.thinkLater')}
      />
    </>
  );
};

export default MorePromptNavSection;
