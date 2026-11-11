import { useState, useEffect, useRef } from 'react';
import { hasJumpTag, hasVibrationTag, hasinjuryTag } from '../../utils/textUtils';

export type CharacterAnimationType = 'jump' | 'vibration' | 'injury' | null;

interface UseCharacterAnimationOptions {
    message: string | undefined;
    messageType: string | undefined;
}

export const useCharacterAnimation = ({ message, messageType }: UseCharacterAnimationOptions) => {
    const [characterAnimation, setCharacterAnimation] = useState<CharacterAnimationType>(null);
    const previousMessageRef = useRef<string | undefined>(undefined);
    const vibrationTimerRef = useRef<number | null>(null);

    useEffect(() => {
        // 清除之前的震动定时器
        if (vibrationTimerRef.current) {
            clearTimeout(vibrationTimerRef.current);
            vibrationTimerRef.current = null;
        }

        // 只有当消息真正改变时才触发动画
        if (message === previousMessageRef.current) {
            return;
        }
        previousMessageRef.current = message;

        if (message && messageType === 'dialogue') {
            if (hasJumpTag(message)) {
                setCharacterAnimation('jump');
                // 跳跃动画完成后保持位置，不清除动画类
            } else if (hasVibrationTag(message)) {
                // 只有在当前不是震动状态时才设置，避免重复触发
                if (characterAnimation !== 'vibration') {
                    setTimeout(() => {
                        setCharacterAnimation('vibration');
                    }, 300);
                    // vibrationTimerRef.current = setTimeout(() => {
                    //     setCharacterAnimation(null);
                    //     vibrationTimerRef.current = null;
                    // }, 900);
                }
            } else if (hasinjuryTag(message)) {
                // 受伤动画，持续显示直到消息改变（进入下一个step）
                setCharacterAnimation('injury');
            } else {
                // 当消息改变且没有跳跃标签时，清除跳跃动画
                if (characterAnimation === 'jump') {
                    setCharacterAnimation(null);
                }
            }
        } else {
            setCharacterAnimation(null);
        }

        return () => {
            if (vibrationTimerRef.current) {
                clearTimeout(vibrationTimerRef.current);
                vibrationTimerRef.current = null;
            }
        };
    }, [message, messageType]); // 移除 characterAnimation 依赖，避免重复触发

    return characterAnimation;
};

