import { CiLocationOn } from "react-icons/ci";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/gameStore";
import { RiLogoutCircleRLine } from "react-icons/ri";
import { MdSettings, MdTimeline, MdPerson, MdOutlineAssessment, MdFlag, MdDns, MdContentCopy } from "react-icons/md";
import GameStartWizard from "../components/Galgame/GameStartWizard";
import type { GameStartConfig } from "../lib/galgame/gameStartConfig";
import { sessionPlayerProfileApi } from "../api/galgame/playerCharacterCards";
import NormalModeDisplay from "../components/Galgame/NormalModeDisplay";
import { useCharacterAnimation } from "../hooks/galgame/useCharacterAnimation";
import CharacterLayer from "../components/Galgame/CharacterLayer";
import { useMusicPlayer } from "../hooks/mapGalgame/useMusicPlayer";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
import ExportVisualNovelModal from "../components/Galgame/ExportVisualNovelModal";
import TextModeDisplay from "../components/Galgame/TextModeDisplay";
import SettingsModal from "../components/Galgame/SettingsModal";
import ErrorModal from "../components/GalgameMap/Modal/WorldModal";
import { useGalgameController } from "../hooks/galgame/useGalgameController";
import toast from "react-hot-toast";
import FullPageLoading from "../components/Skeleton/FullPageLoading";
import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from "react";
import { useTranslation } from 'react-i18next';
import GameBackgroundRenderer from "../components/Galgame/GameBackgroundRenderer";
import { useLocation, useNavigate } from "react-router-dom";
import GameAction from "../api/rpgGame/gameAction";
import replayModalStyles from "../components/Galgame/ShareReplayModal.module.css";
import replayApi from "../api/galgame/replay";
import AttributesPanel from "../components/Galgame/panels/AttributesPanel";
import SystemsPanel from "../components/Galgame/panels/SystemsPanel";
import CharactersPanel from "../components/Galgame/panels/CharactersPanel";
import QuestsPanel from "../components/Galgame/panels/QuestsPanel";
import SaveModal from "../components/Galgame/SaveModal";
import LoadSaveListModal from "../components/CreateGame/LoadSaveListModal";
import SavePreviewModal from "../components/CreateGame/SavePreviewModal";
import type { SaveSummaryItem } from "../api/galgame/saves";
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
import {
    togglePlayBottomPanel,
    type PlayBottomPanelId,
} from "../lib/galgame/playBottomPanel";
import {
    mergeEncounteredIds,
    resolveEncounteredCharacterIds,
    type NpcProfileLike,
    type PlayerProfileLike,
} from "../lib/galgame/encounteredCharacters";
import {
    getQuestTrackerLabel,
    getTrackedQuest,
    mergeQuests,
    normalizeQuests,
    type QuestItem,
} from "../lib/galgame/quests";
import { useQuestTrackerTypewriter } from "../hooks/galgame/useQuestTrackerTypewriter";
import { buildLocationNameTypewriterVars } from "../lib/galgame/locationNameTypewriter";
import { isAbortError, hasNonEmptyPanelText, normalizeAttributePanels } from "../lib/galgame/attributePanelValues";
import { fetchPlayUiState } from "../api/galgame/playUi";
import { streamQuests } from "../api/galgame/questsStream";
import { streamAttributePanels } from "../api/galgame/attributePanelsStream";

const Galgame = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { fileId, sessionId } = useGameStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isExportNovelOpen, setIsExportNovelOpen] = useState(false);
    const [isReplayControlsOpen, setIsReplayControlsOpen] = useState(false);
    const [activePlayPanel, setActivePlayPanel] = useState<PlayBottomPanelId | null>(null);
    const [encounteredIds, setEncounteredIds] = useState<string[]>([]);
    const [quests, setQuests] = useState<QuestItem[]>([]);
    const [questsLoading, setQuestsLoading] = useState(false);
    const [questsError, setQuestsError] = useState<string | null>(null);
    const [attributePanelsCache, setAttributePanelsCache] = useState<Record<string, string>>({});
    const lastHistoryLenForRefreshRef = useRef(0);
    const questsRef = useRef<QuestItem[]>([]);
    questsRef.current = quests;
    const questsAbortRef = useRef<AbortController | null>(null);
    const attrsAbortRef = useRef<AbortController | null>(null);
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [defaultSaveMode, setDefaultSaveMode] = useState<'create' | 'overwrite' | undefined>(() => {
        const saveEntry = (location.state as { saveEntry?: string } | null)?.saveEntry;
        return saveEntry === 'load' ? undefined : 'create';
    });
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [overwriteDraftConfirm, setOverwriteDraftConfirm] = useState<{
        title: string;
        description?: string;
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

    const openPlayPanel = useCallback((id: PlayBottomPanelId) => {
        setIsSettingsOpen(false);
        setActivePlayPanel((prev) => togglePlayBottomPanel(prev, id));
    }, []);

    const npcsList = useMemo(
        () => (controller.presetData?.npcs?.npcs || []) as NpcProfileLike[],
        [controller.presetData]
    );

    const playerProfile = useMemo((): PlayerProfileLike | null => {
        const raw = controller.presetData?.world?.player;
        if (!raw || typeof raw !== 'object') return null;
        const images =
            typeof raw.images === 'string' && raw.images.trim()
                ? { base: raw.images.trim() }
                : (raw.images as unknown as PlayerProfileLike['images']);
        return {
            name: String(raw.name || '').trim(),
            job: String((raw as { job?: string }).job || (raw as { race?: string }).race || '').trim(),
            description: String(
                (raw as { description?: string }).description
                || raw.background
                || raw.appearance
                || ''
            ).trim(),
            personality: String(raw.personality || '').trim(),
            images,
        };
    }, [controller.presetData]);

    const morePromptForms = useMemo(
        () => (controller.presetData?.world as { morePromptForms?: unknown } | undefined)?.morePromptForms,
        [controller.presetData]
    );

    const trackedQuest = useMemo(() => getTrackedQuest(quests), [quests]);
    const questTrackerText = useMemo(() => getQuestTrackerLabel(trackedQuest), [trackedQuest]);
    const { displayed: questTrackerDisplayed, isTyping: isQuestTrackerTyping } =
        useQuestTrackerTypewriter(questTrackerText);

    // 地点切换时用 CSS steps 打字机重播；同名不 remount 则不会重动画
    const locationName = String(controller.currentScene?.name || '').trim();
    const locationTypewriterVars = useMemo(
        () => buildLocationNameTypewriterVars(locationName),
        [locationName]
    );

    // 读档/进局：拉取已持久化的出场与任务
    useEffect(() => {
        if (controller.isReplay || !sessionId || !controller.gameStarted) return;
        let cancelled = false;
        void (async () => {
            try {
                const data = await fetchPlayUiState(sessionId);
                if (cancelled) return;
                setEncounteredIds(mergeEncounteredIds(data.encounteredCharacterIds));
                setQuests(normalizeQuests(data.quests));
                if (data.attributePanels && Object.keys(data.attributePanels).length > 0) {
                    setAttributePanelsCache(normalizeAttributePanels(data.attributePanels));
                }
            } catch {
                /* 旧局无字段时忽略 */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [controller.isReplay, sessionId, controller.gameStarted]);

    // 本局 step 变化时本地累计出场（含主角 / 姓名回退；与后端 merge 互补）
    useEffect(() => {
        if (controller.isReplay || !controller.gameStarted) return;
        const steps = Array.isArray(controller.allStepsForTextModal)
            ? controller.allStepsForTextModal
            : [];
        const scenes = controller.presetData?.scenes?.scenes || [];
        setEncounteredIds((prev) =>
            resolveEncounteredCharacterIds(steps, scenes, npcsList, playerProfile, prev)
        );
    }, [
        controller.isReplay,
        controller.gameStarted,
        controller.allStepsForTextModal,
        controller.presetData,
        npcsList,
        playerProfile,
    ]);

    const refreshAttributePanels = useCallback(async () => {
        if (!sessionId || controller.isReplay) return;
        attrsAbortRef.current?.abort();
        const controllerAbort = new AbortController();
        attrsAbortRef.current = controllerAbort;
        try {
            const result = await streamAttributePanels<{ panels: Record<string, string> }>(
                sessionId,
                {},
                controllerAbort.signal
            );
            if (controllerAbort.signal.aborted) return;
            if (result?.panels && typeof result.panels === 'object') {
                const normalizedPanels = normalizeAttributePanels(result.panels);
                if (hasNonEmptyPanelText(normalizedPanels)) {
                    setAttributePanelsCache(normalizedPanels);
                }
            }
        } catch (e: unknown) {
            if (isAbortError(e) || (e as Error)?.name === 'AbortError') return;
            /* 自动刷新失败时保留缓存；打开面板可手动点刷新 */
        }
    }, [sessionId, controller.isReplay]);

    const refreshQuests = useCallback(async () => {
        if (!sessionId || controller.isReplay) return;
        questsAbortRef.current?.abort();
        const controllerAbort = new AbortController();
        questsAbortRef.current = controllerAbort;
        setQuestsLoading(true);
        setQuestsError(null);
        try {
            const result = await streamQuests(
                sessionId,
                {
                    onError: (msg) => {
                        // 功能注释：INVALID_JSON 是流式落盘解析失败；已有任务列表时不当成致命错误贴红条。
                        if (msg === 'INVALID_JSON') {
                            if (questsRef.current.length > 0) {
                                setQuestsError(null);
                                return;
                            }
                            setQuestsError(t('galgame.panelQuestsInvalid'));
                            return;
                        }
                        if (msg === 'Session is busy') {
                            setQuestsError(t('galgame.panelAttrsBusy'));
                            return;
                        }
                        setQuestsError(msg || t('galgame.requestError'));
                    },
                    onDone: (payload) => {
                        if (payload?.quests) {
                            setQuests((prev) => mergeQuests(prev, payload.quests));
                            setQuestsError(null);
                        }
                    },
                },
                controllerAbort.signal
            );
            if (result?.quests) {
                setQuests((prev) => mergeQuests(prev, result.quests));
                setQuestsError(null);
            }
        } catch (e: unknown) {
            if (isAbortError(e) || (e as Error)?.name === 'AbortError') return;
            setQuestsError(e instanceof Error ? e.message : t('galgame.requestError'));
        } finally {
            setQuestsLoading(false);
        }
    }, [sessionId, controller.isReplay, t]);

    // 每轮叙事结束后：先刷属性再刷任务，避免共用 session 锁互相 LOCKED
    useEffect(() => {
        if (controller.isReplay || !controller.gameStarted || !sessionId) return;
        const len = controller.history.length;
        if (len <= 0) return;
        if (len <= lastHistoryLenForRefreshRef.current) return;
        const last = controller.history[len - 1];
        lastHistoryLenForRefreshRef.current = len;
        if (last?.role !== 'assistant') return;
        void (async () => {
            await refreshAttributePanels();
            await refreshQuests();
        })();
    }, [
        controller.history,
        controller.history.length,
        controller.isReplay,
        controller.gameStarted,
        sessionId,
        refreshAttributePanels,
        refreshQuests,
    ]);

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

    /*
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
    */

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

    const { isMusicPlaying, handleMusicToggle, volume, setVolume, hasMusic, isMusicLoading } = useMusicPlayer({
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

    /** 从历史导出视觉小说草稿（底层仍走 session→private replay→novel，对用户只暴露草稿箱） */
    const handleExportVisualNovel = async ({
        title,
        description,
        overwrite = false,
    }: {
        title: string;
        description?: string;
        overwrite?: boolean;
    }) => {
        logVisualButtonClick(overwrite ? 'export_visual_novel_overwrite' : 'export_visual_novel_create');
        if (!sessionId || !fileId) {
            toast.error(t('galgame.sessionNotFound'));
            return;
        }

        const runExport = async () =>
            replayApi.createFromSession({
                sessionId,
                fileId,
                title,
                description,
                visibility: 'private',
                createAsNovel: true,
                overwrite,
            });

        try {
            let resp;
            try {
                resp = await runExport();
            } catch (firstError) {
                const firstCode = (firstError as AxiosError<{ code?: string }>).response?.data?.code;
                // 吐字刚结束时后端可能仍持锁/落库：自动重试一次
                if (firstCode === 'GENERATION_IN_PROGRESS') {
                    await new Promise((resolve) => setTimeout(resolve, 1600));
                    resp = await runExport();
                } else {
                    throw firstError;
                }
            }

            if (resp.data?.success && resp.data?.novelFileId) {
                setOverwriteDraftConfirm(null);
                setIsExportNovelOpen(false);
                controller.setShowGalgameHistory(false);
                toast.success(t('galgame.exportVisualNovelCreated'));
                return;
            }
            toast.error(t('galgame.exportVisualNovelFailed'));
        } catch (error) {
            const axiosError = error as AxiosError<{ code?: string; message?: string }>;
            const errorCode = axiosError.response?.data?.code;

            if (errorCode === 'REPLAY_TITLE_CONFLICT' && !overwrite) {
                // 本人同名草稿：二次确认后再带 overwrite 重试（不影响其他账号）
                setOverwriteDraftConfirm({ title, description });
                return;
            }

            if (errorCode === 'NOVEL_PUBLISHED_CONFLICT') {
                toast.error(t('galgame.novelPublishedConflict'));
                return;
            }

            if (errorCode === 'GENERATION_IN_PROGRESS') {
                toast.error(t('galgame.generationInProgress'));
                return;
            }

            if (errorCode === 'NOVEL_SCHEMA_OUTDATED') {
                toast.error(t('galgame.exportVisualNovelSchemaOutdated'));
                return;
            }

            if (errorCode === 'NO_STEPS_AVAILABLE') {
                toast.error(t('galgame.exportVisualNovelNoSteps', {
                    defaultValue: '当前会话没有可导出的剧情步骤，请先多玩几轮再导出',
                }));
                return;
            }

            const serverMessage = String(axiosError.response?.data?.message || '').trim();
            toast.error(serverMessage || t('galgame.exportVisualNovelFailed'));
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
                    <div className={styles.topBar}>
                        {hasMusic && (
                            <div
                                className={`${styles.musicButton} ${!isMusicPlaying && !isMusicLoading ? styles.musicButtonMuted : ''}`}
                                onClick={handleMusicToggle}
                            >
                                <div className={styles.musicButtonInner}>
                                    {isMusicLoading ? (
                                        <div className={styles.musicLoading}></div>
                                    ) : !isMusicPlaying ? (
                                        <>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/bgm.png`} alt="BGM" />
                                            <div className={styles.muteSlash}></div>
                                        </>
                                    ) : (
                                        <img src={`${import.meta.env.BASE_URL}data/assets/bgm.png`} alt="BGM" />
                                    )}
                                    <span>{t('galgame.music')}</span>
                                </div>
                            </div>
                        )}
                        <div className={`${styles.topHeader} ${controller.isTextMode ? styles.topHeaderTextMode : ''}`}>
                            <span className={styles.topHeaderLocationIcon} aria-hidden="true">
                                <CiLocationOn />
                            </span>
                            {locationName ? (
                                <span
                                    key={locationName}
                                    className={styles.topHeaderLocationText}
                                    style={
                                        locationTypewriterVars
                                            ? ({
                                                '--location-type-steps': locationTypewriterVars.steps,
                                                '--location-type-ms': `${locationTypewriterVars.durationMs}ms`,
                                            } as CSSProperties)
                                            : undefined
                                    }
                                >
                                    {locationName}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    {/* {!controller.isReplay && controller.gameStarted && (
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
                    )} */}
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
                    {/* 顶栏任务追踪（与任务面板同源）；新任务文案变化时打字机出场 */}
                    {!controller.isReplay && controller.gameStarted && questTrackerText ? (
                        <div
                            key={questTrackerText}
                            className={`${styles.questTracker} ${styles.questTrackerEnter}`}
                        >
                            <div className={styles.questTrackerLabel}>{t('galgame.questTracker')}</div>
                            <div
                                className={`${styles.questTrackerBody}${isQuestTrackerTyping ? ` ${styles.questTrackerBodyTyping}` : ''}`}
                            >
                                {questTrackerDisplayed}
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

                    {/* 按钮栏：历史打开时隐藏常规按钮，仅保留「导出视觉小说 / 返回」 */}
                    <div
                        ref={buttonContainerRef}
                        className={`${styles.buttonContainer} ${controller.showGalgameHistory ? styles.historyActionBar : ''} ${isButtonBarDragging ? styles.buttonContainerDragging : ''}`}
                        onPointerDown={controller.showGalgameHistory ? undefined : handleButtonBarPointerDown}
                        onPointerMove={controller.showGalgameHistory ? undefined : handleButtonBarPointerMove}
                        onPointerUp={controller.showGalgameHistory ? undefined : handleButtonBarPointerUp}
                        onPointerCancel={controller.showGalgameHistory ? undefined : handleButtonBarPointerCancel}
                        onLostPointerCapture={controller.showGalgameHistory ? undefined : handleButtonBarLostPointerCapture}
                        onClickCapture={controller.showGalgameHistory ? undefined : handleButtonBarClickCapture}
                        onDoubleClickCapture={controller.showGalgameHistory ? undefined : handleButtonBarClickCapture}
                        onWheel={controller.showGalgameHistory ? undefined : handleButtonBarWheel}
                        onDragStartCapture={controller.showGalgameHistory ? undefined : handleButtonBarDragStartCapture}
                    >
                        {controller.showGalgameHistory ? (
                            <>
                                <button
                                    type="button"
                                    className={styles.historyExportButton}
                                    disabled={
                                        controller.isReplay
                                        || !sessionId
                                        || !fileId
                                        || controller.history.length === 0
                                    }
                                    onClick={() => {
                                        logVisualButtonClick('export_visual_novel');
                                        setIsExportNovelOpen(true);
                                    }}
                                >
                                    {t('galgame.exportVisualNovel')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.historyBackButton}
                                    onClick={() => {
                                        logVisualButtonClick('history_back');
                                        controller.setShowGalgameHistory(false);
                                    }}
                                >
                                    {t('galgame.historyBack')}
                                </button>
                            </>
                        ) : (
                            <>
                        {!controller.isReplay && controller.gameStarted && (
                            <>
                                <div
                                    className={`${styles.buttonItem} ${activePlayPanel === 'character' ? styles.buttonItemActive : ''}`}
                                    onClick={() => openPlayPanel('character')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.buttonInner}>
                                        <MdPerson />
                                        <span>{t('galgame.tabCharacter')}</span>
                                    </div>
                                </div>
                                <div
                                    className={`${styles.buttonItem} ${activePlayPanel === 'attrs' ? styles.buttonItemActive : ''}`}
                                    onClick={() => openPlayPanel('attrs')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.buttonInner}>
                                        <MdOutlineAssessment />
                                        <span>{t('galgame.tabAttrs')}</span>
                                    </div>
                                </div>
                                <div
                                    className={`${styles.buttonItem} ${activePlayPanel === 'quests' ? styles.buttonItemActive : ''}`}
                                    onClick={() => openPlayPanel('quests')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.buttonInner}>
                                        <MdFlag />
                                        <span>{t('galgame.tabQuests')}</span>
                                    </div>
                                </div>
                                <div
                                    className={`${styles.buttonItem} ${activePlayPanel === 'systems' ? styles.buttonItemActive : ''}`}
                                    onClick={() => openPlayPanel('systems')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.buttonInner}>
                                        <MdDns />
                                        <span>{t('galgame.tabSystems')}</span>
                                    </div>
                                </div>
                            </>
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
                            className={`${styles.buttonItem} ${isSettingsOpen ? styles.buttonItemActive : ''}`}
                            onClick={() => {
                                setActivePlayPanel(null);
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
                            </>
                        )}
                    </div>

                    <GameStartWizard
                        isOpen={controller.isReplay ? false : controller.showStoryIntro}
                        title={controller.presetData?.world?.title || t('common.storyIntro.defaultTitle')}
                        routes={(controller.presetData?.world?.keyEvents || []).map((ev, idx) => ({
                            id: `route-${idx}-${String(ev.title || '').slice(0, 12)}`,
                            title: String(ev.title || `故事线 ${idx + 1}`),
                            summary: String(ev.description || '').slice(0, 120),
                            openingMonologue: String(ev.description || controller.presetData?.world?.initialPlot || ''),
                        }))}
                        defaultPlayerName={controller.presetData?.player?.name || ''}
                        isLoading={controller.isStartingGame}
                        onConfirm={async (config: GameStartConfig) => {
                            try {
                                if (sessionId && user?.token) {
                                    await sessionPlayerProfileApi.putGameStartConfig(user.token, sessionId, config);
                                }
                            } catch (err) {
                                console.warn('[GameStartWizard] putGameStartConfig failed', err);
                            }
                            await controller.handleStartGame();
                        }}
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

                    <ExportVisualNovelModal
                        isOpen={isExportNovelOpen}
                        onClose={() => setIsExportNovelOpen(false)}
                        onSubmit={handleExportVisualNovel}
                        defaultTitle={controller.presetData?.world?.title || t('galgame.exportVisualNovelDefaultTitle')}
                        sessionId={sessionId}
                        fileId={fileId}
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
                        musicDisabled={!hasMusic}
                        onToggleMusic={() => {
                            if (!hasMusic) return;
                            logVisualButtonClick("settings_toggle_bgm");
                            void handleMusicToggle();
                        }}
                        volume={volume}
                        onVolumeChange={setVolume}
                        points={controller.isReplay ? null : user?.user?.points}
                        onOpenSave={
                            controller.isReplay
                                ? undefined
                                : () => {
                                      setIsSaveOpen(true);
                                  }
                        }
                        onOpenHistory={
                            controller.isReplay
                                ? undefined
                                : () => {
                                      handleHistoryClick();
                                  }
                        }
                        isTextMode={controller.isTextMode}
                        onToggleTextMode={handleTextModeToggle}
                        isAutoPlay={controller.isAutoPlay}
                        autoPlayDisabled={controller.isTextMode || controller.showGalgameHistory}
                        onToggleAutoPlay={() => {
                            logVisualButtonClick('auto');
                            controller.handleAutoPlayToggle();
                        }}
                        onOpenMemoryDebug={
                            controller.contextMemoryDebugEnabled && !controller.isReplay
                                ? () => {
                                      void controller.openContextMemoryDebug();
                                  }
                                : undefined
                        }
                        onToggleAutoToCompression={
                            controller.contextMemoryDebugEnabled && !controller.isReplay
                                ? controller.handleAutoToCompressionToggle
                                : undefined
                        }
                        isAutoToCompression={controller.isAutoToCompression}
                        autoToCompressionDisabled={!controller.gameStarted || controller.showGalgameHistory}
                    />

                    {!controller.isReplay && controller.gameStarted ? (
                        <>
                            <CharactersPanel
                                isOpen={activePlayPanel === 'character'}
                                onClose={() => setActivePlayPanel(null)}
                                encounteredIds={encounteredIds}
                                npcs={npcsList}
                                player={playerProfile}
                            />
                            <AttributesPanel
                                isOpen={activePlayPanel === 'attrs'}
                                onClose={() => setActivePlayPanel(null)}
                                suppressAutoRefresh
                                cachedPanels={attributePanelsCache}
                                onPanelsUpdated={setAttributePanelsCache}
                            />
                            <QuestsPanel
                                isOpen={activePlayPanel === 'quests'}
                                onClose={() => setActivePlayPanel(null)}
                                quests={quests}
                                loading={questsLoading}
                                error={questsError}
                            />
                            <SystemsPanel
                                isOpen={activePlayPanel === 'systems'}
                                onClose={() => setActivePlayPanel(null)}
                                morePromptForms={morePromptForms}
                            />
                        </>
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

                    {/* 导出同名草稿覆盖确认（叠在导出弹窗之上） */}
                    <GameConfirmModal
                        isOpen={Boolean(overwriteDraftConfirm)}
                        overlayZIndex={3500}
                        onConfirm={() => {
                            if (!overwriteDraftConfirm) return;
                            const payload = overwriteDraftConfirm;
                            setOverwriteDraftConfirm(null);
                            void handleExportVisualNovel({ ...payload, overwrite: true });
                        }}
                        onCancel={() => setOverwriteDraftConfirm(null)}
                        title={t('galgame.overwriteDraftTitle')}
                        message={t('galgame.overwriteDraftMessage')}
                        confirmText={t('galgame.overwriteDraftConfirm')}
                        cancelText={t('galgame.cancel')}
                    />
                </div>
            </div>
        </>
    );
};

export default Galgame;
