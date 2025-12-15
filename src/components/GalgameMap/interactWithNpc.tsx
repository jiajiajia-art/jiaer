import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CiLocationOn } from "react-icons/ci";
import { IoArrowBack } from "react-icons/io5";
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
import { useWorldInteractionStep } from "../../hooks/galgame/useWorldInteractionStep";
import { HOST_ADDRESS } from "../../config";
import { useCharacterAnimation } from "../../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../../hooks/galgame/useCharacterContainerClassName";
import { useStoryTyping } from "../../hooks/story/useStoryTyping";
import NormalModeDisplay from "./NormalModeDisplay";
import TextModeDisplay from "./TextModeDisplay";
import interactionApi from "../../api/worldInteraction/interactionApi";
import type { AllGameData, Scene } from "../../api/worldInteraction/mapWorldData.type";


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

const InteractWithNpc = ({ onClose, gameData }: { onClose: () => void, gameData: AllGameData }) => {

    const { user } = useAuthStore();
    const sessionId = useGameStore((state) => state.sessionId);
    const { pdfFileId } = useGameStore();
    const { eventData, setEventData, setCurrentView } = useMapGalgameStore();
    const [isLoadingNextRound, setIsLoadingNextRound] = useState(false);

    // 从 eventData 获取 eventId
    const eventId = eventData?.event?.eventId || null;

    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [currentScene, setCurrentScene] = useState<Scene | null>(null);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
    const [isTextMode, setIsTextMode] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<any[]>([]); // 已完成的步骤
    const currentRequestIdRef = useRef<number>(0); // 当前请求ID，用于清空已完成步骤

    // 当 currentStep 变化且打字机已完成时，将之前的 step 加入已完成列表
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);

    const stepHandlers = useWorldInteractionStep({
        sessionId,
        eventId,
        fileId: pdfFileId,
        onMessagesClear: () => {
            // 清空已完成步骤和引用，避免残留数据
            setCompletedSteps([]);
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
    });

    const worldSetting = useMemo(() => gameData?.worldSetting, [gameData]);
    const npcSetting = useMemo(() => gameData?.npcSetting, [gameData]);
    const sceneSetting = useMemo(() => gameData?.sceneSetting, [gameData]);

    const resolveImageUrl = (rawImage?: any) => {
        const image =
            typeof rawImage === 'string'
                ? rawImage
                : (rawImage && typeof rawImage === 'object' && ('base' in rawImage || 'url' in rawImage))
                    ? (rawImage.base || rawImage.url || '')
                    : '';

        if (!image) return undefined;
        return image.startsWith('http') ? image : `${HOST_ADDRESS}${image}`;
    };

    // 初始化 currentScene 和背景，使用父组件传入的 gameData
    useEffect(() => {
        const firstScene = sceneSetting?.scenes?.[0];
        if (firstScene) {
            setCurrentScene(firstScene);
            const firstImage = resolveImageUrl(firstScene.image);
            if (firstImage) setBackgroundImage(firstImage);
        }
    }, [sceneSetting]);

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
                characterImage = resolveImageUrl(step.activeImage);
            }

            if (step.isPlayer) {
                characterImage = resolveImageUrl(worldSetting?.player?.images || worldSetting?.player?.imagePath);
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
            const options = step.options?.map((opt: any, index: number) => {
                if (typeof opt === 'string') {
                    return {
                        id: index + 1,
                        text: opt,
                    };
                }
                return {
                    id: opt.optionId || index + 1,
                    text: opt.text || opt,
                    optionId: opt.optionId,
                };
            }) || [];

            const message = step.title
                ? (step.description ? `${step.title}\n${step.description}` : step.title)
                : (step.description || '请选择你的行动');

            let characterImage: string | undefined;
            if (worldSetting?.player?.images || worldSetting?.player?.imagePath) {
                characterImage = resolveImageUrl(worldSetting.player.images || worldSetting.player.imagePath);
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
            const newScene: Scene = {
                id: step.sceneId || '',
                name: step.sceneName || '',
                type: '',
                description: step.sceneDescription || '',
                atmosphere: step.sceneAtmosphere,
                dangerLevel: step.dangerLevel,
                image: step.sceneImage || '',
                events: [],
                soundtrack: step.soundtrack,
                subscenes: [],
                position: [0.5, 0.5],
            };

            setCurrentScene(newScene);

            if (step.sceneImage) {
                const sceneImage = resolveImageUrl(step.sceneImage);
                if (sceneImage) setBackgroundImage(sceneImage);
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
        // 使用 currentStep（如果存在且不是空的）
        if (gameStarted && stepHandlers.currentStep && stepHandlers.currentStep.type) {
            const converted = convertStepToMessage(stepHandlers.currentStep);
            if (converted) {
                return converted;
            }
        }

        return {
            id: 0,
            type: 'narration' as MessageType,
            message: '',
        };
    }, [gameStarted, stepHandlers.currentStep, convertStepToMessage]);

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
                    const options = step.options?.map((opt: any, idx: number) => {
                        if (typeof opt === 'string') {
                            return {
                                id: idx + 1,
                                text: opt,
                            };
                        }
                        return {
                            id: opt.optionId || idx + 1,
                            text: opt.text || opt,
                            optionId: opt.optionId,
                        };
                    }) || [];

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

    // 初始化游戏：父组件已传入 gameData，直接启动
    useEffect(() => {
        if (!gameStarted && sessionId && eventId && pdfFileId && gameData) {
            setGameStarted(true);
            stepHandlers.handleInteract({
                onError: (error) => {
                    console.error('❌ 开始交互失败:', error);
                }
            });
        }
    }, [gameStarted, sessionId, eventId, pdfFileId, gameData, stepHandlers]);

    const handleNextMessage = useCallback(() => {
        if (gameStarted && stepHandlers.showNextButton) {
            // 检查队列是否为空，如果为空则不执行
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
        // 找到所有 choice 步骤的索引
        const choiceIndices: number[] = [];
        validSteps.forEach((step, index) => {
            if (step && step.type === 'choice') {
                choiceIndices.push(index);
            }
        });

        // 如果有多个 choice 步骤，只保留最后一个
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

        // 否则返回最后一个步骤的索引
        if (allStepsForTextModal.length > 0) {
            return allStepsForTextModal.length - 1;
        }

        return -1;
    }, [allStepsForTextModal, stepHandlers.currentStep]);

    // 检查是否应该显示"继续游戏"按钮（有 newEvent）
    const shouldShowContinueButton = useMemo(() => {
        if (stepHandlers.isWaitingForData) return false;
        if (!stepHandlers.currentStep) return false;
        if (stepHandlers.currentStep.type === 'choice') return false;
        if (stepHandlers.showNextButton) return false;
        if (finalIsTyping) return false;
        if (stepHandlers.stepQueue && stepHandlers.stepQueue.length > 0) return false;
        // 检查是否有完整的新事件（event, npc, subscene）
        if (!stepHandlers.newEvent) return false;
        if (!stepHandlers.newEvent.event || !stepHandlers.newEvent.npc || !stepHandlers.newEvent.subscene) return false;
        return true;
    }, [stepHandlers.isWaitingForData, stepHandlers.showNextButton, stepHandlers.currentStep, stepHandlers.stepQueue, stepHandlers.newEvent, finalIsTyping]);

    // 检查是否应该显示"结束回合"按钮（没有 newEvent，需要调用 next-round）
    const shouldShowEndRoundButton = useMemo(() => {
        if (stepHandlers.isWaitingForData) return false;
        if (!stepHandlers.currentStep) return false;
        if (stepHandlers.currentStep.type === 'choice') return false;
        if (stepHandlers.showNextButton) return false;
        if (finalIsTyping) return false;
        if (stepHandlers.stepQueue && stepHandlers.stepQueue.length > 0) return false;
        // 如果没有 newEvent，或者 newEvent 只有 completedEvent 但没有完整事件信息
        if (!stepHandlers.newEvent) return true;
        // 如果有 newEvent 但没有完整的事件信息（只有 completedEvent），也需要显示结束回合
        if (stepHandlers.newEvent.completedEvent && (!stepHandlers.newEvent.event || !stepHandlers.newEvent.npc || !stepHandlers.newEvent.subscene)) {
            return true;
        }
        return false;
    }, [stepHandlers.isWaitingForData, stepHandlers.showNextButton, stepHandlers.currentStep, stepHandlers.stepQueue, stepHandlers.newEvent, finalIsTyping]);

    // 处理继续游戏（有 newEvent）
    const handleContinue = useCallback(() => {
        if (stepHandlers.newEvent?.event && stepHandlers.newEvent.npc && stepHandlers.newEvent.subscene) {
            setEventData({
                event: stepHandlers.newEvent.event,
                npc: stepHandlers.newEvent.npc,
                subscene: stepHandlers.newEvent.subscene,
            });
            stepHandlers.clearNewEvent?.();
            setCurrentView(MapViewState.WORLD_MAP);
        }
    }, [stepHandlers, setEventData, setCurrentView]);

    // 处理结束回合（没有 newEvent，需要调用 next-round）
    const handleEndRound = useCallback(async () => {
        // 清除可能存在的 completedEvent 标记
        if (stepHandlers.newEvent) {
            stepHandlers.clearNewEvent?.();
        }
        
        try {
            if (!sessionId) {
                console.error('缺少 sessionId');
                return;
            }
            setIsLoadingNextRound(true);
            const response = await interactionApi.nextRound(sessionId);
            if (response.data.success && response.data.activeEvents && response.data.activeEvents.length > 0) {
                // 使用第一个活跃事件
                const firstEvent = response.data.activeEvents[0];
                
                // 从 presetData 中查找对应的 NPC 和 subscene
                let foundNpc: any = null;
                let foundSubscene: any = null;
                
                // 使用父组件传入的 gameData 查找 NPC 和 subscene
                if (gameData) {
                    if (gameData.npcSetting?.npcs) {
                        foundNpc = gameData.npcSetting.npcs.find(npc => npc.id === firstEvent.targetNpcId);
                    }

                    if (gameData.sceneSetting?.scenes) {
                        for (const scene of gameData.sceneSetting.scenes) {
                            if (scene.subscenes && Array.isArray(scene.subscenes)) {
                                foundSubscene = scene.subscenes.find((sub: any) => sub.id === firstEvent.targetSubsceneId);
                                if (foundSubscene) {
                                    foundSubscene = {
                                        ...foundSubscene,
                                        parentSceneName: scene.name
                                    };
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // 如果找到了 NPC 和 subscene，保存到 store
                if (foundNpc && foundSubscene) {
                    setEventData({
                        event: firstEvent,
                        npc: {
                            id: foundNpc.id,
                            name: foundNpc.name,
                            image: foundNpc.images?.base || foundNpc.images || '',
                        },
                        subscene: {
                            id: foundSubscene.id,
                            name: foundSubscene.name,
                            image: foundSubscene.image || '',
                            parentSceneName: foundSubscene.parentSceneName || '',
                        },
                    });
                }
            }
        } catch (error) {
            console.error('开始新回合失败:', error);
        } finally {
            setIsLoadingNextRound(false);
            // 加载完成后自动返回世界地图
            setCurrentView(MapViewState.WORLD_MAP);
        }
    }, [stepHandlers, setEventData, setCurrentView, sessionId, gameData]);

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

    void sceneSetting;

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

    const handleChoiceClick = useCallback((option: { id: number | string; text: string; optionId?: string }) => {
        if (!currentMessage || currentMessage.type !== 'choice' || !currentMessage.options) {
            return;
        }

        // 清空已完成步骤和引用，避免残留数据
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;

        // 优先使用 optionId，如果没有则从 currentStep 中查找
        let optionId: string | undefined = option.optionId;
        let optionIndex = -1;

        // 从 currentStep 中查找选项
        if (stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') {
            optionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
                if (typeof opt === 'string') {
                    return opt === option.text;
                }
                return opt.text === option.text || opt.optionId === option.optionId || opt.optionId === option.id;
            }) ?? -1;

            if (optionIndex >= 0) {
                const stepOption = stepHandlers.currentStep.options?.[optionIndex];
                if (stepOption && typeof stepOption !== 'string') {
                    optionId = stepOption.optionId || optionId;
                }
            }
        }

        // 如果还没找到，从 currentMessage 中查找
        if (optionIndex < 0) {
            optionIndex = currentMessage.options.findIndex((opt: any) => {
                return opt.text === option.text || opt.id === option.id || opt.optionId === option.optionId;
            });
            
            if (optionIndex >= 0) {
                const msgOption = currentMessage.options[optionIndex] as any;
                optionId = msgOption.optionId || optionId;
            }
        }

        if (optionIndex < 0 || !optionId) {
            console.error('❌ 无法找到选项或 optionId:', { option, optionIndex, optionId });
            return;
        }

        stepHandlers.handleChoiceOption(optionId, optionIndex, {
            onError: (error) => {
                console.error('❌ 选择选项失败:', error);
            }
        });
    }, [stepHandlers, currentMessage]);

    // if (isLoading) {
    //     return (
    //         <div className={styles.pageRoot}>
    //             <div className={styles.mainContent}>
    //                 <div style={{
    //                     display: 'flex',
    //                     justifyContent: 'center',
    //                     alignItems: 'center',
    //                     height: '100%',
    //                     color: '#fff'
    //                 }}>
    //                     加载中...
    //                 </div>
    //             </div>
    //         </div>
    //     );
    // }

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
                    <div className={styles.backButton} onClick={onClose}>
                            <IoArrowBack />
                        </div>
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
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
                        {!isTextMode && (
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
                                    onCustomInputSubmit={() => {
                                        // 世界交互模式不支持自定义输入
                                    }}
                                />
                            </>
                        )}
                        {isTextMode && (
                            <TextModeDisplay
                                steps={convertStepsToTextModalFormat(allStepsForTextModal)}
                                currentStepIndex={currentStepIndex}
                                currentDisplayText={textModalDisplayText}
                                isTyping={finalIsTyping}
                                isWaitingForData={stepHandlers.isWaitingForData}
                                onChoiceClick={(option) => {
                                    setCompletedSteps([]);
                                    previousStepRef.current = null;
                                    previousIsTypingRef.current = false;
                                    handleChoiceClick(option);
                                }}
                                onCustomInputSubmit={() => {
                                    // 世界交互模式不支持自定义输入
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
                            <div
                                className={styles.buttonItem}
                                style={{ cursor: 'pointer' }}
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
                                className={styles.buttonItem}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <PiMusicNoteDuotone />
                                    <span>音乐</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* 继续游戏按钮 - 有 newEvent 时显示 */}
                        {shouldShowContinueButton && !isLoadingNextRound && (
                            <div 
                                className={styles.continueButton} 
                                onClick={handleContinue}
                                style={{ cursor: 'pointer' }}
                            >
                                <MdCheckCircle />
                                <span>继续游戏</span>
                            </div>
                        )}

                        {/* 结束回合按钮 - 没有 newEvent 时显示 */}
                        {shouldShowEndRoundButton && (
                            <div 
                                className={styles.endRoundButton} 
                                onClick={handleEndRound}
                                style={{ 
                                    opacity: isLoadingNextRound ? 0.6 : 1,
                                    cursor: isLoadingNextRound ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isLoadingNextRound ? (
                                    <>
                                        <div className={styles.loadingSpinner}></div>
                                        <span>加载中...</span>
                                    </>
                                ) : (
                                    <>
                                        <MdCheckCircle />
                                        <span>结束回合</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default InteractWithNpc;