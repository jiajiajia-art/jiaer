import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CreationStepFooter.module.css';
import { isWorldBookActive } from '../../utils/worldBookPanel';
import { isGameDatabaseActive } from '../../utils/dataPromptPanel';

interface CreationStepFooterProps {
  activePanel: string;
  onPanelChange: (panelId: string) => void | Promise<void>;
  isParsing: boolean;
  isParsed: boolean;
  mode?: string;
}

const VISUAL_STEPS = ['documents', 'world', 'characters', 'scenes', 'worldBook', 'gameDatabase'] as const;
const WORLD_INTERACTION_STEPS = ['documents', 'world', 'attributeGrowth', 'characters', 'scenes', 'functionalNPCs', 'mapEdit'] as const;

/**
 * 功能注释：移动端底部胶囊步进条（对齐效果图：上一步描边 + 下一步酒红实心）。
 * 与侧栏共用同一套面板顺序，切步仍走父级 onPanelChange（含未保存校验）。
 */
const CreationStepFooter: React.FC<CreationStepFooterProps> = ({
  activePanel,
  onPanelChange,
  isParsing,
  isParsed,
  mode = 'visual',
}) => {
  const { t } = useTranslation();
  const steps = useMemo(
    () => (mode === 'worldInteraction' ? [...WORLD_INTERACTION_STEPS] : [...VISUAL_STEPS]) as string[],
    [mode],
  );

  const activeId = useMemo(() => {
    if (isParsing) return 'documents';
    if (isGameDatabaseActive(activePanel)) return 'gameDatabase';
    if (isWorldBookActive(activePanel)) return 'worldBook';
    if (steps.includes(activePanel)) return activePanel;
    return steps[0] || 'documents';
  }, [activePanel, isParsing, steps]);

  const activeIndex = Math.max(0, steps.findIndex((id) => id === activeId));
  const prevId = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const nextId = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;
  const nextDisabled = Boolean(nextId && nextId !== 'documents' && (isParsing || !isParsed));

  return (
    <div className={styles.footer} role="navigation" aria-label={t('createGame.flowStepNav')}>
      <button
        type="button"
        className={styles.prev}
        disabled={!prevId}
        onClick={() => {
          if (prevId) void onPanelChange(prevId);
        }}
      >
        {t('createGame.flowPrev')}
      </button>
      <button
        type="button"
        className={styles.next}
        disabled={!nextId || nextDisabled}
        onClick={() => {
          if (nextId && !nextDisabled) void onPanelChange(nextId);
        }}
      >
        {t('createGame.flowNext')}
      </button>
    </div>
  );
};

export default CreationStepFooter;
