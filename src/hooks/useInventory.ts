import { useState } from 'react';
import type { Item, EquipmentSlots, InventoryState, PlayerState } from './useGameData';
import { useGameStore } from '../store/gameStore';

export const useInventory = () => {
    const [inventoryOpen, setInventoryOpen] = useState(false);
    
    // 从 store 获取数据和方法
    const player = useGameStore((state) => state.player);
    const updateInventory = useGameStore((state) => state.updateInventory);
    const setPlayer = useGameStore((state) => state.setPlayer);

    // 装备物品
    const equipItem = (
        item: Item, 
        slot: keyof EquipmentSlots
    ) => {
        updateInventory((prev) => {
            const next: InventoryState = { 
                ...prev, 
                equipment: { ...prev.equipment }, 
                items: prev.items.map((i) => ({ ...i }))
            };
            // 卸下当前装备，放回背包
            const current = next.equipment[slot];
            if (current) {
                const exist = next.items.find((i) => i.id === current.id);
                if (exist) exist.quantity += 1; else next.items.push({ ...current, quantity: 1 });
            }
            // 减少物品堆叠
            const bag = next.items.find((i) => i.id === item.id);
            if (bag) {
                bag.quantity = Math.max(0, bag.quantity - 1);
                if (bag.quantity === 0) next.items = next.items.filter((i) => i.id !== item.id);
            }
            next.equipment[slot] = { ...item, quantity: 1 };
            return next;
        });
    };

    // 使用物品
    const useItem = (item: Item) => {
        if (!item.usable) return;
        if (item.effects && player) {
            const next = { ...player };
            const patch = item.effects as Partial<PlayerState['stats']>;
            next.stats = { ...next.stats, ...patch } as PlayerState['stats'];
            if (patch.health) next.stats.health = Math.min(next.stats.maxHealth, next.stats.health);
            setPlayer(next);
        }
        updateInventory((prev) => {
            const next: InventoryState = { 
                ...prev, 
                items: prev.items.map((i) => ({ ...i })) 
            };
            const bag = next.items.find((i) => i.id === item.id);
            if (bag) {
                bag.quantity = Math.max(0, bag.quantity - 1);
                if (bag.quantity === 0) next.items = next.items.filter((i) => i.id !== item.id);
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
