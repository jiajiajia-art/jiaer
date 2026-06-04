import { useState, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import EditorApi from '../../api/galgame/EditorData';
import worldEditor from '../../api/worldInteraction/worldEditor';
import gameTagsApi from '../../api/gameTags/gameTagsApi';
import type { AllGameData, WorldSetting as GalgameWorldSetting } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData, WorldSetting as WIWorldSetting } from '../../api/worldInteraction/worldInteractionApi.type';
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
    handleSubmit: (options?: { onSuccess?: () => void; silentSuccess?: boolean }) => Promise<boolean>;
    worldPanelGetDataRef: RefObject<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>;
    charactersPanelGetDataRef: RefObject<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>;
    scenesPanelGetDataRef: RefObject<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>;
}

interface WorldPanelSubmitData {
    worldSetting?: Partial<GalgameWorldSetting> | Partial<WIWorldSetting>;
    themeTagIds?: number[];
    originalThemeTagIds?: number[];
}

const normalizeThemeTagIds = (ids?: number[]) =>
    Array.isArray(ids)
        ? ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];

const isSameThemeTagIds = (left: number[], right: number[]) => {
    if (left.length !== right.length) return false;

    const sortedLeft = [...left].sort((a, b) => a - b);
    const sortedRight = [...right].sort((a, b) => a - b);

    for (let index = 0; index < sortedLeft.length; index += 1) {
        if (sortedLeft[index] !== sortedRight[index]) {
            return false;
        }
    }

    return true;
};

export const useEditorSubmit = ({
    fileId,
    gameData,
    activePanel,
    mode,
    onDataRefresh,
}: UseEditorSubmitOptions): UseEditorSubmitReturn => {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const worldPanelGetDataRef = useRef<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>(null);
    const charactersPanelGetDataRef = useRef<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>(null);
    const scenesPanelGetDataRef = useRef<(() => Partial<AllGameData | WorldInteractionGameData> | null) | null>(null);

    const handleSubmit = useCallback(async (options?: { onSuccess?: () => void; silentSuccess?: boolean }) => {
        if (!fileId || !gameData) {
            toast.error(t('common.editorSubmit.missingData'));
            return false;
        }

        setIsSubmitting(true);
        try {
            let response: { data?: { success?: boolean } } | null = null;

            switch (activePanel) {
                case 'world':
                    if (worldPanelGetDataRef.current) {
                        const worldData = worldPanelGetDataRef.current() as WorldPanelSubmitData | null;
                        const themeTagIds = normalizeThemeTagIds(worldData?.themeTagIds);
                        const originalThemeTagIds = normalizeThemeTagIds(worldData?.originalThemeTagIds);
                        const hasThemeTagChanges = !isSameThemeTagIds(themeTagIds, originalThemeTagIds);

                        // 实现题材必填校验
                        if (themeTagIds.length < 1 || themeTagIds.length > 2) {
                            toast.error(t('common.editorSubmit.themeTagRequired'));
                            setIsSubmitting(false);
                            return false;
                        }

                        if (worldData?.worldSetting) {
                            if (mode === 'worldInteraction') {
                                response = await worldEditor.updateWorldSetting(fileId, worldData.worldSetting as Partial<WIWorldSetting>);
                            } else {
                                response = await EditorApi.updateWorldSetting(fileId, worldData.worldSetting as Partial<GalgameWorldSetting>);
                            }
                        } else if (!hasThemeTagChanges) {
                            toast.error(t('common.editorSubmit.noChangesToSave'));
                            setIsSubmitting(false);
                            return false;
                        }

                        // 实现题材标签独立保存
                        if (worldData?.worldSetting || hasThemeTagChanges) {
                            const tagResponse = await gameTagsApi.setGameTagsForGame({
                                fileId,
                                tagIds: themeTagIds,
                            });
                            if (!tagResponse.data?.success) {
                                toast.error(t('common.editorSubmit.tagSaveFailed'));
                                return false;
                            }
                        }

                        if (!response) {
                            response = { data: { success: true } };
                        }
                    }
                    break;
                case 'characters':
                    if (charactersPanelGetDataRef.current) {
                        const npcData = charactersPanelGetDataRef.current();
                        if (npcData?.npcSetting) {
                            const npcs = npcData.npcSetting.npcs;
                            if (npcs && npcs.length > 0) {
                                const updatePromises = npcs.map((npc) => (
                                    mode === 'worldInteraction'
                                        ? worldEditor.updateNpc(fileId, npc as never)
                                        : EditorApi.updateNpc(fileId, npc as never)
                                ));
                                const results = await Promise.all(updatePromises);
                                if (results.every((r) => r.data?.success)) {
                                    response = { data: { success: true } };
                                }
                            }
                        }
                    }
                    break;
                case 'scenes':
                    if (scenesPanelGetDataRef.current) {
                        const sceneData = scenesPanelGetDataRef.current();
                        if (sceneData?.sceneSetting) {
                            const scenes = sceneData.sceneSetting.scenes;
                            if (scenes && scenes.length > 0) {
                                const updatePromises = scenes.map((scene) => {
                                    if (mode === 'worldInteraction') {
                                        return worldEditor.updateScene(fileId, scene as never);
                                    }
                                    const apiScene: ApiScene = {
                                        id: scene.id,
                                        name: scene.name,
                                        type: 'type' in scene ? (scene.type || '') : '',
                                        description: scene.description || '',
                                        images: scene.image,
                                        soundtrack: scene.soundtrack,
                                        npcs: [],
                                        events: [],
                                    };
                                    return EditorApi.updateScene(fileId, apiScene);
                                });
                                const results = await Promise.all(updatePromises);
                                if (results.every((r) => r.data?.success)) {
                                    response = { data: { success: true } };
                                }
                            }
                        }
                    }
                    break;
                default:
                    toast.error(t('common.editorSubmit.panelNotSupported'));
                    setIsSubmitting(false);
                    return false;
            }

            if (response && response.data?.success) {
                // 实现保存成功后先同步前端基线
                options?.onSuccess?.();
                toast.success(t('common.editorSubmit.saveSuccess'));
                await onDataRefresh();
                return true;
            } else {
                toast.error(t('common.editorSubmit.saveFailed'));
                return false;
            }
        } catch (error) {
            console.error(t('common.editorSubmit.error'), error);
            toast.error(t('common.editorSubmit.saveFailed'));
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [fileId, gameData, activePanel, mode, onDataRefresh, t]);

    return {
        isSubmitting,
        handleSubmit,
        worldPanelGetDataRef,
        charactersPanelGetDataRef,
        scenesPanelGetDataRef,
    };
};
