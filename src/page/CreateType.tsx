import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import { FaDesktop } from 'react-icons/fa';
import { HiOutlinePuzzle, HiOutlineSpeakerphone, HiOutlineUserGroup } from 'react-icons/hi';
import {
  MdAutoStories,
  MdOutlineMovie,
  MdSportsEsports,
  MdOutlineAutoAwesome,
  MdOutlineApps,
} from 'react-icons/md';
import { IoChevronForward } from 'react-icons/io5';
import toast from 'react-hot-toast';
import styles from '../components/CreateGame/CreateGameModals.module.css';
import pageStyles from './CreateType.module.css';
import AppPageShell from '../components/Layout/AppPageShell';
import MobileTipModal from '../components/CreateGame/MobileTipModal';
import ActivityBannerCarousel from '../components/ActivityBannerCarousel';
import { useEditorStore } from '../store/editorStore';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/useAuthStore';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { auth } from '../api/account/authApi';
import { getApiErrorMessage } from '../utils/error';
import { isCreatorFrozen, isPublishBanned } from '../lib/userPunishment';
import creatorDraftApi from '../api/creator/creatorDraftApi';
import {
  CREATOR_DRAFT_LIMIT,
  formatDraftLimitReachedMessage,
} from '../utils/creatorDraftCapacity';
import {
  getMiniProgramCreatorBlockedMessage,
  isMiniProgramCreatorTypeSupported,
  isMiniProgramEnv,
  MINI_PROGRAM_CREATOR_PC_URL,
  type CreatorGameType,
} from '../utils/miniProgram';
import getGameDataApi from '../api/home/getGameData';
import {
  CREATOR_IDENTITY_LOCKED_HINT,
  isCreatorIdentityActivated,
} from '../lib/creatorIdentity';

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

const ActivityPromoMarquee: React.FC<{ text: string }> = ({ text }) => {
  const promoViewportRef = useRef<HTMLSpanElement>(null);
  const promoTextRef = useRef<HTMLSpanElement>(null);
  const [isPromoOverflowing, setIsPromoOverflowing] = useState(false);

  useEffect(() => {
    const viewport = promoViewportRef.current;
    const promoText = promoTextRef.current;
    if (!viewport || !promoText) return undefined;

    const updateOverflowState = () => {
      setIsPromoOverflowing(promoText.offsetWidth > viewport.clientWidth + 1);
    };

    updateOverflowState();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateOverflowState);
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(promoText);
    window.addEventListener('resize', updateOverflowState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateOverflowState);
    };
  }, [text]);

  return (
    <span ref={promoViewportRef} className={pageStyles.moreActivitiesPromoViewport}>
      <span
        className={`${pageStyles.moreActivitiesPromoTrack} ${
          isPromoOverflowing ? pageStyles.moreActivitiesPromoTrackScrolling : ''
        }`}
      >
        <span ref={promoTextRef} className={pageStyles.moreActivitiesPromoText}>{text}</span>
        {isPromoOverflowing && (
          <span
            className={`${pageStyles.moreActivitiesPromoText} ${pageStyles.moreActivitiesPromoDuplicate}`}
            aria-hidden="true"
          >
            {text}
          </span>
        )}
      </span>
    </span>
  );
};

const CreateType: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearState } = useEditorStore();
  const { clearAll } = useGameStore();
  const updateUser = useAuthStore((s) => s.updateUser);
  const publishBanUntil = useAuthStore((s) => s.user?.user?.publishBanUntil);
  const creatorFrozenFlag = useAuthStore((s) => s.user?.user?.creatorFrozen);
  const publishBanned = isPublishBanned(publishBanUntil);
  const creatorFrozen = isCreatorFrozen(creatorFrozenFlag);
  const createBlocked = publishBanned || creatorFrozen;
  const isMiniProgram = isMiniProgramEnv();
  const optionHint = t('createGame.optionHint');

  const [isIvgToolModalOpen, setIsIvgToolModalOpen] = useState(false);
  const [isMobileTipModalOpen, setIsMobileTipModalOpen] = useState(false);
  const [mobileTipMessage, setMobileTipMessage] = useState('');
  const [draftLimitReached, setDraftLimitReached] = useState(false);
  const [draftCapacityLabel, setDraftCapacityLabel] = useState('');
  /** 功能注释：点「创作游戏」后先选二级：游戏世界 / 玩法 Mod / 手机应用 */
  const [romanceSubOpen, setRomanceSubOpen] = useState(false);
  /** 功能注释：C0.1 创作者身份；null=检测中，未激活时玩法/应用锁定 */
  const [creatorActivated, setCreatorActivated] = useState<boolean | null>(null);
  const [creatorGateOpen, setCreatorGateOpen] = useState(false);

  useEffect(() => {
    void auth.getUserInfo().then((response) => {
      if (response.data.success && response.data.data) {
        updateUser(response.data.data);
      }
    }).catch(() => {
      /* 忽略：仍用 store */
    });
  }, [updateUser]);

  useEffect(() => {
    let cancelled = false;
    void getGameDataApi
      .getUserData({ limit: 200 })
      .then((response) => {
        if (cancelled) return;
        const list = response.data.success && Array.isArray(response.data.data)
          ? response.data.data
          : [];
        setCreatorActivated(isCreatorIdentityActivated(list));
      })
      .catch(() => {
        if (!cancelled) setCreatorActivated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 功能注释：未激活创作者时拦截玩法 Mod / 手机应用，不进半残表单 */
  const openCreatorLockedGate = () => {
    setCreatorGateOpen(true);
    toast.error(CREATOR_IDENTITY_LOCKED_HINT);
  };

  /** 功能注释：游戏世界草稿只在入口 create 一次；门禁「去创作游戏世界」复用同一路径 */
  const startRomanceWorldDraft = async () => {
    setRomanceSubOpen(false);
    setCreatorGateOpen(false);
    clearAll();
    try {
      const response = await creatorDraftApi.createRomance();
      const fileId = response.data.data?.fileId;
      if (!response.data.success || !fileId) {
        throw new Error(response.data.message || '创建草稿失败');
      }
      navigate(`/romance/?createWorld=1&draftId=${encodeURIComponent(fileId)}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '创建草稿失败'));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void creatorDraftApi.getCapacity().then((response) => {
      const capacity = response.data.data;
      if (cancelled || !capacity) return;
      const fullMsg = formatDraftLimitReachedMessage(capacity.count, capacity.limit);
      setDraftCapacityLabel(fullMsg);
      if (capacity.canCreate) return;
      setDraftLimitReached(true);
      // 功能注释：带上 count/limit，避免用户只看到首屏两张草稿卡就以为系统误报
      toast.error(fullMsg);
      navigate('/bookshelf?tab=all', { replace: true });
    }).catch(() => {
      /* 服务端创建接口仍会执行硬性上限校验 */
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const openMiniProgramTypeTip = (type: Extract<CreatorGameType, 'avg' | 'custom' | 'st' | 'ivg'>) => {
    setMobileTipMessage(getMiniProgramCreatorBlockedMessage(type));
    setIsMobileTipModalOpen(true);
  };

  const handleSelectGameType = async (type: CreatorGameType) => {
    if (draftLimitReached) {
      toast.error(
        draftCapacityLabel || formatDraftLimitReachedMessage(CREATOR_DRAFT_LIMIT, CREATOR_DRAFT_LIMIT),
      );
      return;
    }
    if (creatorFrozen) {
      toast.error(t('report.creatorFrozenHint'));
      return;
    }
    if (publishBanned) {
      toast.error(t('report.createBannedHint'));
      return;
    }
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
    } else if (type === 'st' || type === 'avg') {
      // 功能注释：进编辑器前只 create-empty 一次并带上 appId；后续保存只更新，禁止每次保存再 create
      clearState();
      try {
        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t('create.defaultAvgGameTitle'),
            engine: type === 'avg' ? 'AVG' : 'ST',
          }),
        });
        const data = await resp.json();
        const appId = data?.appId || data?.data?.appId;
        if (!resp.ok || !appId) {
          throw new Error(data?.message || t('create.createAvgFailed'));
        }
        try {
          localStorage.setItem('st_draft_appId', String(appId));
        } catch {
          /* ignore */
        }
        navigate(`/st/create?appId=${encodeURIComponent(appId)}`);
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, t('create.createAvgFailed')));
      }
    }
  };

  const handleIvgClick = () => {
    if (creatorFrozen) {
      toast.error(t('report.creatorFrozenHint'));
      return;
    }
    if (publishBanned) {
      toast.error(t('report.createBannedHint'));
      return;
    }
    if (isMiniProgram) {
      openMiniProgramTypeTip('ivg');
      return;
    }
    setIsIvgToolModalOpen(true);
  };

  return (
    <>
    <AppPageShell shellClassName={pageStyles.pageRoot} mainClassName={pageStyles.mainContent}>
        <div className={pageStyles.content}>
          <button
            type="button"
            className={pageStyles.moreActivitiesButton}
            onClick={() => navigate('/promotions')}
            aria-label={t('createGame.moreActivitiesAria')}
            title={t('createGame.moreActivitiesPromo')}
          >
            <span className={pageStyles.moreActivitiesLead}>
              <HiOutlineSpeakerphone className={pageStyles.moreActivitiesIcon} aria-hidden="true" />
              <ActivityPromoMarquee text={t('createGame.moreActivitiesPromo')} />
            </span>
            <span className={pageStyles.moreActivitiesAction}>
              <span>{t('createGame.moreActivities')}</span>
              <IoChevronForward className={pageStyles.moreActivitiesArrow} aria-hidden="true" />
            </span>
          </button>
          <ActivityBannerCarousel />
          <div className={`${styles.createTypeModalHeader} ${pageStyles.header}`}>
            <div className={`${styles.createTypeModalTitle} ${pageStyles.title}`}>
              <span>{t('createGame.selectGameTypeTitle')}</span>
              <button
                type="button"
                className={pageStyles.helpBtn}
                onClick={() => navigate('/document')}
                aria-label={t('createGame.howToStart')}
                title={t('createGame.howToStart')}
              >
                ?
              </button>
            </div>
          </div>
          {createBlocked ? (
            <p className={pageStyles.banHint}>
              {creatorFrozen ? t('report.creatorFrozenHint') : t('report.createBannedHint')}
            </p>
          ) : null}
          <div className={`${styles.createTypeOptions} ${pageStyles.options}`}>
            <TypeOptionRow
              title={t('createGame.txtMode')}
              badge="recommend"
              badgeText={t('createGame.recommend')}
              hint={optionHint}
              icon={MdAutoStories}
              thumbClass={styles.createTypeOptionThumbTxt}
              disabled={createBlocked}
              onClick={() => void handleSelectGameType('txt')}
            />
            {/* 功能注释：创作游戏先开二级（游戏世界 / 玩法 Mod / 手机应用）；「创作应用」不再并列 */}
            <TypeOptionRow
              title={t('createGame.romanceMode')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={t('createGame.romanceHint')}
              icon={MdOutlineAutoAwesome}
              thumbClass={styles.createTypeOptionThumbRomance}
              disabled={createBlocked || draftLimitReached}
              onClick={() => {
                if (createBlocked || draftLimitReached) return;
                setRomanceSubOpen(true);
              }}
            />
            <TypeOptionRow
              title={t('createGame.avgBeta')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={optionHint}
              icon={HiOutlineUserGroup}
              thumbClass={styles.createTypeOptionThumbAvg}
              disabled={createBlocked}
              onClick={() => void handleSelectGameType('avg')}
            />
            <TypeOptionRow
              title={t('createGame.interactiveVideo')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={optionHint}
              icon={MdOutlineMovie}
              thumbClass={styles.createTypeOptionThumbIvg}
              disabled={createBlocked}
              onClick={handleIvgClick}
            />
            <TypeOptionRow
              title={t('createGame.custom')}
              badge="new"
              badgeText={t('createGame.new')}
              hint={optionHint}
              icon={HiOutlinePuzzle}
              thumbClass={styles.createTypeOptionThumbCustom}
              disabled={createBlocked}
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
    </AppPageShell>

      {romanceSubOpen && (
        <div
          className={styles.createTypeModalOverlay}
          onClick={() => setRomanceSubOpen(false)}
        >
          <div
            className={`${styles.createTypeModal} ${pageStyles.romanceSubModal}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="romance-sub-title"
          >
            <div className={styles.createTypeModalHeader}>
              <div id="romance-sub-title" className={styles.createTypeModalTitle}>
                {t('createGame.romanceMode')}
              </div>
            </div>
            {/* 功能注释：SDK 归平台维护；创作者只交世界草稿 / 玩法包 / 应用草稿，入口说明不得暗示自有 SDK */}
            <div className={styles.createTypeModalDesc}>
              选择要创作的类型。游戏世界走现有逻辑。玩法 Mod 和手机应用用对话生成，都运行在平台 SDK 上。
            </div>
            <div className={`${styles.createTypeOptions} ${pageStyles.romanceSubOptions}`}>
              <TypeOptionRow
                title="游戏世界"
                hint="填写设定，AI 搭建世界，再进编辑器细调。"
                icon={MdOutlineAutoAwesome}
                thumbClass={styles.createTypeOptionThumbRomance}
                onClick={() => {
                  void startRomanceWorldDraft();
                }}
              />
              <TypeOptionRow
                title="玩法 Mod"
                badge={creatorActivated === false ? 'locked' : undefined}
                badgeText={creatorActivated === false ? '锁定' : undefined}
                hint="对话生成玩法叠加包。可以是新地点、游戏内页面，或填进已有玩法格子的数据。可绑多个游戏世界，也可分多次安装。用平台 SDK。"
                icon={HiOutlinePuzzle}
                thumbClass={styles.createTypeOptionThumbCustom}
                onClick={() => {
                  // 功能注释：锁定仍可点，弹出过审解锁提示，禁止静默进半残页
                  if (creatorActivated === false) {
                    openCreatorLockedGate();
                    return;
                  }
                  if (creatorActivated == null) return;
                  setRomanceSubOpen(false);
                  clearAll();
                  navigate('/romance/?createPlayMod=1');
                }}
              />
              {/* 功能注释：C2.3 我的玩法 Mod 稳定入口；只看本人记录，未激活创作者同样拦截 */}
              <TypeOptionRow
                title="我的玩法 Mod"
                badge={creatorActivated === false ? 'locked' : undefined}
                badgeText={creatorActivated === false ? '锁定' : undefined}
                hint="查看自己的草稿、私有测试和已上架玩法包，继续编辑或上传 .kkmod 玩法包。"
                icon={HiOutlinePuzzle}
                thumbClass={styles.createTypeOptionThumbCustom}
                onClick={() => {
                  if (creatorActivated === false) {
                    openCreatorLockedGate();
                    return;
                  }
                  if (creatorActivated == null) return;
                  setRomanceSubOpen(false);
                  navigate('/create/play-mods');
                }}
              />
              <TypeOptionRow
                title="手机应用"
                badge={creatorActivated === false ? 'locked' : undefined}
                badgeText={creatorActivated === false ? '锁定' : undefined}
                hint="对话生成应用草稿，审核通过后上架，供游戏世界里的手机安装。用平台 SDK。"
                icon={MdOutlineApps}
                thumbClass={styles.createTypeOptionThumbCustom}
                onClick={() => {
                  if (creatorActivated === false) {
                    openCreatorLockedGate();
                    return;
                  }
                  if (creatorActivated == null) return;
                  setRomanceSubOpen(false);
                  navigate('/create/app');
                }}
              />
            </div>
            <div className={styles.createTypeModalFooter}>
              <button
                type="button"
                onClick={() => setRomanceSubOpen(false)}
                className={styles.createTypeCancelButton}
              >
                {t('createGame.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

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
          navigate('/profile?openBrowserLoginAccount=1');
        }}
      />

      {/* 功能注释：C0.1 未激活创作者点玩法/应用时的门禁提示；可关回选择页或去创作游戏世界 */}
      {creatorGateOpen && (
        <div
          className={styles.createTypeModalOverlay}
          onClick={() => setCreatorGateOpen(false)}
        >
          <div
            className={styles.createTypeModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-gate-title"
          >
            <div className={styles.createTypeModalHeader}>
              <div id="creator-gate-title" className={styles.createTypeModalTitle}>
                需要创作者身份
              </div>
            </div>
            <div className={styles.createTypeModalDesc}>{CREATOR_IDENTITY_LOCKED_HINT}</div>
            <div className={styles.createTypeModalFooter}>
              <button
                type="button"
                onClick={() => setCreatorGateOpen(false)}
                className={styles.createTypeCancelButton}
              >
                关闭
              </button>
              <button
                type="button"
                className={`${styles.createTypeCancelButton} ${styles.ivgToolDownloadAction}`}
                onClick={() => {
                  void startRomanceWorldDraft();
                }}
              >
                去创作游戏世界
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateType;
