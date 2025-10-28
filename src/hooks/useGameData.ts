import { useState, useEffect } from 'react';
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
    const [player, setPlayer] = useState<PlayerState | null>(null);
    const [inventory, setInventory] = useState<InventoryState>({
        equipment: { head: null, body: null, legs: null, hands: null, feet: null, back: null, leftHand: null, rightHand: null },
        items: [],
    });
    const [scenes, setScenes] = useState<ScenesMap>({});
    const [currentSceneId, setCurrentSceneId] = useState<string>('');
    const [backendDataLoaded, setBackendDataLoaded] = useState(false);
    const [backendLore, setBackendLore] = useState<any>(null);
    const [backendEvents, setBackendEvents] = useState<Record<string, any>>({});
    
    const pdfFileId = useGameStore((s) => s.pdfFileId);

    // 应用后端数据到各个状态
    const applyBackendData = (root: any) => {
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
                console.log('✅ 后端提供了世界观数据:', root.lore);
                setBackendLore(root.lore);
            } else {
                console.log('⚠️ 后端未提供世界观数据，将使用本地数据');
            }

            // 3) 关键事件数据（从 lore.keyEvents 字段）
            if (root.lore && root.lore.keyEvents && Array.isArray(root.lore.keyEvents)) {
                console.log('✅ 后端提供了关键事件数据:', root.lore.keyEvents);
                const convertedEvents: Record<string, any> = {};
                root.lore.keyEvents.forEach((event: any, index: number) => {
                    const eventId = `key_event_${index}`;
                    convertedEvents[eventId] = {
                        id: eventId,
                        title: event.title,
                        image: '/data/events/historical.jpg',
                        description: `${event.year}\n\n${event.description}`,
                        options: [
                            { text: '了解详情', effects: { experience: 5 }, nextEvent: null },
                            { text: '继续观察', effects: { experience: 2 }, nextEvent: null },
                            { text: '暂时忽略', effects: {} },
                        ],
                    };
                });
                // 添加欢迎事件
                convertedEvents['welcome_event'] = {
                    id: 'welcome_event',
                    title: '明末人生模拟器',
                    image: '/data/events/welcome.jpg',
                    description: '天启七年正月十五（1627年2月），你叫陈石，是北直隶顺天府郊外一个佃农之子。时值寒冬，村中炊烟稀落，土地贫瘠，官道上有流民缓缓南迁。朝廷阉党专权，边关烽火不断，山海关外后金铁骑虎视眈眈。\n\n作为家中长子，你深知生活不易。父亲偶尔讲述的军旅故事，在你心中埋下了对外面世界既恐惧又好奇的种子。\n\n在这个动荡的时代，你将如何选择自己的人生道路？',
                    options: [
                        { text: '我要改变命运！', effects: { experience: 10 }, nextEvent: null },
                        { text: '先了解当前局势', effects: { experience: 5 }, nextEvent: null },
                        { text: '我需要更多准备', effects: {}, nextEvent: null },
                    ],
                };
                setBackendEvents(convertedEvents);
                console.log('🔄 已转换关键事件为游戏事件:', Object.keys(convertedEvents));
            } else {
                console.log('⚠️ 后端未提供关键事件数据，将使用本地事件数据');
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
        }
    };

    // 加载本地 JSON 文件作为后备
    const loadLocalData = async () => {
        try {
            const resPlayer = await fetch('/data/player.json');
            if (resPlayer.ok) {
                const playerData = await resPlayer.json();
                const merged: PlayerState = {
                    profile: { avatar: '/data/avatars/default.png', name: '未命名', age: 18, gender: '男', job: '冒险者', ...(playerData.profile || {}) },
                    stats: { level: 1, health: 100, maxHealth: 100, attack: 10, defense: 5, speed: 8, ...(playerData.stats || {}) },
                    experience: { current: 0, required: 100, ...(playerData.experience || {}) },
                    currency: { gold: 100, ...(playerData || {}) },
                };
                setPlayer(merged);
                if (playerData.inventory) {
                    setInventory((prev) => ({
                        equipment: { ...prev.equipment, ...(playerData.inventory.equipment || {}) },
                        items: Array.isArray(playerData.inventory.items) ? playerData.inventory.items : prev.items,
                    }));
                }
            } else {
                setPlayer({
                    profile: { avatar: '/data/avatars/default.png', name: '未命名', age: 18, gender: '男', job: '冒险者' },
                    stats: { level: 1, health: 100, maxHealth: 100, attack: 10, defense: 5, speed: 8 },
                    experience: { current: 0, required: 100 },
                    currency: { gold: 100 },
                });
            }
        } catch {
            setPlayer({
                profile: { avatar: '/data/avatars/default.png', name: '未命名', age: 18, gender: '男', job: '冒险者' },
                stats: { level: 1, health: 100, maxHealth: 100, attack: 10, defense: 5, speed: 8 },
                experience: { current: 0, required: 100 },
                currency: { gold: 100 },
            });
        }

        try {
            const resScenes = await fetch('/data/scenes.json');
            if (resScenes.ok) {
                const sceneMap: ScenesMap = await resScenes.json();
                setScenes(sceneMap);
                let preferred = '';
                try {
                    const saved = localStorage.getItem('rpg_scene_data');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed && parsed.currentScene && sceneMap[parsed.currentScene]) preferred = parsed.currentScene;
                    }
                } catch { }
                if (!preferred && sceneMap['village_square']) preferred = 'village_square';
                if (!preferred) {
                    const withContent = Object.values(sceneMap).find(sc => (sc.buildings && sc.buildings.length) || (sc.npcs && sc.npcs.length) || (sc.exits && Object.keys(sc.exits).length));
                    if (withContent) preferred = withContent.id;
                }
                if (!preferred) preferred = Object.keys(sceneMap)[0] || '';
                setCurrentSceneId(preferred);
            } else {
                const fallback: ScenesMap = {
                    village_square: {
                        id: 'village_square',
                        name: '村庄广场',
                        description: '这是一个宁静的村庄广场。请确保 scenes.json 存在。',
                        background: '/data/icons/empty.png',
                        buildings: [],
                        npcs: [],
                        exits: {},
                    },
                };
                setScenes(fallback);
                setCurrentSceneId('village_square');
            }
        } catch {
            const fallback: ScenesMap = {
                village_square: {
                    id: 'village_square',
                    name: '村庄广场',
                    description: '这是一个宁静的村庄广场。请确保 scenes.json 存在。',
                    background: '/data/icons/empty.png',
                    buildings: [],
                    npcs: [],
                    exits: {},
                },
            };
            setScenes(fallback);
            setCurrentSceneId('village_square');
        }
    };

    // 优先从后端加载数据，失败则回退到本地 JSON（只加载一次）
    useEffect(() => {
        if (backendDataLoaded) return; // 已加载后端数据则跳过

        (async () => {
            let backendSuccess = false;

            // 有 pdfFileId 时优先尝试从后端获取
            if (pdfFileId) {
                try {
                    const url = `${HOST_ADDRESS}/api/backend/files/${pdfFileId}`;
                    const res = await fetch(url);
                    const contentType = res.headers.get('content-type') || '';
                    if (res.ok && contentType.includes('application/json')) {
                        const data = await res.json();
                        console.log('✅ 后端返回数据:', data);
                        if (data && data.success && data.files) {
                            applyBackendData(data.files);
                            setBackendDataLoaded(true);
                            backendSuccess = true;
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ 后端数据加载失败，回退到本地文件:', e);
                }
            }

            // 后端失败或无 pdfFileId，回退本地
            if (!backendSuccess) {
                loadLocalData();
            }
        })();
    }, [pdfFileId, backendDataLoaded]);

    return {
        player,
        setPlayer,
        inventory,
        setInventory,
        scenes,
        setScenes,
        currentSceneId,
        setCurrentSceneId,
        backendDataLoaded,
        backendLore,
        backendEvents
    };
};
