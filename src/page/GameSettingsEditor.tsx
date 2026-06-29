import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import PublishSettingsModal from '../components/CommonModal/PublishSettingsModal';
import { useEditorStore } from '../store/editorStore';
import { useGameStore } from '../store/gameStore';
import { useEditorData } from '../hooks/editor/useEditorData';
import { useFileUpload } from '../hooks/editor/useFileUpload';
import { useEditorSubmit } from '../hooks/editor/useEditorSubmit';
import { useEditorSession } from '../hooks/editor/useEditorSession';
import type { AllGameData } from '../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../api/worldInteraction/worldInteractionApi.type';
import FullPageLoading from '../components/Skeleton/FullPageLoading';
import EditorApi from '../api/galgame/EditorData';
import worldEditor from '../api/worldInteraction/worldEditor';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { isMiniProgramEnv } from '../utils/miniProgram';
import type { Currency } from '../api/common/currency';

const SCREENWRITER_SEED_KEY = 'funloom_screenwriter_seed';
const SCREENWRITER_API_BASE_URL = 'http://localhost:3000/api';
const SCREENWRITER_APP_URL =
    import.meta.env.VITE_SCREENWRITER_APP_URL || 'http://127.0.0.1:5181';
const ENABLE_SCREENWRITER_MODE = import.meta.env.VITE_ENABLE_SCREENWRITER_MODE === 'true';

const GameSettingsEditor = () => {
    const { t } = useTranslation();
    const { activePanel, isParsed, setActivePanel, setIsParsed } = useEditorStore();
    const { fileId, setFileId } = useGameStore();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 默认为 'visual'，新按钮传 'worldInteraction'
    const isMiniProgramTxtMode = isMiniProgramEnv() && mode !== 'worldInteraction';
    
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
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

    const handleGenerateFromIdeaWrapper = useCallback(async (idea: string) => {
        // mode 为 null 时默认为 visual 模式，只有 worldInteraction 模式才不允许
        if (mode === 'worldInteraction') {
            throw new Error('一句话生成功能仅在 visual 模式下可用');
        }
        // 开始解析状态
        handleParsingStart();
        const result = await handleGenerateFromIdea(idea);
        // 如果失败，重置解析状态
        if (!result) {
            setIsParsing(false);
        }
        return result;
    }, [mode, handleGenerateFromIdea, handleParsingStart]);

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

    const handlePanelChange = useCallback(async (panelId: string) => {
        if (isParsing && panelId !== 'documents') {
            return;
        }
        if (!isParsed && panelId !== 'documents') {
            return;
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

        setActivePanel(panelId);
    }, [isParsing, isParsed, mode, fileId, isLoadingData, fetchEditorData, setActivePanel, activePanel]);

    const onPublishGame = useCallback(async (description?: string, shareType?: Currency, versionNotes?: string, notifyFavoritedUsers?: boolean) => {
        await handlePublishGame(description, shareType, versionNotes, notifyFavoritedUsers);
        setShowPublishModal(false);
    }, [handlePublishGame]);

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
            <div className={`${styles.appShell} ${isMiniProgramTxtMode ? styles.miniProgramShell : ''}`}>
                <Sidebar
                    activePanel={activePanel}
                    onPanelChange={handlePanelChange}
                    isParsing={isParsing}
                    isParsed={isParsed}
                    mode={mode ?? undefined}
                />
                <main className={`${styles.main} ${isMiniProgramTxtMode ? styles.miniProgramMain : ''}`}>
                <header className={`${styles.topBar} ${isMiniProgramTxtMode ? styles.miniProgramTopBar : ''}`}>
                    <div>
                        <p className={styles.eyebrow}>{t('createGame.eyebrow')}</p>
                        <h1>{t('createGame.title')}</h1>
                        <p className={styles.subtitle}>
                            {t('createGame.step1Tip')}
                            {mode === 'worldInteraction' ? t('createGame.step5Tip') : ''}
                        </p>
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
                                // 实现直接发布前未保存校验
                                const canOpenPublishModal = await checkActivePanelBeforeAction(() => {
                                    setShowPublishModal(true);
                                });
                                // 阻止未保存状态直接进入发布弹窗
                                if (!canOpenPublishModal) {
                                    return;
                                }
                                setShowPublishModal(true);
                            }}
                            disabled={!fileId || !gameData || isSubmitting || isLoadingData}
                        >
                            {t('createGame.publishDirectly')}
                        </button>
                    </div>
                </header>

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
                {showPublishModal && (
                    <PublishSettingsModal
                        isOpen={showPublishModal}
                        onClose={() => setShowPublishModal(false)}
                        onPublish={onPublishGame}
                        fileId={fileId || undefined}
                        engine="AVG"
                    />
                )}
            </div>
            {isMiniProgramTxtMode && <MobileBottomNav />}
        </>
    );
};

export default GameSettingsEditor;
