import type { ReactNode } from 'react';
import { IoArrowBack } from 'react-icons/io5';
import styles from './CenteredPageHeader.module.css';

interface CenteredPageHeaderAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface CenteredPageHeaderProps {
  title: ReactNode;
  backLabel: string;
  onBack: () => void;
  rightAction?: CenteredPageHeaderAction;
}

const CenteredPageHeader = ({ title, backLabel, onBack, rightAction }: CenteredPageHeaderProps) => (
  <header className={styles.header}>
    <button type="button" className={styles.backButton} onClick={onBack} aria-label={backLabel}>
      <IoArrowBack aria-hidden="true" />
    </button>
    <h1 className={styles.title}>{title}</h1>
    {rightAction ? (
      <button
        type="button"
        className={styles.actionButton}
        onClick={rightAction.onClick}
        aria-label={rightAction.label}
        disabled={rightAction.disabled}
      >
        {rightAction.icon}
      </button>
    ) : (
      <span className={styles.actionSpacer} aria-hidden="true" />
    )}
  </header>
);

export default CenteredPageHeader;
