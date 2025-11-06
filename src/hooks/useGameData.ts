import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import gameDataApi from '../api/game/gameData.type';
import type { ScenesMap, Scene } from '../api/game/gameData';
import type { EquipmentSlots } from '../store/gameStore';

// 重新导出前端特有的类型（从 gameStore 导入，避免重复定义）
export type {
    PlayerState,
    Item,
    InventoryState,
    PlayerProfile,
    PlayerStats
} from '../store/gameStore';

// SceneNode 类型别名，兼容旧代码
export type SceneNode = Scene;

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
    const extractImageUrl = useCallback(async (response: any): Promise<string | null> => {
        // 如果响应是 Blob，创建对象 URL
        if (response instanceof Blob) {
            return URL.createObjectURL(response);
        }
        
        // 如果响应是 JSON
        if (response?.data) {
            const data = response.data;
            if (typeof data === 'string') {
                return data;
            }
            if (data?.url || data?.imageUrl || data?.image) {
                return data.url || data.imageUrl || data.image;
            }
        }
        
        // 如果是普通对象
        if (response?.url || response?.imageUrl || response?.image) {
            return response.url || response.imageUrl || response.image;
        }
        
        return null;
    }, []);

    // 加载后端数据
    useEffect(() => {
        if (backendDataLoaded || !sessionId || !pdfFileId) return;

        (async () => {
            try {
                const [filesResponse, avatarResponse, worldMapResponse] = await Promise.all([
                    gameDataApi.getGameFiles(sessionId),
                    gameDataApi.getPlayerAvatar(pdfFileId),
                    gameDataApi.getWorldMap(pdfFileId)
                ]);

                const responseData = filesResponse.data;
                
                if (responseData?.success && responseData.files) {
                    applyBackendData(responseData.files);
                    setBackendDataLoaded(true);
                } else {
                    console.warn('⚠️ 游戏数据响应格式异常:', responseData);
                }

                const avatarUrl = await extractImageUrl(avatarResponse.data || avatarResponse);
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

                const worldMapUrl = await extractImageUrl(worldMapResponse.data || worldMapResponse);
                if (worldMapUrl) {
                    setWorldMapImageUrl(worldMapUrl);
                }
            } catch (e) {
                console.error('后端数据加载失败:', e);
            }
        })();
    }, [sessionId, pdfFileId, backendDataLoaded, applyBackendData, updatePlayer, extractImageUrl]);

    const getNewScene = useCallback(async () => {
        if (!sessionId) return;
        
        try {
            const response = await gameDataApi.getScenes(sessionId);
            // 解构响应数据
            const responseData = response.data?.data;
            let newScenes: ScenesMap | null = null;
            
            // 根据后端返回的数据结构解析场景
            if (responseData) {
                if (responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
                    newScenes = responseData.data as ScenesMap;
                } else if (responseData.scenes && typeof responseData.scenes === 'object' && !Array.isArray(responseData.scenes)) {
                    newScenes = responseData.scenes as ScenesMap;
                } else if (typeof responseData === 'object' && !Array.isArray(responseData)) {
                    // 检查是否是 ScenesMap 格式（Record<string, SceneNode>）
                    const keys = Object.keys(responseData);
                    if (keys.length > 0 && (responseData as any)[keys[0]]?.id) {
                        newScenes = responseData as unknown as ScenesMap;
                    }
                }
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
