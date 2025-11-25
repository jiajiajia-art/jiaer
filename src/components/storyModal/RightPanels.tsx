import React from 'react';
import styles from './StoryModal.module.css';
import PlayerFloatingPanel from '../Mian/PlayerFloatingPanel';
import InventoryFloatingPanel from '../Mian/InventoryFloatingPanel';
import type { PlayerData, Inventory, InventoryItem } from '../../api/game/gameData.type';
import type { EquipmentSlots } from '../../store/gameStore';

interface RightPanelsProps {
    playerOpen: boolean;
    inventoryOpen: boolean;
    player: PlayerData | null;
    inventory: Inventory | null;
    onEquipItem?: (item: InventoryItem, slot: keyof EquipmentSlots) => void;
    onUseItem?: (item: InventoryItem) => void;
}

const RightPanels: React.FC<RightPanelsProps> = React.memo(({
    playerOpen,
    inventoryOpen,
    player,
    inventory,
    onEquipItem,
    onUseItem
}) => {
    return (
        <div className={styles.rightPanels}>
            <div className={`${styles.panelCard} ${styles.playerPanel}`}>
                {playerOpen && (
                    <PlayerFloatingPanel
                        isOpen={playerOpen}
                        player={player}
                    />
                )}
            </div>
            <div className={`${styles.panelCard} ${styles.inventoryPanel}`}>
                {inventoryOpen && (
                    <InventoryFloatingPanel
                        isOpen={inventoryOpen}
                        inventory={inventory}
                        onEquipItem={onEquipItem || (() => {})}
                        onUseItem={onUseItem || (() => {})}
                    />
                )}
            </div>
        </div>
    );
});

RightPanels.displayName = 'RightPanels';

export default RightPanels;

