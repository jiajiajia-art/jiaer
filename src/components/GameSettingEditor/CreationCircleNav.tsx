import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdDescription,
  MdMenuBook,
  MdPerson,
  MdImage,
  MdPublish,
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

const STEPS: Array<{
  id: CreationCircleStepId;
  labelKey: string;
  Icon: typeof MdDescription;
}> = [
  { id: 'documents', labelKey: 'createGame.circleNav.file', Icon: MdDescription },
  { id: 'world', labelKey: 'createGame.circleNav.script', Icon: MdMenuBook },
  { id: 'characters', labelKey: 'createGame.circleNav.character', Icon: MdPerson },
  { id: 'scenes', labelKey: 'createGame.circleNav.scene', Icon: MdImage },
  { id: 'publish', labelKey: 'createGame.circleNav.publish', Icon: MdPublish },
];

/**
 * 功能注释：TXT 创建移动端圆形步进（效果图：文件/脚本/角色/场景/发布），
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

  const isDisabled = (id: CreationCircleStepId) => {
    if (id === 'documents') return false;
    if (id === 'publish') return publishDisabled || isParsing || !isParsed;
    return isParsing || !isParsed;
  };

  return (
    <nav className={styles.nav} aria-label={t('createGame.circleNav.ariaLabel')}>
      {STEPS.map(({ id, labelKey, Icon }) => {
        const active = activeId === id;
        const disabled = isDisabled(id);
        return (
          <button
            key={id}
            type="button"
            className={[
              styles.item,
              active ? styles.itemActive : '',
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
              <Icon className={styles.icon} size={22} />
            </span>
            <span className={styles.label}>{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default CreationCircleNav;
