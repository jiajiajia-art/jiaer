import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CreationFlowRail.module.css';
import { isWorldBookActive } from '../../utils/worldBookPanel';
import { isGameDatabaseActive } from '../../utils/dataPromptPanel';

interface CreationFlowRailProps {
  activePanel: string;
  isParsing: boolean;
  isParsed: boolean;
  mode?: string;
}

type FlowStep = {
  id: string;
  labelKey: string;
};

const VISUAL_STEPS: FlowStep[] = [
  { id: 'documents', labelKey: 'createGame.flowStepUpload' },
  { id: 'world', labelKey: 'createGame.flowStepWorld' },
  { id: 'characters', labelKey: 'createGame.flowStepCharacters' },
  { id: 'scenes', labelKey: 'createGame.flowStepScenes' },
  { id: 'worldBook', labelKey: 'createGame.flowStepSystems' },
  { id: 'gameDatabase', labelKey: 'createGame.flowStepDatabase' },
];

/**
 * 功能注释：创作页顶栏分步进度轨，高亮当前面板，替代纯文案 Step 提示。
 */
const CreationFlowRail: React.FC<CreationFlowRailProps> = ({
  activePanel,
  isParsing,
  isParsed,
  mode = 'visual',
}) => {
  const { t } = useTranslation();
  const steps = mode === 'worldInteraction' ? VISUAL_STEPS.slice(0, 4) : VISUAL_STEPS;

  const activeId = useMemo(() => {
    if (isParsing) return 'documents';
    if (isGameDatabaseActive(activePanel)) return 'gameDatabase';
    if (isWorldBookActive(activePanel)) return 'worldBook';
    if (steps.some((s) => s.id === activePanel)) return activePanel;
    return steps[0]?.id || 'documents';
  }, [activePanel, isParsing, steps]);

  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === activeId));

  return (
    <nav className={styles.rail} aria-label={t('createGame.title')}>
      <ol className={styles.list}>
        {steps.map((step, index) => {
          const isActive = step.id === activeId;
          const isDone = isParsed && index < activeIndex && step.id !== 'documents'
            ? true
            : step.id === 'documents' && isParsed && !isActive;
          return (
            <li
              key={step.id}
              className={[
                styles.step,
                isActive ? styles.active : '',
                isDone ? styles.done : '',
              ].filter(Boolean).join(' ')}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={styles.index} aria-hidden>
                {isDone ? '✓' : index + 1}
              </span>
              <span className={styles.label}>{t(step.labelKey)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default CreationFlowRail;
