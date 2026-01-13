import React, { useState, useEffect, useCallback, useRef, useImperativeHandle } from 'react';
import styles from './WorldPanel.module.css';
import type {
    AllGameData,
    StoryStructure,
    DynamicEntry,
} from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { WorldSetting as VisualWorldSetting } from '../../../api/galgame/EditorData.type';
import type { WorldSetting as WorldWorldSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import StoryStructureAdvanced from './StoryStructureAdvanced';
import { useUnsavedChanges } from '../../../hooks/editor/useUnsavedChanges';
import CoverUpload from './CoverUpload';
import WorldSettingForm from './WorldSettingForm';
import StorylinesSection, { type StoryLine } from './StorylinesSection';
import ToneSection from './ToneSection';

export interface WorldPanelRef {
    checkBeforeLeave: () => boolean;
}

interface WorldPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    handleSubmit?: () => void;
    isSubmitting?: boolean;
    fileId?: string;
    mode: 'visual' | 'worldInteraction' | undefined;
}


// 获取 player 信息（统一使用小写）
function getPlayer(data: AllGameData | WorldInteractionGameData | null | undefined) {
    if (!data?.worldSetting) return undefined;
    const ws = data.worldSetting;
    if ('player' in ws && ws.player) {
        return ws.player;
    }
    return undefined;
}

const WorldPanel = React.forwardRef<WorldPanelRef, WorldPanelProps>(({
    gameData,
    onGetData,
    handleSubmit,
    isSubmitting = false,
    fileId,
    mode = 'visual',
}, ref) => {
    // 表单字段状态
    const [title, setTitle] = useState<string>('');
    const [tagline, setTagline] = useState<string>('');
    const [era, setEra] = useState<string>('');
    const [worldRules, setWorldRules] = useState<string>('');
    const [opening, setOpening] = useState<string>('');
    const [openingPlot, setOpeningPlot] = useState<string>('');
    const [playerRole, setPlayerRole] = useState<string>('');
    
    const [toneValue, setToneValue] = useState<string>('');
    const [storylines, setStorylines] = useState<StoryLine[]>([]);
    const [isStorylineExpanded, setIsStorylineExpanded] = useState<boolean>(false);
    const [isToneExpanded, setIsToneExpanded] = useState<boolean>(false);
    const [storylineError, setStorylineError] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
    const [storyStructure, setStoryStructure] = useState<StoryStructure | null>(null);
    const [dynamicEntries, setDynamicEntries] = useState<DynamicEntry[]>([]);
    const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
    const [advancedError, setAdvancedError] = useState<string | null>(null);
    const [storyPrompt, setStoryPrompt] = useState<string>('');

    const lastFileIdRef = useRef<string | null>(null);
    const originalDataRef = useRef<VisualWorldSetting | WorldWorldSetting | null>(null);
    const lastWorldSettingSnapshotRef = useRef<string | null>(null);
    const storyPollingRef = useRef<{
        timeoutId: ReturnType<typeof setTimeout> | null;
        delay: number;
        started: number;
    } | null>(null);

    const currentFileId = gameData?.fileId || fileId;
    
    // 获取完整数据的函数（需要在 hook 之前定义，使用 ref 来避免依赖问题）
    const getFullWorldSettingDataRef = useRef<(() => VisualWorldSetting | WorldWorldSetting | null) | null>(null);
    
    // 使用未保存修改检测 hook
    const {
        setHasUnsavedChanges,
        SaveConfirmModalComponent,
        getCheckBeforeLeave,
    } = useUnsavedChanges({
        onSave: async () => {
            if (handleSubmit) {
                await handleSubmit();
            }
        },
    });
    
    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
        checkBeforeLeave: getCheckBeforeLeave(),
    }), [getCheckBeforeLeave]);

    useEffect(() => {
        if (!gameData?.worldSetting || !gameData?.fileId) return;

        const currentFileId = gameData.fileId;
        const ws = gameData.worldSetting;
        const currentWorldSettingSnapshot = JSON.stringify(ws);
        
        // 如果 fileId 变化，重置所有状态
        const isFileIdChanged = lastFileIdRef.current !== currentFileId;
        if (isFileIdChanged) {
            lastFileIdRef.current = currentFileId;
            lastWorldSettingSnapshotRef.current = currentWorldSettingSnapshot;
            originalDataRef.current = JSON.parse(JSON.stringify(ws));
        } else {
            // fileId 不变，但 worldSetting 可能更新了（例如保存后数据刷新）
            // 如果 worldSetting 变化了，更新 originalDataRef
            if (lastWorldSettingSnapshotRef.current !== currentWorldSettingSnapshot) {
                lastWorldSettingSnapshotRef.current = currentWorldSettingSnapshot;
                originalDataRef.current = JSON.parse(JSON.stringify(ws));
                // 如果刚刚保存过，此时 originalDataRef 已更新，检测修改的 useEffect 会重新运行
                return; // 不重置其他状态，只更新 originalDataRef
            } else {
                // worldSetting 没变化，不需要做任何事情
                return;
            }
        } 

        let worldRulesText = '';
        if (mode === 'visual' && 'WorldRules' in ws && ws.WorldRules) {
            worldRulesText = Object.entries(ws.WorldRules)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        } else if (mode === 'worldInteraction' && 'WorldRules' in ws && (ws as any).WorldRules) {
            const wr = (ws as any).WorldRules as Record<string, string>;
            worldRulesText = Object.entries(wr)
                .map(([key, value]) => key === value ? value : `${key}: ${value}`)
                .join('\n');
        }

        const player = getPlayer(gameData);
        const playerRace = player && 'race' in player ? player.race : undefined;
        const playerRoleText = player
            ? `${player.name} (${player.gender}${player.age ? `, ${player.age}岁` : ''}${playerRace ? `, ${playerRace}` : ''})`
            : '';

        // 设置表单字段值
        setTitle(ws.title || '');
        setTagline(ws.summary || '');
        setEra(ws.background || '');
        setWorldRules(worldRulesText);
        setPlayerRole(playerRoleText);
        setOpening(ws.preamble || '');
        setOpeningPlot(ws.initialPlot || '');

        // 同步故事结构与动态事件（仅 visual 模式）
        if (mode === 'visual') {
            const visualData = gameData as AllGameData;
            if (visualData.storySetting) {
                setStoryStructure(visualData.storySetting);
            }
            if (visualData.worldSetting?.dynamicEntries) {
                setDynamicEntries(visualData.worldSetting.dynamicEntries);
            } else {
                setDynamicEntries([]);
            }
        } else {
            setStoryStructure(null);
            setDynamicEntries([]);
        }

        if (ws.keyEvents && ws.keyEvents.length > 0) {
            setStorylines(ws.keyEvents.map((event: { title?: string; description?: string }, index: number) => ({
                id: `${index}`,
                tag: event.title || `事件 ${index + 1}`,
                content: event.description || '',
            })));
            setStorylineError('');
        } else {
            setStorylines([]);
            if (mode === 'worldInteraction') {
                setStorylineError('请至少添加一条故事线（世界交互模式下为必填）');
            }
        }

        setToneValue(ws.literary || '');
    }, [gameData]);

    // 字段变更处理函数（playerRole 字段是只读的，不提供修改函数）

    const handleToneChange = (value: string) => {
        setToneValue(value);
    };

    const handleStorylineChange = (id: string, key: 'tag' | 'content', value: string) => {
        setStorylines(prev => {
            const updated = prev.map(s => s.id === id ? { ...s, [key]: value } : s);
            if (mode === 'worldInteraction' && updated.length > 0) {
                setStorylineError('');
            }
            return updated;
        });
    };

    const addStoryline = () => {
        setStorylines(prev => {
            const updated = [...prev, {
                id: `${Date.now()}`,
                tag: `阶段 ${prev.length + 1}`,
                content: '',
            }];
            if (mode === 'worldInteraction') {
                setStorylineError('');
            }
            return updated;
        });
    };

    const removeStoryline = (id: string) => {
        setStorylines(prev => {
            const updated = prev.filter(s => s.id !== id);
            if (mode === 'worldInteraction' && updated.length === 0) {
                setStorylineError('请至少添加一条故事线（世界交互模式下为必填）');
            }
            return updated;
        });
    };

    const isWorldInteractionMode = mode === 'worldInteraction';

    const getFullWorldSettingData = useCallback((): VisualWorldSetting | WorldWorldSetting | null => {
        if (!gameData?.worldSetting) return null;

        // 直接使用状态值
        const titleVal = title;
        const taglineVal = tagline;
        const eraVal = era;
        const worldRulesVal = worldRules;
        const openingVal = opening;
        const openingPlotVal = openingPlot;

        // 解析世界规则：支持 "key: value" 形式（视觉模式）和 "每行一条规则" 形式（worldInteraction 模式）
        const parsedWorldRules: { [key: string]: string } = {};
        const worldRulesLines: string[] = [];
        if (worldRulesVal) {
            worldRulesVal.split('\n').forEach((line: string) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                const colonIndex = trimmedLine.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmedLine.substring(0, colonIndex).trim();
                    const value = trimmedLine.substring(colonIndex + 1).trim();
                    if (key && value) {
                        parsedWorldRules[key] = value;
                        worldRulesLines.push(`${key}: ${value}`);
                    }
                } else {
                    parsedWorldRules[trimmedLine] = trimmedLine;
                    worldRulesLines.push(trimmedLine);
                }
            });
        }

        // playerRole 字段是只读的，用户无法修改，所以直接使用后端返回的 player 数据
        const player = getPlayer(gameData);

        const keyEvents = storylines.map(line => ({
            title: line.tag,
            description: line.content,
        }));

        if (mode === 'visual') {
            const currentPlayer = player || { name: '', gender: '', appearance: '' };
            return {
                ...gameData.worldSetting,
                title: titleVal,
                summary: taglineVal,
                background: eraVal,
                preamble: openingVal,
                initialPlot: openingPlotVal,
                literary: toneValue ?? '',
                WorldRules: parsedWorldRules,
                keyEvents: keyEvents,
                dynamicEntries: dynamicEntries,
                player: currentPlayer, // 直接使用后端返回的 player 数据
            } as VisualWorldSetting;
        } else {
            // worldInteraction 模式：将世界规则行映射到 Theme（string[]）
            // playerRole 字段是只读的，直接使用后端返回的 player 数据
            const worldPlayer = player ? {
                name: player.name || '',
                gender: player.gender || '',
                age: player.age || 0,
                personality: 'personality' in player ? player.personality : '',
                appearance: player.appearance || '',
                tone: player.tone || '',
                imagePath: 'imagePath' in player ? player.imagePath : ('images' in player && player.images?.base) || '',
            } : {
                name: '',
                gender: '',
                age: 0,
                personality: '',
                appearance: '',
                tone: '',
                imagePath: '',
            };
            
            return {
                ...gameData.worldSetting,
                title: titleVal,
                summary: taglineVal,
                background: eraVal,
                preamble: openingVal,
                initialPlot: openingPlotVal,
                literary: toneValue ?? '',
                keyEvents: keyEvents,
                Theme: worldRulesLines,
                WorldRules: parsedWorldRules,
                player: worldPlayer, // 直接使用后端返回的 player 数据
            } as unknown as WorldWorldSetting;
        }
    }, [title, tagline, era, worldRules, opening, openingPlot, storylines, toneValue, gameData, mode, dynamicEntries]);
    
    // 将 getFullWorldSettingData 保存到 ref 中，供 hook 使用
    getFullWorldSettingDataRef.current = getFullWorldSettingData;

    // 获取修改过的字段（Diff 策略）
    const getWorldSettingData = useCallback((): Partial<VisualWorldSetting> | Partial<WorldWorldSetting> | null => {
        if (!gameData?.worldSetting || !originalDataRef.current) {
            return null;
        }

        const fullData = getFullWorldSettingData();
        if (!fullData) return null;

        const original = originalDataRef.current;

        if (mode === 'visual') {
            const diff: Partial<VisualWorldSetting> = {};
            const orig = original as VisualWorldSetting;
            const full = fullData as VisualWorldSetting;

            if (full.title !== orig.title) diff.title = full.title;
            if (full.summary !== orig.summary) diff.summary = full.summary;
            if (full.background !== orig.background) diff.background = full.background;
            if (full.preamble !== orig.preamble) diff.preamble = full.preamble;
            if (full.initialPlot !== orig.initialPlot) diff.initialPlot = full.initialPlot;
            if (full.literary !== orig.literary) diff.literary = full.literary;

            if (JSON.stringify(full.WorldRules) !== JSON.stringify(orig.WorldRules)) {
                diff.WorldRules = full.WorldRules;
            }

            if (JSON.stringify(full.keyEvents) !== JSON.stringify(orig.keyEvents)) {
                diff.keyEvents = full.keyEvents;
            }

            if (JSON.stringify(full.dynamicEntries) !== JSON.stringify(orig.dynamicEntries)) {
                (diff as any).dynamicEntries = full.dynamicEntries;
            }

            const origTheme = Array.isArray(orig.Theme) ? orig.Theme : [];
            if (JSON.stringify(full.Theme) !== JSON.stringify(origTheme)) {
                diff.Theme = full.Theme;
            }

            // player 字段不参与比较（只读字段，用户在 WorldPanel 中无法修改）

            return Object.keys(diff).length > 0 ? diff : null;
        } else {
            const diff: Partial<WorldWorldSetting> = {};
            const orig = original as WorldWorldSetting;
            const full = fullData as WorldWorldSetting;

            if (full.title !== orig.title) diff.title = full.title;
            if (full.summary !== orig.summary) diff.summary = full.summary;
            if (full.background !== orig.background) diff.background = full.background;
            if (full.preamble !== orig.preamble) diff.preamble = full.preamble;
            if (full.initialPlot !== orig.initialPlot) diff.initialPlot = full.initialPlot;
            if (full.literary !== orig.literary) diff.literary = full.literary;

            if (JSON.stringify(full.keyEvents) !== JSON.stringify(orig.keyEvents)) {
                diff.keyEvents = full.keyEvents;
            }

            const origTheme = Array.isArray(orig.Theme) ? orig.Theme : [];
            if (JSON.stringify(full.Theme) !== JSON.stringify(origTheme)) {
                diff.Theme = full.Theme;
            }

            const fullWorldRules = (full as any).WorldRules ?? {};
            const origWorldRules = (orig as any).WorldRules ?? {};
            if (JSON.stringify(fullWorldRules) !== JSON.stringify(origWorldRules)) {
                (diff as any).WorldRules = fullWorldRules;
            }

            // player 字段不参与比较（只读字段，用户在 WorldPanel 中无法修改）

            return Object.keys(diff).length > 0 ? diff : null;
        }
    }, [getFullWorldSettingData, gameData, mode]);

    // 检测是否有未保存的修改
    useEffect(() => {
        if (!originalDataRef.current) {
            return;
        }
        const worldSettingDiff = getWorldSettingData();
        const hasChanges = worldSettingDiff !== null;
        setHasUnsavedChanges(hasChanges);
    }, [title, tagline, era, worldRules, opening, openingPlot, storylines, toneValue, storyStructure, dynamicEntries, gameData, mode, getWorldSettingData, setHasUnsavedChanges]);

    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const worldSettingDiff = getWorldSettingData();
                if (!worldSettingDiff) return null;
                return { worldSetting: worldSettingDiff } as Partial<AllGameData | WorldInteractionGameData>;
            });
        }
    }, [onGetData, getWorldSettingData]);

    // 停止故事结构生成的轮询
    const stopStoryPolling = useCallback(() => {
        if (storyPollingRef.current?.timeoutId) {
            clearTimeout(storyPollingRef.current.timeoutId);
            storyPollingRef.current = null;
        }
    }, []);

    // 开始轮询故事结构生成状态
    const startStoryPolling = useCallback((jobId: string) => {
        // 如果已经在轮询，先停止
        stopStoryPolling();

        let delay = 1000;
        const maxDelay = 5000;
        const timeoutMs = 25 * 60 * 1000; // 25分钟超时
        const started = Date.now();

        const pollStatus = async () => {
            try {
                // 检查超时
                if (Date.now() - started > timeoutMs) {
                    stopStoryPolling();
                    setIsGeneratingStory(false);
                    const errorMsg = '故事结构生成超时，请重试';
                    toast.error(errorMsg);
                    setAdvancedError(errorMsg);
                    return;
                }

                // 检查状态
                const statusResponse = await EditorApi.checkGenerateStatus(jobId);
                const statusData = statusResponse.data;

                console.log('[故事结构生成轮询] jobId:', jobId, 'status:', statusData.status, 'progress:', statusData.progress, 'stage:', statusData.stage);

                if (
                    statusData.status === 'running' ||
                    statusData.status === 'queued' ||
                    statusData.status === 'pending'
                ) {
                    // 继续轮询
                    delay = Math.min(Math.round(delay * 1.3), maxDelay);
                    if (storyPollingRef.current) {
                        storyPollingRef.current.delay = delay;
                        storyPollingRef.current.timeoutId = setTimeout(() => {
                            pollStatus();
                        }, delay);
                    }
                } else if (statusData.status === 'completed') {
                    // 任务完成，获取结果
                    try {
                        const resultResponse = await EditorApi.getGenerateResult(jobId);
                        const result = resultResponse.data;
                        
                        console.log('[故事结构生成完成]', result);
                        
                        // 从 result.result 中获取数据（根据实际 API 响应格式）
                        if (result.result) {
                            const { storyPhases: newStoryStructure, dynamicEntries, message } = result.result;
                            
                            stopStoryPolling();
                            setIsGeneratingStory(false);
                            setAdvancedError(null);
                            
                            if (newStoryStructure) {
                                setStoryStructure(newStoryStructure);
                            }
                            if (dynamicEntries) {
                                setDynamicEntries(dynamicEntries);
                            }
                            toast.success(message || '故事结构已生成');
                        } else {
                            throw new Error('响应中缺少 result 字段');
                        }
                    } catch (error) {
                        console.error('获取故事结构生成结果失败:', error);
                        stopStoryPolling();
                        setIsGeneratingStory(false);
                        const errorMsg = '获取故事结构生成结果失败，请重试';
                        toast.error(errorMsg);
                        setAdvancedError(errorMsg);
                    }
                } else if (statusData.status === 'failed') {
                    // 任务失败
                    stopStoryPolling();
                    setIsGeneratingStory(false);
                    const errorMsg = statusData.error || '故事结构生成失败，请重试';
                    toast.error(errorMsg);
                    setAdvancedError(errorMsg);
                } else if (statusData.status === 'unknown') {
                    // 任务不存在
                    stopStoryPolling();
                    setIsGeneratingStory(false);
                    const errorMsg = '故事结构生成任务不存在或已回收，请重试';
                    toast.error(errorMsg);
                    setAdvancedError(errorMsg);
                }
            } catch (error) {
                console.error('轮询故事结构生成状态失败:', error);
                stopStoryPolling();
                setIsGeneratingStory(false);
                const errorMsg = error instanceof Error ? error.message : '轮询故事结构生成状态失败';
                toast.error(errorMsg);
                setAdvancedError(errorMsg);
            }
        };

        // 初始化轮询状态
        storyPollingRef.current = {
            timeoutId: null,
            delay: delay,
            started: started,
        };

        // 开始第一次轮询
        pollStatus();
    }, [stopStoryPolling]);

    // 组件卸载时清理轮询
    useEffect(() => {
        return () => {
            stopStoryPolling();
        };
    }, [stopStoryPolling]);

    const handleGenerateStoryStructure = useCallback(async () => {
        if (!currentFileId) {
            toast.error('缺少文件ID，无法生成故事结构');
            return;
        }
        const trimmedPrompt = storyPrompt.trim();
        if (!trimmedPrompt) {
            const msg = '请先在下方输入你期望的故事章节结构描述，例如：希望拆成 5 章，从校园日常到超自然事件爆发再到最终决战。';
            toast.error(msg);
            setAdvancedError(msg);
            return;
        }
        
        // 如果正在轮询，先停止
        stopStoryPolling();

        try {
            setIsGeneratingStory(true);
            setAdvancedError(null);
            
            // 发起生成请求
            const res = await EditorApi.generateStoryStructure(currentFileId, trimmedPrompt);
            const resData = res.data;
            
            if (!resData.success) {
                toast.error('生成故事结构失败，请稍后重试');
                setAdvancedError('生成故事结构失败，请稍后重试');
                setIsGeneratingStory(false);
                return;
            }

            // 检查是否返回了 jobId（异步任务）
            if ('jobId' in resData && resData.jobId) {
                // 启动轮询
                console.log('[故事结构生成] 开始轮询，jobId:', resData.jobId);
                startStoryPolling(resData.jobId);
            } else if ('data' in resData && resData.data) {
                // 兼容同步返回的情况（直接返回结果）
                const { storyPhases: newStoryStructure, dynamicEntries, message } = resData.data;
                console.log('[故事结构生成] 同步返回结果', resData);
                
                setIsGeneratingStory(false);
                
                if (newStoryStructure) {
                    setStoryStructure(newStoryStructure);
                }
                if (dynamicEntries) {
                    setDynamicEntries(dynamicEntries);
                }
                toast.success(message || '故事结构已生成');
            } else {
                toast.error('生成故事结构失败，请稍后重试');
                setAdvancedError('生成故事结构失败，请稍后重试');
                setIsGeneratingStory(false);
            }
        } catch (error) {
            console.error('生成故事结构失败:', error);
            toast.error('生成故事结构失败，请稍后重试');
            setAdvancedError('生成故事结构失败，请稍后重试');
            setIsGeneratingStory(false);
        }
    }, [currentFileId, storyPrompt, startStoryPolling, stopStoryPolling]);

    return (
        <div className={styles.panelContent}>
            <CoverUpload fileId={currentFileId} />
            <div className={styles.panelHeader}>
                <div>
                    <h2>世界观 & 表单化设定</h2>
                    <p className={styles.subtitle}>所有内容均来自 AI 解析，请校对这些内容</p>
                </div>
                {handleSubmit && (
                    <button
                        className={styles.primary}
                        onClick={(e) => {
                            e.preventDefault();
                            if (isWorldInteractionMode && storylines.length === 0) {
                                setStorylineError('请至少添加一条故事线（世界交互模式下为必填）');
                                setIsStorylineExpanded(true);
                                toast.error('请至少添加一条故事线（世界交互模式下为必填）');
                                return;
                            }
                            setStorylineError('');
                            handleSubmit();
                        }}
                        disabled={!gameData || isSubmitting}
                    >
                        {isSubmitting ? '提交中...' : '确认修改'}
                    </button>
                )}
            </div>
            
            {/* 未保存修改确认弹窗 */}
            {SaveConfirmModalComponent}

            <div className={styles.formContainer}>
                {/* Tab 切换 - 仅在 visual 模式下显示 */}
                {mode === 'visual' && (
                    <div className={styles.tabContainer}>
                        <button
                            className={`${styles.tab} ${activeTab === 'basic' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('basic')}
                        >
                            基本设定
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'advanced' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('advanced')}
                        >
                            高级设置
                        </button>
                    </div>
                )}

                {/* Tab 内容 */}
                <div className={styles.tabContent}>
                    {mode === 'visual' && activeTab === 'advanced' ? (
                        <>
                            <StoryStructureAdvanced
                                fileId={currentFileId}
                                storyStructure={storyStructure}
                                setStoryStructure={setStoryStructure}
                                dynamicEntries={dynamicEntries}
                                setDynamicEntries={setDynamicEntries}
                                storyPrompt={storyPrompt}
                                setStoryPrompt={setStoryPrompt}
                                isGeneratingStory={isGeneratingStory}
                                advancedError={advancedError}
                                onGenerate={handleGenerateStoryStructure}
                                canGenerate={!!currentFileId}
                            />
                            {isGeneratingStory && (
                                <div className={styles.tabLoadingOverlay}>
                                    <div className={styles.tabLoadingContent}>
                                        <div className={styles.tabLoadingSpinner} />
                                        <div className={styles.tabLoadingText}>
                                            正在生成故事结构和动态条目，请稍候…
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <WorldSettingForm
                                title={title}
                                tagline={tagline}
                                era={era}
                                worldRules={worldRules}
                                playerRole={playerRole}
                                opening={opening}
                                openingPlot={openingPlot}
                                onTitleChange={setTitle}
                                onTaglineChange={setTagline}
                                onEraChange={setEra}
                                onWorldRulesChange={setWorldRules}
                                onOpeningChange={setOpening}
                                onOpeningPlotChange={setOpeningPlot}
                            />

                            <StorylinesSection
                                storylines={storylines}
                                isExpanded={isStorylineExpanded}
                                error={storylineError}
                                isWorldInteractionMode={isWorldInteractionMode}
                                onToggleExpand={() => setIsStorylineExpanded(!isStorylineExpanded)}
                                onAddStoryline={addStoryline}
                                onStorylineChange={handleStorylineChange}
                                onRemoveStoryline={removeStoryline}
                            />

                            <ToneSection
                                value={toneValue}
                                isExpanded={isToneExpanded}
                                onToggleExpand={() => setIsToneExpanded(!isToneExpanded)}
                                onChange={handleToneChange}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

WorldPanel.displayName = 'WorldPanel';
export default WorldPanel;
