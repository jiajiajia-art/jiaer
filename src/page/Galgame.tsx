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
import toast from "react-hot-toast";

type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change';

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

    const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
    const [currentMusicUrl, setCurrentMusicUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentSceneIdRef = useRef<string | null>(null);
    const isLoadingMusicRef = useRef<boolean>(false);

    const [presetData, setPresetData] = useState<GetGalgamePresetResponse | null>(null);

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
        } else if (step.type === 'dialogue') {
            const characterName = step.npcName || step.npcId || '未知角色';
            let characterImage: string | undefined;

            if (step.npcImages?.activeImage) {
                characterImage = step.npcImages.activeImage.startsWith('http')
                    ? step.npcImages.activeImage
                    : `${HOST_ADDRESS}${step.npcImages.activeImage}`;
            }

            return {
                id: Date.now(),
                type: 'dialogue',
                message: step.content || '',
                characterName,
                characterImage,
                characterPosition: 'left',
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

    const plainTextForTyping = useMemo(() => {
        if (currentMessage && (currentMessage.type === 'narration' || currentMessage.type === 'dialogue' || currentMessage.type === 'scene_change')) {
            return currentMessage.message.replace(/<(red|yellow|green|blue|purple)>(.*?)<\/\1>/gi, '$2');
        }
        return '';
    }, [currentMessage]);

    const { displayedText, isTyping } = useStoryTyping({
        text: plainTextForTyping,
        enabled: currentMessage && (currentMessage.type === 'narration' || currentMessage.type === 'dialogue' || currentMessage.type === 'scene_change') && gameStarted && !!plainTextForTyping,
        speed: 60
    });

    const finalDisplayText = stepHandlers.isWaitingForData && !stepHandlers.currentStep
        ? ''
        : (gameStarted ? displayedText : (currentMessage && (currentMessage.type === 'narration' || currentMessage.type === 'dialogue' || currentMessage.type === 'scene_change') ? currentMessage.message : ''));

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
        setShowStoryIntro(false);
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

    const loadAndPlaySceneMusic = useCallback(async (scene?: GetGalgamePresetResponse['sceneSetting']['scenes'][0] | null) => {
        if (!presetId) return;

        const targetScene = scene ?? currentScene;
        const sceneId = targetScene?.id;
        const soundtrack = targetScene?.soundtrack;

        if (!sceneId || !soundtrack) {
            console.log('sceneId或soundtrack为空');

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            setCurrentMusicUrl(null);
            setIsMusicPlaying(false);
            isLoadingMusicRef.current = false;
            currentSceneIdRef.current = null;
            return;
        }

        if (currentSceneIdRef.current === sceneId && currentMusicUrl) {
            return;
        }

        if (isLoadingMusicRef.current) {
            return;
        }

        isLoadingMusicRef.current = true;
        currentSceneIdRef.current = sceneId;

        try {
            const response = await getGalgamePresetApi.getMusic(presetId, soundtrack);

            if (!response.data || !(response.data instanceof Blob)) {
                console.warn('无法获取音乐数据');
                isLoadingMusicRef.current = false;
                currentSceneIdRef.current = null;
                return;
            }

            const musicUrl = URL.createObjectURL(response.data);

            if (audioRef.current) {
                audioRef.current.pause();
                if (currentMusicUrl && currentMusicUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentMusicUrl);
                }
                audioRef.current.src = '';
            }

            const audio = new Audio(musicUrl);
            audio.loop = true;
            audio.volume = 0.5;

            const handleCanPlay = () => {
                isLoadingMusicRef.current = false;
                if (isMusicPlaying && audioRef.current === audio) {
                    audio.play().catch((error: any) => {
                        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
                            console.error('播放音乐失败:', error);
                        }
                    });
                }
            };

            const handleError = () => {
                console.error('音乐加载失败');
                setIsMusicPlaying(false);
                if (currentMusicUrl && currentMusicUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentMusicUrl);
                }
                setCurrentMusicUrl(null);
                isLoadingMusicRef.current = false;
                currentSceneIdRef.current = null;
                if (audioRef.current === audio) {
                    audioRef.current = null;
                }
            };

            audio.addEventListener('canplay', handleCanPlay, { once: true });
            audio.addEventListener('error', handleError, { once: true });

            audioRef.current = audio;
            setCurrentMusicUrl(musicUrl);

            audio.load();
            setIsMusicPlaying(true);
            audio.play().catch((error: any) => {
                if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
                    console.error('播放音乐失败:', error);
                }
                isLoadingMusicRef.current = false;
            });
        } catch (error) {
            console.error('获取音乐失败:', error);
            isLoadingMusicRef.current = false;
            currentSceneIdRef.current = null;
        }
    }, [presetId, currentScene]);

    const handleMusicToggle = useCallback(() => {
        if (isMusicPlaying) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsMusicPlaying(false);
        } else {
            if (audioRef.current && currentMusicUrl) {
                audioRef.current.play().catch((error: any) => {
                    console.error('播放音乐失败:', error);
                });
            } else if (currentScene) {
                loadAndPlaySceneMusic();
            }
            setIsMusicPlaying(true);
        }
    }, [isMusicPlaying, currentMusicUrl, currentScene, loadAndPlaySceneMusic]);

    useEffect(() => {
        if (!gameStarted || !currentScene?.id || !currentScene?.soundtrack) {
            console.log('currentScene没有音乐数据');

            return;
        }

        const sceneId = currentScene.id;
        if (currentSceneIdRef.current === sceneId) {
            return;
        }

        loadAndPlaySceneMusic(currentScene);
    }, [currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic]);

    useEffect(() => {
        if (!audioRef.current || !currentMusicUrl) return;

        if (isMusicPlaying) {
            audioRef.current.play().catch((error: any) => {
                if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
                    console.error('播放音乐失败:', error);
                }
            });
        } else {
            audioRef.current.pause();
        }
    }, [isMusicPlaying, currentMusicUrl]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
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
            <StoryIntroModal
                isOpen={showStoryIntro}
                presetData={presetData}
                onStartGame={handleStartGame}
                isLoading={isStartingGame}
            />
            <div className={styles.pageRoot}>
                <div
                    className={styles.mainContent}
                    style={{
                        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                    }}
                >
                    <div className={styles.topHeader}>
                        <CiLocationOn />
                        <span>{currentScene?.name}</span>
                    </div>
                    {currentMessage.characterImage && (
                        <div
                            className={`${styles.characterContainer} ${currentMessage.characterPosition === 'left'
                                ? styles.characterSlideLeft
                                : styles.characterSlideRight
                                }`}
                        >
                            <img
                                src={currentMessage.characterImage}
                                alt="角色立绘"
                                className={styles.characterImage}
                            />
                        </div>
                    )}
                    <div className={styles.gameContentWrapper}>
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
                        <div className={styles.buttonContainer}>
                            <div className={styles.buttonItem}>
                                <div className={styles.buttonInner}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="积分" />
                                    <span>{user?.user?.points}</span>
                                </div>
                            </div>
                            <div className={styles.buttonItem}>
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
                </div>
            </div>
        </>
    );
};

export default Galgame;