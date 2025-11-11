import { useState } from 'react';
import type { Inventory, InventoryItem } from '../api/game/gameData';
import { useGameStore } from '../store/gameStore';

// EquipmentSlots 类型定义（后端数据结构：equipment 存储的是物品ID字符串）
type EquipmentSlots = {
    head: string | null;
    body: string | null;
    legs: string | null;
    hands: string | null;
    feet: string | null;
    back: string | null;
    leftHand: string | null;
    rightHand: string | null;
};

export const useInventory = () => {
    const [inventoryOpen, setInventoryOpen] = useState(false);
    
    // 从 store 获取数据和方法
    const player = useGameStore((state) => state.player);
    const inventory = useGameStore((state) => state.inventory);
    const updateInventory = useGameStore((state) => state.updateInventory);
    const setPlayer = useGameStore((state) => state.setPlayer);

    // 装备物品（后端数据结构：equipment 存储物品ID字符串）
    const equipItem = (
        item: InventoryItem, 
        slot: keyof EquipmentSlots
    ) => {
        if (!inventory) return;
        
        const items = useGameStore.getState().items;
        
        updateInventory((prev) => {
            if (!prev) return prev;
            
            const next: Inventory = { 
                ...prev, 
                equipment: { ...prev.equipment }, 
                items: prev.items.map((i) => ({ ...i }))
            };
            
            // 卸下当前装备（如果存在），放回背包
            const currentEquippedId = next.equipment[slot];
            if (currentEquippedId) {
                const existItem = next.items.find((i) => i.id === currentEquippedId);
                if (existItem) {
                    existItem.quantity += 1;
                } else {
                    // 从物品定义中获取完整信息
                    const itemDef = items[currentEquippedId];
                    if (itemDef) {
                        next.items.push({
                            id: itemDef.id,
                            name: itemDef.name,
                            description: itemDef.description,
                            icon: itemDef.icon,
                            type: itemDef.type,
                            usable: itemDef.usable || false,
                            stackable: itemDef.stackable,
                            effects: itemDef.effects || {},
                            quantity: 1
                        } as InventoryItem);
                    }
                }
            }
            
            // 减少要装备的物品数量
            const bagItem = next.items.find((i) => i.id === item.id);
            if (bagItem) {
                bagItem.quantity = Math.max(0, bagItem.quantity - 1);
                if (bagItem.quantity === 0) {
                    next.items = next.items.filter((i) => i.id !== item.id);
                }
            }
            
            // 装备新物品（存储物品ID）
            next.equipment[slot] = item.id;
            return next;
        });
    };

    // 使用物品
    const useItem = (item: InventoryItem) => {
        if (!item.usable || !player || !inventory) return;
        
        // 应用物品效果到玩家
        if (item.effects && player.stats) {
            const next = { ...player };
            const effects = item.effects;
            if (next.stats) {
                // 处理各种效果属性
                if (effects.health !== undefined) {
                    next.stats.health = Math.min(
                        next.stats.maxHealth || 100,
                        Math.max(0, next.stats.health + effects.health)
                    );
                }
                if (effects.attack !== undefined) {
                    next.stats.attack = (next.stats.attack || 0) + effects.attack;
                }
                if (effects.defense !== undefined) {
                    next.stats.defense = (next.stats.defense || 0) + effects.defense;
                }
                if (effects.speed !== undefined) {
                    next.stats.speed = (next.stats.speed || 0) + effects.speed;
                }
                // 可以继续添加其他效果属性
            }
            setPlayer(next);
        }
        
        // 减少物品数量
        updateInventory((prev) => {
            if (!prev) return prev;
            
            const next: Inventory = { 
                ...prev, 
                items: prev.items.map((i) => ({ ...i })) 
            };
            const bagItem = next.items.find((i) => i.id === item.id);
            if (bagItem) {
                bagItem.quantity = Math.max(0, bagItem.quantity - 1);
                if (bagItem.quantity === 0) {
                    next.items = next.items.filter((i) => i.id !== item.id);
                }
            }
            return next;
        });
    };

    return {
        inventoryOpen,
        setInventoryOpen,
        equipItem,
        useItem
    };
};
