import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentUpload/DocumentsPanel';
import CharactersPanel, { type CharactersPanelRef } from '../components/GameSettingEditor/CharactersPanel/CharactersPanel';
import ScenesPanel, { type ScenesPanelRef } from '../components/GameSettingEditor/ScenesPanel/ScenesPanel';
import AttributeGrowthPanel, { type AttributeGrowthPanelRef } from '../components/GameSettingEditor/AttributeGrowthPanel/AttributeGrowthPanel';
import WorldPanel, { type WorldPanelRef } from '../components/GameSettingEditor/WorldPanel/WorldPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import MapPanel, { type MapPanelRef } from '../components/GameSettingEditor/MapPanel/MapPanel';
import FunctionalNPCsPanel, { type FunctionalNPCsPanelRef } from '../components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCsPanel';
import { type ObjectsPanelRef } from '../components/GameSettingEditor/ObjectsPanel/ObjectsPanel';
import PublishSettingsModal, { type PublishSubmitPayload } from '../components/CommonModal/PublishSettingsModal';
import PublishAssetCheckModal from '../components/CommonModal/PublishAssetCheckModal';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import AssetGapBanner from '../components/GameSettingEditor/AssetGapBanner';
import Navbar from '../components/Layout/Navbar';
import CreationFlowRail from '../components/GameSettingEditor/CreationFlowRail';
import CreationStepFooter from '../components/GameSettingEditor/CreationStepFooter';
import CreationCircleNav from '../components/GameSettingEditor/CreationCircleNav';
import { useEditorStore } from '../store/editorStore';
import { useGameStore } from '../store/gameStore';
import { useEditorData } from '../hooks/editor/useEditorData';
import { useFileUpload } from '../hooks/editor/useFileUpload';
import { useEditorSubmit } from '../hooks/editor/useEditorSubmit';
import { useEditorSession } from '../hooks/editor/useEditorSession';
import type { AllGameData } from '../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../api/worldInteraction/worldInteractionApi.type';
import type { IdeaGenerateOptions } from '../lib/galgame/ideaFullWorkEstimate';
import { assetCompletenessFromEditorData, editorAssetImageCountsFromEditorData } from '../lib/galgame/assetCompleteness';
import {
    dismissAssetGapBanner,
    isAssetGapBannerDismissed,
    peekAssetGapBannerKind,
    peekIdeaFullWorkAssets,
    peekIdeaAssetGenStatus,
    setIdeaAssetGenStatus,
    markAssetGapBannerPending,
    clearIdeaFullWorkAssets,
    clearAssetGapBannerDismissed,
    ASSET_GAP_BANNER_EVENT,
} from '../lib/galgame/ideaFullWorkSession';
import { runIdeaFullWorkAssets, isIdeaFullWorkAssetsInflight } from '../lib/galgame/runIdeaFullWorkAssets';
import { createInitialIdeaAssetProgress, peekIdeaAssetProgress, publishIdeaAssetProgress, IDEA_ASSET_PROGRESS_EVENT } from '../lib/galgame/ideaFullWorkProgress';
import toast from 'react-hot-toast';
import FullPageLoading from '../components/Skeleton/FullPageLoading';
import EditorApi from '../api/galgame/EditorData';
import worldEditor from '../api/worldInteraction/worldEditor';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { isMiniProgramEnv } from '../utils/miniProgram';
import type { MorePromptFormPanelRef } from '../components/GameSettingEditor/MorePromptForms/MorePromptFormPanel';
import WorldBookPanel from '../components/GameSettingEditor/WorldBook/WorldBookPanel';
import DatabasePanel from '../components/GameSettingEditor/Database/DatabasePanel';
import { useMorePromptForms } from '../hooks/editor/useMorePromptForms';
import { useDataPromptForms } from '../hooks/editor/useDataPromptForms';
import {
    buildMorePromptPanelId,
    isMorePromptPanel,
} from '../utils/morePromptForms';
import {
    buildDataPromptPanelId,
    isDataPromptPanel,
} from '../utils/dataPromptForms';
import {
    isWorldBookActive,
    resolveWorldBookPanelAfterDelete,
    resolveWorldBookTargetPanel,
    WORLD_BOOK_PANEL,
} from '../utils/worldBookPanel';
import {
    GAME_DATABASE_PANEL,
    isGameDatabaseActive,
    resolveGameDatabasePanelAfterDelete,
    resolveGameDatabaseTargetPanel,
} from '../utils/dataPromptPanel';
import type { DataPromptForm, MorePromptForm } from '../api/galgame/EditorData.type';

const SCREENWRITER_SEED_KEY = 'funloom_screenwriter_seed';
const SCREENWRITER_API_BASE_URL = 'http://localhost:3000/api';
const SCREENWRITER_APP_URL =
    import.meta.env.VITE_SCREENWRITER_APP_URL || 'http://127.0.0.1:5181';
const ENABLE_SCREENWRITER_MODE = import.meta.env.VITE_ENABLE_SCREENWRITER_MODE === 'true';

const GameSettingsEditor = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { activePanel, isParsed, setActivePanel, setIsParsed } = useEditorStore();
    const { fileId, setFileId } = useGameStore();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 默认为 'visual'，新按钮传 'worldInteraction'
    const isMiniProgramTxtMode = isMiniProgramEnv() && mode !== 'worldInteraction';
    const isVisualTxtCreate = mode !== 'worldInteraction';
    
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
    const [showPublishAssetCheck, setShowPublishAssetCheck] = useState<boolean>(false);
    const [assetBannerDismissed, setAssetBannerDismissed] = useState(false);
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
    const hasLoadedMapRef = useRef<boolean>(false);
    const parsingSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 使用自定义 Hooks
    const { gameData, isLoadingData, fetchEditorData } = useEditorData({ fileId, mode });

    const { handleFileUpload, handleGenerateFromIdea } = useFileUpload({
        mode,
        onUploadComplete: async (fileId, dataMode) => {
            await fetchEditorData(fileId, dataMode);
        },
    });

    const {
        isSubmitting,
        handleSubmit,
        worldPanelGetDataRef,
        charactersPanelGetDataRef,
        scenesPanelGetDataRef,
    } = useEditorSubmit({
        fileId,
        gameData,
        activePanel,
        mode,
        onDataRefresh: async () => {
            if (fileId) {
                await fetchEditorData(fileId);
            }
        },
    });

    const { createGalgameSession, handlePublishGame } = useEditorSession({
        fileId,
        mode,
    });

    const refreshEditorData = useCallback(async () => {
        if (fileId) {
            await fetchEditorData(fileId);
        }
    }, [fileId, fetchEditorData]);

    // Visual 侧栏 morePromptForms：持久化到 world.json，叙事 LLM 每轮注入
    const {
        forms: morePromptForms,
        isSaving: isSavingMorePrompt,
        canAddMore: canAddMorePrompt,
        saveForms,
        deleteForm,
    } = useMorePromptForms({
        fileId,
        initialForms: (gameData?.worldSetting as { morePromptForms?: MorePromptForm[] } | undefined)?.morePromptForms,
        onDataRefresh: refreshEditorData,
    });

    const {
        forms: dataPromptForms,
        isSaving: isSavingDataPrompt,
        canAddMore: canAddMoreDataPrompt,
        saveForms: saveDataPromptForms,
        deleteForm: deleteDataPromptForm,
    } = useDataPromptForms({
        fileId,
        initialForms: (gameData?.worldSetting as { dataPromptForms?: DataPromptForm[] } | undefined)?.dataPromptForms,
        onDataRefresh: refreshEditorData,
    });

    // 创建空游戏
    const handleCreateEmptyGame = useCallback(async (title: string) => {
        try {
            let response;
            if (mode === 'worldInteraction') {
                response = await worldEditor.createEmptyWorldInteraction(title);
            } else {
                response = await EditorApi.createVisualEmptyGame(title);
            }

            if (response.data?.success && response.data?.fileId) {
                const newFileId = response.data.fileId;
                setFileId(newFileId);
                await fetchEditorData(newFileId, mode || undefined);
            } else {
                throw new Error('创建失败');
            }
        } catch (error) {
            console.error('创建空游戏失败:', error);
            throw error;
        }
    }, [mode, setFileId, fetchEditorData]);

    const handleParsingStart = useCallback(() => {
        // 清理旧的自动跳转
        if (parsingSuccessTimerRef.current) {
            clearTimeout(parsingSuccessTimerRef.current);
            parsingSuccessTimerRef.current = null;
        }
        setIsParsing(true);
        setIsParsed(false);
    }, [setIsParsed]);

    const handleParsingSuccess = useCallback(() => {
        setIsParsing(false);
        setIsParsed(true);
        // 延迟1秒后自动跳转到下一步
        // 实现解析成功后自动进入 Step 2
        parsingSuccessTimerRef.current = setTimeout(() => {
            setActivePanel('world');
        }, 1000);
    }, [setIsParsed, setActivePanel]);

    // 一句话生成游戏
    const handleParsingFailed = useCallback(() => {
        // 实现解析失败后停留在 Step 1
        if (parsingSuccessTimerRef.current) {
            clearTimeout(parsingSuccessTimerRef.current);
            parsingSuccessTimerRef.current = null;
        }
        setIsParsing(false);
        setIsParsed(false);
        setActivePanel('documents');
    }, [setActivePanel, setIsParsed]);

    const handleGenerateFromIdeaWrapper = useCallback(async (
        idea: string,
        options: IdeaGenerateOptions,
    ) => {
        // mode 为 null 时默认为 visual 模式，只有 worldInteraction 模式才不允许
        if (mode === 'worldInteraction') {
            throw new Error('一句话生成功能仅在 visual 模式下可用');
        }
        // 开始解析状态
        handleParsingStart();
        const result = await handleGenerateFromIdea(idea, options);
        // 如果失败，重置解析状态
        if (!result) {
            setIsParsing(false);
        }
        return result;
    }, [mode, handleGenerateFromIdea, handleParsingStart]);

    // 功能注释：切换作品时同步素材提醒关闭态
    useEffect(() => {
        if (!fileId) {
            setAssetBannerDismissed(false);
            return;
        }
        setAssetBannerDismissed(isAssetGapBannerDismissed(fileId));
    }, [fileId]);

    // 功能注释：sessionStorage 横幅 kind / 进度变更时强制重渲染，避免仍显示「素材待补齐」
    const [assetBannerEpoch, setAssetBannerEpoch] = useState(0);
    useEffect(() => {
        if (!fileId) return;
        const bump = () => setAssetBannerEpoch((n) => n + 1);
        const onBanner = (event: Event) => {
            const detail = (event as CustomEvent<{ fileId?: string }>).detail;
            if (!detail?.fileId || detail.fileId === fileId) bump();
        };
        const onProgress = (event: Event) => {
            const detail = (event as CustomEvent<{ fileId?: string }>).detail;
            if (detail?.fileId === fileId) bump();
        };
        window.addEventListener(ASSET_GAP_BANNER_EVENT, onBanner);
        window.addEventListener(IDEA_ASSET_PROGRESS_EVENT, onProgress);
        return () => {
            window.removeEventListener(ASSET_GAP_BANNER_EVENT, onBanner);
            window.removeEventListener(IDEA_ASSET_PROGRESS_EVENT, onProgress);
        };
    }, [fileId]);

    const assetCompleteness = useMemo(() => {
        if (!gameData || mode === 'worldInteraction') {
            return null;
        }
        return assetCompletenessFromEditorData(gameData as AllGameData);
    }, [gameData, mode]);

    const liveAssetCounts = useMemo(() => {
        if (!gameData || mode === 'worldInteraction') {
            return null;
        }
        return editorAssetImageCountsFromEditorData(gameData as AllGameData);
    }, [gameData, mode]);

    // assetBannerEpoch：强制在 markAssetGapBannerPending 后重读 sessionStorage
    void assetBannerEpoch;
    const assetBannerKind = fileId ? peekAssetGapBannerKind(fileId) : null;
    const showAssetGapBanner = Boolean(
        isParsed
        && fileId
        && assetBannerKind
        && !assetBannerDismissed
        && mode !== 'worldInteraction'
        && (assetBannerKind === 'generating' || assetCompleteness?.hasGaps),
    );

    // 功能注释：生成中定时刷新编辑器数据，让顶栏进度与侧栏真实场景图同步
    useEffect(() => {
        if (!fileId || mode === 'worldInteraction' || !isParsed) return;
        if (assetBannerKind !== 'generating') return;
        let cancelled = false;
        const tick = async () => {
            try {
                await fetchEditorData(fileId);
            } catch {
                /* ignore */
            }
        };
        void tick();
        const timer = window.setInterval(() => {
            if (!cancelled) void tick();
        }, 8000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileId, mode, isParsed, assetBannerKind]);

    // 功能注释：素材待补齐横幅出现时强制拉一次 complete，缺口张数对齐真实角色/场景数
    useEffect(() => {
        if (!fileId || mode === 'worldInteraction' || !isParsed) return;
        if (!showAssetGapBanner) return;
        if (assetBannerKind !== 'full' && assetBannerKind !== 'text') return;
        void fetchEditorData(fileId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileId, mode, isParsed, showAssetGapBanner, assetBannerKind]);

    // 功能注释：仅在 pending/failed 且本页无人编排时续跑；running+inflight 表示上传回调已接管
    useEffect(() => {
        if (!fileId || mode === 'worldInteraction' || !isParsed) return;
        const flags = peekIdeaFullWorkAssets(fileId);
        if (!flags) return;
        if (isIdeaFullWorkAssetsInflight(fileId)) return;
        const status = peekIdeaAssetGenStatus(fileId);
        if (status !== 'pending' && status !== 'failed') return;

        let cancelled = false;
        const resume = async () => {
            setIdeaAssetGenStatus(fileId, 'running');
            clearAssetGapBannerDismissed(fileId);
            markAssetGapBannerPending(fileId, 'generating');
            setAssetBannerDismissed(false);
            const existingProgress = peekIdeaAssetProgress(fileId);
            publishIdeaAssetProgress(
                existingProgress
                    ? { ...existingProgress, flags: { ...flags } }
                    : createInitialIdeaAssetProgress(fileId, flags),
            );
            toast(t('createGame.fullWorkAssetsGenerating'));
            try {
                const assetResult = await runIdeaFullWorkAssets(fileId, flags);
                if (cancelled) return;
                if (assetResult.joinedExisting) return;
                const anyFail = !assetResult.portraitsOk
                    || !assetResult.scenesOk
                    || !assetResult.coverOk;
                if (anyFail) {
                    setIdeaAssetGenStatus(fileId, 'failed');
                    markAssetGapBannerPending(fileId, 'full');
                    toast.error(
                        assetResult.errors[0]
                            ? `${t('createGame.fullWorkAssetsPartialFail')}：${assetResult.errors[0]}`
                            : t('createGame.fullWorkAssetsPartialFail'),
                    );
                } else {
                    setIdeaAssetGenStatus(fileId, 'done');
                    clearIdeaFullWorkAssets(fileId);
                    toast.success(t('createGame.fullWorkAssetsDone'));
                }
                await fetchEditorData(fileId);
            } catch (err) {
                if (cancelled) return;
                console.error('[GameSettingsEditor] resume full-work assets failed', err);
                setIdeaAssetGenStatus(fileId, 'failed');
                markAssetGapBannerPending(fileId, 'full');
                toast.error(t('createGame.fullWorkAssetsPartialFail'));
            }
        };
        void resume();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileId, isParsed, mode]);

    const openPublishFlow = useCallback(() => {
        if (assetCompleteness?.hasGaps) {
            setShowPublishAssetCheck(true);
            return;
        }
        setShowPublishModal(true);
    }, [assetCompleteness]);

    const handleGoCompleteAssets = useCallback(() => {
        setShowPublishAssetCheck(false);
        if (!assetCompleteness) {
            setActivePanel('characters');
            return;
        }
        if (assetCompleteness.missingPortraits > 0) {
            setActivePanel('characters');
        } else if (assetCompleteness.missingScenes > 0) {
            setActivePanel('scenes');
        } else {
            setActivePanel('world');
        }
    }, [assetCompleteness, setActivePanel]);

    // 初始化：当 fileId 存在且数据加载完成时，设置解析状态和初始面板
    const hasInitializedRef = useRef<string | null>(null);
    useEffect(() => {
        if (fileId && fileId !== hasInitializedRef.current && gameData && !isLoadingData) {
            hasInitializedRef.current = fileId;
            setIsParsing(false);
            setIsParsed(true);
            setActivePanel('world');
        }
    }, [fileId, gameData, isLoadingData, setActivePanel, setIsParsed, setIsParsing]);

    const functionalNPCsPanelRef = useRef<FunctionalNPCsPanelRef | null>(null);
    const objectsPanelRef = useRef<ObjectsPanelRef | null>(null);
    const charactersPanelRef = useRef<CharactersPanelRef | null>(null);
    const scenesPanelRef = useRef<ScenesPanelRef | null>(null);
    const attributeGrowthPanelRef = useRef<AttributeGrowthPanelRef | null>(null);
    const worldPanelRef = useRef<WorldPanelRef | null>(null);
    const mapPanelRef = useRef<MapPanelRef | null>(null);
    const morePromptFormPanelRef = useRef<MorePromptFormPanelRef | null>(null);
    const dataPromptFormPanelRef = useRef<MorePromptFormPanelRef | null>(null);
    
    // 使用回调 ref 来确保能捕获到 ref 的变化
    const setFunctionalNPCsPanelRef = useCallback((node: FunctionalNPCsPanelRef | null) => {
        functionalNPCsPanelRef.current = node;
    }, []);

    // TODO: 物品面板暂时禁用
    // const setObjectsPanelRef = useCallback((node: ObjectsPanelRef | null) => {
    //     objectsPanelRef.current = node;
    // }, []);

    const setCharactersPanelRef = useCallback((node: CharactersPanelRef | null) => {
        charactersPanelRef.current = node;
    }, []);

    const setScenesPanelRef = useCallback((node: ScenesPanelRef | null) => {
        scenesPanelRef.current = node;
    }, []);

    const setAttributeGrowthPanelRef = useCallback((node: AttributeGrowthPanelRef | null) => {
        attributeGrowthPanelRef.current = node;
    }, []);

    const setWorldPanelRef = useCallback((node: WorldPanelRef | null) => {
        worldPanelRef.current = node;
    }, []);

    const setMapPanelRef = useCallback((node: MapPanelRef | null) => {
        mapPanelRef.current = node;
    }, []);

    const setMorePromptFormPanelRef = useCallback((node: MorePromptFormPanelRef | null) => {
        morePromptFormPanelRef.current = node;
    }, []);

    const setDataPromptFormPanelRef = useCallback((node: MorePromptFormPanelRef | null) => {
        dataPromptFormPanelRef.current = node;
    }, []);

    const handleMorePromptSave = useCallback(async (
        form: MorePromptForm,
        allForms: MorePromptForm[],
    ): Promise<boolean> => {
        const ok = await saveForms(allForms);
        if (ok) {
            setActivePanel(buildMorePromptPanelId(form.id));
        }
        return ok;
    }, [saveForms, setActivePanel]);

    const handleMorePromptCancel = useCallback(() => {
        setActivePanel(resolveWorldBookTargetPanel(morePromptForms));
    }, [morePromptForms, setActivePanel]);

    const handleMorePromptDelete = useCallback(async (id: string) => {
        const ok = await deleteForm(id);
        if (ok && activePanel === buildMorePromptPanelId(id)) {
            const remaining = morePromptForms.filter((form) => form.id !== id);
            setActivePanel(resolveWorldBookPanelAfterDelete(remaining));
        }
    }, [activePanel, deleteForm, morePromptForms, setActivePanel]);

    const handleDataPromptSave = useCallback(async (
        form: DataPromptForm,
        allForms: DataPromptForm[],
    ): Promise<boolean> => {
        const ok = await saveDataPromptForms(allForms);
        if (ok) {
            setActivePanel(buildDataPromptPanelId(form.id));
        }
        return ok;
    }, [saveDataPromptForms, setActivePanel]);

    const handleDataPromptCancel = useCallback(() => {
        setActivePanel(resolveGameDatabaseTargetPanel(dataPromptForms));
    }, [dataPromptForms, setActivePanel]);

    const handleDataPromptDelete = useCallback(async (id: string) => {
        const ok = await deleteDataPromptForm(id);
        if (ok && activePanel === buildDataPromptPanelId(id)) {
            const remaining = dataPromptForms.filter((form) => form.id !== id);
            setActivePanel(resolveGameDatabasePanelAfterDelete(remaining));
        }
    }, [activePanel, deleteDataPromptForm, dataPromptForms, setActivePanel]);

    const handlePanelChange = useCallback(async (panelId: string) => {
        if (isParsing && panelId !== 'documents') {
            return;
        }
        if (!isParsed && panelId !== 'documents') {
            return;
        }

        // Visual only：worldInteraction 不打开游戏系统 / 数据库面板
        if ((panelId === WORLD_BOOK_PANEL || isMorePromptPanel(panelId)) && mode === 'worldInteraction') {
            return;
        }
        if ((panelId === GAME_DATABASE_PANEL || isDataPromptPanel(panelId)) && mode === 'worldInteraction') {
            return;
        }

        let resolvedPanelId = panelId;
        if (panelId === WORLD_BOOK_PANEL) {
            resolvedPanelId = resolveWorldBookTargetPanel(morePromptForms, panelId);
        } else if (panelId === GAME_DATABASE_PANEL) {
            resolvedPanelId = resolveGameDatabaseTargetPanel(dataPromptForms, panelId);
        }

        // 离开 morePrompt 表单时检查未保存修改
        if (isMorePromptPanel(activePanel) && resolvedPanelId !== activePanel && morePromptFormPanelRef.current) {
            const canLeave = morePromptFormPanelRef.current.checkBeforeLeave(() => {
                void handlePanelChange(panelId);
            });
            if (!canLeave) {
                return;
            }
        }

        // 离开 dataPrompt 表单时检查未保存修改
        if (isDataPromptPanel(activePanel) && resolvedPanelId !== activePanel && dataPromptFormPanelRef.current) {
            const canLeave = dataPromptFormPanelRef.current.checkBeforeLeave(() => {
                void handlePanelChange(panelId);
            });
            if (!canLeave) {
                return;
            }
        }

        // 从功能性NPC面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'functionalNPCs' && panelId !== 'functionalNPCs' && functionalNPCsPanelRef.current) {
            const canLeave = await functionalNPCsPanelRef.current.checkBeforeLeave();
            if (!canLeave) {
                return;
            }
        }

        // 从物品面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'objects' && panelId !== 'objects' && objectsPanelRef.current) {
            const canLeave = await objectsPanelRef.current.checkBeforeLeave();
            if (!canLeave) {
                return;
            }
        }

        // 从角色面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'characters' && panelId !== 'characters' && charactersPanelRef.current) {
            const canLeave = charactersPanelRef.current.checkBeforeLeave(() => {
                void handlePanelChange(panelId);
            });
            if (!canLeave) {
                return;
            }
        }

        // 从场景面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'scenes' && panelId !== 'scenes' && scenesPanelRef.current) {
            const canLeave = scenesPanelRef.current.checkBeforeLeave(() => {
                void handlePanelChange(panelId);
            });
            if (!canLeave) {
                return;
            }
        }

        // 从属性面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'attributeGrowth' && panelId !== 'attributeGrowth' && attributeGrowthPanelRef.current) {
            const canLeave = attributeGrowthPanelRef.current.checkBeforeLeave();
            if (!canLeave) {
                return;
            }
        }

        // 从世界观面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'world' && panelId !== 'world' && worldPanelRef.current) {
            const canLeave = worldPanelRef.current.checkBeforeLeave(() => {
                void handlePanelChange(panelId);
            });
            if (!canLeave) {
                return;
            }
        }

        // 从地图编辑面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'mapEdit' && panelId !== 'mapEdit' && mapPanelRef.current) {
            const canLeave = await mapPanelRef.current.checkBeforeLeave();
            if (!canLeave) {
                return;
            }
        }

        // 首次进入地图编辑面板时，确保拉取一次最新的世界交互数据（包含场景位置信息）
        if (
            panelId === 'mapEdit' &&
            mode === 'worldInteraction' &&
            fileId &&
            !isLoadingData &&
            !hasLoadedMapRef.current
        ) {
            hasLoadedMapRef.current = true;
            fetchEditorData(fileId, 'worldInteraction');
        }

        setActivePanel(resolvedPanelId);
    }, [isParsing, isParsed, mode, fileId, isLoadingData, fetchEditorData, setActivePanel, activePanel, morePromptForms, dataPromptForms]);

    const onPublishGame = useCallback(async (payload: PublishSubmitPayload) => {
        try {
            await handlePublishGame(
                payload.description,
                payload.shareType,
                payload.versionNotes,
                payload.notifyFavoritedUsers,
            );
            setShowPublishModal(false);
        } catch (error: any) {
            setNoticeMessage(error?.message || t('createGame.publishFailed'));
        }
    }, [handlePublishGame, t]);

    const checkActivePanelBeforeAction = useCallback(async (action?: () => void): Promise<boolean> => {
        // 实现操作前统一复用当前面板未保存检查
        if (activePanel === 'functionalNPCs' && functionalNPCsPanelRef.current) {
            return await Promise.resolve(functionalNPCsPanelRef.current.checkBeforeLeave());
        }
        if (activePanel === 'objects' && objectsPanelRef.current) {
            return await Promise.resolve(objectsPanelRef.current.checkBeforeLeave());
        }
        if (activePanel === 'characters' && charactersPanelRef.current) {
            return await Promise.resolve(charactersPanelRef.current.checkBeforeLeave(action));
        }
        if (activePanel === 'scenes' && scenesPanelRef.current) {
            return await Promise.resolve(scenesPanelRef.current.checkBeforeLeave(action));
        }
        if (activePanel === 'attributeGrowth' && attributeGrowthPanelRef.current) {
            return await Promise.resolve(attributeGrowthPanelRef.current.checkBeforeLeave());
        }
        if (activePanel === 'world' && worldPanelRef.current) {
            return await Promise.resolve(worldPanelRef.current.checkBeforeLeave(action));
        }
        if (activePanel === 'mapEdit' && mapPanelRef.current) {
            return await Promise.resolve(mapPanelRef.current.checkBeforeLeave());
        }
        if (isMorePromptPanel(activePanel) && morePromptFormPanelRef.current) {
            return morePromptFormPanelRef.current.checkBeforeLeave(action);
        }
        if (isDataPromptPanel(activePanel) && dataPromptFormPanelRef.current) {
            return dataPromptFormPanelRef.current.checkBeforeLeave(action);
        }
        return true;
    }, [activePanel]);

    const buildScreenwriterSeed = useCallback(() => {
        if (!gameData) return null;

        const worldData = worldPanelGetDataRef.current?.();
        const characterData = charactersPanelGetDataRef.current?.();
        const sceneData = scenesPanelGetDataRef.current?.();
        const worldSetting = {
            ...(gameData.worldSetting || {}),
            ...(worldData?.worldSetting || {}),
        };
        const npcSetting = characterData?.npcSetting || gameData.npcSetting;
        const sceneSetting = sceneData?.sceneSetting || gameData.sceneSetting;

        return {
            source: 'txt-creator',
            fileId,
            apiBaseUrl: SCREENWRITER_API_BASE_URL,
            gameData: {
                worldSetting,
                npcSetting,
                sceneSetting,
            },
        };
    }, [fileId, gameData, charactersPanelGetDataRef, scenesPanelGetDataRef, worldPanelGetDataRef]);

    const openScreenwriterMode = useCallback(() => {
        const seed = buildScreenwriterSeed();
        if (!seed) {
            return;
        }

        localStorage.setItem(SCREENWRITER_SEED_KEY, JSON.stringify(seed));
        const params = new URLSearchParams({
            source: 'txt',
            seedKey: SCREENWRITER_SEED_KEY,
            apiBaseUrl: SCREENWRITER_API_BASE_URL,
        });
        const targetUrl = `${SCREENWRITER_APP_URL.replace(/\/$/, '')}/?${params.toString()}`;
        const targetWindow = window.open(targetUrl, '_blank');
        if (targetWindow) {
            window.setTimeout(() => {
                targetWindow.postMessage({
                    type: 'funloom-screenwriter-seed',
                    seedKey: SCREENWRITER_SEED_KEY,
                    apiBaseUrl: SCREENWRITER_API_BASE_URL,
                    seed,
                }, '*');
            }, 800);
        }
    }, [buildScreenwriterSeed]);

    useEffect(() => () => {
        if (parsingSuccessTimerRef.current) {
            clearTimeout(parsingSuccessTimerRef.current);
        }
    }, []);

    return (
        <>
            {/* 功能注释：全站统一 funloom 顶栏（logo / 查询游戏 / 消息 / 头像） */}
            <Navbar />
            <div className={`${styles.appShell} ${isMiniProgramTxtMode ? styles.miniProgramShell : ''} ${isVisualTxtCreate ? styles.txtCreateShell : ''}`}>
                <Sidebar
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                    isParsing={isParsing}
                    isParsed={isParsed}
                    mode={mode ?? undefined}
                />
                <main className={`${styles.main} ${isMiniProgramTxtMode ? styles.miniProgramMain : ''} ${isVisualTxtCreate ? styles.txtCreateMain : ''}`}>
                {/* 功能注释：移动端 TXT 创建页头（效果图：返回 + 标题），桌面仍用下方 topBar */}
                {isVisualTxtCreate ? (
                    <div className={styles.txtCreateMobileHeader}>
                        <button
                            type="button"
                            className={styles.txtCreateBack}
                            onClick={() => navigate('/create')}
                            aria-label={t('createGame.txtCreatePageTitle')}
                        >
                            ‹
                        </button>
                        <h1 className={styles.txtCreateTitle}>{t('createGame.txtCreatePageTitle')}</h1>
                    </div>
                ) : null}
                {isVisualTxtCreate ? (
                    <CreationCircleNav
                        activePanel={activePanel}
                        isParsing={isParsing}
                        isParsed={isParsed}
                        onPanelChange={handlePanelChange}
                        onPublish={async () => {
                            const canOpen = await checkActivePanelBeforeAction(() => {
                                openPublishFlow();
                            });
                            if (!canOpen) return;
                            openPublishFlow();
                        }}
                        publishDisabled={!fileId || !gameData || isSubmitting || isLoadingData}
                    />
                ) : null}
                <header className={`${styles.topBar} ${isMiniProgramTxtMode ? styles.miniProgramTopBar : ''} ${isVisualTxtCreate ? styles.txtCreateHideOnMobile : ''}`}>
                    {/* 功能注释：grid 分区——桌面标题|按钮 / 轨通栏；窄屏标题→轨→按钮紧贴，杜绝 flex 折行空洞 */}
                    <div className={styles.topBarTitles}>
                        <p className={styles.eyebrow}>{t('createGame.eyebrow')}</p>
                        <h1>{t('createGame.title')}</h1>
                    </div>
                    <div className={`${styles.topActions} ${isMiniProgramTxtMode ? styles.miniProgramTopActions : ''}`}>
                        {ENABLE_SCREENWRITER_MODE && (
                            <button
                                className={styles.ghost}
                                onClick={async (e) => {
                                    e.preventDefault();
                                    const canOpenScreenwriter = await checkActivePanelBeforeAction();
                                    if (!canOpenScreenwriter) {
                                        return;
                                    }
                                    openScreenwriterMode();
                                }}
                                disabled={!fileId || !gameData || isSubmitting || isLoadingData || mode === 'worldInteraction'}
                            >
                                编剧模式
                            </button>
                        )}
                        <button
                            className={styles.ghost}
                            onClick={async (e) => {
                                console.log('点击测试体验');
                                e.preventDefault();
                                const canStartTest = await checkActivePanelBeforeAction(() => {
                                    void createGalgameSession();
                                });
                                if (!canStartTest) {
                                    return;
                                }
                                await createGalgameSession();
                            }}
                            disabled={!fileId || !gameData || isSubmitting || isLoadingData}
                        >
                            {t('createGame.testExperience')}
                        </button>
                        <button
                            className={styles.primary}
                            onClick={async (e) => {
                                e.preventDefault();
                                // 实现直接发布前未保存校验 + 素材软检查
                                const canOpenPublishModal = await checkActivePanelBeforeAction(() => {
                                    openPublishFlow();
                                });
                                // 阻止未保存状态直接进入发布弹窗
                                if (!canOpenPublishModal) {
                                    return;
                                }
                                openPublishFlow();
                            }}
                            disabled={!fileId || !gameData || isSubmitting || isLoadingData}
                        >
                            {t('createGame.publishDirectly')}
                        </button>
                    </div>
                    <div className={styles.topBarRail}>
                        <CreationFlowRail
                            activePanel={activePanel}
                            isParsing={isParsing}
                            isParsed={isParsed}
                            mode={mode ?? undefined}
                        />
                    </div>
                </header>

                {showAssetGapBanner && assetCompleteness && assetBannerKind && (
                    <AssetGapBanner
                        kind={assetBannerKind}
                        fileId={fileId || undefined}
                        missingPortraits={assetCompleteness.missingPortraits}
                        missingScenes={assetCompleteness.missingScenes}
                        missingCover={assetCompleteness.missingCover}
                        liveAssetCounts={liveAssetCounts}
                        onGoCharacters={() => setActivePanel('characters')}
                        onGoScenes={() => setActivePanel('scenes')}
                        onGoCover={() => setActivePanel('world')}
                        onDismiss={() => {
                            if (fileId) dismissAssetGapBanner(fileId);
                            setAssetBannerDismissed(true);
                        }}
                    />
                )}

                <section className={`${styles.panel} ${activePanel === 'documents' ? styles.active : ''}`} id="documents">
                    <DocumentsPanel
                        onFileUpload={handleFileUpload}
                        isParsing={isParsing}
                        onParsingStart={handleParsingStart}
                        onParsingSuccess={handleParsingSuccess}
                        onParsingFailed={handleParsingFailed}
                        fileId={fileId || ''}
                        onCreateEmptyGame={handleCreateEmptyGame}
                        onGenerateFromIdea={handleGenerateFromIdeaWrapper}
                        mode={mode || undefined}
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'world' ? styles.active : ''}`} id="world">
                    <WorldPanel
                        ref={setWorldPanelRef}
                        gameData={gameData}
                        isLoading={isLoadingData}
                        onGetData={(getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => { worldPanelGetDataRef.current = getDataFn; }}
                        handleSubmit={handleSubmit}
                        fileId={fileId || undefined}
                        mode={(mode === 'visual' || mode === 'worldInteraction') ? mode : undefined}
                        onDataChange={async () => {
                            if (fileId) {
                                await fetchEditorData(fileId);
                            }
                        }}
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'characters' ? styles.active : ''}`} id="characters">
                    <CharactersPanel
                        ref={setCharactersPanelRef}
                        gameData={gameData}
                        isLoading={isLoadingData}
                        onGetData={(getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => { charactersPanelGetDataRef.current = getDataFn; }}
                        onDataChange={async () => {
                            if (fileId) {
                                await fetchEditorData(fileId);
                            }
                        }}
                        mode={mode || 'visual'}
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'scenes' ? styles.active : ''}`} id="scenes">
                    <ScenesPanel
                        ref={setScenesPanelRef}
                        gameData={gameData}
                        fileId={fileId}
                        onGetData={(getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => { scenesPanelGetDataRef.current = getDataFn; }}
                        onDataChange={async () => {
                            if (fileId) {
                                await fetchEditorData(fileId);
                            }
                        }}
                        mode={mode || 'visual'}
                    />
                </section>

                {mode !== 'worldInteraction' && (
                    <section
                        className={`${styles.panel} ${isWorldBookActive(activePanel) ? styles.active : ''}`}
                        id="worldBook"
                    >
                        <WorldBookPanel
                            activePanel={activePanel}
                            forms={morePromptForms}
                            disabled={isParsing || !isParsed}
                            canAddMore={canAddMorePrompt}
                            isSaving={isSavingMorePrompt}
                            onPanelChange={handlePanelChange}
                            onDelete={(id) => { void handleMorePromptDelete(id); }}
                            onSave={handleMorePromptSave}
                            onCancel={handleMorePromptCancel}
                            formPanelRef={setMorePromptFormPanelRef}
                        />
                    </section>
                )}

                {mode !== 'worldInteraction' && (
                    <section
                        className={`${styles.panel} ${isGameDatabaseActive(activePanel) ? styles.active : ''}`}
                        id="gameDatabase"
                    >
                        <DatabasePanel
                            activePanel={activePanel}
                            forms={dataPromptForms}
                            disabled={isParsing || !isParsed}
                            canAddMore={canAddMoreDataPrompt}
                            isSaving={isSavingDataPrompt}
                            onPanelChange={handlePanelChange}
                            onDelete={(id) => { void handleDataPromptDelete(id); }}
                            onSave={handleDataPromptSave}
                            onCancel={handleDataPromptCancel}
                            formPanelRef={setDataPromptFormPanelRef}
                        />
                    </section>
                )}

                {mode === 'worldInteraction' && (
                    <section className={`${styles.panel} ${activePanel === 'mapEdit' ? styles.active : ''}`} id="mapEdit">
                        <MapPanel
                            ref={setMapPanelRef}
                            sceneSetting={gameData?.sceneSetting}
                            worldMapImage={
                                mode === 'worldInteraction' && gameData
                                    ? (gameData as WorldInteractionGameData).worldSetting?.worldMapImage || null
                                    : null
                            }
                            fileId={fileId || ''}
                            isActive={activePanel === 'mapEdit'}
                            abilityNodeSetting={
                                mode === 'worldInteraction' && gameData && 'abilityNodeSetting' in gameData
                                    ? gameData.abilityNodeSetting
                                    : undefined
                            }
                            onDataChange={() => {
                                if (fileId) {
                                    fetchEditorData(fileId);
                                }
                            }}
                        />
                    </section>
                )}

                {mode === 'worldInteraction' && (
                    <section className={`${styles.panel} ${activePanel === 'functionalNPCs' ? styles.active : ''}`} id="functionalNPCs">
                        <FunctionalNPCsPanel
                            ref={setFunctionalNPCsPanelRef}
                            fileId={fileId}
                            mode={mode || 'worldInteraction'}
                            abilityNodeSetting={
                                mode === 'worldInteraction' && gameData && 'abilityNodeSetting' in gameData
                                    ? gameData.abilityNodeSetting
                                    : undefined
                            }
                            onDataChange={() => {
                                if (fileId) {
                                    fetchEditorData(fileId);
                                }
                            }}
                        />
                    </section>
                )}

                {/* 只在 worldInteraction 模式下显示 属性 · 养成培养插件（模块七，静态表单） */}
                {mode === 'worldInteraction' && (
                    <section
                        className={`${styles.panel} ${activePanel === 'attributeGrowth' ? styles.active : ''}`}
                        id="attributeGrowth"
                    >
                        <AttributeGrowthPanel
                            ref={setAttributeGrowthPanelRef}
                            attributeSetting={
                                gameData && 'attributeSetting' in gameData
                                    ? gameData.attributeSetting
                                    : undefined
                            }
                            onDataChange={async () => {
                                if (fileId) {
                                    await fetchEditorData(fileId);
                                }
                            }}
                        />
                    </section>
                )}

                {/* TODO: 物品面板暂时禁用 */}
                {/* {mode === 'worldInteraction' && (
                    <section
                        className={`${styles.panel} ${activePanel === 'objects' ? styles.active : ''}`}
                        id="objects"
                    >
                        <ObjectsPanel
                            ref={setObjectsPanelRef}
                            fileId={fileId}
                            mode={mode || 'worldInteraction'}
                        />
                    </section>
                )} */}

                {/* 编辑器全局加载遮罩（获取游戏文件 / 刷新数据时） */}
                {isLoadingData && (
                    <FullPageLoading
                        rootClassName={styles.page}
                        contentClassName={styles.mapContainer}
                    />
                )}
                </main>
                {isVisualTxtCreate ? null : (
                <CreationStepFooter
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                    isParsing={isParsing}
                    isParsed={isParsed}
                    mode={mode ?? undefined}
                />
                )}
                {showPublishModal && (
                    <PublishSettingsModal
                        isOpen={showPublishModal}
                        onClose={() => setShowPublishModal(false)}
                        onPublish={onPublishGame}
                        fileId={fileId || undefined}
                        engine="AVG"
                    />
                )}
                <PublishAssetCheckModal
                    isOpen={showPublishAssetCheck}
                    missingPortraits={assetCompleteness?.missingPortraits ?? 0}
                    missingScenes={assetCompleteness?.missingScenes ?? 0}
                    missingCover={Boolean(assetCompleteness?.missingCover)}
                    onClose={() => setShowPublishAssetCheck(false)}
                    onGoComplete={handleGoCompleteAssets}
                    onPublishAnyway={() => {
                        setShowPublishAssetCheck(false);
                        setShowPublishModal(true);
                    }}
                />
                <ConfirmModal
                    variant="alert"
                    isOpen={Boolean(noticeMessage)}
                    title={t('common.noticeTitle')}
                    message={noticeMessage || ''}
                    confirmButtonText={t('common.gotIt')}
                    onConfirm={() => setNoticeMessage(null)}
                    onCancel={() => setNoticeMessage(null)}
                />
            </div>
            {isMiniProgramTxtMode && <MobileBottomNav />}
        </>
    );
};

export default GameSettingsEditor;
