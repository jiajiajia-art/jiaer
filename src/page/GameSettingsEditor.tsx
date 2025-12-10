import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentsPanel';
import WorldPanel from '../components/GameSettingEditor/WorldPanel';
import CharactersPanel from '../components/GameSettingEditor/CharactersPanel';
import ScenesPanel from '../components/GameSettingEditor/ScenesPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import { authFetch } from '../api/base';
import EditorApi from '../api/galgame/EditorData';
import type { AllGameData } from '../api/galgame/EditorData.type';
import type { Scene as ApiScene } from '../api/galgame/getGalgamePreset.type';
import { toast, Toaster } from 'react-hot-toast';
import { useEditorStore } from '../store/editorStore';
import GameAction from '../api/game/gameAction';
import { useNavigate } from 'react-router-dom';
import PublishSettingsModal from '../components/goodsModal/PublishSettingsModal';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import { useAuthStore } from '../store/useAuthStore';

const GameSettingsEditor = () => {
    // 从 Zustand store 获取状态和方法
    const { fileId, activePanel, isParsed, setFileId, setActivePanel, setIsParsed } = useEditorStore();
    const { user} = useAuthStore();
    
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [gameData, setGameData] = useState<AllGameData | null>(null);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
    const navigate = useNavigate();

    // 各个面板的数据获取函数引用
    const worldPanelGetDataRef = useRef<() => Partial<AllGameData> | null>(null);
    const charactersPanelGetDataRef = useRef<() => Partial<AllGameData> | null>(null);
    const scenesPanelGetDataRef = useRef<() => Partial<AllGameData> | null>(null);

    const handlePanelChange = (panelId: string) => {
        if (isParsing && panelId !== 'documents') {
            return;
        }
        if (!isParsed && panelId !== 'documents') {
            return;
        }
        setActivePanel(panelId);
    };

    const handleFileUpload = async (file: File): Promise<boolean> => {
        // fetchEditorData('893d61c0-5fbe-4251-b83c-4e9bcfb4bda3');
        const formData = new FormData();
        formData.append('document', file);
        try {
            // 不设置 timeout，允许后端有足够时间处理文件上传和解析
            const response = await authFetch('/api/optical/games/upload', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                const data = await response.json();
                console.log('File uploaded successfully:', data);

                // 从响应中获取 fileId
                const uploadedFileId = data.fileId || data.data?.fileId || data.file_id;
                if (uploadedFileId) {
                    console.log("Uploaded File ID:", uploadedFileId);
                    
                    // 使用 Zustand store 更新 fileId（自动保存到 localStorage）
                    setFileId(uploadedFileId);
                    setIsParsed(false);
                }

                return true;
            } else {
                console.error('Error uploading file:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            return false;
        }
    };

    // 获取编辑器数据
    const fetchEditorData = useCallback(async (id: string) => {
        if (!id) return;

        setIsLoadingData(true);
        try {
            const response = await EditorApi.getEditorData(id);
            if (response.data?.success && response.data) {
                setGameData(response.data);
                // 从响应中获取 fileId 并设置（如果还没有设置的话）
                if (response.data.fileId) {
                    // 使用 Zustand store 更新 fileId（自动保存到 sessionStorage）
                    setFileId(response.data.fileId);
                }
                console.log('Editor data fetched successfully:', response.data);
            } else {
                console.error('Failed to fetch editor data');
            }
        } catch (error) {
            console.error('Error fetching editor data:', error);
        } finally {
            setIsLoadingData(false);
        }
    }, []);

    // 初始化：如果有保存的 fileId 且已解析，自动加载数据
    useEffect(() => {
        if (fileId && isParsed && !gameData && !isLoadingData) {
            fetchEditorData(fileId);
        }
    }, [fileId, isParsed, gameData, isLoadingData, fetchEditorData]);

    useEffect(() => {
        if (fileId){
            setIsParsed(true);
            fetchEditorData(fileId);
            setActivePanel('world');
        }
    }, []);

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
                            response = await EditorApi.updateWorldSetting(fileId, worldSettingDiff);
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
                                    EditorApi.updateNpc(fileId, npc)
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
                                    // 确保场景数据包含必需的字段
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
    }, [fileId, gameData, activePanel]);

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
        console.log('pdfF', fileId);
        
        if (!fileId || !user?.user?.id) {
            return null;
        }
        console.log('测试体验');
        
        try {
            // 创建 galgame 会话
            const sessionResponse = await createGalgameSessionApi.createGalgameSession({ presetId: fileId });
            if (sessionResponse.data.success) {
                const sessionId = sessionResponse.data.data.session.session_id;
                // 成功创建会话后跳转到galgame页面
                navigate(`/galgame`);
                return sessionId;
            } else {
                toast.error(sessionResponse.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error: any) {
            console.error('❌ Galgame Session 创建错误:', error);
            const errorMessage = error.response?.data?.message || error.message || '创建游戏失败，请稍后重试';
            toast.error(errorMessage);
            return null;
        }
    }, [user?.user?.id, fileId, navigate]);

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
            />
            <main className={styles.main}>
                <header className={styles.topBar}>
                    <div>
                        <p className={styles.eyebrow}>KURAN · CREATOR</p>
                        <h1>游戏创作流程</h1>
                        <p className={styles.subtitle}>
                            Step 1 上传 Word / PDF → Step 2 表单化校对世界观 → Step 3 角色差分 → Step 4
                            场景绑定 BGM
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

                        {/* {showSubmitButton && (
                            <button
                                className={styles.primary}
                                onClick={(e) => {
                                    e.preventDefault();
                                    console.log('按钮被点击', { fileId, gameData: !!gameData, isSubmitting, isLoadingData, activePanel });
                                    handleSubmit();
                                }}
                                disabled={!fileId || !gameData || isSubmitting || isLoadingData}
                            >
                                {isSubmitting ? '提交中...' : '确认修改'}
                            </button>
                        )} */}
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
                    />
                </section>
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
