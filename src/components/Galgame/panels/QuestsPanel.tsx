import React from 'react';
import { useTranslation } from 'react-i18next';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import type { QuestItem } from '../../../lib/galgame/quests';

interface QuestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  quests: QuestItem[];
  loading?: boolean;
  error?: string | null;
}

/** 功能注释：任务日志列表，高亮 tracked。 */
const QuestsPanel: React.FC<QuestsPanelProps> = ({
  isOpen,
  onClose,
  quests,
  loading,
  error,
}) => {
  const { t } = useTranslation();

  const statusLabel = (q: QuestItem) => {
    if (q.status === 'active') return t('galgame.questStatusActive');
    if (q.status === 'optional') return t('galgame.questStatusOptional');
    if (q.status === 'completed') return t('galgame.questStatusCompleted');
    if (q.status === 'failed') return t('galgame.questStatusFailed');
    return q.status;
  };

  return (
    <PlayPanelShell
      isOpen={isOpen}
      title={t('galgame.panelQuestsTitle')}
      subtitle={t('galgame.panelQuestsSubtitle')}
      onClose={onClose}
    >
      {loading ? <div className={shell.empty}>{t('galgame.panelLoading')}</div> : null}
      {error && quests.length === 0 ? (
        <div className={shell.empty}>
          {error === 'INVALID_JSON' ? t('galgame.panelQuestsInvalid') : error}
        </div>
      ) : null}
      {!loading && !error && quests.length === 0 ? (
        <div className={shell.empty}>{t('galgame.panelQuestsEmpty')}</div>
      ) : null}
      {!loading
        ? quests.map((q) => (
            <article key={q.id} className={`${shell.card} ${q.tracked ? shell.cardActive : ''}`}>
              <h3 className={shell.cardTitle}>
                {q.title}
                {q.tracked ? ` · ${t('galgame.questTracked')}` : ''}
              </h3>
              {q.description ? <p className={shell.cardBody}>{q.description}</p> : null}
              <p className={shell.cardMeta}>
                {t('galgame.panelStatus')}: {statusLabel(q)}
              </p>
              {q.goalText ? (
                <p className={shell.cardMeta}>
                  {q.type === 'main' || q.type === '主线'
                    ? t('galgame.questMainGoal')
                    : t('galgame.questSideGoal')}
                  : {q.goalText}
                </p>
              ) : null}
            </article>
          ))
        : null}
    </PlayPanelShell>
  );
};

export default QuestsPanel;
