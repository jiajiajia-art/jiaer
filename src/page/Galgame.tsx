import { CiLocationOn } from "react-icons/ci";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { useGameStore } from "../store/gameStore";
import { BiHistory } from "react-icons/bi";
import { LuFileText } from "react-icons/lu";
import { MdOutlineAutoStories } from "react-icons/md";
//import { MdSettings, MdOutlineAssessment } from "react-icons/md";
import { MdSettings } from "react-icons/md";
import { FaRegShareFromSquare } from "react-icons/fa6";
import StoryIntroModal from "../components/Galgame/StoryIntroModal";
import NormalModeDisplay from "../components/Galgame/NormalModeDisplay";
import { useCharacterAnimation } from "../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../hooks/galgame/useCharacterContainerClassName";
import { useMusicPlayer } from "../hooks/mapGalgame/useMusicPlayer";
import GalgameHistoryModal from "../components/Galgame/GalgameHistoryModal";
import TextModeDisplay from "../components/Galgame/TextModeDisplay";
import SettingsModal from "../components/Galgame/SettingsModal";
import ErrorModal from "../components/GalgameMap/Modal/WorldModal";
import { useGalgameController } from "../hooks/galgame/useGalgameController";
import toast from "react-hot-toast";
import FullPageLoading from "../components/Skeleton/FullPageLoading";
import { useState, useEffect } from "react";
import GameBackgroundRenderer from "../components/Galgame/GameBackgroundRenderer";
import GameImageRenderer from "../components/Galgame/GameImageRenderer";
import { useNavigate } from "react-router-dom";
import GameAction from "../api/rpgGame/gameAction";
import ShareReplayModal from "../components/Galgame/ShareReplayModal";
import replayModalStyles from "../components/Galgame/ShareReplayModal.module.css";
import replayApi from "../api/galgame/replay";
// import ServerAttributesPanel from "../components/Galgame/ServerAttributesPanel";
import betaWhitelistApi from "../api/galgame/betaWhitelist";
import GameConfirmModal from "../components/Galgame/GameConfirmModal";
import { useGameDurationTracking } from "../hooks/useGameDurationTracking";
import { logVisualButtonClick } from "../api/statistics/scriptButtonEvent";

const Galgame = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { fileId, sessionId, galgameBetaAttributes, setGalgameBetaAttributes } = useGameStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    // const [isAttributesOpen, setIsAttributesOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    // 自动追踪游戏时长（监听页面可见性变化和页面卸载）
    useGameDurationTracking(fileId || undefined);

    // 使用统一的控制器 hook
    const controller = useGalgameController();
    
    // 刷新/直进页面时的兜底：如果未检测过白名单，则尝试拉取一次
    useEffect(() => {
        const run = async () => {
            try {
                if (!fileId) return;
                if (galgameBetaAttributes !== null) return;
                const resp = await betaWhitelistApi.get(fileId);
                const enabled = !!resp.data?.whitelisted;
                setGalgameBetaAttributes(enabled);
            } catch {
                setGalgameBetaAttributes(false);
            }
        };
        run();
    }, [fileId, galgameBetaAttributes, setGalgameBetaAttributes]);

    // 处理历史按钮点击（切换显示/隐藏）
    const handleHistoryClick = () => {
        logVisualButtonClick('history');
        if (controller.showGalgameHistory) {
            controller.setShowGalgameHistory(false);
        } else {
            controller.refreshHistory();
            controller.setShowGalgameHistory(true);
        }
    };

    // 处理文本模式切换
    const handleTextModeToggle = () => {
        logVisualButtonClick('text');
        // 如果历史弹窗打开，先关闭它
        if (controller.showGalgameHistory) {
            controller.setShowGalgameHistory(false);
        }
        const newTextMode = !controller.isTextMode;
        controller.setIsTextMode(newTextMode);
    };

    // 处理重新生成
    const handleRegenerate = (messageIndex: number) => {
        logVisualButtonClick('history_regenerate');
        controller.setShowGalgameHistory(false);
        controller.resetDisplayedSteps();
        controller.stepHandlers.handleRegenerate(messageIndex, {
            onError: (error) => {
                toast.error(error || '重新生成失败，请检查网络连接');
            }
        });
    };

    const characterAnimation = useCharacterAnimation({
        message: controller.currentMessage?.message,
        messageType: controller.currentMessage?.type,
    });

    const getCharacterContainerClassName = useCharacterContainerClassName({
        characterPosition: controller.currentMessage?.characterPosition,
        characterAnimation,
        styles,
    });

    const { isMusicPlaying, handleMusicToggle, volume, setVolume } = useMusicPlayer({
        presetId: fileId || '',
        currentScene: controller.currentScene,
        gameStarted: controller.gameStarted,
        isLoading: controller.isLoading,
    });

    // 退出/删除统一回到上一个页面（或兜底首页）
    const navigateBackSafe = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/home');
        }

    };
    const handleDeleteSessionInGame = async () => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDeleteSession = async () => {
        logVisualButtonClick("settings_restart");
        const userId = user?.user?.id;
        if (!userId || !fileId) {
            toast.error('无法删除存档：缺少用户或游戏信息');
            return;
        }

        try {
            const response = await GameAction.deletGameSession({ fileId });
            if (response.data.success) {
                toast.success('删除成功');
                navigateBackSafe();
            } else {
                toast.error(response.data.message || '删除失败');
            }
        } catch (error) {
            console.error('删除存档失败:', error);
            toast.error('删除失败，请稍后重试');
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };

    const canShareReplay = !controller.isReplay && !!sessionId && !controller.stepHandlers.isWaitingForData;

    const handleShareReplay = async ({ title, description, visibility }: { title: string; description?: string; visibility: 'public' | 'unlisted' | 'private' }) => {
        logVisualButtonClick('share_replay_create');
        if (!sessionId || !fileId) {
            toast.error('未找到会话或游戏信息');
            return;
        }
        try {
            const resp = await replayApi.createFromSession({ sessionId, fileId, title, description, visibility });
            if (resp.data?.success) {
                toast.success('回放已创建，可在“回放列表”查看');
            } else {
                toast.error('创建回放失败');
            }
        } catch (e) {
            toast.error('创建回放失败');
        }
    };

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
                        backgroundColor: controller.isTextMode ? '#000' : 'transparent',
                        position: 'relative',
                    }}
                >
                    {!controller.isTextMode && (
                        <GameBackgroundRenderer
                            src={controller.backgroundImage}
                            className={styles.gameBackground}
                            useCanvas={true}
                            transitionDuration={300}
                        />
                    )}
                    {characterAnimation === 'injury' && (
                        <div className={styles.injuryBloodSplatter}></div>
                    )}
                    <div id="custom-ui-root" className={styles.customUIRoot}></div>
                    <div className={`${styles.topHeader} ${controller.isTextMode ? styles.topHeaderTextMode : ''}`}>
                        <CiLocationOn />
                        <span>{controller.currentScene?.name}</span>
                    </div>
                    {controller.currentMessage.characterImage && !controller.isTextMode && (
                        <div className={getCharacterContainerClassName()}>
                            <GameImageRenderer
                                key={controller.currentMessage.characterImage}
                                src={controller.currentMessage.characterImage}
                                className={styles.characterImage}
                                useCanvas={true}
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
                                    historyLength={controller.history.length}
                                    onNextMessage={controller.handleNextMessage}
                                    onChoiceClick={controller.handleChoiceClick}
                                    onCustomInputSubmit={(value) => controller.handleCustomInputSubmit(value)}
                                    isFreeRound={controller.isFreeRound}
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
                                historyLength={controller.history.length}
                                onChoiceClick={(option) => {
                                    controller.handleChoiceClick(option);
                                }}
                                onCustomInputSubmit={(value) => {
                                    controller.handleCustomInputSubmit(value);
                                }}
                                isFreeRound={controller.isFreeRound}
                            />
                        )}
                    </div>
                    {/* 顶部右侧：属性按钮（内测白名单） */}
                    {/* {galgameBetaAttributes && controller.gameStarted ? (
                        <div className={styles.topButtonsContainer}>
                            <div
                                className={`${styles.buttonItem} ${isAttributesOpen ? styles.buttonItemActive : ''}`}
                                onClick={() => setIsAttributesOpen((p) => !p)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <MdOutlineAssessment />
                                    <span>属性</span>
                                </div>
                            </div>
                        </div>
                    ) : null} */}


                    {/* 按钮栏移到 mainContent 内，与历史弹窗同级，确保显示在弹窗之上 */}
                    <div className={styles.buttonContainer}>
                        <div className={styles.buttonItem}>
                            <div className={styles.buttonInner}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="积分" />
                                <span>{user?.user?.points}</span>
                            </div>
                        </div>
                        {!controller.isReplay && (
                            <div
                                className={`${styles.buttonItem} ${controller.showGalgameHistory ? styles.buttonItemActive : ''}`}
                                onClick={handleHistoryClick}
                            >
                                <div className={styles.buttonInner}>
                                    <BiHistory />
                                    <span>历史</span>
                                </div>
                            </div>
                        )}
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
                            className={`${styles.buttonItem} ${controller.isAutoPlay ? styles.buttonItemActive : ''} ${controller.isTextMode || controller.showGalgameHistory ? styles.buttonItemDisabled : ''}`}
                            onClick={
                                controller.isTextMode || controller.showGalgameHistory
                                    ? undefined
                                    : () => {
                                          logVisualButtonClick("auto");
                                          controller.handleAutoPlayToggle();
                                      }
                            }
                            style={{ cursor: controller.isTextMode || controller.showGalgameHistory ? 'not-allowed' : 'pointer' }}
                        >
                            <div className={styles.buttonInner}>
                                <MdOutlineAutoStories />
                                <span>自动</span>
                            </div>
                        </div>
                        {!controller.isReplay && (
                            <div
                                className={`${styles.buttonItem} ${!canShareReplay ? styles.buttonItemDisabled : ''}`}
                                onClick={
                                    !canShareReplay
                                        ? undefined
                                        : () => {
                                            logVisualButtonClick("share_replay");
                                            setIsShareOpen(true);
                                        }
                                }
                                style={{ cursor: !canShareReplay ? 'not-allowed' : 'pointer' }}
                            >
                                <div className={styles.buttonInner}>
                                    <FaRegShareFromSquare />
                                    <span>分享回放</span>
                                </div>
                            </div>
                        )}
                        <div
                            className={`${styles.buttonItem} ${isSettingsOpen ? styles.buttonItemActive : ''}`}
                            onClick={() => {
                                setIsSettingsOpen(!isSettingsOpen);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.buttonInner}>
                                <MdSettings />
                                <span>设置</span>
                            </div>
                        </div>
                    </div>

                    <StoryIntroModal
                        isOpen={controller.isReplay ? false : controller.showStoryIntro}
                        presetData={controller.presetData}
                        onStartGame={controller.handleStartGame}
                        isLoading={controller.isStartingGame}
                    />

                    <GalgameHistoryModal
                        isOpen={controller.showGalgameHistory}
                        history={controller.history}
                        backgroundImage={controller.backgroundImage}
                        onRegenerate={controller.isReplay ? undefined : handleRegenerate}
                        onEditSave={controller.isReplay ? undefined : controller.editHistory}
                    />

                    {/* 设置弹窗放在 mainContent 内，确保限制在容器内 */}
                        <SettingsModal
                            isOpen={isSettingsOpen}
                            onClose={() => setIsSettingsOpen(false)}
                            onExitGame={navigateBackSafe}
                            onDeleteSession={controller.isReplay ? undefined : handleDeleteSessionInGame}
                            isMusicPlaying={isMusicPlaying}
                            onToggleMusic={() => {
                                logVisualButtonClick("settings_toggle_bgm");
                                handleMusicToggle();
                            }}
                            volume={volume}
                            onVolumeChange={setVolume}
                        />

                    {/* 通用属性面板（服务端KV） */}
                    {/* {galgameBetaAttributes && controller.gameStarted ? (
                        <ServerAttributesPanel
                            isOpen={isAttributesOpen}
                            onClose={() => setIsAttributesOpen(false)}
                        />
                    ) : null} */}

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

                    {/* 分享回放弹窗 */}
                    <ShareReplayModal
                        isOpen={isShareOpen}
                        onClose={() => setIsShareOpen(false)}
                        onSubmit={handleShareReplay}
                        defaultTitle={controller.presetData?.world?.title ? `${controller.presetData.world.title} · 回放` : '我的回放'}
                    />

                    {/* 回放结束提示（退出按钮） */}
                    {controller.isReplay && controller.replayFinished && (
                        <div className={replayModalStyles.endMask}>
                            <div className={replayModalStyles.endCard}>
                                <div className={replayModalStyles.endHeader}>
                                    <div className={replayModalStyles.endTitle}>回放已结束</div>
                                </div>
                                <div className={replayModalStyles.endBody}>感谢观看</div>
                                <div className={replayModalStyles.endFooter}>
                                    <button
                                        className={`${replayModalStyles.btn} ${replayModalStyles.btnSecondary}`}
                                        onClick={controller.handleExitGame}
                                    >退出</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 删除存档确认弹窗（游戏内，保持与 Settings 弹窗相同比例） */}
                    <GameConfirmModal
                        isOpen={isDeleteConfirmOpen}
                        onConfirm={handleConfirmDeleteSession}
                        onCancel={() => setIsDeleteConfirmOpen(false)}
                        title="重新开始"
                        message="确认重新开始该游戏吗？重新开始后无法恢复。"
                        confirmText="确认重新开始"
                        cancelText="取消"
                    />
                </div>
            </div>
        </>
    );
};

export default Galgame;
