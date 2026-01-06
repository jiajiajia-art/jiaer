import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentUpload/DocumentsPanel';
import WorldPanel from '../components/GameSettingEditor/WorldPanel';
import CharactersPanel from '../components/GameSettingEditor/CharactersPanel/CharactersPanel';
import ScenesPanel from '../components/GameSettingEditor/ScenesPanel/ScenesPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import MapPanel from '../components/GameSettingEditor/MapPanel/MapPanel';
import FunctionalNPCsPanel from '../components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCsPanel';
import AttributeGrowthPanel from '../components/GameSettingEditor/AttributeGrowthPanel/AttributeGrowthPanel';
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

// 类型守卫：判断是否为 worldInteraction 模式
function isWorldInteractionMode(data: AllGameData | WorldInteractionGameData | null | undefined): data is WorldInteractionGameData {
    if (!data) return false;
    return !('metadata' in data && data.metadata !== undefined);
}

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

    const { handleFileUpload } = useFileUpload({
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

    // 初始化：当 fileId 存在且数据加载完成时，设置解析状态和初始面板
    const hasInitializedRef = useRef<string | null>(null);
    useEffect(() => {
        if (fileId && fileId !== hasInitializedRef.current && gameData && !isLoadingData) {
            hasInitializedRef.current = fileId;
            setIsParsed(true);
            setActivePanel('world');
        }
    }, [fileId, gameData, isLoadingData, setIsParsed, setActivePanel]);

    const handlePanelChange = useCallback((panelId: string) => {
        if (isParsing && panelId !== 'documents') {
            return;
        }
        if (!isParsed && panelId !== 'documents') {
            return;
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
    }, [isParsing, isParsed, mode, fileId, isLoadingData, fetchEditorData, setActivePanel]);

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
                        mode={mode || undefined}
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'world' ? styles.active : ''}`} id="world">
                    <WorldPanel
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

                {/* 只在 worldInteraction 模式下显示 MapPanel（模块五） */}
                {mode === 'worldInteraction' && (
                    <section className={`${styles.panel} ${activePanel === 'mapEdit' ? styles.active : ''}`} id="mapEdit">
                        <MapPanel
                            sceneSetting={gameData?.sceneSetting}
                            worldMapImage={
                                gameData && isWorldInteractionMode(gameData) && gameData.worldSetting?.worldMapImage
                                    ? gameData.worldSetting.worldMapImage
                                    : null
                            }
                            fileId={fileId || ''}
                            isActive={activePanel === 'mapEdit'}
                            onDataChange={() => {
                                if (fileId) {
                                    fetchEditorData(fileId);
                                }
                            }}
                        />
                    </section>
                )}

                {/* 只在 worldInteraction 模式下显示 FunctionalNPCsPanel（模块六） */}
                {mode === 'worldInteraction' && (
                    <section className={`${styles.panel} ${activePanel === 'functionalNPCs' ? styles.active : ''}`} id="functionalNPCs">
                        <FunctionalNPCsPanel
                            fileId={fileId}
                            mode={mode || 'worldInteraction'}
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
                        <AttributeGrowthPanel />
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
