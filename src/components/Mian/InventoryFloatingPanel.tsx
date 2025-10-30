import React from 'react';
import styles from './InventoryFloatingPanel.module.css';
import { HOST_ADDRESS } from '../../config';

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
    console.log('inventory', inventory);
    console.log('onEquipItem', onEquipItem);
    console.log('onUseItem', onUseItem);

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
                <div className={styles.itemsList}>
                    {inventory.items.length === 0 && (
                        <p className={styles.emptyMessage}>背包为空</p>
                    )}
                    {inventory.items.map((item) => (
                        <div
                            key={item.id}
                            className={styles.itemRow}
                        >
                            <img
                                src={'/data/icons/berries.png'}
                                alt={item.name || item.id}
                                className={styles.itemImage}
                            />
                            <div className={styles.itemInfo}>
                                <div className={styles.itemName}>
                                    {item.name || item.id}
                                    {item.quantity > 1 && `     x${item.quantity}`}
                                </div>
                                <div className={styles.itemDescription}>
                                    {item.effects?.description || '暂无描述'}
                                </div>
                            </div>
                            <div className={styles.itemActions}>
                                {(item.usable || item.equippable) && (
                                    <button
                                        className={styles.useButton}
                                        onClick={() => handleItemClick(item)}
                                    >
                                        {item.usable ? '使用' : '装备'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InventoryFloatingPanel;

