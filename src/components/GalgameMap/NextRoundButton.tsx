import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './NextRoundButton.module.css';
import { MdCheckCircle } from 'react-icons/md';

interface NextRoundButtonProps {
    onClick: () => void;
    disabled?: boolean;
    isLoading?: boolean;
}


const NextRoundButton: React.FC<NextRoundButtonProps> = ({
    onClick,
    disabled = false,
    isLoading = false,
}) => {
    const { t } = useTranslation();
    return (
        <div className={styles.nextRoundButtonWrapper}>
            <button
                onClick={onClick}
                disabled={disabled || isLoading}
                className={styles.nextRoundButton}
            >
                <MdCheckCircle />
                <span>{isLoading ? t('galgameUi.nextRound.loading') : t('galgameUi.nextRound.start')}</span>
            </button>
        </div>
    );
};

export default NextRoundButton;

