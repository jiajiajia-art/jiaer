import { useState } from 'react';
import type { Item, EquipmentSlots, InventoryState, PlayerState } from './useGameData';
import type { Dispatch, SetStateAction } from 'react';

export const useInventory = () => {
    const [inventoryOpen, setInventoryOpen] = useState(false);

    // 装备物品
    const equipItem = (
        item: Item, 
        slot: keyof EquipmentSlots, 
        setInventory: Dispatch<SetStateAction<InventoryState>>
    ) => {
        setInventory((prev) => {
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
    const useItem = (
        item: Item, 
        player: PlayerState | null, 
        setPlayer: (player: PlayerState | null) => void,
        setInventory: Dispatch<SetStateAction<InventoryState>>
    ) => {
        if (!item.usable) return;
        if (item.effects && player) {
            const next = { ...player };
            const patch = item.effects as Partial<PlayerState['stats']>;
            next.stats = { ...next.stats, ...patch } as PlayerState['stats'];
            if (patch.health) next.stats.health = Math.min(next.stats.maxHealth, next.stats.health);
            setPlayer(next);
        }
        setInventory((prev) => {
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
