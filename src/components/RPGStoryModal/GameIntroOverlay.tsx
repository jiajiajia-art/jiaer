import React from 'react';
import styles from './GameIntroOverlay.module.css';

interface GameIntroOverlayProps {
    description: string;
    title: string;
    onClose: () => void;
}

const GameIntroOverlay: React.FC<GameIntroOverlayProps> = ({ description, title, onClose }) => {

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                <div className={styles.title}>{title}</div>
                <div className={styles.description}>
                    {description}
                </div>
                <div className={styles.buttonContainer}>
                    <button className={styles.closeBtn} onClick={onClose}>
                        开始游戏
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameIntroOverlay;

