import React, { useEffect, useState } from 'react';
import styles from './NewMain.module.css';
import { useGameStore } from '../store/gameStore';
import DialogueModal from '../components/Mian/DialogueModal';

declare global {
    interface Window {
        game: any;
        showNotification: any;
        switchPanel: any;
        addChatMessage: any;
        setChatNPC: any;
        Game?: any;
    }
}

const NewMain: React.FC = () => {
    // React 状态（面板与浮窗）
    const [activePanel, setActivePanel] = useState<'scene' | 'map'>('scene');
    const [chatOpen, setChatOpen] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [playerOpen, setPlayerOpen] = useState(false);
    const [loreOpen, setLoreOpen] = useState(false);

    // 聊天
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<Array<{ type: 'user' | 'system'; text: string }>>([
        { type: 'system', text: '欢迎来到游戏世界！' },
    ]);
    const [currentChatNpc, setCurrentChatNpc] = useState<any | null>(null);

    // 游戏时间与世界观
    const [gameTimeText, setGameTimeText] = useState('加载中...');
    const [worldLoreHtml, setWorldLoreHtml] = useState<string>('');
    const [playerLoreHtml, setPlayerLoreHtml] = useState<string>('');
    const [loreLoaded, setLoreLoaded] = useState(false);

    // 事件系统（精简版）
    type EventOption = { text: string; effects?: any; nextEvent?: string | null };
    type EventDef = { id: string; title: string; image: string; description: string; options: EventOption[]; conditions?: any };
    const [events, setEvents] = useState<Record<string, EventDef>>({});
    const [activeEvent, setActiveEvent] = useState<EventDef | null>(null);
    const [eventHistory, setEventHistory] = useState<Array<{ id: string; title?: string; timestamp: number }>>([]);
    const [initialEventShown, setInitialEventShown] = useState(false);
    const [backendDataLoaded, setBackendDataLoaded] = useState(false);

    // ===== Player / Inventory / Scene 数据（React 版本） =====
    type PlayerProfile = { avatar: string; name: string; age: number; gender: string; job: string };
    type PlayerStats = { level: number; health: number; maxHealth: number; attack: number; defense: number; speed: number };
    type PlayerState = {
        profile: PlayerProfile;
        stats: PlayerStats;
        experience: { current: number; required: number };
        currency: { gold: number };
    };
    type Item = { id: string; name?: string; icon?: string; quantity: number; stackable?: boolean; equippable?: boolean; usable?: boolean; slots?: string[]; effects?: Partial<PlayerStats> };
    type EquipmentSlots = { head: Item | null; body: Item | null; legs: Item | null; hands: Item | null; feet: Item | null; back: Item | null; leftHand: Item | null; rightHand: Item | null };
    type InventoryState = { equipment: EquipmentSlots; items: Item[] };
    type SceneNode = { id: string; name: string; description?: string; background?: string; buildings: any[]; npcs: any[]; events?: string[]; exits: Record<string, string> };
    type ScenesMap = Record<string, SceneNode>;

    const [player, setPlayer] = useState<PlayerState | null>(null);
    const [inventory, setInventory] = useState<InventoryState>({
        equipment: { head: null, body: null, legs: null, hands: null, feet: null, back: null, leftHand: null, rightHand: null },
        items: [],
    });
    const [scenes, setScenes] = useState<ScenesMap>({});
    const [currentSceneId, setCurrentSceneId] = useState<string>('');
    const pdfFileId = useGameStore((s) => s.pdfFileId);

    // 优先从后端加载数据，失败则回退到本地 JSON（只加载一次）
    useEffect(() => {
        if (backendDataLoaded) return; // 已加载后端数据则跳过

        (async () => {
            let backendSuccess = false;

            // 有 pdfFileId 时优先尝试从后端获取
            if (pdfFileId) {
                try {
                    const url = `http://localhost:3000/api/backend/files/${pdfFileId}`;
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

            // 2) 物品定义映射
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

            // 3) 玩家
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

            // 4) 世界观与时间
            if (root.lore && typeof root.lore === 'object') {
                const lore = root.lore;
                if (lore.gameTime) {
                    const { currentYear, yearName, currentMonth, currentDay, monthNames, season } = lore.gameTime;
                    const monthName = (monthNames && monthNames[currentMonth - 1]) || '未知月';
                    setGameTimeText(`${yearName} ${currentYear}年 ${monthName} ${currentDay}日 (${season})`);
                }
                if (lore.worldBackground?.content) {
                    setWorldLoreHtml(lore.worldBackground.content.map((p: string) => `<p>${p}</p>`).join(''));
                }
                if (lore.playerStory?.content) {
                    setPlayerLoreHtml(lore.playerStory.content.map((p: string) => `<p>${p}</p>`).join(''));
                }
                setLoreLoaded(true);
            }
        } catch (err) {
            console.error('应用后端数据失败:', err);
        }
    };

    // 加载本地 JSON 文件作为后备
    const loadLocalData = async () => {
        try {
            const res = await fetch('/data/lore.json');
            if (res.ok) {
                const loreData = await res.json();
                if (loreData?.gameTime) {
                    const { currentYear, yearName, currentMonth, currentDay, monthNames, season } = loreData.gameTime;
                    const monthName = monthNames?.[currentMonth - 1] || '未知月';
                    setGameTimeText(`${yearName} ${currentYear}年 ${monthName} ${currentDay}日 (${season})`);
                } else {
                    setGameTimeText('纪元元年 一月 1日');
                }
            } else {
                setGameTimeText('纪元元年 一月 1日');
            }
        } catch {
            setGameTimeText('纪元元年 一月 1日');
        }

        try {
            const resPlayer = await fetch('/data/player.json');
            if (resPlayer.ok) {
                const playerData = await resPlayer.json();
                const merged: PlayerState = {
                    profile: { avatar: '/data/avatars/default.png', name: '未命名', age: 18, gender: '男', job: '冒险者', ...(playerData.profile || {}) },
                    stats: { level: 1, health: 100, maxHealth: 100, attack: 10, defense: 5, speed: 8, ...(playerData.stats || {}) },
                    experience: { current: 0, required: 100, ...(playerData.experience || {}) },
                    currency: { gold: 100, ...(playerData.currency || {}) },
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

    // 打开世界观时首次加载
    const ensureLoadLore = async () => {
        if (loreLoaded) return;
        try {
            const res = await fetch('/data/lore.json');
            if (res.ok) {
                const data = await res.json();
                if (data?.worldBackground?.content) {
                    setWorldLoreHtml(data.worldBackground.content.map((p: string) => `<p>${p}</p>`).join(''));
                }
                if (data?.playerStory?.content) {
                    setPlayerLoreHtml(data.playerStory.content.map((p: string) => `<p>${p}</p>`).join(''));
                }
            } else {
                setWorldLoreHtml('<p>这是一个充满魔法与冒险的世界...</p>');
                setPlayerLoreHtml('<p>你是一位初出茅庐的冒险者...</p>');
            }
        } catch {
            setWorldLoreHtml('<p>这是一个充满魔法与冒险的世界...</p>');
            setPlayerLoreHtml('<p>你是一位初出茅庐的冒险者...</p>');
        } finally {
            setLoreLoaded(true);
        }
    };

    // 载入事件表
    const ensureLoadEvents = async () => {
        if (Object.keys(events).length > 0) return;
        try {
            const res = await fetch('/data/events.json');
            if (res.ok) {
                const ev = (await res.json()) as Record<string, EventDef>;
                setEvents(ev);
            } else {
                // 默认 welcome 事件
                const fallback: Record<string, EventDef> = {
                    welcome_event: {
                        id: 'welcome_event',
                        title: '欢迎来到冒险世界',
                        image: '/data/events/welcome.jpg',
                        description: '你来到了一个神秘的世界，前方有无数冒险等待着你。作为一位新生的冒险者，你准备好踏上这段旅程了吗？',
                        options: [
                            { text: '开始冒险！', effects: { experience: 10 }, nextEvent: null },
                            { text: '先了解一下这个世界', effects: { experience: 5 }, nextEvent: null },
                            { text: '我需要更多准备', effects: {}, nextEvent: null },
                        ],
                    },
                };
                setEvents(fallback);
            }
        } catch {
            const fallback: Record<string, EventDef> = {
                welcome_event: {
                    id: 'welcome_event',
                    title: '欢迎来到冒险世界',
                    image: '/data/events/welcome.jpg',
                    description: '你来到了一个神秘的世界，前方有无数冒险等待着你。作为一位新生的冒险者，你准备好踏上这段旅程了吗？',
                    options: [
                        { text: '开始冒险！', effects: { experience: 10 }, nextEvent: null },
                        { text: '先了解一下这个世界', effects: { experience: 5 }, nextEvent: null },
                        { text: '我需要更多准备', effects: {}, nextEvent: null },
                    ],
                },
            };
            setEvents(fallback);
        }
    };

    // 触发事件（示例：欢迎事件）
    const triggerEventById = async (eventId: string) => {
        await ensureLoadEvents();
        const ev = events[eventId];
        if (ev) {
            setActiveEvent(ev);
            setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
        }
        else if (eventId === 'welcome_event') {
            // 如果异步刚加载还未 set 到 state，延迟一点再取
            setTimeout(() => {
                const ev2 = events['welcome_event'];
                if (ev2) {
                    setActiveEvent(ev2);
                    setEventHistory((h) => [...h, { id: ev2.id, title: ev2.title, timestamp: Date.now() }]);
                }
            }, 100);
        }
    };

    // 进入页面自动弹出初始故事事件：等待事件表可用后显示（与 Main.html 行为一致）
    useEffect(() => {
        if (initialEventShown) return;
        (async () => {
            await ensureLoadEvents();
            if (Object.keys(events).length > 0 && !initialEventShown) {
                const ev = events['welcome_event'];
                if (ev) {
                    setActiveEvent(ev);
                    setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
                    setInitialEventShown(true);
                }
            }
        })();
    }, [events, initialEventShown]);

    const handleEventOption = (index: number) => {
        if (!activeEvent) return;
        const opt = activeEvent.options[index];
        if (!opt) return;
        // 应用 effects 到玩家（若有）
        if (opt.effects && player) {
            const next = { ...player };
            if (typeof (opt.effects as any).experience === 'number') {
                const add = (opt.effects as any).experience as number;
                next.experience.current += add;
                while (next.experience.current >= next.experience.required) {
                    next.experience.current -= next.experience.required;
                    next.experience.required = Math.floor(next.experience.required * 1.5);
                    next.stats.level += 1;
                    next.stats.maxHealth += 5;
                    next.stats.health = next.stats.maxHealth;
                }
            }
            if ((opt.effects as any).stats) {
                const patch = (opt.effects as any).stats as Partial<PlayerStats>;
                next.stats = { ...next.stats, ...patch } as PlayerStats;
            }
            if ((opt.effects as any).items) {
                const items = (opt.effects as any).items as Array<{ id: string; quantity: number }>;
                setInventory((prev) => {
                    const nextInv: InventoryState = { ...prev, items: prev.items.map((i) => ({ ...i })) };
                    items.forEach(({ id, quantity }) => {
                        const found = nextInv.items.find((i) => i.id === id);
                        if (quantity > 0) {
                            if (found) found.quantity += quantity; else nextInv.items.push({ id, quantity });
                        } else if (quantity < 0 && found) {
                            found.quantity = Math.max(0, found.quantity + quantity);
                            if (found.quantity === 0) nextInv.items = nextInv.items.filter((i) => i.id !== id);
                        }
                    });
                    return nextInv;
                });
            }
            if (typeof (opt.effects as any).gold === 'number') {
                const delta = (opt.effects as any).gold as number;
                next.currency.gold = (next.currency.gold ?? 0) + delta;
            }
            setPlayer(next);
        }
        setActiveEvent(null);
        if (opt.nextEvent) triggerEventById(opt.nextEvent);
    };

    // 建筑点击：features 事件或回退事件
    const handleBuildingClick = (building: any) => {
        if (building && Array.isArray(building.features) && building.features.length > 0) {
            // 动态生成基于 features 的事件弹窗（最多三项）
            const tempEvent: EventDef = {
                id: `building_${building.id}_features`,
                title: building.name,
                image: building.icon || '/data/icons/empty.png',
                description: `${building.name}\n\n${building.description}\n\n可用功能：`,
                options: building.features.slice(0, 3).map((f: string) => ({ text: f, effects: {} })),
            };
            setActiveEvent(tempEvent);
            setEventHistory((h) => [...h, { id: tempEvent.id, title: tempEvent.title, timestamp: Date.now() }]);
            return;
        }
        // 回退：尝试用 eventId 或通用命名匹配事件
        const sceneId = currentSceneId;
        const tryIds: string[] = [];
        if (building?.eventId) tryIds.push(building.eventId);
        if (building?.id && sceneId) {
            tryIds.push(`${sceneId}_building_${building.id}`);
            tryIds.push(`building_${building.id}`);
        }
        for (const id of tryIds) {
            const ev = events[id];
            if (ev) { setActiveEvent(ev); setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]); return; }
        }
        alert('该建筑暂未配置可用功能');
    };

    // 聊天发送
    const sendChat = () => {
        const text = chatInput.trim();
        if (!text) return;
        setChatMessages((msgs) => [...msgs, { type: 'user', text }]);
        setChatInput('');
        setTimeout(() => {
            if (currentChatNpc) {
                const npcName = currentChatNpc.name || 'NPC';
                setChatMessages((msgs) => [...msgs, { type: 'system', text: `${npcName}: "我明白了，让我想想..."` }]);
            } else {
                setChatMessages((msgs) => [...msgs, { type: 'system', text: '收到您的消息：' + text }]);
            }
        }, 500);
    };

    const handleStartChatWithNpc = (npc: any) => {
        setCurrentChatNpc(npc);
        setChatOpen(true);
        setNpcModalOpen(false);
        // 系统提示：开始与 NPC 对话
        setChatMessages((msgs) => [...msgs, { type: 'system', text: `━━━ 开始与 ${npc.name}${npc.job || npc.type ? `（${npc.job || npc.type}）` : ''} 对话 ━━━` }]);
        // NPC 开场白（随机）
        setTimeout(() => {
            const greetings = [
                `${npc.name}: "你好，冒险者！有什么我可以帮助你的吗？"`,
                `${npc.name}: "欢迎！很高兴见到你。"`,
                `${npc.name}: "你找我有什么事吗？"`,
                `${npc.name}: "看起来你是个有趣的冒险者。"`
            ];
            const greet = greetings[Math.floor(Math.random() * greetings.length)];
            setChatMessages((msgs) => [...msgs, { type: 'system', text: greet }]);
        }, 500);
    };


    // 键盘快捷键（1 背包 / 2 角色 / 3 地图 / Esc 关闭弹层）
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) return;
            switch (e.key) {
                case '1': case 'Digit1': setInventoryOpen((v) => !v); e.preventDefault(); break;
                case '2': case 'Digit2': setPlayerOpen((v) => !v); e.preventDefault(); break;
                case '3': case 'Digit3': setActivePanel('map'); e.preventDefault(); break;
                case 'Escape': setActiveEvent(null); setChatOpen(false); setLoreOpen(false); setInventoryOpen(false); setPlayerOpen(false); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // 地图布局：与 Main.html 完全一致的算法
    const computePositions = (m: ScenesMap): Record<string, { x: number; y: number }> => {
        const ids = Object.keys(m);
        const positions: Record<string, { x: number; y: number }> = {};
        if (ids.length === 0) return positions;

        // 1) 先用网格初始化所有位置
        const gridSize = Math.ceil(Math.sqrt(ids.length));
        const cellWidth = 1000 / (gridSize + 1);
        const cellHeight = 800 / (gridSize + 1);
        ids.forEach((id, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            positions[id] = {
                x: (col + 1) * cellWidth,
                y: (row + 1) * cellHeight
            };
        });

        // 2) 基于方向关系优化位置（从第一个场景开始）
        const directionOffsets: Record<string, { x: number; y: number }> = {
            north: { x: 0, y: -150 },
            south: { x: 0, y: 150 },
            east: { x: 150, y: 0 },
            west: { x: -150, y: 0 },
            northeast: { x: 120, y: -120 },
            northwest: { x: -120, y: -120 },
            southeast: { x: 120, y: 120 },
            southwest: { x: -120, y: 120 },
            up: { x: 0, y: -120 },
            down: { x: 0, y: 120 },
        };

        const visited = new Set<string>();
        const queue = [ids[0]];
        // 设置起始场景在中心
        if (queue[0]) {
            positions[queue[0]] = { x: 500, y: 400 };
        }

        while (queue.length > 0) {
            const currentId = queue.shift() as string;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const scene = m[currentId];
            const currentPos = positions[currentId];
            if (!scene || !currentPos) continue;

            if (scene.exits) {
                Object.entries(scene.exits).forEach(([direction, targetId]) => {
                    if (!visited.has(targetId) && m[targetId]) {
                        const offset = directionOffsets[direction] || { x: 100, y: 100 };
                        positions[targetId] = {
                            x: currentPos.x + offset.x,
                            y: currentPos.y + offset.y
                        };
                        queue.push(targetId);
                    }
                });
            }
        }

        // 3) 边界检查与自动缩放到 viewBox 范围内
        const allPos = Object.values(positions);
        if (allPos.length === 0) return positions;
        const minX = Math.min(...allPos.map(p => p.x));
        const maxX = Math.max(...allPos.map(p => p.x));
        const minY = Math.min(...allPos.map(p => p.y));
        const maxY = Math.max(...allPos.map(p => p.y));

        const margin = 100; // 留白边距
        const scaleX = (1000 - 2 * margin) / Math.max(1, maxX - minX);
        const scaleY = (800 - 2 * margin) / Math.max(1, maxY - minY);
        const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

        // 应用缩放与居中
        Object.keys(positions).forEach(id => {
            positions[id] = {
                x: margin + (positions[id].x - minX) * scale,
                y: margin + (positions[id].y - minY) * scale
            };
        });

        return positions;
    };
    const positions = computePositions(scenes);

    // 场景详情弹窗
    const [sceneDetailOpen, setSceneDetailOpen] = useState(false);
    const [sceneDetailId, setSceneDetailId] = useState<string | null>(null);
    const computeTravelCost = (scene: SceneNode | undefined) => {
        if (!scene) return 10;
        let cost = 10;
        if (scene.buildings && scene.buildings.length > 3) cost += 5;
        if (scene.npcs && scene.npcs.length > 2) cost += 5;
        return Math.max(5, cost);
    };

    // NPC 详情弹窗
    const [npcModalOpen, setNpcModalOpen] = useState(false);
    const [npcDetail, setNpcDetail] = useState<any | null>(null);

    // 对话弹窗（用于奇闻轶事等）
    const [dialogueOpen, setDialogueOpen] = useState(false);
    const [dialogueTitle, setDialogueTitle] = useState('奇闻轶事');
    // const [dialogueMessage, setDialogueMessage] = useState('当前场景暂无奇闻轶事...');

    // Debug 面板（可选）
    const debugMode = typeof window !== 'undefined' && (window.location.search.includes('debug=true') || localStorage.getItem('debug_mode') === 'true');
    const addTestItems = () => {
        setInventory((prev) => ({ ...prev, items: [...prev.items, { id: 'health_potion', name: '生命药水', icon: '/data/icons/empty.png', quantity: 3, usable: true, effects: { health: 20 } }] }));
    };
    const quickLevelUp = () => {
        if (!player) return;
        const next = { ...player };
        next.experience.current += next.experience.required;
        while (next.experience.current >= next.experience.required) {
            next.experience.current -= next.experience.required;
            next.experience.required = Math.floor(next.experience.required * 1.5);
            next.stats.level += 1;
            next.stats.maxHealth += 5;
            next.stats.health = next.stats.maxHealth;
        }
        setPlayer(next);
    };
    const healPlayer = () => {
        if (!player) return;
        setPlayer({ ...player, stats: { ...player.stats, health: player.stats.maxHealth } });
    };
    const triggerRandomEvent = async () => {
        await ensureLoadEvents();
        const list = Object.values(events);
        if (list.length === 0) return;
        const ev = list[Math.floor(Math.random() * list.length)];
        setActiveEvent(ev);
        setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
    };
    const showDebugInfo = () => {
        // 简单打印当前状态
        // eslint-disable-next-line no-console
        console.log({ player, inventory, currentScene: scenes[currentSceneId], eventHistory });
    };
    const resetGame = () => {
        // 重置到默认
        setInventory({ equipment: { head: null, body: null, legs: null, hands: null, feet: null, back: null, leftHand: null, rightHand: null }, items: [] });
        setPlayer((p) => (p ? { ...p, stats: { ...p.stats, level: 1, health: 100, maxHealth: 100, attack: 10, defense: 5, speed: 8 }, experience: { current: 0, required: 100 }, currency: { gold: 100 } } : p));
        const firstId = Object.keys(scenes)[0] || currentSceneId;
        if (firstId) setCurrentSceneId(firstId);
        setActiveEvent(null);
    };
    // ===== Inventory 行为（简化） =====
    const equipItem = (item: Item, slot: keyof EquipmentSlots) => {
        setInventory((prev) => {
            const next = { ...prev, equipment: { ...prev.equipment }, items: prev.items.map((i) => ({ ...i })) };
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

    const useItem = (item: Item) => {
        if (!item.usable) return;
        if (item.effects && player) {
            const next = { ...player };
            const patch = item.effects as Partial<PlayerStats>;
            next.stats = { ...next.stats, ...patch } as PlayerStats;
            if (patch.health) next.stats.health = Math.min(next.stats.maxHealth, next.stats.health);
            setPlayer(next);
        }
        setInventory((prev) => {
            const next = { ...prev, items: prev.items.map((i) => ({ ...i })) };
            const bag = next.items.find((i) => i.id === item.id);
            if (bag) {
                bag.quantity = Math.max(0, bag.quantity - 1);
                if (bag.quantity === 0) next.items = next.items.filter((i) => i.id !== item.id);
            }
            return next;
        });
    };

    const slotNameMap: Record<keyof EquipmentSlots, string> = { head: '头部', body: '上身', legs: '下身', hands: '手部', feet: '脚部', back: '背部', leftHand: '左手', rightHand: '右手' };

    return (
        <div className={styles.gameContainer}>
            {/* 顶部导航栏 */}
            <header className={styles.gameHeader}>
                <h1>文字RPG游戏</h1>
                <div className={styles.headerButtons}>
                    <button
                        id="sceneBtn"
                        className={`${styles.navBtn} ${activePanel === 'scene' ? styles.active : ''}`}
                        onClick={() => setActivePanel('scene')}
                    >
                        场景
                    </button>
                    <button
                        id="mapBtn"
                        className={`${styles.navBtn} ${activePanel === 'map' ? styles.active : ''}`}
                        onClick={() => setActivePanel('map')}
                    >
                        大地图
                    </button>
                </div>
            </header>

            {/* 主要内容区域 */}
            <main className={styles.mainContent}>
                {/* 场景面板 */}
                <div id="scenePanel" className={styles.panel} style={{ display: activePanel === 'scene' ? 'block' : 'none' }}>
                    <div className={styles.panelHeader}>
                        <h2 id="sceneTitle">{currentSceneId && scenes[currentSceneId] ? scenes[currentSceneId].name : '当前场景'}</h2>
                        <button id="triggerSceneEventBtn" className={styles.sceneEventBtn} onClick={() => {
                            setDialogueTitle('📜 奇闻轶事');
                            setDialogueOpen(true);
                        }}>📜 奇闻轶事</button>
                    </div>
                    {/* 游戏时间栏 */}
                    <div className={styles.gameTimeBar}>
                        <span className={styles.timeIcon}>🕐</span>
                        <span id="gameTimeDisplay" className={styles.gameTimeText}>{gameTimeText}</span>
                    </div>
                    <div className={styles.sceneContent}>
                        <div className={styles.sceneHero} onClick={() => { if (currentSceneId) { setSceneDetailId(currentSceneId); setSceneDetailOpen(true); } }}>
                            <div className={styles.sceneVisual}>
                                {currentSceneId && scenes[currentSceneId]?.background && (
                                    <img id="sceneImage" src={scenes[currentSceneId].background} alt="场景图片" />
                                )}
                            </div>
                            <div className={styles.sceneDescription}>
                                <p id="sceneDescription">{currentSceneId && scenes[currentSceneId]?.description ? scenes[currentSceneId].description : '欢迎来到文字RPG世界！'}</p>
                            </div>
                        </div>
                        <div className={styles.sceneBuildings}>
                            <h3>建筑</h3>
                            <div id="buildingsList" className={styles.buildingsGrid}>
                                {(currentSceneId && scenes[currentSceneId]?.buildings?.length
                                    ? scenes[currentSceneId].buildings
                                    : []).map((b: any) => (
                                        <div key={b.id} className={styles.buildingCard} onClick={() => handleBuildingClick(b)}>
                                            <img src={b.icon || '/data/icons/empty.png'} alt={b.name} />
                                            <h4>{b.name}</h4>
                                            <p>{b.description}</p>
                                        </div>
                                    ))}
                                {currentSceneId && (!scenes[currentSceneId]?.buildings || scenes[currentSceneId]?.buildings?.length === 0) && (
                                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666' }}>没有建筑</p>
                                )}
                            </div>
                        </div>
                        <div className={styles.sceneNpcs}>
                            <h3>NPC</h3>
                            <div id="npcsList" className={styles.npcsGrid}>
                                {(currentSceneId && scenes[currentSceneId]?.npcs?.length ? scenes[currentSceneId].npcs : []).map((n: any) => (
                                    <div key={n.id} className={styles.npcCard} onClick={() => { setNpcDetail(n); setNpcModalOpen(true); }}>
                                        <img src={n.icon || '/data/avatars/default.png'} alt={n.name} />
                                        <h4>{n.name}</h4>
                                        <p>{n.description}</p>
                                    </div>
                                ))}
                                {currentSceneId && (!scenes[currentSceneId]?.npcs || scenes[currentSceneId]?.npcs?.length === 0) && (
                                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666' }}>没有NPC</p>
                                )}
                            </div>
                        </div>
                        <div className={styles.sceneExits}>
                            <h3>场景出口</h3>
                            <div id="exitsList" className={styles.exitsGrid}>
                                {currentSceneId && scenes[currentSceneId] && Object.entries(scenes[currentSceneId].exits || {}).map(([direction, targetId]) => (
                                    <div key={direction} className={styles.exitCard} onClick={() => setCurrentSceneId(targetId)}>
                                        <span className={styles.exitDirection}>{direction}</span>
                                        <h4>{scenes[targetId]?.name || '未知'}</h4>
                                        <p>{scenes[targetId]?.description ? `${scenes[targetId].description.substring(0, 50)}...` : '未知区域'}</p>
                                    </div>
                                ))}
                                {currentSceneId && scenes[currentSceneId] && Object.keys(scenes[currentSceneId].exits || {}).length === 0 && (
                                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666' }}>没有出口</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 大地图面板 */}
                <div id="mapPanel" className={styles.panel} style={{ display: activePanel === 'map' ? 'block' : 'none' }}>
                    <div className={styles.panelHeader}>
                        <h2>大地图</h2>
                        <button id="resetMapView" className={styles.resetMapBtn}>重置视图</button>
                    </div>
                    <div className={styles.mapContent}>
                        <svg id="mapSvg" className={styles.mapSvg} viewBox="0 0 1000 800">
                            {/* 连接线 */}
                            <g id="mapConnections">
                                {Object.entries(scenes).map(([id, sc]) => (
                                    sc.exits ? Object.entries(sc.exits).map(([_, targetId]) => (
                                        positions[id] && positions[targetId] ? (
                                            <line key={`${id}-${targetId}`} className="connection-line" x1={positions[id].x} y1={positions[id].y} x2={positions[targetId].x} y2={positions[targetId].y} stroke="#95a5a6" strokeWidth={2} strokeDasharray="5,5" />
                                        ) : null
                                    )) : null
                                ))}
                            </g>
                            {/* 场景节点 */}
                            <g id="mapNodes">
                                {Object.entries(scenes).map(([id, sc]) => (
                                    positions[id] ? (
                                        <g key={id} className="scene-node" onClick={() => { setSceneDetailId(id); setSceneDetailOpen(true); }} style={{ cursor: 'pointer' }}>
                                            <defs>
                                                <clipPath id={`clip-${id}`}>
                                                    <circle cx={positions[id].x} cy={positions[id].y} r={id === currentSceneId ? 50 : 40} />
                                                </clipPath>
                                            </defs>
                                            <image href={sc.background || '/data/icons/empty.png'} x={positions[id].x - (id === currentSceneId ? 50 : 40)} y={positions[id].y - (id === currentSceneId ? 50 : 40)} width={(id === currentSceneId ? 100 : 80)} height={(id === currentSceneId ? 100 : 80)} clipPath={`url(#clip-${id})`} preserveAspectRatio="xMidYMid slice" />
                                            <circle cx={positions[id].x} cy={positions[id].y} r={id === currentSceneId ? 50 : 40} fill="none" stroke={id === currentSceneId ? '#e74c3c' : '#4a90e2'} strokeWidth={id === currentSceneId ? 4 : 3} />
                                            <text x={positions[id].x} y={positions[id].y + 5} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">{sc.name.length > 4 ? sc.name.substring(0, 4) : sc.name}</text>
                                            {id === currentSceneId && <text x={positions[id].x} y={positions[id].y + (id === currentSceneId ? 50 : 40) + 20} textAnchor="middle" fill="#e74c3c" fontWeight="bold">● 当前</text>}
                                        </g>
                                    ) : null
                                ))}
                            </g>
                        </svg>
                    </div>
                </div>
            </main>

            {/* 事件弹窗 */}
            <div id="eventModal" className={styles.modal} style={{ display: activeEvent ? 'block' : 'none' }}>
                <div className={styles.modalContent}>
                    <div className={styles.eventImage}>
                        {activeEvent?.image && <img id="eventImage" src={activeEvent.image} alt="事件图片" />}
                    </div>
                    <div className={styles.eventDescription}>
                        <p id="eventText">{activeEvent?.description || ''}</p>
                    </div>
                    <div className={styles.eventOptions}>
                        {activeEvent?.options?.map((opt, idx) => (
                            <button key={idx} id={`option${idx + 1}`} className={styles.eventOption} onClick={() => handleEventOption(idx)}>
                                {opt.text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 悬浮聊天面板 */}
            <div id="chatPanel" className={styles.chatPanel} style={{ display: chatOpen ? 'flex' : 'none' }}>
                <div className={styles.chatHeader}>
                    <h3 id="chatTitle">聊天</h3>
                    <button id="closeChatBtn" className={styles.closeChatBtn} onClick={() => setChatOpen(false)}>×</button>
                </div>
                <div id="chatMessages" className={styles.chatMessages}>
                    {chatMessages.map((m, i) => (
                        <div key={i} className={`${styles.chatMessage} ${m.type === 'system' ? styles.system : ''}`}>{m.text}</div>
                    ))}
                </div>
                <div className={styles.chatInputArea}>
                    <input
                        type="text"
                        id="chatInput"
                        className={styles.chatInput}
                        placeholder="输入消息..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    />
                    <button id="sendChatBtn" className={styles.sendChatBtn} onClick={sendChat}>发送</button>
                </div>
            </div>

            {/* 悬浮背包面板 */}
            <div id="inventoryFloatingPanel" className={styles.inventoryFloatingPanel} style={{ display: inventoryOpen ? 'flex' : 'none' }}>
                <div className={styles.inventoryPanelHeader}>
                    <h3>背包</h3>
                    <button id="closeInventoryBtn" className={styles.closeInventoryBtn} onClick={() => setInventoryOpen(false)}>×</button>
                </div>
                <div className={styles.inventoryPanelContent}>
                    <div className={styles.equipmentSection}>
                        <h3>装备</h3>
                        <div className={styles.equipmentGrid}>
                            {(Object.keys(inventory.equipment) as Array<keyof EquipmentSlots>).map((slot) => {
                                const eq = inventory.equipment[slot];
                                return (
                                    <div key={slot} className={styles.equipmentSlot} data-slot={slot}>
                                        <img src={eq?.icon || '/data/icons/empty.png'} alt={slotNameMap[slot]} />
                                        <span>{eq?.name || slotNameMap[slot]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className={styles.itemsSection}>
                        <h3>物品</h3>
                        <div id="itemsGrid" className={styles.itemsGrid}>
                            {inventory.items.length === 0 && (
                                <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666' }}>背包为空</p>
                            )}
                            {inventory.items.map((it) => (
                                <div key={it.id} className={styles.itemSlot} onClick={() => (it.usable ? useItem(it) : (it.equippable && it.slots && it.slots.length ? equipItem(it, it.slots[0] as keyof EquipmentSlots) : null))}>
                                    <img src={it.icon || '/data/icons/empty.png'} alt={it.name || it.id} />
                                    <div className={styles.itemName}>{it.name || it.id}</div>
                                    {it.quantity > 1 && <div className={styles.itemName}>x{it.quantity}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 悬浮角色信息面板 */}
            <div id="playerFloatingPanel" className={styles.playerFloatingPanel} style={{ display: playerOpen ? 'flex' : 'none' }}>
                <div className={styles.playerPanelHeader}>
                    <h3>角色信息</h3>
                    <button id="closePlayerBtn" className={styles.closePlayerBtn} onClick={() => setPlayerOpen(false)}>×</button>
                </div>
                <div className={styles.playerPanelContent}>
                    <div className={styles.playerInfo}>
                        <div className={styles.playerAvatar}>
                            <img id="playerAvatar" src={player?.profile.avatar || '/data/avatars/default.png'} alt="角色头像" />
                        </div>
                        <div className={styles.playerDetails}>
                            <div className={styles.playerBasic}>
                                <h3 id="playerName">{player?.profile.name || '未命名'}</h3>
                                <p><span className={styles.label}>年龄:</span> <span id="playerAge">{player?.profile.age ?? '-'}</span></p>
                                <p><span className={styles.label}>性别:</span> <span id="playerGender">{player?.profile.gender ?? '-'}</span></p>
                                <p><span className={styles.label}>职业:</span> <span id="playerJob">{player?.profile.job ?? '-'}</span></p>
                            </div>
                            <div className={styles.playerStats}>
                                <h4>属性</h4>
                                <div className={styles.statBar}>
                                    <span className={styles.statLabel}>等级:</span>
                                    <span id="playerLevel" className={styles.statValue}>{player?.stats.level ?? 1}</span>
                                </div>
                                <div className={styles.statBar}>
                                    <span className={styles.statLabel}>生命:</span>
                                    <span id="playerHealth" className={styles.statValue}>{player ? `${player.stats.health}/${player.stats.maxHealth}` : '100/100'}</span>
                                </div>
                                <div className={styles.statBar}>
                                    <span className={styles.statLabel}>攻击:</span>
                                    <span id="playerAttack" className={styles.statValue}>{player?.stats.attack ?? 10}</span>
                                </div>
                                <div className={styles.statBar}>
                                    <span className={styles.statLabel}>防御:</span>
                                    <span id="playerDefense" className={styles.statValue}>{player?.stats.defense ?? 5}</span>
                                </div>
                                <div className={styles.statBar}>
                                    <span className={styles.statLabel}>速度:</span>
                                    <span id="playerSpeed" className={styles.statValue}>{player?.stats.speed ?? 8}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 场景详情弹窗（静态占位）*/}
            <div id="sceneDetailModal" className={styles.modal} style={{ display: 'none' }}>
                <div className={`${styles.modalContent} ${styles.sceneModalContent}`}>
                    <button className={styles.closeSceneModal}>×</button>
                    <div className={styles.sceneDetailImage}>
                        <img id="sceneDetailImage" src="" alt="场景图片" />
                    </div>
                    <div className={styles.sceneDetailInfo}>
                        <h2 id="sceneDetailName">场景名称</h2>
                        <div className={styles.sceneDetailDescription}>
                            <p id="sceneDetailDesc">场景描述</p>
                        </div>
                        <div className={styles.sceneTravelCost}>
                            <div className={styles.costInfo}>
                                <span className={styles.costLabel}>旅行费用：</span>
                                <span id="travelCost" className={styles.costValue}>10</span>
                                <span className={styles.costIcon}>💰</span>
                            </div>
                            <div className={styles.playerGold}>
                                <span className={styles.goldLabel}>你的金币：</span>
                                <span id="playerGoldDisplay" className={styles.goldValue}>100</span>
                                <span className={styles.goldIcon}>💰</span>
                            </div>
                        </div>
                        <div className={styles.sceneDetailActions}>
                            <button id="goToSceneBtn" className={styles.goToSceneBtn}>🚀 前往此场景</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* NPC详情弹窗（静态占位） */}
            <div id="npcModal" className={styles.modal} style={{ display: npcModalOpen ? 'block' : 'none' }}>
                <div className={`${styles.modalContent} ${styles.npcModalContent}`}>
                    <button className={styles.closeNpcModal} onClick={() => setNpcModalOpen(false)}>×</button>
                    <div className={styles.npcDetailHeader}>
                        <img id="npcDetailAvatar" src={npcDetail?.icon || '/data/avatars/default.png'} alt="NPC头像" className={styles.npcDetailAvatar} />
                        <div className={styles.npcDetailInfo}>
                            <h2 id="npcDetailName">{npcDetail?.name || 'NPC'}</h2>
                            <div className={styles.npcDetailStats}>
                                <span id="npcDetailJob" className={styles.npcDetailJob}>{npcDetail?.job || npcDetail?.type || '职业'}</span>
                                <span id="npcDetailGender" className={styles.npcDetailGender}>{npcDetail?.gender || '性别'}</span>
                                <span id="npcDetailAge" className={styles.npcDetailAge}>{npcDetail?.age ? `${npcDetail.age}岁` : '年龄'}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.npcDetailDescription}>
                        <p id="npcDetailDesc">{npcDetail?.description || '描述'}</p>
                    </div>
                    <div className={styles.npcRelationships}>
                        <h3>人际关系</h3>
                        <div id="npcRelationshipsList" className={styles.relationshipsGrid}>
                            {npcDetail?.relationships && scenes && Object.keys(npcDetail.relationships).length > 0 ? (
                                Object.entries(npcDetail.relationships).map(([npcId, relation]: any) => {
                                    const allNPCs: Record<string, any> = {};
                                    Object.values(scenes).forEach((sc: any) => (sc.npcs || []).forEach((n: any) => (allNPCs[n.id] = n)));
                                    const related = allNPCs[npcId as string];
                                    if (!related) return null;
                                    return (
                                        <div key={npcId as string} className="relationship-card">
                                            <img src={related.icon || '/data/avatars/default.png'} alt={related.name} />
                                            <div className="relationship-name">{related.name}</div>
                                            <div className="relationship-type">{relation as string}</div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p style={{ textAlign: 'center', color: '#999' }}>暂无人际关系</p>
                            )}
                        </div>
                    </div>
                    <div className={styles.npcActions}>
                        <button id="chatWithNPCBtn" className={styles.chatWithNpcBtn} onClick={() => { if (npcDetail) handleStartChatWithNpc(npcDetail); }}>{'💬 与TA对话'}</button>
                    </div>
                </div>
            </div>

            {/* 悬浮世界观面板 */}
            <div id="lorePanel" className={styles.loreFloatingPanel} style={{ display: loreOpen ? 'flex' : 'none' }}>
                <div className={styles.lorePanelHeader}>
                    <h3>世界观</h3>
                    <button id="closeLoreBtn" className={styles.closeLoreBtn} onClick={() => setLoreOpen(false)}>×</button>
                </div>
                <div className={styles.lorePanelContent}>
                    <div className={styles.loreSection}>
                        <h4>📖 世界背景</h4>
                        <div id="worldLoreContent" className={styles.loreContent} dangerouslySetInnerHTML={{ __html: worldLoreHtml }} />
                    </div>
                    <div className={styles.loreSection}>
                        <h4>⚔️ 主角故事</h4>
                        <div id="playerLoreContent" className={styles.loreContent} dangerouslySetInnerHTML={{ __html: playerLoreHtml }} />
                    </div>
                </div>
            </div>

            {/* 对话弹窗组件 */}
            <DialogueModal
                isOpen={dialogueOpen}
                onClose={() => setDialogueOpen(false)}
                title={dialogueTitle}
                playerName={player?.profile.name || '玩家'}
            />

            {/* 悬浮按钮组 */}
            <button id="toggleLoreBtn" className={styles.floatingLoreBtn} title="世界观" onClick={async () => { await ensureLoadLore(); setLoreOpen(true); }}>📖</button>
            <button id="togglePlayerBtn" className={styles.floatingPlayerBtn} title="角色信息" onClick={() => setPlayerOpen(true)}>👤</button>
            <button id="toggleInventoryBtn" className={styles.floatingInventoryBtn} title="打开背包" onClick={() => setInventoryOpen(true)}>🎒</button>
            <button id="toggleChatBtn" className={styles.floatingChatBtn} title="打开聊天" onClick={() => setChatOpen(true)}>💬</button>

            {/* Debug 面板（开启 ?debug=true 或 localStorage debug_mode=true）*/}
            {debugMode && (
                <div style={{ position: 'fixed', top: 10, right: 10, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: 10, borderRadius: 6, zIndex: 9999, width: 200 }}>
                    <div style={{ textAlign: 'center', color: '#ffd700', marginBottom: 6 }}>调试控制</div>
                    <button style={{ width: '100%', margin: '2px 0' }} onClick={addTestItems}>添加测试物品</button>
                    <button style={{ width: '100%', margin: '2px 0' }} onClick={quickLevelUp}>快速升级</button>
                    <button style={{ width: '100%', margin: '2px 0' }} onClick={healPlayer}>恢复生命值</button>
                    <button style={{ width: '100%', margin: '2px 0' }} onClick={triggerRandomEvent}>触发随机事件</button>
                    <button style={{ width: '100%', margin: '2px 0' }} onClick={showDebugInfo}>显示调试信息</button>
                    <button style={{ width: '100%', margin: '2px 0' }} onClick={resetGame}>重置游戏</button>
                </div>
            )}

            {/* 场景详情弹窗（React 版）*/}
            <div id="sceneDetailModal" className={styles.modal} style={{ display: sceneDetailOpen ? 'block' : 'none' }}>
                <div className={`${styles.modalContent} ${styles.sceneModalContent}`}>
                    <button className={styles.closeSceneModal} onClick={() => setSceneDetailOpen(false)}>×</button>
                    <div className={styles.sceneDetailImage}>
                        {sceneDetailId && scenes[sceneDetailId]?.background && (
                            <img id="sceneDetailImage" src={scenes[sceneDetailId].background} alt="场景图片" />
                        )}
                    </div>
                    <div className={styles.sceneDetailInfo}>
                        <h2 id="sceneDetailName">{sceneDetailId && scenes[sceneDetailId] ? scenes[sceneDetailId].name : '场景名称'}</h2>
                        <div className={styles.sceneDetailDescription}>
                            <p id="sceneDetailDesc">{sceneDetailId && scenes[sceneDetailId]?.description ? scenes[sceneDetailId]?.description : '场景描述'}</p>
                        </div>
                        <div className={styles.sceneTravelCost}>
                            <div className={styles.costInfo}>
                                <span className={styles.costLabel}>旅行费用：</span>
                                <span id="travelCost" className={styles.costValue}>{computeTravelCost(sceneDetailId ? scenes[sceneDetailId] : undefined)}</span>
                                <span className={styles.costIcon}>💰</span>
                            </div>
                            <div className={styles.playerGold}>
                                <span className={styles.goldLabel}>你的金币：</span>
                                <span id="playerGoldDisplay" className={styles.goldValue}>{player?.currency.gold ?? 0}</span>
                                <span className={styles.goldIcon}>💰</span>
                            </div>
                        </div>
                        <div className={styles.sceneDetailActions}>
                            <button id="goToSceneBtn" className={styles.goToSceneBtn} onClick={() => {
                                if (!sceneDetailId) return;
                                const cost = computeTravelCost(scenes[sceneDetailId]);
                                if (player && (player.currency.gold ?? 0) < cost) { alert(`金币不足！需要 ${cost} 金币`); return; }
                                if (player) setPlayer({ ...player, currency: { gold: Math.max(0, (player.currency.gold ?? 0) - cost) } });
                                setCurrentSceneId(sceneDetailId);
                                setSceneDetailOpen(false);
                                setActivePanel('scene');
                            }}>🚀 前往此场景</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NewMain;