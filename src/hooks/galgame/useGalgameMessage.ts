import { useCallback, useMemo } from "react";
import type { GetGalgamePresetResponse } from "../../api/galgame/getGalgamePreset.type";
import { extractPlainText, truncateTextWithTags } from "../../utils/textUtils";
import { getPlayerImageUrl, getImageUrl } from "../../utils/constants";
import { withCacheBust } from "../../utils/imageCache";

export interface Message {
    id: number;
    type: 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string; isMain?: boolean }>;
}

/**
 * Galgame 消息转换 Hook
 */
export const useGalgameMessage = (
    worldSetting: GetGalgamePresetResponse['world'] | null,
    npcSetting: GetGalgamePresetResponse['npcs'] | null,
    gameStarted: boolean,
    currentStep: any,
    initialMessages: Message[],
    displayedText: string,
    isTyping: boolean,
    isWaitingForData: boolean,
    currentStepForTextModal: any
) => {
    const latestNpcById = useMemo(() => {
        const map = new Map<string, GetGalgamePresetResponse['npcs']['npcs'][0]>();
        (npcSetting?.npcs || []).forEach((npc) => {
            if (npc?.id) {
                map.set(String(npc.id), npc);
            }
        });
        return map;
    }, [npcSetting]);

    const toDisplayImageUrl = useCallback((imagePath?: string | null): string | undefined => {
        if (!imagePath) return undefined;
        if (imagePath.startsWith('blob:') || imagePath.startsWith('data:')) return imagePath;
        const imageUrl = getImageUrl(imagePath);
        return imageUrl ? withCacheBust(getImageUrl(imagePath)) : undefined;
    }, []);

    const normalizeImageKey = useCallback((imagePath?: string | null): string | null => {
        if (!imagePath) return null;
        const cleanPath = imagePath.split('?')[0].split('#')[0];
        const fileName = cleanPath.split('/').pop() || '';
        const withoutExt = fileName.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
        return withoutExt.replace(/_\d{10,}_[A-Za-z0-9]{6}$/, '') || null;
    }, []);

    const resolveNpcImagePath = useCallback((step: any): string | undefined => {
        const npcId = step?.speakerId || step?.npcId;
        const latestNpc = npcId ? latestNpcById.get(String(npcId)) : null;
        const latestImages = latestNpc?.images;

        if (latestImages && typeof latestImages === 'object') {
            if (step?.activeImage && step?.npcImages && typeof step.npcImages === 'object') {
                const matchedEntry = Object.entries(step.npcImages).find(([, value]) => value === step.activeImage);
                const matchedKey = matchedEntry?.[0];
                if (matchedKey && latestImages[matchedKey]) {
                    return latestImages[matchedKey];
                }
            }

            const normalizedKey = normalizeImageKey(step?.activeImage);
            if (normalizedKey && latestImages[normalizedKey]) {
                return latestImages[normalizedKey];
            }

            return latestImages.base || Object.values(latestImages).find((value): value is string => typeof value === 'string' && value.trim() !== '');
        }

        return step?.activeImage;
    }, [latestNpcById, normalizeImageKey]);

    // 转换步骤为消息
    const convertStepToMessage = useCallback((step: any): Message | null => {
        if (!step) return null;

        if (step.type === 'narration') {
            return {
                id: Date.now(),
                type: 'narration',
                message: step.content || '',
            };
        } else if (step.type === 'transition') {
            return {
                id: Date.now(),
                type: 'transition',
                message: step.content || '',
            };
        } else if (step.type === 'dialogue') {
            const characterName = step.isPlayer ? worldSetting?.player?.name : step.speakerName || step.npcId || '未知角色';
            let characterImage: string | undefined;

            if (step.isPlayer) {
                const playerImagePath = getPlayerImageUrl(worldSetting?.player);
                if (playerImagePath) {
                    characterImage = toDisplayImageUrl(playerImagePath);
                }
            } else {
                const npcImagePath = resolveNpcImagePath(step);
                if (npcImagePath) {
                    characterImage = toDisplayImageUrl(npcImagePath);
                }
            }

            if (!characterImage && step.activeImage) {
                // 使用统一的 getImageUrl 处理 URL
                characterImage = toDisplayImageUrl(step.activeImage);
            }

            return {
                id: Date.now(),
                type: 'dialogue',
                message: step.content || '',
                characterName,
                characterImage,
                characterPosition: step.isPlayer ? 'right' : 'left',
            };
        } else if (step.type === 'choice') {
            // 支持后端新增的 mainOptions/mainOption 字段，并在 UI 中高亮展示
            const rawMainOptions = Array.isArray(step.mainOptions)
                ? step.mainOptions
                : (step.mainOption ? [step.mainOption] : []);

            const mainOptions =
                rawMainOptions.map((opt: any, index: number) => ({
                    id: index + 1,
                    text: typeof opt === 'string' ? opt : (opt.text || opt),
                    isMain: true as const,
                })) || [];

            const startId = mainOptions.length + 1;

            const rawOptions = step.options || [];
            const normalOptions =
                rawOptions.map((opt: any, index: number) => ({
                    id: startId + index,
                    text: typeof opt === 'string' ? opt : (opt.text || opt),
                    isMain: false as const,
                })) || [];

            const options = [...mainOptions, ...normalOptions];

            const message = step.title
                ? (step.description ? `${step.title}\n${step.description}` : step.title)
                : (step.description || '请选择你的行动');

            let characterImage: string | undefined;
            const playerImagePath = getPlayerImageUrl(worldSetting?.player);
            if (playerImagePath) {
                // 使用统一的 getImageUrl 处理 URL
                characterImage = toDisplayImageUrl(playerImagePath);
            }

            return {
                id: Date.now(),
                type: 'choice',
                message,
                options,
                characterImage,
                characterPosition: 'right',
            };
        } else if (step.type === 'scene_change') {
            const newScene: GetGalgamePresetResponse['scenes']['scenes'][0] = {
                id: step.sceneId || '',
                name: step.sceneName || '',
                type: '',
                description: step.sceneDescription || '',
                atmosphere: step.sceneAtmosphere,
                dangerLevel: step.dangerLevel,
                images: step.sceneImage,
                npcs: [],
                events: [],
                soundtrack: step.soundtrack,
            };

            return {
                id: Date.now(),
                type: 'scene_change',
                // 不再自动输出场景 description，scene_change 仅用于更新场景数据和背景
                message: '',
                sceneData: newScene,
            } as Message & { sceneData: GetGalgamePresetResponse['scenes']['scenes'][0] };
        }

        return null;
    }, [worldSetting, resolveNpcImagePath, toDisplayImageUrl]);

    const currentMessage = useMemo(() => {
        if (gameStarted && currentStep && currentStep.type) {
            const converted = convertStepToMessage(currentStep);
            if (converted) {
                return converted;
            }
        }

        if (initialMessages.length > 0) {
            return initialMessages[0];
        }

        return {
            id: 0,
            type: 'narration' as const,
            message: '',
        };
    }, [gameStarted, currentStep, convertStepToMessage, initialMessages]);

    const plainTextForTyping = useMemo(() => {
        if (currentMessage && currentMessage.type !== 'choice') {
            return extractPlainText(currentMessage.message);
        }
        return '';
    }, [currentMessage]);

    const finalDisplayText = isWaitingForData && !currentStep
        ? ''
        : (gameStarted ? displayedText : (currentMessage && currentMessage.type !== 'choice' ? currentMessage.message : ''));

    const finalIsTyping = (isWaitingForData && !currentStep) ? false : isTyping;

    // 转换步骤为文本模式格式
    const convertStepsToTextModalFormat = useCallback((steps: any[]): any[] => {
        return steps
            .filter(step => step != null && step.type)
            .map((step, index) => {
                const stableId = step.id || `step-${step.type}-${index}-${(step.content || '').substring(0, 20)}`;
                const baseStep = {
                    id: stableId,
                    type: step.type,
                    content: step.content || '',
                };

                if (step.type === 'dialogue') {
                    return {
                        ...baseStep,
                        speakerName: step.speakerName || step.npcId,
                        characterName: step.speakerName || step.npcId || '未知角色',
                        isPlayer: step.isPlayer || false,
                    };
                }

        if (step.type === 'choice') {
            const rawMainOptions = Array.isArray(step.mainOptions)
                ? step.mainOptions
                : (step.mainOption ? [step.mainOption] : []);

            const mainOptions =
                rawMainOptions.map((opt: any, idx: number) => ({
                    id: idx + 1,
                    text: typeof opt === 'string' ? opt : (opt.text || opt),
                    isMain: true as const,
                })) || [];

            const startId = mainOptions.length + 1;

            const rawOptions = step.options || [];
            const normalOptions =
                rawOptions.map((opt: any, idx: number) => ({
                    id: startId + idx,
                    text: typeof opt === 'string' ? opt : (opt.text || opt),
                    isMain: false as const,
                })) || [];

            const options = [...mainOptions, ...normalOptions];

            return {
                ...baseStep,
                title: step.title,
                description: step.description,
                options,
            };
        }

                return baseStep;
            });
    }, []);

    const textModalDisplayText = useMemo(() => {
        if (currentStepForTextModal &&
            currentStepForTextModal.type !== 'choice' &&
            currentMessage &&
            currentMessage.type !== 'choice' &&
            isTyping &&
            displayedText.length > 0) {
            const originalText = currentMessage.message || '';
            const currentPlainLength = displayedText.length;

            if (currentPlainLength > 0) {
                const textWithTags = truncateTextWithTags(originalText, currentPlainLength);
                return textWithTags;
            }
        }
        return '';
    }, [currentStepForTextModal, currentMessage, displayedText, isTyping]);

    return {
        convertStepToMessage,
        currentMessage,
        plainTextForTyping,
        finalDisplayText,
        finalIsTyping,
        convertStepsToTextModalFormat,
        textModalDisplayText,
    };
};
