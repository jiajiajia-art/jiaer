import React from 'react';
import styles from './LeftPanels.module.css';
import ChatHistory from '../Rpg/ChatHistory';
import MissionsModal from '../Rpg/MissionsModal';
import type { ChatMessage } from '../Rpg/ChatHistory';
import type { MissionData } from '../../api/rpgGame/missionApi.type';

interface LeftPanelsProps {
    showHistory: boolean;
    historyMessages: ChatMessage[];
    loadingHistory: boolean;
    missionModalOpen: boolean;
    missionData: MissionData | null;
    loadingMissions: boolean;
    onCloseMission: () => void;
}

const LeftPanels: React.FC<LeftPanelsProps> = React.memo(({
    showHistory,
    historyMessages,
    loadingHistory,
    missionModalOpen,
    missionData,
    loadingMissions,
    onCloseMission
}) => {
    return (
        <div className={styles.leftPanels}>
            <div className={`${styles.panelCard} ${styles.historyPanel}`}>
                {showHistory && (
                    <ChatHistory
                        isOpen={true}
                        chatMessages={historyMessages}
                        loading={loadingHistory}
                    />
                )}
            </div>
            <div className={`${styles.panelCard} ${styles.missionsModalWrapper}`}>
                {missionModalOpen && (
                    <MissionsModal
                        missionData={missionData}
                        loading={loadingMissions}
                        onClose={onCloseMission}
                    />
                )}
            </div>
        </div>
    );
});

LeftPanels.displayName = 'LeftPanels';

export default LeftPanels;

