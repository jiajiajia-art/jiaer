import React, { useState, useEffect, useCallback, useRef, useImperativeHandle } from 'react';
import styles from './WorldPanel.module.css';
import type { AllGameData } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { WorldSetting as VisualWorldSetting } from '../../../api/galgame/EditorData.type';
import type { WorldSetting as WorldWorldSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { toast } from 'react-hot-toast';
import { useUnsavedChanges } from '../../../hooks/editor/useUnsavedChanges';
import CoverUpload from './CoverUpload';
import WorldSettingForm from './WorldSettingForm';
import StorylinesSection, { type StoryLine } from './StorylinesSection';
import StorylineModal from './StorylineModal';
import ToneSection from './ToneSection';
import { getPlayerImageUrl } from '../../../utils/constants';

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
    onDataChange?: () => void;
}

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
    onDataChange,
}, ref) => {
    const [title, setTitle] = useState<string>('');
    const [tagline, setTagline] = useState<string>('');
    const [era, setEra] = useState<string>('');
    const [opening, setOpening] = useState<string>('');
    const [openingPlot, setOpeningPlot] = useState<string>('');
    const [playerRole, setPlayerRole] = useState<string>('');
    const [targetOutputLength, setTargetOutputLength] = useState<number | undefined>(undefined);
    const [minOutputLength, setMinOutputLength] = useState<number | undefined>(undefined);
    const [maxOutputLength, setMaxOutputLength] = useState<number | undefined>(undefined);

    const [toneValue, setToneValue] = useState<string>('');
    const [storylines, setStorylines] = useState<StoryLine[]>([]);
    const [isStorylineExpanded, setIsStorylineExpanded] = useState<boolean>(false);
    const [isToneExpanded, setIsToneExpanded] = useState<boolean>(false);
    const [storylineError, setStorylineError] = useState<string>('');
    const [storylineModalVisible, setStorylineModalVisible] = useState<boolean>(false);
    const [editingStoryline, setEditingStoryline] = useState<StoryLine | null>(null);
    const [openingError, setOpeningError] = useState<string>('');
    const [openingPlotError, setOpeningPlotError] = useState<string>('');

    const lastFileIdRef = useRef<string | null>(null);
    const originalDataRef = useRef<VisualWorldSetting | WorldWorldSetting | null>(null);
    const lastWorldSettingSnapshotRef = useRef<string | null>(null);

    const currentFileId = gameData?.fileId || fileId;
    const isWorldInteractionMode = mode === 'worldInteraction';

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

    useImperativeHandle(ref, () => ({
        checkBeforeLeave: getCheckBeforeLeave(),
    }), [getCheckBeforeLeave]);

    useEffect(() => {
        if (!gameData?.worldSetting || !gameData?.fileId) return;

        const nextFileId = gameData.fileId;
        const ws = gameData.worldSetting;
        const currentWorldSettingSnapshot = JSON.stringify(ws);

        const isFileIdChanged = lastFileIdRef.current !== nextFileId;
        if (isFileIdChanged) {
            lastFileIdRef.current = nextFileId;
            lastWorldSettingSnapshotRef.current = currentWorldSettingSnapshot;
            originalDataRef.current = JSON.parse(JSON.stringify(ws));
        } else if (lastWorldSettingSnapshotRef.current !== currentWorldSettingSnapshot) {
            lastWorldSettingSnapshotRef.current = currentWorldSettingSnapshot;
            originalDataRef.current = JSON.parse(JSON.stringify(ws));
            return;
        } else {
            return;
        }

        const player = getPlayer(gameData);
        const playerRace = player && 'race' in player ? player.race : undefined;
        const playerRoleText = player
            ? `${player.name} (${player.gender}${player.age ? `, ${player.age}岁` : ''}${playerRace ? `, ${playerRace}` : ''})`
            : '';

        setTitle(ws.title || '');
        setTagline(ws.summary || '');
        setEra(ws.background || '');
        setPlayerRole(playerRoleText);
        setOpening(ws.preamble || '');
        setOpeningPlot(ws.initialPlot || '');
        setToneValue(ws.literary || '');

        const llmConfig = (ws as { llmConfig?: VisualWorldSetting['llmConfig'] }).llmConfig;
        if (llmConfig) {
            setTargetOutputLength(llmConfig.targetOutputLength);
            setMinOutputLength(llmConfig.minOutputLength);
            setMaxOutputLength(llmConfig.maxOutputLength);
        } else {
            setTargetOutputLength(undefined);
            setMinOutputLength(undefined);
            setMaxOutputLength(undefined);
        }

        if (ws.keyEvents && ws.keyEvents.length > 0) {
            setStorylines(ws.keyEvents.map((event: { title?: string; description?: string }, index: number) => ({
                id: `${Date.now()}-${index}`,
                tag: event.title || `事件 ${index + 1}`,
                content: event.description || '',
                order: index,
                index: index + 1,
            })));
            setStorylineError('');
        } else {
            setStorylines([]);
            if (isWorldInteractionMode) {
                setStorylineError('请至少添加一条故事线（世界交互模式下为必填）');
            }
        }
    }, [gameData, isWorldInteractionMode]);

    const handleToneChange = (value: string) => {
        setToneValue(value);
    };

    const reorderStorylines = (items: StoryLine[]): StoryLine[] => {
        const sorted = [...items].sort((a, b) => a.index - b.index);
        return sorted.map((item, index) => ({
            ...item,
            order: index,
            index: index + 1,
        }));
    };

    const handleStorylineChange = (id: string, key: 'tag' | 'content' | 'index', value: string | number) => {
        setStorylines(prev => {
            if (key === 'index') {
                const newIndex = typeof value === 'number' ? value : parseInt(String(value), 10);
                if (isNaN(newIndex) || newIndex < 1) return prev;

                const currentItem = prev.find(item => item.id === id);
                if (!currentItem) return prev;

                const oldIndex = currentItem.index;
                if (newIndex === oldIndex) return prev;

                const withoutCurrent = prev.filter(item => item.id !== id);
                const adjusted = withoutCurrent.map(item => {
                    if (newIndex < oldIndex && item.index >= newIndex && item.index < oldIndex) {
                        return { ...item, index: item.index + 1 };
                    }
                    if (newIndex > oldIndex && item.index > oldIndex && item.index <= newIndex) {
                        return { ...item, index: item.index - 1 };
                    }
                    return item;
                });

                const result = reorderStorylines([...adjusted, { ...currentItem, index: newIndex }]);
                if (isWorldInteractionMode && result.length > 0) {
                    setStorylineError('');
                }
                return result;
            }

            const updated = prev.map(item => item.id === id ? { ...item, [key]: value } : item);
            if (isWorldInteractionMode && updated.length > 0) {
                setStorylineError('');
            }
            return updated;
        });
    };

    const openAddStorylineModal = () => {
        setEditingStoryline(null);
        setStorylineModalVisible(true);
    };

    const handleSaveStoryline = (data: Omit<StoryLine, 'id' | 'order'>) => {
        if (editingStoryline) {
            handleStorylineChange(editingStoryline.id, 'tag', data.tag);
            handleStorylineChange(editingStoryline.id, 'content', data.content);
            handleStorylineChange(editingStoryline.id, 'index', data.index);
        } else {
            setStorylines(prev => {
                const adjusted = prev.map(item =>
                    item.index >= data.index ? { ...item, index: item.index + 1 } : item,
                );

                const newStoryline: StoryLine = {
                    id: `${Date.now()}`,
                    tag: data.tag,
                    content: data.content,
                    order: prev.length,
                    index: data.index,
                };

                const result = reorderStorylines([...adjusted, newStoryline]);
                if (isWorldInteractionMode) {
                    setStorylineError('');
                }
                return result;
            });
        }

        setStorylineModalVisible(false);
        setEditingStoryline(null);
    };

    const removeStoryline = (id: string) => {
        setStorylines(prev => {
            const reordered = reorderStorylines(prev.filter(item => item.id !== id));
            if (isWorldInteractionMode && reordered.length === 0) {
                setStorylineError('请至少添加一条故事线（世界交互模式下为必填）');
            }
            return reordered;
        });
    };

    const getFullWorldSettingData = useCallback((): VisualWorldSetting | WorldWorldSetting | null => {
        if (!gameData?.worldSetting) return null;

        const player = getPlayer(gameData);
        const sortedStorylines = [...storylines].sort((a, b) => a.index - b.index);
        const keyEvents = sortedStorylines.map(line => ({
            title: line.tag,
            description: line.content,
        }));

        if (mode === 'visual') {
            const currentPlayer = player || { name: '', gender: '', appearance: '' };
            const llmConfig = (targetOutputLength !== undefined || minOutputLength !== undefined || maxOutputLength !== undefined)
                ? {
                    targetOutputLength,
                    minOutputLength,
                    maxOutputLength,
                }
                : undefined;

            return {
                ...gameData.worldSetting,
                title,
                summary: tagline,
                background: era,
                preamble: opening,
                initialPlot: openingPlot,
                literary: toneValue ?? '',
                keyEvents,
                player: currentPlayer,
                llmConfig,
            } as VisualWorldSetting;
        }

        const worldPlayer = player ? {
            name: player.name || '',
            gender: player.gender || '',
            age: player.age || 0,
            personality: 'personality' in player ? player.personality : '',
            appearance: player.appearance || '',
            tone: player.tone || '',
            imagePath: getPlayerImageUrl(player, ''),
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
            title,
            summary: tagline,
            background: era,
            preamble: opening,
            initialPlot: openingPlot,
            literary: toneValue ?? '',
            keyEvents,
            player: worldPlayer,
        } as unknown as WorldWorldSetting;
    }, [
        era,
        gameData,
        maxOutputLength,
        minOutputLength,
        mode,
        opening,
        openingPlot,
        storylines,
        tagline,
        targetOutputLength,
        title,
        toneValue,
    ]);

    const getWorldSettingData = useCallback((): Partial<VisualWorldSetting> | Partial<WorldWorldSetting> | null => {
        if (!gameData?.worldSetting || !originalDataRef.current) {
            return null;
        }

        const fullData = getFullWorldSettingData();
        if (!fullData) return null;

        const original = originalDataRef.current;
        const isStrDiff = (a: unknown, b: unknown) => (a || '') !== (b || '');
        const hasLen = (arr: unknown) => Array.isArray(arr) && arr.length > 0;

        if (mode === 'visual') {
            const diff: Partial<VisualWorldSetting> = {};
            const orig = original as VisualWorldSetting;
            const full = fullData as VisualWorldSetting;

            if (isStrDiff(full.title, orig.title)) diff.title = full.title;
            if (isStrDiff(full.summary, orig.summary)) diff.summary = full.summary;
            if (isStrDiff(full.background, orig.background)) diff.background = full.background;
            if (isStrDiff(full.preamble, orig.preamble)) diff.preamble = full.preamble;
            if (isStrDiff(full.initialPlot, orig.initialPlot)) diff.initialPlot = full.initialPlot;
            if (isStrDiff(full.literary, orig.literary)) diff.literary = full.literary;

            const fullKeyEvents = full.keyEvents || [];
            if (hasLen(fullKeyEvents) && JSON.stringify(fullKeyEvents) !== JSON.stringify(orig.keyEvents || [])) {
                diff.keyEvents = fullKeyEvents;
            }

            const fullTheme = full.Theme || [];
            const origTheme = orig.Theme || [];
            if (hasLen(fullTheme) && JSON.stringify(fullTheme) !== JSON.stringify(origTheme)) {
                diff.Theme = fullTheme;
            }

            if (JSON.stringify(full.llmConfig || {}) !== JSON.stringify(orig.llmConfig || {})) {
                diff.llmConfig = full.llmConfig;
            }

            return Object.keys(diff).length > 0 ? diff : null;
        }

        const diff: Partial<WorldWorldSetting> = {};
        const orig = original as WorldWorldSetting;
        const full = fullData as WorldWorldSetting;

        if (isStrDiff(full.title, orig.title)) diff.title = full.title;
        if (isStrDiff(full.summary, orig.summary)) diff.summary = full.summary;
        if (isStrDiff(full.background, orig.background)) diff.background = full.background;
        if (isStrDiff(full.preamble, orig.preamble)) diff.preamble = full.preamble;
        if (isStrDiff(full.initialPlot, orig.initialPlot)) diff.initialPlot = full.initialPlot;
        if (isStrDiff(full.literary, orig.literary)) diff.literary = full.literary;

        const fullKeyEvents = full.keyEvents || [];
        if (hasLen(fullKeyEvents) && JSON.stringify(fullKeyEvents) !== JSON.stringify(orig.keyEvents || [])) {
            diff.keyEvents = fullKeyEvents;
        }

        const fullTheme = full.Theme || [];
        const origTheme = orig.Theme || [];
        if (hasLen(fullTheme) && JSON.stringify(fullTheme) !== JSON.stringify(origTheme)) {
            diff.Theme = fullTheme;
        }

        return Object.keys(diff).length > 0 ? diff : null;
    }, [gameData, getFullWorldSettingData, mode]);

    useEffect(() => {
        if (!originalDataRef.current) {
            return;
        }
        setHasUnsavedChanges(getWorldSettingData() !== null);
    }, [getWorldSettingData, setHasUnsavedChanges]);

    useEffect(() => {
        if (!onGetData) {
            return;
        }

        onGetData(() => {
            const worldSettingDiff = getWorldSettingData();
            if (!worldSettingDiff) return null;
            return { worldSetting: worldSettingDiff } as Partial<AllGameData | WorldInteractionGameData>;
        });
    }, [getWorldSettingData, onGetData]);

    // 统一处理世界观表单提交校验。
    const handleConfirmSubmit = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        const openingTrimmed = opening.trim();
        if (!openingTrimmed) {
            setOpeningError('开场白为必填字段，请填写后再提交');
            toast.error('开场白为必填字段，请填写后再提交');
            return;
        }
        setOpeningError('');

        const openingPlotTrimmed = openingPlot.trim();
        if (!openingPlotTrimmed) {
            setOpeningPlotError('开场剧情为必填字段，请填写后再提交');
            toast.error('开场剧情为必填字段，请填写后再提交');
            return;
        }
        setOpeningPlotError('');

        if (isWorldInteractionMode && storylines.length === 0) {
            setStorylineError('请至少添加一条故事线（世界交互模式下为必填）');
            setIsStorylineExpanded(true);
            toast.error('请至少添加一条故事线（世界交互模式下为必填）');
            return;
        }
        setStorylineError('');

        handleSubmit?.();
    }, [handleSubmit, isWorldInteractionMode, opening, openingPlot, storylines.length]);

    return (
        <div className={styles.panelContent}>
            <CoverUpload
                fileId={currentFileId}
                coverUrl={gameData?.coverUrl || undefined}
                onCoverUploaded={() => {
                    onDataChange?.();
                }}
            />

            <div className={styles.panelHeader}>
                <div>
                    <h2>世界观 & 表单化设定</h2>
                    <p className={styles.subtitle}>所有内容均来自 AI 解析，请校对这些内容</p>
                </div>
            </div>

            {SaveConfirmModalComponent}

            <div className={styles.formContainer}>
                {/* 实现世界观设定标题与右上角确认按钮。 */}
                <div className={styles.cardHead}>
                    <strong className={styles.cardTitle}>世界观设定</strong>
                    {handleSubmit && (
                        <button
                            className={styles.ghostSmall}
                            onClick={handleConfirmSubmit}
                            disabled={!gameData || isSubmitting}
                        >
                            {isSubmitting ? '提交中...' : '确认修改'}
                        </button>
                    )}
                </div>

                <div className={styles.formBody}>
                    <WorldSettingForm
                        mode={mode}
                        title={title}
                        tagline={tagline}
                        era={era}
                        playerRole={playerRole}
                        opening={opening}
                        openingPlot={openingPlot}
                        targetOutputLength={targetOutputLength}
                        minOutputLength={minOutputLength}
                        maxOutputLength={maxOutputLength}
                        onTitleChange={setTitle}
                        onTaglineChange={setTagline}
                        onEraChange={setEra}
                        onOpeningChange={(value) => {
                            setOpening(value);
                            if (openingError && value.trim()) {
                                setOpeningError('');
                            }
                        }}
                        onOpeningPlotChange={(value) => {
                            setOpeningPlot(value);
                            if (openingPlotError && value.trim()) {
                                setOpeningPlotError('');
                            }
                        }}
                        onTargetOutputLengthChange={setTargetOutputLength}
                        onMinOutputLengthChange={setMinOutputLength}
                        onMaxOutputLengthChange={setMaxOutputLength}
                        openingError={openingError}
                        openingPlotError={openingPlotError}
                    />

                    <StorylinesSection
                        storylines={storylines}
                        isExpanded={isStorylineExpanded}
                        error={storylineError}
                        isWorldInteractionMode={isWorldInteractionMode}
                        onToggleExpand={() => setIsStorylineExpanded(!isStorylineExpanded)}
                        onAddStoryline={openAddStorylineModal}
                        onStorylineChange={handleStorylineChange}
                        onRemoveStoryline={removeStoryline}
                    />

                    <StorylineModal
                        visible={storylineModalVisible}
                        storyline={editingStoryline}
                        defaultIndex={storylines.length > 0 ? Math.max(...storylines.map(item => item.index)) + 1 : 1}
                        maxIndex={storylines.length + 10}
                        onClose={() => {
                            setStorylineModalVisible(false);
                            setEditingStoryline(null);
                        }}
                        onSave={handleSaveStoryline}
                    />

                    <ToneSection
                        value={toneValue}
                        isExpanded={isToneExpanded}
                        onToggleExpand={() => setIsToneExpanded(!isToneExpanded)}
                        onChange={handleToneChange}
                    />
                </div>
            </div>
        </div>
    );
});

WorldPanel.displayName = 'WorldPanel';
export default WorldPanel;
