import React, { useState, useEffect, useCallback, useRef, useImperativeHandle } from 'react';
import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import getGameDataApi from '../../../api/home/getGameData';
import gameTagsApi from '../../../api/gameTags/gameTagsApi';
import { flattenThemeTags, type FlatThemeTag } from '../../../utils/themeTags';

const WORLD_PANEL_TOAST_DURATION = 2200;

export interface WorldPanelRef {
    checkBeforeLeave: (action?: () => void) => boolean;
}

interface WorldPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    handleSubmit?: (options?: { onSuccess?: () => void }) => Promise<boolean>;
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

const normalizeThemeTagIds = (ids: unknown): number[] =>
    Array.isArray(ids)
        ? ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];

const isSameThemeTagIds = (left: number[], right: number[]) =>
    JSON.stringify([...left].sort((a, b) => a - b)) === JSON.stringify([...right].sort((a, b) => a - b));

const resolveInitialThemeTagIds = (
    data: AllGameData | WorldInteractionGameData | null | undefined,
    themeTags: FlatThemeTag[],
    persistedThemeTagIds: number[] = [],
): number[] => {
    const detailTagIds = normalizeThemeTagIds(
        persistedThemeTagIds.length > 0
            ? persistedThemeTagIds
            : (data as { theme_tag_ids?: number[] } | undefined)?.theme_tag_ids,
    );
    if (detailTagIds.length > 0) {
        const validThemeTagIds = new Set(themeTags.map((tag) => tag.id));
        return detailTagIds.filter((id) => validThemeTagIds.has(id));
    }

    const themeNames = Array.isArray((data?.worldSetting as { Theme?: string[] } | undefined)?.Theme)
        ? (((data?.worldSetting as { Theme?: string[] } | undefined)?.Theme) || []).map((name) => String(name))
        : [];
    if (themeNames.length === 0 || themeTags.length === 0) {
        return [];
    }

    return themeTags
        .filter((tag) => themeNames.includes(tag.name))
        .map((tag) => tag.id);
};

interface WorldFieldDirtyState {
    title: boolean;
    tagline: boolean;
    era: boolean;
    opening: boolean;
    openingPlot: boolean;
    outputLength: boolean;
}

const EMPTY_WORLD_FIELD_DIRTY_STATE: WorldFieldDirtyState = {
    title: false,
    tagline: false,
    era: false,
    opening: false,
    openingPlot: false,
    outputLength: false,
};

const WorldPanel = React.forwardRef<WorldPanelRef, WorldPanelProps>(({
    gameData,
    onGetData,
    handleSubmit,
    isSubmitting = false,
    fileId,
    mode = 'visual',
    onDataChange,
}, ref) => {
    const { t } = useTranslation();
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
    const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
    const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
    const [persistedThemeTagIds, setPersistedThemeTagIds] = useState<number[]>([]);
    const [themeTagError, setThemeTagError] = useState<string>('');

    const lastFileIdRef = useRef<string | null>(null);
    const originalDataRef = useRef<VisualWorldSetting | WorldWorldSetting | null>(null);
    const lastWorldSettingSnapshotRef = useRef<string | null>(null);
    const lastAppliedGameDataSnapshotRef = useRef<string | null>(null);
    const originalThemeTagIdsRef = useRef<number[]>([]);
    const hasTouchedThemeTagsRef = useRef(false);
    const saveWorldSettingChangesRef = useRef<(() => Promise<boolean>) | null>(null);
    const hasUnsavedChangesRef = useRef(false);
    const pendingLeaveActionRef = useRef<(() => void) | null>(null);
    const isLeaveActionPendingRef = useRef(false);

    const currentFileId = gameData?.fileId || fileId;
    const isWorldInteractionMode = mode === 'worldInteraction';
    const displayThemeTags = React.useMemo(
        // 实现 Step2 展示全部可选末级标签
        () => availableThemeTags,
        [availableThemeTags],
    );

    const {
        hasUnsavedChanges,
        setHasUnsavedChanges,
        SaveConfirmModalComponent,
        getCheckBeforeLeave,
    } = useUnsavedChanges({
        onSave: async () => {
            if (saveWorldSettingChangesRef.current) {
                return await saveWorldSettingChangesRef.current();
            }
            return false;
        },
    });

    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);

    const defaultCheckBeforeLeave = React.useMemo(() => getCheckBeforeLeave(), [getCheckBeforeLeave]);

    const executePendingLeaveAction = useCallback(() => {
        const action = pendingLeaveActionRef.current;
        pendingLeaveActionRef.current = null;
        action?.();
    }, []);

    const showWorldPanelErrorToast = useCallback((message: string) => {
        toast.error(message, { duration: WORLD_PANEL_TOAST_DURATION });
    }, []);

    const clearLeaveActionState = useCallback((clearUnsavedChanges: boolean) => {
        isLeaveActionPendingRef.current = false;
        if (clearUnsavedChanges) {
            hasUnsavedChangesRef.current = false;
            setHasUnsavedChanges(false);
        }
    }, [setHasUnsavedChanges]);

    useEffect(() => {
        let cancelled = false;

        const fetchThemeTags = async () => {
            try {
                const resp = await gameTagsApi.getGameTagsTree();
                if (!resp.data?.success || cancelled) return;
                const tags = flattenThemeTags(resp.data.data || []);
                setAvailableThemeTags(tags);
            } catch (error) {
                console.error('加载作品标签失败:', error);
            }
        };

        void fetchThemeTags();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchSelectedThemeTags = async () => {
            if (!currentFileId) {
                setPersistedThemeTagIds([]);
                return;
            }

            try {
                const resp = await getGameDataApi.getGameDetail({ fileId: currentFileId });
                if (!resp.data?.success || cancelled) return;
                const nextThemeTagIds = normalizeThemeTagIds(resp.data.data?.theme_tag_ids);
                // 实现编辑页作品标签回显
                setPersistedThemeTagIds(nextThemeTagIds);
            } catch (error) {
                if (!cancelled) {
                    console.error('加载编辑作品标签失败:', error);
                    setPersistedThemeTagIds([]);
                }
            }
        };

        void fetchSelectedThemeTags();

        return () => {
            cancelled = true;
        };
    }, [currentFileId]);

    useEffect(() => {
        if (!gameData?.worldSetting || !gameData?.fileId) return;

        const nextFileId = gameData.fileId;
        const ws = gameData.worldSetting;
        const currentWorldSettingSnapshot = JSON.stringify(ws);

        const isFileIdChanged = lastFileIdRef.current !== nextFileId;
        if (isFileIdChanged) {
            lastFileIdRef.current = nextFileId;
            lastWorldSettingSnapshotRef.current = currentWorldSettingSnapshot;
            lastAppliedGameDataSnapshotRef.current = currentWorldSettingSnapshot;
            originalDataRef.current = JSON.parse(JSON.stringify(ws));
            hasTouchedThemeTagsRef.current = false;
        } else if (lastAppliedGameDataSnapshotRef.current !== currentWorldSettingSnapshot) {
            lastAppliedGameDataSnapshotRef.current = currentWorldSettingSnapshot;
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
                setStorylineError(t('createGame.storylineRequired'));
            }
        }
        const initialThemeTagIds = resolveInitialThemeTagIds(gameData, displayThemeTags, persistedThemeTagIds);
        originalThemeTagIdsRef.current = initialThemeTagIds;
        setSelectedThemeTagIds(initialThemeTagIds);
        setThemeTagError('');
    }, [displayThemeTags, gameData, isWorldInteractionMode, persistedThemeTagIds]);

    useEffect(() => {
        if (!gameData?.worldSetting) return;

        const initialThemeTagIds = resolveInitialThemeTagIds(gameData, displayThemeTags, persistedThemeTagIds);
        if (!isSameThemeTagIds(initialThemeTagIds, originalThemeTagIdsRef.current)) {
            if (hasTouchedThemeTagsRef.current) {
                return;
            }
            // 实现题材回填同步
            originalThemeTagIdsRef.current = initialThemeTagIds;
            setSelectedThemeTagIds(initialThemeTagIds);
            setThemeTagError('');
        }
    }, [displayThemeTags, gameData, persistedThemeTagIds]);

    const handleToneChange = (value: string) => {
        setToneValue(value);
    };

    const handleThemeTagToggle = useCallback((tagId: number) => {
        hasTouchedThemeTagsRef.current = true;
        setSelectedThemeTagIds((prev) => {
            if (prev.includes(tagId)) {
                const next = prev.filter((id) => id !== tagId);
                if (next.length > 0) {
                    setThemeTagError('');
                }
                return next;
            }
            if (prev.length >= 2) {
                showWorldPanelErrorToast(t('createGame.themeTagMax2'));
                return prev;
            }
            setThemeTagError('');
            return [...prev, tagId];
        });
    }, [showWorldPanelErrorToast]);

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
                setStorylineError(t('createGame.storylineRequired'));
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
        const themeNames = selectedThemeTagIds
            .map((id) => availableThemeTags.find((tag) => tag.id === id)?.name || '')
            .filter((name) => !!name);

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
                Theme: themeNames,
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
            Theme: themeNames,
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
        availableThemeTags,
        selectedThemeTagIds,
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

    const getWorldFieldDirtyState = useCallback((): WorldFieldDirtyState => {
        if (!originalDataRef.current) {
            return EMPTY_WORLD_FIELD_DIRTY_STATE;
        }

        const original = originalDataRef.current as VisualWorldSetting & WorldWorldSetting;
        const originalLlmConfig = (original as { llmConfig?: VisualWorldSetting['llmConfig'] }).llmConfig;

        return {
            title: title !== (original.title || ''),
            tagline: tagline !== (original.summary || ''),
            era: era !== (original.background || ''),
            opening: opening !== (original.preamble || ''),
            openingPlot: openingPlot !== (original.initialPlot || ''),
            outputLength:
                (targetOutputLength ?? undefined) !== (originalLlmConfig?.targetOutputLength ?? undefined)
                || (minOutputLength ?? undefined) !== (originalLlmConfig?.minOutputLength ?? undefined)
                || (maxOutputLength ?? undefined) !== (originalLlmConfig?.maxOutputLength ?? undefined),
        };
    }, [
        era,
        maxOutputLength,
        minOutputLength,
        opening,
        openingPlot,
        tagline,
        targetOutputLength,
        title,
    ]);

    const worldFieldDirtyState = getWorldFieldDirtyState();

    const syncSavedBaseline = useCallback((
        savedWorldSetting: VisualWorldSetting | WorldWorldSetting,
        savedThemeTagIds: number[],
    ) => {
        // 实现世界观保存后同步基线
        originalDataRef.current = JSON.parse(JSON.stringify(savedWorldSetting));
        lastWorldSettingSnapshotRef.current = JSON.stringify(savedWorldSetting);
        lastAppliedGameDataSnapshotRef.current = lastAppliedGameDataSnapshotRef.current;
        originalThemeTagIdsRef.current = [...savedThemeTagIds];
        hasTouchedThemeTagsRef.current = false;
        hasUnsavedChangesRef.current = false;
        setPersistedThemeTagIds([...savedThemeTagIds]);
        setHasUnsavedChanges(false);
    }, [setHasUnsavedChanges]);

    const validateWorldSettingBeforeSave = useCallback(() => {
        const openingTrimmed = opening.trim();
        if (!openingTrimmed) {
            setOpeningError(t('createGame.openingRequired'));
            showWorldPanelErrorToast(t('createGame.openingRequired'));
            return false;
        }
        setOpeningError('');

        const openingPlotTrimmed = openingPlot.trim();
        if (!openingPlotTrimmed) {
            setOpeningPlotError(t('createGame.openingPlotRequired'));
            showWorldPanelErrorToast(t('createGame.openingPlotRequired'));
            return false;
        }
        setOpeningPlotError('');

        // 实现题材标签保存校验
        if (selectedThemeTagIds.length < 1 || selectedThemeTagIds.length > 2) {
            setThemeTagError(t('createGame.themeTagRequired'));
            showWorldPanelErrorToast(t('createGame.themeTagRequiredMax2'));
            return false;
        }
        setThemeTagError('');

        if (isWorldInteractionMode && storylines.length === 0) {
            setStorylineError(t('createGame.storylineRequired'));
            setIsStorylineExpanded(true);
            showWorldPanelErrorToast('请至少添加一条故事线（世界交互模式下为必填）');
            return false;
        }
        setStorylineError('');
        return true;
    }, [isWorldInteractionMode, opening, openingPlot, selectedThemeTagIds.length, showWorldPanelErrorToast, storylines.length]);

    const saveWorldSettingChanges = useCallback(async () => {
        if (!handleSubmit) {
            return false;
        }

        if (!validateWorldSettingBeforeSave()) {
            return false;
        }

        const fullWorldSetting = getFullWorldSettingData();
        if (!fullWorldSetting) {
            showWorldPanelErrorToast(t('createGame.noDataToSave'));
            return false;
        }

        const nextThemeTagIds = [...selectedThemeTagIds];
        return await handleSubmit({
            onSuccess: () => {
                syncSavedBaseline(fullWorldSetting, nextThemeTagIds);
            },
        });
    }, [getFullWorldSettingData, handleSubmit, selectedThemeTagIds, showWorldPanelErrorToast, syncSavedBaseline, validateWorldSettingBeforeSave]);

    saveWorldSettingChangesRef.current = saveWorldSettingChanges;

    const checkBeforeLeave = useCallback((action?: () => void) => {
        if (isWorldInteractionMode) {
            return defaultCheckBeforeLeave(action);
        }

        if (!hasUnsavedChangesRef.current) {
            return true;
        }

        if (isLeaveActionPendingRef.current) {
            return false;
        }

        if (!validateWorldSettingBeforeSave()) {
            pendingLeaveActionRef.current = null;
            return false;
        }

        pendingLeaveActionRef.current = action || null;
        isLeaveActionPendingRef.current = true;

        void (async () => {
            try {
                const saveResult = await saveWorldSettingChangesRef.current?.();
                if (saveResult !== true) {
                    pendingLeaveActionRef.current = null;
                    clearLeaveActionState(false);
                    return;
                }

                clearLeaveActionState(true);
                executePendingLeaveAction();
            } catch (error) {
                pendingLeaveActionRef.current = null;
                clearLeaveActionState(false);
                showWorldPanelErrorToast(t('createGame.saveFailedRetry'));
            }
        })();

        return false;
    }, [clearLeaveActionState, defaultCheckBeforeLeave, executePendingLeaveAction, isWorldInteractionMode, showWorldPanelErrorToast, validateWorldSettingBeforeSave]);

    useImperativeHandle(ref, () => ({
        checkBeforeLeave,
    }), [checkBeforeLeave]);

    useEffect(() => {
        if (!originalDataRef.current) {
            return;
        }
        // 实现题材修改纳入未保存检测
        const hasThemeTagChanges = !isSameThemeTagIds(selectedThemeTagIds, originalThemeTagIdsRef.current);
        setHasUnsavedChanges(getWorldSettingData() !== null || hasThemeTagChanges);
    }, [getWorldSettingData, selectedThemeTagIds, setHasUnsavedChanges]);

    useLayoutEffect(() => {
        if (!onGetData) {
            return;
        }

        onGetData(() => {
            const worldSettingDiff = getWorldSettingData();
            return {
                worldSetting: worldSettingDiff || undefined,
                // 透传当前题材选择
                themeTagIds: selectedThemeTagIds,
                // 透传原始题材快照
                originalThemeTagIds: originalThemeTagIdsRef.current,
            } as Partial<AllGameData | WorldInteractionGameData> & { themeTagIds: number[]; originalThemeTagIds: number[] };
        });
    }, [getWorldSettingData, onGetData, selectedThemeTagIds]);

    const handleConfirmSubmit = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        await saveWorldSettingChanges();
    }, [saveWorldSettingChanges]);

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
                    <h2>{t('createGame.worldSettingNarrativeStyle')}</h2>
                    <p className={styles.subtitle}>{t('createGame.worldSettingSubtitle')}</p>
                </div>
            </div>

            {isWorldInteractionMode ? SaveConfirmModalComponent : null}

            <div className={styles.formContainer}>
                {/* 实现世界观设定标题与右上角确认按钮 */}
                <div className={styles.cardHead}>
                    <strong className={styles.cardTitle}>{t('createGame.worldSetting')}</strong>
                    {handleSubmit && (
                        <button
                            className={styles.ghostSmall}
                            onClick={handleConfirmSubmit}
                            disabled={!gameData || isSubmitting}
                        >
                            {isSubmitting ? t('createGame.submitting') : t('createGame.confirmEdit')}
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
                        themeTags={displayThemeTags}
                        selectedThemeTagIds={selectedThemeTagIds}
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
                        onThemeTagToggle={handleThemeTagToggle}
                        onTargetOutputLengthChange={setTargetOutputLength}
                        onMinOutputLengthChange={setMinOutputLength}
                        onMaxOutputLengthChange={setMaxOutputLength}
                        titleDirty={worldFieldDirtyState.title}
                        taglineDirty={worldFieldDirtyState.tagline}
                        eraDirty={worldFieldDirtyState.era}
                        openingDirty={worldFieldDirtyState.opening}
                        openingPlotDirty={worldFieldDirtyState.openingPlot}
                        outputLengthDirty={worldFieldDirtyState.outputLength}
                        inlineSaveDisabled={!gameData || isSubmitting}
                        onTitleSave={saveWorldSettingChanges}
                        onTaglineSave={saveWorldSettingChanges}
                        onEraSave={saveWorldSettingChanges}
                        onOpeningSave={saveWorldSettingChanges}
                        onOpeningPlotSave={saveWorldSettingChanges}
                        onOutputLengthSave={saveWorldSettingChanges}
                        openingError={openingError}
                        openingPlotError={openingPlotError}
                        themeTagError={themeTagError}
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
