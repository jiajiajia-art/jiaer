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
import { useWorldInteractionStep } from "../../hooks/galgame/useWorldInteractionStep";
import { HOST_ADDRESS } from "../../config";
import { useCharacterAnimation } from "../../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../../hooks/galgame/useCharacterContainerClassName";
import { useStoryTyping } from "../../hooks/story/useStoryTyping";
import NormalModeDisplay from "./NormalModeDisplay";
import TextModeDisplay from "./TextModeDisplay";
import type { AllGameData } from "../../api/worldInteraction/mapWorldData.type";


type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string; optionId?: string }>;
}

// 工具函数：处理图片URL
const getImageUrl = (image: string | undefined): string | undefined => {
    if (!image) return undefined;
    return image.startsWith('http') ? image : `${HOST_ADDRESS}${image}`;
};

// 工具函数：获取玩家图片
const getPlayerImage = (playerImages: string | { [variant: string]: string } | undefined): string | undefined => {
    if (!playerImages) return undefined;
    const image = typeof playerImages === 'string' ? playerImages : (playerImages as any)?.base || '';
    return image ? getImageUrl(image) : undefined;
};

const InteractWithNpc = ({ 
    onClose, 
    gameData,
    onEndRound,
    isEndingRound,
}: { 
    onClose: () => void;
    gameData: AllGameData | null;
    onEndRound: () => void;
    isEndingRound: boolean;
}) => {

    const { user } = useAuthStore();
    const sessionId = useGameStore((state) => state.sessionId);
    const { pdfFileId } = useGameStore();
    const { eventData, setEventData, setCurrentView } = useMapGalgameStore();

    // 从 eventData 获取 eventId
    const eventId = eventData?.event?.eventId || null;

    // 从 gameData 中获取数据
    const worldSetting = gameData?.worldSetting || null;
    const sceneSetting = gameData?.sceneSetting || null;
    
    // 获取当前子场景信息
    const currentSubscene = eventData?.subscene || null;
    
    // 获取背景图片：优先使用 eventData.subscene.image，否则从 gameData 中查找
    const backgroundImage = useMemo(() => {
        if (eventData?.subscene?.image) {
            return getImageUrl(eventData.subscene.image) || '';
        }
        
        if (eventData?.subscene?.id && sceneSetting?.scenes) {
            for (const scene of sceneSetting.scenes) {
                const subscene = scene.subscenes?.find((sub: any) => sub.id === eventData.subscene.id);
                if (subscene?.image) {
                    return getImageUrl(subscene.image) || '';
                }
            }
        }
        
        return '';
    }, [eventData?.subscene?.image, eventData?.subscene?.id, sceneSetting]);
    
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
    const [isTextMode, setIsTextMode] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<any[]>([]); // 已完成的步骤
    const currentRequestIdRef = useRef<number>(0); // 当前请求ID，用于清空已完成步骤
    const hasInitializedRef = useRef(false);

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
            // 根据新的数据类型，使用 speakerId 来判断是否是玩家
            const isPlayer = step.speakerId === 'player' || step.speakerId === 'Player' || step.speakerId === worldSetting?.player?.name;
            const characterName = step.speakerName || step.npcId || step.speakerId || '未知角色';
            const characterImage = isPlayer 
                ? getPlayerImage(worldSetting?.player?.images)
                : getImageUrl(step.activeImage || step.npcImages?.base);

            return {
                id: Date.now(),
                type: 'dialogue',
                message: step.content || '',
                characterName,
                characterImage,
                characterPosition: isPlayer ? 'right' : 'left',
            };
        } else if (step.type === 'choice') {
            const options = step.options?.map((opt: any, index: number) => {
                if (typeof opt === 'string') {
                    return { id: index + 1, text: opt };
                }
                return {
                    id: index + 1,
                    text: opt.text || opt,
                    optionId: opt.optionId ? String(opt.optionId) : undefined,
                };
            }) || [];

            const message = step.title
                ? (step.description ? `${step.title}\n${step.description}` : step.title)
                : (step.description || '请选择你的行动');

            return {
                id: Date.now(),
                type: 'choice',
                message,
                options,
                characterImage: getPlayerImage(worldSetting?.player?.images),
                characterPosition: 'right',
            };
        } else if (step.type === 'scene_change') {
            // 场景切换时，背景图片会通过 eventData.subscene.image 自动更新
            // 这里不需要手动设置，因为 backgroundImage 已经通过 useMemo 从 eventData 计算得出
            return {
                id: Date.now(),
                type: 'scene_change',
                message: step.sceneDescription || step.sceneName || '',
            };
        }

        return null;
    }, [worldSetting]);

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
                    // 根据新的数据类型，使用 speakerId 来判断是否是玩家
                    const isPlayer = step.speakerId === 'player' || step.speakerId === 'Player' || step.speakerId === worldSetting?.player?.name;
                    return {
                        ...baseStep,
                        speakerName: step.speakerName || step.npcId || step.speakerId,
                        characterName: step.speakerName || step.npcId || step.speakerId || '未知角色',
                        isPlayer: isPlayer,
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
                            id: idx + 1,
                            text: opt.text || opt,
                            optionId: opt.optionId ? String(opt.optionId) : undefined,
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
    }, [worldSetting]);

    // 初始化游戏：当 gameData 加载完成后自动开始
    useEffect(() => {
        // 确保只执行一次
        if (hasInitializedRef.current) return;
        
        if (gameData && !gameStarted && sessionId && eventId && pdfFileId) {
            hasInitializedRef.current = true;
            setGameStarted(true);
            
            // 添加延迟，确保状态更新后再执行
            setTimeout(() => {
                stepHandlers.handleInteract({
                    onError: (error) => {
                        console.error('❌ 开始交互失败:', error);
                    }
                });
            }, 100);
        }
    }, [gameData, gameStarted, sessionId, eventId, pdfFileId, stepHandlers]);

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

    // 计算文本模式显示的所有步骤：只显示已完成的步骤和当前步骤，choice 类型只保留最后一个
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

        // choice 类型只保留最后一个
        const choiceIndices = validSteps
            .map((step, index) => step?.type === 'choice' ? index : -1)
            .filter(idx => idx >= 0);
        
        if (choiceIndices.length > 1) {
            for (let i = choiceIndices.length - 2; i >= 0; i--) {
                validSteps.splice(choiceIndices[i], 1);
            }
        }

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

    // 检查是否应该显示按钮的通用条件
    const canShowButtons = useMemo(() => {
        return !stepHandlers.isWaitingForData &&
               stepHandlers.currentStep &&
               stepHandlers.currentStep.type !== 'choice' &&
               !stepHandlers.showNextButton &&
               !finalIsTyping &&
               (!stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0);
    }, [stepHandlers.isWaitingForData, stepHandlers.currentStep, stepHandlers.showNextButton, stepHandlers.stepQueue, finalIsTyping]);

    // 检查是否应该显示"继续游戏"按钮（有完整 newEvent）
    const shouldShowContinueButton = useMemo(() => {
        if (!canShowButtons) return false;
        const newEvent = stepHandlers.newEvent;
        return !!(newEvent?.event && newEvent.npc && newEvent.subscene);
    }, [canShowButtons, stepHandlers.newEvent]);

    // 检查是否应该显示"结束回合"按钮（没有完整 newEvent）
    const shouldShowEndRoundButton = useMemo(() => {
        if (!canShowButtons) return false;
        const newEvent = stepHandlers.newEvent;
        return !newEvent || 
               (newEvent.completedEvent && (!newEvent.event || !newEvent.npc || !newEvent.subscene));
    }, [canShowButtons, stepHandlers.newEvent]);

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

    // 结束回合：仅做本组件内的状态清理，实际的 next-round 请求由父组件统一处理
    const handleEndRound = useCallback(() => {
        stepHandlers.clearNewEvent?.();
        // 交给父组件统一调用 nextRound
        onEndRound();
    }, [stepHandlers, onEndRound]);

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
        // 清空已完成步骤和引用，避免残留数据
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;

        // optionId 可以是真实的 optionId（string 类型）或者用户自定义输入的文本（string 类型）
        let optionId: string | undefined = option.optionId;
        let optionIndex = -1;

        // 如果 optionId 存在，说明可能是用户自定义输入（直接使用）或者是真实 optionId
        // 如果 optionId 不存在，需要从 currentStep 或 currentMessage 中查找
        if (!optionId) {
            // 从 currentStep 中查找选项
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
            // 如果 optionId 存在，尝试找到对应的 optionIndex（用于显示选中状态）
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

        // optionId 必须存在（可以是真实 optionId 或用户自定义输入的文本）
        if (!optionId) {
            console.error('❌ 无法找到选项或 optionId:', { option, optionIndex, optionId });
            return;
        }

        // 如果 optionIndex 没找到，使用 -1（表示是用户自定义输入）
        const finalOptionIndex = optionIndex >= 0 ? optionIndex : -1;

        stepHandlers.handleChoiceOption(optionId, finalOptionIndex, {
            onError: (error) => {
                console.error('❌ 选择选项失败:', error);
            }
        });
    }, [stepHandlers, currentMessage]);

    // 处理用户自定义输入
    const handleCustomInputSubmit = useCallback((customText: string) => {
        if (!customText.trim()) {
            return;
        }

        // 将用户自定义输入的文本作为 optionId 传递
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
                                        isWaitingForData: stepHandlers.isWaitingForData,
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

                        {/* 结束回合按钮 - 没有 newEvent 时显示 */}
                        {shouldShowEndRoundButton && (
                            <div 
                                className={styles.endRoundButton} 
                                onClick={() => {
                                    if (!isEndingRound) {
                                        handleEndRound();
                                    }
                                }}
                                style={{ 
                                    opacity: isEndingRound ? 0.6 : 1,
                                    cursor: isEndingRound ? 'not-allowed' : 'pointer'
                                }}
                            >
                            {isEndingRound ? (
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