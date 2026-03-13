import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useGameStore } from "../../store/gameStore";
import { useGalgameStep } from "./useGalgameStep";
import useGalgameHistory from "./useGalgameHistory";
import { useStoryTyping } from "../story/useStoryTyping";
import { useGalgameMessage } from "./useGalgameMessage";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { GetGalgamePresetResponse } from "../../api/galgame/getGalgamePreset.type";
import { getImageUrl, getPlayerImageUrl, DEFAULT_SCENE_IMAGE } from "../../utils/constants";
import { extractChoiceFromHistory, extractPlainText, parseHistoryToSteps } from "../../utils/textUtils";
import statisticsApi from "../../api/statistics/statisticsApi";
import toast from "react-hot-toast";
import replayApi from "../../api/galgame/replay";

export type { Message } from "./useGalgameMessage";

export const useGalgameController = () => {
    const { user } = useAuthStore();
    const { fileId, sessionId } = useGameStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // 回放模式检测
    const replayId = searchParams.get('replayId');
    const mode = searchParams.get('mode');
    const isReplay = useMemo(() => mode === 'replay' && !!replayId, [mode, replayId]);

    // 存储完整 allSteps 的 key（按 sessionId 隔离）
    const allStepsStorageKey = useMemo(() => {
        return sessionId ? `galgame-allsteps-${sessionId}` : 'galgame-allsteps';
    }, [sessionId]);

    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [currentScene, setCurrentScene] = useState<GetGalgamePresetResponse['scenes']['scenes'][0] | null>(null);
    const [worldSetting, setWorldSetting] = useState<GetGalgamePresetResponse['world'] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [initialMessages, setInitialMessages] = useState<any[]>([]);
    const [showStoryIntro, setShowStoryIntro] = useState<boolean>(false);
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

    const currentRequestIdRef = useRef<number>(0);
    const historyProcessedRef = useRef<boolean>(false);
    const requestTimeoutRef = useRef<number | null>(null);
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);
    const presetDataLoadedRef = useRef<boolean>(false);
    const lastRefreshRequestIdRef = useRef<number>(0);
    const refreshHistoryAfterTypingRef = useRef<(() => Promise<void>) | null>(null);
    const lastRequestActionRef = useRef<string | null>(null); // 保存最后一次请求的 action
    const lastAutoResendRef = useRef<{ content: string; ts: number } | null>(null);

    const { history, refreshHistory, loading: historyLoading, editHistory } = useGalgameHistory();

    // 根据 assistant 消息数量计算当前是第几回合（用于前几回合免费 / UI 提示）
    const assistantRoundCount = useMemo(() => {
        return history.filter((h: any) => h.role === 'assistant').length;
    }, [history]);

    const FREE_ROUNDS = 30;
    const isFreeRound = assistantRoundCount < FREE_ROUNDS;

    const getPlayerImageUrlCallback = useCallback((): string | undefined => {
        const imageUrl = getPlayerImageUrl(worldSetting?.player);
        return imageUrl ? getImageUrl(imageUrl) : undefined;
    }, [worldSetting]);

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

    // 兜底：如果一整串 steps 里没有任何 choice，就在末尾补一个空 choice，方便展示自定义输入
    const ensureChoiceStep = useCallback((steps: any[]): any[] => {
        if (!Array.isArray(steps) || steps.length === 0) return steps;
        const hasChoiceWithOptions = steps.some(
            (s: any) =>
                s &&
                s.type === 'choice' &&
                Array.isArray(s.options) &&
                s.options.length > 0
        );
        if (hasChoiceWithOptions) {
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

    // 资源切换时重置状态
    useEffect(() => {
        historyProcessedRef.current = false;
        resetDisplayedSteps();
        setInitialMessages([]);
        setGameStarted(false);
        setShowStoryIntro(false);
    }, [fileId, resetDisplayedSteps]);

    const loadPresetData = useCallback(async () => {
        if (!fileId || presetDataLoadedRef.current) {
            return;
        }

        try {
            setIsLoading(true);
            presetDataLoadedRef.current = true;
            const response = await getGalgamePresetApi.getGalgameFileId(fileId);

            if (response.data.data) {
                setPresetData(response.data.data);
                setWorldSetting(response.data.data.world);
                
                const scenes = response.data.data.scenes.scenes;
                if (scenes && scenes.length > 0) {
                    let initialScene = scenes[0];
                    
                    // 直接从历史数据获取 visitedScenes 的最后一个值，而不是使用 hook
                    if (!isReplay && sessionId) {
                        try {
                            const historyResponse = await getGalgamePresetApi.getGalgameHistory(sessionId);
                            if (historyResponse.data?.success && historyResponse.data.visitedScenes) {
                                const visitedScenes = historyResponse.data.visitedScenes;
                                console.log(visitedScenes);
                                
                                if (Array.isArray(visitedScenes) && visitedScenes.length > 0) {
                                    const lastSceneId = visitedScenes[visitedScenes.length - 1];
                                    if (lastSceneId && typeof lastSceneId === 'string') {
                                        const matched = scenes.find(
                                            (scene: GetGalgamePresetResponse['scenes']['scenes'][0]) => 
                                                scene.id === lastSceneId
                                        );
                                        if (matched) {
                                            initialScene = matched;
                                        }
                                    }
                                }
                            }
                        } catch (historyError) {
                            console.warn('获取历史数据失败，使用默认场景:', historyError);
                        }
                    }
                    
                    setCurrentScene(initialScene);

                    // 优先使用当前场景自己的图片
                    let sceneImagePath: string | undefined =
                        (initialScene as any).image || (initialScene as any).images;

                    // 如果当前场景没有配置图片，则回退到第一个有图片的场景
                    if (!sceneImagePath) {
                        const sceneWithImage = scenes.find(
                            (s: any) => typeof s.image === 'string' && s.image
                        );
                        if (sceneWithImage) {
                            sceneImagePath = (sceneWithImage as any).image as string;
                        }
                    }

                    let sceneImageUrl = sceneImagePath
                        ? getImageUrl(sceneImagePath)
                        : '';

                    // 最后兜底：如果还是拿不到有效图片，用内置默认场景图
                    if (!sceneImageUrl) {
                        sceneImageUrl = DEFAULT_SCENE_IMAGE;
                    }

                    setBackgroundImage(sceneImageUrl);
                }
            }
        } catch (error) {
            console.error('获取游戏数据失败:', error);
            presetDataLoadedRef.current = false;
        } finally {
            setIsLoading(false);
        }
    }, [fileId, sessionId, isReplay]);

    useEffect(() => {
        presetDataLoadedRef.current = false;
        loadPresetData();
    }, [fileId, isReplay]);

    // 根据场景 ID 更新场景和背景图
    const updateSceneFromId = useCallback((sceneId: string | null) => {
        if (!sceneId || !presetData) {
            return;
        }

        if (currentScene?.id === sceneId) {
            return;
        }

        const scenes = presetData.scenes?.scenes;
        if (!scenes || scenes.length === 0) {
            return;
        }

        const matchedScene = scenes.find(
            (scene: GetGalgamePresetResponse['scenes']['scenes'][0]) => 
                scene.id === sceneId
        );

        if (matchedScene) {
            setCurrentScene(matchedScene);

            const sceneImagePath = matchedScene.image || matchedScene.images;
            if (sceneImagePath) {
                const sceneImageUrl = getImageUrl(sceneImagePath as string);
                if (sceneImageUrl) {
                    setBackgroundImage(sceneImageUrl);
                    console.log('[Galgame] 更新场景:', sceneId, '背景图:', sceneImageUrl);
                }
            }
        } else {
            console.warn('[Galgame] 未找到匹配的场景 ID:', sceneId);
        }
    }, [presetData, currentScene?.id]);

    const stepHandlers = useGalgameStep({
        sessionId,
        historyLength: assistantRoundCount,
        onMessagesClear: () => {
            setInitialMessages([]);
            try {
                localStorage.removeItem(allStepsStorageKey);
                console.log('[Galgame] 清除本地 allSteps，准备接收新数据');
            } catch (e) {
                console.warn('[Galgame] 清除本地 allSteps 失败:', e);
            }
        },
        onCompleteAllSteps: (steps: any[]) => {
            try {
                localStorage.setItem(allStepsStorageKey, JSON.stringify(steps));
                console.log('[Galgame] 存储完整 allSteps，数量:', Array.isArray(steps) ? steps.length : 0);
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
        },
        isReplay,
        onExhausted: () => {
            if (isReplay) {
                setReplayFinished(true);
            }
        }
    });

    // 请求超时检测（60秒）
    useEffect(() => {
        if (stepHandlers.isWaitingForData) {
            if (requestTimeoutRef.current) {
                window.clearTimeout(requestTimeoutRef.current);
            }
            requestTimeoutRef.current = window.setTimeout(() => {
                if (stepHandlers.isWaitingForData) {
                    setRequestTimeoutVisible(true);
                }
            }, 60000);
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
    }, [stepHandlers.isWaitingForData]);

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
        gameStarted,
        stepHandlers.currentStep,
        initialMessages,
        '',
        false,
        stepHandlers.isWaitingForData,
        stepHandlers.currentStep
    );

    const typingSpeed = isTextMode ? 20 : 30;

    const { displayedText, isTyping } = useStoryTyping({
        text: messageUtils.plainTextForTyping,
        enabled: messageUtils.currentMessage && messageUtils.currentMessage.type !== 'choice' && gameStarted && !!messageUtils.plainTextForTyping,
        speed: typingSpeed,
    });

    const messageUtilsWithTyping = useGalgameMessage(
        worldSetting,
        gameStarted,
        stepHandlers.currentStep,
        initialMessages,
        displayedText,
        isTyping,
        stepHandlers.isWaitingForData,
        stepHandlers.currentStep
    );

    // 回放模式：拉取回放 steps 并注入到队列
    useEffect(() => {
        const run = async () => {
            if (!isReplay || !replayId) return;
            try {
                setIsLoading(true);
                const resp = await replayApi.getReplayAllSteps(replayId);
                const steps = Array.isArray(resp.data?.allSteps) ? resp.data.allSteps : [];
                // 回放模式：始终隐藏玩家台词（用户侧输入）
                const filteredSteps = steps.filter((s: any) => !(s && s.type === 'dialogue' && (s.isPlayer === true || s.is_player === true)));
                if (filteredSteps.length === 0) {
                    toast.error('回放内容为空');
                    return;
                }

                setShowStoryIntro(false);
                setGameStarted(true);
                setReplayFinished(false);
                setInitialMessages([]);

                const [first, ...rest] = filteredSteps;
                stepHandlers.setCurrentStep(first || null);
                stepHandlers.setStepQueue(rest || []);
                stepHandlers.setShowNextButton(first?.type !== 'choice');

                const firstScene = filteredSteps.find((s: any) => s && s.type === 'scene_change' && (s.sceneId || s.sceneImage));
                if (firstScene && firstScene.sceneImage) {
                    const sceneImageUrl = getImageUrl(firstScene.sceneImage);
                    if (sceneImageUrl) setBackgroundImage(sceneImageUrl);
                }
            } catch (e) {
                console.error('[Replay] 获取回放步骤失败:', e);
                toast.error('加载回放失败');
            } finally {
                setIsLoading(false);
            }
        };
        void run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReplay, replayId]);

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

    // 处理场景切换
    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        
        if (currentStep?.type === 'scene_change') {
            if (currentStep.sceneId) {
                updateSceneFromId(currentStep.sceneId);
            }
            
            if (currentStep.sceneImage) {
                const sceneImageUrl = getImageUrl(currentStep.sceneImage);
                if (sceneImageUrl) {
                    setBackgroundImage(prev => {
                        if (prev !== sceneImageUrl) {
                            console.log('[Galgame] 背景图更新（从步骤）:', sceneImageUrl);
                            return sceneImageUrl;
                        }
                        return prev;
                    });
                }
            }

            // 场景切换步骤本身不需要在对话区域显示；无论是否重复发送，只要到达 scene_change，
            // 在更新完场景/背景后，直接自动跳过该步骤，避免出现“空白对话框”和额外点击。
            if (stepHandlers.handleNextStep) {
                stepHandlers.handleNextStep();
            }
        }
    }, [stepHandlers.currentStep, stepHandlers.handleNextStep, updateSceneFromId]);

    useEffect(() => {
        if (isReplay) {
            setShowStoryIntro(false);
            return;
        }
        if (gameStarted && stepHandlers.currentStep && showStoryIntro) {
            setShowStoryIntro(false);
        }
    }, [isReplay, gameStarted, stepHandlers.currentStep, showStoryIntro]);

    // 处理历史记录
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

            if (lastMessage.role === 'user' && lastMessage.content) {
                // 防重复：相同内容在短时间内不重复自动重发
                const now = Date.now();
                const prev = lastAutoResendRef.current;
                const sameContent = prev && prev.content === lastMessage.content;
                const withinWindow = prev && (now - prev.ts) < 5000; // 5s窗口
                if (!stepHandlers.isWaitingForData && !(sameContent && withinWindow)) {
                    lastAutoResendRef.current = { content: lastMessage.content, ts: now };
                    stepHandlers.handleStreamAction(lastMessage.content, {
                        onError: (error) => {
                            console.error('自动重发用户消息失败:', error);
                        }
                    });
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
                            console.log('[Galgame] 使用本地 allSteps 恢复，数量:', restoredSteps.length);
                            setShowStoryIntro(false);
                            setGameStarted(true);
                            resetDisplayedSteps();
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
                const hasChoiceInHistory = rawHistorySteps.some(
                    (s: any) => s && s.type === 'choice' && s.options && s.options.length > 0
                );

                if (historySteps.length > 0) {
                    setCompletedSteps(historySteps);

                    const choiceStep = historySteps.find(s => s.type === 'choice' && s.options && s.options.length > 0);
                    if (choiceStep && (choiceStep as any).options && (choiceStep as any).options.length > 0) {
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
                        setCompletedSteps([choiceStep]);

                        const choiceMessage = createChoiceMessage(choiceData);
                        if (choiceMessage) {
                            setInitialMessages([choiceMessage]);
                        }
                    }
                }

                if (!hasChoiceInHistory && history.length >= 2) {
                    for (let i = history.length - 2; i >= 0; i--) {
                        if (history[i].role === 'user' && history[i].content) {
                            const lastUserMessage = history[i].content;
                            if (!stepHandlers.isWaitingForData) {
                                stepHandlers.handleStreamAction(lastUserMessage, {
                                    onError: (error) => {
                                        console.error('自动重发倒数第一条用户消息失败:', error);
                                    }
                                });
                            }
                            break;
                        }
                    }
                }
            }
        }
    }, [isReplay, historyLoading, presetData, history, worldSetting, stepHandlers, allStepsStorageKey, resetDisplayedSteps, getPlayerImageUrlCallback, createChoiceMessage]);

    useEffect(() => {
        if (historyLoading || !presetData) return;

        if (history.length > 0) {
            if (!historyProcessedRef.current) {
                setShowStoryIntro(false);
                setGameStarted(true);
                processHistoryRecord();
                historyProcessedRef.current = true;
            }
        } else if (!historyProcessedRef.current) {
            setShowStoryIntro(true);
            historyProcessedRef.current = true;
        }
    }, [historyLoading, presetData, history.length, processHistoryRecord]);

    useEffect(() => {
        if (isTextMode && gameStarted && completedSteps.length === 0 && !historyLoading && history.length > 0 && presetData && !stepHandlers.isWaitingForData && !stepHandlers.currentStep) {
            processHistoryRecord();
            historyProcessedRef.current = true;
        }
    }, [isTextMode, gameStarted, completedSteps.length, historyLoading, history.length, presetData, processHistoryRecord, stepHandlers.isWaitingForData, stepHandlers.currentStep]);

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
        if (!fileId || !user?.user.id) {
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
    }, [fileId, user?.user.id]);

    const handleStartGame = useCallback(async () => {
        if (!sessionId) {
            toast.error('没有 sessionId，无法开始游戏');
            return;
        }

        setIsStartingGame(true);
        setGameStarted(true);
        setInitialMessages([]);

        await stepHandlers.handleStreamAction('开始游戏', {
            onBeforeRequest: () => {
                setInitialMessages([]);
                resetDisplayedSteps();
            },
            onSuccess: () => {
                setIsStartingGame(false);
                addConversion();
            },
            onError: (error) => {
                console.error('❌ 开始游戏失败:', error);
                toast.error(error || '开始游戏失败，请重试');
                setIsStartingGame(false);
                setGameStarted(false);
                setShowStoryIntro(true);
            }
        });
    }, [sessionId, stepHandlers, resetDisplayedSteps, addConversion]);

    const handleNextMessage = useCallback(() => {
        if (gameStarted && stepHandlers.showNextButton) {
            stepHandlers.handleNextStep();
        }
    }, [gameStarted, stepHandlers]);

    const handleAutoPlayToggle = useCallback(() => {
        setIsAutoPlay(prev => !prev);
    }, []);

    useEffect(() => {
        // 文本模式下始终自动播放，不受按钮控制
        const shouldAutoPlay = isTextMode ? true : isAutoPlay;
        
        if (!shouldAutoPlay || !gameStarted) return;
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
        }, 1000);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, isTextMode, messageUtilsWithTyping.finalIsTyping, messageUtilsWithTyping.currentMessage?.type, stepHandlers.showNextButton, stepHandlers.isWaitingForData, gameStarted, handleNextMessage]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!messageUtilsWithTyping.currentMessage || messageUtilsWithTyping.currentMessage.type !== 'choice' || !messageUtilsWithTyping.currentMessage.options) {
            return;
        }

        const optionIndex = messageUtilsWithTyping.currentMessage.options.findIndex((opt) => {
            return opt.text === option.text || opt.id === option.id;
        });
        if (optionIndex < 0) return;

        const optionText = messageUtilsWithTyping.currentMessage.options[optionIndex].text;

        // 保存最后一次请求的 action
        lastRequestActionRef.current = optionText;

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

                stepHandlers.handleChoiceOption(optionData, stepOptionIndex);
                return;
            }
        }

        stepHandlers.handleChoiceOption({ text: optionText, nextId: '' }, optionIndex);
    }, [stepHandlers, messageUtilsWithTyping.currentMessage, resetDisplayedSteps]);

    const handleCustomInputSubmit = useCallback((value: string) => {
        if (!value.trim()) return;
        // 保存最后一次请求的 action
        lastRequestActionRef.current = value.trim();
        stepHandlers.handleChoiceSend(value);
    }, [stepHandlers]);

    const handleRetryLastRequest = useCallback(async () => {
        setRequestTimeoutVisible(false);
        setErrorModalVisible(false);

        const lastAction = lastRequestActionRef.current;
        if (!lastAction) {
            toast.error('没有可重试的上次操作');
            return;
        }

        await stepHandlers.handleStreamAction(lastAction, {
            onError: () => {
                toast.error('重试失败，请稍后再试');
            }
        });
    }, [stepHandlers]);

    const handleExitGame = useCallback(() => {
        try {
            localStorage.removeItem(allStepsStorageKey);
            console.log('[Galgame] 已清理临时状态数据');
        } catch (e) {
            console.warn('[Galgame] 清理临时状态失败:', e);
        }
        navigate('/');
    }, [allStepsStorageKey, navigate]);

    return {
        isReplay,
        replayFinished,
        isLoading,
        backgroundImage,
        currentScene,
        worldSetting,
        presetData,
        showStoryIntro,
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
        convertStepsToTextModalFormat: messageUtilsWithTyping.convertStepsToTextModalFormat,
        history,
        refreshHistory,
        editHistory,
        stepHandlers,
        handleStartGame,
        handleNextMessage,
        handleAutoPlayToggle,
        handleChoiceClick,
        handleCustomInputSubmit,
        handleRetryLastRequest,
        handleExitGame,
        resetDisplayedSteps,
        isFreeRound,
    };
};
