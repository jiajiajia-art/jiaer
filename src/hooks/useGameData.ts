import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import gameDataApi from '../api/game/gameData.type';
import type { ScenesMap, Scene, PlayerData, Inventory, GameItem } from '../api/game/gameData';
import MissionApi from '../api/game/missionApi';

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
    const setItems = useGameStore((state) => state.setItems);
    const setMissionData = useGameStore((state) => state.setMissionData);

    // 这些数据保留在 hook 中（局部使用，不频繁变化）
    const [backendDataLoaded, setBackendDataLoaded] = useState(false);
    const [backendLore, setBackendLore] = useState<any>(null);
    const [backendEvents, setBackendEvents] = useState<Record<string, any>>({});
    const [worldMapImageUrl, setWorldMapImageUrl] = useState<string | null>(null);
    const {sessionId} = useGameStore();
    const pdfFileId = useGameStore((s) => s.pdfFileId);

    // 应用后端数据到各个状态（直接使用后端数据结构，不做映射）
    const applyBackendData = useCallback((root: any) => {
        try {
            if (!root) return;

            if (root.scenes && typeof root.scenes === 'object') {
                const backendScenes: ScenesMap = root.scenes as ScenesMap;
                setScenes(backendScenes);
                let preferred = '';
                if (backendScenes['village_home']) preferred = 'village_home';
                else if (backendScenes['village_common']) preferred = 'village_common';
                else preferred = Object.keys(backendScenes)[0] || '';
                if (preferred) setCurrentSceneId(preferred);
            }

            if (root.lore && typeof root.lore === 'object') {
                setBackendLore(root.lore);
            }

            if (root.player && typeof root.player === 'object') {
                setPlayer(root.player as PlayerData);
            }

            if (root.player?.inventory) {
                setInventory(root.player.inventory as Inventory);
            } else if (root.inventory) {
                setInventory(root.inventory as Inventory);
            }

            if (root.items && typeof root.items === 'object') {
                setItems(root.items as Record<string, GameItem>);
            }
        } catch (err) {
            console.error('应用后端数据失败:', err);
            throw err;
        }
    }, [setScenes, setCurrentSceneId, setBackendLore, setBackendEvents, setInventory, setPlayer, setItems]);

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
            const results = await Promise.allSettled([
                gameDataApi.getGameFiles(sessionId),
                gameDataApi.getPlayerAvatar(pdfFileId),
                gameDataApi.getWorldMap(pdfFileId),
            ]);

            const [filesResult, avatarResult, worldResult] = results;
            console.log(filesResult);

            if (filesResult.status === 'fulfilled') {
                const responseData = filesResult.value.data;
                if (responseData?.success && responseData.files) {
                    applyBackendData(responseData.files);
                } else {
                    console.warn('⚠️ 游戏数据响应格式异常:', responseData);
                }
            } else {
                console.error('获取剧情文件失败:', filesResult.reason);
            }
            setBackendDataLoaded(true);

            if (avatarResult.status === 'fulfilled') {
                try {
                    const avatarUrl = await extractImageUrl(avatarResult.value.data || avatarResult.value);
                    if (avatarUrl) {
                        updatePlayer((prevPlayer) => {
                            if (!prevPlayer) return null;
                            return {
                                ...prevPlayer,
                                profile: {
                                    ...prevPlayer.profile,
                                    avatar: avatarUrl,
                                },
                            };
                        });
                    }
                } catch (err) {
                    console.warn('解析玩家头像失败，使用默认头像', err);
                }
            } else {
                console.warn('获取玩家头像失败，使用默认头像', avatarResult.reason);
            }

            if (worldResult.status === 'fulfilled') {
                try {
                    const worldMapUrl = await extractImageUrl(worldResult.value.data || worldResult.value);
                    if (worldMapUrl) {
                        setWorldMapImageUrl(worldMapUrl);
                    }
                } catch (err) {
                    console.warn('解析世界地图失败，使用默认地图', err);
                }
            } else {
                console.warn('获取世界地图失败，使用默认地图', worldResult.reason);
            }
        })();
    }, [sessionId, pdfFileId, backendDataLoaded, applyBackendData, updatePlayer, extractImageUrl]);

    // 通用的文件获取方法
    const getGameFile = useCallback(async (fileType: 'scenes' | 'player'| 'items' | 'lore') => {
        if (!sessionId) return;
        
        try {
            const response = await gameDataApi.getSingleFile(sessionId, fileType);
            // 使用 any 类型来处理不同文件类型的响应
            const responseData = (response.data?.data as any);
            console.log(responseData);
            
            if (!responseData) {
                console.warn(`获取${fileType}数据失败: 响应数据为空`);
                return;
            }
            
            // 根据文件类型进行不同的数据处理和赋值
            switch (fileType) {
                case 'scenes': {
                    setScenes(responseData);
                    break;
                }
                case 'player': {
                    setPlayer(responseData);
                    setInventory(responseData.inventory);
                    break;
                }
                case 'items': {
                    setItems(responseData);
                    break;
                }
                case 'lore': {
                    setBackendLore(responseData);
                    break;
                }
                
                default:
                    console.warn(`未知的文件类型: ${fileType}`);
            }
        } catch (e) {
            console.error(`获取${fileType}数据失败:`, e);
        }
    }, [sessionId, setScenes, setPlayer, setInventory, setItems, setBackendLore]);

    // 获取新场景（保持向后兼容）
    const getNewScene = useCallback(async () => {
        return await getGameFile('scenes');
    }, [getGameFile]);

    // 获取新玩家数据
    const getNewPlayer = useCallback(async () => {
        await getGameFile('player');
        
        // 重新获取用户头像并更新
        if (pdfFileId) {
            try {
                const avatarResponse = await gameDataApi.getPlayerAvatar(pdfFileId);
                const avatarUrl = await extractImageUrl(avatarResponse.data || avatarResponse);
                if (avatarUrl) {
                    updatePlayer((prevPlayer) => {
                        if (!prevPlayer) return null;
                        return {
                            ...prevPlayer,
                            profile: {
                                ...prevPlayer.profile,
                                avatar: avatarUrl,
                            },
                        };
                    });
                }
            } catch (err) {
                console.warn('获取玩家头像失败，使用默认头像', err);
            }
        }
    }, [getGameFile, pdfFileId, extractImageUrl, updatePlayer]);

    const loadMissions = useCallback(async () => {
        console.log("loadMissions正在开发");
        
        if (!sessionId) {
            return;
        }

        try {
            const response = await MissionApi.getMissions(sessionId);
            if (response.data.success && response.data.data) {
                setMissionData(response.data.data);
                console.log(response.data.data);
            }
        } catch (error) {
            console.error('获取任务列表失败:', error);
        }
    }, [sessionId]);

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
        getGameFile,
        getNewScene,
        getNewPlayer,
        loadMissions
    };
};
