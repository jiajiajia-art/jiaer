import React from 'react';
import styles from './MobilePanels.module.css';
import ChatHistory from '../Rpg/ChatHistory';
import MissionsModal from '../Rpg/MissionsModal';
import PlayerFloatingPanel from '../Rpg/PlayerFloatingPanel';
import InventoryFloatingPanel from '../Rpg/InventoryFloatingPanel';
import type { ChatMessage } from '../Rpg/ChatHistory';
import type { MissionData } from '../../api/rpgGame/missionApi.type';
import type { PlayerData, Inventory, InventoryItem } from '../../api/rpgGame/gameData.type';
import type { EquipmentSlots } from '../../store/gameStore';

interface MobilePanelsProps {
    showHistory: boolean;
    historyMessages: ChatMessage[];
    loadingHistory: boolean;
    missionModalOpen: boolean;
    missionData: MissionData | null;
    loadingMissions: boolean;
    inventoryOpen: boolean;
    playerOpen: boolean;
    inventory: Inventory | null;
    player: PlayerData | null;
    onCloseHistory: () => void;
    onCloseMission: () => void;
    onCloseInventory: () => void;
    onClosePlayer: () => void;
    onEquipItem?: (item: InventoryItem, slot: keyof EquipmentSlots) => void;
    onUseItem?: (item: InventoryItem) => void;
}

const MobilePanels: React.FC<MobilePanelsProps> = React.memo(({
    showHistory,
    historyMessages,
    loadingHistory,
    missionModalOpen,
    missionData,
    loadingMissions,
    inventoryOpen,
    playerOpen,
    inventory,
    player,
    onCloseHistory,
    onCloseMission,
    onCloseInventory,
    onClosePlayer,
    onEquipItem,
    onUseItem
}) => {
    return (
        <>
            {showHistory && (
                <div className={`${styles.mobilePanelOverlay} ${styles.mobileHistoryModal}`}>
                    <div className={styles.mobilePanelContent}>
                        <ChatHistory
                            isOpen={showHistory}
                            chatMessages={historyMessages}
                            loading={loadingHistory}
                            onClose={onCloseHistory}
                        />
                    </div>
                </div>
            )}

            {missionModalOpen && (
                <div className={`${styles.mobilePanelOverlay} ${styles.mobileMissionModal}`}>
                    <div className={styles.mobilePanelContent}>
                        <MissionsModal
                            missionData={missionData}
                            loading={loadingMissions}
                            onClose={onCloseMission}
                        />
                    </div>
                </div>
            )}

            {inventoryOpen && inventory && (
                <div className={`${styles.mobilePanelOverlay} ${styles.mobileInventoryModal}`}>
                    <div className={styles.mobilePanelContent}>
                        <InventoryFloatingPanel
                            isOpen={true}
                            inventory={inventory}
                            onEquipItem={onEquipItem || (() => {})}
                            onUseItem={onUseItem || (() => {})}
                            onClose={onCloseInventory}
                        />
                    </div>
                </div>
            )}

            {playerOpen && (
                <div className={`${styles.mobilePanelOverlay} ${styles.mobilePlayerModal}`}>
                    <div className={styles.mobilePanelContent}>
                        <PlayerFloatingPanel
                            isOpen={true}
                            onClose={onClosePlayer}
                            player={player}
                        />
                    </div>
                </div>
            )}
        </>
    );
});

MobilePanels.displayName = 'MobilePanels';

export default MobilePanels;

