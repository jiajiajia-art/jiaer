import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './StoryModal.module.css';
import { HOST_ADDRESS, RECORD_CONVERSION } from '../../config';
import { useGameStore, type EquipmentSlots } from '../../store/gameStore';
import type { PlayerData, Inventory, InventoryItem } from '../../api/game/gameData.type';
import { authFetch } from '../../api/base';
import statisticsApi from '../../api/statistics/statisticsApi';
import type { SubmitMissionResponse } from '../../api/game/missionApi.type';
import { useAuthStore } from '../../store/useAuthStore';
import MissionSubmitModal from './MissionSubmitModal';
import StepModal from './StepModal';
import LeftPanels from './LeftPanels';
import RightPanels from './RightPanels';
import MobilePanels from './MobilePanels';
import toast from 'react-hot-toast';
import { useStoryHistory } from '../../hooks/storyModal/useStoryHistory';
import { useStoryMissions } from '../../hooks/storyModal/useStoryMissions';
import { useStoryStep } from '../../hooks/storyModal/useStoryStep';
import { useStoryTyping } from '../../hooks/storyModal/useStoryTyping';
import { useMobilePanels } from '../../hooks/storyModal/useMobilePanels';
import { useStepStreamResponse } from '../../hooks/storyModal/useStepStreamResponse';

interface StoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    player?: PlayerData | null;
    inventory?: Inventory | null;
    onEquipItem?: (item: InventoryItem, slot: keyof EquipmentSlots) => void;
    onUseItem?: (item: InventoryItem) => void;
}


const StoryModal: React.FC<StoryModalProps> = ({
    isOpen,
    onClose,
    player = null,
    inventory = null,
    onEquipItem,
    onUseItem
}) => {
    // 基础状态
    const [gameStarted, setGameStarted] = useState(false);
    const [messages, setMessages] = useState<Array<{
        type: 'system' | 'user';
        text: string;
        isTyping?: boolean;
        isMarkdown?: boolean;
        actions?: string[];
        options?: string[];
    }>>([]);
    const [choiceInput, setChoiceInput] = useState<string>('');

    // Refs
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const savedChoiceStepRef = useRef<any>(null);

    // Store hooks
    const sessionId = useGameStore((state) => state.sessionId);
    const pdfFileId = useGameStore((state) => state.pdfFileId);
    const scenes = useGameStore((state) => state.scenes);
    const { user } = useAuthStore();

    // 使用自定义 hooks
    const {
        missionData,
        loadingMissions,
        showMissionAlert,
        setShowMissionAlert,
        loadMissions
    } = useStoryMissions(sessionId);

    // 使用 ref 存储函数引用，避免循环依赖
    const loadHistoryMessagesRef = useRef<(() => Promise<void>) | null>(null);
    const loadMissionsRef = useRef<(() => Promise<void>) | null>(null);

    const stepHandlers = useStoryStep({
        sessionId,
        onHistoryRefresh: () => loadHistoryMessagesRef.current?.(),
        onMissionsRefresh: () => loadMissionsRef.current?.(),
        onMessagesClear: () => setMessages([])
    });

    // 使用 useCallback 包装回调函数，避免依赖项变化导致无限循环
    const handleGameStarted = useCallback(() => {
        setGameStarted(true);
    }, []);

    const handleChoiceDetected = useCallback((choiceStep: any) => {
        stepHandlers.setCurrentStep(choiceStep);
        stepHandlers.setShowNextButton(false);
        savedChoiceStepRef.current = choiceStep;
    }, [stepHandlers]);

    const handleMessageLoaded = useCallback((message: any) => {
        setMessages([message]);
    }, []);

    const {
        historyMessages,
        loadingHistory,
        loadHistoryMessages,
        resetInitialLoad
    } = useStoryHistory({
        sessionId,
        missionData,
        onGameStarted: handleGameStarted,
        onChoiceDetected: handleChoiceDetected,
        onMessageLoaded: handleMessageLoaded
    });

    // 更新 ref 引用
    useEffect(() => {
        loadHistoryMessagesRef.current = loadHistoryMessages;
        loadMissionsRef.current = loadMissions;
    }, [loadHistoryMessages, loadMissions]);

    const {
        showHistory,
        missionModalOpen,
        inventoryOpen,
        playerOpen,
        toggleHistory,
        toggleMission,
        toggleInventory,
        togglePlayer,
        closeHistory,
        closeMission,
        closeInventory,
        closePlayer
    } = useMobilePanels();

    const { displayedText, isTyping } = useStoryTyping({
        text: stepHandlers.currentStep?.text || '',
        enabled: stepHandlers.currentStep?.type !== 'choice' && !!stepHandlers.currentStep,
        speed: 60
    });

    const isDialogueOrNarrationStep =
        stepHandlers.currentStep &&
        (stepHandlers.currentStep.type === 'dialogue' || stepHandlers.currentStep.type === 'narration');

    const shouldShowStepModal =
        (stepHandlers.currentStep &&
            stepHandlers.currentStep.type !== 'dialogue' &&
            stepHandlers.currentStep.type !== 'narration');

    // 计算最新的 system 消息（用于滚动效果）
    const systemMessages = useMemo(() =>
        messages.filter(m => m.type === 'system'),
        [messages]
    );
    const latestSystemMessage = useMemo(() =>
        systemMessages.length > 0 ? systemMessages[systemMessages.length - 1] : null,
        [systemMessages]
    );

    // 根据 characterId 查找对应的 NPC 信息
    const currentNPC = useMemo(() => {
        if (!stepHandlers.currentStep || stepHandlers.currentStep.type !== 'dialogue' || !stepHandlers.currentStep.characterId) {
            return null;
        }

        const characterId = stepHandlers.currentStep.characterId;
        if (!scenes || Object.keys(scenes).length === 0) {
            return null;
        }

        for (const sceneId in scenes) {
            const scene = scenes[sceneId];
            if (scene && scene.npcs && Array.isArray(scene.npcs)) {
                let npc = scene.npcs.find(n => n.name === characterId);
                if (!npc) {
                    const normalizedCharacterId = characterId.trim().toLowerCase();
                    npc = scene.npcs.find(n => n.id.trim().toLowerCase() === normalizedCharacterId);
                }
                if (npc) {
                    return npc;
                }
            }
        }
        return null;
    }, [stepHandlers.currentStep, scenes]);

    useEffect(() => {
        if (latestSystemMessage && messagesEndRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [latestSystemMessage]);

    // 初始化加载
    useEffect(() => {
        if (isOpen && sessionId) {
            loadMissions().then(() => {
                loadHistoryMessages(true);
            });
        }
        if (!isOpen) {
            resetInitialLoad();
        }
    }, [isOpen, sessionId, loadMissions, loadHistoryMessages, resetInitialLoad]);

    useEffect(() => {
        if (showHistory && sessionId) {
            loadHistoryMessages(false);
        }
    }, [showHistory, sessionId, loadHistoryMessages]);

    // 恢复保存的 choice step
    useEffect(() => {
        if (isOpen && savedChoiceStepRef.current && !stepHandlers.currentStep) {
            const hasActiveMissions = missionData?.activeMissions && missionData.activeMissions.length > 0;
            if (!hasActiveMissions) {
                stepHandlers.setCurrentStep(savedChoiceStepRef.current);
                stepHandlers.setShowNextButton(false);
            } else {
                savedChoiceStepRef.current = null;
            }
        }
    }, [isOpen, missionData, stepHandlers]);

    // 使用 Step 流式响应处理 Hook（用于任务提交）
    const stepQueueRef = useRef<any[]>([]);
    const selectedOptionIndexRef = useRef<number | null>(null);
    
    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue: (updater: any) => {
            if (typeof updater === 'function') {
                stepQueueRef.current = updater(stepQueueRef.current);
            } else {
                stepQueueRef.current = updater;
            }
        },
        setSelectedOptionIndex: (value: any) => {
            selectedOptionIndexRef.current = typeof value === 'function' ? value(selectedOptionIndexRef.current) : value;
        },
        setIsWaitingForData: () => {
            // 这个会在useStoryStep内部处理
        },
        currentRequestId: stepHandlers.currentRequestId,
    });

    // 处理任务提交
    const handleSubmitMission = useCallback(async (missionId: string) => {
        if (!sessionId) {
            toast.error('没有 sessionId，无法提交任务');
            return;
        }

        try {
            const response = await authFetch(
                `${HOST_ADDRESS}/api/backend/game/session/${sessionId}/missions/${missionId}/submit`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                }
            );
            const contentType = response.headers.get('content-type');

            if (contentType?.includes('text/event-stream')) {
                console.log('流式响应');
                const requestId = ++stepHandlers.currentRequestId.current;

                stepHandlers.setCurrentStep(null);
                stepHandlers.setShowNextButton(false);
                setMessages([]);

                await processStreamResponse(response, requestId, {
                    onFirstStep: () => {
                        console.log('📝 收到第一个 step，关闭任务提示弹窗');
                        setShowMissionAlert(false);
                    },
                    onSuccess: async () => {
                        await loadHistoryMessages();
                    },
                    onError: (error) => {
                        console.error('❌ 任务提交流式处理错误:', error);
                        toast.error(error || '任务提交失败');
                    }
                });
            } else {
                // 普通 JSON 响应（成功）
                try {
                    const data: SubmitMissionResponse = await response.json();
                    if (data.completed) {
                        console.log('✅ 任务提交成功');
                        toast.success(data.message || '任务提交成功');
                        await loadMissions();
                    } else {
                        console.log('❌ 任务提交失败:', data.message);
                        toast.error(data.message || '任务提交失败');
                    }
                } catch (jsonError) {
                    console.error('❌ 解析响应失败:', jsonError);
                    toast.error('任务提交响应格式错误');
                }
            }
        } catch (error) {
            console.error('❌ 任务提交错误:', error);
            toast.error('任务提交失败，请稍后重试');
        }
    }, [sessionId, processStreamResponse, loadMissions, loadHistoryMessages, setShowMissionAlert, stepHandlers]);

    const handleStartGame = async () => {
        if (pdfFileId && RECORD_CONVERSION) {
            statisticsApi.addConversion({
                fileId: pdfFileId,
                userId: String(user?.user.id)
            }).catch((error) => {
                console.error('记录游戏统计失败:', error);
            });
        }
        setGameStarted(true);

        await stepHandlers.handleStreamAction('开始游戏', {
            onBeforeRequest: () => {
                setMessages([]);
            },
            shouldSetGameStarted: true,
            onError: (error) => {
                setGameStarted(false);
                setMessages((prev) => [
                    ...prev,
                    { type: 'system', text: error || '游戏开始失败，请重试...' }
                ]);
            }
        });
    };

    const handleChoiceSend = useCallback(() => {
        const inputText = choiceInput.trim();
        if (!inputText) {
            return;
        }
        setChoiceInput('');
        stepHandlers.handleChoiceSend(inputText);
    }, [choiceInput, stepHandlers]);

    const handleOptionClick = useCallback((option: string) => {
        stepHandlers.handleStreamAction(option, {
            onSuccess: () => {
                loadHistoryMessages();
            },
            onError: (error) => {
                console.error('❌ 选项处理错误:', error);
            }
        });
    }, [stepHandlers, loadHistoryMessages]);

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <button
                    className={`${styles.closeBtn} 
                    ${(stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') || showMissionAlert || !gameStarted ? styles.closeBtnElevated : ''}`}
                    onClick={() => {
                        if (stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') {
                            savedChoiceStepRef.current = stepHandlers.currentStep;
                        }
                        onClose();
                    }}
                >
                    <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/时间暂停按钮.png`} alt="关闭" />
                </button>

                <LeftPanels
                    showHistory={showHistory}
                    historyMessages={historyMessages}
                    loadingHistory={loadingHistory}
                    missionModalOpen={missionModalOpen}
                    missionData={missionData}
                    loadingMissions={loadingMissions}
                    onCloseMission={closeMission}
                />

                {/* 中间：编年纪事对话 - 只显示最新一条 AI 回复 */}
                <div className={styles.dialogueCenterWrapper}>
                    <div className={styles.npcAvatarContainer}>
                        {currentNPC ? (
                            <img
                                src={currentNPC.icon || player?.profile?.avatar}
                                alt={currentNPC.name || stepHandlers.currentStep?.characterId}
                                className={styles.npcAvatar}
                                onError={(e) => {
                                    console.error('❌ NPC 头像加载失败:', currentNPC.icon);
                                    (e.target as HTMLImageElement).src = player?.profile?.avatar || '';
                                }}
                            />
                        ) : (
                            <img
                                src={player?.profile?.avatar || ''}
                                alt='角色'
                                className={styles.npcAvatar}
                            />
                        )}
                    </div>
                    <div className={styles.dialogueWrapper}>
                        <div className={styles.dialogueModalWrapper}>
                            <div className={styles.dialogueModal}>
                                <div className={styles.modalHeader}>
                                    <button
                                        className={styles.historyBtn}
                                        onClick={toggleHistory}
                                    >
                                        <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/历史对话图标.png`} alt="历史记录" />
                                    </button>

                                    <div className={styles.rightButtons}>
                                        <button
                                            id="triggerMissionBtn"
                                            className={styles.missionBtn}
                                            onClick={() => {
                                                loadMissions();
                                                toggleMission();
                                            }}
                                        >
                                            <img src={`${import.meta.env.BASE_URL}data/asset/mission.png`} alt="任务按钮" className={styles.missionBtnImg} />
                                        </button>

                                        <button
                                            id="toggleInventoryBtn"
                                            className={styles.floatingInventoryBtn}
                                            title="打开背包"
                                            onClick={toggleInventory}
                                        >
                                            <img
                                                src={`${import.meta.env.BASE_URL}data/asset/背包按钮.png`}
                                                alt="背包按钮"
                                                className={styles.inventoryBtnImg}
                                            />
                                        </button>
                                        <img
                                            src={player?.profile?.avatar || `${import.meta.env.BASE_URL}data/avatars/hunter.png`}
                                            alt="玩家头像"
                                            className={styles.headerSpacer}
                                            onClick={togglePlayer}
                                        />
                                    </div>
                                </div>

                                <div className={styles.messagesContainer}>
                                    <div className={styles.messageContent}>
                                        {stepHandlers.isWaitingForData && !stepHandlers.currentStep ? (
                                            <div className={`${styles.message} ${styles.system}`}>
                                                <div className={styles.dialogueContent}>
                                                    <p>
                                                        <span className={styles.cursor}></span>
                                                    </p>
                                                </div>
                                            </div>
                                        ) : isDialogueOrNarrationStep ? (
                                            <div className={`${styles.message} ${styles.system}`}>
                                                <div className={styles.dialogueContent}>
                                                    {(currentNPC?.name || stepHandlers.currentStep.characterId) && (
                                                        <strong>{currentNPC?.name || stepHandlers.currentStep.characterId}:</strong>
                                                    )}
                                                    <p>
                                                        {displayedText}
                                                        {isTyping && <span className={styles.cursor}></span>}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            !stepHandlers.isWaitingForData && !stepHandlers.currentStep && messages.length > 0 && messages.map((msg, index) => (
                                                <div key={index} className={`${styles.message} ${styles.system}`}>
                                                    {msg.isMarkdown ? (
                                                        <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                                                    ) : (
                                                        <p>{msg.text}</p>
                                                    )}
                                                    {msg.options && msg.options.length > 0 && (
                                                        <div className={styles.historyOptions}>
                                                            {msg.options.map((option, optIndex) => (
                                                                <button
                                                                    key={optIndex}
                                                                    className={styles.historyOptionBtn}
                                                                    onClick={() => handleOptionClick(option)}
                                                                    disabled={stepHandlers.loading}
                                                                >
                                                                    {option}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                {!gameStarted && (
                                    <div className={styles.startGameContainer}>
                                        <button
                                            className={styles.startGameBtn}
                                            onClick={handleStartGame}
                                            disabled={stepHandlers.loading}
                                        >
                                            <img src={`${import.meta.env.BASE_URL}data/asset/编年史/按钮.png`} alt="开始游戏" />
                                        </button>
                                    </div>
                                )}

                                {gameStarted && stepHandlers.showNextButton && stepHandlers.currentStep && stepHandlers.currentStep.type !== 'choice' && (
                                    <div className={styles.nextStepContainer}>
                                        <button
                                            className={styles.nextStepBtn}
                                            onClick={stepHandlers.handleNextStep}
                                            disabled={isTyping}
                                        >
                                            继续
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <RightPanels
                    playerOpen={playerOpen}
                    inventoryOpen={inventoryOpen}
                    player={player}
                    inventory={inventory}
                    onEquipItem={onEquipItem}
                    onUseItem={onUseItem}
                />

                <MobilePanels
                    showHistory={showHistory}
                    historyMessages={historyMessages}
                    loadingHistory={loadingHistory}
                    missionModalOpen={missionModalOpen}
                    missionData={missionData}
                    loadingMissions={loadingMissions}
                    inventoryOpen={inventoryOpen}
                    playerOpen={playerOpen}
                    inventory={inventory}
                    player={player}
                    onCloseHistory={closeHistory}
                    onCloseMission={closeMission}
                    onCloseInventory={closeInventory}
                    onClosePlayer={closePlayer}
                    onEquipItem={onEquipItem}
                    onUseItem={onUseItem}
                />

                {shouldShowStepModal && (
                    <StepModal
                        currentStep={stepHandlers.currentStep}
                        isWaitingForData={stepHandlers.isWaitingForData}
                        displayedText={displayedText}
                        isTyping={isTyping}
                        showNextButton={stepHandlers.showNextButton}
                        selectedOptionIndex={stepHandlers.selectedOptionIndex}
                        choiceInput={choiceInput}
                        onChoiceOption={stepHandlers.handleChoiceOption}
                        onChoiceSend={handleChoiceSend}
                        onChoiceInputChange={setChoiceInput}
                        onNextStep={stepHandlers.handleNextStep}
                    />
                )}

                {/* 任务提示弹窗 */}
                {showMissionAlert && missionData && (
                    <MissionSubmitModal
                        missionData={missionData}
                        onClose={() => setShowMissionAlert(false)}
                        onSubmitMission={handleSubmitMission}
                    />
                )}

            </div>
        </div>
    );
};

export default StoryModal;