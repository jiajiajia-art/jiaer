import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './WorldPanel.module.css';
import type { AllGameData, WorldSetting } from '../../api/galgame/EditorData.type';
import { MdArrowDropDown } from 'react-icons/md';
import EditorApi from '../../api/galgame/EditorData';

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
    gameData?: AllGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData> | null) => void;
    handleSubmit?: () => void;
    isSubmitting?: boolean;
    fileId?: string;
}

const WorldPanel: React.FC<WorldPanelProps> = ({ gameData, onGetData, handleSubmit, isSubmitting = false, fileId }) => {

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
    const originalDataRef = useRef<WorldSetting | null>(null);

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

                const worldRulesText = ws.WorldRules
                    ? Object.entries(ws.WorldRules).map(([key, value]) => `${key}: ${value}`).join('\n')
                    : '';
                const playerRoleText = ws.player
                    ? `${ws.player.name} (${ws.player.gender}${ws.player.age ? `, ${ws.player.age}岁` : ''}${ws.player.race ? `, ${ws.player.race}` : ''})`
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
                    setStorylines(ws.keyEvents.map((event, index) => ({
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
        setWorldFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f));
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

    // 将表单数据转换为 WorldSetting 格式（完整数据）
    const getFullWorldSettingData = useCallback((): WorldSetting | null => {
        if (!gameData?.worldSetting) return null;

        const titleField = worldFields.find(f => f.id === 'title');
        const taglineField = worldFields.find(f => f.id === 'tagline');
        const eraField = worldFields.find(f => f.id === 'era');
        const worldRulesField = worldFields.find(f => f.id === 'worldRules');
        const playerRoleField = worldFields.find(f => f.id === 'playerRole');
        const openingField = worldFields.find(f => f.id === 'opening');
        const openingPlotField = worldFields.find(f => f.id === 'openingPlot');

        // 解析世界规则（从文本格式转换回对象）
        const worldRules: { [key: string]: string } = {};
        if (worldRulesField?.value) {
            worldRulesField.value.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const colonIndex = trimmedLine.indexOf(':');
                    if (colonIndex > 0) {
                        const key = trimmedLine.substring(0, colonIndex).trim();
                        const value = trimmedLine.substring(colonIndex + 1).trim();
                        if (key && value) {
                            worldRules[key] = value;
                        }
                    }
                }
            });
        }

        // 解析玩家信息（从文本格式解析）
        const playerInfo = playerRoleField?.value || '';
        let playerName = gameData.worldSetting.player?.name || '';
        let playerGender = gameData.worldSetting.player?.gender || '';
        let playerAge = gameData.worldSetting.player?.age;
        let playerRace = gameData.worldSetting.player?.race;

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
        const keyEvents = storylines.length > 0
            ? storylines.map(line => ({
                title: line.tag,
                description: line.content,
            }))
            : gameData.worldSetting.keyEvents;

        return {
            ...gameData.worldSetting,
            title: titleField?.value || gameData.worldSetting.title,
            summary: taglineField?.value || gameData.worldSetting.summary,
            background: eraField?.value || gameData.worldSetting.background,
            preamble: openingField?.value || gameData.worldSetting.preamble,
            initialPlot: openingPlotField?.value || gameData.worldSetting.initialPlot,
            literary: toneValue || gameData.worldSetting.literary,
            WorldRules: Object.keys(worldRules).length > 0 ? worldRules : gameData.worldSetting.WorldRules,
            keyEvents: keyEvents,
            player: {
                ...gameData.worldSetting.player,
                name: playerName,
                gender: playerGender,
                age: playerAge,
                race: playerRace,
            },
        };
    }, [worldFields, storylines, toneValue, gameData]);

    // 获取修改过的字段（Diff 策略）
    const getWorldSettingData = useCallback((): Partial<WorldSetting> | null => {
        if (!gameData?.worldSetting || !originalDataRef.current) return null;

        const fullData = getFullWorldSettingData();
        if (!fullData) return null;

        const original = originalDataRef.current;
        const diff: Partial<WorldSetting> = {};

        // 比较各个字段
        if (fullData.title !== original.title) {
            diff.title = fullData.title;
        }
        if (fullData.summary !== original.summary) {
            diff.summary = fullData.summary;
        }
        if (fullData.background !== original.background) {
            diff.background = fullData.background;
        }
        if (fullData.preamble !== original.preamble) {
            diff.preamble = fullData.preamble;
        }
        if (fullData.initialPlot !== original.initialPlot) {
            diff.initialPlot = fullData.initialPlot;
        }
        if (fullData.literary !== original.literary) {
            diff.literary = fullData.literary;
        }

        // 比较 WorldRules（对象比较）
        const worldRulesChanged = JSON.stringify(fullData.WorldRules) !== JSON.stringify(original.WorldRules);
        if (worldRulesChanged) {
            diff.WorldRules = fullData.WorldRules;
        }

        // 比较 keyEvents（数组比较）
        const keyEventsChanged = JSON.stringify(fullData.keyEvents) !== JSON.stringify(original.keyEvents);
        if (keyEventsChanged) {
            diff.keyEvents = fullData.keyEvents;
        }

        // 比较 player（对象比较）
        const playerChanged = JSON.stringify(fullData.player) !== JSON.stringify(original.player);
        if (playerChanged) {
            diff.player = fullData.player;
        }

        // 如果没有任何修改，返回 null
        if (Object.keys(diff).length === 0) {
            return null;
        }

        return diff;
    }, [getFullWorldSettingData]);

    // 提供给父组件的数据获取函数（只返回修改过的字段）
    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const worldSettingDiff = getWorldSettingData();
                if (!worldSettingDiff) return null;
                // 类型断言：Partial<WorldSetting> 可以安全地作为 Partial<AllGameData> 的一部分
                return { worldSetting: worldSettingDiff } as Partial<AllGameData>;
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
                            handleSubmit();
                        }}
                        disabled={!fileId || !gameData || isSubmitting}
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
                        <span className={styles.fieldLabel}>故事线（可选）</span>
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
                        <MdArrowDropDown size={30} style={{ transform: isStorylineExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
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
