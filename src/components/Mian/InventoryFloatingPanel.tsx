import React from 'react';
import styles from './InventoryFloatingPanel.module.css';

interface Item {
    id: string;
    name?: string;
    icon?: string;
    quantity: number;
    stackable?: boolean;
    equippable?: boolean;
    usable?: boolean;
    slots?: string[];
    effects?: any;
}

interface EquipmentSlots {
    head: Item | null;
    body: Item | null;
    legs: Item | null;
    hands: Item | null;
    feet: Item | null;
    back: Item | null;
    leftHand: Item | null;
    rightHand: Item | null;
}

interface InventoryState {
    equipment: EquipmentSlots;
    items: Item[];
}

interface InventoryFloatingPanelProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: InventoryState;
    onEquipItem: (item: Item, slot: keyof EquipmentSlots) => void;
    onUseItem: (item: Item) => void;
}

const InventoryFloatingPanel: React.FC<InventoryFloatingPanelProps> = ({
    isOpen,
    onClose,
    inventory,
    onEquipItem,
    onUseItem
}) => {
    if (!isOpen) return null;

    const slotNameMap: Record<keyof EquipmentSlots, string> = {
        head: '头部',
        body: '上身',
        legs: '下身',
        hands: '手部',
        feet: '脚部',
        back: '背部',
        leftHand: '左手',
        rightHand: '右手'
    };

    const handleItemClick = (item: Item) => {
        if (item.usable) {
            onUseItem(item);
        } else if (item.equippable && item.slots && item.slots.length > 0) {
            onEquipItem(item, item.slots[0] as keyof EquipmentSlots);
        }
    };

    return (
        <div className={styles.inventoryFloatingPanel}>
            <div className={styles.inventoryPanelHeader}>
                <h3>背包</h3>
                <button className={styles.closeInventoryBtn} onClick={onClose}>×</button>
            </div>
            <div className={styles.inventoryPanelContent}>
                <div className={styles.equipmentSection}>
                    <h3>装备</h3>
                    <div className={styles.equipmentGrid}>
                        {(Object.keys(inventory.equipment) as Array<keyof EquipmentSlots>).map((slot) => {
                            const eq = inventory.equipment[slot];
                            return (
                                <div key={slot} className={styles.equipmentSlot} data-slot={slot}>
                                    <img 
                                        src={eq?.icon || '/data/icons/empty.png'} 
                                        alt={slotNameMap[slot]} 
                                    />
                                    <span>{eq?.name || slotNameMap[slot]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className={styles.itemsSection}>
                    <h3>物品</h3>
                    <div className={styles.itemsGrid}>
                        {inventory.items.length === 0 && (
                            <p className={styles.emptyMessage}>背包为空</p>
                        )}
                        {inventory.items.map((item) => (
                            <div 
                                key={item.id} 
                                className={styles.itemSlot}
                                onClick={() => handleItemClick(item)}
                                style={{ cursor: (item.usable || item.equippable) ? 'pointer' : 'default' }}
                            >
                                <img 
                                    src={item.icon || '/data/icons/empty.png'} 
                                    alt={item.name || item.id} 
                                />
                                <div className={styles.itemName}>{item.name || item.id}</div>
                                {item.quantity > 1 && (
                                    <div className={styles.itemQuantity}>x{item.quantity}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryFloatingPanel;
