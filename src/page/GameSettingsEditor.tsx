import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentsPanel';
import WorldPanel from '../components/GameSettingEditor/WorldPanel';
import CharactersPanel from '../components/GameSettingEditor/CharactersPanel';
import ScenesPanel from '../components/GameSettingEditor/ScenesPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import EditorApi from '../api/galgame/EditorData';
import type { AllGameData } from '../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../api/worldInteraction/worldInteractionApi.type';
import type { Scene as ApiScene } from '../api/galgame/getGalgamePreset.type';

// 类型守卫：判断是否为 visual 模式
function isVisualMode(data: AllGameData | WorldInteractionGameData | null | undefined): data is AllGameData {
    if (!data) return false;
    return 'metadata' in data && data.metadata !== undefined;
}

// 类型守卫：判断是否为 worldInteraction 模式
function isWorldInteractionMode(data: AllGameData | WorldInteractionGameData | null | undefined): data is WorldInteractionGameData {
    if (!data) return false;
    return !isVisualMode(data);
}

// ---- Async upload job types/helpers ----
type JobStage = 'uploaded' | 'parsing' | 'generating' | 'validating' | 'writing' | 'done';

interface JobStatusResponseRunning {
    success?: boolean;
    jobId: string;
    fileId?: string;
    status: 'running' | 'queued';
    stage?: JobStage;
    progress?: number; // 0-100
    error?: string;
}

interface JobStatusResponseCompleted {
    success?: boolean;
    jobId: string;
    fileId: string;
    status: 'completed';
}

interface JobStatusResponseFailed {
    success?: boolean;
    status: 'failed';
    error?: string;
}

// 不再需要适配器，直接使用 API 返回的数据
import { toast, Toaster } from 'react-hot-toast';
import { useEditorStore } from '../store/editorStore';
import GameAction from '../api/rpgGame/gameAction';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PublishSettingsModal from '../components/goodsModal/PublishSettingsModal';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import createWorldSessionApi from '../api/worldInteraction/createWorldSession';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useUploadStore } from '../store/uploadStore';
import MapPanel from '../components/GameSettingEditor/MapPanel';
import MapWorldData from '../api/worldInteraction/mapWorldData';
import worldEditor from '../api/worldInteraction/worldEditor';

const GameSettingsEditor = () => {
    // 从 Zustand store 获取状态和方法
    const { activePanel, isParsed, setActivePanel, setIsParsed } = useEditorStore();
    const { user} = useAuthStore();
    const { fileId, setFileId, setSessionId, setIsPreset } = useGameStore();
    const { addJob, updateJob, removeJob } = useUploadStore();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 默认为 'visual'，新按钮传 'worldInteraction'    
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [gameData, setGameData] = useState<AllGameData | WorldInteractionGameData | null>(null);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
    const navigate = useNavigate();
    const hasFetchedRef = useRef<string | null>(null); // 跟踪已请求的 fileId    
    const hasLoadedMapRef = useRef<boolean>(false); // 跟踪是否已为地图面板加载过最新数据

    // 各个面板的数据获取函数引用
    const worldPanelGetDataRef = useRef<() => Partial<AllGameData | WorldInteractionGameData> | null>(null);
    const charactersPanelGetDataRef = useRef<() => Partial<AllGameData | WorldInteractionGameData> | null>(null);
    const scenesPanelGetDataRef = useRef<() => Partial<AllGameData | WorldInteractionGameData> | null>(null);

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

    // 轮询上传状态的通用函数（两种模式共用）
    const startPollingUploadStatus = (jobId: string, fileName: string, dataMode: string) => {
        addJob(jobId, fileName);
        
        let delay = 1000; // 初始延迟1秒
        const maxDelay = 5000;
        const timeoutMs = 30 * 60 * 1000; // 30分钟超时
        const started = Date.now();
        
        const pollStatus = async () => {
            try {
                // 检查超时
                if (Date.now() - started > timeoutMs) {
                    updateJob(jobId, {
                        status: 'failed',
                        error: '上传超时，请重试',
                    });
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                    toast.error('上传超时，请重试');
                    return;
                }
                
                const statusResponse = await mode === 'worldInteraction' ? worldEditor.checkUploadStatus(jobId) : EditorApi.checkUploadStatus(jobId);
                const statusData = (await statusResponse).data; // 后端返回的数据结构
                
                if (statusData.status === 'running' || statusData.status === 'queued') {
                    // 更新进度
                    const runningData = statusData as JobStatusResponseRunning;
                    updateJob(jobId, {
                        fileId: runningData.fileId || null,
                        status: runningData.status === 'queued' ? 'uploading' : 'processing',
                        progress: runningData.progress || 0,
                        stage: runningData.stage || (runningData.status === 'queued' ? '上传中' : '处理中'),
                        error: null,
                    });
                    
                    // 继续轮询，使用指数退避
                    setTimeout(() => {
                        pollStatus();
                    }, delay);
                    delay = Math.min(Math.round(delay * 1.3), maxDelay);
                    
                } else if (statusData.status === 'completed') {
                    // 完成：设置 fileId 并读取文件数据
                    const completedData = statusData as JobStatusResponseCompleted;
                    if (completedData.fileId) {
                        setFileId(completedData.fileId);
                        setIsParsed(false);
                        setIsPreset(false);
                        
                        updateJob(jobId, {
                            fileId: completedData.fileId,
                            status: 'completed',
                            progress: 100,
                            stage: '完成',
                        });
                        
                        // 读取文件数据
                        fetchEditorData(completedData.fileId, dataMode).catch((error) => {
                            console.error('Error fetching editor data after upload:', error);
                            toast.error('文件解析完成，但加载数据失败，请刷新页面');
                        });
                        
                        // 延迟移除任务
                        setTimeout(() => {
                            removeJob(jobId);
                        }, 2000);
                    } else {
                        updateJob(jobId, {
                            status: 'failed',
                            error: '完成但缺少 fileId',
                        });
                        setTimeout(() => {
                            removeJob(jobId);
                        }, 3000);
                    }
                    
                } else if (statusData.status === 'failed') {
                    // 失败
                    const failedData = statusData as JobStatusResponseFailed;
                    const errMsg = failedData.error || '解析失败，请重试';
                    updateJob(jobId, {
                        status: 'failed',
                        error: errMsg,
                    });
                    toast.error(errMsg);
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                    
                } else if (statusData.status === 'unknown') {
                    // 未知状态
                    updateJob(jobId, {
                        status: 'failed',
                        error: '任务不存在或已回收',
                    });
                    toast.error('任务不存在或已回收，请重试上传');
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                }
                
            } catch (error) {
                console.error('Error polling upload status:', error);
                updateJob(jobId, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : '轮询状态失败',
                });
                toast.error('轮询状态失败，请重试');
                setTimeout(() => {
                    removeJob(jobId);
                }, 3000);
            }
        };
        
        // 开始轮询
        pollStatus();
    };

    const handleFileUpload = async (file: File): Promise<boolean> => {
        try {
            let uploadResponse;
            
            if (mode === 'worldInteraction') {
                uploadResponse = await worldEditor.uploadWorldFile(file);
            } else {
                uploadResponse = await EditorApi.uploadGameFile(file);
            }
            
            // 容错：若后端临时返回 200 + fileId，也尝试兼容
            if (uploadResponse.status === 200) {
                const legacy = uploadResponse.data;
                if (legacy.success && legacy.fileId) {
                    setFileId(legacy.fileId);
                    setIsParsed(false);
                    setIsPreset(false);
                    return true;
                } else {
                    console.error('Unexpected upload response: 200 but no fileId in body');
                    return false;
                }
            }
            
            // 期望返回 202 Accepted
            if (uploadResponse.status !== 202) {
                console.error('Unexpected upload response status:', uploadResponse.status);
                toast.error('上传失败，请重试');
                return false;
            }
            
            const accepted = uploadResponse.data;
            if (!accepted.success || !accepted.jobId) {
                console.error('Invalid 202 Accepted payload', accepted);
                toast.error('上传失败，请重试');
                return false;
            }
            
            const { jobId, fileId: initialFileId } = accepted;
            
            // 如果有初始 fileId，先保存到任务中（但不设置到全局，等completed后再设置）
            if (initialFileId) {
                updateJob(jobId, {
                    fileId: initialFileId,
                });
            }
            
            startPollingUploadStatus(jobId, file.name, mode || 'visual');
            
            // 返回 true 表示上传请求已提交，但fileId会在轮询完成后设置
            return true;
        } catch (error) {
            console.error('Error uploading file:', error);
            return false;
        }
    };

    // 获取编辑器数据
    // 仅用于首页进入时的首屏加载状态控制
    const initialLoadDoneRef = useRef<boolean>(false);

    const fetchEditorData = useCallback(async (id: string, dataMode?: string) => {
        if (!id || isLoadingData) return;

        const shouldShowGlobalLoading = !initialLoadDoneRef.current;
        if (shouldShowGlobalLoading) {
            setIsLoadingData(true);
        }
        try {
            // 根据模式选择不同的 API
            const currentMode = dataMode || mode;
            let response;
            
            if (currentMode === 'worldInteraction') {
                response = await MapWorldData.getMapWorldData(id);
            } else {
                response = await EditorApi.getEditorData(id);
            }
            
            if (response.data?.success && response.data) {
                const rawData = response.data as any;
                if (rawData.worldSetting) {
                    if (rawData.worldSetting.Player && !rawData.worldSetting.player) {
                        rawData.worldSetting.player = rawData.worldSetting.Player;
                    }
                }
                
                const unifiedData = rawData as AllGameData | WorldInteractionGameData;
                setGameData(unifiedData);
                // 首次加载成功后标记完成，后续不再显示全局加载遮罩
                initialLoadDoneRef.current = true;
                console.log('Editor data fetched successfully:', unifiedData);
            } else {
                console.error('Failed to fetch editor data');
                toast.error('获取游戏数据失败，请稍后重试');
                // 请求失败时，清除 hasFetchedRef，允许重试
                if (hasFetchedRef.current === id) {
                    hasFetchedRef.current = null;
                }
            }
        } catch (error) {
            console.error('Error fetching editor data:', error);
            toast.error('获取游戏数据失败，请稍后重试');
            // 请求失败时，清除 hasFetchedRef，允许重试
            if (hasFetchedRef.current === id) {
                hasFetchedRef.current = null;
            }
        } finally {
            if (shouldShowGlobalLoading) {
                setIsLoadingData(false);
            }
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
                                        // worldInteraction 模式：直接使用 scene（包含 subscenes 和 position）
                                        return worldEditor.updateScene(fileId, scene as any);
                                    } else {
                                        const sceneData: ApiScene = {
                                            id: scene.id,
                                            name: scene.name,
                                            type: 'type' in scene ? (scene.type || '') : '',
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
                const sessionResponse = await createWorldSessionApi.createWorldEditSession({ fileId });
                if (sessionResponse.data.success) {
                    const sessionId = sessionResponse.data.session.sessionId;
                    setFileId(fileId);
                    setSessionId(sessionId);
                    navigate(`/galgameMap`);
                    return sessionId;
                } else {
                    toast.error((sessionResponse.data as any)?.message || '创建世界交互游戏失败，请重试');
                    return null;
                }
            } else {
                const sessionResponse = await createGalgameSessionApi.createGalgameEditSession({ fileId: fileId });
                if (sessionResponse.data.success) {
                    const sessionId = sessionResponse.data.session.sessionId;
                    setFileId(fileId);
                    setSessionId(sessionId);
                    setIsPreset(false);
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
    }, [user?.user?.id, fileId, navigate, setFileId, setSessionId, mode]);

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

                {/* 编辑器全局加载遮罩（获取游戏文件 / 刷新数据时） */}
                {isLoadingData && (
                    <div className="loadingOverlay">
                        <div className="loadingSpinner"></div>
                        <div className="loadingText">正在加载游戏数据...</div>
                    </div>
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
