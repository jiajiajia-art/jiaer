import { getImageUrl } from "../../utils/constants";


export type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';

export interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string; optionId?: string }>;
}

export interface ModalState {
    visible: boolean;
    message: string;
}

// ==================== 图片处理 ====================

export const getImageUrls = (image: string | undefined): string | undefined => {
    if (!image) return undefined;
    if (image.startsWith('http')) return image;
    if (image.includes('data/assets')) return image;
    return getImageUrl(image) || undefined;
};

/** 获取玩家图片（支持字符串或对象格式） */
export const getPlayerImage = (playerImages: string | { [variant: string]: string } | undefined): string | undefined => {
    if (!playerImages) return undefined;
    const image = typeof playerImages === 'string' ? playerImages : (playerImages as any)?.base || '';
    return image ? getImageUrls(image) : undefined;
};

// ==================== 步骤转换 ====================

/** 将原始步骤转换为 Message 格式 */
export const convertStepToMessage = (
    step: any,
    worldSetting: any | null
): Message | null => {
    if (!step) return null;

    // 统一取文案的兜底字段，避免后端有时用 text/message
    const stepText = step.content || step.text || step.message || '';

    if (step.type === 'narration') {
        return {
            id: Date.now(),
            type: 'narration',
            message: stepText,
        };
    } else if (step.type === 'transition') {
        return {
            id: Date.now(),
            type: 'transition',
            message: stepText,
        };
    } else if (step.type === 'dialogue') {
        const isPlayer = step.npcId === worldSetting?.player?.name;
        const characterName = step.speakerName || step.npcId || step.speakerId || '未知角色';
        const characterImage = isPlayer 
            ? getPlayerImage(worldSetting?.player?.imagePath)
            : getImageUrls(step.activeImage || step.npcImages?.base);
        console.log(characterImage);
        
        return {
            id: Date.now(),
            type: 'dialogue',
            message: stepText,
            characterName,
            characterImage,
            characterPosition: isPlayer ? 'right' : 'left',
        };
    } else if (step.type === 'choice') {
        const options = step.options?.map((opt: any, index: number) => {
            if (typeof opt === 'string') {
                return { id: index + 1, text: opt };
            }
            return {
                id: index + 1,
                text: opt.text || opt,
                optionId: opt.optionId ? String(opt.optionId) : undefined,
            };
        }) || [];

        const message = step.title
            ? (step.description ? `${step.title}\n${step.description}` : step.title)
            : (step.description || '请选择你的行动');

        return {
            id: Date.now(),
            type: 'choice',
            message,
            options,
            characterImage: getPlayerImage(worldSetting?.player?.imagePath),
            characterPosition: 'right',
        };
    } else if (step.type === 'scene_change') {
        return {
            id: Date.now(),
            type: 'scene_change',
            message: step.sceneDescription || step.sceneName || '',
        };
    }

    return null;
};

/** 转换步骤为文本模式格式 */
export const convertStepsToTextModalFormat = (
    steps: any[],
    worldSetting: any | null
): any[] => {
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
                const isPlayer = step.npcId === worldSetting?.player?.name;
                return {
                    ...baseStep,
                    speakerName: step.speakerName || step.npcId || step.speakerId,
                    characterName: step.speakerName || step.npcId || step.speakerId || '未知角色',
                    isPlayer: isPlayer,
                };
            }

            if (step.type === 'choice') {
                const options = step.options?.map((opt: any, idx: number) => {
                    if (typeof opt === 'string') {
                        return { id: idx + 1, text: opt };
                    }
                    return {
                        id: idx + 1,
                        text: opt.text || opt,
                        optionId: opt.optionId ? String(opt.optionId) : undefined,
                    };
                }) || [];

                return {
                    ...baseStep,
                    title: step.title,
                    description: step.description,
                    options,
                };
            }

            return baseStep;
        });
};

// ==================== localStorage 工具 ====================

/** 获取 localStorage 的 key */
export const getStorageKeys = (sessionId: string | null, eventId: string | null) => ({
    allSteps: sessionId && eventId ? `world-allsteps-${sessionId}-${eventId}` : null,
    incomplete: sessionId && eventId ? `world-allsteps-incomplete-${sessionId}-${eventId}` : null,
    pendingRequest: sessionId && eventId ? `world-pending-request-${sessionId}-${eventId}` : null,
});

/** 安全读取 localStorage */
export const safeGetLocalStorage = (key: string | null): string | null => {
    if (!key || typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

/** 安全写入 localStorage */
export const safeSetLocalStorage = (key: string | null, value: string): boolean => {
    if (!key || typeof window === 'undefined') return false;
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
};

/** 安全删除 localStorage */
export const safeRemoveLocalStorage = (key: string | null): boolean => {
    if (!key || typeof window === 'undefined') return false;
    try {
        window.localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

