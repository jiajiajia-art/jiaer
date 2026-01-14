import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentUpload/DocumentsPanel';
import CharactersPanel, { type CharactersPanelRef } from '../components/GameSettingEditor/CharactersPanel/CharactersPanel';
import ScenesPanel, { type ScenesPanelRef } from '../components/GameSettingEditor/ScenesPanel/ScenesPanel';
import AttributeGrowthPanel, { type AttributeGrowthPanelRef } from '../components/GameSettingEditor/AttributeGrowthPanel/AttributeGrowthPanel';
import WorldPanel, { type WorldPanelRef } from '../components/GameSettingEditor/WorldPanel/WorldPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import MapPanel, { type MapPanelRef } from '../components/GameSettingEditor/MapPanel/MapPanel';
import FunctionalNPCsPanel, { type FunctionalNPCsPanelRef } from '../components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCsPanel';
import ObjectsPanel, { type ObjectsPanelRef } from '../components/GameSettingEditor/ObjectsPanel/ObjectsPanel';
import PublishSettingsModal from '../components/GoodsModal/PublishSettingsModal';
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

const GameSettingsEditor = () => {
    const { activePanel, isParsed, setActivePanel, setIsParsed } = useEditorStore();
    const { fileId, setFileId } = useGameStore();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 默认为 'visual'，新按钮传 'worldInteraction'
    
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
    const hasLoadedMapRef = useRef<boolean>(false);

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
        } catch (error: any) {
            console.error('创建空游戏失败:', error);
            throw error;
        }
    }, [mode, setFileId, fetchEditorData]);

    const handleParsingStart = useCallback(() => {
        setIsParsing(true);
        setIsParsed(false);
    }, [setIsParsed]);

    const handleParsingComplete = useCallback(() => {
        setIsParsing(false);
        setIsParsed(true);
        // 延迟1秒后自动跳转到下一步
        setTimeout(() => {
            setActivePanel('world');
        }, 1000);
    }, [setIsParsed, setActivePanel]);

    // 一句话生成游戏
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
            setIsParsed(true);
            setActivePanel('world');
        }
    }, [fileId, gameData, isLoadingData, setIsParsed, setActivePanel]);

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

    const setObjectsPanelRef = useCallback((node: ObjectsPanelRef | null) => {
        objectsPanelRef.current = node;
    }, []);

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
            const canLeave = charactersPanelRef.current.checkBeforeLeave();
            if (!canLeave) {
                return;
            }
        }

        // 从场景面板切换出去时，检查是否有未保存的修改
        if (activePanel === 'scenes' && panelId !== 'scenes' && scenesPanelRef.current) {
            const canLeave = scenesPanelRef.current.checkBeforeLeave();
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
            const canLeave = worldPanelRef.current.checkBeforeLeave();
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

    const onPublishGame = useCallback(async (price: number | null, isFree: boolean) => {
        await handlePublishGame(price, isFree);
        setShowPublishModal(false);
    }, [handlePublishGame]);

    return (
        <div className={styles.appShell}>
            <Sidebar
                activePanel={activePanel}
                onPanelChange={handlePanelChange}
                isParsing={isParsing}
                isParsed={isParsed}
                mode={mode ?? undefined}
            />
            <main className={styles.main}>
                <header className={styles.topBar}>
                    <div>
                        <p className={styles.eyebrow}>KURAN · CREATOR</p>
                        <h1>游戏创作流程</h1>
                        <p className={styles.subtitle}>
                            Step 1 上传 Word / PDF → Step 2 表单化校对世界观 → Step 3 角色差分 → Step 4
                            场景绑定 BGM → Step 5 地图与子场景布局
                        </p>
                    </div>

                    <div className={styles.topActions}>
                        <button
                            className={styles.ghost}
                            onClick={async (e) => {
                                console.log('点击测试体验');
                                e.preventDefault();
                                await createGalgameSession();
                            }}
                            disabled={!fileId || !gameData || isSubmitting || isLoadingData}
                        >
                            测试体验
                        </button>
                        <button
                            className={styles.primary}
                            onClick={(e) => {
                                e.preventDefault();
                                setShowPublishModal(true);
                            }}
                            disabled={!fileId || !gameData || isSubmitting || isLoadingData}
                        >
                            直接发布
                        </button>
                    </div>
                </header>

                <section className={`${styles.panel} ${activePanel === 'documents' ? styles.active : ''}`} id="documents">
                    <DocumentsPanel
                        onFileUpload={handleFileUpload}
                        isParsing={isParsing}
                        onParsingStart={handleParsingStart}
                        onParsingComplete={handleParsingComplete}
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
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'characters' ? styles.active : ''}`} id="characters">
                    <CharactersPanel
                        ref={setCharactersPanelRef}
                        gameData={gameData}
                        isLoading={isLoadingData}
                        onGetData={(getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => { charactersPanelGetDataRef.current = getDataFn; }}
                        onDataChange={() => {
                            if (fileId) {
                                fetchEditorData(fileId);
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
                        onDataChange={() => {
                            if (fileId) {
                                fetchEditorData(fileId);
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

                {/* 只在 worldInteraction 模式下显示物品编辑面板 */}
                {mode === 'worldInteraction' && (
                    <section
                        className={`${styles.panel} ${activePanel === 'objects' ? styles.active : ''}`}
                        id="objects"
                    >
                        <ObjectsPanel
                            ref={setObjectsPanelRef}
                            fileId={fileId}
                            mode={mode || 'worldInteraction'}
                            // objects={
                            //     mode === 'worldInteraction' && gameData && 'items' in gameData
                            //         ? (gameData as any).items || []
                            //         : []
                            // }
                            // onDataChange={async () => {
                            //     if (fileId) {
                            //         await fetchEditorData(fileId);
                            //     }
                            // }}
                        />
                    </section>
                )}

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
                />
            )}
        </div>
    );
};

export default GameSettingsEditor;
