import React from 'react';
import styles from './MetricTitleTip.module.css';

interface MetricTitleTipProps {
  title: React.ReactNode;
  tip?: string;
  className?: string;
}

const MetricTitleTip: React.FC<MetricTitleTipProps> = ({ title, tip, className }) => (
  <div className={`${styles.wrapper} ${className ?? ''}`.trim()}>
    <span>{title}</span>
    {tip ? (
      <span className={styles.tipTrigger} tabIndex={0} aria-label={tip}>
        <span aria-hidden>?</span>
        <span className={styles.tipBubble} role="tooltip">
          {tip}
        </span>
      </span>
    ) : null}
  </div>
);

export default MetricTitleTip;
