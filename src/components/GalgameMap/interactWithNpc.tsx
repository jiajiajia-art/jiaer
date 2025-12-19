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
import NormalModeDisplay from "./NormalModeDisplay";
import TextModeDisplay from "./TextModeDisplay";
import HistoryModal from "./historyModal";
import NextRoundButton from "./NextRoundButton";
import WorldModal from "./ErrorModal";
import type { AllGameData } from "../../api/worldInteraction/mapWorldData.type";
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";
import interactionApi from "../../api/worldInteraction/interactionApi";
import {
    type Message,
    getImageUrl,
    getPlayerImage,
    convertStepToMessage,
    convertStepsToTextModalFormat,

} from "../../hooks/mapGalgame/interactionUtils";

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;

const InteractWithNpc = ({ 
    onClose, 
    gameData,
    onEndRound,
    isEndingRound,
    worldInteractionHistory,
}: { 
    onClose: () => void;
    gameData: AllGameData | null;
    onEndRound: () => void;
    isEndingRound: boolean;
    worldInteractionHistory: GetWorldInteractionHistoryResponse | null;
}) => {
    // ==================== Store & Context ====================
    const { user } = useAuthStore();
    const sessionId = useGameStore((state) => state.sessionId);
    const { pdfFileId } = useGameStore();
    const { eventData, setEventData, setCurrentView, refreshEventData, selectedSubscene } = useMapGalgameStore();

    // ==================== 派生数据 ====================
    const eventId = eventData?.event?.eventId || null;
    const worldSetting = gameData?.worldSetting || null;
    const sceneSetting = gameData?.sceneSetting || null;
    const currentSubscene = eventData?.subscene || null;
    
    // ==================== 音乐播放控制 ====================
    const { isMusicPlaying, handleMusicToggle } = useMapMusicPlayer({
        fileId: pdfFileId || null,
        gameData,
        currentView: MapViewState.INTERACT_NPC,
        selectedSubscene,
        eventData,
    });
    
    // ==================== UI 状态 ====================
    const [displayBackgroundImage, setDisplayBackgroundImage] = useState<string>('');
    const backgroundInitializedRef = useRef(false);
    
    // 初始化背景图片：只在组件首次加载时设置一次，之后不再改变
    useEffect(() => {
        // 如果已经初始化过，不再更新
        if (backgroundInitializedRef.current) return;
        
        // 如果还没有背景图片，尝试从 eventData 获取
        if (!displayBackgroundImage && eventData?.subscene) {
            let bgImage = '';
            
            // 优先使用 eventData.subscene.image
            if (eventData.subscene.image) {
                bgImage = getImageUrl(eventData.subscene.image) || '';
            }
            
            // 如果还没有，从 sceneSetting 中查找
            if (!bgImage && eventData.subscene.id && sceneSetting?.scenes) {
                for (const scene of sceneSetting.scenes) {
                    const subscene = scene.subscenes?.find((sub: any) => sub.id === eventData.subscene.id);
                    if (subscene?.image) {
                        bgImage = getImageUrl(subscene.image) || '';
                        break;
                    }
                }
            }
            
            // 设置背景图片并标记已初始化
            if (bgImage) {
                setDisplayBackgroundImage(bgImage);
                backgroundInitializedRef.current = true;
            }
        }
    }, [eventData?.subscene?.image, eventData?.subscene?.id, sceneSetting, displayBackgroundImage]);
    
    // 获取背景图片：使用保存的显示背景图片，避免新事件时立即切换
    const backgroundImage = displayBackgroundImage;
    
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
    const [isTextMode, setIsTextMode] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<any[]>([]); // 已完成的步骤
    const currentRequestIdRef = useRef<number>(0); // 当前请求ID，用于清空已完成步骤
    const hasInitializedRef = useRef(false);
    const isRestoringFromCacheRef = useRef(false); // 标记是否正在从缓存恢复
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [latestHistory, setLatestHistory] = useState<GetWorldInteractionHistoryResponse | null>(worldInteractionHistory);
    
    // ==================== 请求状态管理 ====================
    // 标记是否有未完成的请求（用于优化初始化时的显示）
    const [hasPendingRequest, setHasPendingRequest] = useState(false);

    // 轮询相关状态：当这个值不为 null 时，启动独立的轮询
    const [pendingRequestForPoll, setPendingRequestForPoll] = useState<PendingRequest | null>(null);

    // ==================== 弹窗状态 ====================
    // 请求错误弹窗
    const [errorModal, setErrorModal] = useState<{ visible: boolean; message: string }>({
        visible: false,
        message: '',
    });

    // 请求超时弹窗
    const [timeoutModal, setTimeoutModal] = useState<{ visible: boolean; message: string }>({
        visible: false,
        message: '',
    });

    // 记录当前进行中的请求超时计时器
    const interactTimeoutRef = useRef<number | null>(null);
    const choiceTimeoutRef = useRef<number | null>(null);

    // 当 currentStep 变化且打字机已完成时，将之前的 step 加入已完成列表
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);

    const stepHandlers = useWorldInteractionStep({
        sessionId,
        eventId,
        fileId: pdfFileId,
        historyLength: latestHistory?.interactions.length ?? 0,
        onMessagesClear: () => {
            // 清空已完成步骤和引用，避免残留数据
            setCompletedSteps([]);
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
    });

    // 外部传入的历史变化时，同步到本地 latestHistory
    useEffect(() => {
        if (worldInteractionHistory) {
            setLatestHistory(worldInteractionHistory);
        }
    }, [worldInteractionHistory]);

    // 组件卸载时清理超时定时器
    useEffect(() => {
        return () => {
            if (interactTimeoutRef.current) {
                clearTimeout(interactTimeoutRef.current);
                interactTimeoutRef.current = null;
            }
            if (choiceTimeoutRef.current) {
                clearTimeout(choiceTimeoutRef.current);
                choiceTimeoutRef.current = null;
            }
        };
    }, []);

    // 打开历史弹窗时，刷新一次历史记录
    useEffect(() => {
        if (!isHistoryVisible || !sessionId) return;

        let cancelled = false;

        const fetchHistory = async () => {
            try {
                const response = await interactionApi.getWorldInteractionHistory(sessionId);
                if (!cancelled && response.data?.success) {
                    setLatestHistory(response.data);
                    console.log('[WorldInteraction] 历史记录已刷新（弹窗）', response.data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[WorldInteraction] 获取历史记录失败（弹窗）:', error);
                }
            }
        };

        void fetchHistory();

        return () => {
            cancelled = true;
        };
    }, [isHistoryVisible, sessionId]);

    // 如果历史最后一条是 npc_dialogue，则构造一个基于历史 options 的临时 choice 消息
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

        console.log('[WorldInteraction] 历史最后一条 npc_dialogue 选项：', options);
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

        // 2）如果当前事件进行到一半（历史最后一条是 npc_dialogue），直接展示其 options
        if (historyChoiceMessage && !hasPendingRequest) {
            return historyChoiceMessage;
        }

        // 3）如果有未完成的请求，返回空消息（让 NormalModeDisplay 显示"AI推演中"）
        if (hasPendingRequest || stepHandlers.isWaitingForData) {
            return { id: 0, type: 'narration', message: '' };
        }

        // 4）默认空旁白
        return { id: 0, type: 'narration', message: '' };
    }, [gameStarted, stepHandlers.currentStep, stepHandlers.isWaitingForData, worldSetting, historyChoiceMessage, hasPendingRequest]);

    // 使用封装的 hooks
    const characterAnimation = useCharacterAnimation({
        message: currentMessage?.message,
        messageType: currentMessage?.type,
    });

    const getCharacterContainerClassName = useCharacterContainerClassName({
        characterPosition: currentMessage?.characterPosition,
        characterAnimation,
        styles,
    });

    // 当新请求开始时，清空已完成的步骤
    useEffect(() => {
        const currentRequestId = stepHandlers.currentRequestId?.current || 0;
        if (currentRequestId !== currentRequestIdRef.current) {
            currentRequestIdRef.current = currentRequestId;
            setCompletedSteps([]);
            // 同时清空引用，避免残留数据
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
    }, [stepHandlers.currentRequestId?.current]);

    // ==================== 初始化游戏 ====================
    // 当组件挂载时，优先尝试使用本地缓存的步骤，否则从后端获取历史或发起交互
    useEffect(() => {
        if (hasInitializedRef.current) return;
        if (!sessionId) return;

        // 本 effect 内部的取消标记，用于终止轮询
        let cancelled = false;

        const allStepsStorageKey = sessionId && eventId
            ? `world-allsteps-${sessionId}-${eventId}`
            : null;
        const incompleteKey = sessionId && eventId
            ? `world-allsteps-incomplete-${sessionId}-${eventId}`
            : null;

        const initFromServerHistory = async () => {
            // 立即设置 gameStarted，避免空白等待
            if (!gameStarted) {
                setGameStarted(true);
            }
            
            try {
                console.log("[WorldInteraction] initFromServerHistory(): 开始初始化交互页面", {
                    sessionId,
                    eventId,
                    allStepsStorageKey,
                    incompleteKey,
                });
                // 1）优先尝试从本地缓存恢复，但只有在"未看完"标记存在时才使用
                if (allStepsStorageKey && incompleteKey && typeof window !== 'undefined') {
                    try {
                        const isIncomplete = window.localStorage.getItem(incompleteKey) === 'true';
                        const raw = window.localStorage.getItem(allStepsStorageKey);
                        if (isIncomplete && raw) {
                            const savedSteps = JSON.parse(raw);
                            if (Array.isArray(savedSteps) && savedSteps.length > 0) {
                                const [first, ...rest] = savedSteps;
                                
                                hasInitializedRef.current = true;
                                isRestoringFromCacheRef.current = true; // 标记正在从缓存恢复
                                // 重置已完成步骤和引用
                                setCompletedSteps([]);
                                previousStepRef.current = null;
                                previousIsTypingRef.current = false;

                                // 直接用缓存的步骤恢复 currentStep 和队列
                                stepHandlers.setCurrentStep(first || null);
                                stepHandlers.setStepQueue(rest || []);
                                stepHandlers.setShowNextButton(first?.type !== 'choice');

                                console.log('[WorldInteraction] 使用本地缓存步骤恢复交互，步骤数:', savedSteps.length);
                                
                                // 延迟清除恢复标记，确保步骤开始播放后再允许清理缓存
                                setTimeout(() => {
                                    isRestoringFromCacheRef.current = false;
                                }, 1000);
                                
                                return;
                            }
                        }
                    } catch (e) {
                        console.warn('[WorldInteraction] 读取本地步骤缓存失败:', e);
                    }
                }

                // 2）检查是否有未完成的请求（通过 pending-request 标记）
                // 如果有未完成的请求，立即显示"AI推演中"状态
                let foundPendingRequest = false;
                let pendingRequest: {
                    type?: "interact" | "select-option";
                    optionId?: string;
                    timestamp?: number;
                } | null = null;

                if (typeof window !== "undefined" && sessionId && eventId) {
                    const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                    const pendingRequestRaw = window.localStorage.getItem(pendingRequestKey);
                    if (pendingRequestRaw) {
                        try {
                            const parsed = JSON.parse(pendingRequestRaw);
                            pendingRequest = parsed || {};
                            const requestAge = Date.now() - ((parsed && parsed.timestamp) || 0);
                            // 如果请求在 5 分钟内，认为可能还在进行中
                            if (requestAge < 2 * 60 * 1000) {
                                console.log(
                                    "[WorldInteraction] 检测到可能有未完成的请求，显示加载状态",
                                    pendingRequest
                                );
                                foundPendingRequest = true;
                                setHasPendingRequest(true);
                                // 清空当前步骤，确保显示"AI推演中"
                                stepHandlers.setCurrentStep(null);
                                stepHandlers.setStepQueue([]);
                                stepHandlers.setShowNextButton(false);
                            } else {
                                // 请求已过期，清除标记
                                window.localStorage.removeItem(pendingRequestKey);
                            }
                        } catch (e) {
                            console.warn("[WorldInteraction] 解析未完成请求失败:", e);
                        }
                    }
                }

                // 3）如果检测到未完成的请求，设置轮询状态，交给独立的轮询 effect 处理
                if (foundPendingRequest && pendingRequest?.type) {
                    console.log(
                        "[WorldInteraction] 检测到未完成请求，启动独立轮询 effect...",
                        pendingRequest
                    );
                    hasInitializedRef.current = true;
                    // 设置轮询状态，独立的 useEffect 会自动启动轮询
                    setPendingRequestForPoll({
                        type: pendingRequest.type,
                        optionId: pendingRequest.optionId,
                        startTime: Date.now(),
                    });
                    return;
                }

                // 4）如果没有未完成的请求，正常获取一次历史后再决定是否直接用历史
                const resp = await interactionApi.getWorldInteractionHistory(sessionId);
                if (cancelled) return;

                if (resp.data?.success) {
                    const history = resp.data;
                    setLatestHistory(history);
                    console.log(
                        "[WorldInteraction] 初始化获取历史成功，交互条数:",
                        history.interactions?.length
                    );

                    const lastInteraction = history.interactions?.[history.interactions.length - 1] as any;

                    // 如果历史最后一条是 npc_dialogue（事件进行到带选项但未完成），
                    // 则不再重新调用交互接口，直接用历史中的 options 渲染选项
                    if (lastInteraction && lastInteraction.type === 'npc_dialogue') {
                        hasInitializedRef.current = true;
                        console.log('[WorldInteraction] 初始化：检测到未完成的 npc_dialogue，直接使用历史选项');
                        return;
                    }
                }

                // 5）否则按正常流程发起交互
                if (gameData && sessionId && eventId && pdfFileId) {
                    console.log("[WorldInteraction] 初始化：准备发起初始交互 /interact", {
                        sessionId,
                        eventId,
                        fileId: pdfFileId,
                    });
                    hasInitializedRef.current = true;
                    
                    // 保存请求状态，以便用户中途退出时可以检测
                    if (typeof window !== 'undefined') {
                        try {
                            const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                            const payload = {
                                type: "interact" as const,
                                timestamp: Date.now(),
                            };
                            console.log(
                                "[WorldInteraction] 写入 pending-request 标记 (interact):",
                                pendingRequestKey,
                                payload
                            );
                            window.localStorage.setItem(pendingRequestKey, JSON.stringify(payload));
                        } catch (e) {
                            console.warn('[WorldInteraction] 保存请求状态失败:', e);
                        }
                    }

                    // 启动 60 秒超时计时器（开始游戏）
                    if (interactTimeoutRef.current) {
                        clearTimeout(interactTimeoutRef.current);
                    }
                    interactTimeoutRef.current = window.setTimeout(() => {
                        console.warn(
                            "[WorldInteraction] /interact 超过 60 秒未返回，弹出超时提示"
                        );
                        setTimeoutModal({
                            visible: true,
                            message: '开始游戏请求已超过 60 秒仍未返回，是否刷新页面重试？',
                        });
                    }, 60_000);
                    
                    setTimeout(() => {
                        console.log("[WorldInteraction] 发送 /interact 请求 (handleInteract)...");
                        stepHandlers.handleInteract({
                            onSuccess: () => {
                                console.log(
                                    "[WorldInteraction] /interact 请求成功，清理 pending 状态"
                                );
                                // 请求成功，清除请求状态和超时提示
                                if (interactTimeoutRef.current) {
                                    clearTimeout(interactTimeoutRef.current);
                                    interactTimeoutRef.current = null;
                                }
                                setTimeoutModal({ visible: false, message: '' });

                                if (typeof window !== 'undefined' && sessionId && eventId) {
                                    try {
                                        const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                                        window.localStorage.removeItem(pendingRequestKey);
                                        setHasPendingRequest(false);
                                    } catch (e) {
                                        console.warn('[WorldInteraction] 清除请求状态失败:', e);
                                    }
                                }
                            },
                            onError: (error) => {
                                console.error(
                                    "[WorldInteraction] /interact 请求失败:",
                                    error
                                );
                                // 请求失败，清除请求状态和超时提示，并弹窗提示错误原因
                                if (interactTimeoutRef.current) {
                                    clearTimeout(interactTimeoutRef.current);
                                    interactTimeoutRef.current = null;
                                }
                                setTimeoutModal({ visible: false, message: '' });

                                setErrorModal({
                                    visible: true,
                                    message: error || '开始游戏失败，请检查网络或稍后重试。',
                                });

                                if (typeof window !== 'undefined' && sessionId && eventId) {
                                    try {
                                        const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                                        window.localStorage.removeItem(pendingRequestKey);
                                        setHasPendingRequest(false);
                                    } catch (e) {
                                        console.warn('[WorldInteraction] 清除请求状态失败:', e);
                                    }
                                }
                            }
                        });
                    }, 100);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("[WorldInteraction] 初始化时检查历史失败:", error);
                }
            }
        };

        void initFromServerHistory();

        return () => {
            // 标记本次 effect 的轮询已取消
            cancelled = true;
        };
    // 注意：
    // 1）这里故意不把 stepHandlers 放到依赖里，否则每次渲染都会销毁旧的轮询（将 cancelled 设为 true），导致只请求一次历史。
    // 2）也不把 gameStarted 放进去，因为我们在 effect 里调用 setGameStarted(true)，否则会触发二次执行并打断轮询。
    }, [gameData, sessionId, eventId, pdfFileId]);

    // ==================== 轮询 Hook（独立逻辑，不受其他状态影响） ====================
    // 轮询成功时的回调
    const handlePollMatchFound = useCallback((matchedSteps: any[]) => {
        if (!matchedSteps.length) return;
        const [first, ...rest] = matchedSteps;

        // 重置状态
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;

        // 设置步骤
        stepHandlers.setCurrentStep(first || null);
        stepHandlers.setStepQueue(rest || []);
        stepHandlers.setShowNextButton(first?.type !== "choice");

        // 清理 pending 状态
        setHasPendingRequest(false);
        if (typeof window !== "undefined" && sessionId && eventId) {
            try {
                window.localStorage.removeItem(`world-pending-request-${sessionId}-${eventId}`);
            } catch (e) {
                console.warn("[Poll] 清除请求状态失败:", e);
            }
        }
    }, [sessionId, eventId, stepHandlers]);

    const handlePollTimeout = useCallback(() => {
        setHasPendingRequest(false);
        setTimeoutModal({
            visible: true,
            message: "AI 推演结果长时间未返回，是否刷新页面重试？",
        });
    }, []);

    const handlePollEnd = useCallback(() => {
        setPendingRequestForPoll(null);
    }, []);

    // 使用独立的轮询 Hook
    useHistoryPolling({
        sessionId,
        eventId,
        pendingRequest: pendingRequestForPoll,
        onHistoryUpdate: setLatestHistory,
        onMatchFound: handlePollMatchFound,
        onTimeout: handlePollTimeout,
        onPollEnd: handlePollEnd,
    });

    // ==================== 步骤控制 ====================
    const handleNextMessage = useCallback(() => {
        if (gameStarted && stepHandlers.showNextButton) {
            if (stepHandlers.stepQueue && stepHandlers.stepQueue.length === 0) {
                return;
            }
            stepHandlers.handleNextStep();
        }
    }, [gameStarted, stepHandlers]);

    const handleAutoPlayToggle = useCallback(() => {
        setIsAutoPlay(prev => !prev);
    }, []);

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

    // ==================== 缓存清理 & 事件刷新 ====================
    // 当步骤播放完毕时，清除本地缓存标记，并刷新事件状态
    // 触发条件：1. 到达 choice（第一个交互的结尾） 2. 所有步骤播放完成
    useEffect(() => {
        const storageKey = sessionId && eventId ? `world-allsteps-${sessionId}-${eventId}` : null;
        const incompleteKey = sessionId && eventId ? `world-allsteps-incomplete-${sessionId}-${eventId}` : null;
        if (!storageKey || !incompleteKey || typeof window === 'undefined') return;
        if (isRestoringFromCacheRef.current) return; // 正在从缓存恢复时不清理

        const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
        const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
        
        // 条件：队列为空 + 不在等待 + 不在打字 + 没有下一步按钮
        const allStepsCompleted = gameStarted 
            && queueEmpty
            && !stepHandlers.isWaitingForData 
            && !finalIsTyping 
            && !stepHandlers.showNextButton;
        
        const shouldCleanCache = isChoiceStep 
            ? (gameStarted && !stepHandlers.isWaitingForData && !stepHandlers.showNextButton) // choice 不需要检查队列和打字状态
            : allStepsCompleted && stepHandlers.currentStep;
        
        if (shouldCleanCache) {
            try {
                window.localStorage.removeItem(storageKey);
                window.localStorage.removeItem(incompleteKey);
                console.log('[WorldInteraction] 步骤播放完毕，已清除缓存和不完整标记');
                
                // 延迟刷新事件状态，确保打字机动画完成
                setTimeout(() => {
                    if (sessionId && gameData) {
                        refreshEventData(sessionId, gameData);
                    }
                }, 500);
            } catch (e) {
                console.warn('[WorldInteraction] 清理本地步骤缓存失败:', e);
            }
        }
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
        refreshEventData
    ]);

    // 步骤管理：当步骤变化且打字完成时，添加到已完成列表
    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        const prevStep = previousStepRef.current;

        if (prevStep && currentStep !== prevStep && !isTyping) {
            setCompletedSteps(prev => {
                const exists = prev.some(s =>
                    s && s.type === prevStep.type && s.content === prevStep.content
                );
                return exists ? prev : [...prev, prevStep];
            });
        }

        previousStepRef.current = currentStep;
        previousIsTypingRef.current = isTyping;
    }, [stepHandlers.currentStep, isTyping]);

    const allStepsForTextModal = useMemo(() => {
        let validSteps = completedSteps.filter(s => s && s.type);

        // 添加当前步骤（如果不存在）
        if (stepHandlers.currentStep?.type) {
            const exists = validSteps.some(s =>
                s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (!exists) {
                validSteps = [...validSteps, stepHandlers.currentStep];
            }
        }

        // 如果当前没有任何步骤，但存在历史最后一条 npc_dialogue，
        // 文本模式下补上该 npc_dialogue 的完整 narrativeSteps（包括所有旁白+对话+最后的 choice）
        if (validSteps.length === 0 && latestHistory?.interactions?.length) {
            const lastInteraction = latestHistory.interactions[latestHistory.interactions.length - 1] as any;
            if (lastInteraction.type === 'npc_dialogue' && Array.isArray(lastInteraction.narrativeSteps)) {
                validSteps = [...lastInteraction.narrativeSteps];
            }
        }

        // choice 类型只保留最后一个（包括历史补充的）
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

    // 当前步骤的索引
    const currentStepIndex = useMemo(() => {
        // 如果有 currentStep，查找它的索引
        if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const index = allStepsForTextModal.findIndex(s =>
                s && s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (index >= 0) return index;
        }

        // 否则返回最后一个步骤的索引
        if (allStepsForTextModal.length > 0) {
            return allStepsForTextModal.length - 1;
        }

        return -1;
    }, [allStepsForTextModal, stepHandlers.currentStep]);

    // ==================== 按钮显示逻辑 ====================
    // "继续游戏"按钮：当有新事件 (newEvent) 或仅有 completedEvent 时显示
    const shouldShowContinueButton = useMemo(() => {
        const newEvent = stepHandlers.newEvent;
        if (!newEvent) return false;

        const hasFullNewEvent = !!(newEvent.event && newEvent.npc && newEvent.subscene);
        const hasCompletedOnly = !!newEvent.completedEvent;
        if (!hasFullNewEvent && !hasCompletedOnly) {
            return false;
        }

        const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
        const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
        
        // 不在等待数据、不在打字，且满足以下条件之一：
        // 1. 队列为空且没有下一步按钮（所有步骤播放完毕）
        // 2. 当前是 choice 步骤且没有下一步按钮（选择已完成）
        const canShow = !stepHandlers.isWaitingForData 
            && !finalIsTyping 
            && !hasPendingRequest
            && ((queueEmpty && !stepHandlers.showNextButton) || (isChoiceStep && !stepHandlers.showNextButton));
        
        return canShow;
    }, [stepHandlers.newEvent, stepHandlers.stepQueue, stepHandlers.isWaitingForData, stepHandlers.showNextButton, stepHandlers.currentStep, finalIsTyping, hasPendingRequest]);

    // ==================== 事件处理函数 ====================
    // 处理"继续游戏"按钮点击
    const handleContinue = useCallback(() => {
        const newEvent = stepHandlers.newEvent;
        const hasFullNewEvent = newEvent?.event && newEvent.npc && newEvent.subscene;

        // 有完整新事件：切换到新事件并更新背景
        if (hasFullNewEvent) {
            // 更新事件数据
            setEventData({
                event: newEvent!.event,
                npc: newEvent!.npc,
                subscene: newEvent!.subscene,
            });
            
            // 更新背景图片为新事件的背景（用户主动点击"继续游戏"时才切换）
            const newSubscene = newEvent!.subscene;
            let newBgImage = '';
            
            if (newSubscene?.image) {
                newBgImage = getImageUrl(newSubscene.image) || '';
            }
            
            if (!newBgImage && newSubscene?.id && sceneSetting?.scenes) {
                for (const scene of sceneSetting.scenes) {
                    const subscene = scene.subscenes?.find((sub: any) => sub.id === newSubscene.id);
                    if (subscene?.image) {
                        newBgImage = getImageUrl(subscene.image) || '';
                        break;
                    }
                }
            }
            
            // 只有在找到新背景图片时才更新
            if (newBgImage) {
                setDisplayBackgroundImage(newBgImage);
            }
            
            stepHandlers.clearNewEvent?.();
            
            // 清理场景状态，重置到最外层
            const { setSelectedSubscene } = useMapGalgameStore.getState();
            setSelectedSubscene(null);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('worldMapViewStack', JSON.stringify([{ mode: 'mainScenes', scene: null }]));
            }
            
            setCurrentView(MapViewState.WORLD_MAP);
            return;
        }

        // 仅有 completedEvent（没有新事件）：回到地图并刷新事件数据，让“开始下一回合”出现
        if (newEvent?.completedEvent) {
            const { setSelectedSubscene } = useMapGalgameStore.getState();
            setSelectedSubscene(null);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('worldMapViewStack', JSON.stringify([{ mode: 'mainScenes', scene: null }]));
            }
            if (sessionId && gameData) {
                refreshEventData(sessionId, gameData);
            }
            stepHandlers.clearNewEvent?.();
            setCurrentView(MapViewState.WORLD_MAP);
        }
    }, [stepHandlers, setEventData, setCurrentView, sceneSetting, sessionId, gameData, refreshEventData]);


    // 获取当前步骤的打字机文本（保留颜色标签，实现丝滑打字效果）
    const textModalDisplayText = useMemo(() => {
        // 只有在当前步骤存在且不是 choice 类型，且正在打字时才返回打字文本
        if (stepHandlers.currentStep &&
            stepHandlers.currentStep.type !== 'choice' &&
            currentMessage &&
            currentMessage.type !== 'choice' &&
            isTyping &&
            displayedText.length > 0) {
            const originalText = currentMessage.message || '';
            const currentPlainLength = displayedText.length;

            // 打字中返回截取的文本
            if (currentPlainLength > 0) {
                const textWithTags = truncateTextWithTags(originalText, currentPlainLength);
                return textWithTags;
            }
        }
        // 打字完成或没有当前步骤时返回空字符串，让组件显示完整内容
        return '';
    }, [stepHandlers.currentStep, currentMessage, displayedText, isTyping]);

    // 文本模式默认开启自动播放
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
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;

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

        // 如果还没找到，从 currentMessage 中查找
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
            console.error('❌ 无法找到选项或 optionId:', { option, optionIndex, optionId });
            return;
        }
        const finalOptionIndex = optionIndex >= 0 ? optionIndex : -1;

        // 保存请求状态（包括 type 和 optionId，方便轮询历史时精确匹配）
        if (typeof window !== 'undefined' && sessionId && eventId) {
            try {
                const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                const payload = {
                    type: 'select-option' as const,
                    optionId,
                    timestamp: Date.now(),
                };
                console.log(
                    '[WorldInteraction] 写入 pending-request 标记 (select-option):',
                    pendingRequestKey,
                    payload
                );
                window.localStorage.setItem(pendingRequestKey, JSON.stringify(payload));
                setHasPendingRequest(true);
            } catch (e) {
                console.warn('[WorldInteraction] 保存请求状态失败:', e);
            }
        }

        // 启动 60 秒超时计时器（选择选项）
        if (choiceTimeoutRef.current) {
            clearTimeout(choiceTimeoutRef.current);
        }
        choiceTimeoutRef.current = window.setTimeout(() => {
            console.warn(
                '[WorldInteraction] /select-option 超过 60 秒未返回，弹出超时提示'
            );
            setTimeoutModal({
                visible: true,
                message: 'AI 回应本次选择已超过 60 秒仍未返回，是否刷新页面重试？',
            });
        }, 60_000);

        console.log('[WorldInteraction] 发送 /select-option 请求 (handleChoiceOption)...', {
            optionId,
            finalOptionIndex,
        });

        stepHandlers.handleChoiceOption(optionId, finalOptionIndex, {
            onSuccess: () => {
                // 请求成功，清除请求状态和超时提示
                if (choiceTimeoutRef.current) {
                    clearTimeout(choiceTimeoutRef.current);
                    choiceTimeoutRef.current = null;
                }
                setTimeoutModal({ visible: false, message: '' });

                if (typeof window !== 'undefined' && sessionId && eventId) {
                    try {
                        const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                        window.localStorage.removeItem(pendingRequestKey);
                        setHasPendingRequest(false);
                    } catch (e) {
                        console.warn('[WorldInteraction] 清除请求状态失败:', e);
                    }
                }
            },
            onError: (error) => {
                console.error('❌ 选择选项失败:', error);

                // 请求失败，清除请求状态和超时提示，并弹窗提示错误原因
                if (choiceTimeoutRef.current) {
                    clearTimeout(choiceTimeoutRef.current);
                    choiceTimeoutRef.current = null;
                }
                setTimeoutModal({ visible: false, message: '' });

                setErrorModal({
                    visible: true,
                    message: error || '选择选项失败，请检查网络或稍后重试。',
                });

                if (typeof window !== 'undefined' && sessionId && eventId) {
                    try {
                        const pendingRequestKey = `world-pending-request-${sessionId}-${eventId}`;
                        window.localStorage.removeItem(pendingRequestKey);
                        setHasPendingRequest(false);
                    } catch (e) {
                        console.warn('[WorldInteraction] 清除请求状态失败:', e);
                    }
                }
            }
        });
    }, [stepHandlers, currentMessage, sessionId, eventId]);

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
                                    previousStepRef.current = null;
                                    previousIsTypingRef.current = false;
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
                                    // 文本模式默认开启自动播放
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
                        
                        {/* 继续游戏按钮 - 有 newEvent 时显示 */}
                        {shouldShowContinueButton && !isEndingRound && (
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
            
            {/* 当没有活跃事件且没有继续游戏按钮时，显示"开始下一回合"按钮 */}
            {!eventData && 
             !shouldShowContinueButton &&
             worldInteractionHistory && 
             worldInteractionHistory.interactions.length > 0 && (
                <NextRoundButton
                    onClick={onEndRound}
                    disabled={isEndingRound}
                    isLoading={isEndingRound}
                />
            )}

            {/* 请求错误弹窗 */}
            <WorldModal
                visible={errorModal.visible}
                title="请求失败"
                message={errorModal.message}
                confirmText="知道了"
                onConfirm={() => setErrorModal({ visible: false, message: "" })}
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