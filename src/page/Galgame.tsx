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
import { IoArrowDownCircleOutline } from "react-icons/io5";
import getGalgamePresetApi from "../api/galgame/getGalgamePreset";
import type { GetGalgamePresetResponse } from "../api/galgame/getGalgamePreset.type";
import { HOST_ADDRESS } from "../config";
import StoryIntroModal from "../components/Galgame/StoryIntroModal";
import { useGalgameStep } from "../hooks/galgame/useGalgameStep";
import { useStoryTyping } from "../hooks/story/useStoryTyping";
import toast from "react-hot-toast";

type MessageType = 'dialogue' | 'narration' | 'choice';

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
    const presetId = searchParams.get('presetId') || 'c1c0450b-b086-440d-a477-f31fb71adbde'; // 默认值

    // 游戏数据状态（分类存储，便于直接访问，避免链式访问）
    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [gameTitle, setGameTitle] = useState<string>('Galgame');
    const [sceneName, setSceneName] = useState<string>('Galgame');
    const [worldSetting, setWorldSetting] = useState<GetGalgamePresetResponse['worldSetting'] | null>(null);
    const [npcSetting, setNpcSetting] = useState<GetGalgamePresetResponse['npcSetting'] | null>(null);
    const [sceneSetting, setSceneSetting] = useState<GetGalgamePresetResponse['sceneSetting'] | null>(null);

    // UI 状态
    const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
    const [customInputValue, setCustomInputValue] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [initialMessages, setInitialMessages] = useState<Message[]>([]);
    const [showStoryIntro, setShowStoryIntro] = useState<boolean>(false);
    const [isStartingGame, setIsStartingGame] = useState<boolean>(false);
    const [gameStarted, setGameStarted] = useState<boolean>(false);

    // 保留 presetData 用于 StoryIntroModal
    const [presetData, setPresetData] = useState<GetGalgamePresetResponse | null>(null);

    // 使用流式输出的 hooks
    const stepHandlers = useGalgameStep({
        sessionId,
        onMessagesClear: () => {
            setInitialMessages([]);
        }
    });

    // 将 step 转换为 Message 格式
    const convertStepToMessage = useCallback((step: any): Message | null => {
        if (!step) return null;

        if (step.type === 'narration') {
            return {
                id: Date.now(),
                type: 'narration',
                message: step.content || '',
            };
        } else if (step.type === 'dialogue') {
            // dialogue 类型：使用 npcId, npcName, npcImages, content
            const characterName = step.npcName || step.npcId || '未知角色';
            let characterImage: string | undefined;

            // 优先使用 step 中的 npcImages
            if (step.npcImages?.base) {
                characterImage = step.npcImages.base.startsWith('http')
                    ? step.npcImages.base
                    : `${HOST_ADDRESS}${step.npcImages.base}`;
            } else if (npcSetting?.npcs) {
                const npc = npcSetting.npcs.find(n =>
                    n.id === step.npcId ||
                    n.name === step.npcId
                );
                if (npc && npc.images?.base) {
                    characterImage = npc.images.base.startsWith('http')
                        ? npc.images.base
                        : `${HOST_ADDRESS}${npc.images.base}`;
                }
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
                characterPosition: 'right', // 用户自己的立绘从右侧滑入
            };
        }

        return null;
    }, [npcSetting, worldSetting]);

    // 当前显示的 Message（从 step 转换或使用初始消息）
    const currentMessage = useMemo(() => {
        // 优先使用流式输出的 step
        if (gameStarted && stepHandlers.currentStep) {
            const converted = convertStepToMessage(stepHandlers.currentStep);
            if (converted) return converted;
        }

        // 如果没有 step，使用初始消息
        if (initialMessages.length > 0) {
            return initialMessages[0];
        }

        // 默认返回一个空的 narration 消息，避免渲染错误
        return {
            id: 0,
            type: 'narration' as MessageType,
            message: '',
        };
    }, [gameStarted, stepHandlers.currentStep, convertStepToMessage, initialMessages]);

    // 打字机效果（只在有消息内容时启用）
    const { displayedText, isTyping } = useStoryTyping({
        text: (currentMessage && (currentMessage.type === 'narration' || currentMessage.type === 'dialogue'))
            ? currentMessage.message
            : '',
        enabled: currentMessage && (currentMessage.type === 'narration' || currentMessage.type === 'dialogue') && gameStarted && !!currentMessage.message,
        speed: 60
    });

    void gameTitle;
    void worldSetting;
    void sceneSetting;

    // 初始化：获取游戏数据
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

                    // 分别存储不同类型的数据
                    setWorldSetting(data.worldSetting);
                    setNpcSetting(data.npcSetting || null);
                    setSceneSetting(data.sceneSetting);

                    // 设置游戏标题
                    if (data.worldSetting?.title) {
                        setGameTitle(data.worldSetting.title);
                    }

                    // 设置场景名称和背景图片
                    let sceneImage = '';
                    if (data.sceneSetting?.scenes && data.sceneSetting.scenes.length > 0) {
                        const firstScene = data.sceneSetting.scenes[0];
                        if (firstScene.name) {
                            setSceneName(firstScene.name);
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

                    const initMessages: Message[] = [];

                    if (data.worldSetting?.preamble) {
                        initMessages.push({
                            id: 1,
                            type: 'narration',
                            message: data.worldSetting.preamble,
                        });
                    }

                    if (data.worldSetting?.initialPlot) {
                        initMessages.push({
                            id: initMessages.length + 1,
                            type: 'narration',
                            message: data.worldSetting.initialPlot,
                        });
                    }

                    // 如果没有任何初始消息，使用默认消息
                    if (initMessages.length === 0) {
                        setInitialMessages([]);
                    } else {
                        setInitialMessages(initMessages);
                    }

                    // 显示故事介绍弹窗
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

    // 处理开始游戏
    const handleStartGame = useCallback(async () => {
        if (!sessionId) {
            toast.error('没有 sessionId，无法开始游戏');
            return;
        }

        setIsStartingGame(true);
        setShowStoryIntro(false);
        setGameStarted(true);

        // 清空初始消息，准备接收流式输出
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
        setShowCustomInput(false);
        setCustomInputValue('');
    }, [gameStarted, stepHandlers]);

    const handleChoiceClick = useCallback((option: { id: number; text: string }) => {
        if (!stepHandlers.currentStep || stepHandlers.currentStep.type !== 'choice') {
            return;
        }

        // 找到对应的 option 对象
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

        setShowCustomInput(false);
        setCustomInputValue('');
    }, [stepHandlers]);

    const handleCustomInputClick = () => {
        setShowCustomInput(true);
    };

    const handleCustomInputSubmit = useCallback(() => {
        if (customInputValue.trim()) {
            stepHandlers.handleChoiceSend(customInputValue.trim());
            setCustomInputValue('');
            setShowCustomInput(false);
        }
    }, [customInputValue, stepHandlers]);

    const handleCustomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCustomInputSubmit();
        }
    };

    console.log(worldSetting?.player?.images);
    console.log(`${HOST_ADDRESS}${worldSetting?.player?.images}`);
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
                        <span>{sceneName}</span>
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
                        <div className={styles.messageContainer}>
                            {/* 等待数据时的加载状态 */}
                            {stepHandlers.isWaitingForData && !stepHandlers.currentStep && (
                                <div className={styles.narrationContainer}>
                                    <div className={styles.narrationMessage}>
                                        <span className={styles.cursor}></span>
                                    </div>
                                </div>
                            )}

                            {/* 旁白类型 */}
                            {!stepHandlers.isWaitingForData && currentMessage && currentMessage.type === 'narration' && currentMessage.message && (
                                <div className={styles.narrationContainer}>
                                    <div className={styles.narrationMessage}>
                                        <span>
                                            {gameStarted ? displayedText : currentMessage.message}
                                            {isTyping && <span className={styles.cursor}></span>}
                                        </span>
                                    </div>
                                    {stepHandlers.showNextButton && !isTyping && (
                                        <div className={styles.nextButtonContainer}>
                                            <button
                                                className={styles.nextButton}
                                                onClick={handleNextMessage}
                                                disabled={stepHandlers.isWaitingForData}
                                            >
                                                <IoArrowDownCircleOutline />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* 角色对话类型 */}
                            {!stepHandlers.isWaitingForData && currentMessage && currentMessage.type === 'dialogue' && currentMessage.message && (
                                <>
                                    <div className={styles.characterMessage}>
                                        <div className={styles.characterName}>{currentMessage.characterName}</div>
                                        <div className={styles.characterDivider}></div>
                                        <div className={styles.characterText}>
                                            {gameStarted ? displayedText : currentMessage.message}
                                            {isTyping && <span className={styles.cursor}></span>}
                                        </div>
                                    </div>
                                    {stepHandlers.showNextButton && !isTyping && (
                                        <div className={styles.nextButtonContainer}>
                                            <button
                                                className={styles.nextButton}
                                                onClick={handleNextMessage}
                                                disabled={stepHandlers.isWaitingForData}
                                            >
                                                <IoArrowDownCircleOutline />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            {/* 选择类型 */}
                            {!stepHandlers.isWaitingForData && currentMessage && currentMessage.type === 'choice' && currentMessage.options && (
                                <>
                                    {/* choice 类型也显示立绘（用户自己的头像） */}
                                    {worldSetting?.player?.images && (
                                        <div
                                            className={`${styles.characterContainer} ${currentMessage.characterPosition === 'left'
                                                ? styles.characterSlideLeft
                                                : styles.characterSlideRight
                                                }`}
                                        >
                                            <img
                                                src={`${HOST_ADDRESS}${worldSetting?.player?.images}`}
                                                alt="角色立绘"
                                                className={styles.characterImage}
                                            />
                                        </div>
                                    )}
                                    <div className={styles.choiceContainer}>
                                        {currentMessage.options.map((option) => (
                                            <div
                                                key={option.id}
                                                className={styles.choiceOption}
                                                onClick={() => handleChoiceClick(option)}
                                                style={{
                                                    opacity: stepHandlers.selectedOptionIndex !== null &&
                                                        stepHandlers.selectedOptionIndex !== currentMessage.options?.findIndex((opt: any) => opt.text === option.text)
                                                        ? 0.5
                                                        : 1,
                                                    pointerEvents: stepHandlers.isWaitingForData ? 'none' : 'auto'
                                                }}
                                            >
                                                <span className={styles.choiceText}>{option.text}</span>
                                                <div className={styles.choicePrice}>
                                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                                    <span>2</span>
                                                </div>
                                            </div>
                                        ))}
                                        {!showCustomInput ? (
                                            <div
                                                className={styles.customInputText}
                                                onClick={handleCustomInputClick}
                                                style={{
                                                    pointerEvents: stepHandlers.isWaitingForData ? 'none' : 'auto',
                                                    opacity: stepHandlers.isWaitingForData ? 0.5 : 1
                                                }}
                                            >
                                                <span>自定义输入</span>
                                            </div>
                                        ) : (
                                            <div className={styles.customInput}>
                                                <input
                                                    type="text"
                                                    placeholder="请输入..."
                                                    value={customInputValue}
                                                    onChange={(e) => setCustomInputValue(e.target.value)}
                                                    onKeyDown={handleCustomInputKeyDown}
                                                    disabled={stepHandlers.isWaitingForData}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={handleCustomInputSubmit}
                                                    disabled={stepHandlers.isWaitingForData || !customInputValue.trim()}
                                                >
                                                    <span>发送</span>
                                                    <div className={styles.choicePrice}>
                                                        <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                                        <span>2</span>
                                                    </div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
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
                            <div className={styles.buttonItem}>
                                <div className={styles.buttonInner}>
                                    <MdOutlineAutoStories />
                                    <span>自动</span>
                                </div>
                            </div>
                            <div className={styles.buttonItem}>
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