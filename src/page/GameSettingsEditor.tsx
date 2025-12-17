import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentsPanel';
import WorldPanel from '../components/GameSettingEditor/WorldPanel';
import CharactersPanel from '../components/GameSettingEditor/CharactersPanel';
import ScenesPanel from '../components/GameSettingEditor/ScenesPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import { authFetch } from '../api/base';
import EditorApi from '../api/galgame/EditorData';
import type { UnifiedGameData } from '../api/common/gameData.type';
import type { Scene as ApiScene } from '../api/galgame/getGalgamePreset.type';
import { adaptVisualGameData, adaptWorldGameData } from '../api/common/gameDataAdapter';
import type { AllGameData as VisualGameData } from '../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../api/worldInteraction/worldInteractionApi.type';
import { toast, Toaster } from 'react-hot-toast';
import { useEditorStore } from '../store/editorStore';
import GameAction from '../api/rpgGame/gameAction';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PublishSettingsModal from '../components/goodsModal/PublishSettingsModal';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import createWorldSessionApi from '../api/worldInteraction/createWorldSession';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import MapPanel from '../components/GameSettingEditor/MapPanel';
import MapWorldData from '../api/worldInteraction/mapWorldData';
import worldEditor from '../api/worldInteraction/worldEditor';

const GameSettingsEditor = () => {
    // 从 Zustand store 获取状态和方法
    const { fileId, activePanel, isParsed, setFileId, setActivePanel, setIsParsed } = useEditorStore();
    const { user} = useAuthStore();
    const { setPdfFileId, setSessionId } = useGameStore();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 默认为 'visual'，新按钮传 'worldInteraction'    
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [gameData, setGameData] = useState<UnifiedGameData | null>(null);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
    const navigate = useNavigate();
    const hasFetchedRef = useRef<string | null>(null); // 跟踪已请求的 fileId    
    const hasLoadedMapRef = useRef<boolean>(false); // 跟踪是否已为地图面板加载过最新数据

    // 各个面板的数据获取函数引用
    const worldPanelGetDataRef = useRef<() => Partial<UnifiedGameData> | null>(null);
    const charactersPanelGetDataRef = useRef<() => Partial<UnifiedGameData> | null>(null);
    const scenesPanelGetDataRef = useRef<() => Partial<UnifiedGameData> | null>(null);

    const handlePanelChange = (panelId: string) => {
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
    };

    const handleFileUpload = async (file: File): Promise<boolean> => {
        try {
            let uploadedFileId: string | undefined;
            
            // 根据模式选择不同的上传接口
            if (mode === 'worldInteraction') {
                // 使用世界交互模式的上传接口
                const response = await worldEditor.uploadWorldFile(file);

                const fileIdFromResp = response.data.fileId;
                if (fileIdFromResp) {
                    uploadedFileId = fileIdFromResp;
                    console.log('World file uploaded successfully:', response.data);
                } else {
                    console.error('Error uploading world file: missing fileId', response.data);
                    return false;
                }
            } else {
                // 默认使用视觉编辑模式的上传接口
                const formData = new FormData();
                formData.append('document', file);
                // 不设置 timeout，允许后端有足够时间处理文件上传和解析
                const response = await authFetch('/api/optical/games/upload', {
                    method: 'POST',
                    body: formData,
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('File uploaded successfully:', data);
                    // 从响应中获取 fileId
                    uploadedFileId = data.fileId || data.data?.fileId || data.file_id;
                } else {
                    console.error('Error uploading file:', response.statusText);
                    return false;
                }
            }
            
            if (uploadedFileId) {
                console.log("Uploaded File ID:", uploadedFileId);
                // 使用 Zustand store 更新 fileId（自动保存到 sessionStorage）
                setFileId(uploadedFileId);
                setIsParsed(false);
                return true;
            } else {
                console.error('No fileId returned from upload');
                return false;
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            return false;
        }
    };

    // 获取编辑器数据
    const fetchEditorData = useCallback(async (id: string, dataMode?: string) => {
        if (!id || isLoadingData) return; // 如果正在加载，避免重复请求

        setIsLoadingData(true);
        try {
            // 根据模式选择不同的 API
            const currentMode = dataMode || mode;
            let response;
            
            if (currentMode === 'worldInteraction') {
                // 使用世界交互 API
                response = await MapWorldData.getMapWorldData(id);
            } else {
                // 默认使用视觉编辑 API
                response = await EditorApi.getEditorData(id);
            }
            
            if (response.data?.success && response.data) {
                // 根据模式转换数据为统一格式
                let unifiedData: UnifiedGameData;
                if (currentMode === 'worldInteraction') {
                    unifiedData = adaptWorldGameData(response.data as WorldInteractionGameData);
                } else {
                    unifiedData = adaptVisualGameData(response.data as VisualGameData);
                }
                
                setGameData(unifiedData);
                // 注意：不要更新 fileId，避免触发 useEffect 无限循环
                // 如果需要更新 fileId，应该在调用 fetchEditorData 之前更新
                console.log('Editor data fetched and adapted successfully:', unifiedData);
            } else {
                console.error('Failed to fetch editor data');
                // 请求失败时，清除 hasFetchedRef，允许重试
                if (hasFetchedRef.current === id) {
                    hasFetchedRef.current = null;
                }
            }
        } catch (error) {
            console.error('Error fetching editor data:', error);
            // 请求失败时，清除 hasFetchedRef，允许重试
            if (hasFetchedRef.current === id) {
                hasFetchedRef.current = null;
            }
        } finally {
            setIsLoadingData(false);
        }
    }, [mode, isLoadingData]);

    // 初始化：如果有保存的 fileId，自动加载数据
    useEffect(() => {
        if (fileId && fileId !== hasFetchedRef.current && !isLoadingData) {
            hasFetchedRef.current = fileId;
            setIsParsed(true);
            fetchEditorData(fileId);
            setActivePanel('world');
        }
    }, [fileId]);

    const handleParsingStart = useCallback(() => {
        setIsParsing(true);
        // 使用 Zustand store 更新解析状态（自动保存到 sessionStorage）
        setIsParsed(false);
    }, [setIsParsed]);

    const handleParsingComplete = useCallback(() => {
        setIsParsing(false);
        // 使用 Zustand store 更新解析完成状态（自动保存到 sessionStorage）
        setIsParsed(true);
        // 延迟1秒后自动跳转到下一步
        setTimeout(() => {
            setActivePanel('world');
        }, 1000);
    }, [setIsParsed, setActivePanel]);

    // 根据当前面板提交数据
    const handleSubmit = useCallback(async () => {
        if (!fileId || !gameData) {
            toast.error('缺少必要数据，无法提交');
            return;
        }

        setIsSubmitting(true);
        try {
            let response: any = null;

            // 根据当前面板获取对应的数据并调用对应的 API
            switch (activePanel) {
                case 'world':
                    if (worldPanelGetDataRef.current) {
                        const worldData = worldPanelGetDataRef.current();
                        if (worldData?.worldSetting) {
                            // worldSetting 现在只包含修改过的字段，直接传递 worldSetting 对象（不包裹）
                            const worldSettingDiff = worldData.worldSetting;
                            if (!fileId) {
                                toast.error('缺少文件ID，无法保存');
                                setIsSubmitting(false);
                                return;
                            }
                            response = mode === 'worldInteraction' ? await worldEditor.updateWorldSetting(fileId, worldSettingDiff) : await EditorApi.updateWorldSetting(fileId, worldSettingDiff);
                        } else {
                            toast.error('没有需要保存的修改');
                            setIsSubmitting(false);
                            return;
                        }
                    } else {
                        toast.error('数据获取函数未初始化');
                        setIsSubmitting(false);
                        return;
                    }
                    break;
                case 'characters':
                    if (charactersPanelGetDataRef.current) {
                        const npcData = charactersPanelGetDataRef.current();
                        if (npcData?.npcSetting) {
                            // 获取所有 NPC 数据并逐个更新
                            const npcs = npcData.npcSetting.npcs;
                            if (npcs && npcs.length > 0) {
                                if (!fileId) {
                                    toast.error('缺少文件ID，无法保存');
                                    setIsSubmitting(false);
                                    return;
                                }
                                // 批量更新所有 NPC
                                const updatePromises = npcs.map(npc =>
                                    mode === 'worldInteraction' 
                                        ? worldEditor.updateNpc(fileId, npc)
                                        : EditorApi.updateNpc(fileId, npc)
                                );
                                const results = await Promise.all(updatePromises);
                                // 检查是否全部成功
                                if (results.every(r => r.data?.success)) {
                                    response = { data: { success: true } };
                                } else {
                                    toast.error('部分角色更新失败');
                                    setIsSubmitting(false);
                                    return;
                                }
                            } else {
                                toast.error('没有需要保存的修改');
                                setIsSubmitting(false);
                                return;
                            }
                        } else {
                            toast.error('没有需要保存的修改');
                            setIsSubmitting(false);
                            return;
                        }
                    } else {
                        toast.error('数据获取函数未初始化');
                        setIsSubmitting(false);
                        return;
                    }
                    break;
                case 'scenes':
                    if (scenesPanelGetDataRef.current) {
                        const sceneData = scenesPanelGetDataRef.current();
                        if (sceneData?.sceneSetting) {
                            // 获取所有场景数据并逐个更新
                            const scenes = sceneData.sceneSetting.scenes;
                            if (scenes && scenes.length > 0) {
                                if (!fileId) {
                                    toast.error('缺少文件ID，无法保存');
                                    setIsSubmitting(false);
                                    return;
                                }
                                // 批量更新所有场景
                                const updatePromises = scenes.map(scene => {
                                    if (mode === 'worldInteraction') {
                                        // worldInteraction 模式：直接使用 UnifiedScene（包含 subscenes）
                                        return worldEditor.updateScene(fileId, scene);
                                    } else {
                                        // visual 模式：转换为 ApiScene（不包含 subscenes）
                                        const sceneData: ApiScene = {
                                            id: scene.id,
                                            name: scene.name,
                                            type: scene.type || '',
                                            description: scene.description || '',
                                            images: scene.image,
                                            soundtrack: scene.soundtrack,
                                            npcs: [],
                                            events: [],
                                        };
                                        return EditorApi.updateScene(fileId, sceneData);
                                    }
                                });
                                const results = await Promise.all(updatePromises);
                                // 检查是否全部成功
                                if (results.every(r => r.data?.success)) {
                                    response = { data: { success: true } };
                                } else {
                                    toast.error('部分场景更新失败');
                                    setIsSubmitting(false);
                                    return;
                                }
                            } else {
                                toast.error('没有需要保存的修改');
                                setIsSubmitting(false);
                                return;
                            }
                        } else {
                            toast.error('没有需要保存的修改');
                            setIsSubmitting(false);
                            return;
                        }
                    } else {
                        toast.error('数据获取函数未初始化');
                        setIsSubmitting(false);
                        return;
                    }
                    break;
                default:
                    toast.error('当前面板不支持提交');
                    setIsSubmitting(false);
                    return;
            }

            if (response && response.data?.success) {
                toast.success('修改已保存');
                // 重新获取最新数据
                if (fileId) {
                    await fetchEditorData(fileId);
                }
            } else {
                toast.error('保存失败，请重试');
            }
        } catch (error) {
            console.error('更新数据时出错:', error);
            toast.error('保存失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    }, [fileId, gameData, activePanel, mode, fetchEditorData]);

    const handlePublishGame = async (price: number | null, isFree: boolean) => {
        if (!fileId) return;

        try {
            const priceAmount = isFree ? 0 : (price || 0);
            const response = await GameAction.publishGame({
                fileId: fileId,
                priceAmount: priceAmount,
            });

            if (response.data.success) {
                setShowPublishModal(false);
                navigate('/create');
            } else {
                console.error('发布游戏失败:', response.data);
                alert('发布游戏失败');
            }
        } catch (error) {
            console.error('发布游戏失败:', error);
            alert('发布游戏失败');
        }
    };

    const createGalgameSession = useCallback(async () => {
        if (!fileId || !user?.user?.id) return null;

        try {
            // 根据模式选择不同的会话创建接口
            if (mode === 'worldInteraction') {
                const sessionResponse = await createWorldSessionApi.createWorldSession({ fileId });
                if (sessionResponse.data.success) {
                    const sessionId = sessionResponse.data.data.session.session_id;
                    setPdfFileId(fileId);
                    setSessionId(sessionId);
                    navigate(`/galgameMap`);
                    return sessionId;
                } else {
                    toast.error((sessionResponse.data as any)?.message || '创建世界交互游戏失败，请重试');
                    return null;
                }
            } else {
                const sessionResponse = await createGalgameSessionApi.createGalgameSession({ presetId: fileId });
                if (sessionResponse.data.success) {
                    const sessionId = sessionResponse.data.data.session.session_id;
                    setPdfFileId(fileId);
                    setSessionId(sessionId);
                    navigate(`/galgame`);
                    return sessionId;
                } else {
                    toast.error(sessionResponse.data.message || '创建游戏失败，请重试');
                    return null;
                }
            }
        } catch (error: any) {
            console.error('❌ Session 创建错误:', error);
            const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error.message || '创建游戏失败，请稍后重试';
            toast.error(errorMessage);
            return null;
        }
    }, [user?.user?.id, fileId, navigate, setPdfFileId, setSessionId, mode]);

    return (
        <div className={styles.appShell}>
            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />
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
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'world' ? styles.active : ''}`} id="world">
                    <WorldPanel
                        gameData={gameData}
                        isLoading={isLoadingData}
                        onGetData={(getDataFn) => { worldPanelGetDataRef.current = getDataFn; }}
                        handleSubmit={handleSubmit}
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'characters' ? styles.active : ''}`} id="characters">
                    <CharactersPanel
                        gameData={gameData}
                        isLoading={isLoadingData}
                        onGetData={(getDataFn) => { charactersPanelGetDataRef.current = getDataFn; }}
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
                        isLoading={isLoadingData}
                        fileId={fileId}
                        onGetData={(getDataFn) => { scenesPanelGetDataRef.current = getDataFn; }}
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
                            worldMapImage={gameData?.worldSetting?.worldMapImage || null}
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
            </main>
            {showPublishModal && (
                <PublishSettingsModal
                    isOpen={showPublishModal}
                    onClose={() => setShowPublishModal(false)}
                    onPublish={handlePublishGame}
                />
            )}
        </div>
    );
};

export default GameSettingsEditor;
