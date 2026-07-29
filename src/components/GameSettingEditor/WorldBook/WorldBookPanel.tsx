import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WorldBookPanel.module.css';
import MorePromptNavSection from '../MorePromptForms/MorePromptNavSection';
import MorePromptFormPanel, { type MorePromptFormPanelRef } from '../MorePromptForms/MorePromptFormPanel';
import type { MorePromptForm } from '../../../api/galgame/EditorData.type';
import {
  resolveWorldBookRightView,
  WORLD_BOOK_NAV_NUMBER_OFFSET,
} from '../../../utils/worldBookPanel';

export interface WorldBookPanelProps {
  activePanel: string;
  forms: MorePromptForm[];
  disabled: boolean;
  canAddMore: boolean;
  isSaving: boolean;
  onPanelChange: (panelId: string) => void;
  onDelete: (id: string) => void;
  onSave: (form: MorePromptForm, allForms: MorePromptForm[]) => Promise<boolean>;
  onCancel: () => void;
  formPanelRef: React.Ref<MorePromptFormPanelRef>;
}

/**
 * Step 5 世界书：左侧补充提示词菜单 + 右侧编辑表单（复用 MorePromptFormPanel）
 */
const WorldBookPanel: React.FC<WorldBookPanelProps> = ({
  activePanel,
  forms,
  disabled,
  canAddMore,
  isSaving,
  onPanelChange,
  onDelete,
  onSave,
  onCancel,
  formPanelRef,
}) => {
  const { t } = useTranslation();
  const rightView = resolveWorldBookRightView(activePanel);

  return (
    <div className={styles.worldBook}>
      <header className={styles.header}>
        <h2>{t('createGame.worldBook.pageTitle')}</h2>
        <p className={styles.subtitle}>{t('createGame.morePrompt.sectionSubtitle')}</p>
      </header>

      <div className={styles.body}>
        <aside className={styles.subNav} aria-label={t('createGame.worldBook.subNavLabel')}>
          <MorePromptNavSection
            layout="worldBook"
            numberOffset={WORLD_BOOK_NAV_NUMBER_OFFSET}
            showNavBadge={false}
            forms={forms}
            activePanel={activePanel}
            disabled={disabled}
            canAddMore={canAddMore}
            onPanelChange={onPanelChange}
            onDelete={onDelete}
          />
        </aside>

        <div className={styles.content}>
          {rightView === 'form' ? (
            <MorePromptFormPanel
              ref={formPanelRef}
              activePanel={activePanel}
              forms={forms}
              isSaving={isSaving}
              onSave={onSave}
              onCancel={onCancel}
            />
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t('createGame.worldBook.emptyTitle')}</p>
              <p className={styles.emptyHint}>{t('createGame.worldBook.emptyHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorldBookPanel;
