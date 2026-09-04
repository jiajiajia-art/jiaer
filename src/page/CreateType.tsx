import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaDesktop } from 'react-icons/fa';
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

/** 选择需创建游戏类型（独立页，非模态框） */
const CreateType: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearState } = useEditorStore();
  const { clearAll } = useGameStore();
  const isMiniProgram = isMiniProgramEnv();

  const [isIvgToolModalOpen, setIsIvgToolModalOpen] = useState(false);
  const [isMobileTipModalOpen, setIsMobileTipModalOpen] = useState(false);
  const [mobileTipMessage, setMobileTipMessage] = useState('');

  const goBack = () => {
    navigate('/create');
  };

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

  const handleAvgClick = () => {
    if (isMiniProgram) {
      openMiniProgramTypeTip('avg');
      return;
    }
    void handleSelectGameType('avg');
  };

  const handleCustomClick = () => {
    if (isMiniProgram) {
      openMiniProgramTypeTip('custom');
      return;
    }
    void handleSelectGameType('custom');
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
        <div className={pageStyles.panel}>
          <div className={styles.createTypeModalHeader}>
            <div className={styles.createTypeModalTitle}>{t('createGame.selectGameTypeTitle')}</div>
          </div>
          <div className={styles.createTypeModalDesc}>
            {t('createGame.selectGameTypeDesc')}
          </div>
          <div className={styles.createTypeOptions}>
            <button
              type="button"
              className={styles.createTypeOption}
              onClick={() => void handleSelectGameType('txt')}
            >
              <span>{t('createGame.txtMode')}</span>
              <span className={styles.createTypeOptionRecommend}>{t('createGame.recommend')}</span>
            </button>
            <button
              type="button"
              className={styles.createTypeOption}
              onClick={handleAvgClick}
            >
              <span>{t('createGame.avgBeta')}</span>
              <span className={styles.createTypeOptionLockedTag}>{t('createGame.new')}</span>
            </button>
            <button
              type="button"
              className={styles.createTypeOption}
              onClick={handleIvgClick}
            >
              <span>{t('createGame.interactiveVideo')}</span>
              <span className={styles.createTypeOptionRecommend}>{t('createGame.new')}</span>
            </button>
            <button
              type="button"
              className={styles.createTypeOption}
              onClick={handleCustomClick}
            >
              <span>{t('createGame.custom')}</span>
              <span className={styles.createTypeOptionRecommend}>{t('createGame.new')}</span>
            </button>
            <button
              type="button"
              className={`${styles.createTypeOption} ${styles.createTypeOptionDisabled}`}
              disabled
            >
              <span>RPG</span>
              <span className={styles.createTypeOptionLocked}>{t('createGame.locked')}</span>
            </button>
          </div>
          <div className={styles.createTypeModalFooter}>
            <button
              type="button"
              onClick={goBack}
              className={styles.createTypeCancelButton}
            >
              {t('createGame.cancel')}
            </button>
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
