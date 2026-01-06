import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useGameStore } from "../../store/gameStore";
import { useGalgameStep } from "./useGalgameStep";
import useGalgameHistory from "./useGalgameHistory";
import { useStoryTyping } from "../story/useStoryTyping";
import { useGalgameMessage } from "./useGalgameMessage";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { GetGalgamePresetResponse } from "../../api/galgame/getGalgamePreset.type";
import { getImageUrl } from "../../utils/constants";
import { extractChoiceFromHistory, extractPlainText, parseHistoryToSteps } from "../../utils/textUtils";
import statisticsApi from "../../api/statistics/statisticsApi";
import toast from "react-hot-toast";

export type { Message } from "./useGalgameMessage";

export const useGalgameController = () => {
    const { user } = useAuthStore();
    const { fileId, sessionId } = useGameStore();
    const navigate = useNavigate();

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

    const { history, refreshHistory, loading: historyLoading, editHistory, lastVisitedSceneId } = useGalgameHistory();

    const getPlayerImageUrl = useCallback((): string | undefined => {
        const images = worldSetting?.player?.images as string | { base: string };
        if (images) {
            const playerImage = typeof images === 'string'
                ? images
                : (images?.base || images);
            if (playerImage && typeof playerImage === 'string') {
                return getImageUrl(playerImage);
            }
        }
        return undefined;
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
            characterImage: getPlayerImageUrl(),
            characterPosition: 'right' as const,
        };
    }, [getPlayerImageUrl]);

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
            const response =await getGalgamePresetApi.getGalgameFileId(fileId);

            if (response.data.data) {
                setPresetData(response.data.data);
                setWorldSetting(response.data.data.world);
                
                const scenes = response.data.data.scenes.scenes;
                if (scenes && scenes.length > 0) {
                    let initialScene = scenes[0];
                    if (lastVisitedSceneId) {
                        const matched = scenes.find(
                            (scene: GetGalgamePresetResponse['scenes']['scenes'][0]) => 
                                scene.id === lastVisitedSceneId
                        );
                        if (matched) {
                            initialScene = matched;
                        }
                    }
                    setCurrentScene(initialScene);

                    const sceneImagePath = initialScene.image || initialScene.images;
                    const sceneImageUrl = getImageUrl(sceneImagePath as string);
                    console.log(sceneImageUrl);
                    if (sceneImageUrl) {
                        setBackgroundImage(sceneImageUrl);
                    } else {
                        setBackgroundImage('https://img1.baidu.com/it/u=728753041,714041801&fm=253&app=138&f=JPEG?w=889&h=500');
                    }
                }
            }
        } catch (error) {
            console.error('获取游戏数据失败:', error);
            presetDataLoadedRef.current = false;
        } finally {
            setIsLoading(false);
        }
    }, [fileId, lastVisitedSceneId]);

    useEffect(() => {
        presetDataLoadedRef.current = false;
        loadPresetData();
    }, [fileId]);

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

    useEffect(() => {
        if (lastVisitedSceneId) {
            updateSceneFromId(lastVisitedSceneId);
        }
    }, [lastVisitedSceneId, updateSceneFromId]);

    const stepHandlers = useGalgameStep({
        sessionId,
        historyLength: history.length,
        onMessagesClear: () => {
            setInitialMessages([]);
            resetDisplayedSteps();
            // 清除本地存储的 allSteps，避免新请求时使用旧数据恢复
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

    const { displayedText, isTyping } = useStoryTyping({
        text: messageUtils.plainTextForTyping,
        enabled: messageUtils.currentMessage && messageUtils.currentMessage.type !== 'choice' && gameStarted && !!messageUtils.plainTextForTyping,
        speed: 60
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

    useEffect(() => {
        previousIsTypingRef.current = isTyping;
    }, [isTyping]);

    const refreshHistoryAfterTyping = useCallback(async () => {
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
    }, [isTyping, refreshHistory, stepHandlers]);

    useEffect(() => {
        refreshHistoryAfterTypingRef.current = refreshHistoryAfterTyping;
    }, [refreshHistoryAfterTyping]);

    // 处理场景切换
    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        
        if (currentStep?.type === 'scene_change' && currentStep.sceneId) {
            updateSceneFromId(currentStep.sceneId);
            
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
        }
    }, [stepHandlers.currentStep, updateSceneFromId]);

    useEffect(() => {
        if (gameStarted && stepHandlers.currentStep && showStoryIntro) {
            setShowStoryIntro(false);
        }
    }, [gameStarted, stepHandlers.currentStep, showStoryIntro]);

    // 处理历史记录
    const processHistoryRecord = useCallback(() => {
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
                if (!stepHandlers.isWaitingForData) {
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
                            console.log('[Galgame] 使用本地 allSteps 恢复，数量:', savedSteps.length);
                            setShowStoryIntro(false);
                            setGameStarted(true);
                            resetDisplayedSteps();
                            setInitialMessages([]);
                            const [first, ...rest] = savedSteps;
                            stepHandlers.setCurrentStep(first || null);
                            stepHandlers.setStepQueue(rest || []);
                            stepHandlers.setShowNextButton(first?.type !== 'choice');
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[Galgame] 读取本地 allSteps 失败:', e);
                }

                const historySteps = parseHistoryToSteps(content);
                const hasChoiceInHistory = historySteps.some(
                    (s: any) => s && s.type === 'choice' && s.options && s.options.length > 0
                );

                if (historySteps.length > 0) {
                    setCompletedSteps(historySteps);

                    const choiceStep = historySteps.find(s => s.type === 'choice');
                    if (choiceStep && choiceStep.options && choiceStep.options.length > 0) {
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
    }, [historyLoading, presetData, history, worldSetting, stepHandlers, allStepsStorageKey, resetDisplayedSteps, getPlayerImageUrl, createChoiceMessage]);

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
        if (!isAutoPlay || !gameStarted) return;
        if (stepHandlers.isWaitingForData) return;
        if (messageUtilsWithTyping.finalIsTyping) return;
        if (!stepHandlers.showNextButton) return;
        if (messageUtilsWithTyping.currentMessage?.type === 'choice') {
            setIsAutoPlay(false);
            return;
        }

        const autoPlayTimer = setTimeout(() => {
            if (isAutoPlay && !messageUtilsWithTyping.finalIsTyping && stepHandlers.showNextButton && messageUtilsWithTyping.currentMessage?.type !== 'choice' && !stepHandlers.isWaitingForData) {
                handleNextMessage();
            }
        }, 1000);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, messageUtilsWithTyping.finalIsTyping, messageUtilsWithTyping.currentMessage?.type, stepHandlers.showNextButton, stepHandlers.isWaitingForData, gameStarted, handleNextMessage, isTextMode]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!messageUtilsWithTyping.currentMessage || messageUtilsWithTyping.currentMessage.type !== 'choice' || !messageUtilsWithTyping.currentMessage.options) {
            return;
        }

        resetDisplayedSteps();

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
    };
};

