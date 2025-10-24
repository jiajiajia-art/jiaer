import React from 'react';
import styles from './EventModal.module.css';

interface EventOption {
    text: string;
    effects?: any;
    nextEvent?: string | null;
}

interface EventDef {
    id: string;
    title: string;
    image: string;
    description: string;
    options: EventOption[];
    conditions?: any;
}

interface EventModalProps {
    isOpen: boolean;
    event: EventDef | null;
    onOptionSelect: (index: number) => void;
}

const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    event,
    onOptionSelect
}) => {
    if (!isOpen || !event) return null;

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <div className={styles.eventImage}>
                    {event.image && (
                        <img src={`http://localhost:3000${event.image}`} alt="事件图片" />
                    )}
                </div>
                <div className={styles.eventDescription}>
                    <p>{event.description || ''}</p>
                </div>
                <div className={styles.eventOptions}>
                    {event.options?.map((opt, idx) => (
                        <button 
                            key={idx} 
                            className={styles.eventOption} 
                            onClick={() => onOptionSelect(idx)}
                        >
                            {opt.text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EventModal;
