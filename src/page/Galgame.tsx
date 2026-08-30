import { CiLocationOn } from "react-icons/ci";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/gameStore";
import { RiLogoutCircleRLine } from "react-icons/ri";
import { MdSettings, MdTimeline, MdPerson, MdOutlineAssessment, MdFlag, MdDns, MdContentCopy, MdAutoStories } from "react-icons/md";
import {
  buildOpeningRoutesFromWorldKeyEvents,
  buildSilentDefaultGameStartConfig,
  clampMaxResponseChars,
  GAME_START_LIMITS,
  GAME_START_UE_COPY,
  isMultiChoicePersonaText,
  normalizeGameStartGender,
  resolveOpeningRouteSelection,
  resolveRoutePersona,
  validateGameStartConfig,
  type GameStartConfig,
  type GameStartPersonaBlocks,
  type GameStartWorldBookEntry,
  type GameStartWritingStyle,
} from "../lib/galgame/gameStartConfig";
import { isPlaceholderPlayerName, resolvePlayerDisplayName } from "../lib/galgame/playerDisplayName";
import { sessionPlayerProfileApi } from "../api/galgame/playerCharacterCards";
import type { SessionPlayerProfile } from "../lib/galgame/playerCharacterCard";
import { resolveSessionPlayerPortraitPath, resolvePlayPortraitScale, isImportedCardPortraitUrl } from "../lib/galgame/playerCharacterCard";
import { pickSessionNpcAvatarUrl } from "../lib/galgame/npcPlayPortrait";
import {
  mergePlayerAvatarIntoProfile,
  subscribePlayerAvatarGenComplete,
} from "../lib/galgame/playerAvatarBackgroundJob";
import { mergeIncomingSessionPlayerProfile } from "../lib/galgame/playerAvatarMerge";
import {
  mergeNpcAvatarIntoProfiles,
  mergeIncomingNpcProfiles,
  type NpcAvatarMergeInput,
} from "../lib/galgame/npcAvatarMerge";
import { subscribeNpcAvatarGenComplete } from "../lib/galgame/npcAvatarBackgroundJob";
import { CHARACTER_GENERATION_COST } from "../utils/constants";
import { ensureMinPlayChoiceOptions } from "../lib/galgame/playChoiceOptions";
import type { SystemsConfigPatch } from "../components/Galgame/panels/SystemsPanel";
import type { PlayerEditableNpc } from "../lib/galgame/characterProfile";
import {
  applyNameMapToSteps,
  applyDisplayNameRewrites,
  buildNpcNameReplacementMap,
  buildPlayerNameReplacementMap,
} from "../lib/galgame/npcNameOverlay";
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
import type { Message } from "../hooks/galgame/useGalgameMessage";
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
import { getImageUrl, getPlayerImageUrl } from "../utils/constants";
import { withCacheBust } from "../utils/imageCache";
import CharactersPanel from "../components/Galgame/panels/CharactersPanel";
import QuestsPanel from "../components/Galgame/panels/QuestsPanel";
import SaveModal from "../components/Galgame/SaveModal";
import LoadSaveListModal from "../components/CreateGame/LoadSaveListModal";
import SavePreviewModal from "../components/CreateGame/SavePreviewModal";
import { savesApi, type SaveSummaryItem } from "../api/galgame/saves";
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
    resolveQuestsPanelRefreshPlan,
    shouldSkipQuestAutoRefresh,
    type QuestItem,
} from "../lib/galgame/quests";
import { useQuestTrackerTypewriter } from "../hooks/galgame/useQuestTrackerTypewriter";
import { buildLocationNameTypewriterVars } from "../lib/galgame/locationNameTypewriter";
import {
    isAbortError,
    hasNonEmptyPanelText,
    normalizeAttributePanels,
    shouldSkipAttributeAutoRefresh,
} from "../lib/galgame/attributePanelValues";
import { isNarrativeGenerationBusy } from "../lib/galgame/privateChatGate";
import { fetchPlayUiState } from "../api/galgame/playUi";
import { fetchCachedQuests, streamQuests } from "../api/galgame/questsStream";
import { streamAttributePanels } from "../api/galgame/attributePanelsStream";
import { runSessionAutoStartOnce } from "../lib/galgame/sessionStartInflight";
import { ensurePlayUiHydratedOnce, resetPlayUiHydrationGate } from "../lib/galgame/playUiHydrationGate";

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
    const [questsRefreshing, setQuestsRefreshing] = useState(false);
    const [questsError, setQuestsError] = useState<string | null>(null);
    const [attributePanelsCache, setAttributePanelsCache] = useState<Record<string, string>>({});
    const questsRef = useRef<QuestItem[]>([]);
    questsRef.current = quests;
    const questsAbortRef = useRef<AbortController | null>(null);
    const questsStreamingRef = useRef(false);
    const questsLastStartedAtRef = useRef<number | null>(null);
    const attrsAbortRef = useRef<AbortController | null>(null);
    const attrsStreamingRef = useRef(false);
    const attrsLastStartedAtRef = useRef<number | null>(null);
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [defaultSaveMode, setDefaultSaveMode] = useState<'create' | 'overwrite' | undefined>(() => {
        const saveEntry = (location.state as { saveEntry?: string } | null)?.saveEntry;
        return saveEntry === 'load' ? undefined : 'create';
    });
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [bootPending, setBootPending] = useState(() => {
        return (location.state as { bootPending?: boolean } | null)?.bootPending === true;
    });
    /** 新开局：进页不拉 history，直接自动开始游戏 */
    const [bootNewStart] = useState(() => {
        return (location.state as { bootNewStart?: boolean } | null)?.bootNewStart === true;
    });
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [overwriteDraftConfirm, setOverwriteDraftConfirm] = useState<{
        title: string;
        description?: string;
    } | null>(null);
    /** 局内当前开场路线（系统面板可改；新开局静默写入首条） */
    const [openingRouteId, setOpeningRouteId] = useState('');
    const [systemWorldBookEntries, setSystemWorldBookEntries] = useState<GameStartWorldBookEntry[] | null>(null);
    const [systemWritingStyle, setSystemWritingStyle] = useState<GameStartWritingStyle | null>(null);
    const [systemPersonaBlocks, setSystemPersonaBlocks] = useState<GameStartPersonaBlocks | null>(null);
    /** 设置「最大回复」；默认 800，进局后可被 gameStartConfig 覆盖 */
    const [maxResponseChars, setMaxResponseChars] = useState(
      GAME_START_LIMITS.maxResponseChars.default,
    );
    const maxResponsePersistTimerRef = useRef<number | null>(null);
    const [sessionNpcEdits, setSessionNpcEdits] = useState<PlayerEditableNpc[]>([]);
    /** 新角色尚未保存时，后台头像先挂这里，保存后再合并 */
    const pendingNpcAvatarsRef = useRef<Record<string, NpcAvatarMergeInput>>({});
    /** A/B：未手改性别时跟创作台预设（默认 true=全开验收；play-ui 显式 false 才关） */
    const [npcGenderPreferPresetAb, setNpcGenderPreferPresetAb] = useState(true);
    /** 局内「我的档案」：改档后必须进父状态 + play-ui 回传，下一轮推演才稳定读到 */
    const [sessionPlayerProfile, setSessionPlayerProfile] = useState<SessionPlayerProfile | null>(null);
    /** 主角曾用名（含文档原名），用于改名后文案/人名牌/文本模式统一替换 */
    const [playerNameAliases, setPlayerNameAliases] = useState<string[]>([]);
    const autoStartInFlightRef = useRef(false);
    const playUiHydrateInFlightRef = useRef(false);
    const panelLlmTriedRef = useRef<PlayBottomPanelId | null>(null);
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    const buttonBarDragStateRef = useRef<HorizontalDragState>(createInitialHorizontalDragState());
    const [isDesktopButtonBarInteraction, setIsDesktopButtonBarInteraction] = useState(false);
    const [isButtonBarDragging, setIsButtonBarDragging] = useState(false);

    // 使用统一的控制器 hook
    const controller = useGalgameController({
        bootNewStart,
        sessionPlayerAvatarUrl: sessionPlayerProfile?.avatarUrl || null,
        sessionPlayerName: sessionPlayerProfile?.name || null,
        sessionNpcEdits,
    });

    const openingRoutes = useMemo(
        () =>
            buildOpeningRoutesFromWorldKeyEvents(controller.presetData?.world?.keyEvents, {
                initialPlot: controller.presetData?.world?.initialPlot,
            }),
        [controller.presetData?.world?.keyEvents, controller.presetData?.world?.initialPlot],
    );

    const persistGameStartConfig = useCallback(
        async (config: GameStartConfig) => {
            if (!sessionId || !user?.token) return;
            await sessionPlayerProfileApi.putGameStartConfig(user.token, sessionId, config);
        },
        [sessionId, user?.token],
    );

    /** 新开局：会话级 inflight，挡住 StrictMode 双发 game-start-config + stream */
    useEffect(() => {
        if (controller.isReplay) return;
        if (!controller.shouldAutoStartGame) return;
        if (!sessionId || !controller.presetData) return;
        if (autoStartInFlightRef.current) return;

        autoStartInFlightRef.current = true;
        controller.acknowledgeAutoStartGame();

        void runSessionAutoStartOnce(sessionId, async () => {
            const presetPlayer = controller.presetData?.world?.player as
                | {
                    name?: string;
                    gender?: string;
                    persona?: string;
                    background?: string;
                    description?: string;
                    defaultPersonaBlocks?: GameStartPersonaBlocks;
                    secret?: string;
                  }
                | undefined;
            const docPersona = String(
                presetPlayer?.persona
                || presetPlayer?.background
                || presetPlayer?.description
                || '',
            ).trim();
            const built = buildSilentDefaultGameStartConfig({
                playerName: presetPlayer?.name,
                gender: presetPlayer?.gender,
                routes: openingRoutes,
                documentPersona: docPersona,
                defaultPersonaBlocks: presetPlayer?.defaultPersonaBlocks
                    || (presetPlayer?.secret
                        ? { secret: String(presetPlayer.secret) }
                        : null),
            });
            if (built.ok && built.data) {
                setOpeningRouteId(built.data.openingRouteId);
                const routePersona = resolveRoutePersona(
                    openingRoutes.find((r) => r.id === built.data!.openingRouteId),
                );
                const personaSeed =
                    routePersona
                    || (!isMultiChoicePersonaText(docPersona) ? docPersona : '');
                // 开局即种子本局档案姓名（文档主角），避免编辑表单落到占位名
                // 定位 personaBlocks 与人设独立，禁止把身份/立场/秘密拼进人设
                setSessionPlayerProfile((prev) => {
                    if (prev?.name && !isPlaceholderPlayerName(prev.name)) {
                        return {
                            ...prev,
                            persona: prev.persona || personaSeed || prev.persona,
                            gender: prev.gender || built.data!.player.gender,
                        };
                    }
                    const seededName = resolvePlayerDisplayName([
                        built.data!.player.name,
                        presetPlayer?.name,
                    ]);
                    if (!seededName) return prev;
                    return {
                        name: seededName,
                        gender: built.data!.player.gender,
                        persona: prev?.persona || personaSeed || '',
                        customAttributes: prev?.customAttributes || {},
                        importedCardId: prev?.importedCardId ?? null,
                    };
                });
                if (presetPlayer?.name) {
                    setPlayerNameAliases((prev) => {
                        const n = String(presetPlayer.name || '').trim();
                        return n && !prev.includes(n) ? [...prev, n] : prev;
                    });
                }
                try {
                    await persistGameStartConfig(built.data);
                } catch (err) {
                    console.warn('[Galgame] silent putGameStartConfig failed', err);
                }
            }
            await controller.handleStartGame();
        }).finally(() => {
            autoStartInFlightRef.current = false;
        });
    }, [
        controller.isReplay,
        controller.shouldAutoStartGame,
        controller.presetData,
        controller.acknowledgeAutoStartGame,
        controller.handleStartGame,
        sessionId,
        openingRoutes,
        persistGameStartConfig,
    ]);

    const handlePersistSystemConfig = useCallback(
        async (patch: SystemsConfigPatch) => {
            const routeId = patch.openingRouteId || openingRouteId || openingRoutes[0]?.id || '';
            const resolved = resolveOpeningRouteSelection(openingRoutes, routeId);
            if (!resolved.ok || !resolved.openingRouteId) {
                toast.error(resolved.message || '故事线无效');
                throw new Error(resolved.message || '故事线无效');
            }
            const presetPlayer = controller.presetData?.world?.player as
                | { name?: string; gender?: string }
                | undefined;
            const selectedRoute = openingRoutes.find((r) => r.id === resolved.openingRouteId);
            const routePersona = resolveRoutePersona(selectedRoute);
            // 功能注释：系统配置保存优先保留局内「我的档案」姓名/性别，避免用文档主角覆盖
            const checked = validateGameStartConfig({
                player: {
                    name: resolvePlayerDisplayName(
                        [sessionPlayerProfile?.name, presetPlayer?.name],
                    ) || GAME_START_UE_COPY.fallbackPlayerName,
                    gender: normalizeGameStartGender(
                        sessionPlayerProfile?.gender || presetPlayer?.gender,
                    ),
                    personaBlocks: patch.personaBlocks
                      ?? systemPersonaBlocks
                      ?? undefined,
                    attributes: sessionPlayerProfile?.customAttributes,
                },
                worldBookEntries: patch.worldBookEntries,
                writingStyle: patch.writingStyle,
                maxResponseChars,
                openingRouteId: resolved.openingRouteId,
                openingMonologue: patch.openingMonologue ?? resolved.openingMonologue,
                retainedStorylineIds: patch.retainedStorylineIds ?? resolved.retainedStorylineIds,
            });
            if (!checked.ok) {
                toast.error(checked.message || '系统配置无效');
                throw new Error(checked.message || '系统配置无效');
            }
            await persistGameStartConfig(checked.data);
            setOpeningRouteId(checked.data.openingRouteId);
            setSystemWorldBookEntries(checked.data.worldBookEntries || []);
            setSystemWritingStyle(checked.data.writingStyle || null);
            setSystemPersonaBlocks(checked.data.player.personaBlocks || null);
            if (checked.data.maxResponseChars != null) {
                setMaxResponseChars(checked.data.maxResponseChars);
            }
            // 换路线后写入确定性人设
            if (routePersona) {
                setSessionPlayerProfile((prev) => {
                    if (!prev) {
                        return {
                            name: checked.data.player.name,
                            gender: checked.data.player.gender,
                            persona: routePersona,
                            customAttributes: {},
                        };
                    }
                    return { ...prev, persona: routePersona };
                });
            }
        },
        [
            openingRouteId,
            openingRoutes,
            controller.presetData?.world?.player,
            sessionPlayerProfile,
            persistGameStartConfig,
            systemPersonaBlocks,
            maxResponseChars,
        ],
    );

    /**
     * 功能注释：把最大回复立即写入 session（取消防抖），下一回合 narrative 即用新上限。
     * @param overrideChars 拖条当帧值；不传则用当前 state（供「完成」按钮）
     */
    const flushMaxResponseCharsPersist = useCallback(async (overrideChars?: number) => {
        if (controller.isReplay) return;
        if (maxResponsePersistTimerRef.current != null) {
            window.clearTimeout(maxResponsePersistTimerRef.current);
            maxResponsePersistTimerRef.current = null;
        }
        const clamped = clampMaxResponseChars(
            overrideChars != null ? overrideChars : maxResponseChars,
        );
        if (clamped == null) return;
        const routeId = openingRouteId || openingRoutes[0]?.id || '';
        const resolved = resolveOpeningRouteSelection(openingRoutes, routeId);
        if (!resolved.ok || !resolved.openingRouteId) return;
        const presetPlayer = controller.presetData?.world?.player as
            | { name?: string; gender?: string }
            | undefined;
        const checked = validateGameStartConfig({
            player: {
                name: resolvePlayerDisplayName(
                    [sessionPlayerProfile?.name, presetPlayer?.name],
                ) || GAME_START_UE_COPY.fallbackPlayerName,
                gender: normalizeGameStartGender(
                    sessionPlayerProfile?.gender || presetPlayer?.gender,
                ),
                personaBlocks: systemPersonaBlocks ?? undefined,
                attributes: sessionPlayerProfile?.customAttributes,
            },
            worldBookEntries: systemWorldBookEntries ?? undefined,
            writingStyle: systemWritingStyle ?? undefined,
            maxResponseChars: clamped,
            openingRouteId: resolved.openingRouteId,
            openingMonologue: resolved.openingMonologue,
            retainedStorylineIds: resolved.retainedStorylineIds,
        });
        if (!checked.ok) return;
        try {
            await persistGameStartConfig(checked.data);
        } catch (err) {
            console.warn('[Galgame] putGameStartConfig maxResponse flush failed', err);
        }
    }, [
        controller.isReplay,
        controller.presetData?.world?.player,
        maxResponseChars,
        openingRouteId,
        openingRoutes,
        persistGameStartConfig,
        sessionPlayerProfile,
        systemPersonaBlocks,
        systemWorldBookEntries,
        systemWritingStyle,
    ]);

    /**
     * 功能注释：设置里拖「最大回复」时本地立即生效，防抖写入 gameStartConfig，
     * 避免滑条拖动时打爆 PUT；点「完成」时走 flush 立即落盘。
     */
    const handleMaxResponseCharsChange = useCallback(
        (chars: number) => {
            const clamped = clampMaxResponseChars(chars);
            if (clamped == null) return;
            setMaxResponseChars(clamped);
            if (controller.isReplay) return;
            if (maxResponsePersistTimerRef.current != null) {
                window.clearTimeout(maxResponsePersistTimerRef.current);
            }
            maxResponsePersistTimerRef.current = window.setTimeout(() => {
                maxResponsePersistTimerRef.current = null;
                void flushMaxResponseCharsPersist(clamped);
            }, 400);
        },
        [controller.isReplay, flushMaxResponseCharsPersist],
    );

    /** 功能注释：完成设置——立即落盘后关弹窗；不离开当前局。 */
    const handleConfirmSettings = useCallback(async () => {
        await flushMaxResponseCharsPersist();
    }, [flushMaxResponseCharsPersist]);

    useEffect(() => {
        return () => {
            if (maxResponsePersistTimerRef.current != null) {
                window.clearTimeout(maxResponsePersistTimerRef.current);
            }
        };
    }, []);

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

    // 详情页先 navigate 再后台建 session：清掉 boot 标记，避免刷新重复开局
    useEffect(() => {
        const state = location.state as {
            bootPending?: boolean;
            bootNewStart?: boolean;
            saveEntry?: string;
        } | null;
        if (state?.bootPending || state?.bootNewStart) {
            navigate(location.pathname, {
                replace: true,
                state: state.saveEntry ? { saveEntry: state.saveEntry } : {},
            });
        }
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        if (!bootPending) return;
        // session 就绪或剧情已开始请求/出字：立刻收起「正在进入」，避免与「剧情展开中」叠两层
        if (
            sessionId
            || controller.isStartingGame
            || controller.stepHandlers.isWaitingForData
            || controller.stepHandlers.currentStep
            || controller.currentMessage
        ) {
            setBootPending(false);
        }
    }, [
        bootPending,
        sessionId,
        controller.isStartingGame,
        controller.stepHandlers.isWaitingForData,
        controller.stepHandlers.currentStep,
        controller.currentMessage,
    ]);

    // 仅「还在等进页/建会话」时全屏提示；一旦开局 stream 或正文出现就不再盖遮罩
    const showBootOverlay =
        !controller.isReplay
        && bootPending
        && !controller.isStartingGame
        && !controller.stepHandlers.isWaitingForData
        && !controller.stepHandlers.currentStep
        && !controller.currentMessage;

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

    const npcNameMap = useMemo(
        () => buildNpcNameReplacementMap(sessionNpcEdits, npcsList),
        [sessionNpcEdits, npcsList],
    );

    const attributeNpcNames = useMemo(() => {
        const names = [
            ...sessionNpcEdits.map((n) => n?.name),
            ...sessionNpcEdits.map((n) => (n as { originalName?: string })?.originalName),
            ...npcsList.map((n) => (n as { name?: string })?.name),
        ];
        return [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))];
    }, [sessionNpcEdits, npcsList]);

    const playerNameMap = useMemo(() => {
        const docName = String(
            (controller.presetData?.world?.player as { name?: string } | undefined)?.name || '',
        ).trim();
        const current = String(sessionPlayerProfile?.name || '').trim();
        return buildPlayerNameReplacementMap({
            currentName: current,
            aliases: [docName, ...playerNameAliases],
        });
    }, [controller.presetData?.world?.player, sessionPlayerProfile?.name, playerNameAliases]);

    const displayNameMap = useMemo(
        () => [...npcNameMap, ...playerNameMap],
        [npcNameMap, playerNameMap],
    );

    const displayNameCollapseList = useMemo(
        () => [
            sessionPlayerProfile?.name,
            ...sessionNpcEdits.map((n) => n?.name),
            ...npcsList.map((n) => (n as { name?: string })?.name),
        ],
        [sessionPlayerProfile?.name, sessionNpcEdits, npcsList],
    );

    const textModeDisplaySteps = useMemo(
        () => applyNameMapToSteps(
            controller.convertStepsToTextModalFormat(controller.allStepsForTextModal),
            displayNameMap,
            displayNameCollapseList,
        ),
        [
            controller.convertStepsToTextModalFormat,
            controller.allStepsForTextModal,
            displayNameMap,
            displayNameCollapseList,
        ],
    );

    const normalModeMessage = useMemo((): Message | null => {
        const msg = controller.currentMessage;
        if (!msg) return null;
        const sessionName = String(sessionPlayerProfile?.name || '').trim();
        const map = displayNameMap;
        const rewrite = (value: string) => applyDisplayNameRewrites(value, map, displayNameCollapseList);
        const options: Message['options'] = Array.isArray(msg.options)
            ? ensureMinPlayChoiceOptions(msg.options.map((opt) => {
                const mapped: { id: number; text: string; isMain?: boolean } = {
                    id: Number(opt.id),
                    text: typeof opt.text === 'string'
                        ? rewrite(opt.text)
                        : String(opt.text ?? ''),
                };
                if (typeof opt.isMain === 'boolean') mapped.isMain = opt.isMain;
                return mapped;
            }), {
                sceneName: controller.currentScene?.name || '',
                npcNames: (controller.presetData?.npcs?.npcs || [])
                    .map((n) => n?.name)
                    .filter(Boolean)
                    .slice(0, 3),
                playerName: sessionName
                    || String(controller.presetData?.world?.player?.name || '').trim()
                    || '你',
            })
            : undefined;
        // 主角台词人名牌：局内档案名优先（改名后立即生效）
        const isPlayerBubble = msg.characterPosition === 'right';
        const rewrittenCharName = typeof msg.characterName === 'string'
            ? rewrite(msg.characterName)
            : msg.characterName;
        // 主角立绘：局内生成头像优先替换文档原图（与人名牌同步即时生效）
        const sessionPortraitPath = resolveSessionPlayerPortraitPath(
            sessionPlayerProfile,
            controller.presetData?.world?.player,
        );
        const sessionPortraitUrl = isPlayerBubble && sessionPortraitPath
            ? (withCacheBust(getImageUrl(sessionPortraitPath)) || undefined)
            : undefined;
        const importedCardPortrait = isPlayerBubble
            && isImportedCardPortraitUrl(sessionPlayerProfile?.avatarUrl);
        const npcSessionAvatarPath = !isPlayerBubble
            ? pickSessionNpcAvatarUrl(sessionNpcEdits, {
                npcId: msg.npcId,
                speakerName: rewrittenCharName || msg.characterName,
            })
            : '';
        const sessionNpcPortraitUrl = npcSessionAvatarPath
            ? (withCacheBust(getImageUrl(npcSessionAvatarPath)) || undefined)
            : undefined;
        const npcDoc = !isPlayerBubble
            ? (controller.presetData?.npcs?.npcs || []).find((n) => {
                if (msg.npcId && String(n?.id || '') === String(msg.npcId)) return true;
                const name = String(n?.name || '').trim();
                return Boolean(name && (name === rewrittenCharName || name === msg.characterName));
            })
            : undefined;
        // 功能注释：必须用创作台文档缩放，禁止用 msg.portraitScale（可能已是导入 0.8 的解析结果）
        const portraitScale = isPlayerBubble
            ? resolvePlayPortraitScale({
                sessionAvatarUrl: sessionPlayerProfile?.avatarUrl,
                documentPortraitScale: controller.presetData?.world?.player?.portraitScale,
            })
            : resolvePlayPortraitScale({
                sessionAvatarUrl: npcSessionAvatarPath,
                documentPortraitScale: npcDoc?.portraitScale ?? msg.portraitScale,
            });
        const npcImportedCardPortrait = Boolean(
            npcSessionAvatarPath && isImportedCardPortraitUrl(npcSessionAvatarPath),
        );
        return {
            id: msg.id,
            type: msg.type,
            message: typeof msg.message === 'string'
                ? rewrite(msg.message)
                : msg.message,
            characterName: isPlayerBubble && sessionName
                ? sessionName
                : rewrittenCharName,
            characterImage: isPlayerBubble
                ? (sessionPortraitUrl || msg.characterImage)
                : (sessionNpcPortraitUrl || msg.characterImage),
            characterPosition: msg.characterPosition,
            portraitScale,
            portraitOffsetX: (importedCardPortrait || npcImportedCardPortrait) ? undefined : msg.portraitOffsetX,
            portraitOffsetY: (importedCardPortrait || npcImportedCardPortrait) ? undefined : msg.portraitOffsetY,
            options,
        };
    }, [
        controller.currentMessage,
        controller.currentScene?.name,
        controller.presetData?.npcs?.npcs,
        controller.presetData?.world?.player,
        displayNameMap,
        displayNameCollapseList,
        sessionPlayerProfile,
        sessionNpcEdits,
    ]);

    const normalModeDisplayText = useMemo(() => {
        const text = controller.finalDisplayText;
        if (!text) return text;
        return applyDisplayNameRewrites(String(text), displayNameMap, displayNameCollapseList);
    }, [controller.finalDisplayText, displayNameMap, displayNameCollapseList]);

    const handleSessionPlayerProfileChange = useCallback((next: SessionPlayerProfile | null) => {
        setSessionPlayerProfile((prev) => {
            const merged = mergeIncomingSessionPlayerProfile(next, prev);
            const oldName = String(prev?.name || '').trim();
            const newName = String(merged?.name || '').trim();
            if (oldName && newName && oldName !== newName) {
                setPlayerNameAliases((aliases) => (
                    aliases.includes(oldName) ? aliases : [...aliases, oldName]
                ));
            }
            return merged;
        });
    }, []);

    // 功能注释：主角头像后台生成完成后写回本局档案（面板已关也能收到）
    useEffect(() => {
        if (!sessionId) return undefined;
        return subscribePlayerAvatarGenComplete((sid, result) => {
            if (sid !== sessionId) return;
            setSessionPlayerProfile((prev) => mergePlayerAvatarIntoProfile(prev, result));
            if (typeof result.remainingPoints === 'number') {
                useAuthStore.getState().updateUser({ points: result.remainingPoints });
            }
            toast.success(
                `头像已生成并保存（-${result.pointsDeducted ?? CHARACTER_GENERATION_COST} 积分）`,
            );
        });
    }, [sessionId]);

    // 功能注释：角色头像后台生成完成后写回列表；未保存的新角色先挂 pending
    useEffect(() => {
        if (!sessionId) return undefined;
        return subscribeNpcAvatarGenComplete((sid, result) => {
            if (sid !== sessionId) return;
            setSessionNpcEdits((prev) => {
                const merged = mergeNpcAvatarIntoProfiles(prev, result);
                const found = merged.some((p) => String(p?.id || '') === result.npcId);
                if (!found) pendingNpcAvatarsRef.current[result.npcId] = result;
                else delete pendingNpcAvatarsRef.current[result.npcId];
                return merged;
            });
            if (typeof result.remainingPoints === 'number') {
                useAuthStore.getState().updateUser({ points: result.remainingPoints });
            }
            toast.success(
                `角色头像已生成（-${result.pointsDeducted ?? CHARACTER_GENERATION_COST} 积分）`,
            );
        });
    }, [sessionId]);

    const applyPendingNpcAvatars = useCallback((profiles: PlayerEditableNpc[]) => {
        let next = profiles;
        const pending = pendingNpcAvatarsRef.current;
        for (const id of Object.keys(pending)) {
            const merged = mergeNpcAvatarIntoProfiles(next, pending[id]);
            if (merged !== next) {
                delete pending[id];
                next = merged;
            }
        }
        return next;
    }, []);

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

    const hydratePlayUiFromServer = useCallback(async () => {
        if (!sessionId || controller.isReplay) return;
        try {
            const data = await fetchPlayUiState(sessionId);
            setEncounteredIds(mergeEncounteredIds(data.encounteredCharacterIds));
            setQuests(normalizeQuests(data.quests));
            if (data.attributePanels && Object.keys(data.attributePanels).length > 0) {
                setAttributePanelsCache(normalizeAttributePanels(data.attributePanels, {
                    npcNames: [
                        ...(Array.isArray(data.playerEditableNpcs)
                            ? data.playerEditableNpcs.map((n) =>
                                (n && typeof n === 'object' && 'name' in n
                                  ? String((n as { name?: string }).name || '')
                                  : ''))
                            : []),
                        ...npcsList.map((n) => String((n as { name?: string })?.name || '')),
                    ],
                }));
            }
            if (Array.isArray(data.playerEditableNpcs)) {
                setSessionNpcEdits((prev) => mergeIncomingNpcProfiles(
                    data.playerEditableNpcs as PlayerEditableNpc[],
                    prev,
                ));
            }
            if (typeof data.ab?.npcGenderPreferPreset === 'boolean') {
                setNpcGenderPreferPresetAb(!!data.ab.npcGenderPreferPreset);
            }
            if (data.sessionPlayerProfile && typeof data.sessionPlayerProfile === 'object') {
                const incoming = data.sessionPlayerProfile as SessionPlayerProfile;
                const docName = resolvePlayerDisplayName([
                    (controller.presetData?.world?.player as { name?: string } | undefined)?.name,
                ]);
                const fixed =
                    isPlaceholderPlayerName(incoming.name) && docName
                        ? { ...incoming, name: docName }
                        : incoming;
                // 本地已有有效自设名时保留姓名，但补齐空人设/空性别；占位名允许整表替换
                // 立绘按时间戳取新，禁止 play-ui 旧快照把刚生成的头像冲掉
                setSessionPlayerProfile((prev) => {
                    if (prev?.name && !isPlaceholderPlayerName(prev.name)) {
                        const mergedPersona =
                            String(prev.persona || '').trim()
                            || (!isMultiChoicePersonaText(fixed.persona) ? String(fixed.persona || '').trim() : '')
                            || prev.persona
                            || '';
                        const picked = mergeIncomingSessionPlayerProfile(fixed, prev);
                        return {
                            ...prev,
                            ...(picked || {}),
                            name: prev.name,
                            persona: mergedPersona,
                            gender: prev.gender || fixed.gender || prev.gender,
                        };
                    }
                    const persona = !isMultiChoicePersonaText(fixed.persona)
                        ? fixed.persona
                        : '';
                    return mergeIncomingSessionPlayerProfile(
                        { ...fixed, persona: persona || fixed.persona || '' },
                        prev,
                    );
                });
                if (docName) {
                    setPlayerNameAliases((prev) => (prev.includes(docName) ? prev : [...prev, docName]));
                }
            }
            const gsc = data.gameStartConfig;
            if (gsc && typeof gsc === 'object') {
                if (typeof gsc.openingRouteId === 'string' && gsc.openingRouteId) {
                    setOpeningRouteId(gsc.openingRouteId);
                }
                if (Array.isArray(gsc.worldBookEntries)) {
                    setSystemWorldBookEntries(gsc.worldBookEntries as GameStartWorldBookEntry[]);
                }
                if (gsc.writingStyle && typeof gsc.writingStyle === 'object') {
                    setSystemWritingStyle(gsc.writingStyle as GameStartWritingStyle);
                }
                const clampedMax = clampMaxResponseChars(
                    (gsc as { maxResponseChars?: unknown }).maxResponseChars,
                );
                if (clampedMax != null) {
                    setMaxResponseChars(clampedMax);
                }
                const player = gsc.player as { personaBlocks?: GameStartPersonaBlocks } | undefined;
                if (player?.personaBlocks) {
                    setSystemPersonaBlocks(player.personaBlocks);
                }
            }
        } catch {
            /* 旧局无字段时忽略 */
        }
    }, [sessionId, controller.isReplay, controller.presetData?.world?.player, npcsList]);

    /** 文档主角名就绪后，纠正本地仍是占位名的档案 */
    useEffect(() => {
        const docPlayer = controller.presetData?.world?.player as
            | { name?: string; gender?: string }
            | undefined;
        const docName = resolvePlayerDisplayName([docPlayer?.name]);
        if (!docName) return;
        setSessionPlayerProfile((prev) => {
            if (!prev || !isPlaceholderPlayerName(prev.name)) return prev;
            return {
                ...prev,
                name: docName,
                gender: normalizeGameStartGender(prev.gender || docPlayer?.gender),
            };
        });
    }, [controller.presetData?.world?.player]);

    /** 单侧：仅首屏可交互时拉一次 play-ui（不与面板打开叠加） */
    const firstScreenInteractive = Boolean(
        controller.gameStarted
        && !controller.isStartingGame
        && !controller.isReplay
        && !controller.showStoryIntro
        && (controller.currentMessage || controller.stepHandlers?.currentStep),
    );

    useEffect(() => {
        if (!sessionId || controller.isReplay) return;
        if (!firstScreenInteractive) return;
        if (playUiHydrateInFlightRef.current) return;
        playUiHydrateInFlightRef.current = true;
        void ensurePlayUiHydratedOnce(sessionId, hydratePlayUiFromServer).finally(() => {
            playUiHydrateInFlightRef.current = false;
        });
    }, [sessionId, controller.isReplay, firstScreenInteractive, hydratePlayUiFromServer]);

    useEffect(() => {
        if (!sessionId) return;
        return () => {
            resetPlayUiHydrationGate(sessionId);
        };
    }, [sessionId]);

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
        if (
            shouldSkipAttributeAutoRefresh({
                isStreaming: attrsStreamingRef.current,
                lastStartedAt: attrsLastStartedAtRef.current,
                now: Date.now(),
            })
        ) {
            return;
        }
        attrsAbortRef.current?.abort();
        const controllerAbort = new AbortController();
        attrsAbortRef.current = controllerAbort;
        attrsStreamingRef.current = true;
        attrsLastStartedAtRef.current = Date.now();
        try {
            const result = await streamAttributePanels<{
                panels: Record<string, string>;
                playerEditableNpcs?: unknown[];
            }>(
                sessionId,
                {},
                controllerAbort.signal
            );
            if (controllerAbort.signal.aborted) return;
            if (result?.panels && typeof result.panels === 'object') {
                const normalizedPanels = normalizeAttributePanels(result.panels, {
                    npcNames: attributeNpcNames,
                });
                if (hasNonEmptyPanelText(normalizedPanels)) {
                    setAttributePanelsCache(normalizedPanels);
                }
            }
            if (Array.isArray(result?.playerEditableNpcs)) {
                setSessionNpcEdits((prev) => mergeIncomingNpcProfiles(
                    result.playerEditableNpcs as PlayerEditableNpc[],
                    prev,
                ));
            }
        } catch (e: unknown) {
            if (isAbortError(e) || (e as Error)?.name === 'AbortError') return;
        } finally {
            if (attrsAbortRef.current === controllerAbort) {
                attrsStreamingRef.current = false;
            }
        }
    }, [sessionId, controller.isReplay, attributeNpcNames]);

    const refreshQuests = useCallback(async (opts?: { background?: boolean }) => {
        if (!sessionId || controller.isReplay) return;
        if (
            shouldSkipQuestAutoRefresh({
                isStreaming: questsStreamingRef.current,
                lastStartedAt: questsLastStartedAtRef.current,
                now: Date.now(),
            })
        ) {
            return;
        }
        const plan = resolveQuestsPanelRefreshPlan(questsRef.current);
        const background = opts?.background ?? plan.hasCache;
        questsAbortRef.current?.abort();
        const controllerAbort = new AbortController();
        questsAbortRef.current = controllerAbort;
        questsStreamingRef.current = true;
        questsLastStartedAtRef.current = Date.now();
        if (background) {
            setQuestsRefreshing(true);
        } else {
            setQuestsLoading(true);
        }
        setQuestsError(null);
        try {
            // 无本地缓存时先拉 mode=cache / play-ui 同源持久化，页面先有数
            if (!plan.hasCache) {
                try {
                    const cached = await fetchCachedQuests(sessionId, controllerAbort.signal);
                    if (controllerAbort.signal.aborted) return;
                    if (cached?.quests?.length) {
                        setQuests((prev) => mergeQuests(prev, cached.quests));
                        setQuestsLoading(false);
                        setQuestsRefreshing(true);
                    }
                } catch {
                    /* 缓存失败仍走 LLM */
                }
            }

            const result = await streamQuests(
                sessionId,
                {
                    onError: (msg) => {
                        if (msg === 'INVALID_JSON') {
                            if (questsRef.current.length > 0) {
                                setQuestsError(null);
                                return;
                            }
                            setQuestsError(t('galgame.panelQuestsInvalid'));
                            return;
                        }
                        // 功能注释：会话写锁忙（含历史 Failed to acquire lock 文案）
                        if (
                            msg === 'Session is busy' ||
                            msg === 'LOCKED' ||
                            /Failed to acquire lock/i.test(msg || '') ||
                            /Lock acquisition timeout/i.test(msg || '')
                        ) {
                            setQuestsError(t('galgame.panelAttrsBusy'));
                            return;
                        }
                        if (msg === 'PERSIST_FAILED') {
                            if (questsRef.current.length > 0) {
                                setQuestsError(null);
                                return;
                            }
                            setQuestsError(t('galgame.panelQuestsInvalid'));
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
            if (questsRef.current.length === 0) {
                setQuestsError(e instanceof Error ? e.message : t('galgame.requestError'));
            }
        } finally {
            if (questsAbortRef.current === controllerAbort) {
                setQuestsLoading(false);
                setQuestsRefreshing(false);
                questsStreamingRef.current = false;
            }
        }
    }, [sessionId, controller.isReplay, t]);

    // 属性：每轮剧情结束后自动 LLM 更新；打开空面板时补一次；失败可重试
    const attrsLastAutoTurnRef = useRef(false);
    useEffect(() => {
        if (controller.isReplay || !sessionId || !controller.gameStarted) return;
        const waiting = Boolean(controller.stepHandlers?.isWaitingForData);
        // 等待 → 结束：本轮叙事落盘完成，刷属性
        if (attrsLastAutoTurnRef.current && !waiting) {
            void refreshAttributePanels();
        }
        attrsLastAutoTurnRef.current = waiting;
    }, [
        sessionId,
        controller.isReplay,
        controller.gameStarted,
        controller.stepHandlers?.isWaitingForData,
        refreshAttributePanels,
    ]);

    // 任务：每轮剧情结束后后台刷新，与属性面板对齐，避免完成态/截止时间滞后
    const questsLastAutoTurnRef = useRef(false);
    useEffect(() => {
        if (controller.isReplay || !sessionId || !controller.gameStarted) return;
        const waiting = Boolean(controller.stepHandlers?.isWaitingForData);
        if (questsLastAutoTurnRef.current && !waiting) {
            void refreshQuests({ background: true });
        }
        questsLastAutoTurnRef.current = waiting;
    }, [
        sessionId,
        controller.isReplay,
        controller.gameStarted,
        controller.stepHandlers?.isWaitingForData,
        refreshQuests,
    ]);

    // 打开属性/任务面板：缓存先展示；任务 LLM 异步 merge（不因有缓存而跳过）
    useEffect(() => {
        if (!activePlayPanel) {
            panelLlmTriedRef.current = null;
            return;
        }
        if (controller.isReplay || !sessionId || !controller.gameStarted) return;

        if (activePlayPanel === 'attrs') {
            if (Object.keys(attributePanelsCache).length > 0) return;
            if (panelLlmTriedRef.current === 'attrs') return;
            panelLlmTriedRef.current = 'attrs';
            void refreshAttributePanels().finally(() => {
                // 空结果不锁死：关闭/再开或点「刷新」可再试
                panelLlmTriedRef.current = null;
            });
            return;
        }
        if (activePlayPanel === 'quests') {
            if (panelLlmTriedRef.current === 'quests') return;
            panelLlmTriedRef.current = 'quests';
            const plan = resolveQuestsPanelRefreshPlan(questsRef.current);
            void refreshQuests({ background: plan.hasCache }).finally(() => {
                panelLlmTriedRef.current = null;
            });
        }
    }, [
        activePlayPanel,
        sessionId,
        controller.isReplay,
        controller.gameStarted,
        attributePanelsCache,
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
                    className={`${styles.mainContent} ${characterAnimation === 'injury' ? styles.worldInjury : ''}${controller.isTextMode ? ` ${styles.mainContentTextMode}` : ''}`}
                    style={{
                        backgroundColor: 'transparent',
                        position: 'relative',
                    }}
                >
                    <GameBackgroundRenderer
                        src={controller.backgroundImage}
                        className={`${styles.gameBackground}${controller.isTextMode ? ` ${styles.gameBackgroundTextMode}` : ''}`}
                        useCanvas={true}
                        transitionDuration={300}
                    />
                    {controller.isTextMode ? (
                        <div className={styles.textModeBgScrim} aria-hidden="true" />
                    ) : null}
                    {showBootOverlay && (
                        <div className={styles.bootOverlay} aria-busy="true">
                            <div className="loadingSpinner" />
                            <div className={styles.bootOverlayText}>
                                {t('common.fullPageLoading.enteringGame')}
                            </div>
                        </div>
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
                        {!controller.isReplay && controller.gameStarted && !controller.showGalgameHistory ? (
                            <button
                                type="button"
                                className={styles.topExportButton}
                                disabled={!sessionId || !fileId || controller.history.length === 0}
                                onClick={() => {
                                    logVisualButtonClick('export_visual_novel');
                                    setIsExportNovelOpen(true);
                                }}
                                aria-label={t('galgame.exportVisualNovel')}
                            >
                                <span className={styles.topExportButtonInner}>
                                    <MdAutoStories aria-hidden />
                                    <span>{t('galgame.exportShort')}</span>
                                </span>
                            </button>
                        ) : (
                            <div className={styles.topExportSpacer} aria-hidden />
                        )}
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
                    {normalModeMessage?.characterImage && !controller.isTextMode && (
                        <CharacterLayer
                            characterImage={normalModeMessage.characterImage}
                            characterPosition={normalModeMessage.characterPosition}
                            portraitScale={normalModeMessage.portraitScale}
                            portraitOffsetX={normalModeMessage.portraitOffsetX}
                            portraitOffsetY={normalModeMessage.portraitOffsetY}
                            animation={characterAnimation}
                        />
                    )}
                    <div className={`${styles.gameContentWrapper} ${controller.isTextMode ? styles.gameContentWrapperTextMode : ''}`}>
                        {!controller.showGalgameHistory && !controller.isTextMode && (
                            <>
                                <NormalModeDisplay
                                    currentMessage={normalModeMessage}
                                    finalDisplayText={normalModeDisplayText}
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
                                key="galgame-text-mode-display"
                                steps={textModeDisplaySteps}
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
                    {/* 顶栏任务追踪（与任务面板同源）；文本模式隐藏，避免与可滚动正文重叠 */}
                    {!controller.isTextMode && !controller.isReplay && controller.gameStarted && questTrackerText ? (
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
                                <div className={styles.buttonSlot}>
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
                                </div>
                                <div className={styles.buttonSlot}>
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
                                </div>
                                <div className={styles.buttonSlot}>
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
                                </div>
                                <div className={styles.buttonSlot}>
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
                                </div>
                            </>
                        )}
                        {controller.isReplay && (
                            <div className={styles.buttonSlot}>
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
                            </div>
                        )}
                        <div className={styles.buttonSlot}>
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
                        </div>
                        {controller.isReplay && (
                            <div className={styles.buttonSlot}>
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
                            </div>
                        )}
                            </>
                        )}
                    </div>

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
                        onConfirmSettings={
                            controller.isReplay ? undefined : handleConfirmSettings
                        }
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
                        maxResponseChars={maxResponseChars}
                        maxResponseCharsMin={GAME_START_LIMITS.maxResponseChars.min}
                        maxResponseCharsMax={GAME_START_LIMITS.maxResponseChars.max}
                        onMaxResponseCharsChange={
                            controller.isReplay ? undefined : handleMaxResponseCharsChange
                        }
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
                                editableProfiles={sessionNpcEdits}
                                onProfilesChange={(profiles) => {
                                    setSessionNpcEdits(applyPendingNpcAvatars(profiles));
                                }}
                                sessionPlayerProfile={sessionPlayerProfile}
                                onSessionPlayerProfileChange={handleSessionPlayerProfileChange}
                                preferPresetGenderAb={npcGenderPreferPresetAb}
                                displayNameMap={displayNameMap}
                                displayNameCollapseList={displayNameCollapseList}
                                narrativeBusy={isNarrativeGenerationBusy({
                                    streamLoading: controller.stepHandlers?.loading,
                                    isCompressingContext: controller.stepHandlers?.isCompressingContext,
                                })}
                            />
                            <AttributesPanel
                                isOpen={activePlayPanel === 'attrs'}
                                onClose={() => setActivePlayPanel(null)}
                                suppressAutoRefresh
                                cachedPanels={attributePanelsCache}
                                onPanelsUpdated={setAttributePanelsCache}
                                sessionPlayerProfile={sessionPlayerProfile}
                                onSessionPlayerProfileChange={handleSessionPlayerProfileChange}
                                npcNames={attributeNpcNames}
                                documentPlayerName={
                                    (controller.presetData?.world?.player as { name?: string } | undefined)
                                        ?.name || null
                                }
                                documentPlayerGender={
                                    (controller.presetData?.world?.player as { gender?: string } | undefined)
                                        ?.gender || null
                                }
                                documentPlayerAvatarUrl={getPlayerImageUrl(
                                    controller.presetData?.world?.player,
                                ) || null}
                                onHistoryMaybeChanged={() => {
                                    void controller.refreshHistory();
                                }}
                                onPlayerEditableNpcsUpdated={(profiles) => {
                                    setSessionNpcEdits((prev) => mergeIncomingNpcProfiles(
                                        profiles as PlayerEditableNpc[],
                                        prev,
                                    ));
                                }}
                            />
                            <QuestsPanel
                                isOpen={activePlayPanel === 'quests'}
                                onClose={() => setActivePlayPanel(null)}
                                quests={quests}
                                loading={questsLoading}
                                refreshing={questsRefreshing}
                                error={questsError}
                            />
                            <SystemsPanel
                                isOpen={activePlayPanel === 'systems'}
                                onClose={() => setActivePlayPanel(null)}
                                morePromptForms={morePromptForms}
                                openingRoutes={openingRoutes}
                                currentOpeningRouteId={openingRouteId || openingRoutes[0]?.id || ''}
                                initialWorldBookEntries={systemWorldBookEntries}
                                initialWritingStyle={systemWritingStyle}
                                initialPersonaBlocks={systemPersonaBlocks}
                                onPersistSystemConfig={handlePersistSystemConfig}
                                routeChangeDisabled={controller.isReplay || controller.isStartingGame}
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
                                const resp = await savesApi.getDetail(item.saveId, fileId);
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
