import React from 'react';
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
    return (
        <div className={styles.nextRoundButtonWrapper}>
            <button
                onClick={onClick}
                disabled={disabled || isLoading}
                className={styles.nextRoundButton}
            >
                <MdCheckCircle />
                <span>{isLoading ? '开启下一回合中...' : '开启下一回合'}</span>
            </button>
        </div>
    );
};

export default NextRoundButton;

