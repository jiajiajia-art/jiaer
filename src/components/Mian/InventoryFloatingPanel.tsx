import React from 'react';
import styles from './InventoryFloatingPanel.module.css';
import type { Inventory, InventoryItem } from '../../api/game/gameData.type';
import { useGameStore } from '../../store/gameStore';

interface EquipmentSlots {
    head: string | null;
    body: string | null;
    legs: string | null;
    hands: string | null;
    feet: string | null;
    back: string | null;
    leftHand: string | null;
    rightHand: string | null;
}

interface InventoryFloatingPanelProps {
    isOpen: boolean;
    onClose?: () => void;
    inventory: Inventory | null;
    onEquipItem: (item: InventoryItem, slot: keyof EquipmentSlots) => void;
    onUseItem: (item: InventoryItem) => void;
}

const InventoryFloatingPanel: React.FC<InventoryFloatingPanelProps> = ({
    isOpen,
    onClose,
    inventory,
    onEquipItem,
    onUseItem
}) => {
    const items = useGameStore((state) => state.items); // 获取物品定义
    
    if (!isOpen || !inventory) return null;

    const handleItemClick = (item: InventoryItem) => {
        if (item.usable) {
            onUseItem(item);
        } else {
            // 从物品定义中获取装备信息
            const itemDef = items[item.id];
            if (itemDef?.equippable && itemDef.slots && itemDef.slots.length > 0) {
                // 使用物品定义中的第一个槽位
                const slot = itemDef.slots[0] as keyof EquipmentSlots;
                onEquipItem(item, slot);
            } else if (item.type) {
                // 如果没有物品定义，尝试从类型推断
                const slotMap: Record<string, keyof EquipmentSlots> = {
                    'head': 'head',
                    'body': 'body',
                    'legs': 'legs',
                    'hands': 'hands',
                    'feet': 'feet',
                    'back': 'back',
                    'weapon': 'rightHand',
                    'shield': 'leftHand'
                };
                const slot = item.type.split('_').find(t => slotMap[t])
                    ? slotMap[item.type.split('_').find(t => slotMap[t])!]
                    : 'head';
                onEquipItem(item, slot);
            }
        }
    };

    return (
        <div className={styles.inventoryFloatingPanel}>
            <div className={styles.inventoryPanelHeader}>
                <h3>背包</h3>
                {onClose && (
                    <button className={styles.closeInventoryBtn} onClick={onClose}>×</button>
                )}
            </div>
            <div className={styles.inventoryPanelContent}>
                <div className={styles.itemsList}>
                    {(!inventory.items || inventory.items.length === 0) && (
                        <p className={styles.emptyMessage}>背包为空</p>
                    )}
                    {inventory.items?.map((item) => (
                        <div
                            key={item.id}
                            className={styles.itemRow}
                        >
                            {/* <img
                                src={`${import.meta.env.BASE_URL}data/icons/berries.png`}
                                alt={item.name || item.id}
                                className={styles.itemImage}
                            /> */}
                            <div className={styles.itemInfo}>
                                <div className={styles.itemName}>
                                    {item.name || item.id}
                                    {item.quantity > 1 && ` x${item.quantity}`}
                                </div>
                                <div className={styles.itemDescription}>
                                    {item.description || '暂无描述'}
                                </div>
                            </div>
                            <div className={styles.itemActions}>
                                {(item.usable || items[item.id]?.equippable) && (
                                    <button
                                        className={styles.useButton}
                                        onClick={() => handleItemClick(item)}
                                    >
                                        {item.usable ? '使\n用' : '装\n备'}
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

