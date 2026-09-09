import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdDescription,
  MdAssignmentTurnedIn,
  MdRecordVoiceOver,
  MdBeachAccess,
  MdSend,
} from 'react-icons/md';
import styles from './CreationCircleNav.module.css';

export type CreationCircleStepId =
  | 'documents'
  | 'world'
  | 'characters'
  | 'scenes'
  | 'publish';

interface CreationCircleNavProps {
  activePanel: string;
  isParsing: boolean;
  isParsed: boolean;
  onPanelChange: (panelId: string) => void | Promise<void>;
  onPublish: () => void | Promise<void>;
  publishDisabled?: boolean;
}

const STEP_ORDER: CreationCircleStepId[] = [
  'documents',
  'world',
  'characters',
  'scenes',
  'publish',
];

const STEPS: Array<{
  id: CreationCircleStepId;
  labelKey: string;
  Icon: typeof MdDescription;
}> = [
  { id: 'documents', labelKey: 'createGame.circleNav.file', Icon: MdDescription },
  { id: 'world', labelKey: 'createGame.circleNav.script', Icon: MdAssignmentTurnedIn },
  { id: 'characters', labelKey: 'createGame.circleNav.character', Icon: MdRecordVoiceOver },
  { id: 'scenes', labelKey: 'createGame.circleNav.scene', Icon: MdBeachAccess },
  { id: 'publish', labelKey: 'createGame.circleNav.publish', Icon: MdSend },
];

/**
 * 功能注释：TXT 创建移动端圆形步进（效果图：已完成酒红白标 / 当前亮红 / 未到灰底红标），
 * 与侧栏共用 onPanelChange；发布步直接走发布流程。
 */
const CreationCircleNav: React.FC<CreationCircleNavProps> = ({
  activePanel,
  isParsing,
  isParsed,
  onPanelChange,
  onPublish,
  publishDisabled = false,
}) => {
  const { t } = useTranslation();

  const activeId = useMemo((): CreationCircleStepId => {
    if (isParsing) return 'documents';
    if (activePanel === 'world') return 'world';
    if (activePanel === 'characters') return 'characters';
    if (activePanel === 'scenes') return 'scenes';
    if (activePanel === 'documents') return 'documents';
    // 系统/数据库等附属面板时高亮脚本或保持文档
    if (activePanel === 'worldBook' || activePanel.startsWith('morePrompt:')) return 'world';
    if (activePanel === 'gameDatabase' || activePanel.startsWith('dataPrompt:')) return 'world';
    return 'documents';
  }, [activePanel, isParsing]);

  const activeIndex = STEP_ORDER.indexOf(activeId);

  const isDisabled = (id: CreationCircleStepId) => {
    if (id === 'documents') return false;
    if (id === 'publish') return publishDisabled || isParsing || !isParsed;
    return isParsing || !isParsed;
  };

  return (
    <nav className={styles.nav} aria-label={t('createGame.circleNav.ariaLabel')}>
      {STEPS.map(({ id, labelKey, Icon }) => {
        const active = activeId === id;
        const done = !active && STEP_ORDER.indexOf(id) < activeIndex;
        const disabled = isDisabled(id);
        return (
          <button
            key={id}
            type="button"
            className={[
              styles.item,
              active ? styles.itemActive : '',
              done ? styles.itemDone : '',
              disabled ? styles.itemDisabled : '',
            ].filter(Boolean).join(' ')}
            disabled={disabled}
            aria-current={active ? 'step' : undefined}
            onClick={() => {
              if (disabled) return;
              if (id === 'publish') {
                void onPublish();
                return;
              }
              void onPanelChange(id);
            }}
          >
            <span className={styles.iconWrap} aria-hidden>
              <Icon className={styles.icon} size={active ? 24 : 22} />
            </span>
            <span className={styles.label}>{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default CreationCircleNav;
