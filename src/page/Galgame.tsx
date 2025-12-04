import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CiLocationOn } from "react-icons/ci";
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
import { useMusicPlayer } from "../hooks/galgame/useMusicPlayer";
import toast from "react-hot-toast";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
import TextModeDisplay from "../components/Galgame/TextModeDisplay";
import useGalgameHistory from "../hooks/galgame/useGalgameHistory";

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
    const sessionId = useGameStore((state) => state.sessionId);
    const [searchParams] = useSearchParams();
    const presetId = searchParams.get('presetId') || 'c1c0450b-b086-440d-a477-f31fb71adbde';

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
    const [completedSteps, setCompletedSteps] = useState<any[]>([]); // 已完成的步骤
    const currentRequestIdRef = useRef<number>(0); // 当前请求ID，用于清空已完成步骤

    const { history, refreshHistory, loading: historyLoading, editHistory } = useGalgameHistory();

    // 当 currentStep 变化且打字机已完成时，将之前的 step 加入已完成列表
    const previousStepRef = useRef<any>(null);
    const previousIsTypingRef = useRef<boolean>(false);

    const stepHandlers = useGalgameStep({
        sessionId,
        onMessagesClear: () => {
            setInitialMessages([]);
            // 清空已完成步骤和引用，避免残留数据
            setCompletedSteps([]);
            previousStepRef.current = null;
            previousIsTypingRef.current = false;
        }
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
                characterImage = worldSetting?.player?.images.startsWith('http')
                    ? worldSetting?.player?.images
                    : `${HOST_ADDRESS}${worldSetting?.player?.images}`;
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
            if (worldSetting?.player?.images) {
                characterImage = worldSetting.player.images.startsWith('http')
                    ? worldSetting.player.images
                    : `${HOST_ADDRESS}${worldSetting.player.images}`;
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
        if (gameStarted && stepHandlers.currentStep) {
            const converted = convertStepToMessage(stepHandlers.currentStep);
            if (converted) return converted;
        }

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
        presetId,
        currentScene,
        gameStarted,
        isLoading,
    });

    useEffect(() => {
        if (gameStarted && stepHandlers.currentStep && showStoryIntro) {
            setShowStoryIntro(false);
        }
    }, [gameStarted, stepHandlers.currentStep, showStoryIntro]);

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
            .filter(step => step != null && step.type) // 过滤掉 null/undefined 和没有 type 的步骤
            .map((step, index) => {
                const baseStep = {
                    id: `text-${Date.now()}-${index}`,
                    type: step.type,
                    content: step.content || '',
                };

                if (step.type === 'dialogue') {
                    return {
                        ...baseStep,
                        speakerName: step.speakerName || step.npcId,
                        characterName: step.speakerName || step.npcId || '未知角色',
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
            // 查找最后一条助手消息
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].role === 'assistant' && history[i].content) {
                    const content = history[i].content;
                    
                    // 解析为文本模式步骤
                    const historySteps = parseHistoryToSteps(content);
                    if (historySteps.length > 0) {
                        // 将所有步骤（包括 choice）添加到已完成列表
                        // 这样文本模式下可以显示完整的历史记录
                        setCompletedSteps(historySteps);
                        
                        // 如果有 choice，也转换为 Message 格式并设置（用于正常模式）
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
                                    characterImage: worldSetting?.player?.images
                                        ? (worldSetting.player.images.startsWith('http')
                                            ? worldSetting.player.images
                                            : `${HOST_ADDRESS}${worldSetting.player.images}`)
                                        : undefined,
                                    characterPosition: 'right',
                                };
                                setInitialMessages([choiceMessage]);
                            }
                        }
                    } else {
                        // 如果没有解析出步骤，尝试只解析 choice
                        const choiceData = extractChoiceFromHistory(content);
                        if (choiceData && choiceData.options.length > 0) {
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
                                characterImage: worldSetting?.player?.images
                                    ? (worldSetting.player.images.startsWith('http')
                                        ? worldSetting.player.images
                                        : `${HOST_ADDRESS}${worldSetting.player.images}`)
                                    : undefined,
                                characterPosition: 'right',
                            };
                            setInitialMessages([choiceMessage]);
                        }
                    }
                    break;
                }
            }
        }
    }, [historyLoading, presetData, history, worldSetting]);

    // 如果存在历史记录，不显示开场白，直接进入游戏，并解析最后一条消息
    useEffect(() => {
        if (showStoryIntro) {
            setShowStoryIntro(false);
            setGameStarted(true);
            processHistoryRecord();
        }
    }, [showStoryIntro, processHistoryRecord]);

    // 当切换到文本模式时，如果历史记录存在但步骤为空，且不是在等待新数据，处理历史记录
    useEffect(() => {
        // 如果正在等待新数据（用户点击了选项），不要重新加载历史记录
        if (isTextMode && gameStarted && completedSteps.length === 0 && !historyLoading && history.length > 0 && presetData && !stepHandlers.isWaitingForData && !stepHandlers.currentStep) {
            processHistoryRecord();
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

    // 将步骤添加到已完成列表的辅助函数
    const addStepToCompleted = useCallback((step: any) => {
        if (!step) return;
        setCompletedSteps(prev => {
            const exists = prev.some(s => {
                if (!s || !step) return false;
                // 使用 type 和 content 进行比较，确保不会重复
                return s.type === step.type &&
                    s.content === step.content &&
                    (s.type !== 'dialogue' ||
                        (s.speakerName === step.speakerName &&
                            s.npcId === step.npcId));
            });
            if (!exists) {
                return [...prev, step];
            }
            return prev;
        });
    }, []);

    useEffect(() => {
        if (previousStepRef.current &&
            stepHandlers.currentStep &&
            stepHandlers.currentStep !== previousStepRef.current &&
            !finalIsTyping) {
            addStepToCompleted(previousStepRef.current);
        }

        if (previousStepRef.current && !stepHandlers.currentStep && !finalIsTyping) {
            addStepToCompleted(previousStepRef.current);
        }

        if (previousIsTypingRef.current &&
            !finalIsTyping &&
            stepHandlers.currentStep &&
            stepHandlers.currentStep === previousStepRef.current) {
            // 当前步骤打字完成，将其添加到已完成列表
            addStepToCompleted(stepHandlers.currentStep);
        }

        previousStepRef.current = stepHandlers.currentStep;
        previousIsTypingRef.current = finalIsTyping;
    }, [stepHandlers.currentStep, finalIsTyping, addStepToCompleted]);

    // 计算当前步骤在所有步骤（已完成 + 当前）中的索引
    // 确保 currentStep 不会在 completedSteps 中重复
    const allStepsForTextModal = useMemo(() => {
        const filteredCompletedSteps = completedSteps.filter(s => {
            if (!s) return false;
            if (!stepHandlers.currentStep) return true;
            const isSame = s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content &&
                (s.type !== 'dialogue' ||
                    (s.speakerName === stepHandlers.currentStep.speakerName &&
                        s.npcId === stepHandlers.currentStep.npcId));
            return !isSame;
        });

        const all = [...filteredCompletedSteps];
        if (stepHandlers.currentStep) {
            all.push(stepHandlers.currentStep);
        }
        return all;
    }, [completedSteps, stepHandlers.currentStep]);

    const currentStepIndex = useMemo(() => {
        if (!stepHandlers.currentStep) return -1;
        const filteredCompletedSteps = completedSteps.filter(s => {
            if (!s) return false;
            if (!stepHandlers.currentStep) return true;
            return !(s.type === stepHandlers.currentStep.type &&
                s.content === stepHandlers.currentStep.content);
        });
        return filteredCompletedSteps.length;
    }, [completedSteps, stepHandlers.currentStep]);

    // 获取当前步骤的打字机文本（保留颜色标签，实现丝滑打字效果）
    const textModalDisplayText = useMemo(() => {
        if (stepHandlers.currentStep && currentMessage && currentMessage.type !== 'choice') {
            // 获取原始带标签的文本
            const originalText = currentMessage.message || '';
            // 获取当前打字进度（纯文本长度）
            const currentPlainLength = displayedText.length;
            
            if (currentPlainLength > 0) {
                // 根据当前打字进度，从原始文本中截取带标签的部分
                const textWithTags = truncateTextWithTags(originalText, currentPlainLength);
                return textWithTags;
            }
        }
        return '';
    }, [stepHandlers.currentStep, currentMessage, displayedText]);

    void gameTitle;
    void worldSetting;
    void sceneSetting;

    useEffect(() => {
        const fetchPresetData = async () => {
            if (!presetId) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = await getGalgamePresetApi.getGalgamePreset(presetId);

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
                        const firstScene = data.sceneSetting.scenes[0];
                        if (firstScene) {
                            setCurrentScene(firstScene);
                        }
                        if (firstScene.images) {
                            sceneImage = firstScene.images.startsWith('http')
                                ? firstScene.images
                                : `${HOST_ADDRESS}${firstScene.images}`;
                            setBackgroundImage(sceneImage);
                        }
                    }

                    if (!sceneImage) {
                        setBackgroundImage('https://img1.baidu.com/it/u=728753041,714041801&fm=253&app=138&f=JPEG?w=889&h=500');
                    }
                    // 如果存在历史记录，不显示开场白，直接进入游戏
                    // 注意：这里需要等待历史记录加载完成后再判断
                    // 所以会在下面的 useEffect 中处理
                    setShowStoryIntro(true);
                }
            } catch (error) {
                console.error('获取游戏数据失败:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPresetData();
    }, [presetId]);

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
            },
            onSuccess: () => {
                setIsStartingGame(false);
            },
            onError: (error) => {
                console.error('❌ 开始游戏失败:', error);
                toast.error(error || '开始游戏失败，请重试');
                setIsStartingGame(false);
                setGameStarted(false);
                setShowStoryIntro(true);
            }
        });
    }, [sessionId, stepHandlers]);

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
        }, 2000);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, finalIsTyping, stepHandlers.showNextButton, stepHandlers.isWaitingForData, currentMessage?.type, gameStarted, handleNextMessage, isTextMode]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!currentMessage || currentMessage.type !== 'choice' || !currentMessage.options) {
            return;
        }

        // 清空已完成步骤和引用，避免残留数据
        setCompletedSteps([]);
        previousStepRef.current = null;
        previousIsTypingRef.current = false;

        const optionIndex = currentMessage.options.findIndex((opt) => {
            return opt.text === option.text || opt.id === option.id;
        });

        if (optionIndex < 0) {
            return;
        }

        const optionObj = currentMessage.options[optionIndex];
        const optionText = optionObj.text;

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

        stepHandlers.handleChoiceSend(optionText);
    }, [stepHandlers, currentMessage]);

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
                    <div className={styles.gameContentWrapper}>
                        {!showGalgameHistory && !isTextMode && (
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
                                onCustomInputSubmit={(value) => stepHandlers.handleChoiceSend(value)}
                            />
                        )}
                        {!showGalgameHistory && isTextMode && (
                            <TextModeDisplay
                                steps={convertStepsToTextModalFormat(allStepsForTextModal)}
                                currentStepIndex={currentStepIndex}
                                currentDisplayText={textModalDisplayText}
                                isTyping={finalIsTyping}
                                showNextButton={stepHandlers.showNextButton}
                                isWaitingForData={stepHandlers.isWaitingForData}
                                onNextStep={handleNextMessage}
                                onChoiceClick={(option) => {
                                    setCompletedSteps([]);
                                    previousStepRef.current = null;
                                    previousIsTypingRef.current = false;
                                    handleChoiceClick(option);
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
                            setCompletedSteps([]);
                            previousStepRef.current = null;
                            previousIsTypingRef.current = false;
                            stepHandlers.handleRegenerate(messageIndex, {
                                onError: (error) => {
                                    toast.error(error || '重新生成失败');
                                }
                            });
                        }}
                        onEditSave={editHistory}
                    />

                </div>
            </div>
        </>
    );
};

export default Galgame;