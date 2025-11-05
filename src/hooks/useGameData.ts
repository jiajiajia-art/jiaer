import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { HOST_ADDRESS } from '../config';

// 类型定义
export interface PlayerProfile {
    avatar: string;
    name: string;
    age: number;
    gender: string;
    job: string;
}

export interface PlayerStats {
    level: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    speed: number;
}

export interface PlayerState {
    profile: PlayerProfile;
    stats: PlayerStats;
    experience: { current: number; required: number };
    currency: { gold: number };
}

export interface Item {
    id: string;
    name?: string;
    icon?: string;
    quantity: number;
    stackable?: boolean;
    equippable?: boolean;
    usable?: boolean;
    slots?: string[];
    effects?: Partial<PlayerStats>;
}

export interface EquipmentSlots {
    head: Item | null;
    body: Item | null;
    legs: Item | null;
    hands: Item | null;
    feet: Item | null;
    back: Item | null;
    leftHand: Item | null;
    rightHand: Item | null;
}

export interface InventoryState {
    equipment: EquipmentSlots;
    items: Item[];
}

export interface SceneNode {
    id: string;
    name: string;
    description?: string;
    background?: string;
    buildings: any[];
    npcs: any[];
    events?: string[];
    exits: Record<string, string>;
}

export type ScenesMap = Record<string, SceneNode>;

export const useGameData = () => {
    // 从 Zustand store 读取和更新数据
    const player = useGameStore((state) => state.player);
    const setPlayer = useGameStore((state) => state.setPlayer);
    const updatePlayer = useGameStore((state) => state.updatePlayer);
    const inventory = useGameStore((state) => state.inventory);
    const setInventory = useGameStore((state) => state.setInventory);
    const scenes = useGameStore((state) => state.scenes);
    const setScenes = useGameStore((state) => state.setScenes);
    const currentSceneId = useGameStore((state) => state.currentSceneId);
    const setCurrentSceneId = useGameStore((state) => state.setCurrentSceneId);
    
    // 这些数据保留在 hook 中（局部使用，不频繁变化）
    const [backendDataLoaded, setBackendDataLoaded] = useState(false);
    const [backendLore, setBackendLore] = useState<any>(null);
    const [backendEvents, setBackendEvents] = useState<Record<string, any>>({});
    const [worldMapImageUrl, setWorldMapImageUrl] = useState<string | null>(null);
    const {sessionId} = useGameStore();
    const pdfFileId = useGameStore((s) => s.pdfFileId);

    // 应用后端数据到各个状态
    const applyBackendData = useCallback((root: any) => {
        try {
            if (!root) return;

            // 1) 场景
            if (root.scenes && typeof root.scenes === 'object') {
                const backendScenes: ScenesMap = root.scenes as ScenesMap;
                setScenes(backendScenes);
                let preferred = '';
                if (backendScenes['village_home']) preferred = 'village_home';
                else if (backendScenes['village_common']) preferred = 'village_common';
                else preferred = Object.keys(backendScenes)[0] || '';
                if (preferred) setCurrentSceneId(preferred);
            }

            // 2) 世界观数据（从 lore 字段）
            if (root.lore && typeof root.lore === 'object') {
                setBackendLore(root.lore);
            }

            // 3) 关键事件数据（从 lore.keyEvents 字段）
            // if (root.lore?.keyEvents && Array.isArray(root.lore.keyEvents)) {
            //     const convertedEvents: Record<string, any> = {};
            //     root.lore.keyEvents.forEach((event: any, index: number) => {
            //         const eventId = `key_event_${index}`;
            //         convertedEvents[eventId] = {
            //             id: eventId,
            //             title: event.title,
            //             image: '/data/events/historical.jpg',
            //             description: `${event.year}\n\n${event.description}`,
            //             options: [
            //                 { text: '了解详情', effects: { experience: 5 }, nextEvent: null },
            //                 { text: '继续观察', effects: { experience: 2 }, nextEvent: null },
            //                 { text: '暂时忽略', effects: {} },
            //             ],
            //         };
            //     })
            // }

            // 4) 物品定义映射
            const itemDefs: Record<string, any> = (root.items && typeof root.items === 'object') ? root.items : {};
            const mapItem = (id: string | null | undefined): any => {
                if (!id) return null;
                const def = itemDefs[id];
                if (!def) return null;
                return {
                    id: def.id || id,
                    name: def.name,
                    icon: def.icon,
                    equippable: !!def.equippable,
                    usable: !!def.usable,
                    slots: def.slots,
                    effects: def.stats || def.effects,
                    quantity: 1,
                };
            };

            // 5) 玩家
            if (root.player && typeof root.player === 'object') {
                const p = root.player;
                // 装备槽：字符串 ID -> Item 对象
                const eqSrc = (p.inventory && p.inventory.equipment) ? p.inventory.equipment : {};
                const equipment = {
                    head: mapItem(eqSrc.head),
                    body: mapItem(eqSrc.body),
                    legs: mapItem(eqSrc.legs),
                    hands: mapItem(eqSrc.hands),
                    feet: mapItem(eqSrc.feet),
                    back: mapItem(eqSrc.back),
                    leftHand: mapItem(eqSrc.leftHand),
                    rightHand: mapItem(eqSrc.rightHand),
                } as EquipmentSlots;

                // 背包物品
                const itemsArr = Array.isArray(p.inventory?.items) ? p.inventory.items : [];
                const mappedItems = itemsArr.map((it: any) => ({
                    id: it.id,
                    name: it.name,
                    icon: it.icon,
                    quantity: it.quantity ?? 1,
                    equippable: !!it.equippable,
                    usable: !!it.usable,
                    slots: it.slots,
                    effects: it.effects,
                }));

                setInventory({ equipment, items: mappedItems });
                setPlayer({
                    profile: {
                        avatar: p.profile?.avatar || '/data/avatars/default.png',
                        name: p.profile?.name || '未命名',
                        age: p.profile?.age ?? 18,
                        gender: p.profile?.gender || '男',
                        job: p.profile?.job || '冒险者',
                    },
                    stats: {
                        level: p.stats?.level ?? 1,
                        health: p.stats?.health ?? 100,
                        maxHealth: p.stats?.maxHealth ?? 100,
                        attack: p.stats?.attack ?? 10,
                        defense: p.stats?.defense ?? 5,
                        speed: p.stats?.speed ?? 8,
                    },
                    experience: {
                        current: p.experience?.current ?? 0,
                        required: p.experience?.required ?? 100,
                    },
                    currency: {
                        gold: p.currency?.gold ?? 0,
                    },
                });
            }
        } catch (err) {
            console.error('应用后端数据失败:', err);
            throw err;
        }
    }, [setScenes, setCurrentSceneId, setBackendLore, setBackendEvents, setInventory, setPlayer]);

    // 提取图片URL的工具函数
    const extractImageUrl = useCallback(async (response: Response): Promise<string | null> => {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return data.url || data.imageUrl || data.image || response.url;
        }
        return response.url;
    }, []);

    // 加载后端数据
    useEffect(() => {
        if (backendDataLoaded || !sessionId || !pdfFileId) return;

        (async () => {
            try {
                const [filesResponse, avatarResponse, worldMapResponse] = await Promise.all([
                    fetch(`${HOST_ADDRESS}/api/backend/files/${sessionId}`),
                    fetch(`${HOST_ADDRESS}/api/backend/images/${pdfFileId}/player`),
                    fetch(`${HOST_ADDRESS}/api/backend/images/${pdfFileId}/world`)
                ]);

                // 处理游戏数据
                if (filesResponse.ok) {
                    const contentType = filesResponse.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const data = await filesResponse.json();
                        if (data?.success && data.files) {
                            applyBackendData(data.files);
                            setBackendDataLoaded(true);
                        }
                    }
                }

                // 处理玩家头像
                if (avatarResponse.ok) {
                    const avatarUrl = await extractImageUrl(avatarResponse);
                    if (avatarUrl) {
                        updatePlayer((prevPlayer) => {
                            if (!prevPlayer) return null;
                            return {
                                ...prevPlayer,
                                profile: {
                                    ...prevPlayer.profile,
                                    avatar: avatarUrl
                                }
                            };
                        });
                    }
                }

                // 处理世界地图
                if (worldMapResponse.ok) {
                    const worldMapUrl = await extractImageUrl(worldMapResponse);
                    if (worldMapUrl) {
                        setWorldMapImageUrl(worldMapUrl);
                    }
                }
            } catch (e) {
                console.error('后端数据加载失败:', e);
            }
        })();
    }, [sessionId, pdfFileId, backendDataLoaded, applyBackendData, updatePlayer, extractImageUrl]);

    const getNewScene = useCallback(async () => {
        if (!sessionId) return;
        
        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/files/${sessionId}/scenes`);
            if (!response.ok) return;
            
            const dataJson = await response.json();
            let newScenes: ScenesMap | null = null;
            
            // 根据后端返回的数据结构解析场景
            if (dataJson.data && typeof dataJson.data === 'object') {
                newScenes = dataJson.data;
            } else if (dataJson.scenes && typeof dataJson.scenes === 'object') {
                newScenes = dataJson.scenes;
            } else if (typeof dataJson === 'object' && !Array.isArray(dataJson)) {
                newScenes = dataJson;
            }
            
            if (newScenes) {
                // store 的 setScenes 会自动处理深拷贝
                setScenes(newScenes);
            }
        } catch (e) {
            console.error('获取新场景数据失败:', e);
        }
    }, [sessionId, setScenes]);

    return {
        player,
        setPlayer,
        updatePlayer,
        inventory,
        setInventory,
        scenes,
        setScenes,
        currentSceneId,
        setCurrentSceneId,
        backendDataLoaded,
        backendLore,
        backendEvents,
        worldMapImageUrl,
        getNewScene
    };
};
