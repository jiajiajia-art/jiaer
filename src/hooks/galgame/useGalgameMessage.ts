import { useCallback, useMemo } from "react";
import type { GetGalgamePresetResponse } from "../../api/galgame/getGalgamePreset.type";
import { extractPlainText, truncateTextWithTags } from "../../utils/textUtils";
import { getPlayerImageUrl, getImageUrl } from "../../utils/constants";

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
    gameStarted: boolean,
    currentStep: any,
    initialMessages: Message[],
    displayedText: string,
    isTyping: boolean,
    isWaitingForData: boolean,
    currentStepForTextModal: any
) => {
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

            if (step.activeImage) {
                // 使用统一的 getImageUrl 处理 URL
                characterImage = getImageUrl(step.activeImage);
            }

            if (step.isPlayer) {
                const playerImagePath = getPlayerImageUrl(worldSetting?.player);
                if (playerImagePath) {
                    characterImage = getImageUrl(playerImagePath);
                }
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
                characterImage = getImageUrl(playerImagePath);
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
                message: step.sceneDescription || step.sceneName || '',
                sceneData: newScene,
            } as Message & { sceneData: GetGalgamePresetResponse['scenes']['scenes'][0] };
        }

        return null;
    }, [worldSetting]);

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

