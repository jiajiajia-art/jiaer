import React from 'react';
import styles from './EventModal.module.css';

interface EventOption {
    text: string;
    action: () => void;
}

interface EventData {
    image: string;
    text: string;
    options: EventOption[];
}

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: EventData | null;
    onOptionSelect: (action: () => void) => void; // 这里的 action 是一个函数
}

const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    onClose,
    event,
    onOptionSelect,
}) => {
    if (!isOpen || !event) return null;

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <div className={styles.eventImage}>
                    <img src={event.image} alt="事件图片" />
                </div>
                <div className={styles.eventDescription}>
                    <p>{event.text}</p>
                </div>
                <div className={styles.eventOptions}>
                    {event.options.map((option, index) => (
                        <button
                            key={index}
                            className={styles.eventOption}
                            onClick={() => {
                                onOptionSelect(option.action);
                                onClose(); // 选择选项后关闭模态框
                            }}
                        >
                            {option.text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EventModal;
