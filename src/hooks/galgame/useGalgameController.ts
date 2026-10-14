import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useGameStore } from "../../store/gameStore";
import { createGalgameActionId, useGalgameStep } from "./useGalgameStep";
import useGalgameHistory from "./useGalgameHistory";
import { useStoryTyping } from "../story/useStoryTyping";
import { useGalgameMessage } from "./useGalgameMessage";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { ContextMemoryDebug, ContextMemoryStatus, GetGalgamePresetResponse, History } from "../../api/galgame/getGalgamePreset.type";
import { getImageUrl, getPlayerImageUrl, DEFAULT_SCENE_IMAGE } from "../../utils/constants";
import { extractChoiceFromHistory, extractPlainText, parseHistoryToSteps } from "../../utils/textUtils";
import statisticsApi from "../../api/statistics/statisticsApi";
import toast from "react-hot-toast";
import replayApi from "../../api/galgame/replay";
import { stripImageCacheBust, withCacheBust } from "../../utils/imageCache";
import { gameResourceManager } from "../../utils/gameResourceManager";
import { canSubmitChoiceInteraction } from "../../lib/galgame/choiceInteractionGate";
import { choiceStepHasPlayableOptions } from "../../lib/galgame/playChoiceOptions";
import { fetchGalgameDocument, peekGalgameDocument } from "../../lib/galgame/galgameDocumentCache";
import {
    pickSessionNpcAvatarUrl,
    resolveNpcPlayImagePath,
    resolveRawBridgeDialogueImagePath,
} from "../../lib/galgame/npcPlayPortrait";
import {
    buildScenePreloadPlan,
    drainLeadingSceneChanges,
    getSceneImagePathFromScene,
    SceneImagePreloadScheduler,
    uniquePreserveOrder,
} from "../../lib/galgame/sceneImagePreload";
import {
    GENERATION_BUSY_MAX_RETRIES,
    getGenerationBusyRetryDelayMs,
    isGenerationBusyError,
} from "../../lib/galgame/choiceStepDisplayGate";
import { isAliyunFrontendRuntime } from "../../lib/aliyunFrontendRuntime";
import { shouldSkipTypewriterForRawTextBridge } from "../../lib/story/rawTextStreamPolicy";

export type { Message } from "./useGalgameMessage";

export type ReplaySpeed = 0.5 | 1 | 1.5 | 2;

type ReplayStep = {
    id?: string | number;
    type?: string;
    content?: string;
    sceneId?: string | null;
    sceneImage?: string;
    isPlayer?: boolean;
    is_player?: boolean;
    [key: string]: unknown;
};

const REPLAY_SPEED_OPTIONS: ReplaySpeed[] = [0.5, 1, 1.5, 2];
const REPLAY_PAGE_SIZE = 200;
const REPLAY_PREFETCH_REMAINING = 40;
const REQUEST_TIMEOUT_MS = 60000;
const COMPRESSION_REQUEST_TIMEOUT_MS = 180000;

const sceneImagePreloader = new SceneImagePreloadScheduler({
    loader: (url) => gameResourceManager.loadImage(url, { decode: true }),
    isLoaded: (url) => gameResourceManager.isLoaded(url),
});

function pickMainOption(options?: Array<{ id: number; text: string; isMain?: boolean }>) {
    if (!Array.isArray(options) || options.length === 0) return null;
    return options.find((option) => option?.isMain) || options[0] || null;
}

/** 将会话历史还原为文本模式 steps，用户回合记为 isPlayer 台词 */
function buildCompletedStepsFromConversationHistory(
    messages: History[],
    playerName: string,
): any[] {
    const steps: any[] = [];
    const speaker = String(playerName || '').trim() || 'Player';

    messages.forEach((message, messageIndex) => {
        const content = String(message?.content || '').trim();
        if (!content) return;

        if (message.role === 'user') {
            steps.push({
                id: `history-user-${messageIndex}`,
                type: 'dialogue',
                isPlayer: true,
                speakerName: speaker,
                content,
            });
            return;
        }

        if (message.role !== 'assistant') return;

        const parsed = parseHistoryToSteps(content);
        parsed.forEach((step: any, stepIndex: number) => {
            steps.push({
                ...step,
                id: step?.id || `history-assistant-${messageIndex}-${stepIndex}`,
            });
        });
    });

    return steps;
}

export const useGalgameController = (options?: {
    bootNewStart?: boolean;
    /** 局内档案头像；有则主线立绘优先用它替换文档原图 */
    sessionPlayerAvatarUrl?: string | null;
    /** 局内档案角色名；选项文案优先用此名 */
    sessionPlayerName?: string | null;
    /** 局内 NPC 档案；出场立绘优先用 avatarUrl 替换创作台旧图 */
    sessionNpcEdits?: Array<{
        id?: string | null;
        name?: string | null;
        originalName?: string | null;
        avatarUrl?: string | null;
    }> | null;
}) => {
    const { user } = useAuthStore();
    const { fileId, sessionId } = useGameStore();
    const navigate = useNavigate();
    const { replayId: replayIdParam } = useParams<{ replayId?: string }>();
    const [searchParams] = useSearchParams();
    const bootNewStart = options?.bootNewStart === true;
    const sessionPlayerAvatarUrl = String(options?.sessionPlayerAvatarUrl || '').trim();
    const sessionPlayerName = String(options?.sessionPlayerName || '').trim();
    const sessionNpcEdits = options?.sessionNpcEdits || null;

    // 回放模式检测
    const replayId = replayIdParam || searchParams.get('replayId');
    const mode = searchParams.get('mode');
    const isReplay = useMemo(() => (mode === 'replay' && !!replayId) || !!replayIdParam, [mode, replayId, replayIdParam]);
    const isPublicReplayRoute = useMemo(() => !!replayIdParam, [replayIdParam]);
    const playableSessionId = isReplay ? null : sessionId;

    // 存储完整 allSteps 的 key（按 sessionId 隔离）
    const allStepsStorageKey = useMemo(() => {
        return playableSessionId ? `galgame-allsteps-${playableSessionId}` : 'galgame-allsteps';
    }, [playableSessionId]);

    const [backgroundImage, setBackgroundImage] = useState<string>('');
    /** 功能注释：Aliyun raw bridge 旁路立绘（不依赖 currentStep 转成 dialogue） */
    const [rawBridgePortrait, setRawBridgePortrait] = useState<{
        characterImage: string;
        characterPosition: 'left' | 'right';
        portraitScale?: number;
        portraitOffsetX?: number;
        portraitOffsetY?: number;
    } | null>(null);
    const [currentScene, setCurrentScene] = useState<GetGalgamePresetResponse['scenes']['scenes'][0] | null>(null);
    const [worldSetting, setWorldSetting] = useState<GetGalgamePresetResponse['world'] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [initialMessages, setInitialMessages] = useState<any[]>([]);
    const [showStoryIntro, setShowStoryIntro] = useState<boolean>(false);
    /** 新开局无弹窗：历史为空时触发一次自动「开始游戏」 */
    const [shouldAutoStartGame, setShouldAutoStartGame] = useState<boolean>(false);
    const [isStartingGame, setIsStartingGame] = useState<boolean>(false);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
    const [presetData, setPresetData] = useState<GetGalgamePresetResponse | null>(null);
    const [showGalgameHistory, setShowGalgameHistory] = useState<boolean>(false);
    const [isTextMode, setIsTextMode] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<any[]>([]);
    const [replayFinished, setReplayFinished] = useState<boolean>(false);
    const [requestTimeoutVisible, setRequestTimeoutVisible] = useState<boolean>(false);
    const [errorModalVisible, setErrorModalVisible] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [replayMeta, setReplayMeta] = useState<any>(null);
    const [replaySteps, setReplaySteps] = useState<ReplayStep[]>([]);
    const [replayIndex, setReplayIndex] = useState<number>(0);
    const [replayTotalSteps, setReplayTotalSteps] = useState<number>(0);
    const [replayLoadedOffset, setReplayLoadedOffset] = useState<number>(0);
    const [replayHasMore, setReplayHasMore] = useState<boolean>(false);
    const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
    const [liveContextMemory, setLiveContextMemory] = useState<ContextMemoryStatus | null>(null);
    const [memoryDebugOpen, setMemoryDebugOpen] = useState<boolean>(false);
    const [memoryDebugData, setMemoryDebugData] = useState<ContextMemoryDebug | null>(null);
    const [memoryDebugLoading, setMemoryDebugLoading] = useState<boolean>(false);
    const [isAutoToCompression, setIsAutoToCompression] = useState<boolean>(false);

    const currentRequestIdRef = useRef<number>(0);
    const historyProcessedRef = useRef<boolean>(false);
    const requestTimeoutRef = useRef<number | null>(null);
    const [streamActivityTick, setStreamActivityTick] = useState<number>(0);
    const lastStreamActivityTickRef = useRef<number>(0);
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);
    const presetDataLoadedRef = useRef<string>('');
    const lastRefreshRequestIdRef = useRef<number>(0);
    const refreshHistoryAfterTypingRef = useRef<(() => Promise<void>) | null>(null);
    const lastRequestActionRef = useRef<string | null>(null); // 保存最后一次请求的 action
    const lastRequestActionIdRef = useRef<string | null>(null);
    const lastAutoResendRef = useRef<{ content: string; ts: number } | null>(null);
    const replayStepsRef = useRef<ReplayStep[]>([]);
    const replayLoadingPageRef = useRef<boolean>(false);
    const replayLoadedOffsetRef = useRef<number>(0);
    const replayHasMoreRef = useRef<boolean>(false);
    const autoToCompressionStartCountRef = useRef<number | null>(null);
    const autoToCompressionCompletedRef = useRef<boolean>(false);

    const {
        history,
        refreshHistory,
        loadMoreBefore,
        hasMoreBefore,
        loadingMoreBefore,
        loading: historyLoading,
        historyBootstrapped,
        editHistory,
        historyTotal,
        contextMemory: historyContextMemory,
        lastVisitedSceneId,
        appendLocalUserMessage,
    } = useGalgameHistory({
        disabled: isReplay,
        skipInitialFetch: bootNewStart,
    });

    // 根据 assistant 消息数量计算当前是第几回合（用于前几回合免费 / UI 提示）
    const assistantRoundCount = useMemo(() => {
        return history.filter((h: any) => h.role === 'assistant').length;
    }, [history]);

    const FREE_ROUNDS = 30;
    const isFreeRound = assistantRoundCount < FREE_ROUNDS;

    const getPlayerImageUrlCallback = useCallback((): string | undefined => {
        const imageUrl = sessionPlayerAvatarUrl || getPlayerImageUrl(worldSetting?.player);
        return imageUrl ? withCacheBust(getImageUrl(imageUrl)) : undefined;
    }, [worldSetting, sessionPlayerAvatarUrl]);

    const getSceneImagePath = useCallback((scene?: GetGalgamePresetResponse['scenes']['scenes'][0] | null): string | undefined => {
        return getSceneImagePathFromScene(scene as any);
    }, []);

    const toSceneBackgroundUrl = useCallback((imagePath?: string | null): string => {
        if (!imagePath) return '';
        const imageUrl = getImageUrl(imagePath);
        return imageUrl ? withCacheBust(imageUrl) : '';
    }, []);

    const createChoiceMessage = useCallback((choiceData: ReturnType<typeof extractChoiceFromHistory>) => {
        if (!choiceData) return null;
        
        return {
            id: Date.now(),
            type: 'choice' as const,
            message: choiceData.title
                ? (choiceData.text ? `${choiceData.title}\n${choiceData.text}` : choiceData.title)
                : (choiceData.text || '请选择你的行动'),
            options: choiceData.options.map((opt, index) => ({
                id: index + 1,
                text: extractPlainText(opt),
            })),
            characterImage: getPlayerImageUrlCallback(),
            characterPosition: 'right' as const,
        };
    }, [getPlayerImageUrlCallback]);

    // 兜底：整串 steps 里没有任何「带可点选项」的 choice 时，才补空 choice（仅自定义输入）。
    // 须认 mainOptions，禁止因 options=[] 而盖掉已有主线选项。
    const ensureChoiceStep = useCallback((steps: any[]): any[] => {
        if (!Array.isArray(steps) || steps.length === 0) return steps;
        if (steps.some((s: any) => choiceStepHasPlayableOptions(s))) {
            return steps;
        }
        // 已有 choice 步（即便暂无选项）也不再追加第二个空 choice，避免盖住真实选项步
        if (steps.some((s: any) => s?.type === 'choice')) {
            return steps;
        }
        return [
            ...steps,
            {
                type: 'choice',
                content: '',
                title: undefined,
                description: '',
                options: [],
            },
        ];
    }, []);

    const resetDisplayedSteps = useCallback(() => {
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;
    }, []);

    useEffect(() => {
        replayStepsRef.current = replaySteps;
    }, [replaySteps]);

    // 资源切换时重置状态（含续玩换 session）
    useEffect(() => {
        historyProcessedRef.current = false;
        resetDisplayedSteps();
        setInitialMessages([]);
        setGameStarted(false);
        setShowStoryIntro(false);
        setShouldAutoStartGame(false);
        setIsStartingGame(false);
        setReplaySteps([]);
        setReplayIndex(0);
        setReplayTotalSteps(0);
        setReplayLoadedOffset(0);
        setReplayHasMore(false);
        replayLoadedOffsetRef.current = 0;
        replayHasMoreRef.current = false;
        replayLoadingPageRef.current = false;
        setReplaySpeed(1);
        setIsAutoPlay(false);
        setLiveContextMemory(null);
        setMemoryDebugOpen(false);
        setMemoryDebugData(null);
        setIsAutoToCompression(false);
        autoToCompressionStartCountRef.current = null;
        autoToCompressionCompletedRef.current = false;
        // 强制重置加载标记，确保换作品/回放时数据重新加载
        presetDataLoadedRef.current = '';
    }, [fileId, sessionId, isReplay, replayId]);

    useEffect(() => {
        if (!isReplay || !replayId) {
            setReplayMeta(null);
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                const response = await replayApi.getReplayMeta(replayId);
                if (!cancelled) {
                    setReplayMeta(response.data?.replay || null);
                }
            } catch (error) {
                if (!cancelled) {
                    setReplayMeta(null);
                    console.error('[Replay] Failed to load replay meta:', error);
                    toast.error('Failed to load replay.');
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [isReplay, replayId]);

    const loadPresetData = useCallback(async () => {
        const targetFileId = isReplay ? String(replayMeta?.fileId || '') : String(fileId || '');
        if (!targetFileId) {
            // 无 fileId 时不能一直转圈（常见于加载存档漏写 store.fileId）
            setIsLoading(false);
            return;
        }

        if (presetDataLoadedRef.current === targetFileId) {
            return;
        }

        const applyDocumentData = (documentData: GetGalgamePresetResponse) => {
            setPresetData(documentData);
            setWorldSetting(documentData.world);
            const scenes = documentData.scenes?.scenes;

            if (scenes && scenes.length > 0) {
                let initialScene = scenes[0];

                // 优先使用当前场景自己的图片
                let sceneImagePath = getSceneImagePath(initialScene);

                // 如果当前场景没有配置图片，则回退到第一个有图片的场景
                if (!sceneImagePath) {
                    const sceneWithImage = scenes.find(
                        (s: any) => !!getSceneImagePath(s)
                    );
                    if (sceneWithImage) {
                        sceneImagePath = getSceneImagePath(sceneWithImage);
                    }
                }

                let sceneImageUrl = toSceneBackgroundUrl(sceneImagePath);

                // 最后兜底：如果还是拿不到有效图片，用内置默认场景图
                if (!sceneImageUrl) {
                    sceneImageUrl = DEFAULT_SCENE_IMAGE;
                }

                setCurrentScene(initialScene);
                setBackgroundImage(sceneImageUrl);
                // 续玩场景对齐改由 useGalgameHistory 的 lastVisitedSceneId 驱动，避免再打 history?limit=1
            }
        };

        // 详情页预取已完成：同步灌入，立刻结束全屏「正在获取数据」
        const peeked = peekGalgameDocument(targetFileId);
        if (peeked) {
            presetDataLoadedRef.current = targetFileId;
            applyDocumentData(peeked);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            presetDataLoadedRef.current = targetFileId;
            // 优先走详情页预取缓存，避免进 /galgame 再等一整轮 document
            const response = await fetchGalgameDocument(targetFileId);

            if (response.data.data) {
                applyDocumentData(response.data.data);
            } else {
                console.warn('[GalgameController] response.data.data 为空');
            }
        } catch (error) {
            console.error('[GalgameController] 获取游戏数据失败:', error);
            presetDataLoadedRef.current = '';
        } finally {
            setIsLoading(false);
        }
    }, [fileId, isReplay, replayMeta?.fileId, getSceneImagePath, toSceneBackgroundUrl]);

    useEffect(() => {
        // 仅在作品切换时重置；session 变化不再重拉 document（避免二次全屏转圈）
        presetDataLoadedRef.current = '';
        void loadPresetData();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意不跟 playableSessionId，避免续玩二次 loading
    }, [fileId, isReplay, replayMeta?.fileId]);

    // 根据场景 ID 更新场景和背景图
    const getLatestSceneById = useCallback((sceneId?: string | null) => {
        if (!sceneId || !presetData) {
            return null;
        }

        const scenes = presetData.scenes?.scenes;
        if (!scenes || scenes.length === 0) {
            return null;
        }

        return scenes.find(
            (scene: GetGalgamePresetResponse['scenes']['scenes'][0]) => 
                scene.id === sceneId
        ) || null;
    }, [presetData]);

    const updateSceneFromId = useCallback((sceneId: string | null) => {
        const matchedScene = getLatestSceneById(sceneId);

        if (matchedScene) {
            setCurrentScene(matchedScene);

            const sceneImagePath = getSceneImagePath(matchedScene);
            if (sceneImagePath) {
                const sceneImageUrl = toSceneBackgroundUrl(sceneImagePath);
                if (sceneImageUrl) {
                    setBackgroundImage(sceneImageUrl);
                }
            }
        } else {
            console.warn('[Galgame] 未找到匹配的场景 ID:', sceneId);
        }
    }, [getLatestSceneById, getSceneImagePath, toSceneBackgroundUrl]);

    // 历史返回后对齐当前场景（复用 limit=80 结果里的 visitedScenes，不再单独请求）
    useEffect(() => {
        if (isReplay || !lastVisitedSceneId || !presetData) return;
        updateSceneFromId(lastVisitedSceneId);
    }, [isReplay, lastVisitedSceneId, presetData, updateSceneFromId]);

    const syncReplaySceneForIndex = useCallback((steps: ReplayStep[], index: number) => {
        for (let i = Math.min(index, steps.length - 1); i >= 0; i--) {
            const step = steps[i];
            if (!step || step.type !== 'scene_change') {
                continue;
            }

            if (step.sceneId) {
                updateSceneFromId(step.sceneId);
            }

            const latestSceneImagePath = getSceneImagePath(getLatestSceneById(step.sceneId));
            const sceneImagePath = latestSceneImagePath || step.sceneImage;
            if (sceneImagePath) {
                const sceneImageUrl = toSceneBackgroundUrl(sceneImagePath);
                if (sceneImageUrl) {
                    setBackgroundImage(sceneImageUrl);
                }
            }
            return;
        }
    }, [updateSceneFromId, getLatestSceneById, getSceneImagePath, toSceneBackgroundUrl]);

    const contextMemoryDebugEnabled = (liveContextMemory || historyContextMemory)?.debugEnabled === true;

    const fetchContextMemoryDebug = useCallback(async (retryEmpty = false) => {
        if (!contextMemoryDebugEnabled || !playableSessionId) {
            return null;
        }

        try {
            setMemoryDebugLoading(true);
            for (let attempt = 0; attempt < (retryEmpty ? 3 : 1); attempt += 1) {
                const response = await getGalgamePresetApi.getGalgameHistory(playableSessionId, {
                    limit: 1,
                    direction: 'before',
                    debugContextMemory: 1,
                });
                const debugData = response.data?.contextMemoryDebug || null;
                setMemoryDebugData(debugData);
                if (debugData?.current || !retryEmpty || attempt === 2) {
                    return debugData;
                }
                await new Promise((resolve) => window.setTimeout(resolve, 350));
            }
            return null;
        } catch (error) {
            console.error('[Galgame] Failed to load context memory debug:', error);
            toast.error('加载记忆调试信息失败。');
            return null;
        } finally {
            setMemoryDebugLoading(false);
        }
    }, [contextMemoryDebugEnabled, playableSessionId]);

    const openContextMemoryDebug = useCallback(async () => {
        if (!contextMemoryDebugEnabled) {
            return;
        }
        setMemoryDebugOpen(true);
        await fetchContextMemoryDebug();
    }, [contextMemoryDebugEnabled, fetchContextMemoryDebug]);

    const stopAutoToCompressionAndOpenDebug = useCallback(async () => {
        if (autoToCompressionCompletedRef.current) {
            return;
        }
        autoToCompressionCompletedRef.current = true;
        setIsAutoToCompression(false);
        setIsAutoPlay(false);
        await fetchContextMemoryDebug(true);
        setMemoryDebugOpen(true);
    }, [fetchContextMemoryDebug]);

    const noteStreamActivity = useCallback((data?: any) => {
        if (data?.type === 'error' && data?.code === 'ACTION_IN_PROGRESS' && refreshHistoryAfterTypingRef.current) {
            void refreshHistoryAfterTypingRef.current();
        }
        const now = Date.now();
        if (now - lastStreamActivityTickRef.current < 1000) {
            return;
        }
        lastStreamActivityTickRef.current = now;
        setStreamActivityTick((value) => value + 1);
    }, []);

    const applyRawTextBridgeSceneChange = useCallback((sceneStep: any) => {
        if (!sceneStep || String(sceneStep.type || '') !== 'scene_change') return;
        if (sceneStep.sceneId) {
            updateSceneFromId(String(sceneStep.sceneId));
        }
        const latestSceneImagePath = getSceneImagePath(getLatestSceneById(sceneStep.sceneId));
        const sceneImagePath = latestSceneImagePath || sceneStep.sceneImage;
        if (!sceneImagePath) return;
        const sceneImageUrl = toSceneBackgroundUrl(sceneImagePath);
        if (sceneImageUrl) {
            setBackgroundImage((prev) => (prev !== sceneImageUrl ? sceneImageUrl : prev));
        }
    }, [updateSceneFromId, getLatestSceneById, getSceneImagePath, toSceneBackgroundUrl]);

    const pendingBridgeDialogueRef = useRef<any>(null);

    /** 功能注释：Aliyun raw 旁白期间把 dialogue 立绘落到独立层，避免依赖 currentStep 转 dialogue */
    const applyRawTextBridgeDialoguePortraitNotify = useCallback((dialogueStep: any) => {
        if (!dialogueStep || String(dialogueStep.type || '') !== 'dialogue') return;
        pendingBridgeDialogueRef.current = dialogueStep;
        const isPlayer = Boolean(dialogueStep.isPlayer)
            || String(dialogueStep.speakerId || '') === 'player';
        const npcId = dialogueStep.speakerId || dialogueStep.npcId;
        const npcList = presetData?.npcs?.npcs || [];
        const npc = !isPlayer && npcId
            ? npcList.find((n: any) => String(n.id) === String(npcId))
            : null;
        const speakerName = String(dialogueStep.speakerName || '').trim();
        const byName = !isPlayer && !npc && speakerName
            ? npcList.find((n: any) => String(n?.name || '').trim() === speakerName)
            : null;
        const npcDoc = npc || byName;
        const sessionAvatarUrl = !isPlayer
            ? pickSessionNpcAvatarUrl(sessionNpcEdits, {
                npcId: npcDoc?.id || npcId,
                speakerName: dialogueStep.speakerName,
            })
            : '';
        const imagePath = resolveRawBridgeDialogueImagePath({
            isPlayer,
            activeImage: dialogueStep.activeImage,
            sessionPlayerAvatarUrl,
            playerDocumentImagePath: getPlayerImageUrl(worldSetting?.player) || null,
            npcId: npcDoc?.id || npcId,
            speakerName: dialogueStep.speakerName,
            documentImages: npcDoc?.images,
            sessionNpcAvatarUrl: sessionAvatarUrl,
        }) || null;
        if (!imagePath) {
            // preset 可能尚未就绪；保留 pending，等 document 到达后再挂
            return;
        }
        const imageUrl = getImageUrl(imagePath);
        if (!imageUrl) return;
        const nextPathKey = stripImageCacheBust(imageUrl);
        const nextPosition = isPlayer ? 'right' : 'left';
        // 功能注释：同路径不换图（忽略 ?t=），避免选项后连发对白反复触发进场动画
        setRawBridgePortrait((prev) => {
            if (
                prev
                && stripImageCacheBust(prev.characterImage) === nextPathKey
                && prev.characterPosition === nextPosition
            ) {
                return prev;
            }
            const nextImage = withCacheBust(imageUrl) || imageUrl;
            return {
                characterImage: nextImage,
                characterPosition: nextPosition,
            };
        });
    }, [
        sessionPlayerAvatarUrl,
        worldSetting,
        presetData,
        sessionNpcEdits,
    ]);

    /** 功能注释：纯旁白流无 dialogue 时也挂主角，避免画布整段无人 */
    const ensureRawBridgePlayerPortraitFallback = useCallback(() => {
        if (rawBridgePortrait?.characterImage) return;
        applyRawTextBridgeDialoguePortraitNotify({
            type: 'dialogue',
            isPlayer: true,
            speakerId: 'player',
        });
    }, [rawBridgePortrait?.characterImage, applyRawTextBridgeDialoguePortraitNotify]);

    // 功能注释：document/preset 晚于对白 step 到达时，补挂旁路立绘
    useEffect(() => {
        if (!presetData || !pendingBridgeDialogueRef.current) return;
        applyRawTextBridgeDialoguePortraitNotify(pendingBridgeDialogueRef.current);
    }, [presetData, worldSetting, applyRawTextBridgeDialoguePortraitNotify]);

    const stepHandlers = useGalgameStep({
        sessionId,
        historyLength: assistantRoundCount,
        onMessagesClear: () => {
            pendingBridgeDialogueRef.current = null;
            // 功能注释：选项后新流开始时不清空立绘，避免 CharacterLayer 卸载再挂载连环闪入
            setInitialMessages([]);
            try {
                localStorage.removeItem(allStepsStorageKey);
            } catch (e) {
                console.warn('[Galgame] 清除本地 allSteps 失败:', e);
            }
        },
        onCompleteAllSteps: (steps: any[]) => {
            try {
                localStorage.setItem(allStepsStorageKey, JSON.stringify(steps));
            } catch (e) {
                console.warn('[Galgame] 存储 allSteps 失败:', e);
            }
        },
        onStreamComplete: async () => {
            if (refreshHistoryAfterTypingRef.current) {
                refreshHistoryAfterTypingRef.current();
            }
        },
        onErrorAfterAlert: async (errorMsg: string) => {
            // 显示错误弹窗而不是 alert
            setErrorMessage(errorMsg);
            setErrorModalVisible(true);
            if (refreshHistoryAfterTypingRef.current) {
                void refreshHistoryAfterTypingRef.current();
            }
        },
        onUserAction: appendLocalUserMessage,
        isReplay,
        isTextMode,
        onRawTextBridgeSceneChange: applyRawTextBridgeSceneChange,
        onRawTextBridgeDialoguePortraitNotify: applyRawTextBridgeDialoguePortraitNotify,
        onContextMemoryUpdate: setLiveContextMemory,
        onContextCompressionDone: (status) => {
            if (status) {
                setLiveContextMemory(status);
            }
            if (autoToCompressionStartCountRef.current !== null) {
                void stopAutoToCompressionAndOpenDebug();
            }
        },
        onStreamActivity: noteStreamActivity,
        onExhausted: () => {
            if (isReplay) {
                if (replayTotalSteps > 0) {
                    setReplayIndex(replayTotalSteps - 1);
                }
                setIsAutoPlay(false);
                setReplayFinished(true);
            }
        }
    });

    const textModeContextMemory = liveContextMemory || stepHandlers.contextMemory || historyContextMemory;

    useEffect(() => {
        if (!isAutoToCompression || autoToCompressionStartCountRef.current === null) {
            return;
        }
        const currentCount = Number(textModeContextMemory?.compressionCount || 0);
        if (currentCount > autoToCompressionStartCountRef.current) {
            void stopAutoToCompressionAndOpenDebug();
        }
    }, [isAutoToCompression, textModeContextMemory?.compressionCount, stopAutoToCompressionAndOpenDebug]);

    // 请求超时检测（60秒）
    useEffect(() => {
        if (stepHandlers.isWaitingForData) {
            if (requestTimeoutRef.current) {
                window.clearTimeout(requestTimeoutRef.current);
            }
            const timeoutMs = stepHandlers.isCompressingContext
                ? COMPRESSION_REQUEST_TIMEOUT_MS
                : REQUEST_TIMEOUT_MS;
            requestTimeoutRef.current = window.setTimeout(() => {
                if (stepHandlers.isWaitingForData) {
                    setRequestTimeoutVisible(true);
                }
            }, timeoutMs);
        } else {
            if (requestTimeoutRef.current) {
                window.clearTimeout(requestTimeoutRef.current);
                requestTimeoutRef.current = null;
            }
        }

        return () => {
            if (requestTimeoutRef.current) {
                window.clearTimeout(requestTimeoutRef.current);
                requestTimeoutRef.current = null;
            }
        };
    }, [stepHandlers.isWaitingForData, stepHandlers.isCompressingContext, streamActivityTick]);

    useEffect(() => {
        const currentRequestId = stepHandlers.currentRequestId?.current || 0;
        if (currentRequestId !== currentRequestIdRef.current) {
            currentRequestIdRef.current = currentRequestId;
            setCompletedSteps([]);
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
    }, [stepHandlers.currentRequestId?.current]);

    const messageUtils = useGalgameMessage(
        worldSetting,
        presetData?.npcs || null,
        gameStarted,
        stepHandlers.currentStep,
        initialMessages,
        '',
        false,
        stepHandlers.isWaitingForData,
        stepHandlers.currentStep,
        sessionPlayerAvatarUrl || null,
        sessionPlayerName || null,
        sessionNpcEdits,
    );

    const typingSpeed = isTextMode ? 20 : 30;
    // 功能注释：raw 旁白保留打字机（本地联调与发布后生产一致）
    const skipTypingForAliyunRaw = shouldSkipTypewriterForRawTextBridge({
        aliyunRuntime: isAliyunFrontendRuntime(),
        isDev: Boolean(import.meta.env.DEV),
        fromRawText: Boolean(stepHandlers.currentStep?._fromRawText),
    });

    const { displayedText, isTyping } = useStoryTyping({
        text: messageUtils.plainTextForTyping,
        enabled: !skipTypingForAliyunRaw
            && Boolean(
                messageUtils.currentMessage
                && messageUtils.currentMessage.type !== 'choice'
                && gameStarted
                && messageUtils.plainTextForTyping,
            ),
        speed: typingSpeed,
    });

    const canvasDisplayText = skipTypingForAliyunRaw
        ? messageUtils.plainTextForTyping
        : displayedText;
    const canvasIsTyping = skipTypingForAliyunRaw ? false : isTyping;

    const messageUtilsWithTyping = useGalgameMessage(
        worldSetting,
        presetData?.npcs || null,
        gameStarted,
        stepHandlers.currentStep,
        initialMessages,
        canvasDisplayText,
        canvasIsTyping,
        stepHandlers.isWaitingForData,
        stepHandlers.currentStep,
        sessionPlayerAvatarUrl || null,
        sessionPlayerName || null,
        sessionNpcEdits,
    );

    // 提取步骤中的角色图片 URL（用于预加载）
    const extractCharacterImageUrl = useCallback((step: any): string | null => {
        if (!step) return null;

        if (step.type === 'dialogue') {
            if (step.isPlayer) {
                const playerImagePath = sessionPlayerAvatarUrl || getPlayerImageUrl(worldSetting?.player);
                if (playerImagePath) {
                    const imageUrl = getImageUrl(playerImagePath);
                    return imageUrl ? withCacheBust(imageUrl) : null;
                }
            } else {
                // NPC 图片逻辑（与 useGalgameMessage 一致：局内 avatarUrl 优先于文档图）
                const npcId = step.speakerId || step.npcId;
                const npc = npcId && presetData?.npcs?.npcs
                    ? presetData.npcs.npcs.find((n: any) => String(n.id) === String(npcId))
                    : null;
                const sessionAvatarUrl = pickSessionNpcAvatarUrl(sessionNpcEdits, {
                    npcId,
                    speakerName: step.speakerName,
                });
                const npcImagePath = resolveNpcPlayImagePath({
                    npcId,
                    speakerName: step.speakerName,
                    activeImage: step.activeImage,
                    documentImages: npc?.images,
                    sessionAvatarUrl,
                });
                if (npcImagePath) {
                    const imageUrl = getImageUrl(npcImagePath);
                    return imageUrl ? withCacheBust(imageUrl) : null;
                }
            }
        } else if (step.type === 'choice') {
            const playerImagePath = sessionPlayerAvatarUrl || getPlayerImageUrl(worldSetting?.player);
            if (playerImagePath) {
                const imageUrl = getImageUrl(playerImagePath);
                return imageUrl ? withCacheBust(imageUrl) : null;
            }
        }
        return null;
    }, [worldSetting, presetData, sessionPlayerAvatarUrl, sessionNpcEdits]);

    // 预加载下一个步骤的角色图片
    useEffect(() => {
        const queue = stepHandlers.stepQueue;
        if (!queue || queue.length === 0 || !gameStarted) return;

        const nextStep = queue[0];
        const imageUrl = extractCharacterImageUrl(nextStep);

        if (imageUrl && !gameResourceManager.isLoaded(imageUrl)) {
            console.debug('[GalgameController] Prefetching character image:', imageUrl);
            gameResourceManager.loadImage(imageUrl).catch((err) => {
                console.warn('[GalgameController] Prefetch failed:', err);
            });
        }
    }, [stepHandlers.stepQueue, gameStarted, extractCharacterImageUrl]);

    // 回放模式：拉取回放 steps 并注入到队列
    useEffect(() => {
        const run = async () => {
            if (!isReplay || !replayId) return;
            if (isPublicReplayRoute && !replayMeta?.fileId) return;
            try {
                setIsLoading(true);
                const resp = await replayApi.getReplaySteps(replayId, {
                    offset: 0,
                    limit: REPLAY_PAGE_SIZE
                });
                const steps: ReplayStep[] = Array.isArray(resp.data?.steps)
                    ? resp.data.steps
                    : [];
                const filteredSteps = steps;
                if (filteredSteps.length === 0) {
                    setReplaySteps([]);
                    setReplayIndex(0);
                    setReplayTotalSteps(0);
                    setReplayLoadedOffset(0);
                    setReplayHasMore(false);
                    replayLoadedOffsetRef.current = 0;
                    replayHasMoreRef.current = false;
                    setIsAutoPlay(false);
                    toast.error('回放内容为空');
                    return;
                }

                setShowStoryIntro(false);
                setGameStarted(true);
                setReplayFinished(false);
                setIsAutoPlay(false);
                setReplaySpeed(1);
                setReplaySteps(filteredSteps);
                setReplayIndex(0);
                setReplayTotalSteps(Number(resp.data?.total || filteredSteps.length));
                setReplayLoadedOffset(Number(resp.data?.offset || 0) + filteredSteps.length);
                setReplayHasMore(resp.data?.hasMore === true);
                replayLoadedOffsetRef.current = Number(resp.data?.offset || 0) + filteredSteps.length;
                replayHasMoreRef.current = resp.data?.hasMore === true;
                setInitialMessages([]);
                setCompletedSteps([]);

                const [first, ...rest] = filteredSteps;
                previousStepRef.current = first || null;
                previousIsTypingRef.current = false;
                stepHandlers.setCurrentStep(first || null);
                stepHandlers.setStepQueue(rest || []);
                stepHandlers.setShowNextButton(first?.type !== 'choice');

                syncReplaySceneForIndex(filteredSteps, 0);
            } catch (e) {
                console.error('[Replay] 获取回放步骤失败:', e);
                toast.error('加载回放失败');
            } finally {
                setIsLoading(false);
            }
        };
        void run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPublicReplayRoute, isReplay, replayId, replayMeta?.fileId]);

    useEffect(() => {
        if (!isReplay || replaySteps.length === 0 || !stepHandlers.currentStep) {
            return;
        }

        const index = replaySteps.findIndex(step => step === stepHandlers.currentStep);
        if (index < 0) {
            return;
        }

        setReplayIndex(index);
        if (index < replayTotalSteps - 1) {
            setReplayFinished(false);
        } else {
            setIsAutoPlay(false);
        }
    }, [isReplay, replaySteps, replayTotalSteps, stepHandlers.currentStep]);

    const loadNextReplayPage = useCallback(async () => {
        if (!isReplay || !replayId || !replayHasMore || replayLoadingPageRef.current) {
            return;
        }

        replayLoadingPageRef.current = true;
        try {
            const resp = await replayApi.getReplaySteps(replayId, {
                offset: replayLoadedOffsetRef.current,
                limit: REPLAY_PAGE_SIZE
            });
            const nextSteps: ReplayStep[] = Array.isArray(resp.data?.steps)
                ? resp.data.steps
                : [];
            const filteredSteps = nextSteps;
            setReplaySteps((prev) => {
                if (filteredSteps.length === 0) return prev;
                const existingIds = new Set(prev.map((step) => String(step?.id ?? '')));
                const merged = [...prev];
                for (const step of filteredSteps) {
                    const id = String(step?.id ?? '');
                    if (id && existingIds.has(id)) continue;
                    merged.push(step);
                }
                return merged;
            });
            setReplayLoadedOffset(Number(resp.data?.offset || replayLoadedOffset) + nextSteps.length);
            setReplayTotalSteps(Number(resp.data?.total || replayTotalSteps));
            setReplayHasMore(resp.data?.hasMore === true);
            replayLoadedOffsetRef.current = Number(resp.data?.offset || replayLoadedOffset) + nextSteps.length;
            replayHasMoreRef.current = resp.data?.hasMore === true;
        } catch (error) {
            console.error('[Replay] Failed to load next replay page:', error);
        } finally {
            replayLoadingPageRef.current = false;
        }
    }, [isReplay, replayHasMore, replayId, replayLoadedOffset, replayTotalSteps]);

    useEffect(() => {
        if (!isReplay || !replayHasMore) return;
        const remainingLoadedSteps = replaySteps.length - replayIndex - 1;
        if (remainingLoadedSteps <= REPLAY_PREFETCH_REMAINING) {
            void loadNextReplayPage();
        }
    }, [isReplay, loadNextReplayPage, replayHasMore, replayIndex, replaySteps.length]);

    useEffect(() => {
        previousIsTypingRef.current = isTyping;
    }, [isTyping]);

    const refreshHistoryAfterTyping = useCallback(async () => {
        if (isReplay) return; // 回放模式不刷新历史
        const currentRequestId = stepHandlers.currentRequestId?.current || 0;
        if (lastRefreshRequestIdRef.current === currentRequestId) {
            return;
        }
        
        if (isTyping) {
            let attempts = 0;
            const maxAttempts = 100;
            
            const checkTyping = setInterval(() => {
                attempts++;
                const currentIsTyping = previousIsTypingRef.current;
                
                if (!currentIsTyping || attempts >= maxAttempts) {
                    clearInterval(checkTyping);
                    const finalRequestId = stepHandlers.currentRequestId?.current || 0;
                    if (!currentIsTyping && lastRefreshRequestIdRef.current !== finalRequestId) {
                        lastRefreshRequestIdRef.current = finalRequestId;
                        refreshHistory().catch((error) => {
                            console.error('[Galgame] 刷新历史数据失败:', error);
                        });
                    }
                }
            }, 100);
            
            return;
        }
        
        lastRefreshRequestIdRef.current = currentRequestId;
        refreshHistory().catch((error) => {
            console.error('[Galgame] 刷新历史数据失败:', error);
        });
    }, [isReplay, isTyping, refreshHistory, stepHandlers]);

    useEffect(() => {
        refreshHistoryAfterTypingRef.current = refreshHistoryAfterTyping;
    }, [refreshHistoryAfterTyping]);

    const lastDrainedSceneStepRef = useRef<any>(null);
    const lastRawBridgeSceneKeyRef = useRef<string>('');

    // 功能注释：Aliyun raw 旁白期间若队列里仍塞着 scene_change，立刻旁路切背景并清出队列，避免开场白屏
    useEffect(() => {
        if (!isAliyunFrontendRuntime()) return;
        const currentStep = stepHandlers.currentStep;
        if (!currentStep?._fromRawText) return;
        const queue = stepHandlers.stepQueue || [];
        let latest: any = null;
        for (const step of queue) {
            if (String(step?.type || '') === 'scene_change') latest = step;
        }
        if (!latest) return;
        const key = `${String(latest.sceneId || '')}|${String(latest.sceneImage || '')}`;
        if (key && key === lastRawBridgeSceneKeyRef.current) {
            // 仍清队列，避免反复堵在 scene_change
        } else {
            lastRawBridgeSceneKeyRef.current = key;
            applyRawTextBridgeSceneChange(latest);
        }
        if (typeof stepHandlers.setStepQueue === 'function') {
            stepHandlers.setStepQueue((prev: any[]) =>
                prev.filter((step) => String(step?.type || '') !== 'scene_change'),
            );
        }
    }, [
        stepHandlers.currentStep,
        stepHandlers.stepQueue,
        stepHandlers.setStepQueue,
        applyRawTextBridgeSceneChange,
    ]);

    // 处理场景切换：连续 scene_change 只落最终背景，避免开场一口气拉很多图
    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        if (!currentStep || currentStep.type !== 'scene_change') {
            return;
        }
        // 同一 step 因 queue 裁切触发重跑时不再处理
        if (lastDrainedSceneStepRef.current === currentStep) {
            return;
        }
        lastDrainedSceneStepRef.current = currentStep;

        const drained = drainLeadingSceneChanges(currentStep, stepHandlers.stepQueue || []);
        if (!drained) return;

        const { finalStep, skipQueueCount } = drained;
        if (finalStep.sceneId) {
            updateSceneFromId(finalStep.sceneId);
        }

        const latestSceneImagePath = getSceneImagePath(getLatestSceneById(finalStep.sceneId));
        const sceneImagePath = latestSceneImagePath || finalStep.sceneImage;
        if (sceneImagePath) {
            const sceneImageUrl = toSceneBackgroundUrl(sceneImagePath);
            if (sceneImageUrl) {
                setBackgroundImage((prev) => (prev !== sceneImageUrl ? sceneImageUrl : prev));
            }
        }

        if (skipQueueCount > 0 && typeof stepHandlers.setStepQueue === 'function') {
            stepHandlers.setStepQueue((prev: any[]) => prev.slice(skipQueueCount));
        }

        // 场景切换步骤本身不需要在对话区域显示；跳到下一条非 scene_change（或耗尽）
        if (stepHandlers.handleNextStep) {
            stepHandlers.handleNextStep();
        }
    }, [
        stepHandlers.currentStep,
        stepHandlers.stepQueue,
        stepHandlers.handleNextStep,
        stepHandlers.setStepQueue,
        updateSceneFromId,
        getLatestSceneById,
        getSceneImagePath,
        toSceneBackgroundUrl,
    ]);

    // 场景图预载：只拉当前 + 下一张（步骤队列优先），开场不扫全场景表
    useEffect(() => {
        const scenes = presetData?.scenes?.scenes;
        if (!Array.isArray(scenes) || scenes.length === 0) return;

        const sceneUrlsInOrder = uniquePreserveOrder(
            scenes.map((scene: any) => toSceneBackgroundUrl(getSceneImagePath(scene))),
        );
        if (sceneUrlsInOrder.length === 0) return;

        let nextFromQueue = '';
        for (const step of stepHandlers.stepQueue || []) {
            if (step?.type !== 'scene_change') continue;
            const fromDoc = getSceneImagePath(getLatestSceneById(step.sceneId));
            const path = fromDoc || step.sceneImage;
            const url = toSceneBackgroundUrl(path);
            if (url && url !== backgroundImage) {
                nextFromQueue = url;
                break;
            }
        }

        const plan = buildScenePreloadPlan({
            sceneUrlsInOrder,
            currentUrl: backgroundImage || sceneUrlsInOrder[0],
            nextUrl: nextFromQueue,
            // 开场禁止把文档里其余场景全部塞进 rest
            includeCatalogRest: false,
        });
        void sceneImagePreloader.applyPlan(plan);
    }, [
        presetData,
        backgroundImage,
        stepHandlers.stepQueue,
        getSceneImagePath,
        getLatestSceneById,
        toSceneBackgroundUrl,
    ]);

    useEffect(() => {
        return () => {
            sceneImagePreloader.reset();
        };
    }, [fileId, sessionId]);

    useEffect(() => {
        if (isReplay) {
            setShowStoryIntro(false);
            return;
        }
        if (gameStarted && stepHandlers.currentStep && showStoryIntro) {
            setShowStoryIntro(false);
        }
    }, [isReplay, gameStarted, stepHandlers.currentStep, showStoryIntro]);

    // 处理历史记录（继续体验：还原此前全部用户回合 + AI 回合）
    const processHistoryRecord = useCallback(() => {
        if (isReplay) return; // 回放模式不处理“历史驱动”的自动重发
        // 如果正在等待新数据，不处理历史记录，避免覆盖新请求的数据
        if (stepHandlers.isWaitingForData) {
            return;
        }
        // 如果当前有新的步骤数据（currentStep 或 stepQueue 中有数据），不处理历史记录
        // 这确保新请求的数据不会被历史记录覆盖
        if (stepHandlers.currentStep || (stepHandlers.stepQueue && stepHandlers.stepQueue.length > 0)) {
            return;
        }
        if (!historyLoading && presetData && history.length > 0) {
            const lastMessage = history[history.length - 1];
            const playerName = String(worldSetting?.player?.name || '').trim() || 'Player';
            const priorMessages = history.slice(0, -1);
            const priorSteps = buildCompletedStepsFromConversationHistory(priorMessages, playerName);

            if (lastMessage.role === 'user' && lastMessage.content) {
                // 续玩时先还原此前完整记录（含用户自己的选择/输入）
                if (priorSteps.length > 0) {
                    setCompletedSteps(priorSteps);
                }
                setShowStoryIntro(false);
                setGameStarted(true);

                // 防重复：相同内容在短时间内不重复自动重发
                const now = Date.now();
                const prev = lastAutoResendRef.current;
                const sameContent = prev && prev.content === lastMessage.content;
                const withinWindow = prev && (now - prev.ts) < 5000; // 5s窗口
                const content = String(lastMessage.content || '').trim();
                // 开局「开始游戏」若正由自动开局链路处理，不要再自动重发抢锁
                const isOpeningStartAction = content === '开始游戏';
                const autoStartOwnsOpening =
                    isOpeningStartAction && (isStartingGame || shouldAutoStartGame);
                if (
                    !stepHandlers.isWaitingForData
                    && !isStartingGame
                    && !autoStartOwnsOpening
                    && !(sameContent && withinWindow)
                ) {
                    lastAutoResendRef.current = { content: lastMessage.content, ts: now };
                    const resendAction = async (attempt: number) => {
                        await stepHandlers.handleStreamAction(lastMessage.content, {
                            onError: (error) => {
                                if (isGenerationBusyError(error) && attempt < GENERATION_BUSY_MAX_RETRIES) {
                                    window.setTimeout(() => {
                                        void resendAction(attempt + 1);
                                    }, getGenerationBusyRetryDelayMs(attempt));
                                    return;
                                }
                                if (!isGenerationBusyError(error)) {
                                    console.error('自动重发用户消息失败:', error);
                                }
                            }
                        });
                    };
                    void resendAction(0);
                }
                return;
            }

            if (lastMessage.role === 'assistant' && lastMessage.content) {
                const content = lastMessage.content;

                try {
                    const rawAllSteps = localStorage.getItem(allStepsStorageKey);
                    if (rawAllSteps) {
                        const savedSteps = JSON.parse(rawAllSteps);
                        if (Array.isArray(savedSteps) && savedSteps.length > 0) {
                            const restoredSteps = ensureChoiceStep(savedSteps);
                            setShowStoryIntro(false);
                            setGameStarted(true);
                            resetDisplayedSteps();
                            // 本地只存了最近一轮 steps：补上此前用户/AI 记录
                            setCompletedSteps(priorSteps);
                            setInitialMessages([]);
                            const [first, ...rest] = restoredSteps;
                            stepHandlers.setCurrentStep(first || null);
                            stepHandlers.setStepQueue(rest || []);
                            stepHandlers.setShowNextButton(first?.type !== 'choice');
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[Galgame] 读取本地 allSteps 失败:', e);
                }

                const rawHistorySteps = parseHistoryToSteps(content);
                const historySteps = ensureChoiceStep(rawHistorySteps);
                const hasChoiceInHistory = rawHistorySteps.some((s: any) => choiceStepHasPlayableOptions(s));

                if (historySteps.length > 0) {
                    setCompletedSteps([...priorSteps, ...historySteps]);

                    const choiceStep = historySteps.find((s) => choiceStepHasPlayableOptions(s));
                    if (choiceStep) {
                        const choiceData = extractChoiceFromHistory(content);
                        const choiceMessage = createChoiceMessage(choiceData);
                        if (choiceMessage) {
                            setInitialMessages([choiceMessage]);
                        }
                    }
                } else {
                    const choiceData = extractChoiceFromHistory(content);
                    if (choiceData && choiceData.options.length > 0) {
                        const choiceStep: any = {
                            id: `history-choice-${Date.now()}`,
                            type: 'choice',
                            content: '',
                            title: choiceData.title,
                            description: choiceData.text,
                            options: choiceData.options.map((opt, index) => ({
                                id: index + 1,
                                text: opt
                            }))
                        };
                        setCompletedSteps([...priorSteps, choiceStep]);

                        const choiceMessage = createChoiceMessage(choiceData);
                        if (choiceMessage) {
                            setInitialMessages([choiceMessage]);
                        }
                    } else if (priorSteps.length > 0) {
                        setCompletedSteps(priorSteps);
                    }
                }

                if (!hasChoiceInHistory && history.length >= 2) {
                    for (let i = history.length - 2; i >= 0; i--) {
                        if (history[i].role === 'user' && history[i].content) {
                            const lastUserMessage = history[i].content;
                            if (!stepHandlers.isWaitingForData && !isStartingGame) {
                                stepHandlers.handleStreamAction(lastUserMessage, {
                                    onError: (error) => {
                                        if (!isGenerationBusyError(error)) {
                                            console.error('自动重发倒数第一条用户消息失败:', error);
                                        }
                                    }
                                });
                            }
                            break;
                        }
                    }
                }
            }
        }
    }, [isReplay, historyLoading, presetData, history, worldSetting, stepHandlers, allStepsStorageKey, resetDisplayedSteps, getPlayerImageUrlCallback, createChoiceMessage, isStartingGame, shouldAutoStartGame]);

    useEffect(() => {
        // 新开局：不依赖 history 空/非空门闩，session + document 就绪即自动「开始游戏」
        if (!bootNewStart || isReplay) return;
        if (!playableSessionId || !presetData) return;
        if (historyProcessedRef.current) return;
        setShowStoryIntro(false);
        setShouldAutoStartGame(true);
        historyProcessedRef.current = true;
    }, [bootNewStart, isReplay, playableSessionId, presetData]);

    useEffect(() => {
        // 新开局已走独立自动开局，跳过 history 门闩（避免空 history 误判 / 与 stream 抢锁）
        if (bootNewStart) return;
        // 必须等当前 session 的 history 首拉完成，否则会在空数组上误触发「开始游戏」与后续自动重发抢锁
        if (!historyBootstrapped || historyLoading || !presetData) return;

        if (history.length > 0) {
            if (!historyProcessedRef.current) {
                setShowStoryIntro(false);
                setGameStarted(true);
                processHistoryRecord();
                historyProcessedRef.current = true;
            }
        } else if (!historyProcessedRef.current) {
            // 先 navigate 时 session 可能尚未就绪，等 session 再触发自动开局
            if (!isReplay && !playableSessionId) return;
            // 产品：新开局直接进游戏，不展示开局弹窗；故事线改在系统面板调整
            setShowStoryIntro(false);
            setShouldAutoStartGame(true);
            historyProcessedRef.current = true;
        }
    }, [bootNewStart, historyBootstrapped, historyLoading, presetData, history.length, processHistoryRecord, isReplay, playableSessionId]);

    useEffect(() => {
        if (bootNewStart) return;
        if (isTextMode && gameStarted && completedSteps.length === 0 && historyBootstrapped && !historyLoading && history.length > 0 && presetData && !stepHandlers.isWaitingForData && !stepHandlers.currentStep) {
            processHistoryRecord();
            historyProcessedRef.current = true;
        }
    }, [bootNewStart, isTextMode, gameStarted, completedSteps.length, historyBootstrapped, historyLoading, history.length, presetData, processHistoryRecord, stepHandlers.isWaitingForData, stepHandlers.currentStep]);

    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        const prevStep = previousStepRef.current;

        if (prevStep && currentStep !== prevStep) {
            if (!isTyping) {
                setCompletedSteps(prev => {
                    const exists = prev.some(s =>
                        s && s.type === prevStep.type && s.content === prevStep.content
                    );
                    if (!exists) {
                        return [...prev, prevStep];
                    }
                    return prev;
                });
            }
        }

        previousStepRef.current = currentStep;
    }, [stepHandlers.currentStep, isTyping]);

    const allStepsForTextModal = useMemo(() => {
        let validSteps = completedSteps.filter(s => s && s.type);

        if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const currentExists = validSteps.some(s =>
                s && s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (!currentExists) {
                validSteps = [...validSteps, stepHandlers.currentStep];
            }
        }

        const choiceIndices: number[] = [];
        validSteps.forEach((step, index) => {
            if (step && step.type === 'choice') {
                choiceIndices.push(index);
            }
        });

        if (choiceIndices.length > 1) {
            for (let i = choiceIndices.length - 2; i >= 0; i--) {
                validSteps.splice(choiceIndices[i], 1);
            }
        }

        return validSteps;
    }, [completedSteps, stepHandlers.currentStep]);

    const currentStepIndex = useMemo(() => {
        if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const index = allStepsForTextModal.findIndex(s =>
                s && s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (index >= 0) return index;
        }

        if (initialMessages.length > 0 && initialMessages[0].type === 'choice') {
            for (let i = allStepsForTextModal.length - 1; i >= 0; i--) {
                if (allStepsForTextModal[i] && allStepsForTextModal[i].type === 'choice') {
                    return i;
                }
            }
        }

        if (allStepsForTextModal.length > 0) {
            return allStepsForTextModal.length - 1;
        }

        return -1;
    }, [allStepsForTextModal, stepHandlers.currentStep, initialMessages]);

    const addConversion = useCallback(async () => {
        if (!fileId || isReplay || !user?.user.id) {
            return;
        }
        try {
            await statisticsApi.addConversion({
                fileId: fileId,
                userId: String(user?.user.id)
            });
        } catch (error) {
            console.error('记录游戏统计失败:', error);
        }
    }, [fileId, isReplay, user?.user.id]);

    const handleStartGame = useCallback(async () => {
        if (!playableSessionId) {
            toast.error('没有 sessionId，无法开始游戏');
            return;
        }

        setIsStartingGame(true);
        setGameStarted(true);
        setInitialMessages([]);

        // 开局 actionId 固定：重复请求走 ACTION_IN_PROGRESS / 回放，而不是再抢会话锁刷「正在生成中」
        const bootstrapActionId = `visual-${playableSessionId}-bootstrap-start`;
        await stepHandlers.handleStreamAction('开始游戏', {
            actionId: bootstrapActionId,
            onBeforeRequest: () => {
                setInitialMessages([]);
                resetDisplayedSteps();
            },
            onFirstStep: () => {
                // 首条 step 已上屏：结束「开局中」，避免上层再盖 loading
                setIsStartingGame(false);
            },
            onSuccess: () => {
                setIsStartingGame(false);
                addConversion();
            },
            onError: (error) => {
                if (isGenerationBusyError(error)) {
                    // 另一路开局流已占用锁：保留 gameStarted，等成功那路出字
                    console.warn('[Galgame] bootstrap start busy, keep waiting', error);
                    return;
                }
                console.error('❌ 开始游戏失败:', error);
                toast.error(error || '开始游戏失败，请重试');
                setIsStartingGame(false);
                setGameStarted(false);
                // 不再回退到开局弹窗；允许用户再次触发自动开局或手动重试
                setShouldAutoStartGame(false);
            }
        });
    }, [playableSessionId, stepHandlers, resetDisplayedSteps, addConversion]);

    const acknowledgeAutoStartGame = useCallback(() => {
        setShouldAutoStartGame(false);
    }, []);

    const handleNextMessage = useCallback(() => {
        if (gameStarted && stepHandlers.showNextButton) {
            stepHandlers.handleNextStep();
        }
    }, [gameStarted, stepHandlers]);

    const handleAutoPlayToggle = useCallback(() => {
        setIsAutoPlay(prev => {
            if (isReplay && (replayTotalSteps <= 1 || replayIndex >= replayTotalSteps - 1)) {
                return false;
            }
            return !prev;
        });
    }, [isReplay, replayIndex, replayTotalSteps]);

    const handleAutoToCompressionToggle = useCallback(() => {
        if (!contextMemoryDebugEnabled) {
            return;
        }
        if (isReplay || !playableSessionId) {
            toast.error('自动压测仅可在可游玩会话中使用。');
            return;
        }
        if (!gameStarted) {
            toast.error('请先开始游戏再运行自动压测。');
            return;
        }

        setIsAutoToCompression((prev) => {
            if (prev) {
                autoToCompressionStartCountRef.current = null;
                return false;
            }

            autoToCompressionStartCountRef.current = Number(textModeContextMemory?.compressionCount || 0);
            autoToCompressionCompletedRef.current = false;
            setMemoryDebugOpen(false);
            setMemoryDebugData(null);
            setIsAutoPlay(false);
            return true;
        });
    }, [contextMemoryDebugEnabled, gameStarted, isReplay, playableSessionId, textModeContextMemory?.compressionCount]);

    const handleReplaySeek = useCallback(async (targetIndex: number) => {
        if (!isReplay) {
            return;
        }

        const target = Math.min(Math.max(Math.round(targetIndex), 0), Math.max(replayTotalSteps - 1, 0));
        while (target >= replayStepsRef.current.length && replayHasMoreRef.current && !replayLoadingPageRef.current) {
            await loadNextReplayPage();
        }

        const steps = replayStepsRef.current;
        if (steps.length === 0) {
            return;
        }

        const clampedIndex = Math.min(target, steps.length - 1);
        const targetStep = steps[clampedIndex] || null;

        setReplayIndex(clampedIndex);
        setReplayFinished(false);
        if (clampedIndex >= Math.max(replayTotalSteps - 1, 0)) {
            setIsAutoPlay(false);
        }

        setShowStoryIntro(false);
        setGameStarted(true);
        setInitialMessages([]);
        setCompletedSteps(steps.slice(0, clampedIndex));
        previousStepRef.current = targetStep;
        previousIsTypingRef.current = false;

        stepHandlers.setCurrentStep(targetStep);
        stepHandlers.setStepQueue(steps.slice(clampedIndex + 1));
        stepHandlers.setShowNextButton(targetStep?.type !== 'choice');
        syncReplaySceneForIndex(steps, clampedIndex);
    }, [isReplay, loadNextReplayPage, replayHasMore, replayTotalSteps, stepHandlers, syncReplaySceneForIndex]);

    const handleReplaySpeedChange = useCallback((speed: ReplaySpeed) => {
        if (!REPLAY_SPEED_OPTIONS.includes(speed)) {
            return;
        }
        setReplaySpeed(speed);
    }, []);

    useEffect(() => {
        const shouldAutoPlay = isReplay ? isAutoPlay : (isTextMode ? true : isAutoPlay);
        
        if (!shouldAutoPlay || !gameStarted) return;
        if (isReplay && replayTotalSteps > 0 && replayIndex >= replayTotalSteps - 1) {
            setIsAutoPlay(false);
            return;
        }
        if (stepHandlers.isWaitingForData) return;
        if (messageUtilsWithTyping.finalIsTyping) return;
        if (!stepHandlers.showNextButton) return;
        if (messageUtilsWithTyping.currentMessage?.type === 'choice') {
            if (!isTextMode) {
                setIsAutoPlay(false);
            }
            return;
        }

        const autoPlayTimer = setTimeout(() => {
            if (shouldAutoPlay && !messageUtilsWithTyping.finalIsTyping && stepHandlers.showNextButton && messageUtilsWithTyping.currentMessage?.type !== 'choice' && !stepHandlers.isWaitingForData) {
                handleNextMessage();
            }
        }, isReplay ? 2000 / replaySpeed : 1000);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, isTextMode, isReplay, replayIndex, replaySpeed, replaySteps.length, replayTotalSteps, messageUtilsWithTyping.finalIsTyping, messageUtilsWithTyping.currentMessage?.type, stepHandlers.showNextButton, stepHandlers.isWaitingForData, gameStarted, handleNextMessage]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!canSubmitChoiceInteraction({
            isWaitingForData: stepHandlers.isWaitingForData,
            isCompressingContext: stepHandlers.isCompressingContext,
            streamReady: !stepHandlers.loading,
        })) {
            return;
        }
        if (!messageUtilsWithTyping.currentMessage || messageUtilsWithTyping.currentMessage.type !== 'choice' || !messageUtilsWithTyping.currentMessage.options) {
            return;
        }

        const optionIndex = messageUtilsWithTyping.currentMessage.options.findIndex((opt) => {
            return opt.text === option.text || opt.id === option.id;
        });
        if (optionIndex < 0) return;

        const optionText = messageUtilsWithTyping.currentMessage.options[optionIndex].text;
        const actionId = createGalgameActionId(playableSessionId, optionText);

        // 保存最后一次请求的 action
        lastRequestActionRef.current = optionText;
        lastRequestActionIdRef.current = actionId;

        if (stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') {
            const stepOptionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
                const optText = typeof opt === 'string' ? opt : (opt.text || opt);
                return optText === optionText;
            }) ?? -1;

            if (stepOptionIndex >= 0) {
                const stepOptionObj = stepHandlers.currentStep.options[stepOptionIndex];
                const optionData = typeof stepOptionObj === 'string'
                    ? { text: stepOptionObj, nextId: '' }
                    : stepOptionObj;

                stepHandlers.handleChoiceOption(optionData, stepOptionIndex, actionId);
                return;
            }
        }

        stepHandlers.handleChoiceOption({ text: optionText, nextId: '' }, optionIndex, actionId);
    }, [playableSessionId, stepHandlers, messageUtilsWithTyping.currentMessage, resetDisplayedSteps]);

    useEffect(() => {
        if (!isAutoToCompression) {
            return;
        }
        if (!contextMemoryDebugEnabled || isReplay || !gameStarted) {
            setIsAutoToCompression(false);
            return;
        }
        if (autoToCompressionCompletedRef.current) {
            return;
        }
        if (stepHandlers.isWaitingForData || stepHandlers.loading || stepHandlers.isCompressingContext) {
            return;
        }
        if (messageUtilsWithTyping.finalIsTyping) {
            return;
        }

        const timer = window.setTimeout(() => {
            const currentMessage = messageUtilsWithTyping.currentMessage;
            if (currentMessage?.type === 'choice') {
                const option = pickMainOption(currentMessage.options);
                if (!option) {
                    autoToCompressionStartCountRef.current = null;
                    setIsAutoToCompression(false);
                    toast.error('自动压测遇到空选项，已停止。');
                    void openContextMemoryDebug();
                    return;
                }
                handleChoiceClick(option);
                return;
            }

            if (stepHandlers.showNextButton) {
                handleNextMessage();
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        gameStarted,
        handleChoiceClick,
        handleNextMessage,
        isAutoToCompression,
        isReplay,
        contextMemoryDebugEnabled,
        messageUtilsWithTyping.currentMessage,
        messageUtilsWithTyping.finalIsTyping,
        openContextMemoryDebug,
        stepHandlers.isCompressingContext,
        stepHandlers.isWaitingForData,
        stepHandlers.loading,
        stepHandlers.showNextButton,
    ]);

    const handleCustomInputSubmit = useCallback((value: string) => {
        if (!canSubmitChoiceInteraction({
            isWaitingForData: stepHandlers.isWaitingForData,
            isCompressingContext: stepHandlers.isCompressingContext,
            streamReady: !stepHandlers.loading,
        })) {
            return;
        }
        if (!value.trim()) return;
        const actionText = value.trim();
        const actionId = createGalgameActionId(playableSessionId, actionText);
        // 保存最后一次请求的 action
        lastRequestActionRef.current = actionText;
        lastRequestActionIdRef.current = actionId;
        stepHandlers.handleChoiceSend(value, actionId);
    }, [playableSessionId, stepHandlers]);

    const handleRetryLastRequest = useCallback(async () => {
        setRequestTimeoutVisible(false);
        setErrorModalVisible(false);

        const lastAction = lastRequestActionRef.current;
        const lastActionId = lastRequestActionIdRef.current || createGalgameActionId(playableSessionId, lastAction || '');
        if (!lastAction) {
            toast.error('没有可重试的上次操作');
            return;
        }

        await stepHandlers.handleStreamAction(lastAction, {
            actionId: lastActionId,
            onError: () => {
                toast.error('重试失败，请稍后再试');
            }
        });
    }, [playableSessionId, stepHandlers]);

    const handleExitGame = useCallback(() => {
        try {
            localStorage.removeItem(allStepsStorageKey);
        } catch (e) {
            console.warn('[Galgame] 清理临时状态失败:', e);
        }
        if (isPublicReplayRoute) {
            if (typeof window !== 'undefined' && window.history.length > 1) {
                navigate(-1);
                return;
            }
            navigate('/home');
            return;
        }
        navigate('/');
    }, [allStepsStorageKey, isPublicReplayRoute, navigate]);

    // 功能注释：选项步保留旁路立绘（或由 choice 消息自带主角图）；禁止清空导致「选完后人消失」
    useEffect(() => {
        const step = stepHandlers.currentStep;
        if (!step) return;
        if (step.type === 'choice') {
            // 功能注释：choice 无图且旁路也空时，补挂主角，避免选项屏空白
            if (!rawBridgePortrait?.characterImage) {
                ensureRawBridgePlayerPortraitFallback();
            }
            return;
        }
        if (step._fromRawText && !rawBridgePortrait?.characterImage) {
            ensureRawBridgePlayerPortraitFallback();
        }
    }, [
        stepHandlers.currentStep,
        rawBridgePortrait?.characterImage,
        ensureRawBridgePlayerPortraitFallback,
    ]);

    return {
        isReplay,
        replayFinished,
        replayIndex,
        replayStepsCount: replayTotalSteps,
        replaySpeed,
        replaySpeedOptions: REPLAY_SPEED_OPTIONS,
        isLoading,
        backgroundImage,
        rawBridgePortrait,
        currentScene,
        worldSetting,
        presetData,
        showStoryIntro,
        shouldAutoStartGame,
        acknowledgeAutoStartGame,
        isStartingGame,
        gameStarted,
        isAutoPlay,
        showGalgameHistory,
        setShowGalgameHistory,
        isTextMode,
        setIsTextMode,
        requestTimeoutVisible,
        setRequestTimeoutVisible,
        errorModalVisible,
        setErrorModalVisible,
        errorMessage,
        currentMessage: messageUtilsWithTyping.currentMessage,
        finalDisplayText: messageUtilsWithTyping.finalDisplayText,
        finalIsTyping: messageUtilsWithTyping.finalIsTyping,
        allStepsForTextModal,
        currentStepIndex,
        textModalDisplayText: messageUtilsWithTyping.textModalDisplayText,
        contextMemory: textModeContextMemory,
        contextMemoryDebugEnabled,
        memoryDebugOpen,
        setMemoryDebugOpen,
        memoryDebugData,
        memoryDebugLoading,
        openContextMemoryDebug,
        isAutoToCompression,
        convertStepsToTextModalFormat: messageUtilsWithTyping.convertStepsToTextModalFormat,
        history,
        historyTotal,
        refreshHistory,
        loadMoreHistoryBefore: loadMoreBefore,
        hasMoreHistoryBefore: hasMoreBefore,
        loadingMoreHistoryBefore: loadingMoreBefore,
        editHistory,
        stepHandlers,
        handleStartGame,
        handleNextMessage,
        handleAutoPlayToggle,
        handleAutoToCompressionToggle,
        handleReplaySeek,
        handleReplaySpeedChange,
        handleChoiceClick,
        handleCustomInputSubmit,
        handleRetryLastRequest,
        handleExitGame,
        resetDisplayedSteps,
        isFreeRound,
    };
};
