import { useState, useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { toast } from 'react-hot-toast';
import EditorApi from '../../api/galgame/EditorData';
import worldEditor from '../../api/worldInteraction/worldEditor';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';
import type { Scene as ApiScene } from '../../api/galgame/getGalgamePreset.type';

interface UseEditorSubmitOptions {
    fileId: string | null;
    gameData: AllGameData | WorldInteractionGameData | null;
    activePanel: string;
    mode: string | null;
    onDataRefresh: () => Promise<void>;
}

interface UseEditorSubmitReturn {
    isSubmitting: boolean;
    handleSubmit: () => Promise<void>;
    worldPanelGetDataRef: MutableRefObject<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>;
    charactersPanelGetDataRef: MutableRefObject<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>;
    scenesPanelGetDataRef: MutableRefObject<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>;
}

export const useEditorSubmit = ({
    fileId,
    gameData,
    activePanel,
    mode,
    onDataRefresh,
}: UseEditorSubmitOptions): UseEditorSubmitReturn => {
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const worldPanelGetDataRef = useRef<() => Partial<AllGameData | WorldInteractionGameData> | null>(null);
    const charactersPanelGetDataRef = useRef<() => Partial<AllGameData | WorldInteractionGameData> | null>(null);
    const scenesPanelGetDataRef = useRef<() => Partial<AllGameData | WorldInteractionGameData> | null>(null);

    const handleSubmit = useCallback(async () => {
        if (!fileId || !gameData) {
            toast.error('缺少必要数据，无法提交');
            return;
        }

        setIsSubmitting(true);
        try {
            let response: any = null;

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
                            response = mode === 'worldInteraction' 
                                ? await worldEditor.updateWorldSetting(fileId, worldSettingDiff) 
                                : await EditorApi.updateWorldSetting(fileId, worldSettingDiff);
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
                            const npcs = npcData.npcSetting.npcs;
                            if (npcs && npcs.length > 0) {
                                if (!fileId) {
                                    toast.error('缺少文件ID，无法保存');
                                    setIsSubmitting(false);
                                    return;
                                }
                                const updatePromises = npcs.map(npc =>
                                    mode === 'worldInteraction' 
                                        ? worldEditor.updateNpc(fileId, npc)
                                        : EditorApi.updateNpc(fileId, npc)
                                );
                                const results = await Promise.all(updatePromises);
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
                            const scenes = sceneData.sceneSetting.scenes;
                            if (scenes && scenes.length > 0) {
                                if (!fileId) {
                                    toast.error('缺少文件ID，无法保存');
                                    setIsSubmitting(false);
                                    return;
                                }
                                const updatePromises = scenes.map(scene => {
                                    if (mode === 'worldInteraction') {
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
                if (fileId) {
                    await onDataRefresh();
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
    }, [fileId, gameData, activePanel, mode, onDataRefresh]);

    return {
        isSubmitting,
        handleSubmit,
        worldPanelGetDataRef,
        charactersPanelGetDataRef,
        scenesPanelGetDataRef,
    };
};

