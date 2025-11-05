import React, { useState } from 'react';
import styles from './EventModal.module.css';
import { HOST_ADDRESS } from '../../config';
import { useGameStore } from '../../store/gameStore';
import BuildingEventModal from './BuildingEventModal';

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
    onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({
    isOpen,
    event,
    onOptionSelect,
    currentSceneId,
    onClose
}) => {
    const { sessionId } = useGameStore();
    const [buildingModalOpen, setBuildingModalOpen] = useState(false);
    const [streamResponse, setStreamResponse] = useState<Response | null>(null);
    
    // 如果既没有打开也没有事件，且没有打开建筑弹窗，则不渲染
    if (!isOpen && !event && !buildingModalOpen) return null;

    const handleBuildInteraction = async (index: number) => {
        if (!event) return;
        
        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/game/session/${sessionId}/building-feature/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sceneId: currentSceneId,
                    buildingId: event.id,
                    feature: event.options[index].text,
                    selectedOption: null
                })
            });
            
            if (response.ok) {
                console.log('✅ 流式请求成功，打开 BuildingEventModal');
                // 先打开 BuildingEventModal 并传递响应
                setStreamResponse(response);
                setBuildingModalOpen(true);
                // 关闭原始事件弹窗
                onClose();
            } else {
                console.error("Error selecting option:", response.statusText);
                // 如果请求失败，仍然执行原来的逻辑
                onOptionSelect(index);
            }
        } catch (error) {
            console.error("Error selecting option:", error);
            // 如果请求失败，仍然执行原来的逻辑
            onOptionSelect(index);
        }
    };

    const handleCloseBuildingModal = () => {
        setBuildingModalOpen(false);
        setStreamResponse(null);
        // 关闭后执行选项效果
        // 注意：这里不调用 onOptionSelect，因为流式输出已经处理了交互
    };

    return (
        <>
            {isOpen && event && (
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
            )}
            {/* BuildingEventModal 独立渲染，不依赖 EventModal 的 isOpen */}
            <BuildingEventModal
                isOpen={buildingModalOpen}
                onClose={handleCloseBuildingModal}
                streamResponse={streamResponse}
            />
        </>
    );
};

export default EventModal;
