import { useCallback } from 'react';
import type { CharacterAnimationType } from './useCharacterAnimation';

interface UseCharacterContainerClassNameOptions {
    characterPosition?: 'left' | 'right';
    characterAnimation: CharacterAnimationType;
    styles: Record<string, string>;
}

export const useCharacterContainerClassName = ({
    characterPosition,
    characterAnimation,
    styles,
}: UseCharacterContainerClassNameOptions) => {
    const getClassName = useCallback(() => {
        const classes = [styles.characterContainer];

        // 位置类
        if (characterPosition === 'left') {
            classes.push(styles.characterSlideLeft);
        } else if (characterPosition === 'right') {
            classes.push(styles.characterSlideRight);
        }

        // 动画类
        if (characterAnimation === 'jump') {
            if (characterPosition === 'left') {
                classes.push(styles.characterJumpLeft);
            } else if (characterPosition === 'right') {
                classes.push(styles.characterJumpRight);
            }
        } else if (characterAnimation === 'vibration') {
                classes.push(styles.characterVibration);
            
        }
        classes.push(styles.characterVibration);

        // classes.push(styles.characterJumpLeft);

        return classes.join(' ');
    }, [characterPosition, characterAnimation, styles]);

    return getClassName;
};

