import React from 'react';
import styles from './EventModal.module.css';
import { HOST_ADDRESS } from '../../config';
import { useGameStore } from '../../store/gameStore';

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
    currentSceneId: string;
    building?: any; // 建筑信息
    onOpenDialogue?: (initialText: string) => void; // 打开对话弹窗的回调
    onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    event,
    onOptionSelect,
    currentSceneId,
    building,
    onOpenDialogue,
    onClose
}) => {
    if (!isOpen || !event) return null;
    console.log("event",event);
    const { sessionId } = useGameStore();
    
    const handleBuildInteraction = async (index: number) => {
        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/game/session/${sessionId}/building-interaction/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sceneId: currentSceneId,
                    buildingId: event.id,
                    action: event.options[index].text,
                    branchId: null,
                    turnNumber: 1
                })
               });
            if (response.ok) {
                console.log("data", response);
            } else {
                console.error("Error selecting option:", response.statusText);
            }
        } catch (error) {
            console.error("Error selecting option:", error);
        }
        
        // 构建输入框消息：来到了[建筑名称]，触发了[选项文本]
        const buildingName = building?.name || event.title || '某个建筑';
        const actionText = event.options[index]?.text || '';
        const initialMessage = `来到了${buildingName}，开始${actionText}`;
        
        // 先关闭事件弹窗
        onOptionSelect(index);
        
        // 打开对话弹窗并设置初始输入
        if (onOpenDialogue) {
            onOpenDialogue(initialMessage);
        }
    }
    
    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <div className={styles.eventImage}>
                    {event.image && (
                        <img src={`${HOST_ADDRESS}${event.image}`} alt="事件图片" />
                    )}
                </div>
                <div className={styles.closeBtn} onClick={onClose}>
                    <img src="/data/asset/关闭按钮.png" alt="关闭" />
                </div>
                <div className={styles.eventDescription}>
                    <p>{event.description || ''}</p>
                </div>
                <div className={styles.eventOptions}>
                    {event.options?.map((opt, idx) => (
                        <button 
                            key={idx} 
                            className={styles.eventOption} 
                            onClick={() => handleBuildInteraction(idx)}
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
