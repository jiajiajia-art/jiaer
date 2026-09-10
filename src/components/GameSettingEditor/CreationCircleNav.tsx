import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdDescription,
  MdAssignmentTurnedIn,
} from 'react-icons/md';
import type { IconType } from 'react-icons';
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

/** 功能注释：步进切图基路径；未选中莓红剪影、选中/已完成白剪影（莓红胶囊底需白标对比度） */
const CREATE_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/create`;
const SCENE_ICON_IDLE = `${CREATE_ICON_BASE}/circle_nav_scene.webp`;
const SCENE_ICON_ACTIVE = `${CREATE_ICON_BASE}/circle_nav_scene_active.webp`;
const CHARACTER_ICON_IDLE = `${CREATE_ICON_BASE}/circle_nav_character.webp`;
const CHARACTER_ICON_ACTIVE = `${CREATE_ICON_BASE}/circle_nav_character_active.webp`;
const PUBLISH_ICON_IDLE = `${CREATE_ICON_BASE}/circle_nav_publish.webp`;
const PUBLISH_ICON_ACTIVE = `${CREATE_ICON_BASE}/circle_nav_publish_active.webp`;

type StepDef =
  | {
      id: CreationCircleStepId;
      labelKey: string;
      kind: 'reactIcon';
      Icon: IconType;
    }
  | {
      id: CreationCircleStepId;
      labelKey: string;
      kind: 'asset';
      idleSrc: string;
      activeSrc: string;
    };

const STEPS: StepDef[] = [
  { id: 'documents', labelKey: 'createGame.circleNav.file', kind: 'reactIcon', Icon: MdDescription },
  { id: 'world', labelKey: 'createGame.circleNav.script', kind: 'reactIcon', Icon: MdAssignmentTurnedIn },
  {
    id: 'characters',
    labelKey: 'createGame.circleNav.character',
    kind: 'asset',
    idleSrc: CHARACTER_ICON_IDLE,
    activeSrc: CHARACTER_ICON_ACTIVE,
  },
  {
    id: 'scenes',
    labelKey: 'createGame.circleNav.scene',
    kind: 'asset',
    idleSrc: SCENE_ICON_IDLE,
    activeSrc: SCENE_ICON_ACTIVE,
  },
  {
    id: 'publish',
    labelKey: 'createGame.circleNav.publish',
    kind: 'asset',
    idleSrc: PUBLISH_ICON_IDLE,
    activeSrc: PUBLISH_ICON_ACTIVE,
  },
];

/**
 * 功能注释：TXT 创建移动端胶囊步进（效果图：炭黑内高光 + 莓红图标 / 当前实心莓红白标），
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
      {STEPS.map((step) => {
        const { id, labelKey } = step;
        const active = activeId === id;
        const done = !active && STEP_ORDER.indexOf(id) < activeIndex;
        const disabled = isDisabled(id);
        const assetLit = active || done;
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
              {step.kind === 'asset' ? (
                <img
                  className={styles.assetIcon}
                  src={assetLit ? step.activeSrc : step.idleSrc}
                  alt=""
                  width={22}
                  height={21}
                  draggable={false}
                />
              ) : (
                <step.Icon className={styles.icon} size={22} />
              )}
            </span>
            <span className={styles.label}>{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default CreationCircleNav;
