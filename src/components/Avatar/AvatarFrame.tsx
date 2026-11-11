import React from 'react';
import styles from './AvatarFrame.module.css';

export type AvatarFrameVariant = 'rounded' | 'circle';

type Props = {
  src: string;
  alt?: string;
  /** rounded：角色详情圆角方；circle：聊天列表圆 */
  variant?: AvatarFrameVariant;
  className?: string;
  size?: number | string;
};

/**
 * 功能注释：展示已裁好的 1:1 头像；禁止再走立绘 bust/头顶裁切，否则与用户选区不一致。
 */
const AvatarFrame: React.FC<Props> = ({
  src,
  alt = '',
  variant = 'rounded',
  className = '',
  size,
}) => {
  const style = size != null
    ? { width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }
    : undefined;
  return (
    <div
      className={[
        styles.root,
        variant === 'circle' ? styles.circle : styles.rounded,
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {src ? (
        <img src={src} alt={alt} className={styles.img} draggable={false} />
      ) : (
        <span className={styles.fallback} aria-hidden />
      )}
    </div>
  );
};

export default AvatarFrame;
