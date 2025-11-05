// ==================== 导入 ====================
import React, { useEffect, useState, useRef } from 'react';
import styles from './NewMain.module.css';
import { HOST_ADDRESS } from '../config';
import { useGameStore, type SceneNode } from '../store/gameStore';

// Hooks
import { useEventSystem } from '../hooks/useEventSystem';
import { useGameData, type PlayerStats, type InventoryState } from '../hooks/useGameData';
import { useChat } from '../hooks/useChat';
import { useLore } from '../hooks/useLore';
import { useInventory } from '../hooks/useInventory';
import { useMusic } from '../hooks/useMusic';

// 组件
import DialogueModal from '../components/Mian/DialogueModal';
import NpcModal from '../components/Mian/NpcModal';
import SceneDetailModal from '../components/Mian/SceneDetailModal';
import EventModal from '../components/Mian/EventModal';
import PlayerFloatingPanel from '../components/Mian/PlayerFloatingPanel';
import InventoryFloatingPanel from '../components/Mian/InventoryFloatingPanel';
import MapModal from '../components/Mian/MapModal';
import ChatPanel from '../components/Mian/ChatPanel';
import SettingModal from '../components/Mian/SettingModal';

// ==================== 类型定义 ====================
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

type EventDef = {
    id: string;
    title: string;
    image: string;
    description: string;
    options: Array<{ text: string; effects?: any; nextEvent?: string | null }>;
    conditions?: any;
};

// ==================== 组件 ====================
const NewMain: React.FC = () => {
    const { player, inventory, scenes, currentSceneId, setCurrentSceneId, backendDataLoaded, backendLore, worldMapImageUrl } = useGameData();
    const { chatOpen, setChatOpen, chatInput, setChatInput, chatMessages, currentChatNpc, handleStartChatWithNpc, chatWithNpc, loadChatHistory } = useChat();
    const { gameTimeText, worldLoreHtml, playerLoreHtml, updateLoreFromBackend, updateLoreFromLocal } = useLore();
    const { inventoryOpen, setInventoryOpen, equipItem, useItem } = useInventory();
    const { events, activeEvent, setActiveEvent, setEventHistory, triggerEventById, closeEvent } = useEventSystem();
    const { sessionId } = useGameStore();
    const { tracks, isPlaying, play } = useMusic();

    const [activePanel, setActivePanel] = useState<'scene' | 'map'>('scene');
    const [playerOpen, setPlayerOpen] = useState(false);
    const [loreOpen, setLoreOpen] = useState(false);
    const [npcModalOpen, setNpcModalOpen] = useState(false);
    const [settingModalOpen, setSettingModalOpen] = useState(false);
    const [sceneDetailOpen, setSceneDetailOpen] = useState(false);
    const [sceneDetailId, setSceneDetailId] = useState<string | null>(null);
    const [dialogueOpen, setDialogueOpen] = useState(false);
    const [dialogueInitialInput, setDialogueInitialInput] = useState('');

    const [npcDetail, setNpcDetail] = useState<any | null>(null);

    // ==================== 世界观相关 ====================
    useEffect(() => {
        if (backendDataLoaded && backendLore) {
            updateLoreFromBackend(backendLore);
        } else if (!backendDataLoaded) {
            updateLoreFromLocal();
        }
    }, [backendDataLoaded, backendLore, updateLoreFromBackend, updateLoreFromLocal]);

    // ==================== 音乐系统相关 ====================
    const hasStartedPlayingRef = useRef(false);
    useEffect(() => {
        if (tracks.length > 0 && !isPlaying && !hasStartedPlayingRef.current) {
            const timer = setTimeout(() => {
                play();
                hasStartedPlayingRef.current = true;
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [tracks.length, isPlaying, play]);

    // ==================== 事件系统相关 ====================
    const handleEventOption = (index: number) => {
        if (!activeEvent) return;
        const opt = activeEvent.options[index];
        if (!opt) return;
        // 注意：这里不关闭事件弹窗，因为EventModal中已经处理了关闭和打开对话弹窗的逻辑
        // 只有在没有通过onOpenDialogue打开对话弹窗的情况下才关闭事件弹窗
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
                const updateInventory = useGameStore.getState().updateInventory;
                updateInventory((prev) => {
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
            const setPlayer = useGameStore.getState().setPlayer;
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
                id: building.id,
                title: building.name,
                image: building.icon || '/data/icons/empty.png',
                description: building.description,
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
        if (building.eventId) tryIds.push(building.eventId);
        if (building.id && sceneId) {
            tryIds.push(`${sceneId}_building_${building.id}`);
            tryIds.push(`building_${building.id}`);
        }
        for (const id of tryIds) {
            const ev = events[id];
            if (ev) {
                setActiveEvent(ev);
                setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
                return;
            }
        }
        alert('该建筑暂未配置可用功能');
    };


    // ==================== 背包系统 ====================
    const handleEquipItem = (item: any, slot: any) => equipItem(item, slot);
    const handleUseItem = (item: any) => useItem(item);

    // ==================== NPC聊天 ====================
    const startChatWithNpc = (npc: any) => {
        setNpcModalOpen(false);
        if (sessionId) {
            // 延迟加载历史，确保欢迎消息先显示
            setTimeout(async () => {
                await loadChatHistory(sessionId, npc);
            }, 300);
        }
        handleStartChatWithNpc(npc);
    };

    const handleSendChatMessage = async (message: string) => {
        if (!sessionId || !npcDetail) {
            alert('请点击npc与其对话');
            return;
        }
        setChatInput('');
        await chatWithNpc(sessionId, npcDetail, message);
    };

    const currentSceneBackground = currentSceneId && scenes[currentSceneId]?.background
        ? `${HOST_ADDRESS}${scenes[currentSceneId].background}`
        : '';

    const handleSceneClick = (targetId: string, targetScene: SceneNode) => {
        setCurrentSceneId(targetId);
        // 更新场景描述显示
        const sceneDescElement = document.getElementById('sceneDescription');
        if (sceneDescElement) {
            sceneDescElement.textContent = targetScene.description || '欢迎来到文字RPG世界！';
        }
        changeScenes(targetId);
    }

    const changeScenes = async (targetId: string) => {
        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/game/session/${sessionId}/change-scene`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sceneId: targetId })
                }
            );
            if (response.ok) {
                console.log('获取新场景数据成功:', response);
            }
        } catch (error) {
            console.error('获取新场景数据失败:', error);
        }
    }

    return (
        <div
            className={styles.gameContainer}
            style={{
                backgroundImage: currentSceneBackground ? `url(${currentSceneBackground})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed'
            }}
        >
            <div className={styles.mainLayout}>

                <div className={styles.playerContent}>
                    <div className={styles.playerInfo}>
                        <img
                            src={player?.profile.avatar || '/data/avatars/hunter.png'}
                            alt="人物头像"
                            onClick={() => setPlayerOpen(!playerOpen)}
                        />
                        <div className={styles.playerName}>{player?.profile.name}</div>
                    </div>
                    <button id="triggerSceneEventBtn" className={styles.storyBtn} onClick={() => {
                        setDialogueOpen(true);
                    }}>
                        <img src={`${import.meta.env.BASE_URL}data/asset/时间消逝按钮.png`} alt="时间消逝按钮" className={styles.storyBtnImg} />
                    </button>
                    {/* 建筑 */}
                    <div id="buildingsList" className={styles.buildingsGrid}>
                        {(currentSceneId && scenes[currentSceneId].buildings.length
                            ? scenes[currentSceneId].buildings
                            : []).map((b: any) => (
                                <div key={b.id} className={styles.buildingCard} onClick={() => handleBuildingClick(b)}>
                                    <img src={`${HOST_ADDRESS}${b.icon}` || '/data/icons/empty.png'} alt={''} />
                                    <h3>{b.name}</h3>
                                    <p>{b.description}</p>
                                </div>
                            ))}
                    </div>
                </div>

                <div className={styles.sceneContent}>
                    <div className={styles.settingContet}>
                        <div className={styles.gameTimeText}>{gameTimeText}</div>
                        <div className={styles.settingBtnWrapper}>
                            <div
                                id="settingBtn"
                                className={`${styles.navBtn}`}
                                onClick={() => setSettingModalOpen(!settingModalOpen)}
                            >
                                <img src={`${import.meta.env.BASE_URL}data/asset/设置.png`} alt="设置" className={styles.settingBtnImg} />
                            </div>
                            <SettingModal
                                isOpen={settingModalOpen}
                                onClose={() => setSettingModalOpen(false)}
                            />
                        </div>
                    </div>
                    <div className={styles.sceneDescriptionContainer}>
                        <div className={styles.sceneDescription}>
                            <div>{currentSceneId && scenes[currentSceneId].name ? scenes[currentSceneId].name : '当前场景'}</div>
                            <p id="sceneDescription">{currentSceneId && scenes[currentSceneId].description ? scenes[currentSceneId].description : '欢迎来到文字RPG世界！'}</p>
                        </div>
                        <div className={styles.sceneExits}>
                            <div id="exitsList" className={styles.exitsGrid}>
                                {currentSceneId && scenes[currentSceneId] && Object.entries(scenes[currentSceneId].exits || {})
                                    .filter(([_, targetId]) => scenes[targetId]) // 只显示目标场景存在的情况
                                    .map(([direction, targetId]) => {
                                        const targetScene = scenes[targetId];
                                        return (
                                            <div
                                                key={direction}
                                                className={styles.exitCard}
                                                onClick={() => handleSceneClick(targetId, targetScene)}
                                            >
                                                <img
                                                    src={targetScene.background ? `${HOST_ADDRESS}${targetScene.background}` : '/data/icons/empty.png'}
                                                    alt={''}
                                                />
                                                <div className={styles.exitLabel}>{targetScene.name}</div>
                                            </div>
                                        );
                                    })}
                                {currentSceneId && scenes[currentSceneId] && Object.keys(scenes[currentSceneId].exits || {}).length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#666', width: '100%' }}>没有出口</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.sceneNpcs}>
                <div id="npcsList" className={styles.npcsGrid}>
                    {(() => {
                        const currentScene = currentSceneId ? scenes[currentSceneId] : null;
                        const npcs = currentScene?.npcs || [];
                        return npcs.map((n: any) => (
                            <div
                                key={`${n.id}-${n.relationships || n.favorability || 0}`}
                                className={styles.npcCard}
                                onClick={() => {
                                    setNpcDetail(n);
                                    setNpcModalOpen(true);
                                }}
                            >
                                <img src={`${HOST_ADDRESS}${n.icon}` || '/data/avatars/default.png'} alt={n.name} />
                                <div className={styles.npcLabel}>{n.name}</div>
                            </div>
                        ));
                    })()}
                </div>
            </div>
            <div className={styles.sceneEventBtnContainer}>
                <div
                    id="triggerSceneEventBtn"
                    className={styles.sceneEventBtn}
                >
                    <img
                        onClick={() => {
                            if (inventoryOpen) {
                                setInventoryOpen(false);
                            }
                            setActivePanel((prev) => (prev === 'map' ? 'scene' : 'map'));
                        }}
                        src={`${import.meta.env.BASE_URL}data/asset/地图按钮.png`}
                        alt="大地图按钮"
                        className={styles.mapBtnImg}
                    />
                </div>
                <button id="toggleInventoryBtn"
                    className={styles.floatingInventoryBtn}
                    title="打开背包"
                >
                    <img
                        onClick={() => {
                            if (activePanel === 'map') {
                                setActivePanel('scene');
                            }
                            setInventoryOpen(!inventoryOpen);
                        }}
                        src={`${import.meta.env.BASE_URL}data/asset/背包按钮.png`}
                        alt="背包按钮"
                        className={styles.inventoryBtnImg}
                    />
                </button>
            </div>


            <MapModal
                isOpen={activePanel === 'map'}
                onClose={() => setActivePanel('scene')}
                scenes={scenes}
                currentSceneId={currentSceneId}
                onSceneClick={(id) => { setSceneDetailId(id); setSceneDetailOpen(true); }}
                worldMapImageUrl={worldMapImageUrl}
            />


            {/* 事件弹窗组件 */}
            <EventModal
                isOpen={!!activeEvent}
                event={activeEvent}
                onClose={() => setActiveEvent(null)}
                onOptionSelect={handleEventOption}
                currentSceneId={currentSceneId}
            />

            {/* 悬浮背包面板组件 */}
            <div className={styles.inventoryFloatingPanel}>
                <InventoryFloatingPanel
                    isOpen={inventoryOpen}
                    onClose={() => setInventoryOpen(false)}
                    inventory={inventory}
                    onEquipItem={handleEquipItem}
                    onUseItem={handleUseItem}
                />
            </div>

            {/* 悬浮角色信息面板组件 */}
            <div className={styles.playerFloatingPanel}>
                <PlayerFloatingPanel
                    isOpen={playerOpen}
                    onClose={() => setPlayerOpen(false)}
                    player={player}
                />
            </div>

            {/* NPC详情弹窗组件 */}
            <NpcModal
                isOpen={npcModalOpen}
                onClose={() => setNpcModalOpen(false)}
                npc={npcDetail}
                onStartChat={(npc) => startChatWithNpc(npc)}
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
                onClose={() => {
                    setDialogueOpen(false);
                    setDialogueInitialInput(''); // 关闭时清空初始输入
                }}
                playerName={player?.profile.name || '玩家'}
                initialInput={dialogueInitialInput}
                player={player}
                inventory={inventory}
                onEquipItem={handleEquipItem}
                onUseItem={handleUseItem}
            />

            {/* 场景详情弹窗组件 */}
            <SceneDetailModal
                isOpen={sceneDetailOpen}
                onClose={() => setSceneDetailOpen(false)}
                sceneId={sceneDetailId}
                scene={sceneDetailId ? scenes[sceneDetailId] : null}
                player={player}
                onTravel={(sceneId, cost) => {
                    if (player) {
                        const setPlayer = useGameStore.getState().setPlayer;
                        setPlayer({ ...player, currency: { gold: Math.max(0, player.currency.gold - cost) } });
                    }
                    setCurrentSceneId(sceneId);
                    setSceneDetailOpen(false);
                    setActivePanel('scene');
                }}
            />

            <ChatPanel
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                chatMessages={chatMessages}
                chatInput={chatInput}
                onInputChange={setChatInput}
                onSendMessage={handleSendChatMessage}
                npc={(() => {
                    const npc = currentChatNpc || npcDetail;
                    if (npc && currentSceneId && scenes[currentSceneId]?.npcs) {
                        return scenes[currentSceneId].npcs.find((n: any) => n.id === npc.id) || npc;
                    }
                    return npc;
                })()}
                sessionId={sessionId}
                onLoadHistory={async (sessionId: string, npc: any) => {
                    return await loadChatHistory(sessionId, npc);
                }}
            />
        </div>
    );
}

export default NewMain;