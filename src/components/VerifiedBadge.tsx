import React, { useId } from 'react';
import styles from './VerifiedBadge.module.css';

interface VerifiedBadgeProps {
  className?: string;
  variant?: 'inline' | 'overlay';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function VerifiedMark({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="3" y1="2" x2="13" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-highlight)" />
          <stop offset="1" stopColor="var(--color-highlight)" />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="7.25" fill={`url(#${gradientId})`} />
      <path
        d="M5.2 5.35 7.95 10.65 10.7 5.35"
        fill="none"
        stroke="var(--color-text)"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  className = '',
  variant = 'inline',
  size = 'md',
}) => {
  const gradientId = useId().replace(/:/g, '');

  return (
    <span
      className={`${styles.badge} ${styles[size]} ${variant === 'overlay' ? styles.overlay : styles.inline} ${className}`.trim()}
      aria-label="verified creator"
      title="官方认证"
    >
      <VerifiedMark gradientId={gradientId} />
    </span>
  );
};

export default VerifiedBadge;
