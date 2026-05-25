import { CiLocationOn } from "react-icons/ci";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/gameStore";
import { BiHistory } from "react-icons/bi";
import { LuFileText } from "react-icons/lu";
import { RiLogoutCircleRLine } from "react-icons/ri";
import { MdOutlineAutoStories } from "react-icons/md";
import { MdContentCopy, MdMemory, MdPlayCircleOutline, MdSettings, MdOutlineAssessment, MdReplay, MdTimeline } from "react-icons/md";
import StoryIntroModal from "../components/Galgame/StoryIntroModal";
import NormalModeDisplay from "../components/Galgame/NormalModeDisplay";
import { useCharacterAnimation } from "../hooks/galgame/useCharacterAnimation";
import CharacterLayer from "../components/Galgame/CharacterLayer";
import { useMusicPlayer } from "../hooks/mapGalgame/useMusicPlayer";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
import TextModeDisplay from "../components/Galgame/TextModeDisplay";
import SettingsModal from "../components/Galgame/SettingsModal";
import ErrorModal from "../components/GalgameMap/Modal/WorldModal";
import { useGalgameController } from "../hooks/galgame/useGalgameController";
import toast from "react-hot-toast";
import FullPageLoading from "../components/Skeleton/FullPageLoading";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import GameBackgroundRenderer from "../components/Galgame/GameBackgroundRenderer";
import { useLocation, useNavigate } from "react-router-dom";
import GameAction from "../api/rpgGame/gameAction";
import ShareReplayModal from "../components/Galgame/ShareReplayModal";
import replayModalStyles from "../components/Galgame/ShareReplayModal.module.css";
import replayApi, { buildReplayShareUrl } from "../api/galgame/replay";
import ServerAttributesPanel from "../components/Galgame/ServerAttributesPanel";
import SaveModal from "../components/Galgame/SaveModal";
import LoadSaveListModal from "../components/CreateGame/LoadSaveListModal";
import SavePreviewModal from "../components/CreateGame/SavePreviewModal";
import type { SaveSummaryItem } from "../api/galgame/saves";
import betaWhitelistApi from "../api/galgame/betaWhitelist";
import GameConfirmModal from "../components/Galgame/GameConfirmModal";
import { useGameDurationTracking } from "../hooks/useGameDurationTracking";
import { logVisualButtonClick } from "../api/statistics/scriptButtonEvent";
import type { AxiosError } from "axios";
import {
    beginHorizontalDrag,
    createInitialHorizontalDragState,
    DESKTOP_MEDIA_QUERY,
    getNextHorizontalScrollLeft,
    getNextHorizontalWheelScrollLeft,
    hasExceededHorizontalDragThreshold,
    type HorizontalDragState,
} from "./galgameControlBarDrag";

const Galgame = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { fileId, sessionId, galgameBetaAttributes, setGalgameBetaAttributes } = useGameStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isReplayControlsOpen, setIsReplayControlsOpen] = useState(false);
    const [isAttributesOpen, setIsAttributesOpen] = useState(false);
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [defaultSaveMode, setDefaultSaveMode] = useState<'create' | 'overwrite' | undefined>(() => {
        const saveEntry = (location.state as { saveEntry?: string } | null)?.saveEntry;
        return saveEntry === 'load' ? undefined : 'create';
    });
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [createdReplayShare, setCreatedReplayShare] = useState<{
        visibility: 'public' | 'unlisted';
        shareUrl: string;
    } | null>(null);
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    const buttonBarDragStateRef = useRef<HorizontalDragState>(createInitialHorizontalDragState());
    const [isDesktopButtonBarInteraction, setIsDesktopButtonBarInteraction] = useState(false);
    const [isButtonBarDragging, setIsButtonBarDragging] = useState(false);

    // 使用统一的控制器 hook
    const controller = useGalgameController();

    // 自动追踪游戏时长（监听页面可见性变化和页面卸载）
    useGameDurationTracking(!controller.isReplay ? (fileId || undefined) : undefined);

    useEffect(() => {
        setIsReplayControlsOpen(false);
    }, [controller.isReplay, location.key]);

    // 刷新/直进页面时的兜底：如果未检测过白名单，则尝试拉取一次
    useEffect(() => {
        const run = async () => {
            try {
                if (controller.isReplay) return;
                if (!fileId) return;
                if (galgameBetaAttributes !== null) return;
                const resp = await betaWhitelistApi.get(fileId);
                const enabled = !!resp.data?.whitelisted;
                setGalgameBetaAttributes(enabled);
            } catch {
                setGalgameBetaAttributes(false);
            }
        };
        run();
    }, [controller.isReplay, fileId, galgameBetaAttributes, setGalgameBetaAttributes]);

    // 根据进入来源初始化默认保存模式：
    // 读取存档进入 -> 让用户选择新建/覆盖；其余入口 -> 直接新建。
    useEffect(() => {
        const saveEntry = (location.state as { saveEntry?: string } | null)?.saveEntry;
        setDefaultSaveMode(saveEntry === 'load' ? undefined : 'create');
    }, [location.key, location.state]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
        const syncDesktopInteraction = () => {
            setIsDesktopButtonBarInteraction(mediaQuery.matches);
        };

        syncDesktopInteraction();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', syncDesktopInteraction);
            return () => {
                mediaQuery.removeEventListener('change', syncDesktopInteraction);
            };
        }

        mediaQuery.addListener(syncDesktopInteraction);
        return () => {
            mediaQuery.removeListener(syncDesktopInteraction);
        };
    }, []);

    // 处理历史按钮点击（切换显示/隐藏）
    const handleHistoryClick = () => {
        logVisualButtonClick('history');
        if (controller.showGalgameHistory) {
            controller.setShowGalgameHistory(false);
        } else {
            controller.refreshHistory();
            controller.setShowGalgameHistory(true);
        }
    };

    // 处理文本模式切换
    const handleTextModeToggle = () => {
        logVisualButtonClick('text');
        // 如果历史弹窗打开，先关闭它
        if (controller.showGalgameHistory) {
            controller.setShowGalgameHistory(false);
        }
        const newTextMode = !controller.isTextMode;
        controller.setIsTextMode(newTextMode);
    };

    // 处理重新生成
    const handleRegenerate = (messageIndex: number) => {
        logVisualButtonClick('history_regenerate');
        controller.setShowGalgameHistory(false);
        controller.resetDisplayedSteps();
        controller.stepHandlers.handleRegenerate(messageIndex, {
            onError: (error) => {
                toast.error(error || t('galgame.regenerateFailed'));
            }
        });
    };

    const currentAssistantHistoryIndex = useMemo(() => {
        if (controller.isReplay || controller.isTextMode || controller.stepHandlers.isWaitingForData) {
            return null;
        }
        if (!controller.currentMessage || controller.currentMessage.type === 'choice') {
            return null;
        }

        for (let i = controller.history.length - 1; i >= 0; i -= 1) {
            const item = controller.history[i];
            if (item?.role === 'assistant' && Number.isFinite(item.absoluteIndex)) {
                return item.absoluteIndex + 1;
            }
        }

        return null;
    }, [
        controller.currentMessage,
        controller.history,
        controller.isReplay,
        controller.isTextMode,
        controller.stepHandlers.isWaitingForData,
    ]);

    const contextMemoryPercent = useMemo(() => {
        const status = controller.contextMemory;
        const totalTokens = status?.thresholdTokens || status?.safePromptBudgetTokens || status?.modelContextWindow;
        if (!status?.modelContextWindowConfigured || !totalTokens) {
            return 0;
        }
        return Math.min(999, Math.max(0, Math.round((status.estimatedTokens / totalTokens) * 100)));
    }, [controller.contextMemory]);
    const formatContextTokenCount = (value?: number | null) => {
        const n = Number(value || 0);
        if (!Number.isFinite(n) || n <= 0) {
            return '0';
        }
        if (n < 1000) {
            return String(Math.ceil(n));
        }
        if (n < 10000) {
            return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
        }
        return `${Math.round(n / 1000)}k`;
    };
    const contextMemoryUsedLabel = formatContextTokenCount(controller.contextMemory?.estimatedTokens);
    const contextMemoryTotalLabel = controller.contextMemory?.modelContextWindowConfigured
        ? formatContextTokenCount(controller.contextMemory?.thresholdTokens || controller.contextMemory?.safePromptBudgetTokens || controller.contextMemory?.modelContextWindow)
        : '未配置';
    const totalStoryRounds = Math.floor(Number(controller.historyTotal || 0) / 2);
    const memoryCycleRounds = Math.max(0, Math.floor(Number(controller.contextMemory?.turnsSinceCompression || 0)));
    const memoryCycleLimit = Math.max(0, Math.floor(Number(controller.contextMemory?.safeRoundLimit || 0)));
    const memoryCycleLabel = memoryCycleLimit > 0
        ? `${memoryCycleRounds}/${memoryCycleLimit}`
        : String(memoryCycleRounds);
    const memoryDebugCurrent = controller.memoryDebugData?.current || null;
    const memoryDebugHistory = controller.memoryDebugData?.history || [];
    const memoryDebugStructured = memoryDebugCurrent?.structured
        ? JSON.stringify(memoryDebugCurrent.structured, null, 2)
        : '{}';

    const handleCurrentMessageRegenerate = () => {
        if (!currentAssistantHistoryIndex) {
            return;
        }
        handleRegenerate(currentAssistantHistoryIndex);
    };

    const characterAnimation = useCharacterAnimation({
        message: controller.currentMessage?.message,
        messageType: controller.currentMessage?.type,
    });

    const { isMusicPlaying, handleMusicToggle, volume, setVolume } = useMusicPlayer({
        presetId: fileId || '',
        currentScene: controller.currentScene,
        gameStarted: controller.gameStarted,
        isLoading: controller.isLoading,
    });

    // 退出/删除统一回到上一个页面（或兜底首页）
    const navigateBackSafe = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/home');
        }

    };
    const handleDeleteSessionInGame = async () => {
        setIsDeleteConfirmOpen(true);
    };

    const finishButtonBarDragging = (currentTarget?: HTMLDivElement, pointerId?: number) => {
        const activePointerId = pointerId ?? buttonBarDragStateRef.current.pointerId;
        const hadCaptured = buttonBarDragStateRef.current.hasCaptured;

        if (!buttonBarDragStateRef.current.isDragging && buttonBarDragStateRef.current.pointerId === null) {
            return;
        }

        buttonBarDragStateRef.current.isDragging = false;
        buttonBarDragStateRef.current.pointerId = null;
        buttonBarDragStateRef.current.hasCaptured = false;
        window.setTimeout(() => {
            buttonBarDragStateRef.current.moved = false;
        }, 0);
        setIsButtonBarDragging(false);

        if (hadCaptured && activePointerId !== null && currentTarget?.hasPointerCapture(activePointerId)) {
            currentTarget.releasePointerCapture(activePointerId);
        }
    };

    const handleButtonBarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopButtonBarInteraction || event.pointerType !== 'mouse' || event.button !== 0 || !buttonContainerRef.current) {
            return;
        }

        buttonBarDragStateRef.current = beginHorizontalDrag(
            event.pointerId,
            event.clientX,
            buttonContainerRef.current.scrollLeft,
        );
    };

    const handleButtonBarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (
            !isDesktopButtonBarInteraction ||
            buttonBarDragStateRef.current.pointerId !== event.pointerId ||
            !buttonBarDragStateRef.current.isDragging ||
            !buttonContainerRef.current
        ) {
            return;
        }

        if (hasExceededHorizontalDragThreshold(buttonBarDragStateRef.current, event.clientX)) {
            buttonBarDragStateRef.current.moved = true;
            setIsButtonBarDragging(true);

            if (!buttonBarDragStateRef.current.hasCaptured) {
                event.currentTarget.setPointerCapture(event.pointerId);
                buttonBarDragStateRef.current.hasCaptured = true;
            }
        }

        if (!buttonBarDragStateRef.current.moved) {
            return;
        }

        buttonContainerRef.current.scrollLeft = getNextHorizontalScrollLeft(
            buttonBarDragStateRef.current,
            event.clientX,
        );
        event.preventDefault();
    };

    const handleButtonBarPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopButtonBarInteraction || buttonBarDragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        finishButtonBarDragging(event.currentTarget, event.pointerId);
    };

    const handleButtonBarPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopButtonBarInteraction || buttonBarDragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        finishButtonBarDragging(event.currentTarget, event.pointerId);
    };

    const handleButtonBarLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopButtonBarInteraction || buttonBarDragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        finishButtonBarDragging();
    };

    const handleButtonBarClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!buttonBarDragStateRef.current.moved) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    };

    const handleButtonBarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const buttonContainer = buttonContainerRef.current;
        if (!buttonContainer) {
            return;
        }

        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        const maxScrollLeft = buttonContainer.scrollWidth - buttonContainer.clientWidth;
        if (maxScrollLeft <= 0) {
            return;
        }

        const nextScrollLeft = getNextHorizontalWheelScrollLeft(
            buttonContainer.scrollLeft,
            event.deltaY,
            maxScrollLeft,
        );

        if (nextScrollLeft === buttonContainer.scrollLeft) {
            return;
        }

        buttonContainer.scrollLeft = nextScrollLeft;
        event.preventDefault();
    };

    const handleButtonBarDragStartCapture = (event: React.DragEvent<HTMLDivElement>) => {
        if (!isDesktopButtonBarInteraction) {
            return;
        }

        event.preventDefault();
    };

    const handleConfirmDeleteSession = async () => {
        logVisualButtonClick("settings_restart");
        const userId = user?.user?.id;
        if (!userId || !fileId) {
            toast.error(t('galgame.cannotDeleteSave'));
            return;
        }

        try {
            const response = await GameAction.deletGameSession({ fileId });
            if (response.data.success) {
                toast.success(t('galgame.deleteSuccess'));
                navigateBackSafe();
            } else {
                toast.error(response.data.message || t('galgame.deleteFailed'));
            }
        } catch (error) {
            console.error('删除存档失败:', error);
            toast.error(t('galgame.tryAgainLater'));
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };

    const copyTextToClipboard = async (text: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                console.warn('[Replay] Failed to copy replay link with clipboard API:', error);
            }
        }

        if (typeof document === 'undefined') {
            return false;
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', 'true');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            return document.execCommand('copy');
        } catch (error) {
            console.warn('[Replay] Failed to copy replay link with fallback:', error);
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    };

    const handleCopyCreatedReplayLink = async () => {
        if (!createdReplayShare) {
            return;
        }

        const copied = await copyTextToClipboard(createdReplayShare.shareUrl);
        if (!copied) {
            toast.error(t('galgame.copyReplayFailed'));
            return;
        }

        if (createdReplayShare.visibility === 'unlisted') {
            toast.success(t('galgame.replayLinkCopied'));
            return;
        }

            toast.success(t('galgame.publicReplayCopied'));
    };

    const handleCopyMemoryDebugText = async (text: string, successMessage: string) => {
        if (!text.trim()) {
            return;
        }

        const copied = await copyTextToClipboard(text);
        if (!copied) {
            toast.error('复制失败');
            return;
        }

        toast.success(successMessage);
    };

    const handleShareReplay = async ({ title, description, visibility }: { title: string; description?: string; visibility: 'public' | 'unlisted' | 'private' }) => {
        logVisualButtonClick('share_replay_create');
        if (!sessionId || !fileId) {
            toast.error(t('galgame.sessionNotFound'));
            return;
        }
        try {
            const resp = await replayApi.createFromSession({ sessionId, fileId, title, description, visibility });
            const replayId = resp.data?.replayId;
            if (resp.data?.success && replayId) {
                const shareUrl = buildReplayShareUrl(replayId);
                setIsShareOpen(false);

                if (visibility === 'private') {
                    setCreatedReplayShare(null);
                    toast.success(t('galgame.replayCreatedPrivate'));
                    return;
                }

                setCreatedReplayShare({ visibility, shareUrl });
            } else {
                toast.error(t('galgame.createReplayFailed'));
            }
        } catch (error) {
            const axiosError = error as AxiosError<{ code?: string; message?: string }>;
            const errorCode = axiosError.response?.data?.code;

            if (errorCode === 'REPLAY_TITLE_CONFLICT') {
                toast.error(t('galgame.duplicateReplayTitle'));
                return;
            }

            if (errorCode === 'GENERATION_IN_PROGRESS') {
                toast.error(t('galgame.generationInProgress'));
                return;
            }

            toast.error('创建回放失败');
        }
    };

    const renderErrorModal = (
        visible: boolean,
        title: string,
        message: string,
        options: {
            confirmText: string;
            cancelText?: string;
            primaryType?: "confirm" | "cancel";
            onConfirm: () => void;
            onCancel?: () => void;
        }
    ) => (
        <ErrorModal
            visible={visible}
            title={title}
            message={message}
            confirmText={options.confirmText}
            cancelText={options.cancelText}
            primaryType={options.primaryType}
            onConfirm={options.onConfirm}
            onCancel={options.onCancel}
        />
    );

    if (controller.isLoading) {
        return (
            <FullPageLoading
                rootClassName={styles.pageRoot}
                contentClassName={styles.mainContent}
            />
        );
    }

    return (
        <>
            <div className={styles.pageRoot}>
                <div
                    className={`${styles.mainContent} ${characterAnimation === 'injury' ? styles.worldInjury : ''}`}
                    style={{
                        backgroundColor: controller.isTextMode ? '#000' : 'transparent',
                        position: 'relative',
                    }}
                >
                    {!controller.isTextMode && (
                        <GameBackgroundRenderer
                            src={controller.backgroundImage}
                            className={styles.gameBackground}
                            useCanvas={true}
                            transitionDuration={300}
                        />
                    )}
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
                    <div id="custom-ui-root" className={styles.customUIRoot}></div>
                    <div className={`${styles.topHeader} ${controller.isTextMode ? styles.topHeaderTextMode : ''}`}>
                        <CiLocationOn />
                        <span>{controller.currentScene?.name}</span>
                    </div>
                    {!controller.isReplay && controller.gameStarted && (
                        <div className={styles.contextMemoryMeter}>
                            <div className={styles.contextMemoryTextGroup}>
                                <span className={styles.contextMemoryText}>
                                    已用 {contextMemoryUsedLabel} 标记，共 {contextMemoryTotalLabel}
                                </span>
                                {controller.contextMemoryDebugEnabled && (
                                    <span className={styles.contextMemoryRoundText}>
                                        总剧情轮次 {totalStoryRounds}，本周期轮次 {memoryCycleLabel}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`${styles.contextMemoryProgress} ${controller.stepHandlers.isCompressingContext ? styles.contextMemoryProgressActive : ''}`}
                                style={{
                                    background: `conic-gradient(rgba(255, 255, 255, 0.92) ${Math.min(contextMemoryPercent, 100) * 3.6}deg, rgba(255, 255, 255, 0.24) 0deg)`
                                }}
                            />
                            {controller.stepHandlers.isCompressingContext && (
                                <span className={styles.contextMemoryBusy}>整理中</span>
                            )}
                        </div>
                    )}
                    {controller.currentMessage.characterImage && !controller.isTextMode && (
                        <CharacterLayer
                            characterImage={controller.currentMessage.characterImage}
                            characterPosition={controller.currentMessage.characterPosition}
                            portraitScale={controller.currentMessage.portraitScale}
                            portraitOffsetX={controller.currentMessage.portraitOffsetX}
                            portraitOffsetY={controller.currentMessage.portraitOffsetY}
                            animation={characterAnimation}
                        />
                    )}
                    <div className={`${styles.gameContentWrapper} ${controller.isTextMode ? styles.gameContentWrapperTextMode : ''}`}>
                        {!controller.showGalgameHistory && !controller.isTextMode && (
                            <>
                                <NormalModeDisplay
                                    currentMessage={controller.currentMessage}
                                    finalDisplayText={controller.finalDisplayText}
                                    finalIsTyping={controller.finalIsTyping}
                                    canRegenerateCurrentMessage={currentAssistantHistoryIndex !== null}
                                    stepHandlers={{
                                        isWaitingForData: controller.stepHandlers.isWaitingForData,
                                        isCompressingContext: controller.stepHandlers.isCompressingContext,
                                        currentStep: controller.stepHandlers.currentStep,
                                        showNextButton: controller.stepHandlers.showNextButton,
                                        selectedOptionIndex: controller.stepHandlers.selectedOptionIndex,
                                    }}
                                    isAutoPlay={controller.isAutoPlay}
                                    historyLength={controller.history.length}
                                    onNextMessage={controller.handleNextMessage}
                                    onRegenerateCurrentMessage={handleCurrentMessageRegenerate}
                                    onChoiceClick={controller.handleChoiceClick}
                                    onCustomInputSubmit={(value) => controller.handleCustomInputSubmit(value)}
                                    isFreeRound={controller.isFreeRound}
                                />
                            </>
                        )}
                        {!controller.showGalgameHistory && controller.isTextMode && (
                            <TextModeDisplay
                                steps={controller.convertStepsToTextModalFormat(controller.allStepsForTextModal)}
                                currentStepIndex={controller.currentStepIndex}
                                currentDisplayText={controller.textModalDisplayText}
                                isTyping={controller.finalIsTyping}
                                isWaitingForData={controller.stepHandlers.isWaitingForData}
                                isCompressingContext={controller.stepHandlers.isCompressingContext}
                                historyLength={controller.history.length}
                                onChoiceClick={(option) => {
                                    controller.handleChoiceClick(option);
                                }}
                                onCustomInputSubmit={(value) => {
                                    controller.handleCustomInputSubmit(value);
                                }}
                                isFreeRound={controller.isFreeRound}
                            />
                        )}
                    </div>
                    {/* 顶部右侧：属性按钮（内测白名单） */}
                    {!controller.isReplay && galgameBetaAttributes && controller.gameStarted ? (
                        <div className={styles.topButtonsContainer}>
                            <div
                                className={`${styles.buttonItem} ${isAttributesOpen ? styles.buttonItemActive : ''}`}
                                onClick={() => setIsAttributesOpen((p) => !p)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <MdOutlineAssessment />
                                    <span>{t('galgame.attributes')}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}


                    {controller.isReplay && isReplayControlsOpen && (
                        <div className={styles.replayControlBar}>
                            <div className={styles.replayProgressHeader}>
                                <span>{t('galgame.progress')}</span>
                                <span>
                                    {controller.replayStepsCount > 0
                                        ? `${controller.replayIndex + 1}/${controller.replayStepsCount}`
                                        : '0/0'}
                                </span>
                            </div>
                            <input
                                className={styles.replayProgressRange}
                                type="range"
                                min={0}
                                max={Math.max(controller.replayStepsCount - 1, 0)}
                                step={1}
                                value={Math.min(controller.replayIndex, Math.max(controller.replayStepsCount - 1, 0))}
                                disabled={controller.replayStepsCount <= 1}
                                onChange={(event) => {
                                    controller.handleReplaySeek(Number(event.currentTarget.value));
                                }}
                                aria-label="Replay progress"
                            />
                            <div className={styles.replaySpeedRow}>
                                <span className={styles.replaySpeedLabel}>{t('galgame.autoPlaySpeed')}</span>
                                <div className={styles.replaySpeedOptions}>
                                    {controller.replaySpeedOptions.map((speed) => (
                                        <button
                                            key={speed}
                                            type="button"
                                            className={`${styles.replaySpeedButton} ${controller.replaySpeed === speed ? styles.replaySpeedButtonActive : ''}`}
                                            onClick={() => controller.handleReplaySpeedChange(speed)}
                                        >
                                            {speed}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 按钮栏移到 mainContent 内，与历史弹窗同级，确保显示在弹窗之上 */}
                    <div
                        ref={buttonContainerRef}
                        className={`${styles.buttonContainer} ${isButtonBarDragging ? styles.buttonContainerDragging : ''}`}
                        onPointerDown={handleButtonBarPointerDown}
                        onPointerMove={handleButtonBarPointerMove}
                        onPointerUp={handleButtonBarPointerUp}
                        onPointerCancel={handleButtonBarPointerCancel}
                        onLostPointerCapture={handleButtonBarLostPointerCapture}
                        onClickCapture={handleButtonBarClickCapture}
                        onDoubleClickCapture={handleButtonBarClickCapture}
                        onWheel={handleButtonBarWheel}
                        onDragStartCapture={handleButtonBarDragStartCapture}
                    >
                        {!controller.isReplay && (
                            <div className={styles.buttonItem}>
                                <div className={styles.buttonInner}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="积分" />
                                    <span>{user?.user?.points}</span>
                                </div>
                            </div>
                        )}
                        {/* 存档按钮（仅非回放模式显示） */}
                        {!controller.isReplay && (
                            <div
                                className={styles.buttonItem}
                                onClick={() => {
                                    // 保持当前来源对应的保存模式（来源由路由 state 决定）
                                    setIsSaveOpen(true);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <MdOutlineAssessment />
                                    <span>{t('galgame.save')}</span>
                                </div>
                            </div>
                        )}
                        {!controller.isReplay && (
                            <div
                                className={`${styles.buttonItem} ${controller.showGalgameHistory ? styles.buttonItemActive : ''}`}
                                onClick={handleHistoryClick}
                            >
                                <div className={styles.buttonInner}>
                                    <BiHistory />
                                    <span>{t('galgame.history')}</span>
                                </div>
                            </div>
                        )}
                        {!controller.isReplay && controller.gameStarted && (
                            <div
                                className={`${styles.buttonItem} ${isShareOpen ? styles.buttonItemActive : ''}`}
                                onClick={() => {
                                    logVisualButtonClick('share_replay');
                                    setIsShareOpen(true);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <MdReplay />
                                    <span>{t('galgame.replay')}</span>
                                </div>
                            </div>
                        )}
                        {controller.isReplay && (
                            <div
                                className={`${styles.buttonItem} ${isReplayControlsOpen ? styles.buttonItemActive : ''}`}
                                onClick={() => {
                                    setIsReplayControlsOpen((prev) => !prev);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <MdTimeline />
                                    <span>{t('galgame.progress')}</span>
                                </div>
                            </div>
                        )}
                        <div
                            className={`${styles.buttonItem} ${controller.isTextMode ? styles.buttonItemActive : ''}`}
                            onClick={handleTextModeToggle}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.buttonInner}>
                                <LuFileText />
                                    <span>{t('galgame.text')}</span>
                            </div>
                        </div>
                        <div
                            className={`${styles.buttonItem} ${controller.isAutoPlay ? styles.buttonItemActive : ''} ${controller.isTextMode || controller.showGalgameHistory ? styles.buttonItemDisabled : ''}`}
                            onClick={
                                controller.isTextMode || controller.showGalgameHistory
                                    ? undefined
                                    : () => {
                                        logVisualButtonClick("auto");
                                        controller.handleAutoPlayToggle();
                                    }
                            }
                            style={{ cursor: controller.isTextMode || controller.showGalgameHistory ? 'not-allowed' : 'pointer' }}
                        >
                            <div className={styles.buttonInner}>
                                <MdOutlineAutoStories />
                                    <span>{t('galgame.auto')}</span>
                            </div>
                        </div>
                        {controller.contextMemoryDebugEnabled && !controller.isReplay && (
                            <div
                                className={`${styles.buttonItem} ${controller.memoryDebugOpen ? styles.buttonItemActive : ''}`}
                                onClick={() => {
                                    void controller.openContextMemoryDebug();
                                }}
                                style={{ cursor: 'pointer' }}
                                title="记忆调试"
                            >
                                <div className={styles.buttonInner}>
                                    <MdMemory />
                                    <span>记忆</span>
                                </div>
                            </div>
                        )}
                        {controller.contextMemoryDebugEnabled && !controller.isReplay && (
                            <div
                                className={`${styles.buttonItem} ${controller.isAutoToCompression ? styles.buttonItemActive : ''} ${!controller.gameStarted || controller.showGalgameHistory ? styles.buttonItemDisabled : ''}`}
                                onClick={
                                    !controller.gameStarted || controller.showGalgameHistory
                                        ? undefined
                                        : controller.handleAutoToCompressionToggle
                                }
                                style={{ cursor: !controller.gameStarted || controller.showGalgameHistory ? 'not-allowed' : 'pointer' }}
                                title="自动跑到压缩"
                            >
                                <div className={styles.buttonInner}>
                                    <MdPlayCircleOutline />
                                    <span>压测</span>
                                </div>
                            </div>
                        )}
                        <div
                            className={`${styles.buttonItem} ${isSettingsOpen ? styles.buttonItemActive : ''}`}
                            onClick={() => {
                                setIsSettingsOpen(!isSettingsOpen);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.buttonInner}>
                                <MdSettings />
                                    <span>{t('galgame.settings')}</span>
                            </div>
                        </div>
                        {controller.isReplay && (
                            <div
                                className={styles.buttonItem}
                                onClick={controller.handleExitGame}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <RiLogoutCircleRLine />
                                    <span>{t('galgame.exit')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <StoryIntroModal
                        isOpen={controller.isReplay ? false : controller.showStoryIntro}
                        presetData={controller.presetData}
                        onStartGame={controller.handleStartGame}
                        isLoading={controller.isStartingGame}
                    />

                    <GalgameHistoryModal
                        isOpen={controller.showGalgameHistory}
                        history={controller.history}
                        backgroundImage={controller.backgroundImage}
                        hasMoreBefore={controller.hasMoreHistoryBefore}
                        loadingMoreBefore={controller.loadingMoreHistoryBefore}
                        onLoadMoreBefore={controller.loadMoreHistoryBefore}
                        onRegenerate={controller.isReplay ? undefined : handleRegenerate}
                        onEditSave={controller.isReplay ? undefined : controller.editHistory}
                    />

                    {controller.contextMemoryDebugEnabled && controller.memoryDebugOpen && (
                        <div
                            className={styles.memoryDebugOverlay}
                            onClick={() => controller.setMemoryDebugOpen(false)}
                        >
                            <div
                                className={styles.memoryDebugPanel}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="memory-debug-title"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className={styles.memoryDebugHeader}>
                                    <div>
                                        <div id="memory-debug-title" className={styles.memoryDebugTitle}>记忆调试</div>
                                        <div className={styles.memoryDebugMeta}>
                                            {memoryDebugCurrent?.updatedAt || '暂无记忆快照'}
                                        </div>
                                    </div>
                                    <div className={styles.memoryDebugActions}>
                                        <button
                                            type="button"
                                            onClick={() => void controller.openContextMemoryDebug()}
                                            disabled={controller.memoryDebugLoading}
                                        >
                                            刷新
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => controller.setMemoryDebugOpen(false)}
                                        >
                                            关闭
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.memoryDebugBody}>
                                    {controller.memoryDebugLoading ? (
                                        <div className={styles.memoryDebugEmpty}>加载中...</div>
                                    ) : (
                                        <>
                                            <section className={styles.memoryDebugSection}>
                                                <div className={styles.memoryDebugSectionHeader}>
                                                    <div className={styles.memoryDebugSectionTitle}>当前摘要</div>
                                                    <button
                                                        type="button"
                                                        className={styles.memoryDebugCopyButton}
                                                        onClick={() => void handleCopyMemoryDebugText(memoryDebugCurrent?.summaryText || '', '已复制当前摘要')}
                                                        disabled={!memoryDebugCurrent?.summaryText?.trim()}
                                                        title="Copy summary"
                                                        aria-label="Copy summary"
                                                    >
                                                        <MdContentCopy />
                                                    </button>
                                                </div>
                                                <div className={styles.memoryDebugSummary}>
                                                    {memoryDebugCurrent?.summaryText || '暂无可用摘要。'}
                                                </div>
                                                <div className={styles.memoryDebugMetaGrid}>
                                                    <span>次数：{memoryDebugCurrent?.compressionCount ?? 0}</span>
                                                    <span>原因：{memoryDebugCurrent?.triggerReason || 'none'}</span>
                                                    <span>压缩至：{memoryDebugCurrent?.compressedThroughMessageCount ?? 0}</span>
                                                </div>
                                            </section>
                                            <section className={styles.memoryDebugSection}>
                                                <div className={styles.memoryDebugSectionHeader}>
                                                    <div className={styles.memoryDebugSectionTitle}>结构化 JSON</div>
                                                    <button
                                                        type="button"
                                                        className={styles.memoryDebugCopyButton}
                                                        onClick={() => void handleCopyMemoryDebugText(memoryDebugStructured, '已复制结构化 JSON')}
                                                        disabled={!memoryDebugStructured.trim() || memoryDebugStructured === '{}'}
                                                        title="Copy structured JSON"
                                                        aria-label="Copy structured JSON"
                                                    >
                                                        <MdContentCopy />
                                                    </button>
                                                </div>
                                                <pre className={styles.memoryDebugJson}>{memoryDebugStructured}</pre>
                                            </section>
                                            <section className={styles.memoryDebugSection}>
                                                <div className={styles.memoryDebugSectionTitle}>压缩历史</div>
                                                {memoryDebugHistory.length === 0 ? (
                                                    <div className={styles.memoryDebugEmpty}>暂无压缩历史。</div>
                                                ) : (
                                                    <div className={styles.memoryDebugHistoryList}>
                                                        {memoryDebugHistory.map((item, index) => (
                                                            <div
                                                                key={item.id || `${item.compressedAt || item.updatedAt || 'history'}-${index}`}
                                                                className={styles.memoryDebugHistoryItem}
                                                            >
                                                                <div className={styles.memoryDebugHistoryMeta}>
                                                                    <span>#{item.compressionCount ?? index + 1}</span>
                                                                    <span>{item.triggerReason || 'none'}</span>
                                                                    <span>{item.compressedAt || item.updatedAt || ''}</span>
                                                                </div>
                                                                <div className={styles.memoryDebugHistoryText}>
                                                                    {item.summaryText || item.snapshot?.summaryText || '暂无摘要文本。'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </section>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 设置弹窗放在 mainContent 内，确保限制在容器内 */}
                    <SettingsModal
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        onExitGame={controller.isReplay ? controller.handleExitGame : navigateBackSafe}
                        onDeleteSession={controller.isReplay ? undefined : handleDeleteSessionInGame}
                        hideExitButton={controller.isReplay}
                        isMusicPlaying={isMusicPlaying}
                        onToggleMusic={() => {
                            logVisualButtonClick("settings_toggle_bgm");
                            handleMusicToggle();
                        }}
                        volume={volume}
                        onVolumeChange={setVolume}
                    />

                    {/* 通用属性面板（服务端KV） */}
                    {!controller.isReplay && galgameBetaAttributes && controller.gameStarted ? (
                        <ServerAttributesPanel
                            isOpen={isAttributesOpen}
                            onClose={() => setIsAttributesOpen(false)}
                        />
                    ) : null}

                    {/* 存档弹窗 */}
                    <SaveModal
                        isOpen={isSaveOpen}
                        onClose={() => setIsSaveOpen(false)}
                        sessionId={sessionId}
                        fileId={fileId}
                        defaultSaveMode={defaultSaveMode}
                    />

                    {/* 读取存档（游戏内也复用同一列表界面，并允许“空位新建”） */}
                    <LoadSaveListModal
                        isOpen={isLoadSaveOpen}
                        onClose={() => setIsLoadSaveOpen(false)}
                        fileId={fileId}
                        onPreview={async (item) => {
                            try {
                                if (!fileId) return setPreviewItem(item);
                                const resp = await (await import('../api/galgame/saves')).savesApi.getDetail(item.saveId, fileId);
                                const detail = resp.data;
                                setPreviewItem({ saveId: detail.saveId, summaryText: detail.summaryText, createdAt: detail.createdAt });
                            } catch {
                                setPreviewItem(item);
                            }
                        }}
                        allowCreateSlot={true}
                        onCreateSlotClick={() => {
                            // 从“读取存档”入口进入：让用户选择新建或覆盖
                            setIsLoadSaveOpen(false);
                            setDefaultSaveMode(undefined);
                            setIsSaveOpen(true);
                        }}
                    />
                    <SavePreviewModal
                        isOpen={!!previewItem}
                        onClose={() => setPreviewItem(null)}
                        item={previewItem}
                        onLoad={() => {
                            // 游戏内“从存档开始”通常用于从详情页；在游戏内这里仅做预览关闭
                            setPreviewItem(null);
                        }}
                    />

                    {/* 请求超时弹窗 */}
                    {renderErrorModal(
                        controller.requestTimeoutVisible,
                        t('galgame.requestTimeout'),
                        t('galgame.networkBusy'),
                        {
                            confirmText: t('galgame.retry'),
                            cancelText: t('galgame.cancel'),
                            primaryType: "confirm",
                            onConfirm: async () => {
                                await controller.handleRetryLastRequest();
                            },
                            onCancel: async () => {
                                controller.setRequestTimeoutVisible(false);
                                await controller.refreshHistory();
                                if (typeof window !== "undefined") {
                                    window.location.reload();
                                }
                            },
                        }
                    )}

                    {/* 一般请求错误弹窗 */}
                    {renderErrorModal(
                        controller.errorModalVisible,
                        t('galgame.requestError'),
                        controller.errorMessage,
                        {
                            confirmText: t('galgame.retry'),
                            cancelText: t('galgame.cancel'),
                            primaryType: "confirm",
                            onConfirm: async () => {
                                await controller.handleRetryLastRequest();
                            },
                            onCancel: async () => {
                                controller.setErrorModalVisible(false);
                                await controller.refreshHistory();
                                if (typeof window !== "undefined") {
                                    window.location.reload();
                                }
                            },
                        }
                    )}

                    {/* 分享回放弹窗 */}
                    <ShareReplayModal
                        isOpen={isShareOpen}
                        onClose={() => setIsShareOpen(false)}
                        onSubmit={handleShareReplay}
                        defaultTitle={controller.presetData?.world?.title ? `${controller.presetData.world.title} · ${t('galgame.replay')}` : t('galgame.myReplay')}
                    />

                    {createdReplayShare && (
                        <div
                            className={replayModalStyles.overlay}
                            style={{ zIndex: 3400 }}
                            onClick={() => setCreatedReplayShare(null)}
                        >
                            <div
                                className={replayModalStyles.modal}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="replay-share-result-title"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className={replayModalStyles.header}>
                                    <div className={replayModalStyles.headerContent}>
                                        <div className={replayModalStyles.titleWrap}>
                                            <div
                                                id="replay-share-result-title"
                                                className={replayModalStyles.title}
                                            >
                                                {t('galgame.replayCreated')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={replayModalStyles.body}>
                                    <div
                                        style={{
                                            color: '#4b5563',
                                            fontSize: '14px',
                                            lineHeight: 1.6,
                                            marginBottom: '12px',
                                        }}
                                    >
                                        {t('galgame.shareReplayTip')}
                                    </div>
                                    {createdReplayShare.visibility === 'unlisted' && (
                                        <div
                                            style={{
                                                color: '#a56200',
                                                fontSize: '13px',
                                                lineHeight: 1.5,
                                                marginBottom: '12px',
                                            }}
                                        >
                                            {t('galgame.linkOnlyTip')}
                                        </div>
                                    )}
                                    <input
                                        className={replayModalStyles.input}
                                        value={createdReplayShare.shareUrl}
                                        readOnly
                                        onFocus={(event) => event.currentTarget.select()}
                                    />
                                </div>
                                <div className={replayModalStyles.footer}>
                                    <button
                                        type="button"
                                        className={replayModalStyles.btn}
                                        style={{
                                            width: 'min(13rem, calc(50% - 0.5625rem))',
                                            background: '#E03D4B',
                                            color: '#fff',
                                        }}
                                        onClick={handleCopyCreatedReplayLink}
                                    >
                                        {t('galgame.copyLink')}
                                    </button>
                                    <button
                                        type="button"
                                        className={replayModalStyles.btn}
                                        style={{
                                            width: 'min(13rem, calc(50% - 0.5625rem))',
                                            background: '#f3f4f6',
                                            color: '#111827',
                                        }}
                                        onClick={() => setCreatedReplayShare(null)}
                                    >
                                        {t('galgame.close')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 回放结束提示（退出按钮） */}
                    {controller.isReplay && controller.replayFinished && (
                        <div className={replayModalStyles.endMask}>
                            <div className={replayModalStyles.endCard}>
                                <div className={replayModalStyles.endHeader}>
                                    <div className={replayModalStyles.endTitle}>{t('galgame.replayEnded')}</div>
                                </div>
                                <div className={replayModalStyles.endBody}>{t('galgame.thanksForWatching')}</div>
                                <div className={replayModalStyles.endFooter}>
                                    <button
                                        className={`${replayModalStyles.btn} ${replayModalStyles.btnSecondary}`}
                                        onClick={controller.handleExitGame}
                                    >{t('galgame.exit')}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 删除存档确认弹窗（游戏内，保持与 Settings 弹窗相同比例） */}
                    <GameConfirmModal
                        isOpen={isDeleteConfirmOpen}
                        onConfirm={handleConfirmDeleteSession}
                        onCancel={() => setIsDeleteConfirmOpen(false)}
                        title={t('galgame.restartGame')}
                        message={t('galgame.confirmRestart')}
                        confirmText={t('galgame.confirmRestartBtn')}
                        cancelText={t('galgame.cancel')}
                    />
                </div>
            </div>
        </>
    );
};

export default Galgame;
