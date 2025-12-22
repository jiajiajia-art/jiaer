import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './WorldPanel.module.css';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';
import type { WorldSetting as VisualWorldSetting } from '../../api/galgame/EditorData.type';
import type { WorldSetting as WorldWorldSetting } from '../../api/worldInteraction/worldInteractionApi.type';
import { MdArrowDropDown } from 'react-icons/md';
import { toast } from 'react-hot-toast';

interface WorldField {
    id: string;
    label: string;
    type: 'text' | 'textarea';
    rows?: number;
    value: string;
    hint?: string;
}

interface StoryLine {
    id: string;
    tag: string;
    content: string;
}

interface WorldPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    handleSubmit?: () => void;
    isSubmitting?: boolean;
    fileId?: string;
}

// 类型守卫：判断是否为 visual 模式
function isVisualMode(data: AllGameData | WorldInteractionGameData | null | undefined): data is AllGameData {
    if (!data) return false;
    return 'metadata' in data && data.metadata !== undefined;
}

// 辅助函数：获取 player（统一使用小写）
function getPlayer(data: AllGameData | WorldInteractionGameData | null | undefined) {
    if (!data?.worldSetting) return undefined;
    const ws = data.worldSetting;
    
    // 统一使用小写 player
    if ('player' in ws && ws.player) {
        return ws.player;
    }
    
    return undefined;
}

const WorldPanel: React.FC<WorldPanelProps> = ({
    gameData,
    onGetData,
    handleSubmit,
    isSubmitting = false,
}) => {
    // 默认表单字段（不包括文风要求，文风要求单独处理）
    const defaultFields: WorldField[] = [
        { id: 'title', label: '作品标题', type: 'text', value: '' },
        { id: 'tagline', label: '一句话概述', type: 'text', value: '' },
        { id: 'era', label: '时代背景 / 前情提要', type: 'textarea', rows: 6, value: '' },
        { id: 'worldRules', label: '世界规则', type: 'textarea', rows: 4, value: '' },
        { id: 'playerRole', label: '玩家身份', type: 'text', value: '' },
        { id: 'opening', label: '开场白', type: 'textarea', rows: 5, value: '', hint: '用于玩家进入游戏时的第一段旁白，可随时微调语气。' },
        { id: 'openingPlot', label: '开场剧情', type: 'textarea', rows: 5, value: '', hint: '描述第一轮推演至玩家做出首个选择前的剧情骨架，用于引导 AI 理解节奏。' },
    ];

    // 文风要求单独管理
    const [toneValue, setToneValue] = useState<string>('');

    // 所有表单字段统一管理
    const [worldFields, setWorldFields] = useState<WorldField[]>(defaultFields);

    // 故事线
    const [storylines, setStorylines] = useState<StoryLine[]>([]);

    // 折叠状态
    const [isStorylineExpanded, setIsStorylineExpanded] = useState<boolean>(false);
    const [isToneExpanded, setIsToneExpanded] = useState<boolean>(false);

    // 使用 ref 跟踪 fileId，避免重复填充
    const lastFileIdRef = useRef<string | null>(null);
    // 保存原始数据，用于 diff 比较
    const originalDataRef = useRef<VisualWorldSetting | WorldWorldSetting | null>(null);

    // 当 gameData 变化时，填充表单数据
    useEffect(() => {
        if (gameData?.worldSetting && gameData?.fileId) {
            const currentFileId = gameData.fileId;

            // 如果 fileId 变化了，说明是新的游戏数据，需要重新填充
            if (lastFileIdRef.current !== currentFileId) {
                lastFileIdRef.current = currentFileId;

                const ws = gameData.worldSetting;
                // 保存原始数据（深拷贝）
                originalDataRef.current = JSON.parse(JSON.stringify(ws));

                let worldRulesText = '';
                if (isVisualMode(gameData) && ws && 'WorldRules' in ws && ws.WorldRules) {
                    worldRulesText = Object.entries(ws.WorldRules)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n');
                } else if (!isVisualMode(gameData) && ws) {
                    if ('WorldRules' in (ws as any) && (ws as any).WorldRules) {
                        const wr = (ws as any).WorldRules as Record<string, string>;
                        worldRulesText = Object.entries(wr)
                            .map(([key, value]) => key === value ? value : `${key}: ${value}`)
                            .join('\n');
                    }
                }

                const player = getPlayer(gameData);
                const playerRace = player && 'race' in player ? player.race : undefined;
                const playerRoleText = player
                    ? `${player.name} (${player.gender}${player.age ? `, ${player.age}岁` : ''}${playerRace ? `, ${playerRace}` : ''})`
                    : '';

                // 更新表单字段
                setWorldFields(defaultFields.map(field => {
                    switch (field.id) {
                        case 'title':
                            return { ...field, value: ws.title || '' };
                        case 'tagline':
                            return { ...field, value: ws.summary || '' };
                        case 'era':
                            return { ...field, value: ws.background || '' };
                        case 'worldRules':
                            return { ...field, value: worldRulesText };
                        case 'playerRole':
                            return { ...field, value: playerRoleText };
                        case 'opening':
                            return { ...field, value: ws.preamble || '' };
                        case 'openingPlot':
                            return { ...field, value: ws.initialPlot || '' };
                        default:
                            return field;
                    }
                }));

                // 填充故事线（从 keyEvents）
                if (ws.keyEvents && ws.keyEvents.length > 0) {
                    setStorylines(ws.keyEvents.map((event: { title?: string; description?: string }, index: number) => ({
                        id: `${index}`,
                        tag: event.title || `事件 ${index + 1}`,
                        content: event.description || '',
                    })));
                } else {
                    setStorylines([]);
                }

                // 填充文风要求
                setToneValue(ws.literary || '');
            }
        }
    }, [gameData]);

    const handleFieldChange = (fieldId: string, value: string) => {
        setWorldFields(prev => {
            const next = prev.map(f => f.id === fieldId ? { ...f, value } : f);
            // 调试输出：实时查看表单字段变化，主要关注 worldRules
            if (fieldId === 'worldRules') {
                // eslint-disable-next-line no-console
                console.log('[WorldPanel] worldRules changed:', value);
            }
            return next;
        });
    };

    const handleToneChange = (value: string) => {
        setToneValue(value);
    };

    const handleStorylineChange = (id: string, key: 'tag' | 'content', value: string) => {
        setStorylines(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));
    };

    const addStoryline = () => {
        setStorylines(prev => [...prev, {
            id: `${Date.now()}`,
            tag: `阶段 ${prev.length + 1}`,
            content: '',
        }]);
    };

    const removeStoryline = (id: string) => {
        setStorylines(prev => prev.filter(s => s.id !== id));
    };

    // 是否为世界交互模式（worldInteraction）
    const isWorldInteractionMode = !!gameData && !isVisualMode(gameData);

    // 将表单数据转换为 WorldSetting 格式（完整数据）
    const getFullWorldSettingData = useCallback((): VisualWorldSetting | WorldWorldSetting | null => {
        if (!gameData?.worldSetting) return null;

        const getFieldValue = (id: string) => worldFields.find(f => f.id === id)?.value ?? '';
        const titleVal = getFieldValue('title');
        const taglineVal = getFieldValue('tagline');
        const eraVal = getFieldValue('era');
        const worldRulesVal = getFieldValue('worldRules');
        const playerRoleVal = getFieldValue('playerRole');
        const openingVal = getFieldValue('opening');
        const openingPlotVal = getFieldValue('openingPlot');

        // 解析世界规则
        // 可同时支持“key: value”形式（视觉模式）和“每行一条规则”形式（worldInteraction 模式）
        const worldRules: { [key: string]: string } = {};
        const worldRulesLines: string[] = [];
        if (worldRulesVal !== undefined) {
            worldRulesVal.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                const colonIndex = trimmedLine.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmedLine.substring(0, colonIndex).trim();
                    const value = trimmedLine.substring(colonIndex + 1).trim();
                    if (key && value) {
                        worldRules[key] = value;
                        worldRulesLines.push(`${key}: ${value}`);
                    }
                } else {
                    // 对于 worldInteraction 模式，后端期望使用 worldRules 字段接收规则
                    // 因此前端也将无冒号的整行作为 key 和 value 写入 WorldRules
                    worldRules[trimmedLine] = trimmedLine;
                    worldRulesLines.push(trimmedLine);
                }
            });
        }

        // 解析玩家信息（从文本格式解析）
        // 使用辅助函数兼容两种模式
        const player = getPlayer(gameData);
        const playerInfo = playerRoleVal || '';
        let playerName = playerInfo ? '' : (player?.name || '');
        let playerGender = playerInfo ? '' : (player?.gender || '');
        let playerAge = playerInfo ? undefined : player?.age;
        let playerRace = playerInfo ? undefined : (player && 'race' in player ? player.race : undefined);

        if (playerInfo) {
            const playerMatch = playerInfo.match(/^(.+?)\s*\((.+?)\)/);
            if (playerMatch) {
                playerName = playerMatch[1].trim();
                const playerDetails = playerMatch[2];
                const ageMatch = playerDetails.match(/(\d+)岁/);
                const raceMatch = playerDetails.match(/,\s*([^,]+)$/);
                const genderMatch = playerDetails.match(/^([^,]+)/);

                if (genderMatch) playerGender = genderMatch[1].trim();
                if (ageMatch) playerAge = parseInt(ageMatch[1]);
                if (raceMatch) playerRace = raceMatch[1].trim();
            } else {
                // 如果没有括号，整个字符串作为名字
                playerName = playerInfo.trim();
            }
        }

        // 转换故事线为 keyEvents
        const keyEvents = storylines.map(line => ({
            title: line.tag,
            description: line.content,
        }));

        // 根据模式构建返回数据
        if (isVisualMode(gameData)) {
            const currentPlayer = player || { name: '', gender: '', appearance: '' };
            return {
                ...gameData.worldSetting,
                title: titleVal,
                summary: taglineVal,
                background: eraVal,
                preamble: openingVal,
                initialPlot: openingPlotVal,
                literary: toneValue ?? '',
                WorldRules: worldRules, // 可为空对象，表示清空
                keyEvents: keyEvents,   // 可为空数组，表示清空
                player: {
                    ...currentPlayer,
                    name: playerName,
                    gender: playerGender,
                    age: playerAge,
                    race: playerRace,
                },
            } as VisualWorldSetting;
        } else {
            // worldInteraction 模式：将世界规则行映射到 Theme（string[]）
            // 允许用户清空规则：如果没有输入，则 Theme 为空数组
            const themeLines = worldRulesLines;

            return {
                ...gameData.worldSetting,
                title: titleVal,
                summary: taglineVal,
                background: eraVal,
                preamble: openingVal,
                initialPlot: openingPlotVal,
                literary: toneValue ?? '',
                keyEvents: keyEvents, // 可为空数组
                Theme: themeLines,
                // worldInteraction 模式下：如果用户在表单中填写了世界规则（key: value 形式），也通过 WorldRules 传给后端
                // 后端初始没有该字段时，本次提交会新增 WorldRules；清空后则传空对象表示清空
                WorldRules: worldRules,
                player: {
                    name: playerName,
                    gender: playerGender,
                    age: playerAge || 0,
                    personality: (player && 'personality' in player) ? player.personality : '',
                    appearance: player?.appearance || '',
                    tone: player?.tone || '',
                    imagePath: (player && 'imagePath' in player) ? player.imagePath : (player?.images?.base || ''),
                },
            } as WorldWorldSetting;
        }
    }, [worldFields, storylines, toneValue, gameData]);

    // 获取修改过的字段（Diff 策略）
    const getWorldSettingData = useCallback((): Partial<VisualWorldSetting> | Partial<WorldWorldSetting> | null => {
        if (!gameData?.worldSetting || !originalDataRef.current) return null;

        const fullData = getFullWorldSettingData();
        if (!fullData) return null;

        const original = originalDataRef.current;
        
        if (isVisualMode(gameData)) {
            const diff: Partial<VisualWorldSetting> = {};
            const orig = original as VisualWorldSetting;
            const full = fullData as VisualWorldSetting;

            // 比较各个字段
            if (full.title !== orig.title) diff.title = full.title;
            if (full.summary !== orig.summary) diff.summary = full.summary;
            if (full.background !== orig.background) diff.background = full.background;
            if (full.preamble !== orig.preamble) diff.preamble = full.preamble;
            if (full.initialPlot !== orig.initialPlot) diff.initialPlot = full.initialPlot;
            if (full.literary !== orig.literary) diff.literary = full.literary;

            // 比较 WorldRules（对象比较）
            if (JSON.stringify(full.WorldRules) !== JSON.stringify(orig.WorldRules)) {
                diff.WorldRules = full.WorldRules;
            }

            // 比较 keyEvents（数组比较）
            if (JSON.stringify(full.keyEvents) !== JSON.stringify(orig.keyEvents)) {
                diff.keyEvents = full.keyEvents;
            }

            // 比较 Theme（数组比较）
            const origTheme = Array.isArray(orig.Theme) ? orig.Theme : [];
            if (JSON.stringify(full.Theme) !== JSON.stringify(origTheme)) {
                diff.Theme = full.Theme;
            }

            // 比较 player（对象比较）
            if (JSON.stringify(full.player) !== JSON.stringify(orig.player)) {
                diff.player = full.player;
            }

            return Object.keys(diff).length > 0 ? diff : null;
        } else {
            const diff: Partial<WorldWorldSetting> = {};
            const orig = original as WorldWorldSetting;
            const full = fullData as WorldWorldSetting;

            // 比较各个字段
            if (full.title !== orig.title) diff.title = full.title;
            if (full.summary !== orig.summary) diff.summary = full.summary;
            if (full.background !== orig.background) diff.background = full.background;
            if (full.preamble !== orig.preamble) diff.preamble = full.preamble;
            if (full.initialPlot !== orig.initialPlot) diff.initialPlot = full.initialPlot;
            if (full.literary !== orig.literary) diff.literary = full.literary;

            // 比较 keyEvents（数组比较）
            if (JSON.stringify(full.keyEvents) !== JSON.stringify(orig.keyEvents)) {
                diff.keyEvents = full.keyEvents;
            }

            // 比较 Theme（数组比较，用于 worldInteraction 下的世界规则行）
            const origTheme = Array.isArray(orig.Theme) ? orig.Theme : [];
            if (JSON.stringify(full.Theme) !== JSON.stringify(origTheme)) {
                diff.Theme = full.Theme;
            }

            // 比较 WorldRules（可选字段）
            const fullWorldRules = (full as any).WorldRules ?? {};
            const origWorldRules = (orig as any).WorldRules ?? {};
            if (JSON.stringify(fullWorldRules) !== JSON.stringify(origWorldRules)) {
                (diff as any).WorldRules = fullWorldRules;
            }

            // 比较 player（对象比较）
            if (JSON.stringify(full.player) !== JSON.stringify(orig.player)) {
                diff.player = full.player;
            }

            return Object.keys(diff).length > 0 ? diff : null;
        }
    }, [getFullWorldSettingData]);

    // 提供给父组件的数据获取函数（只返回修改过的字段）
    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const worldSettingDiff = getWorldSettingData();
                if (!worldSettingDiff) return null;
                // 返回修改过的 worldSetting
                return { worldSetting: worldSettingDiff } as Partial<AllGameData | WorldInteractionGameData>;
            });
        }
    }, [onGetData, getWorldSettingData]);

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 2</p>
                    <h2>世界观 & 表单化设定</h2>
                    <p className={styles.subtitle}>所有内容均来自 AI 解析，请校对这些内容</p>
                </div>
                {handleSubmit && (
                    <button
                        className={styles.primary}
                        onClick={(e) => {
                            e.preventDefault();
                            // worldInteraction 模式下，故事线为必填
                            if (isWorldInteractionMode && storylines.length === 0) {
                                toast.error('请至少添加一条故事线（世界交互模式下为必填）');
                                return;
                            }
                            handleSubmit();
                        }}
                        disabled={!gameData || isSubmitting}
                    >
                        {isSubmitting ? '提交中...' : '确认修改'}
                    </button>
                )}
            </div>

            {/* 单栏表单 */}
            <div className={styles.formContainer}>
                {worldFields.map((field) => (
                    <div key={field.id} className={styles.formRow}>
                        <div className={styles.fieldHeader}>
                            <span className={styles.fieldLabel}>{field.label}</span>
                            {field.hint && <span className={styles.fieldHint}>{field.hint}</span>}
                        </div>
                        {field.type === 'textarea' ? (
                            <textarea
                                rows={field.rows || 3}
                                value={field.value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            />
                        ) : (
                            <input
                                type="text"
                                value={field.value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            />
                        )}
                    </div>
                ))}

                {/* 故事线（可选，可折叠） */}
                <div className={styles.storylineSection}>
                    <div className={styles.storylineHeader} style={{ cursor: 'pointer' }} onClick={() => setIsStorylineExpanded(!isStorylineExpanded)}>
                        <span className={styles.fieldLabel}>
                            {isWorldInteractionMode ? '故事线（必填 · 用于约束世界交互节奏）' : '故事线（可选）'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isStorylineExpanded && (
                                <button
                                    className={styles.ghostSmall}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addStoryline();
                                    }}
                                >
                                    + 添加故事线
                                </button>
                            )}
                            <MdArrowDropDown size={30} style={{ transform: isStorylineExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                        </div>
                    </div>
                    {isStorylineExpanded && (
                        <>
                            <span className={styles.fieldHint} style={{ marginBottom: '16px', display: 'block' }}>用标签 + 内容描述关键剧情走向，方便约束 AI 推演。</span>
                            <div className={styles.storylineList}>
                                {storylines.length === 0 ? (
                                    <p className={styles.emptyHint}>暂未添加故事线。可按时间、好感或章节自定义标签。</p>
                                ) : (
                                    storylines.map((line) => (
                                        <div key={line.id} className={styles.storylineRow}>
                                            <div className={styles.storylineMeta}>
                                                <label>
                                                    <span>标签</span>
                                                    <input
                                                        type="text"
                                                        value={line.tag}
                                                        onChange={(e) => handleStorylineChange(line.id, 'tag', e.target.value)}
                                                    />
                                                </label>
                                            </div>
                                            <label className={styles.wide}>
                                                <span>内容</span>
                                                <textarea
                                                    rows={3}
                                                    value={line.content}
                                                    onChange={(e) => handleStorylineChange(line.id, 'content', e.target.value)}
                                                />
                                            </label>
                                            <button
                                                className={styles.ghostTiny}
                                                onClick={() => removeStoryline(line.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 文风要求（可选，可折叠） */}
                <div className={styles.storylineSection}>
                    <div className={styles.storylineHeader} style={{ marginBottom: isToneExpanded ? '8px' : '0', cursor: 'pointer' }} onClick={() => setIsToneExpanded(!isToneExpanded)}>
                        <span className={styles.fieldLabel}>文风要求（可选）</span>
                        <MdArrowDropDown size={30} style={{ transform: isToneExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </div>
                    {isToneExpanded && (
                        <>
                            <span className={styles.fieldHint} style={{ marginBottom: '8px', display: 'block' }}>限定语言风格、叙述视角、禁用词汇等，帮助 AI 保持统一语气。</span>
                            <textarea
                                rows={4}
                                value={toneValue}
                                onChange={(e) => handleToneChange(e.target.value)}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorldPanel;
