import React, { useCallback, useRef, useState } from 'react';
import type { CharacterAnimationType } from '../../hooks/galgame/useCharacterAnimation';
import {
    isImportedCardPortraitUrl,
    isSessionGeneratedPortraitUrl,
} from '../../lib/galgame/playerCharacterCard';
import { PLAY_TRIMMED_PORTRAIT_MAX_FILL } from '../../lib/galgame/portraitCanvasDraw';
import galgameStyles from '../../page/Galgame.module.css';
import GameImageRenderer from './GameImageRenderer';
import styles from './CharacterLayer.module.css';

export interface CharacterLayerProps {
    characterImage: string | null | undefined;
    characterPosition?: 'left' | 'right';
    portraitScale?: number;
    portraitOffsetX?: number;
    portraitOffsetY?: number;
    animation?: CharacterAnimationType;
    containerClassName?: string;
    containerStyle?: React.CSSProperties;
    /** 禁用 GameImageRenderer 的 Canvas 渲染，改用原生 img（用于编辑器预览） */
    useImageFallback?: boolean;
    /** 启用拖拽调整位置（用于编辑器预览） */
    draggable?: boolean;
    /** 位置变化回调 */
    onPositionChange?: (offsetX: number, offsetY: number) => void;
}

/**
 * 角色立绘渲染组件
 * 复用游戏中的角色渲染逻辑，确保编辑器预览与游戏一致
 */
const CharacterLayer: React.FC<CharacterLayerProps> = ({
    characterImage,
    characterPosition = 'right',
    portraitScale,
    portraitOffsetX = 0,
    portraitOffsetY = 0,
    animation,
    containerClassName = '',
    containerStyle,
    useImageFallback = false,
    draggable = false,
    onPositionChange,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!draggable) return;
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            offsetX: portraitOffsetX,
            offsetY: portraitOffsetY,
        };
    }, [draggable, portraitOffsetX, portraitOffsetY]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !draggable) return;

        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        // deltaY 反转：鼠标向上拖 = 正数（与滑块方向一致）
        const newOffsetX = Math.round((dragStartRef.current.offsetX + deltaX * 0.5) / 5) * 5;
        const newOffsetY = Math.round((dragStartRef.current.offsetY - deltaY * 0.5) / 5) * 5;

        // 限制范围
        const clampedX = Math.max(-200, Math.min(200, newOffsetX));
        const clampedY = Math.max(-200, Math.min(200, newOffsetY));

        onPositionChange?.(clampedX, clampedY);
    }, [isDragging, draggable, onPositionChange]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 触摸事件支持
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!draggable) return;
        const touch = e.touches[0];
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            offsetX: portraitOffsetX,
            offsetY: portraitOffsetY,
        };
    }, [draggable, portraitOffsetX, portraitOffsetY]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging || !draggable) return;
        const touch = e.touches[0];

        const deltaX = touch.clientX - dragStartRef.current.x;
        const deltaY = touch.clientY - dragStartRef.current.y;

        const newOffsetX = Math.round((dragStartRef.current.offsetX + deltaX * 0.5) / 5) * 5;
        const newOffsetY = Math.round((dragStartRef.current.offsetY - deltaY * 0.5) / 5) * 5;

        const clampedX = Math.max(-200, Math.min(200, newOffsetX));
        const clampedY = Math.max(-200, Math.min(200, newOffsetY));

        e.stopPropagation();
        onPositionChange?.(clampedX, clampedY);
    }, [isDragging, draggable, onPositionChange]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    if (!characterImage) {
        return null;
    }

    const getContainerStyle = (): React.CSSProperties => {
        const style: React.CSSProperties = {};

        // 如果是可拖拽状态，确保容器覆盖整个父元素
        if (draggable) {
            style.position = 'absolute';
            style.left = 0;
            style.top = 0;
            style.right = 0;
            style.bottom = 0;
            style.width = '100%';
            style.height = '100%';
        }

        if (containerStyle) {
            return { ...style, ...containerStyle };
        }
        return style;
    };

    const getContainerClassName = () => {
        const classes = [galgameStyles.characterContainer];

        if (characterPosition === 'left') {
            classes.push(galgameStyles.characterSlideLeft);
        } else {
            classes.push(galgameStyles.characterSlideRight);
        }

        if (animation === 'jump') {
            if (characterPosition === 'left') {
                classes.push(galgameStyles.characterJumpLeft);
            } else {
                classes.push(galgameStyles.characterJumpRight);
            }
        } else if (animation === 'vibration') {
            classes.push(galgameStyles.characterVibration);
        }

        if (draggable) {
            classes.push(styles.draggable);
            if (isDragging) {
                classes.push(styles.dragging);
            }
        }

        if (containerClassName) {
            classes.push(containerClassName);
        }

        return classes.join(' ');
    };

    const getWrapperStyle = (): React.CSSProperties => {
        // 未配置时默认 scale=1（铺满容器 object-fit:contain）；禁止默认 1.5，否则头顶会被裁切/超出
        // 导入/局内头像的缩小由上层 resolvePlayPortraitScale 显式传入，勿全局改默认
        const hasExplicitScale = portraitScale !== undefined
            && portraitScale !== null
            && Number.isFinite(Number(portraitScale));
        const effectiveScale = hasExplicitScale ? Number(portraitScale) : 1;
        const offsetX = Number(portraitOffsetX) || 0;
        const offsetY = Number(portraitOffsetY) || 0;
        const needsTransform = (hasExplicitScale && effectiveScale !== 1) || offsetX !== 0 || offsetY !== 0;
        // 正 portraitOffsetY = 向上（translate 负值 = 向上）
        const yTransform = -offsetY / 10;
        const baseStyle: React.CSSProperties = {
            position: 'absolute' as const,
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            transform: needsTransform
                ? `scale(${effectiveScale}) translate(${offsetX / 10}%, ${yTransform}%)`
                : undefined,
            transformOrigin: 'bottom center',
            display: 'flex' as const,
            alignItems: 'flex-end',
            justifyContent: characterPosition === 'left' ? 'flex-start' : 'flex-end',
            overflow: 'hidden',
        };

        // 拖拽时添加 cursor 样式
        if (draggable) {
            baseStyle.cursor = isDragging ? 'grabbing' : 'grab';
        }

        return baseStyle;
    };

    const imageClassName = galgameStyles.characterImage;
    // 功能注释：导入/重生成图常带大块透明边，不裁则 CSS scale=1 仍显小
    const trimOpaquePadding = isImportedCardPortraitUrl(characterImage)
        || isSessionGeneratedPortraitUrl(characterImage);

    return (
        <div
            ref={containerRef}
            className={getContainerClassName()}
            style={getContainerStyle()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div
                style={getWrapperStyle()}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {useImageFallback ? (
                    <img
                        src={characterImage}
                        alt=""
                        className={imageClassName}
                        style={{ maxHeight: `${Math.round(PLAY_TRIMMED_PORTRAIT_MAX_FILL * 100)}%` }}
                    />
                ) : (
                    <GameImageRenderer
                        src={characterImage}
                        className={imageClassName}
                        useCanvas={true}
                        disableMobileGuard={true}
                        trimOpaquePadding={trimOpaquePadding}
                        maxFillRatio={PLAY_TRIMMED_PORTRAIT_MAX_FILL}
                    />
                )}
            </div>
        </div>
    );
};

export default CharacterLayer;
