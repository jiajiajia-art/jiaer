import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import { buildSystemPanelItems } from '../../../lib/galgame/systemPanelFromMorePromptForms';

interface SystemsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  morePromptForms: unknown;
}

/** 功能注释：静态展示 morePromptForms（系统名单 + 触发关键词）。 */
const SystemsPanel: React.FC<SystemsPanelProps> = ({ isOpen, onClose, morePromptForms }) => {
  const { t } = useTranslation();
  const items = useMemo(() => buildSystemPanelItems(morePromptForms), [morePromptForms]);

  return (
    <PlayPanelShell
      isOpen={isOpen}
      title={t('galgame.panelSystemsTitle')}
      subtitle={t('galgame.panelSystemsSubtitle')}
      onClose={onClose}
    >
      {items.length === 0 ? (
        <div className={shell.empty}>{t('galgame.panelSystemsEmpty')}</div>
      ) : (
        items.map((item) => (
          <article key={item.id} className={shell.card}>
            <h3 className={shell.cardTitle}>{item.name}</h3>
            {item.summary ? <p className={shell.cardBody}>{item.summary}</p> : null}
            <p className={shell.cardMeta}>
              {t('galgame.panelSystemsKeywords')}:{' '}
              {item.keywords.length > 0 ? item.keywords.join('、') : t('galgame.panelSystemsNoKeywords')}
              {item.constant ? ` · ${t('galgame.panelSystemsConstant')}` : ''}
            </p>
            <p className={shell.cardMeta}>
              {t('galgame.panelStatus')}: {t('galgame.panelSystemsPlayable')}
            </p>
          </article>
        ))
      )}
    </PlayPanelShell>
  );
};

export default SystemsPanel;
