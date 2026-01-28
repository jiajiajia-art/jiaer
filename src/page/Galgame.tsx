import { CiLocationOn } from "react-icons/ci";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/gameStore";
import { PiMusicNoteDuotone } from "react-icons/pi";
import { BiHistory } from "react-icons/bi";
import { LuFileText } from "react-icons/lu";
import { MdOutlineAutoStories } from "react-icons/md";
import StoryIntroModal from "../components/Galgame/StoryIntroModal";
import NormalModeDisplay from "../components/Galgame/NormalModeDisplay";
import { useCharacterAnimation } from "../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../hooks/galgame/useCharacterContainerClassName";
import { useMusicPlayer } from "../hooks/mapGalgame/useMusicPlayer";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
import TextModeDisplay from "../components/Galgame/TextModeDisplay";
import ErrorModal from "../components/GalgameMap/Modal/WorldModal";
import { IoMdCloseCircle } from "react-icons/io";
import { useGalgameController } from "../hooks/galgame/useGalgameController";
import toast from "react-hot-toast";
import FullPageLoading from "../components/Skeleton/FullPageLoading";

const Galgame = () => {
    const { user } = useAuthStore();
    const { fileId } = useGameStore();
    
    // 使用统一的控制器 hook
    const controller = useGalgameController();

    // 处理历史按钮点击
    const handleHistoryClick = () => {
        controller.refreshHistory();
        controller.setShowGalgameHistory(true);
    };

    // 处理文本模式切换
    const handleTextModeToggle = () => {
        const newTextMode = !controller.isTextMode;
        controller.setIsTextMode(newTextMode);
    };

    // 处理重新生成
    const handleRegenerate = (messageIndex: number) => {
        controller.setShowGalgameHistory(false);
        controller.resetDisplayedSteps();
        controller.stepHandlers.handleRegenerate(messageIndex, {
            onError: (error) => {
                toast.error(error || '重新生成失败，请检查网络连接');
            }
        });
    };

    // UI 相关的 hooks
    const characterAnimation = useCharacterAnimation({
        message: controller.currentMessage?.message,
        messageType: controller.currentMessage?.type,
    });

    const getCharacterContainerClassName = useCharacterContainerClassName({
        characterPosition: controller.currentMessage?.characterPosition,
        characterAnimation,
        styles,
    });

    const { isMusicPlaying, handleMusicToggle } = useMusicPlayer({
        presetId: fileId || '',
        currentScene: controller.currentScene,
        gameStarted: controller.gameStarted,
        isLoading: controller.isLoading,
    });


    const renderErrorModal = (
        visible: boolean,
        title: string,
        message: string,
        options: {
            confirmText: string;
            cancelText?: string;
            primaryType?: "confirm" | "cancel";
            onConfirm: () => void;
            onCancel?: () => void;
        }
    ) => (
        <ErrorModal
            visible={visible}
            title={title}
            message={message}
            confirmText={options.confirmText}
            cancelText={options.cancelText}
            primaryType={options.primaryType}
            onConfirm={options.onConfirm}
            onCancel={options.onCancel}
        />
    );

    if (controller.isLoading) {
        return (
            <FullPageLoading
                rootClassName={styles.pageRoot}
                contentClassName={styles.mainContent}
            />
        );
    }

    return (
        <>
            <div className={styles.pageRoot}>
                <div
                    className={`${styles.mainContent} ${characterAnimation === 'injury' ? styles.worldInjury : ''}`}
                    style={{
                        backgroundImage: controller.isTextMode ? 'none' : controller.backgroundImage ? `url(${controller.backgroundImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: controller.isTextMode ? '#000' : 'transparent'
                    }}
                >
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
                    {/* Custom UI Host container (Shadow DOM will mount here) */}
                    <div id="custom-ui-root" className={styles.customUIRoot}></div>
                    <button
                        className={styles.exitButton}
                        onClick={controller.handleExitGame}
                        title="退出游戏"
                    >
                        <IoMdCloseCircle size={24} />
                    </button>
                    <div className={`${styles.topHeader} ${controller.isTextMode ? styles.topHeaderTextMode : ''}`}>
                        <CiLocationOn />
                        <span>{controller.currentScene?.name}</span>
                    </div>
                    {controller.currentMessage.characterImage && !controller.isTextMode && (
                        <div className={getCharacterContainerClassName()}>
                            <img
                                key={controller.currentMessage.characterImage}
                                src={controller.currentMessage.characterImage}
                                alt="角色立绘"
                                className={styles.characterImage}
                            />
                        </div>
                    )}
                    <div className={`${styles.gameContentWrapper} ${controller.isTextMode ? styles.gameContentWrapperTextMode : ''}`}>
                        {!controller.showGalgameHistory && !controller.isTextMode && (
                            <>
                                <NormalModeDisplay
                                    currentMessage={controller.currentMessage}
                                    finalDisplayText={controller.finalDisplayText}
                                    finalIsTyping={controller.finalIsTyping}
                                    stepHandlers={{
                                        isWaitingForData: controller.stepHandlers.isWaitingForData,
                                        currentStep: controller.stepHandlers.currentStep,
                                        showNextButton: controller.stepHandlers.showNextButton,
                                        selectedOptionIndex: controller.stepHandlers.selectedOptionIndex,
                                    }}
                                    isAutoPlay={controller.isAutoPlay}
                                    historyLength={controller.stepHandlers.localHistoryLength ?? 0}
                                    onNextMessage={controller.handleNextMessage}
                                    onChoiceClick={controller.handleChoiceClick}
                                    onCustomInputSubmit={(value) => controller.handleCustomInputSubmit(value)}
                                />
                            </>
                        )}
                        {!controller.showGalgameHistory && controller.isTextMode && (
                            <TextModeDisplay
                                steps={controller.convertStepsToTextModalFormat(controller.allStepsForTextModal)}
                                currentStepIndex={controller.currentStepIndex}
                                currentDisplayText={controller.textModalDisplayText}
                                isTyping={controller.finalIsTyping}
                                isWaitingForData={controller.stepHandlers.isWaitingForData}
                                historyLength={controller.stepHandlers.localHistoryLength ?? 0}
                                onChoiceClick={(option) => {
                                    controller.resetDisplayedSteps();
                                    controller.handleChoiceClick(option);
                                }}
                                onCustomInputSubmit={(value) => {
                                    controller.resetDisplayedSteps();
                                    controller.handleCustomInputSubmit(value);
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
                                onClick={handleHistoryClick}
                            >
                                <div className={styles.buttonInner}>
                                    <BiHistory />
                                    <span>历史</span>
                                </div>
                            </div>
                            <div
                                className={`${styles.buttonItem} ${controller.isTextMode ? styles.buttonItemActive : ''}`}
                                onClick={handleTextModeToggle}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <LuFileText />
                                    <span>文本</span>
                                </div>
                            </div>
                            <div
                                className={`${styles.buttonItem} ${controller.isAutoPlay ? styles.buttonItemActive : ''}`}
                                onClick={controller.handleAutoPlayToggle}
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
                        isOpen={controller.showStoryIntro}
                        presetData={controller.presetData}
                        onStartGame={controller.handleStartGame}
                        isLoading={controller.isStartingGame}
                    />

                    <GalgameHistoryModal
                        isOpen={controller.showGalgameHistory}
                        history={controller.history}
                        onClose={() => controller.setShowGalgameHistory(false)}
                        backgroundImage={controller.backgroundImage}
                        onRegenerate={handleRegenerate}
                        onEditSave={controller.editHistory}
                    />

                    {/* 请求超时弹窗 */}
                    {renderErrorModal(
                        controller.requestTimeoutVisible,
                        "请求超时",
                        "网络波动或服务器繁忙，请刷新重试或稍后再试。",
                        {
                            confirmText: "重试",
                            cancelText: "取消",
                            primaryType: "confirm",
                            onConfirm: async () => {
                                await controller.handleRetryLastRequest();
                            },
                            onCancel: async () => {
                                controller.setRequestTimeoutVisible(false);
                                await controller.refreshHistory();
                                if (typeof window !== "undefined") {
                                    window.location.reload();
                                }
                            },
                        }
                    )}

                    {/* 一般请求错误弹窗 */}
                    {renderErrorModal(
                        controller.errorModalVisible,
                        "请求错误",
                        controller.errorMessage,
                        {
                            confirmText: "重试",
                            cancelText: "取消",
                            primaryType: "confirm",
                            onConfirm: async () => {
                                await controller.handleRetryLastRequest();
                            },
                            onCancel: async () => {
                                controller.setErrorModalVisible(false);
                                await controller.refreshHistory();
                                if (typeof window !== "undefined") {
                                    window.location.reload();
                                }
                            },
                        }
                    )}

                </div>
            </div>
        </>
    );
};

export default Galgame;
