import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../WorldBook/WorldBookPanel.module.css';
import MorePromptNavSection from '../MorePromptForms/MorePromptNavSection';
import MorePromptFormPanel, { type MorePromptFormPanelRef } from '../MorePromptForms/MorePromptFormPanel';
import type { DataPromptForm } from '../../../api/galgame/EditorData.type';
import {
  resolveGameDatabaseRightView,
  GAME_DATABASE_NAV_NUMBER_OFFSET,
} from '../../../utils/dataPromptPanel';

export interface DatabasePanelProps {
  activePanel: string;
  forms: DataPromptForm[];
  disabled: boolean;
  canAddMore: boolean;
  isSaving: boolean;
  onPanelChange: (panelId: string) => void;
  onDelete: (id: string) => void;
  onSave: (form: DataPromptForm, allForms: DataPromptForm[]) => Promise<boolean>;
  onCancel: () => void;
  formPanelRef: React.Ref<MorePromptFormPanelRef>;
}

/**
 * Step 6 数据库：左侧数据条目菜单 + 右侧编辑表单（复用世界书墨黑壳 + MorePromptFormPanel）
 */
const DatabasePanel: React.FC<DatabasePanelProps> = ({
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
  const rightView = resolveGameDatabaseRightView(activePanel);

  return (
    <div className={styles.worldBook}>
      <header className={styles.header}>
        <h2>{t('createGame.gameDatabase.pageTitle')}</h2>
        <p className={styles.subtitle}>{t('createGame.dataPrompt.sectionSubtitle')}</p>
      </header>

      <div className={styles.body}>
        <aside className={styles.subNav} aria-label={t('createGame.gameDatabase.subNavLabel')}>
          <MorePromptNavSection
            variant="dataPrompt"
            layout="worldBook"
            numberOffset={GAME_DATABASE_NAV_NUMBER_OFFSET}
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
              variant="dataPrompt"
              activePanel={activePanel}
              forms={forms}
              isSaving={isSaving}
              onSave={onSave}
              onCancel={onCancel}
            />
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t('createGame.gameDatabase.emptyTitle')}</p>
              <p className={styles.emptyHint}>{t('createGame.gameDatabase.emptyHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabasePanel;
