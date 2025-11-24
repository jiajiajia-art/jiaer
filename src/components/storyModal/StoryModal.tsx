import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './StoryModal.module.css';
import { HOST_ADDRESS, RECORD_CONVERSION } from '../../config';
import { useGameStore, type EquipmentSlots } from '../../store/gameStore';
import type { PlayerData, Inventory, InventoryItem } from '../../api/game/gameData';
import { authFetch } from '../../api/base';
import statisticsApi from '../../api/statistics/statisticsApi';
import MissionApi from '../../api/game/missionApi';
import type { MissionData, SubmitMissionResponse } from '../../api/game/missionApi.type';
import { useAuthStore } from '../../store/useAuthStore';
import type { ChatMessage } from '../Mian/ChatHistory';
import ChatHistory from '../Mian/ChatHistory';
import MissionsModal from '../Mian/MissionsModal';
import PlayerFloatingPanel from '../Mian/PlayerFloatingPanel';
import InventoryFloatingPanel from '../Mian/InventoryFloatingPanel';
import MissionSubmitModal from './MissionSubmitModal';
import toast from 'react-hot-toast';
import { cleanHistoryMessage, extractChoiceFromHistory } from '../../utils/textUtils';
import { useStepStreamResponse } from '../../hooks/useStepStreamResponse';

interface StoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    playerName?: string;
    player?: PlayerData | null;
    inventory?: Inventory | null;
    onEquipItem?: (item: InventoryItem, slot: keyof EquipmentSlots) => void;
    onUseItem?: (item: InventoryItem) => void;
}


const StoryModal: React.FC<StoryModalProps> = ({
    isOpen,
    onClose,
    playerName = '玩家',
    player = null,
    inventory = null,
    onEquipItem,
    onUseItem
}) => {
    // 基础状态
    const [gameStarted, setGameStarted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [missionData, setMissionData] = useState<MissionData | null>(null);
    const [loadingMissions, setLoadingMissions] = useState(false);
    const [showMissionAlert, setShowMissionAlert] = useState(false);
    const [messages, setMessages] = useState<
        Array<{
            type: 'system' | 'user';
            text: string;
            isTyping?: boolean;
            isMarkdown?: boolean;
            actions?: string[];
            options?: string[]; // 从 [OPTION: ...] 提取的选项
        }>
    >([]);

    // Step 相关状态
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

    // 打字机效果相关状态
    const [displayedText, setDisplayedText] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    
    // 输入框状态
    const [choiceInput, setChoiceInput] = useState<string>('');

    // Refs
    const hasLoadedInitialMessage = useRef(false);
    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const typingTimeoutRef = useRef<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const savedChoiceStepRef = useRef<any>(null); // 保存关闭时的 choice step

    // Store hooks
    const sessionId = useGameStore((state) => state.sessionId);
    const pdfFileId = useGameStore((state) => state.pdfFileId);
    const scenes = useGameStore((state) => state.scenes);
    const { user } = useAuthStore();

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
        if (!currentStep || currentStep.type !== 'dialogue' || !currentStep.characterId) {
            return null;
        }

        const characterId = currentStep.characterId;
        
        // 如果 scenes 为空，返回 null
        if (!scenes || Object.keys(scenes).length === 0) {
            return null;
        }

        // 遍历所有场景查找匹配的 NPC
        for (const sceneId in scenes) {
            const scene = scenes[sceneId];
            if (scene && scene.npcs && Array.isArray(scene.npcs)) {
                let npc = scene.npcs.find(n => n.name === characterId);
                
                if (!npc) {
                    const normalizedCharacterId = characterId.trim().toLowerCase();
                    npc = scene.npcs.find(n => n.id.trim().toLowerCase() === normalizedCharacterId);
                }
                
                if (npc) {
                    console.log('✅ 找到匹配的 NPC:', { id: npc.id, name: npc.name, icon: npc.icon });
                    return npc;
                }
            }
        }
        console.log('❌ 未找到匹配的 NPC，characterId:', characterId);
        return null;
    }, [currentStep, scenes]);

    // 当最新的 system 消息变化时自动滚动
    useEffect(() => {
        if (latestSystemMessage && messagesEndRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [latestSystemMessage]);

    // 加载历史记录（从后端获取）
    const loadHistoryMessages = React.useCallback(async (isInitialLoad = false) => {
        if (!sessionId) {
            console.warn('没有 sessionId，无法加载历史记录');
            return;
        }

        try {
            setLoadingHistory(true);
            const response = await authFetch(`${HOST_ADDRESS}/api/backend/history/${sessionId}`);

            if (response.ok) {
                const data = await response.json();
                const historyArray = data.history || [];

                const convertedMessages: ChatMessage[] = historyArray.map((item: {
                    message: string;
                    timestamp: string;
                    type: 'player' | 'game';
                }) => ({
                    role: item.type === 'player' ? 'user' : 'assistant',
                    text: item.message || '',
                    isTyping: false
                }));

                setHistoryMessages(convertedMessages);

                if (convertedMessages.length > 0) {
                    setGameStarted(true);

                    // 如果是初始加载且还没有加载过初始消息，加载最后一条历史记录作为初始消息
                    if (isInitialLoad && !hasLoadedInitialMessage.current) {
                        const lastMessage = convertedMessages[convertedMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            let processedText = lastMessage.text || '';
                            
                            // 提取 ACTION（用于历史记录显示）
                            const actions: string[] = [];
                            if (processedText.includes('[ACTION:')) {
                                const actionRegex = /\[ACTION:\s*(.*?)\]/g;
                                let match;
                                while ((match = actionRegex.exec(processedText)) !== null) {
                                    const actionText = match[1].trim();
                                    if (actionText && !actions.includes(actionText)) {
                                        actions.push(actionText);
                                    }
                                }
                                processedText = processedText.replace(/\[ACTION:\s*.*?\]/g, '').trim();
                            }
                            
                            // 检查是否有未完成任务，如果有则不显示 choice 弹窗
                            const hasActiveMissions = missionData?.activeMissions && missionData.activeMissions.length > 0;
                            
                            // 首先尝试提取 CHOICE 信息
                            const choiceData = extractChoiceFromHistory(processedText);
                            
                            if (choiceData && choiceData.options.length > 0 && !hasActiveMissions) {
                                // 如果有 choice 数据且没有未完成任务，创建虚拟的 choice step 并显示在弹窗中
                                console.log('📝 检测到 choice，创建虚拟 choice step:', choiceData);
                                const virtualChoiceStep = {
                                    id: 'history_choice',
                                    type: 'choice',
                                    title: choiceData.title || '',
                                    text: choiceData.text || '',
                                    options: choiceData.options.map((opt, idx) => ({
                                        text: opt,
                                        nextId: `history_choice_${idx}`
                                    }))
                                };
                                setCurrentStep(virtualChoiceStep);
                                setShowNextButton(false);
                                savedChoiceStepRef.current = virtualChoiceStep;
                            } else if (hasActiveMissions) {
                                setCurrentStep(null);
                                savedChoiceStepRef.current = null;
                            } else {
                                // 如果没有 choice，使用原来的逻辑清理文本
                                const { cleanedText, options: extractedOptions } = cleanHistoryMessage(processedText);
                                
                                // 只有清理后的文本不为空时才设置消息
                                if (cleanedText || extractedOptions.length > 0) {
                                    console.log('📝 设置历史记录最后一条消息:', cleanedText.substring(0, 100), '选项:', extractedOptions);
                                    setMessages([{
                                        type: 'system',
                                        text: cleanedText,
                                        isTyping: false,
                                        isMarkdown: true,
                                        actions: actions.length > 0 ? actions : undefined,
                                        options: extractedOptions.length > 0 ? extractedOptions : undefined
                                    }]);
                                } else {
                                    console.log('⚠️ 清理后的文本为空，不显示消息');
                                }
                            }
                            hasLoadedInitialMessage.current = true;
                        }
                    }
                } else if (isInitialLoad && !hasLoadedInitialMessage.current) {
                    // 如果没有历史记录且是初始加载，显示默认欢迎消息
                    hasLoadedInitialMessage.current = true;
                }
            } else {
                setHistoryMessages([]);
                // 如果加载失败且是初始加载，显示默认欢迎消息
                if (isInitialLoad && !hasLoadedInitialMessage.current) {
                    hasLoadedInitialMessage.current = true;
                }
            }
        } catch (error) {
            console.error('❌ 历史记录加载错误:', error);
            setHistoryMessages([]);
            // 如果加载失败且是初始加载，显示默认欢迎消息
            if (isInitialLoad && !hasLoadedInitialMessage.current) {
                hasLoadedInitialMessage.current = true;
            }
        } finally {
            setLoadingHistory(false);
        }
    }, [sessionId, playerName, missionData]);

    // 获取任务列表
    const loadMissions = useCallback(async () => {
        if (!sessionId) {
            return;
        }

        try {
            setLoadingMissions(true);
            const response = await MissionApi.getMissions(sessionId);
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                setMissionData(data);
                console.log('任务数据:', data);
                
                // 检查是否有未完成的任务
                if (data.activeMissions && data.activeMissions.length > 0) {
                    console.log('检测到未完成任务，显示任务提示弹窗');
                    setShowMissionAlert(true);
                } else {
                    setShowMissionAlert(false);
                }
            }
        } catch (error) {
            console.error('获取任务列表失败:', error);
        } finally {
            setLoadingMissions(false);
        }
    }, [sessionId]);

    // 当弹窗打开时，初始加载历史记录和任务列表
    useEffect(() => {
        if (isOpen && sessionId) {
            if (!hasLoadedInitialMessage.current) {
                // 先加载任务列表，然后加载历史记录（历史记录加载时会检查任务状态）
                loadMissions().then(() => {
                    // 任务加载完成后再加载历史记录
                    loadHistoryMessages(true);
                });
            } else {
                // 如果已经加载过，但有保存的 choice step，恢复它
                // 但需要检查是否有未完成任务
                if (savedChoiceStepRef.current && !currentStep) {
                    const hasActiveMissions = missionData?.activeMissions && missionData.activeMissions.length > 0;
                    if (!hasActiveMissions) {
                        console.log('🔄 恢复保存的 choice step');
                        setCurrentStep(savedChoiceStepRef.current);
                        setShowNextButton(false);
                    } else {
                        console.log('⚠️ 有未完成任务，不恢复 choice step');
                        savedChoiceStepRef.current = null;
                    }
                }
            }
        }
        // 当弹窗关闭时，不清除 savedChoiceStepRef，保持状态
        if (!isOpen) {
            hasLoadedInitialMessage.current = false;
        }
    }, [isOpen, sessionId, loadHistoryMessages, loadMissions, missionData, currentStep]);

    useEffect(() => {
        if (showHistory && sessionId) {
            loadHistoryMessages(false);
        }
    }, [showHistory, sessionId, loadHistoryMessages]);

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    // 当队列中有 step 且当前没有显示的 step 时，自动显示第一个
    useEffect(() => {
        if (stepQueue.length > 0 && (!currentStep || isWaitingForData)) {
            const nextStep = stepQueue[0];

            setCurrentStep(nextStep);
            setIsWaitingForData(false);
            setSelectedOptionIndex(null);
            setStepQueue(prev => prev.slice(1));

            // 根据 step 类型设置按钮显示状态
            setShowNextButton(nextStep.type !== 'choice');
            console.log('nextStep进行下一个step渲染', nextStep);
            
            // 如果显示的是 choice 类型，刷新任务列表（这样任务弹窗会在用户完成交互后显示）
            if (nextStep.type === 'choice') {
                console.log('刷新任务列表');

                loadMissions();
            }
        }
    }, [stepQueue, currentStep, isWaitingForData, loadMissions]);

    // 打字机效果：当 currentStep 变化时，开始打字机效果
    useEffect(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (!currentStep) {
            setDisplayedText('');
            setIsTyping(false);
            setIsWaitingForData(false);
            return;
        }

        // 如果是 choice 类型，不需要打字机效果，直接显示
        if (currentStep.type === 'choice') {
            setDisplayedText('');
            setIsTyping(false);
            return;
        }

        const textToDisplay = currentStep.text || '';
        if (!textToDisplay) {
            setDisplayedText('');
            setIsTyping(false);
            setIsWaitingForData(false);
            return;
        }

        setDisplayedText('');
        setIsTyping(true);
        setIsWaitingForData(false);

        let currentIndex = 0;
        const typingSpeed = 60; // 每个字符的延迟（毫秒）

        const typeNextChar = () => {
            if (currentIndex < textToDisplay.length) {
                setDisplayedText(textToDisplay.substring(0, currentIndex + 1));
                currentIndex++;
                typingTimeoutRef.current = setTimeout(typeNextChar, typingSpeed);
            } else {
                setIsTyping(false);
                setDisplayedText(textToDisplay);
            }
        };

        typingTimeoutRef.current = setTimeout(typeNextChar, typingSpeed);
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [currentStep]);

    const refreshHistoryAndMissions = useCallback(async () => {
        await Promise.allSettled([
            loadHistoryMessages(),
            loadMissions()
        ]);
    }, [loadHistoryMessages, loadMissions]);

    // 当 AI 流式输出完成时刷新历史记录和任务列表
    const prevIsTypingRef = useRef<boolean | undefined>(undefined);
    const isStreamingRef = useRef(false);
    const currentIsTyping = latestSystemMessage?.isTyping ?? false;

    useEffect(() => {
        const prevIsTyping = prevIsTypingRef.current;

        // 开始流式输出
        if (currentIsTyping === true && prevIsTyping !== true) {
            isStreamingRef.current = true;
        }

        // 流式输出完成：从 true 变为 false
        if (prevIsTyping === true && currentIsTyping === false && isStreamingRef.current) {
            isStreamingRef.current = false;
            // 延迟刷新，确保后端已保存新消息，同时刷新历史记录和任务列表
            const timer = setTimeout(() => {
                refreshHistoryAndMissions();
            }, 800);
            prevIsTypingRef.current = currentIsTyping;
            return () => clearTimeout(timer);
        }

        // 更新 ref
        if (prevIsTyping !== currentIsTyping) {
            prevIsTypingRef.current = currentIsTyping;
        }
    }, [currentIsTyping, refreshHistoryAndMissions]);

    // 使用 Step 流式响应处理 Hook
    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
    });

    // 通用的流式请求处理函数
    const handleStreamAction = useCallback(async (
        action: string,
        options?: {
            onBeforeRequest?: () => void;
            onSuccess?: () => void;
            onError?: (error: string) => void;
            shouldSetGameStarted?: boolean;
        }
    ) => {
        if (!sessionId) {
            options?.onError?.('没有 sessionId，无法发送请求...');
            return;
        }

        try {
            // 生成新的请求 ID，用于标识这一批新的 step
            const requestId = ++currentRequestId.current;
            console.log('📤 发送流式请求，请求 ID:', requestId, 'action:', action);

            // 清除之前的 step 和队列
            // 如果当前是 choice 类型，保留它以便显示按钮加载效果
            if (currentStepRef.current?.type !== 'choice') {
                setCurrentStep(null);
            }
            setStepQueue([]);
            setShowNextButton(false);
            setIsWaitingForData(true); // 显示加载状态（等待数据）
            
            // 清空 messages，避免显示旧的欢迎消息
            setMessages([]);

            setLoading(true);

            // 执行请求前的回调
            options?.onBeforeRequest?.();

            const response = await authFetch(
                `${HOST_ADDRESS}/api/backend/game/session/${sessionId}/stream/action-live`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                }
            );

            if (response.ok) {
                if (options?.shouldSetGameStarted) {
                    setGameStarted(true);
                }

                // 使用 processStreamResponse 处理流式数据
                await processStreamResponse(response, requestId, {
                    onSuccess: async () => {
                        // 先执行用户自定义的 onSuccess 回调
                        if (options?.onSuccess) {
                            await options.onSuccess();
                        }
                        // 只刷新历史记录，任务列表等到显示 choice 时再刷新
                        await loadHistoryMessages();
                    },
                    onError: options?.onError
                });

            } else {
                const errorMsg = `请求失败: ${response.statusText}`;
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        } catch (error) {
            const errorMsg = `请求错误: ${error instanceof Error ? error.message : '未知错误'}`;
            console.error('❌', errorMsg);
            setLoading(false);
            setSelectedOptionIndex(null);
            setIsWaitingForData(false);
            options?.onError?.(errorMsg);
        }
        // 注意：请求成功时，不在这里取消 loading，让 loading 保持到收到第一个 step 并显示后才取消（在 useEffect 中处理）
    }, [sessionId, processStreamResponse]);

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
                const requestId = ++currentRequestId.current;

                setCurrentStep(null);
                setStepQueue([]);
                setShowNextButton(false);
                setIsWaitingForData(true);
                setMessages([]);
                setLoading(true);
                
                await processStreamResponse(response, requestId, {
                    onFirstStep: () => {
                        console.log('📝 收到第一个 step，关闭任务提示弹窗');
                        setShowMissionAlert(false);
                    },
                    onSuccess: async () => {
                        // 只刷新历史记录，任务列表等到显示 choice 时再刷新
                        await loadHistoryMessages();
                    },
                    onError: (error) => {
                        console.error('❌ 任务提交流式处理错误:', error);
                        toast.error(error || '任务提交失败');
                        setLoading(false);
                        setIsWaitingForData(false);
                    }
                });
            } else{
                // 普通 JSON 响应（成功）
                try {
                    const data: SubmitMissionResponse = await response.json();
                    if (data.completed) {
                        console.log('✅ 任务提交成功');
                        toast.success(data.message || '任务提交成功');
                        // 刷新任务列表
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
    }, [sessionId, processStreamResponse, loadMissions]);

    const handleStartGame = async () => {
        // 记录游戏开始统计（异步执行，不阻塞游戏开始）
        if (pdfFileId && RECORD_CONVERSION) {
            console.log('是否开启统计');
            
            statisticsApi.addConversion({
                fileId: pdfFileId,
                userId: String(user?.user.id)
            }).catch((error) => {
                console.error('记录游戏统计失败:', error);
            });
        }

        await handleStreamAction('开始游戏', {
            onBeforeRequest: () => {
                // 清空之前的消息，避免显示旧的欢迎消息
                setMessages([]);
            },
            shouldSetGameStarted: true,
            onError: (error) => {
                setMessages((prev) => [
                    ...prev,
                    { type: 'system', text: error || '游戏开始失败，请重试...' }
                ]);
            }
        });
    };

    // 处理下一步
    const handleNextStep = useCallback(() => {
        setStepQueue(prev => {
            if (prev.length > 0) {
                const nextStep = prev[0];
                setCurrentStep(nextStep);
                setShowNextButton(nextStep.type !== 'choice');
                console.log('nextStep进行下一个step渲染');
                if(nextStep.type === 'choice') {
                    console.log('刷新任务列表');
                    loadMissions();
                }
                return prev.slice(1);
            } else {
                setCurrentStep(null);
                setShowNextButton(false);
                setIsWaitingForData(true);
                return prev;
            }
        });
    }, []);

    // 处理选择选项
    const handleChoiceOption = useCallback(async (option: { text: string; nextId: string }, optionIndex: number) => {
        setSelectedOptionIndex(optionIndex);
        // 立即显示加载状态，确保弹窗立即切换到加载状态
        setIsWaitingForData(true);
        setShowNextButton(false);

        await handleStreamAction(option.text, {
            onSuccess: () => {
                loadHistoryMessages();
            },
            onError: (error) => {
                console.error('❌ 选择处理错误:', error);
                setIsWaitingForData(false); // 错误时取消加载状态
                setSelectedOptionIndex(null); // 清除选中的选项
            }
        });
    }, [handleStreamAction, loadHistoryMessages]);

    // 处理输入框发送
    const handleChoiceSend = useCallback(async () => {
        const inputText = choiceInput.trim();
        if (!inputText) {
            return; // 如果输入为空，不发送
        }

        // 清空输入框
        setChoiceInput('');
        
        // 发送消息，类似于选择选项
        setIsWaitingForData(true);
        setShowNextButton(false);

        await handleStreamAction(inputText, {
            onSuccess: () => {
                loadHistoryMessages();
            },
            onError: (error) => {
                console.error('❌ 输入发送错误:', error);
                setIsWaitingForData(false);
            }
        });
    }, [choiceInput, handleStreamAction, loadHistoryMessages]);

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <button 
                    className={`${styles.closeBtn} ${currentStep && currentStep.type === 'choice'||showMissionAlert ? styles.closeBtnElevated : ''}`}
                    onClick={() => {
                        // 只有 choice 类型时才允许关闭 step 弹窗
                        if (currentStep && currentStep.type === 'choice') {
                            savedChoiceStepRef.current = currentStep;
                        }
                        onClose();
                    }}
                >
                    <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/时间暂停按钮.png`} alt="关闭" />
                </button>
                
                {/* 左侧面板：历史记录和任务列表 */}
                <div className={styles.leftPanels}>
                    {
                        showHistory && (
                            <div className={`${styles.panelCard} ${styles.historyPanel}`}>
                                <ChatHistory
                                    isOpen={true}
                                    chatMessages={historyMessages}
                                    loading={loadingHistory}
                                />
                            </div>
                        )
                    }
                    <div className={`${styles.panelCard} ${styles.missionsModalWrapper}`}>
                        <MissionsModal missionData={missionData} loading={loadingMissions} />
                    </div>
                </div>

                {/* 中间：编年纪事对话 - 只显示最新一条 AI 回复 */}
                <div className={styles.dialogueCenterWrapper}>
                    {/* {currentStep && currentStep.type === 'dialogue' && ( */}
                        <div className={styles.npcAvatarContainer}>
                            {currentNPC ? (
                                <img 
                                    src={currentNPC.icon || `${import.meta.env.BASE_URL}data/avatars/hunter.png`} 
                                    alt={currentNPC.name || currentStep.characterId}
                                    className={styles.npcAvatar}
                                    onError={(e) => {
                                        console.error('❌ NPC 头像加载失败:', currentNPC.icon);
                                        (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}data/avatars/hunter.png`;
                                    }}
                                />
                            ) : (
                                <img 
                                    src={`${import.meta.env.BASE_URL}data/avatars/hunter.png`} 
                                    alt='角色'
                                    className={styles.npcAvatar}
                                />
                            )}
                        </div>
                    {/* )} */}
                    <div className={styles.dialogueWrapper}>
                    <div className={styles.dialogueModalWrapper}>
                        <div className={styles.dialogueModal}>
                        <div className={styles.modalHeader}>
                            <button className={styles.historyBtn} onClick={() => setShowHistory(!showHistory)}>
                                <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/历史对话图标.png`} alt="历史记录" />
                            </button>

                            <span className={styles.headerSpacer} />
                        </div>

                        <div className={styles.messagesContainer}>
                            {/* 下半部分：消息显示 */}
                            <div className={styles.messageContent}>
                                {/* 显示 dialogue 类型的 step */}
                                {currentStep && currentStep.type === 'dialogue' ? (
                                    <div className={`${styles.message} ${styles.system}`}>
                                        <div className={styles.dialogueContent}>
                                            <strong>{currentNPC?.name || currentStep.characterId || '角色'}:</strong>
                                            <p>
                                                {displayedText}
                                                {isTyping && <span className={styles.cursor}></span>}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                // 只有在没有 currentStep 且没有正在等待数据时才显示 messages（历史记录）
                                // 如果正在等待数据（显示旁白弹窗），则不显示 messages，避免显示旧的欢迎消息
                                !isWaitingForData && !currentStep && messages.length > 0 && messages.map((msg, index) => (
                                    <div key={index} className={`${styles.message} ${styles.system}`}>
                                        {msg.isMarkdown ? (
                                            <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                                        ) : (
                                            <p>{msg.text}</p>
                                        )}
                                        {/* 显示 OPTION 按钮 */}
                                        {msg.options && msg.options.length > 0 && (
                                            <div className={styles.historyOptions}>
                                                {msg.options.map((option, optIndex) => (
                                                    <button
                                                        key={optIndex}
                                                        className={styles.historyOptionBtn}
                                                        onClick={() => handleStreamAction(option, {
                                                            onSuccess: () => {
                                                                loadHistoryMessages();
                                                            },
                                                            onError: (error) => {
                                                                console.error('❌ 选项处理错误:', error);
                                                            }
                                                        })}
                                                        disabled={loading}
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

                        {/* 开始游戏按钮 */}
                        {!gameStarted && (
                            <div className={styles.startGameContainer}>
                                <button
                                    className={styles.startGameBtn}
                                    onClick={handleStartGame}
                                    disabled={loading}
                                >
                                    <img src={`${import.meta.env.BASE_URL}data/asset/编年史/按钮.png`} alt="开始游戏" />
                                </button>
                            </div>
                        )}

                        {/* 继续按钮 */}
                        {gameStarted && showNextButton && currentStep && currentStep.type !== 'choice' && (
                            <div className={styles.nextStepContainer}>
                                <button
                                    className={styles.nextStepBtn}
                                    onClick={handleNextStep}
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

                {/* 右侧面板：人物信息和背包 */}
                <div className={styles.rightPanels}>
                    <div className={`${styles.panelCard} ${styles.playerPanel}`}>
                        <PlayerFloatingPanel
                            isOpen={true}
                            player={player}
                        />
                    </div>
                    <div className={`${styles.panelCard} ${styles.inventoryPanel}`}>
                        {inventory && onEquipItem && onUseItem && (
                            <InventoryFloatingPanel
                                isOpen={true}
                                inventory={inventory}
                                onEquipItem={onEquipItem}
                                onUseItem={onUseItem}
                            />
                        )}
                    </div>
                </div>

                {showHistory && (
                    <div className={styles.mobileHistoryModal}>
                        <ChatHistory
                            isOpen={true}
                            chatMessages={historyMessages}
                            loading={loadingHistory}
                            onClose={() => setShowHistory(false)}
                        />
                    </div>
                )}

                {/* Step 小弹窗 - 显示 narration, hint, choice 等类型（不显示 dialogue） */}
                {((currentStep && currentStep.type !== 'dialogue') || (isWaitingForData && !currentStep)) ? (
                    <div className={styles.stepModal}>
                        <div className={styles.stepModalContent}>
                            {currentStep ? (
                                <>
                                    <div className={styles.stepModalHeader}>
                                        <span className={styles.stepTypeLabel}>
                                            {currentStep.type === 'narration' ? '旁白' :
                                                currentStep.type === 'hint' ? '提示' :
                                                    currentStep.type === 'choice' ? '选择' :
                                                        currentStep.type}
                                        </span>
                                    </div>
                                    <div className={styles.stepModalBody}>
                                        {currentStep.type === 'choice' ? (
                                            <>
                                                {currentStep.title && (
                                                    <h3 className={styles.choiceTitle}>{currentStep.title}</h3>
                                                )}
                                                {currentStep.text && (
                                                    <p className={styles.choiceText}>{currentStep.text}</p>
                                                )}
                                                <div className={styles.choiceOptions}>
                                                    {currentStep.options && currentStep.options.map((option: any, i: number) => (
                                                        <button
                                                            key={i}
                                                            className={styles.choiceOptionBtn}
                                                            onClick={() => handleChoiceOption(option, i)}
                                                            disabled={selectedOptionIndex !== null}
                                                        >
                                                            {selectedOptionIndex === i ? (
                                                                <span className={styles.buttonLoadingDots}>
                                                                    <span></span>
                                                                    <span></span>
                                                                    <span></span>
                                                                </span>
                                                            ) : (
                                                                option.text
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className={styles.choiceInputContainer}>
                                                    <input 
                                                        type="text" 
                                                        className={styles.choiceInput}
                                                        placeholder="输入你的选择..." 
                                                        value={choiceInput}
                                                        onChange={(e) => setChoiceInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleChoiceSend();
                                                            }
                                                        }}
                                                        disabled={selectedOptionIndex !== null || isWaitingForData}
                                                    />
                                                    <button 
                                                        className={styles.choiceSendBtn}
                                                        onClick={handleChoiceSend}
                                                        disabled={!choiceInput.trim() || selectedOptionIndex !== null || isWaitingForData}
                                                    >
                                                        发送
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <p>
                                                {displayedText}
                                                {isTyping && <span className={styles.cursor}></span>}
                                            </p>
                                        )}
                                    </div>
                                    {showNextButton && currentStep.type !== 'choice' && (
                                        <div className={styles.stepModalFooter}>
                                            <button
                                                className={styles.stepNextBtn}
                                                onClick={handleNextStep}
                                                disabled={isTyping}
                                            >
                                                继续
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : isWaitingForData ? (
                                <>
                                    <div className={styles.stepModalHeader}>
                                        <span className={styles.stepTypeLabel}>旁白</span>
                                    </div>
                                    <div className={styles.stepModalBody}>
                                        <p>
                                            <span className={styles.cursor}></span>
                                        </p>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}

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