import { useState, useEffect, useCallback, useMemo } from "react";
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
import { extractPlainText, extractChoiceFromHistory } from "../utils/textUtils";
import { useCharacterAnimation } from "../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../hooks/galgame/useCharacterContainerClassName";
import { useMusicPlayer } from "../hooks/galgame/useMusicPlayer";
import toast from "react-hot-toast";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
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

    const { history, refreshHistory, loading: historyLoading } = useGalgameHistory();

    const stepHandlers = useGalgameStep({
        sessionId,
        onMessagesClear: () => {
            setInitialMessages([]);
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

    // 如果存在历史记录，不显示开场白，直接进入游戏，并解析最后一条消息的 choice 部分
    useEffect(() => {
        if (!historyLoading && presetData && history.length > 0 && showStoryIntro) {
            setShowStoryIntro(false);
            setGameStarted(true);
            
            // 查找最后一条助手消息，解析其中的 choice 部分
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].role === 'assistant' && history[i].content) {
                    const choiceData = extractChoiceFromHistory(history[i].content);
                    if (choiceData && choiceData.options.length > 0) {
                        // 转换为 Message 格式并设置
                        const choiceMessage: Message = {
                            id: Date.now(),
                            type: 'choice',
                            message: choiceData.title
                                ? (choiceData.text ? `${choiceData.title}\n${choiceData.text}` : choiceData.title)
                                : (choiceData.text || '请选择你的行动'),
                            options: choiceData.options.map((opt, index) => ({
                                id: index + 1,
                                text: opt,
                            })),
                            characterImage: worldSetting?.player?.images
                                ? (worldSetting.player.images.startsWith('http')
                                    ? worldSetting.player.images
                                    : `${HOST_ADDRESS}${worldSetting.player.images}`)
                                : undefined,
                            characterPosition: 'right',
                        };
                        setInitialMessages([choiceMessage]);
                        break;
                    }
                }
            }
        }
    }, [historyLoading, presetData, history, showStoryIntro, worldSetting]);

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

    useEffect(() => {
        if (!isAutoPlay || !gameStarted) return;
        if (stepHandlers.isWaitingForData) return;
        if (finalIsTyping) return;
        if (!stepHandlers.showNextButton) return;
        if (currentMessage?.type === 'choice') {
            setIsAutoPlay(false);
            return;
        }

        const autoPlayTimer = setTimeout(() => {
            if (isAutoPlay && !finalIsTyping && stepHandlers.showNextButton && currentMessage?.type !== 'choice' && !stepHandlers.isWaitingForData) {
                handleNextMessage();
            }
        }, 600);

        return () => {
            clearTimeout(autoPlayTimer);
        };
    }, [isAutoPlay, finalIsTyping, stepHandlers.showNextButton, stepHandlers.isWaitingForData, currentMessage?.type, gameStarted, handleNextMessage]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!stepHandlers.currentStep || stepHandlers.currentStep.type !== 'choice') {
            return;
        }

        const optionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
            const optText = typeof opt === 'string' ? opt : (opt.text || opt);
            return optText === option.text;
        }) ?? -1;

        if (optionIndex >= 0) {
            const optionObj = stepHandlers.currentStep.options[optionIndex];
            const optionData = typeof optionObj === 'string'
                ? { text: optionObj, nextId: '' }
                : optionObj;

            stepHandlers.handleChoiceOption(optionData, optionIndex);
        }
    }, [stepHandlers]);

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
                        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                    }}
                >
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
                    <div className={styles.topHeader}>
                    <CiLocationOn />
                        <span>{currentScene?.name}</span>
                </div>
                    {currentMessage.characterImage && (
                        <div className={getCharacterContainerClassName()}>
                            <img
                                src={currentMessage.characterImage}
                                alt="角色立绘"
                                className={styles.characterImage}
                            />
                            </div>
                    )}
                    <div className={styles.gameContentWrapper}>
                        {!showGalgameHistory &&
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
                        }
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
                            <div className={styles.buttonItem}>
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
                    />
                </div>
            </div>
        </>
    );
};

export default Galgame;