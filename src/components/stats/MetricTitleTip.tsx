import React, { useEffect, useId, useRef, useState } from 'react';
import styles from './MetricTitleTip.module.css';

interface MetricTitleTipProps {
  title: React.ReactNode;
  tip?: string;
  className?: string;
}

/**
 * 功能注释：标题旁「?」说明。移动端左侧易被居中浮层裁切，改为通栏展开面板，
 * 保证长文案完整可见；桌面仍可用悬停/聚焦打开。
 */
const MetricTitleTip: React.FC<MetricTitleTipProps> = ({ title, tip, className }) => {
  const tipId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!tip) {
    return (
      <div className={`${styles.wrapper} ${className ?? ''}`.trim()}>
        <span>{title}</span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.wrapper} ${open ? styles.wrapperOpen : ''} ${className ?? ''}`.trim()}
    >
      <span>{title}</span>
      <button
        type="button"
        className={styles.tipTrigger}
        aria-label={tip}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span aria-hidden>?</span>
      </button>
      <div id={tipId} className={styles.tipBubble} role="tooltip">
        {tip}
      </div>
    </div>
  );
};

export default MetricTitleTip;
