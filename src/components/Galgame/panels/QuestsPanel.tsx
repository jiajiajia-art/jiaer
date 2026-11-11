import React from 'react';
import { useTranslation } from 'react-i18next';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import type { QuestItem } from '../../../lib/galgame/quests';
import { formatQuestDeadlineDisplay } from '../../../lib/galgame/quests';

interface QuestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  quests: QuestItem[];
  /** 无缓存时的阻塞 loading；有列表时不挡展示 */
  loading?: boolean;
  /** 后台 LLM 刷新中（有缓存时软提示） */
  refreshing?: boolean;
  error?: string | null;
}

/** 功能注释：任务日志列表，高亮 tracked；有缓存时 loading 不藏列表。 */
const QuestsPanel: React.FC<QuestsPanelProps> = ({
  isOpen,
  onClose,
  quests,
  loading,
  refreshing,
  error,
}) => {
  const { t } = useTranslation();
  const hasList = quests.length > 0;
  const showBlockingLoader = Boolean(loading && !hasList);

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
      {showBlockingLoader ? <div className={shell.empty}>{t('galgame.panelLoading')}</div> : null}
      {refreshing && hasList ? (
        <p className={shell.cardMeta} aria-live="polite">
          {t('galgame.panelLoading')}
        </p>
      ) : null}
      {error && !hasList ? (
        <div className={shell.empty}>
          {error === 'INVALID_JSON' ? t('galgame.panelQuestsInvalid') : error}
        </div>
      ) : null}
      {!showBlockingLoader && !error && !hasList ? (
        <div className={shell.empty}>{t('galgame.panelQuestsEmpty')}</div>
      ) : null}
      {!showBlockingLoader
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
              {formatQuestDeadlineDisplay(q) ? (
                <p className={shell.cardMeta}>
                  {t('galgame.questDeadline', { defaultValue: '截止' })}: {formatQuestDeadlineDisplay(q)}
                </p>
              ) : null}
            </article>
          ))
        : null}
    </PlayPanelShell>
  );
};

export default QuestsPanel;
