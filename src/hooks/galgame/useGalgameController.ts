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
import { HOST_ADDRESS } from "../../config";
import { extractChoiceFromHistory, extractPlainText, parseHistoryToSteps } from "../../utils/textUtils";
import statisticsApi from "../../api/statistics/statisticsApi";
import toast from "react-hot-toast";

// 导出 Message 类型供其他文件使用
export type { Message } from "./useGalgameMessage";

export const useGalgameController = () => {
    const { user } = useAuthStore();
    const { fileId, sessionId, isPreset } = useGameStore();
    const navigate = useNavigate();

    // 存储完整 allSteps 的 key（按 sessionId 隔离）
    const allStepsStorageKey = useMemo(() => {
        return sessionId ? `galgame-allsteps-${sessionId}` : 'galgame-allsteps';
    }, [sessionId]);

    // 基础状态
    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [currentScene, setCurrentScene] = useState<GetGalgamePresetResponse['scenes']['scenes'][0] | null>(null);
    const [worldSetting, setWorldSetting] = useState<GetGalgamePresetResponse['world'] | null>(null);

    // UI 状态
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

    // Refs
    const currentRequestIdRef = useRef<number>(0);
    const historyProcessedRef = useRef<boolean>(false);
    const requestTimeoutRef = useRef<number | null>(null);
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);
    const pendingHistoryRefreshRef = useRef<boolean>(false);

    const { history, refreshHistory, loading: historyLoading, editHistory, lastVisitedSceneId } = useGalgameHistory();

    const resetDisplayedSteps = useCallback(() => {
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;
    }, []);

    // 当资源切换（如重新选择文件）时重置历史处理标记和已展示步骤
    useEffect(() => {
        historyProcessedRef.current = false;
        resetDisplayedSteps();
        setInitialMessages([]);
        setGameStarted(false);
        setShowStoryIntro(false);
    }, [fileId, resetDisplayedSteps]);

    // 加载预设数据
    useEffect(() => {
        const fetchPresetData = async () => {
            if (!fileId) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = isPreset ? await getGalgamePresetApi.getGalgamePreset(fileId) 
                    : await getGalgamePresetApi.getGalgameFileId(fileId);

                if (response.data.success) {
                    const presetDataResp = response.data.data as GetGalgamePresetResponse;
                    setPresetData(presetDataResp);
                    setWorldSetting(presetDataResp.world);

                    let sceneImage = '';
                    if (presetDataResp.scenes?.scenes && presetDataResp.scenes.scenes.length > 0) {
                        const scenes = presetDataResp.scenes.scenes;
                        let initialScene = scenes[0];
                        if (lastVisitedSceneId) {
                            const matched = scenes.find((scene: GetGalgamePresetResponse['scenes']['scenes'][0]) => scene.id === lastVisitedSceneId);
                            if (matched) {
                                initialScene = matched;
                            }
                        }

                        if (initialScene) {
                            setCurrentScene(initialScene);
                        }

                        const sceneImageUrl = (initialScene as any).image || initialScene.images;
                        if (sceneImageUrl) {
                            sceneImage = sceneImageUrl.startsWith('http')
                                ? sceneImageUrl
                                : `${HOST_ADDRESS}${sceneImageUrl}`;
                            setBackgroundImage(sceneImage);
                        }
                    }

                    if (!sceneImage) {
                        setBackgroundImage('https://img1.baidu.com/it/u=728753041,714041801&fm=253&app=138&f=JPEG?w=889&h=500');
                    }
                    setShowStoryIntro(history.length === 0);
                }
            } catch (error) {
                console.error('获取游戏数据失败:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPresetData();
    }, [fileId, lastVisitedSceneId, isPreset, history.length]);

    // 步骤处理器 - 关键修复：不在流式响应完成后立即刷新历史，而是标记待刷新
    const stepHandlers = useGalgameStep({
        sessionId,
        historyLength: history.length,
        onMessagesClear: () => {
            setInitialMessages([]);
            resetDisplayedSteps();
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
            // 流式响应完成时，标记需要刷新历史，但不立即刷新
            // 等待打字机输出完成后再刷新
            pendingHistoryRefreshRef.current = true;
        },
    });

    // 统一监听是否在等待后端数据，如果超过 60s 仍未返回则弹出超时提示
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

    // 当新请求开始时，清空已完成的步骤
    useEffect(() => {
        const currentRequestId = stepHandlers.currentRequestId?.current || 0;
        if (currentRequestId !== currentRequestIdRef.current) {
            currentRequestIdRef.current = currentRequestId;
            setCompletedSteps([]);
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
    }, [stepHandlers.currentRequestId?.current]);

    // 消息转换和打字机效果
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

    // 重新计算消息（使用实际的打字机状态）
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

    // 当打字机输出完成且流式响应已完成时，刷新历史数据
    useEffect(() => {
        const wasTyping = previousIsTypingRef.current;
        const isNowTyping = isTyping;

        // 打字机从输出中变为完成，且流式响应已完成（不再等待数据），且有 pending 标记时刷新
        if (wasTyping && !isNowTyping && !stepHandlers.isWaitingForData && pendingHistoryRefreshRef.current) {
            pendingHistoryRefreshRef.current = false;
            refreshHistory().catch((error) => {
                console.error('[Galgame] 刷新历史数据失败:', error);
            });
        }

        previousIsTypingRef.current = isTyping;
    }, [isTyping, stepHandlers.isWaitingForData, refreshHistory]);

    // 处理场景切换
    useEffect(() => {
        if (stepHandlers.currentStep?.type === 'scene_change') {
            const step = stepHandlers.currentStep;
            const converted = messageUtilsWithTyping.convertStepToMessage(step);
            if (converted && 'sceneData' in converted) {
                const sceneData = (converted as any).sceneData;
                if (sceneData) {
                    setCurrentScene(sceneData as GetGalgamePresetResponse['scenes']['scenes'][0]);
                }
                if (step.sceneImage) {
                    const sceneImage = step.sceneImage.startsWith('http')
                        ? step.sceneImage
                        : `${HOST_ADDRESS}${step.sceneImage}`;
                    setBackgroundImage(sceneImage);
                }
            }
        }
    }, [stepHandlers.currentStep, messageUtilsWithTyping]);

    useEffect(() => {
        if (gameStarted && stepHandlers.currentStep && showStoryIntro) {
            setShowStoryIntro(false);
        }
    }, [gameStarted, stepHandlers.currentStep, showStoryIntro]);

    // 处理历史记录的函数
    const processHistoryRecord = useCallback(() => {
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
                        if (choiceData) {
                            const choiceMessage = {
                                id: Date.now(),
                                type: 'choice',
                                message: choiceData.title
                                    ? (choiceData.text ? `${choiceData.title}\n${choiceData.text}` : choiceData.title)
                                    : (choiceData.text || '请选择你的行动'),
                                options: choiceData.options.map((opt, index) => ({
                                    id: index + 1,
                                    text: extractPlainText(opt),
                                })),
                                characterImage: (() => {
                                    const images = worldSetting?.player?.images as any;
                                    if (images) {
                                        const playerImage = typeof images === 'string'
                                            ? images
                                            : (images?.base || images);
                                        if (playerImage && typeof playerImage === 'string') {
                                            return playerImage.startsWith('http')
                                                ? playerImage
                                                : `${HOST_ADDRESS}${playerImage}`;
                                        }
                                    }
                                    return undefined;
                                })(),
                                characterPosition: 'right' as const,
                            };
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

                        const choiceMessage = {
                            id: Date.now(),
                            type: 'choice',
                            message: choiceData.title
                                ? (choiceData.text ? `${choiceData.title}\n${choiceData.text}` : choiceData.title)
                                : (choiceData.text || '请选择你的行动'),
                            options: choiceData.options.map((opt, index) => ({
                                id: index + 1,
                                text: extractPlainText(opt),
                            })),
                            characterImage: (() => {
                                const images = worldSetting?.player?.images as any;
                                if (images) {
                                    const playerImage = typeof images === 'string'
                                        ? images
                                        : (images?.base || images);
                                    if (playerImage && typeof playerImage === 'string') {
                                        return playerImage.startsWith('http')
                                            ? playerImage
                                            : `${HOST_ADDRESS}${playerImage}`;
                                    }
                                }
                                return undefined;
                            })(),
                            characterPosition: 'right' as const,
                        };
                        setInitialMessages([choiceMessage]);
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
    }, [historyLoading, presetData, history, worldSetting, stepHandlers, allStepsStorageKey, resetDisplayedSteps]);

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

    // 简化的步骤管理
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
        if (isTextMode && !isAutoPlay) {
            setIsAutoPlay(true);
        }
    }, [isTextMode, isAutoPlay]);

    useEffect(() => {
        if (!isAutoPlay || !gameStarted) return;
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
        stepHandlers.handleChoiceSend(value);
    }, [stepHandlers]);

    const handleRetryLastRequest = useCallback(() => {
        setRequestTimeoutVisible(false);
        window.location.reload();
    }, []);

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
        // 状态
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
        
        // 消息和步骤
        currentMessage: messageUtilsWithTyping.currentMessage,
        finalDisplayText: messageUtilsWithTyping.finalDisplayText,
        finalIsTyping: messageUtilsWithTyping.finalIsTyping,
        allStepsForTextModal,
        currentStepIndex,
        textModalDisplayText: messageUtilsWithTyping.textModalDisplayText,
        convertStepsToTextModalFormat: messageUtilsWithTyping.convertStepsToTextModalFormat,
        
        // 历史记录
        history,
        refreshHistory,
        editHistory,
        
        // 步骤处理器
        stepHandlers,
        
        // 事件处理
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
