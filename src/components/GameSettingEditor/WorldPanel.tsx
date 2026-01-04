import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './WorldPanel.module.css';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';
import type { WorldSetting as VisualWorldSetting } from '../../api/galgame/EditorData.type';
import type { WorldSetting as WorldWorldSetting } from '../../api/worldInteraction/worldInteractionApi.type';
import { MdArrowDropDown } from 'react-icons/md';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
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

const WorldPanel: React.FC<WorldPanelProps> = ({
    gameData,
    onGetData,
    handleSubmit,
    isSubmitting = false,
    fileId,
    mode = 'visual',
}) => {
    const defaultFields: WorldField[] = [
        { id: 'title', label: '作品标题', type: 'text', value: '' },
        { id: 'tagline', label: '一句话概述', type: 'text', value: '' },
        { id: 'era', label: '时代背景 / 前情提要', type: 'textarea', rows: 6, value: '' },
        { id: 'worldRules', label: '世界规则', type: 'textarea', rows: 4, value: '' },
        { id: 'playerRole', label: '玩家身份', type: 'text', value: '' },
        { id: 'opening', label: '开场白', type: 'textarea', rows: 5, value: '', hint: '用于玩家进入游戏时的第一段旁白，可随时微调语气。' },
        { id: 'openingPlot', label: '开场剧情', type: 'textarea', rows: 5, value: '', hint: '描述第一轮推演至玩家做出首个选择前的剧情骨架，用于引导 AI 理解节奏。' },
    ];

    const [toneValue, setToneValue] = useState<string>('');
    const [worldFields, setWorldFields] = useState<WorldField[]>(defaultFields);
    const [storylines, setStorylines] = useState<StoryLine[]>([]);
    const [isStorylineExpanded, setIsStorylineExpanded] = useState<boolean>(false);
    const [isToneExpanded, setIsToneExpanded] = useState<boolean>(false);
    const [storylineError, setStorylineError] = useState<string>('');

    const lastFileIdRef = useRef<string | null>(null);
    const originalDataRef = useRef<VisualWorldSetting | WorldWorldSetting | null>(null);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);

    const currentFileId = gameData?.fileId || fileId;

    useEffect(() => {
        if (!gameData?.worldSetting || !gameData?.fileId) return;

        const currentFileId = gameData.fileId;
        if (lastFileIdRef.current === currentFileId) return;

        lastFileIdRef.current = currentFileId;
        const ws = gameData.worldSetting;
        originalDataRef.current = JSON.parse(JSON.stringify(ws));

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

    const handleFieldChange = (fieldId: string, value: string) => {
        setWorldFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f));
    };

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

    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setCoverError('请上传图片文件');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setCoverError('图片大小不能超过 5MB');
            return;
        }

        setCoverError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCoverPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        uploadCover(file);
    };

    const handleCoverClick = () => {
        coverInputRef.current?.click();
    };

    const handleRemoveCover = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCoverPreview(null);
        coverInputRef.current && (coverInputRef.current.value = '');
    };

    const uploadCover = useCallback(async (file: File) => {
        if (!currentFileId) {
            setCoverError('缺少文件ID，无法上传封面');
            return;
        }
        try {
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(currentFileId, file);
            if (response.data.success) {
                toast.success('封面上传成功');
            }
        } catch (error) {
            console.error('上传封面失败:', error);
            setCoverError('封面上传失败，请重试');
        } finally {
            setCoverUploading(false);
        }
    }, [currentFileId]);

    const isWorldInteractionMode = mode === 'worldInteraction';

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

        // 解析世界规则：支持 "key: value" 形式（视觉模式）和 "每行一条规则" 形式（worldInteraction 模式）
        const worldRules: { [key: string]: string } = {};
        const worldRulesLines: string[] = [];
        if (worldRulesVal) {
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
                    worldRules[trimmedLine] = trimmedLine;
                    worldRulesLines.push(trimmedLine);
                }
            });
        }

        // 解析玩家信息（从文本格式解析）
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
                playerName = playerInfo.trim();
            }
        }

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
                WorldRules: worldRules,
                keyEvents: keyEvents,
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
            } as unknown as WorldWorldSetting;
        }
    }, [worldFields, storylines, toneValue, gameData, mode]);

    // 获取修改过的字段（Diff 策略）
    const getWorldSettingData = useCallback((): Partial<VisualWorldSetting> | Partial<WorldWorldSetting> | null => {
        if (!gameData?.worldSetting || !originalDataRef.current) return null;

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

            const origTheme = Array.isArray(orig.Theme) ? orig.Theme : [];
            if (JSON.stringify(full.Theme) !== JSON.stringify(origTheme)) {
                diff.Theme = full.Theme;
            }

            if (JSON.stringify(full.player) !== JSON.stringify(orig.player)) {
                diff.player = full.player;
            }

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

            if (JSON.stringify(full.player) !== JSON.stringify(orig.player)) {
                diff.player = full.player;
            }

            return Object.keys(diff).length > 0 ? diff : null;
        }
    }, [getFullWorldSettingData, gameData, mode]);

    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const worldSettingDiff = getWorldSettingData();
                if (!worldSettingDiff) return null;
                return { worldSetting: worldSettingDiff } as Partial<AllGameData | WorldInteractionGameData>;
            });
        }
    }, [onGetData, getWorldSettingData]);

    return (
        <div className={styles.panelContent}>
            <div className={styles.uploadCover}>
                <p className={styles.eyebrow}>Step 2</p>
                <h2>游戏封面图片上传</h2>
                <div className={styles.coverUploadArea} onClick={handleCoverClick}>
                    <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,image/webp"
                        hidden
                        onChange={handleCoverSelect}
                        disabled={coverUploading || !currentFileId}
                    />
                    {coverPreview ? (
                        <div className={styles.coverPreviewContainer}>
                            <img src={coverPreview} alt="封面预览" className={styles.coverPreview} />
                            <div className={styles.coverActions}>
                                <button
                                    type="button"
                                    className={styles.removeCoverBtn}
                                    onClick={handleRemoveCover}
                                    disabled={coverUploading}
                                >
                                    移除
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.coverPlaceholder}>
                            <BsUpload className={styles.coverUploadIcon} size={32} />
                            <p className={styles.coverUploadText}>点击上传封面图片</p>
                            <p className={styles.coverUploadHint}>支持 JPG、PNG、WEBP，最大 5MB</p>
                        </div>
                    )}
                </div>
                {coverError && (
                    <p className={styles.coverErrorText}>{coverError}</p>
                )}
            </div>
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

                <div className={styles.storylineSection}>
                    <div className={styles.storylineHeader} style={{ cursor: 'pointer' }} onClick={() => setIsStorylineExpanded(!isStorylineExpanded)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <span className={styles.fieldLabel}>
                                {isWorldInteractionMode ? (
                                    <>
                                        故事线
                                        <span className={styles.required}>*</span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: '8px' }}>（必填）</span>
                                    </>
                                ) : (
                                    '故事线（可选）'
                                )}
                            </span>
                            {isWorldInteractionMode && (
                                <span className={styles.fieldHint} style={{ fontSize: '0.8rem', color: 'rgba(224, 61, 75, 0.8)' }}>
                                    用于约束世界交互节奏，必须至少添加一条
                                </span>
                            )}
                            {!isStorylineExpanded && isWorldInteractionMode && storylines.length === 0 && (
                                <span className={styles.errorText} style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                                    请添加至少一条故事线
                                </span>
                            )}
                        </div>
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
                            {storylineError && (
                                <span className={styles.errorText} style={{ marginBottom: '12px', display: 'block' }}>{storylineError}</span>
                            )}
                            <div className={styles.storylineList}>
                                {storylines.length === 0 ? (
                                    <p className={isWorldInteractionMode ? styles.emptyHintRequired : styles.emptyHint}>
                                        {isWorldInteractionMode 
                                            ? '⚠️ 请至少添加一条故事线（世界交互模式下为必填项）' 
                                            : '暂未添加故事线。可按时间、好感或章节自定义标签。'}
                                    </p>
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
