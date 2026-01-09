import React from 'react';
import styles from './EventDisplayModal.module.css';
import type { AbilityNode } from '../../api/worldInteraction/worldInteractionApi.type';
import { getImageUrl } from '../../utils/constants';

interface EventDisplayModalProps {
    isOpen: boolean;
    abilityNode: AbilityNode | null;
    onClose?: () => void;
    onOptionClick?: (action: { id: string; name: string; description: string }) => void;
}

const EventDisplayModal: React.FC<EventDisplayModalProps> = ({
    isOpen,
    abilityNode,
    onClose,
    onOptionClick,
}) => {
    if (!isOpen || !abilityNode) return null;

    const image = abilityNode.imagePath ? getImageUrl(abilityNode.imagePath) : undefined;
    const description = abilityNode.authorNote || abilityNode.name || '功能性NPC';
    const options = abilityNode.actions || [];

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                {image && (
                    <div className={styles.eventImage}>
                        <img src={image} alt="事件图片" />
                    </div>
                )}
                {onClose && (
                    <div className={styles.closeBtn} onClick={onClose}>
                        <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                    </div>
                )}
                {description && (
                    <div className={styles.eventDescription}>
                        <p>{description}</p>
                    </div>
                )}
                {options.length > 0 && (
                    <div className={styles.eventOptions}>
                        {options.map((action, idx) => (
                            <button
                                key={action.id || idx}
                                className={styles.eventOption}

                                onClick={() => onOptionClick?.(action)}
                            >
                                {action.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventDisplayModal;

