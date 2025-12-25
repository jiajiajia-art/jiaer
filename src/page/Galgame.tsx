import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CiLocationOn } from "react-icons/ci";
import { IoClose } from "react-icons/io5";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/gameStore";
import { PiMusicNoteDuotone } from "react-icons/pi";
import { BiHistory } from "react-icons/bi";
import { LuFileText } from "react-icons/lu";
import { MdOutlineAutoStories } from "react-icons/md";
import getGalgamePresetApi from "../api/galgame/getGalgamePreset";
import type { GetGalgamePresetResponse } from "../api/galgame/getGalgamePreset.type";
import { HOST_ADDRESS } from "../config";
import StoryIntroModal from "../components/Galgame/StoryIntroModal";
import NormalModeDisplay from "../components/Galgame/NormalModeDisplay";
import { useGalgameStep } from "../hooks/galgame/useGalgameStep";
import { useStoryTyping } from "../hooks/story/useStoryTyping";
import { extractChoiceFromHistory, extractPlainText, truncateTextWithTags, parseHistoryToSteps } from "../utils/textUtils";
import { useCharacterAnimation } from "../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../hooks/galgame/useCharacterContainerClassName";
import { useMusicPlayer } from "../hooks/mapGalgame/useMusicPlayer";
import toast from "react-hot-toast";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
import TextModeDisplay from "../components/Galgame/TextModeDisplay";
import useGalgameHistory from "../hooks/galgame/useGalgameHistory";
import statisticsApi from "../api/statistics/statisticsApi";
import ErrorModal from "../components/GalgameMap/WorldModal";
import { IoMdCloseCircle } from "react-icons/io";

type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string }>;
}

const Galgame = () => {
    const { user } = useAuthStore();
    const { fileId, sessionId, isPreset } = useGameStore();
    const navigate = useNavigate();

    // 存储完整 allSteps 的 key（按 sessionId 隔离）
    const allStepsStorageKey = useMemo(() => {
        return sessionId ? `galgame-allsteps-${sessionId}` : 'galgame-allsteps';
    }, [sessionId]);

    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [gameTitle, setGameTitle] = useState<string>('Galgame');
    const [currentScene, setCurrentScene] = useState<GetGalgamePresetResponse['sceneSetting']['scenes'][0] | null>(null);
    const [worldSetting, setWorldSetting] = useState<GetGalgamePresetResponse['worldSetting'] | null>(null);
    const [npcSetting, setNpcSetting] = useState<GetGalgamePresetResponse['npcSetting'] | null>(null);
    const [sceneSetting, setSceneSetting] = useState<GetGalgamePresetResponse['sceneSetting'] | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [initialMessages, setInitialMessages] = useState<Message[]>([]);
    const [showStoryIntro, setShowStoryIntro] = useState<boolean>(false);
    const [isStartingGame, setIsStartingGame] = useState<boolean>(false);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
    const [presetData, setPresetData] = useState<GetGalgamePresetResponse | null>(null);
    const [showGalgameHistory, setShowGalgameHistory] = useState<boolean>(false);
    const [isTextMode, setIsTextMode] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<any[]>([]);
    const currentRequestIdRef = useRef<number>(0); // 当前请求ID，用于清空已完成步骤
    const historyProcessedRef = useRef<boolean>(false); // 避免历史重复解析导致状态抖动

    const { history, refreshHistory, loading: historyLoading, editHistory, lastVisitedSceneId } = useGalgameHistory();

    // 请求超时 & 提示相关状态（不自动重试，只给用户一个刷新入口）
    const [requestTimeoutVisible, setRequestTimeoutVisible] = useState<boolean>(false);
    const requestTimeoutRef = useRef<number | null>(null);

    // 当 currentStep 变化且打字机已完成时，将之前的 step 加入已完成列表
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);

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

    const stepHandlers = useGalgameStep({
        sessionId,
        historyLength: history.length, // 传递历史长度用于判断是否免费
        onMessagesClear: () => {
            setInitialMessages([]);
            // 清空已完成步骤和引用，避免残留数据
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
        // 每次一轮流式对话结束后，主动刷新一次历史记录
        onStreamComplete: async () => {
            await refreshHistory();
        },
    });

    // 统一监听是否在等待后端数据，如果超过 60s 仍未返回则弹出超时提示
    useEffect(() => {
        if (stepHandlers.isWaitingForData) {
            if (requestTimeoutRef.current) {
                window.clearTimeout(requestTimeoutRef.current);
            }
            requestTimeoutRef.current = window.setTimeout(() => {
                // 再次确认仍在等待数据，避免误报
                if (stepHandlers.isWaitingForData) {
                    setRequestTimeoutVisible(true);
                }
            }, 60000); // 60 秒超时
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
            // 同时清空引用，避免残留数据
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
    }, [stepHandlers.currentRequestId?.current]);

    const convertStepToMessage = useCallback((step: any): Message | null => {
        if (!step) return null;

        if (step.type === 'narration') {
            return {
                id: Date.now(),
                type: 'narration',
                message: step.content || '',
            };
        } else if (step.type === 'transition') {
            return {
                id: Date.now(),
                type: 'transition',
                message: step.content || '',
            };
        } else if (step.type === 'dialogue') {
            const characterName = step.speakerName || step.npcId || '未知角色';
            let characterImage: string | undefined;

            if (step.activeImage) {
                characterImage = step.activeImage.startsWith('http')
                    ? step.activeImage
                    : `${HOST_ADDRESS}${step.activeImage}`;
            }

            if (step.isPlayer) {
                // player.images 可能是对象 { base: "..." } 或字符串
                const images = worldSetting?.player?.images as any;
                if (images) {
                    const playerImage = typeof images === 'string'
                        ? images
                        : (images?.base || images);
                    if (playerImage && typeof playerImage === 'string') {
                        characterImage = playerImage.startsWith('http')
                            ? playerImage
                            : `${HOST_ADDRESS}${playerImage}`;
                    }
                }
            }

            return {
                id: Date.now(),
                type: 'dialogue',
                message: step.content || '',
                characterName,
                characterImage,
                characterPosition: step.isPlayer ? 'right' : 'left',
            };
        } else if (step.type === 'choice') {
            const options = step.options?.map((opt: any, index: number) => ({
                id: index + 1,
                text: typeof opt === 'string' ? opt : (opt.text || opt),
            })) || [];

            const message = step.title
                ? (step.description ? `${step.title}\n${step.description}` : step.title)
                : (step.description || '请选择你的行动');

            let characterImage: string | undefined;
            // player.images 可能是对象 { base: "..." } 或字符串
            const images = worldSetting?.player?.images as any;
            if (images) {
                const playerImage = typeof images === 'string'
                    ? images
                    : (images?.base || images);
                if (playerImage && typeof playerImage === 'string') {
                    characterImage = playerImage.startsWith('http')
                        ? playerImage
                        : `${HOST_ADDRESS}${playerImage}`;
                }
            }

            return {
                id: Date.now(),
                type: 'choice',
                message,
                options,
                characterImage,
                characterPosition: 'right',
            };
        } else if (step.type === 'scene_change') {
            const newScene: GetGalgamePresetResponse['sceneSetting']['scenes'][0] = {
                id: step.sceneId || '',
                name: step.sceneName || '',
                type: '',
                description: step.sceneDescription || '',
                atmosphere: step.sceneAtmosphere,
                dangerLevel: step.dangerLevel,
                images: step.sceneImage,
                npcs: [],
                events: [],
                soundtrack: step.soundtrack,
            };

            setCurrentScene(newScene);

            if (step.sceneImage) {
                const sceneImage = step.sceneImage.startsWith('http')
                    ? step.sceneImage
                    : `${HOST_ADDRESS}${step.sceneImage}`;
                setBackgroundImage(sceneImage);
            }

            return {
                id: Date.now(),
                type: 'scene_change',
                message: step.sceneDescription || step.sceneName || '',
            };
        }

        return null;
    }, [npcSetting, worldSetting]);

    const currentMessage = useMemo(() => {
        // 优先使用 currentStep（如果存在且不是空的）
        if (gameStarted && stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const converted = convertStepToMessage(stepHandlers.currentStep);
            if (converted) {
                return converted;
            }
        }

        // 如果没有 currentStep 或 currentStep 为空，使用 initialMessages（历史记录解析出的选项）
        if (initialMessages.length > 0) {
            return initialMessages[0];
        }

        return {
            id: 0,
            type: 'narration' as MessageType,
            message: '',
        };
    }, [gameStarted, stepHandlers.currentStep, convertStepToMessage, initialMessages]);

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

    const { isMusicPlaying, handleMusicToggle } = useMusicPlayer({
        presetId: fileId || '',
        currentScene,
        gameStarted,
        isLoading,
    });

    useEffect(() => {
        if (gameStarted && stepHandlers.currentStep && showStoryIntro) {
            setShowStoryIntro(false);
        }
    }, [gameStarted, stepHandlers.currentStep, showStoryIntro]);

    // 转换步骤为文本模式格式
    const convertStepsToTextModalFormat = useCallback((steps: any[]): any[] => {
        return steps
            .filter(step => step != null && step.type)
            .map((step, index) => {
                // 使用稳定的 ID，避免每次渲染都重新生成
                const stableId = step.id || `step-${step.type}-${index}-${(step.content || '').substring(0, 20)}`;
                const baseStep = {
                    id: stableId,
                    type: step.type,
                    content: step.content || '',
                };

                if (step.type === 'dialogue') {
                    return {
                        ...baseStep,
                        speakerName: step.speakerName || step.npcId,
                        characterName: step.speakerName || step.npcId || '未知角色',
                        isPlayer: step.isPlayer || false,
                    };
                }

                if (step.type === 'choice') {
                    const options = step.options?.map((opt: any, idx: number) => ({
                        id: idx + 1,
                        text: typeof opt === 'string' ? opt : (opt.text || opt),
                    })) || [];

                    return {
                        ...baseStep,
                        title: step.title,
                        description: step.description,
                        options,
                    };
                }

                return baseStep;
            });
    }, []);

    // 处理历史记录的函数
    const processHistoryRecord = useCallback(() => {
        if (!historyLoading && presetData && history.length > 0) {
            // 只处理最后一条历史消息
            const lastMessage = history[history.length - 1];

            // 情况1：最后一条是用户消息 -> 重新发送
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

            // 情况2：最后一条是助手消息 -> 检查是否有choice
            if (lastMessage.role === 'assistant' && lastMessage.content) {
                const content = lastMessage.content;

                // 2.0 优先尝试使用本地完整 allSteps 恢复（只在最后一条是助手消息时考虑）
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
                            return; // 使用 allSteps 恢复后不再继续解析历史文本
                        }
                    }
                } catch (e) {
                    console.warn('[Galgame] 读取本地 allSteps 失败:', e);
                }

                // 尝试解析为步骤（文本模式用）
                const historySteps = parseHistoryToSteps(content);
                const hasChoiceInHistory = historySteps.some(
                    (s: any) => s && s.type === 'choice' && s.options && s.options.length > 0
                );

                if (historySteps.length > 0) {
                    setCompletedSteps(historySteps);

                    // 如果有 choice，设置为初始消息
                    const choiceStep = historySteps.find(s => s.type === 'choice');
                    if (choiceStep && choiceStep.options && choiceStep.options.length > 0) {
                        const choiceData = extractChoiceFromHistory(content);
                        if (choiceData) {
                            const choiceMessage: Message = {
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
                                characterPosition: 'right',
                            };
                            setInitialMessages([choiceMessage]);
                        }
                    }
                } else {
                    // 如果没有解析出步骤，尝试只解析 choice
                    const choiceData = extractChoiceFromHistory(content);
                    if (choiceData && choiceData.options.length > 0) {
                        // 创建 choice 步骤用于文本模式
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

                        const choiceMessage: Message = {
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
                            characterPosition: 'right',
                        };
                        setInitialMessages([choiceMessage]);
                    }
                }

                // 情况3：最后一条是助手消息但没有choice -> 查找倒数第一条用户消息并重新发送
                if (!hasChoiceInHistory && history.length >= 2) {
                    // 查找倒数第一条用户消息
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
    // 如果存在历史记录，不显示开场白，直接进入游戏，并解析最后一条消息
    useEffect(() => {
        // 等待历史记录加载完成和预设数据加载完成
        if (historyLoading || !presetData) return;

        if (history.length > 0) {
            if (!historyProcessedRef.current) {
                setShowStoryIntro(false);
                setGameStarted(true);
                processHistoryRecord();
                historyProcessedRef.current = true;
            }
        } else if (!historyProcessedRef.current) {
            // 首次且没有历史，保留开场白
            setShowStoryIntro(true);
            historyProcessedRef.current = true;
        }
    }, [historyLoading, presetData, history.length, processHistoryRecord]);

    // 当切换到文本模式时，如果历史记录存在但步骤为空，且不是在等待新数据，处理历史记录
    useEffect(() => {
        // 如果正在等待新数据（用户点击了选项），不要重新加载历史记录
        if (isTextMode && gameStarted && completedSteps.length === 0 && !historyLoading && history.length > 0 && presetData && !stepHandlers.isWaitingForData && !stepHandlers.currentStep) {
            processHistoryRecord();
            historyProcessedRef.current = true;
        }
    }, [isTextMode, gameStarted, completedSteps.length, historyLoading, history.length, presetData, processHistoryRecord, stepHandlers.isWaitingForData, stepHandlers.currentStep]);

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

    const finalDisplayText = stepHandlers.isWaitingForData && !stepHandlers.currentStep
        ? ''
        : (gameStarted ? displayedText : (currentMessage && currentMessage.type !== 'choice' ? currentMessage.message : ''));

    const finalIsTyping = (stepHandlers.isWaitingForData && !stepHandlers.currentStep) ? false : isTyping;

    // 简化的步骤管理：只在 currentStep 变化时处理
    // 关键：只有正常模式已经显示完的step（打字完成）才添加到已完成列表
    // 这样文本模式就只会显示正常模式已经显示过的step，保持状态统一
    useEffect(() => {
        const currentStep = stepHandlers.currentStep;
        const prevStep = previousStepRef.current;

        // 当 currentStep 变化时，将旧的步骤添加到已完成列表
        // 但只有在打字完成时才添加，确保正常模式已经显示完这个step
        if (prevStep && currentStep !== prevStep) {
            // 只有当打字完成时（!isTyping），才将旧步骤添加到已完成列表
            // 这样确保正常模式已经显示完这个step，文本模式才能显示它
            if (!isTyping) {
                setCompletedSteps(prev => {
                    // 检查是否已存在
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
        previousIsTypingRef.current = isTyping;
    }, [stepHandlers.currentStep, isTyping]);

    // 计算文本模式显示的所有步骤
    // 关键：只显示正常模式已经显示过的step，保持状态统一
    // 对于 choice 类型的步骤，只保留最后一个，避免重复显示
    const allStepsForTextModal = useMemo(() => {
        // 过滤有效步骤（这些是正常模式已经显示完的step）
        let validSteps = completedSteps.filter(s => s && s.type);

        // 如果有当前步骤，添加到末尾（如果还没在列表中）
        // 当前步骤是正常模式正在显示的step，文本模式也应该显示它
        if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const currentExists = validSteps.some(s =>
                s && s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content
            );
            if (!currentExists) {
                // 只添加当前步骤，不添加其他未显示的step
                validSteps = [...validSteps, stepHandlers.currentStep];
            }
        }

        // 对于 choice 类型的步骤，只保留最后一个
        const choiceIndices: number[] = [];
        validSteps.forEach((step, index) => {
            if (step && step.type === 'choice') {
                choiceIndices.push(index);
            }
        });

        if (choiceIndices.length > 1) {
            // 从后往前移除除了最后一个之外的所有 choice 步骤
            for (let i = choiceIndices.length - 2; i >= 0; i--) {
                validSteps.splice(choiceIndices[i], 1);
            }
        }

        // 只返回已经显示过的step，不返回其他已请求但未显示的step
        return validSteps;
    }, [completedSteps, stepHandlers.currentStep]);

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

        // 如果没有 currentStep，但 initialMessages 中有 choice，查找最后一个 choice 步骤
        if (initialMessages.length > 0 && initialMessages[0].type === 'choice') {
            // 从后往前查找最后一个 choice 步骤
            for (let i = allStepsForTextModal.length - 1; i >= 0; i--) {
                if (allStepsForTextModal[i] && allStepsForTextModal[i].type === 'choice') {
                    return i;
                }
            }
        }

        // 否则返回最后一个步骤的索引
        if (allStepsForTextModal.length > 0) {
            return allStepsForTextModal.length - 1;
        }

        return -1;
    }, [allStepsForTextModal, stepHandlers.currentStep, initialMessages]);

    // 获取当前步骤的打字机文本（保留颜色标签，实现丝滑打字效果）
    // 这个文本只用于当前正在打字的步骤
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

    void gameTitle;
    void worldSetting;
    void sceneSetting;

    useEffect(() => {
        const fetchPresetData = async () => {
            console.log(fileId);
            if (!fileId) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = isPreset ? await getGalgamePresetApi.getGalgamePreset(fileId) 
                : await getGalgamePresetApi.getGalgameFileId(fileId);

                if (response.data.success) {
                    const data = response.data;
                    setPresetData(data);
                    setWorldSetting(data.worldSetting);
                    setNpcSetting(data.npcSetting || null);
                    setSceneSetting(data.sceneSetting);

                    if (data.worldSetting?.title) {
                        setGameTitle(data.worldSetting.title);
                    }

                    let sceneImage = '';
                    if (data.sceneSetting?.scenes && data.sceneSetting.scenes.length > 0) {
                        const scenes = data.sceneSetting.scenes;
                        // 如果有历史记录中的 visitedScenes，则优先使用最后一个场景 ID 对应的场景
                        let initialScene = scenes[0];
                        if (lastVisitedSceneId) {
                            const matched = scenes.find((scene) => scene.id === lastVisitedSceneId);
                            if (matched) {
                                initialScene = matched;
                            }
                        }

                        if (initialScene) {
                            setCurrentScene(initialScene);
                        }

                        // 场景图片可能是 image 或 images 字段
                        const sceneImageUrl = (initialScene as any).image || initialScene.images;
                        console.log('场景图片URL:', sceneImageUrl, 'initialScene:', initialScene);
                        if (sceneImageUrl) {
                            sceneImage = sceneImageUrl.startsWith('http')
                                ? sceneImageUrl
                                : `${HOST_ADDRESS}${sceneImageUrl}`;
                            console.log('设置背景图片:', sceneImage);
                            setBackgroundImage(sceneImage);
                        } else {
                            console.warn('场景图片URL为空，initialScene:', initialScene);
                        }
                    }

                    if (!sceneImage) {
                        setBackgroundImage('https://img1.baidu.com/it/u=728753041,714041801&fm=253&app=138&f=JPEG?w=889&h=500');
                    }
                    // 如果存在历史记录，不显示开场白
                    setShowStoryIntro(history.length === 0);
                }
            } catch (error) {
                console.error('获取游戏数据失败:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPresetData();
    // 避免历史刷新触发重新加载全局文件
    }, [fileId, lastVisitedSceneId]);

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
        }, 1000);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, finalIsTyping, stepHandlers.showNextButton, stepHandlers.isWaitingForData, currentMessage?.type, gameStarted, handleNextMessage, isTextMode]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!currentMessage || currentMessage.type !== 'choice' || !currentMessage.options) {
            return;
        }

        // 清空已完成步骤和引用，避免残留数据
        resetDisplayedSteps();

        const optionIndex = currentMessage.options.findIndex((opt) => {
            return opt.text === option.text || opt.id === option.id;
        });
        if (optionIndex < 0) return;

        const optionText = currentMessage.options[optionIndex].text;

        // 如果当前步骤存在并且是 choice，按正常流程扣“option”积分
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
    }, [stepHandlers, currentMessage, resetDisplayedSteps]);

    // 统一封装自定义输入发送
    const handleCustomInputSubmit = useCallback((value: string) => {
        if (!value.trim()) return;
        stepHandlers.handleChoiceSend(value);
    }, [stepHandlers]);

    const handleRetryLastRequest = useCallback(() => {
        setRequestTimeoutVisible(false);
        window.location.reload();
    }, []);

    // 退出游戏
    const handleExitGame = useCallback(() => {
        try {
            localStorage.removeItem(allStepsStorageKey);
            console.log('[Galgame] 已清理临时状态数据');
        } catch (e) {
            console.warn('[Galgame] 清理临时状态失败:', e);
        }
        navigate('/');
    }, [allStepsStorageKey, navigate]);

    if (isLoading) {
        return (
            <div className={styles.pageRoot}>
                <div className={styles.mainContent}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        color: '#fff'
                    }}>
                        加载中...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={styles.pageRoot}>
                <div
                    className={`${styles.mainContent} ${characterAnimation === 'injury' ? styles.worldInjury : ''}`}
                    style={{
                        backgroundImage: isTextMode ? 'none' : backgroundImage ? `url(${backgroundImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: isTextMode ? '#000' : 'transparent'
                    }}
                >
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
                    <button
                        className={styles.exitButton}
                        onClick={handleExitGame}
                        title="退出游戏"
                    >
                        <IoMdCloseCircle size={24} />
                    </button>
                    <div className={`${styles.topHeader} ${isTextMode ? styles.topHeaderTextMode : ''}`}>
                        <CiLocationOn />
                        <span>{currentScene?.name}</span>
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
                        {!showGalgameHistory && !isTextMode && (
                            <>
                                <NormalModeDisplay
                                    currentMessage={currentMessage}
                                    finalDisplayText={finalDisplayText}
                                    finalIsTyping={finalIsTyping}
                                    stepHandlers={{
                                        isWaitingForData: stepHandlers.isWaitingForData,
                                        currentStep: stepHandlers.currentStep,
                                        showNextButton: stepHandlers.showNextButton,
                                        selectedOptionIndex: stepHandlers.selectedOptionIndex,
                                    }}
                                    isAutoPlay={isAutoPlay}
                                    onNextMessage={handleNextMessage}
                                    onChoiceClick={handleChoiceClick}
                                    // 统一封装，便于记录最近一次请求
                                    onCustomInputSubmit={(value) => handleCustomInputSubmit(value)}
                                />
                            </>
                        )}
                        {!showGalgameHistory && isTextMode && (
                            <TextModeDisplay
                                steps={convertStepsToTextModalFormat(allStepsForTextModal)}
                                currentStepIndex={currentStepIndex}
                                currentDisplayText={textModalDisplayText}
                                isTyping={finalIsTyping}
                                isWaitingForData={stepHandlers.isWaitingForData}
                                onChoiceClick={(option) => {
                                    resetDisplayedSteps();
                                    handleChoiceClick(option);
                                }}
                                onCustomInputSubmit={(value) => {
                                    resetDisplayedSteps();
                                    handleCustomInputSubmit(value);
                                }}
                            />
                        )}
                        <div className={styles.buttonContainer}>
                            <div className={styles.buttonItem}>
                                <div className={styles.buttonInner}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="积分" />
                                    <span>{user?.user?.points}</span>
                                </div>
                            </div>
                            <div className={styles.buttonItem}
                                onClick={() => {
                                    refreshHistory();
                                    setShowGalgameHistory(true);
                                }}
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
                                onClick={handleMusicToggle}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <PiMusicNoteDuotone />
                                    <span>音乐</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <StoryIntroModal
                        isOpen={showStoryIntro}
                        presetData={presetData}
                        onStartGame={handleStartGame}
                        isLoading={isStartingGame}
                    />

                    <GalgameHistoryModal
                        isOpen={showGalgameHistory}
                        history={history}
                        onClose={() => setShowGalgameHistory(false)}
                        backgroundImage={backgroundImage}
                        onRegenerate={(messageIndex) => {
                            setShowGalgameHistory(false);
                            resetDisplayedSteps();
                            stepHandlers.handleRegenerate(messageIndex, {
                                onError: (error) => {
                                    toast.error(error || '重新生成失败，请检查网络连接');
                                }
                            });
                        }}
                        onEditSave={editHistory}
                    />

                    <ErrorModal
                        visible={requestTimeoutVisible}
                        title="请求超时"
                        message="网络波动或服务器繁忙，请刷新重试或稍后再试。"
                        confirmText="刷新"
                        cancelText="取消"
                        primaryType="confirm"
                        onConfirm={handleRetryLastRequest}
                        onCancel={() => setRequestTimeoutVisible(false)}
                    />

                </div>
            </div>
        </>
    );
};

export default Galgame;