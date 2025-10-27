import React, { useEffect, useState } from 'react';
import styles from './NewMain.module.css';
import { HOST_ADDRESS } from '../config';
import { useEventSystem } from '../hooks/useEventSystem';
import { useGameData, type PlayerStats, type InventoryState, type ScenesMap } from '../hooks/useGameData';
import { useChat } from '../hooks/useChat';
import { useLore } from '../hooks/useLore';
import { useInventory } from '../hooks/useInventory';
import DialogueModal from '../components/Mian/DialogueModal';
import NpcModal from '../components/Mian/NpcModal';
import SceneDetailModal from '../components/Mian/SceneDetailModal';
import EventModal from '../components/Mian/EventModal';
import PlayerFloatingPanel from '../components/Mian/PlayerFloatingPanel';
import InventoryFloatingPanel from '../components/Mian/InventoryFloatingPanel';

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
    // 使用自定义 hooks
    const { player, setPlayer, inventory, setInventory, scenes, currentSceneId, setCurrentSceneId, backendDataLoaded, backendLore } = useGameData();
    const { chatOpen, setChatOpen, chatInput, setChatInput, chatMessages, sendChat, handleStartChatWithNpc } = useChat();
    const { gameTimeText, worldLoreHtml, playerLoreHtml, ensureLoadLore, updateLoreFromBackend, updateLoreFromLocal } = useLore();
    const { inventoryOpen, setInventoryOpen, equipItem, useItem } = useInventory();
    const { events, activeEvent, setActiveEvent, eventHistory, setEventHistory, triggerEventById, closeEvent, ensureLoadEvents } = useEventSystem();

    // React 状态（面板与浮窗）
    const [activePanel, setActivePanel] = useState<'scene' | 'map'>('scene');
    const [playerOpen, setPlayerOpen] = useState(false);
    const [loreOpen, setLoreOpen] = useState(false);
    const [npcModalOpen, setNpcModalOpen] = useState(false);
    const [npcDetail, setNpcDetail] = useState<any | null>(null);

    // 事件类型
    type EventDef = { 
        id: string; 
        title: string; 
        image: string; 
        description: string; 
        options: Array<{ text: string; effects?: any; nextEvent?: string | null }>; 
        conditions?: any 
    };

    // 更新世界观数据
    useEffect(() => {
        if (backendDataLoaded && backendLore) {
            // 从后端数据更新世界观
            console.log('🔄 使用后端世界观数据:', backendLore);
            updateLoreFromBackend(backendLore);
        } else if (!backendDataLoaded) {
            // 从本地数据更新世界观
            updateLoreFromLocal();
        }
    }, [backendDataLoaded, backendLore, updateLoreFromBackend, updateLoreFromLocal]);


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
                            if (found) 
                                found.quantity += quantity; 
                            else {
                                nextInv.items.push({ id, quantity });
                            }
                        } else if (quantity < 0 && found) {
                            found.quantity = Math.max(0, found.quantity + quantity);
                            if (found.quantity === 0) 
                                nextInv.items = nextInv.items.filter((i) => i.id !== id);
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
        closeEvent();
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
            // 直接设置事件，不需要通过 hook
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
    // 背包相关函数
    const handleEquipItem = (item: any, slot: any) => equipItem(item, slot, setInventory);
    const handleUseItem = (item: any) => useItem(item, player, setPlayer, setInventory);


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
                                    <img id="sceneImage" src={`${HOST_ADDRESS}${scenes[currentSceneId].background}`} alt="场景图片" />
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
                                            <img src={`${HOST_ADDRESS}${b.icon}` || '/data/icons/empty.png'} alt={b.name} />
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
                                        <img src={`${HOST_ADDRESS}${n.icon}` || '/data/avatars/default.png'} alt={n.name} />
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

            {/* 事件弹窗组件 */}
            <EventModal
                isOpen={!!activeEvent}
                event={activeEvent}
                onOptionSelect={handleEventOption}
            />

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

            {/* 悬浮背包面板组件 */}
            <InventoryFloatingPanel
                isOpen={inventoryOpen}
                onClose={() => setInventoryOpen(false)}
                inventory={inventory}
                onEquipItem={handleEquipItem}
                onUseItem={handleUseItem}
            />

            {/* 悬浮角色信息面板组件 */}
            <PlayerFloatingPanel
                isOpen={playerOpen}
                onClose={() => setPlayerOpen(false)}
                player={player}
            />


            {/* NPC详情弹窗组件 */}
            <NpcModal
                isOpen={npcModalOpen}
                onClose={() => setNpcModalOpen(false)}
                npc={npcDetail}
                onStartChat={(npc) => {
                    handleStartChatWithNpc(npc);
                    setNpcModalOpen(false);
                }}
                scenes={scenes}
            />

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

            {/* 场景详情弹窗组件 */}
            <SceneDetailModal
                isOpen={sceneDetailOpen}
                onClose={() => setSceneDetailOpen(false)}
                sceneId={sceneDetailId}
                scene={sceneDetailId ? scenes[sceneDetailId] : null}
                player={player}
                onTravel={(sceneId, cost) => {
                    if (player) {
                        setPlayer({ ...player, currency: { gold: Math.max(0, player.currency.gold - cost) } });
                    }
                    setCurrentSceneId(sceneId);
                    setSceneDetailOpen(false);
                    setActivePanel('scene');
                }}
            />
        </div>
    );
}

export default NewMain;