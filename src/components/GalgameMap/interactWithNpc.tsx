import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CiLocationOn } from "react-icons/ci";
import { MdCheckCircle } from "react-icons/md";
import styles from './interactWithNpc.module.css';
import { LuFileText } from "react-icons/lu";
import { MdOutlineAutoStories } from "react-icons/md";
import { BiHistory } from "react-icons/bi";
import { PiMusicNoteDuotone } from "react-icons/pi";
import { extractPlainText, truncateTextWithTags } from "../../utils/textUtils";
import { useAuthStore } from "../../store/useAuthStore";
import { useGameStore } from "../../store/gameStore";
import { useMapGalgameStore, MapViewState } from "../../store/mapGalgameStore";
import { useWorldInteractionStep } from "../../hooks/mapGalgame/useWorldInteractionStep";
import { useHistoryPolling, type PendingRequest } from "../../hooks/mapGalgame/useHistoryPolling";
import { useCharacterAnimation } from "../../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../../hooks/galgame/useCharacterContainerClassName";
import { useStoryTyping } from "../../hooks/story/useStoryTyping";
import { useMapMusicPlayer } from "../../hooks/mapGalgame/useMapMusicPlayer";
import { useRefreshEventData } from "../../hooks/mapGalgame/useRefreshEventData";
import { useInteractionInit } from "../../hooks/mapGalgame/useInteractionInit";
import NormalModeDisplay from "./NormalModeDisplay";
import TextModeDisplay from "./TextModeDisplay";
import HistoryModal from "./historyModal";
import WorldModal from "./WorldModal";
import type { AllGameData } from "../../api/worldInteraction/mapWorldData.type";
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";
import interactionApi from "../../api/worldInteraction/interactionApi";
import {
    type Message,
    getImageUrl,
    getPlayerImage,
    convertStepToMessage,
    convertStepsToTextModalFormat,
    getStorageKeys,
    safeSetLocalStorage,
    safeRemoveLocalStorage,
} from "../../hooks/mapGalgame/interactionUtils";

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;

const InteractWithNpc = ({ 
    onClose, 
    gameData,
    worldInteractionHistory,
}: { 
    onClose: () => void;
    gameData: AllGameData | null;
    worldInteractionHistory: GetWorldInteractionHistoryResponse | null;
}) => {
    const { user } = useAuthStore();
    const sessionId = useGameStore((state) => state.sessionId);
    const { fileId } = useGameStore();
    const { eventData, setEventData, setCurrentView, selectedSubscene, eventCompleted, setEventCompleted, setIsTypingInInteractNpc } = useMapGalgameStore();
    const { refreshEventData } = useRefreshEventData();

    const eventId = eventData?.event?.eventId || null;
    const worldSetting = gameData?.worldSetting || null;
    const sceneSetting = gameData?.sceneSetting || null;
    const currentSubscene = eventData?.subscene || null;
    const { isMusicPlaying, handleMusicToggle } = useMapMusicPlayer({
        fileId: fileId || null,
        gameData,
        currentView: MapViewState.INTERACT_NPC,
        selectedSubscene,
        eventData,
    });
    
    // 游戏状态
    const [gameState, setGameState] = useState({
        gameStarted: false,
        isAutoPlay: false,
        isTextMode: false,
        completedSteps: [] as any[],
        isHistoryVisible: false,
        hasPendingRequest: false,
    });
    const setGameStarted = useCallback((value: boolean) => setGameState(prev => ({ ...prev, gameStarted: value })), []);
    const setIsAutoPlay = useCallback((value: boolean) => setGameState(prev => ({ ...prev, isAutoPlay: value })), []);
    const setIsTextMode = useCallback((value: boolean) => setGameState(prev => ({ ...prev, isTextMode: value })), []);
    const setCompletedSteps = useCallback((value: any[] | ((prev: any[]) => any[])) => {
        setGameState(prev => ({
            ...prev,
            completedSteps: typeof value === 'function' ? value(prev.completedSteps) : value
        }));
    }, []);
    const setIsHistoryVisible = useCallback((value: boolean) => setGameState(prev => ({ ...prev, isHistoryVisible: value })), []);
    const setHasPendingRequest = useCallback((value: boolean) => setGameState(prev => ({ ...prev, hasPendingRequest: value })), []);
    const { gameStarted, isAutoPlay, isTextMode, completedSteps, isHistoryVisible, hasPendingRequest } = gameState;

    // 合并弹窗状态
    const [modals, setModals] = useState({
        error: { visible: false, message: '' },
        timeout: { visible: false, message: '' },
    });
    const setErrorModal = useCallback((value: { visible: boolean; message: string }) => {
        setModals(prev => ({ ...prev, error: value }));
    }, []);
    const setTimeoutModal = useCallback((value: { visible: boolean; message: string }) => {
        setModals(prev => ({ ...prev, timeout: value }));
    }, []);
    const { error: errorModal, timeout: timeoutModal } = modals;

    // 合并 refs
    const refs = useRef({
        currentRequestId: 0,
        hasInitialized: false,
        isRestoringFromCache: false,
        backgroundInitialized: false,
        interactTimeout: null as number | null,
        choiceTimeout: null as number | null,
        choiceInFlight: false,
        previousStep: null as any,
        previousIsTyping: false,
    });

    // 其他状态
    const [displayBackgroundImage, setDisplayBackgroundImage] = useState<string>('');
    const [latestHistory, setLatestHistory] = useState<GetWorldInteractionHistoryResponse | null>(worldInteractionHistory);
    const [pendingRequestForPoll, setPendingRequestForPoll] = useState<PendingRequest | null>(null);
    const backgroundImage = displayBackgroundImage;

    // 提取背景图片获取逻辑
    const getSubsceneImage = useCallback((subscene: { id?: string; image?: string } | null): string => {
        if (!subscene) return '';
        
        if (subscene.image) {
            return getImageUrl(subscene.image) || '';
        }
        
        if (subscene.id && sceneSetting?.scenes) {
            for (const scene of sceneSetting.scenes) {
                const found = scene.subscenes?.find((sub: any) => sub.id === subscene.id);
                if (found?.image) {
                    return getImageUrl(found.image) || '';
                }
            }
        }
        
        return '';
    }, [sceneSetting]);

    // 初始化背景图片
    useEffect(() => {
        if (refs.current.backgroundInitialized) return;
        if (!displayBackgroundImage && eventData?.subscene) {
            const bgImage = getSubsceneImage(eventData.subscene);
            if (bgImage) {
                setDisplayBackgroundImage(bgImage);
                refs.current.backgroundInitialized = true;
            }
        }
    }, [eventData?.subscene?.image, eventData?.subscene?.id, sceneSetting, displayBackgroundImage, getSubsceneImage]);

    const stepHandlers = useWorldInteractionStep({
        sessionId,
        eventId,
        fileId: fileId,
        historyLength: latestHistory?.interactions.length ?? 0,
        onMessagesClear: () => {
            setCompletedSteps([]);
            refs.current.previousStep = null;
            refs.current.previousIsTyping = false;
        }
    });

    useEffect(() => {
        if (worldInteractionHistory) {
            setLatestHistory(worldInteractionHistory);
        }
    }, [worldInteractionHistory]);

    const refreshHistory = useCallback(async () => {
        if (!sessionId) return;
        try {
            const response = await interactionApi.getWorldInteractionHistory(sessionId);
            if (response.data?.success) {
                setLatestHistory(response.data);
            }
        } catch (error) {
            console.warn('[WorldInteraction] 获取最新历史记录失败:', error);
        }
    }, [sessionId]);
    // 清理超时
    useEffect(() => {
        return () => {
            if (refs.current.interactTimeout) {
                clearTimeout(refs.current.interactTimeout);
                refs.current.interactTimeout = null;
            }
            if (refs.current.choiceTimeout) {
                clearTimeout(refs.current.choiceTimeout);
                refs.current.choiceTimeout = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isHistoryVisible || !sessionId) return;

        let cancelled = false;

        const fetchHistory = async () => {
            try {
                const response = await interactionApi.getWorldInteractionHistory(sessionId);
                if (!cancelled && response.data?.success) {
                    setLatestHistory(response.data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[WorldInteraction] 获取历史记录失败:', error);
                }
            }
        };

        void fetchHistory();

        return () => {
            cancelled = true;
        };
    }, [isHistoryVisible, sessionId]);

    const historyChoiceMessage: Message | null = useMemo(() => {
        if (!latestHistory || !latestHistory.interactions.length) return null;
        const last = latestHistory.interactions[latestHistory.interactions.length - 1] as any;
        if (last.type !== 'npc_dialogue') {
            return null;
        }

        const options = last.narrativeSteps[last.narrativeSteps.length - 1].options.map((opt: any, index: number) => ({
            id: index + 1,
            text: opt.text,
            optionId: opt.optionId,
        }));

        return {
            id: Date.now(),
            type: 'choice',
            message: '请选择你的行动',
            options,
            characterImage: getPlayerImage(worldSetting?.player?.imagePath),
            characterPosition: 'right',
        };
    }, [latestHistory, worldSetting]);

    const currentMessage = useMemo((): Message => {
        // 1）优先使用当前 step（正常交互流程）
        if (gameStarted && stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const converted = convertStepToMessage(stepHandlers.currentStep, worldSetting);
            if (converted) {
                return converted;
            }
        }

        if (historyChoiceMessage && !hasPendingRequest) {
            return historyChoiceMessage;
        }

        if (hasPendingRequest || stepHandlers.isWaitingForData) {
            return { id: 0, type: 'narration', message: '' };
        }

        return { id: 0, type: 'narration', message: '' };
    }, [gameStarted, stepHandlers.currentStep, stepHandlers.isWaitingForData, worldSetting, historyChoiceMessage, hasPendingRequest]);
    
    const characterAnimation = useCharacterAnimation({
        message: currentMessage?.message,
        messageType: currentMessage?.type,
    });

    const getCharacterContainerClassName = useCharacterContainerClassName({
        characterPosition: currentMessage?.characterPosition,
        characterAnimation,
        styles,
    });

    useEffect(() => {
        const currentRequestId = stepHandlers.currentRequestId?.current || 0;
        if (currentRequestId !== refs.current.currentRequestId) {
            refs.current.currentRequestId = currentRequestId;
            setCompletedSteps([]);
            refs.current.previousStep = null;
            refs.current.previousIsTyping = false;
        }
    }, [stepHandlers.currentRequestId?.current, setCompletedSteps]);
    
    const resetCompletedSteps = useCallback(() => {
        setCompletedSteps([]);
        refs.current.previousStep = null;
        refs.current.previousIsTyping = false;
    }, [setCompletedSteps]);

    const { interactTimeoutRef } = useInteractionInit({
        sessionId,
        eventId,
        gameData,
        fileId,
        gameStarted,
        setGameStarted,
        setLatestHistory,
        setHasPendingRequest,
        setPendingRequestForPoll,
        setTimeoutModal,
        setErrorModal,
        stepHandlers,
        resetCompletedSteps,
        setRestoringFromCache: (value: boolean) => {
            refs.current.isRestoringFromCache = value;
        },
    });

    // 同步 interactTimeoutRef 到 refs
    useEffect(() => {
        refs.current.interactTimeout = interactTimeoutRef.current;
    }, [interactTimeoutRef.current]);

    const handlePollMatchFound = useCallback(async (matchedSteps: any[]) => {
        if (!matchedSteps.length) return;
        const [first, ...rest] = matchedSteps;

        setCompletedSteps([]);
        refs.current.previousStep = null;
        refs.current.previousIsTyping = false;

        stepHandlers.setCurrentStep(first || null);
        stepHandlers.setStepQueue(rest || []);
        stepHandlers.setShowNextButton(first?.type !== "choice");

        setHasPendingRequest(false);
        const storageKeys = getStorageKeys(sessionId, eventId);
        if (storageKeys.pendingRequest) {
            safeRemoveLocalStorage(storageKeys.pendingRequest);
        }
    }, [setCompletedSteps, setHasPendingRequest, stepHandlers, sessionId, eventId]);

    const handlePollTimeout = useCallback(() => {
        setHasPendingRequest(false);
        setTimeoutModal({
            visible: true,
            message: "AI 推演结果长时间未返回，是否刷新页面重试？",
        });
    }, []);

    const handlePollEnd = useCallback(async () => {
        setPendingRequestForPoll(null);
        await refreshHistory();
    }, [refreshHistory]);
    useHistoryPolling({
        sessionId,
        eventId,
        pendingRequest: pendingRequestForPoll,
        onHistoryUpdate: setLatestHistory,
        onMatchFound: handlePollMatchFound,
        onTimeout: handlePollTimeout,
        onPollEnd: handlePollEnd,
    });

    const handleNextMessage = useCallback(() => {
        if (gameStarted && stepHandlers.showNextButton) {
            if (stepHandlers.stepQueue && stepHandlers.stepQueue.length === 0) {
                return;
            }
            stepHandlers.handleNextStep();
        }
    }, [gameStarted, stepHandlers]);

    const handleAutoPlayToggle = useCallback(() => {
        setIsAutoPlay(!isAutoPlay);
    }, [isAutoPlay, setIsAutoPlay]);

    const plainTextForTyping = useMemo(() => {
        if (currentMessage && currentMessage.type !== 'choice') {
            return extractPlainText(currentMessage.message);
        }
        return '';
    }, [currentMessage]);

    const { displayedText, isTyping } = useStoryTyping({
        text: plainTextForTyping,
        enabled: currentMessage && currentMessage.type !== 'choice' && gameStarted && !!plainTextForTyping,
        speed: 60
    });

    const finalDisplayText = (stepHandlers.isWaitingForData || hasPendingRequest) && !stepHandlers.currentStep
        ? ''
        : (gameStarted ? displayedText : (currentMessage && currentMessage.type !== 'choice' ? currentMessage.message : ''));

    const finalIsTyping = ((stepHandlers.isWaitingForData || hasPendingRequest) && !stepHandlers.currentStep) ? false : isTyping;
    
    useEffect(() => {
        setIsTypingInInteractNpc(finalIsTyping);
    }, [finalIsTyping, setIsTypingInInteractNpc]);

    useEffect(() => {
        const hasCompletedEvent = stepHandlers.newEvent?.completedEvent && !stepHandlers.newEvent?.event;
        const stepsFinished = !stepHandlers.isWaitingForData && 
                             !finalIsTyping && 
                             (!stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0);
        
        if (hasCompletedEvent && stepsFinished && !eventCompleted && !finalIsTyping) {
            setEventCompleted(true);
        }
    }, [
        stepHandlers.newEvent?.completedEvent,
        stepHandlers.newEvent?.event,
        stepHandlers.isWaitingForData,
        finalIsTyping,
        stepHandlers.stepQueue,
        eventCompleted,
        setEventCompleted,
    ]);

    // 跟踪是否已经设置了刷新定时器，避免重复设置
    const refreshTimerRef = useRef<number | null>(null);
    const hasCleanedCacheRef = useRef<boolean>(false);
    
    useEffect(() => {
        if (refs.current.isRestoringFromCache) return;
        
        const storageKeys = getStorageKeys(sessionId, eventId);
        if (!storageKeys.allSteps || !storageKeys.incomplete) return;

        const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
        const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
        
        const allStepsCompleted = gameStarted 
            && queueEmpty
            && !stepHandlers.isWaitingForData 
            && !finalIsTyping 
            && !stepHandlers.showNextButton;
        
        const shouldCleanCache = isChoiceStep 
            ? (gameStarted && !stepHandlers.isWaitingForData && !stepHandlers.showNextButton)
            : allStepsCompleted && stepHandlers.currentStep;
        
        if (shouldCleanCache && !hasCleanedCacheRef.current) {
            // 清除之前的定时器
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
            
            safeRemoveLocalStorage(storageKeys.allSteps);
            safeRemoveLocalStorage(storageKeys.incomplete);
            hasCleanedCacheRef.current = true;
            
            refreshTimerRef.current = window.setTimeout(async () => {
                if (sessionId && gameData) {
                    await refreshEventData(sessionId, gameData);
                }
                refreshTimerRef.current = null;
            }, 3000);
        } else if (!shouldCleanCache) {
            // 如果条件不满足，重置标记
            hasCleanedCacheRef.current = false;
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        }
        
        // 清理函数
        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [
        gameStarted,
        stepHandlers.currentStep,
        stepHandlers.stepQueue,
        stepHandlers.isWaitingForData,
        stepHandlers.showNextButton,
        finalIsTyping,
        sessionId,
        eventId,
        gameData,
        refreshEventData,
    ]);

    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        const prevStep = refs.current.previousStep;

        if (prevStep && currentStep !== prevStep && !isTyping) {
            setCompletedSteps(prev => {
                const exists = prev.some(s =>
                    s && s.type === prevStep.type && s.content === prevStep.content
                );
                return exists ? prev : [...prev, prevStep];
            });
        }

        refs.current.previousStep = currentStep;
        refs.current.previousIsTyping = isTyping;
    }, [stepHandlers.currentStep, isTyping, setCompletedSteps]);

    const allStepsForTextModal = useMemo(() => {
        let validSteps = completedSteps.filter(s => s && s.type);

        if (stepHandlers.currentStep?.type) {
            const exists = validSteps.some(s =>
                s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (!exists) {
                validSteps = [...validSteps, stepHandlers.currentStep];
            }
        }

        if (validSteps.length === 0 && latestHistory?.interactions?.length) {
            const lastInteraction = latestHistory.interactions[latestHistory.interactions.length - 1] as any;
            if (lastInteraction.type === 'npc_dialogue' && Array.isArray(lastInteraction.narrativeSteps)) {
                validSteps = [...lastInteraction.narrativeSteps];
            }
        }
        const choiceIndices = validSteps
            .map((step, index) => step?.type === 'choice' ? index : -1)
            .filter(idx => idx >= 0);
        
        if (choiceIndices.length > 1) {
            for (let i = choiceIndices.length - 2; i >= 0; i--) {
                validSteps.splice(choiceIndices[i], 1);
            }
        }

        return validSteps;
    }, [completedSteps, stepHandlers.currentStep, latestHistory]);

    const currentStepIndex = useMemo(() => {
        if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const index = allStepsForTextModal.findIndex(s =>
                s && s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (index >= 0) return index;
        }

        if (allStepsForTextModal.length > 0) {
            return allStepsForTextModal.length - 1;
        }

        return -1;
    }, [allStepsForTextModal, stepHandlers.currentStep]);

    const shouldShowContinueButton = useMemo(() => {
        const newEvent = stepHandlers.newEvent;
        if (!newEvent) return false;

        const hasFullNewEvent = !!(newEvent.event && newEvent.npc && newEvent.subscene);
        if (!hasFullNewEvent) {
            return false;
        }

        const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
        const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
        
        const canShow = !stepHandlers.isWaitingForData 
            && !finalIsTyping 
            && !hasPendingRequest
            && ((queueEmpty && !stepHandlers.showNextButton) || (isChoiceStep && !stepHandlers.showNextButton));
        
        return canShow;
    }, [stepHandlers.newEvent, stepHandlers.stepQueue, stepHandlers.isWaitingForData, stepHandlers.showNextButton, stepHandlers.currentStep, finalIsTyping, hasPendingRequest]);

    const handleContinue = useCallback(() => {
        const newEvent = stepHandlers.newEvent;
        const hasFullNewEvent = newEvent?.event && newEvent.npc && newEvent.subscene;

        if (hasFullNewEvent) {
            setEventData({
                event: newEvent!.event,
                npc: newEvent!.npc,
                subscene: newEvent!.subscene,
            });
            
            const newBgImage = getSubsceneImage(newEvent!.subscene);
            if (newBgImage) {
                setDisplayBackgroundImage(newBgImage);
            }
            
            stepHandlers.clearNewEvent?.();
            
            const { setSelectedSubscene, setSelectedScene } = useMapGalgameStore.getState();
            setSelectedSubscene(null);
            setSelectedScene(null);
            
            setCurrentView(MapViewState.WORLD_MAP);
            return;
        }

        if (newEvent?.completedEvent && !newEvent.event) {
            stepHandlers.clearNewEvent?.();
        }
    }, [stepHandlers, setEventData, setCurrentView, getSubsceneImage, setDisplayBackgroundImage]);

    const textModalDisplayText = useMemo(() => {
        if (stepHandlers.currentStep &&
            stepHandlers.currentStep.type !== 'choice' &&
            currentMessage &&
            currentMessage.type !== 'choice' &&
            isTyping &&
            displayedText.length > 0) {
            const originalText = currentMessage.message || '';
            const currentPlainLength = displayedText.length;

            if (currentPlainLength > 0) {
                const textWithTags = truncateTextWithTags(originalText, currentPlainLength);
                return textWithTags;
            }
        }
        return '';
    }, [stepHandlers.currentStep, currentMessage, displayedText, isTyping]);
    
    useEffect(() => {
        if (isTextMode && !isAutoPlay) {
            setIsAutoPlay(true);
        }
    }, [isTextMode, isAutoPlay]);

    useEffect(() => {
        if (!isAutoPlay || !gameStarted) return;
        if (stepHandlers.isWaitingForData) return;
        if (finalIsTyping) return;
        if (!stepHandlers.showNextButton) return;
        if (currentMessage?.type === 'choice') {
            // 文本模式下，选择时也不关闭自动播放
            if (!isTextMode) {
                setIsAutoPlay(false);
            }
            return;
        }

        const autoPlayTimer = setTimeout(() => {
            if (isAutoPlay && !finalIsTyping && stepHandlers.showNextButton && currentMessage?.type !== 'choice' && !stepHandlers.isWaitingForData) {
                handleNextMessage();
            }
        }, 2000);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, finalIsTyping, stepHandlers.showNextButton, stepHandlers.isWaitingForData, currentMessage?.type, gameStarted, handleNextMessage, isTextMode]);

    const handleChoiceClick = useCallback((option: { text: string; optionId?: string }) => {
        if (refs.current.choiceInFlight || hasPendingRequest || stepHandlers.isWaitingForData) {
            return;
        }
        refs.current.choiceInFlight = true;
        setCompletedSteps([]);
        refs.current.previousStep = null;
        refs.current.previousIsTyping = false;

        let optionId: string | undefined = option.optionId;
        let optionIndex = -1;

        if (!optionId) {
        if (stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') {
            optionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
                if (typeof opt === 'string') {
                    return opt === option.text;
                }
                return opt.text === option.text || opt.optionId === option.optionId;
            }) ?? -1;

            if (optionIndex >= 0) {
                const stepOption = stepHandlers.currentStep.options?.[optionIndex];
                if (stepOption && typeof stepOption !== 'string') {
                        optionId = stepOption.optionId ? String(stepOption.optionId) : undefined;
                }
            }
        }

            if (optionIndex < 0 && currentMessage && currentMessage.type === 'choice' && currentMessage.options) {
            optionIndex = currentMessage.options.findIndex((opt: any) => {
                return opt.text === option.text || opt.optionId === option.optionId;
            });
            
            if (optionIndex >= 0) {
                const msgOption = currentMessage.options[optionIndex] as any;
                    optionId = msgOption.optionId ? String(msgOption.optionId) : undefined;
                }
            }
        } else {
            if (stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') {
                optionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
                    if (typeof opt === 'string') {
                        return false;
                    }
                    return opt.optionId === optionId || String(opt.optionId) === optionId;
                }) ?? -1;
        }

            if (optionIndex < 0 && currentMessage && currentMessage.type === 'choice' && currentMessage.options) {
                optionIndex = currentMessage.options.findIndex((opt: any) => {
                    return opt.optionId === optionId || String(opt.optionId) === optionId;
                });
            }
        }

        if (!optionId) {
            console.error('无法找到选项或 optionId:', { option, optionIndex, optionId });
            refs.current.choiceInFlight = false;
            return;
        }
        const finalOptionIndex = optionIndex >= 0 ? optionIndex : -1;

        const storageKeys = getStorageKeys(sessionId, eventId);
        if (storageKeys.pendingRequest) {
            const payload = {
                type: 'select-option' as const,
                optionId,
                timestamp: Date.now(),
            };
            safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify(payload));
            setHasPendingRequest(true);
        }

        if (refs.current.choiceTimeout) {
            clearTimeout(refs.current.choiceTimeout);
        }
        refs.current.choiceTimeout = window.setTimeout(() => {
            setTimeoutModal({
                visible: true,
                message: 'AI 回应本次选择已超过 60 秒仍未返回，是否刷新页面重试？',
            });
        }, 60_000);

        const clearChoiceTimeout = () => {
            if (refs.current.choiceTimeout) {
                clearTimeout(refs.current.choiceTimeout);
                refs.current.choiceTimeout = null;
            }
        };

        const clearPending = () => {
            if (storageKeys.pendingRequest) {
                safeRemoveLocalStorage(storageKeys.pendingRequest);
            }
            setHasPendingRequest(false);
        };

        stepHandlers.handleChoiceOption(optionId, finalOptionIndex, {
            onSuccess: async () => {
                clearChoiceTimeout();
                setTimeoutModal({ visible: false, message: '' });
                refs.current.choiceInFlight = false;
                clearPending();
            },
            onFirstStep: () => {
                clearChoiceTimeout();
                setTimeoutModal({ visible: false, message: '' });
                refs.current.choiceInFlight = false;
                clearPending();
            },
            onError: (error) => {
                console.error('选择选项失败:', error);
                clearChoiceTimeout();
                setTimeoutModal({ visible: false, message: '' });
                refs.current.choiceInFlight = false;
                setErrorModal({
                    visible: true,
                    message: error || '选择选项失败，请检查网络或稍后重试。',
                });
                clearPending();
            }
        }).finally(() => {
            refs.current.choiceInFlight = false;
        });
    }, [stepHandlers, currentMessage, sessionId, eventId, hasPendingRequest, setCompletedSteps, setHasPendingRequest, setTimeoutModal, setErrorModal]);

    const handleCustomInputSubmit = useCallback((customText: string) => {
        if (!customText.trim()) {
            return;
        }

        handleChoiceClick({
            text: customText,
            optionId: customText.trim()
        });
    }, [handleChoiceClick]);

    return (
        <>
            <div className={styles.pageRoot}>
                <div
                    className={`${styles.mainContent} ${characterAnimation === 'injury' ? styles.worldInjury : ''}`}
                    style={{
                        backgroundImage: isTextMode ? 'none' : backgroundImage ? `url(${backgroundImage})` : DEFAULT_SCENE_IMAGE,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: isTextMode ? '#000' : 'transparent'
                    }}
                >
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
                    <div className={`${styles.topHeader} ${isTextMode ? styles.topHeaderTextMode : ''}`}  onClick={onClose}>
                        <CiLocationOn />
                        <span>{currentSubscene?.name}</span>
                    </div>
                    {currentMessage.characterImage && !isTextMode && (
                        <div className={getCharacterContainerClassName()}>
                            <img
                                src={currentMessage.characterImage}
                                alt="角色立绘"
                                className={styles.characterImage}
                            />
                        </div>
                    )}
                    <div className={`${styles.gameContentWrapper} ${isTextMode ? styles.gameContentWrapperTextMode : ''}`}>
                        {!isTextMode && (
                            <>
                                <NormalModeDisplay
                                    currentMessage={currentMessage}
                                    finalDisplayText={finalDisplayText}
                                    finalIsTyping={finalIsTyping}
                                    stepHandlers={{
                                        isWaitingForData: stepHandlers.isWaitingForData || hasPendingRequest,
                                        currentStep: stepHandlers.currentStep,
                                        showNextButton: stepHandlers.showNextButton,
                                        selectedOptionIndex: stepHandlers.selectedOptionIndex,
                                    }}
                                    isAutoPlay={isAutoPlay}
                                    historyLength={latestHistory?.interactions.length ?? 0}
                                    onNextMessage={handleNextMessage}
                                    onChoiceClick={handleChoiceClick}
                                    onCustomInputSubmit={handleCustomInputSubmit}
                                />
                            </>
                        )}
                        {isTextMode && (
                            <TextModeDisplay
                                steps={convertStepsToTextModalFormat(allStepsForTextModal, worldSetting)}
                                currentStepIndex={currentStepIndex}
                                currentDisplayText={textModalDisplayText}
                                isTyping={finalIsTyping}
                                isWaitingForData={stepHandlers.isWaitingForData}
                                historyLength={latestHistory?.interactions.length ?? 0}
                                onChoiceClick={(option) => {
                                    setCompletedSteps([]);
                                    refs.current.previousStep = null;
                                    refs.current.previousIsTyping = false;
                                    handleChoiceClick(option);
                                }}
                                onCustomInputSubmit={handleCustomInputSubmit}
                            />
                        )}
                        <div className={styles.buttonContainer}>
                            <div className={styles.buttonItem}>
                                <div className={styles.buttonInner}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="积分" />
                                    <span>{user?.user?.points}</span>
                                </div>
                            </div>
                            <div
                                className={styles.buttonItem}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setIsHistoryVisible(true)}
                            >
                                <div className={styles.buttonInner}>
                                    <BiHistory />
                                    <span>历史</span>
                                </div>
                            </div>
                            <div
                                className={`${styles.buttonItem} ${isTextMode ? styles.buttonItemActive : ''}`}
                                onClick={() => {
                                    const newTextMode = !isTextMode;
                                    setIsTextMode(newTextMode);
                                    if (newTextMode && !isAutoPlay) {
                                        setIsAutoPlay(true);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <LuFileText />
                                    <span>文本</span>
                                </div>
                            </div>
                            <div
                                className={`${styles.buttonItem} ${isAutoPlay ? styles.buttonItemActive : ''}`}
                                onClick={handleAutoPlayToggle}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <MdOutlineAutoStories />
                                    <span>自动</span>
                                </div>
                            </div>
                            <div
                                className={`${styles.buttonItem} ${isMusicPlaying ? styles.buttonItemActive : ''}`}
                                style={{ cursor: 'pointer' }}
                                onClick={handleMusicToggle}
                            >
                                <div className={styles.buttonInner}>
                                    <PiMusicNoteDuotone />
                                    <span>音乐</span>
                                </div>
                            </div>
                        </div>
                        
                        {shouldShowContinueButton && (
                            <div 
                                className={styles.continueButton} 
                                onClick={handleContinue}
                                style={{ cursor: 'pointer' }}
                            >
                                <MdCheckCircle />
                                <span>继续游戏</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <HistoryModal
                visible={isHistoryVisible}
                onClose={() => setIsHistoryVisible(false)}
                history={latestHistory ?? worldInteractionHistory}
            />
            
            <WorldModal
                visible={errorModal.visible}
                title="请求失败"
                message={errorModal.message}
                confirmText="知道了"
                onConfirm={() => {
                    setErrorModal({ visible: false, message: "" })
                    if (typeof window !== "undefined") {
                        window.location.reload();
                    }
                }}
            />

            {/* 请求超时弹窗 */}
            <WorldModal
                visible={timeoutModal.visible}
                title="请求超时"
                message={timeoutModal.message}
                confirmText="刷新页面"
                cancelText="先不用"
                primaryType="confirm"
                onConfirm={() => {
                    setTimeoutModal({ visible: false, message: "" });
                    if (typeof window !== "undefined") {
                        window.location.reload();
                    }
                }}
                onCancel={() => setTimeoutModal({ visible: false, message: "" })}
            />
        </>
    );
};

export default InteractWithNpc;