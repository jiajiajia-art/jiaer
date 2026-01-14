import React, { useState, useEffect } from 'react';
import styles from './Inventory.module.css';
import { IoClose } from 'react-icons/io5';
import { objectsData } from '../../../api/worldInteraction/objectsData';
import { useGameStore } from '../../../store/gameStore';

interface Item {
    item_id: string;
    quantity: number;
    slot: number;
}

interface InventoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ isOpen, onClose }) => {
    const [inventoryData, setInventoryData] = useState<Item[]>([]);
    const { sessionId } = useGameStore();

    const fetchInventoryData = async () => {
        if(!sessionId) return;
        try {
            const response = await objectsData.getObjectsBySessionId(sessionId);
            // Properly access response.data and check its structure
            if (response.data && response.data.success) {
                setInventoryData(response.data.inventory.items || []);
            } else {
                console.error('Invalid response format:', response);
                setInventoryData([]);
            }
        } catch (e) {
            console.error('Failed to fetch inventory:', e);
            setInventoryData([]);
        }
    };

    // 当弹窗打开时获取数据
    useEffect(() => {
        if (isOpen && sessionId) {
            fetchInventoryData();
        }
    }, [isOpen, sessionId]);

    const handleModalClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const totalSlots = 20;
    const gridItems = new Array(totalSlots).fill(null);
    
    // 根据 slot 属性将道具放到正确的位置
    inventoryData.forEach((item) => {
        // slot 是从 0 开始的索引
        if (item.slot >= 0 && item.slot < totalSlots) {
            gridItems[item.slot] = item;
        }
    });

    if (!isOpen) return null;
    
    return (
        <div className={styles.overlay} onClick={onClose}>
        <div className={styles.panelWrapper}>
            <div className={styles.panel} onClick={handleModalClick}>
            <button className={styles.closeButton} onClick={onClose}>
                <IoClose />
            </button>
            
            <div className={styles.content}>
                <div className={styles.title}>背包</div>
                
                <div className={styles.inventoryGrid}>
                {gridItems.map((item, index) => (
                    <div key={item ? item.item_id : `empty-${index}`} className={styles.inventorySlot}>
                    {item ? (
                        <div className={styles.itemImageContainer}>
                        <div className={styles.itemImagePlaceholder}>
                            <span className={styles.itemName}>
                                {/* 显示道具名称的第一个字符 */}
                                {item.item_id ? item.item_id.charAt(0).toUpperCase() : '?'}
                            </span>
                        </div>
                        <div className={styles.itemCount}>{item.quantity}</div>
                        </div>
                    ) : (
                        <div className={styles.emptySlot}></div>
                    )}
                    </div>
                ))}
                </div>
                
                <div className={styles.inventoryFooter}>
                <div>共 {inventoryData.length} 个道具</div>
                </div>
            </div>
            </div>
        </div>
        </div>
    );
};

export default Inventory;