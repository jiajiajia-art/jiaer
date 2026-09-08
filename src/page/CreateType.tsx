import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import { FaDesktop } from 'react-icons/fa';
import { HiOutlinePuzzle, HiOutlineUserGroup } from 'react-icons/hi';
import {
  MdAutoStories,
  MdOutlineMovie,
  MdSportsEsports,
} from 'react-icons/md';
import { IoChevronForward } from 'react-icons/io5';
import toast from 'react-hot-toast';
import styles from '../components/CreateGame/CreateGameModals.module.css';
import pageStyles from './CreateType.module.css';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import MobileTipModal from '../components/CreateGame/MobileTipModal';
import { useEditorStore } from '../store/editorStore';
import { useGameStore } from '../store/gameStore';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import {
  getMiniProgramCreatorBlockedMessage,
  isMiniProgramCreatorTypeSupported,
  isMiniProgramEnv,
  MINI_PROGRAM_CREATOR_PC_URL,
  type CreatorGameType,
} from '../utils/miniProgram';

const IVG_TOOL_DOWNLOAD_FILE_NAME = 'FunloomTool.zip';
const IVG_TOOL_DOWNLOAD_URL = 'https://kurangames.com/download/FunloomTool.zip';
const IVG_TUTORIAL_URL = 'https://avyx4ypb3lx.feishu.cn/docx/WTcZdQPipofJq1xb1A4caq6Tngd';

type OptionBadge = 'recommend' | 'new' | 'locked';

const TypeOptionRow: React.FC<{
  title: string;
  badge?: OptionBadge;
  badgeText?: string;
  hint: string;
  icon: IconType;
  thumbClass: string;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ title, badge, badgeText, hint, icon: Icon, thumbClass, disabled, onClick }) => (
  <button
    type="button"
    className={`${styles.createTypeOption} ${disabled ? styles.createTypeOptionDisabled : ''}`}
    onClick={onClick}
    disabled={disabled}
  >
    <span className={`${styles.createTypeOptionThumb} ${thumbClass}`} aria-hidden="true">
      <Icon className={styles.createTypeOptionIcon} />
    </span>
    <span className={styles.createTypeOptionBody}>
      <span className={styles.createTypeOptionTitleRow}>
        <span className={styles.createTypeOptionName}>{title}</span>
        {badge && badgeText ? (
          <span
            className={
              badge === 'recommend'
                ? styles.createTypeOptionRecommend
                : badge === 'locked'
                  ? styles.createTypeOptionLocked
                  : styles.createTypeOptionLockedTag
            }
          >
            {badgeText}
          </span>
        ) : null}
      </span>
      <span className={styles.createTypeOptionHint}>{hint}</span>
    </span>
    <IoChevronForward className={styles.createTypeOptionChevron} aria-hidden="true" />
  </button>
);

const CreateType: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearState } = useEditorStore();
  const { clearAll } = useGameStore();
  const isMiniProgram = isMiniProgramEnv();
  const optionHint = t('createGame.optionHint');

  const [isIvgToolModalOpen, setIsIvgToolModalOpen] = useState(false);
  const [isMobileTipModalOpen, setIsMobileTipModalOpen] = useState(false);
  const [mobileTipMessage, setMobileTipMessage] = useState('');

  const openMiniProgramTypeTip = (type: Extract<CreatorGameType, 'avg' | 'custom' | 'st' | 'ivg'>) => {
    setMobileTipMessage(getMiniProgramCreatorBlockedMessage(type));
    setIsMobileTipModalOpen(true);
  };

  const handleSelectGameType = async (type: CreatorGameType) => {
    if (isMiniProgram && !isMiniProgramCreatorTypeSupported(type)) {
      if (type === 'avg' || type === 'custom' || type === 'st' || type === 'ivg') {
        openMiniProgramTypeTip(type);
      }
      return;
    }

    clearAll();

    if (type === 'rpg') {
      navigate('/createGame');
    } else if (type === 'txt') {
      clearState();
      navigate('/gameSettingsEditor');
    } else if (type === 'custom') {
      clearState();
      navigate('/customif/create');
    } else if (type === 'st') {
      clearState();
      navigate('/st/create');
    } else if (type === 'avg') {
      clearState();
      try {
        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t('create.defaultAvgGameTitle'), engine: 'AVG' }),
        });
        const data = await resp.json();
        const appId = data?.appId || data?.data?.appId;
        if (!resp.ok || !appId) {
          throw new Error(data?.message || t('create.createAvgFailed'));
        }
        navigate(`/st/create?appId=${encodeURIComponent(appId)}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error || t('create.createAvgFailed'));
        toast.error(message);
      }
    }
  };

  const handleIvgClick = () => {
    if (isMiniProgram) {
      openMiniProgramTypeTip('ivg');
      return;
    }
    setIsIvgToolModalOpen(true);
  };

  return (
    <div className={pageStyles.pageRoot}>
      <Navbar />
      <div className={pageStyles.mainContent}>
        <div className={pageStyles.content}>
          <div className={`${styles.createTypeModalHeader} ${pageStyles.header}`}>
            <div className={`${styles.createTypeModalTitle} ${pageStyles.title}`}>
              {t('createGame.selectGameTypeTitle')}
            </div>
          </div>
          <div className={`${styles.createTypeModalDesc} ${pageStyles.desc}`}>
            {t('createGame.selectGameTypeDesc')}
          </div>
          <div className={`${styles.createTypeOptions} ${pageStyles.options}`}>
            <TypeOptionRow
              title={t('createGame.txtMode')}
              badge="recommend"
              badgeText={t('createGame.recommend')}
              hint={optionHint}
              icon={MdAutoStories}
              thumbClass={styles.createTypeOptionThumbTxt}
              onClick={() => void handleSelectGameType('txt')}
            />
            <TypeOptionRow
              title={t('createGame.avgBeta')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={optionHint}
              icon={HiOutlineUserGroup}
              thumbClass={styles.createTypeOptionThumbAvg}
              onClick={() => void handleSelectGameType('avg')}
            />
            <TypeOptionRow
              title={t('createGame.interactiveVideo')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={optionHint}
              icon={MdOutlineMovie}
              thumbClass={styles.createTypeOptionThumbIvg}
              onClick={handleIvgClick}
            />
            <TypeOptionRow
              title={t('createGame.custom')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={optionHint}
              icon={HiOutlinePuzzle}
              thumbClass={styles.createTypeOptionThumbCustom}
              onClick={() => void handleSelectGameType('custom')}
            />
            <TypeOptionRow
              title="RPG"
              badge="locked"
              badgeText={t('createGame.locked')}
              hint={optionHint}
              icon={MdSportsEsports}
              thumbClass={styles.createTypeOptionThumbRpg}
              disabled
            />
          </div>
        </div>
      </div>
      <MobileBottomNav />

      {isIvgToolModalOpen && (
        <div
          className={styles.createTypeModalOverlay}
          onClick={() => setIsIvgToolModalOpen(false)}
        >
          <div
            className={`${styles.createTypeModal} ${styles.ivgToolModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.createTypeModalHeader}>
              <div className={styles.createTypeModalTitle}>{t('createGame.ivgToolTitle')}</div>
            </div>
            <div className={styles.createTypeModalDesc}>
              {t('createGame.ivgToolDesc')}
            </div>
            <div className={styles.ivgToolActions}>
              <a
                className={`${styles.ivgToolAction} ${styles.ivgToolDownloadAction}`}
                href={IVG_TOOL_DOWNLOAD_URL}
                download={IVG_TOOL_DOWNLOAD_FILE_NAME}
              >
                <FaDesktop className={styles.ivgToolActionIcon} aria-hidden="true" />
                <span>{t('createGame.downloadTool')}</span>
              </a>
              <a
                className={styles.ivgToolAction}
                href={IVG_TUTORIAL_URL}
                target="_blank"
                rel="noreferrer"
              >
                {t('createGame.tutorialGuide')}
              </a>
            </div>
            <div className={styles.createTypeModalFooter}>
              <button
                type="button"
                onClick={() => setIsIvgToolModalOpen(false)}
                className={styles.createTypeCancelButton}
              >
                {t('createGame.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileTipModal
        isOpen={isMobileTipModalOpen}
        onClose={() => setIsMobileTipModalOpen(false)}
        title={t('create.goToPC')}
        message={mobileTipMessage}
        linkUrl={MINI_PROGRAM_CREATOR_PC_URL}
        bindPhoneActionText={t('createGame.bindPhoneFirst')}
        bindPhoneActionHint={t('createGame.bindPhoneTip')}
        onBindPhoneAction={() => {
          setIsMobileTipModalOpen(false);
          navigate('/create?openBrowserLoginAccount=1');
        }}
      />
    </div>
  );
};

export default CreateType;
