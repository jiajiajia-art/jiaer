import React, { useEffect, useState, useRef } from 'react';
import styles from './NewMain.module.css';
import { HOST_ADDRESS } from '../config';
import { useEventSystem } from '../hooks/useEventSystem';
import { useGameData, type PlayerStats, type InventoryState } from '../hooks/useGameData';
import { useChat } from '../hooks/useChat';
import { useLore } from '../hooks/useLore';
import { useInventory } from '../hooks/useInventory';
import DialogueModal from '../components/Mian/DialogueModal';
import NpcModal from '../components/Mian/NpcModal';
import SceneDetailModal from '../components/Mian/SceneDetailModal';
import EventModal from '../components/Mian/EventModal';
import PlayerFloatingPanel from '../components/Mian/PlayerFloatingPanel';
import InventoryFloatingPanel from '../components/Mian/InventoryFloatingPanel';
import MapModal from '../components/Mian/MapModal';
import { useGameStore } from '../store/gameStore';
import ReactMarkdown from 'react-markdown';

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
    const { chatOpen, setChatOpen, chatInput, setChatInput, chatMessages, handleStartChatWithNpc, chatWithNpc, loadChatHistory } = useChat();
    const { gameTimeText, worldLoreHtml, playerLoreHtml, updateLoreFromBackend, updateLoreFromLocal } = useLore();
    const { inventoryOpen, setInventoryOpen, equipItem, useItem } = useInventory();
    const { events, activeEvent, setActiveEvent, setEventHistory, triggerEventById, closeEvent } = useEventSystem();

    // React 状态（面板与浮窗）
    const [activePanel, setActivePanel] = useState<'scene' | 'map'>('scene');
    const [playerOpen, setPlayerOpen] = useState(false);
    const [loreOpen, setLoreOpen] = useState(false);
    const [npcModalOpen, setNpcModalOpen] = useState(false);
    const [npcDetail, setNpcDetail] = useState<any | null>(null);

    // 添加聊天消息容器的引用
    const chatMessagesEndRef = useRef<HTMLDivElement>(null);
    const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部的函数
    const scrollToBottom = () => {
        if (chatMessagesContainerRef.current) {
            chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
        }
    };

    // 当聊天消息变化时自动滚动
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]); // 当聊天消息更新时触发

    // 当聊天面板打开时也滚动到底部
    useEffect(() => {
        if (chatOpen) {
            // 稍微延迟确保DOM已经更新
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }, [chatOpen]);

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
        // 保存当前建筑信息，用于传递给EventModal
        setCurrentEventBuilding(building);
        
        if (building && Array.isArray(building.features) && building.features.length > 0) {
            // 动态生成基于 features 的事件弹窗（最多三项）
            const tempEvent: EventDef = {
                id: `building_${building.id}_features`,
                title: building.name,
                image: building.icon || '/data/icons/empty.png',
                description: `${building.name}\n\n${building.description}\n\n`,
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
    
    // 处理从事件弹窗打开对话弹窗
    const handleOpenDialogueFromEvent = (initialText: string) => {
        setDialogueInitialInput(initialText);
        setDialogueTitle('📜 奇闻轶事');
        setDialogueOpen(true);
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


    // 场景详情弹窗
    const [sceneDetailOpen, setSceneDetailOpen] = useState(false);
    const [sceneDetailId, setSceneDetailId] = useState<string | null>(null);


    // 对话弹窗（用于奇闻轶事等）
    const [dialogueOpen, setDialogueOpen] = useState(false);
    const [dialogueTitle, setDialogueTitle] = useState('奇闻轶事');
    const [dialogueInitialInput, setDialogueInitialInput] = useState('');
    
    // 当前事件对应的建筑信息
    const [currentEventBuilding, setCurrentEventBuilding] = useState<any | null>(null);

    // 背包相关函数
    const handleEquipItem = (item: any, slot: any) => equipItem(item, slot, setInventory);
    const handleUseItem = (item: any) => useItem(item, player, setPlayer, setInventory);

    const { sessionId } = useGameStore();

    // 包装 chatWithNpc 以适配当前使用方式
    const handleChatWithNpc = async (text: string) => {
        if (!sessionId || !npcDetail) {
            alert('请点击npc与其对话');
            return;
        }
        await chatWithNpc(sessionId, npcDetail, text);
    };

    const startChatWithNpc = (npc: any) => {
        setNpcModalOpen(false);
        if (sessionId) {
            // 延迟加载历史，确保欢迎消息先显示
            setTimeout(async () => {
                await loadChatHistory(sessionId, npc);
                // 加载历史后滚动到底部
                setTimeout(scrollToBottom, 200);
            }, 300);
        }
        handleStartChatWithNpc(npc);
    };

    // 获取当前场景背景图片
    const currentSceneBackground = currentSceneId && scenes[currentSceneId]?.background
        ? `${HOST_ADDRESS}${scenes[currentSceneId].background}`
        : '';

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
                        <img src="/data/avatars/hunter.png" alt="人物头像" onClick={() => setPlayerOpen(true)} />
                        <div className={styles.playerName}>{player?.profile.name}</div>
                    </div>
                    <button id="triggerSceneEventBtn" className={styles.storyBtn} onClick={() => {
                        setDialogueTitle('📜 故事主线');
                        setDialogueOpen(true);
                    }}>
                        <img src="/data/asset/时间消逝按钮.png" alt="时间消逝按钮" className={styles.storyBtnImg} />
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
                        <div
                            id="settingBtn"
                            className={`${styles.navBtn}`}
                        >
                            <img src="/data/asset/设置.png" alt="设置" className={styles.settingBtnImg} />
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
                                                onClick={() => {
                                                    setCurrentSceneId(targetId);
                                                    // 更新场景描述显示
                                                    const sceneDescElement = document.getElementById('sceneDescription');
                                                    if (sceneDescElement) {
                                                        sceneDescElement.textContent = targetScene.description || '欢迎来到文字RPG世界！';
                                                    }
                                                }}
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
                    {(currentSceneId && scenes[currentSceneId].npcs.length ? scenes[currentSceneId].npcs : []).map((n: any) => (
                        <div key={n.id} className={styles.npcCard} onClick={() => { setNpcDetail(n); setNpcModalOpen(true); }}>
                            <img src={`${HOST_ADDRESS}${n.icon}` || '/data/avatars/default.png'} alt={n.name} />
                            <div className={styles.npcLabel}>{n.name}</div>
                        </div>
                    ))}
                    {/* <div className={styles.npcCard} >
                                <img src={'/data/avatars/default.png'} alt={''} />
                                <div className={styles.npcLabel}>{'第四张图'}</div>
                            </div>
                            <div className={styles.npcCard} >
                                <img src={'/data/avatars/default.png'} alt={''} />
                                <div className={styles.npcLabel}>{'第四张图'}</div>
                            </div> */}
                </div>
                <div id="chatPanel" className={styles.chatPanel} style={{ display: chatOpen ? 'flex' : 'none' }}>
                    <div className={styles.chatHeader}>
                        <h3 id="chatTitle">聊天</h3>
                        <button id="closeChatBtn" className={styles.closeChatBtn} onClick={() => setChatOpen(false)}>
                            <img src="/data/asset/关闭按钮.png" alt="关闭" />
                        </button>
                    </div>
                    <div
                        id="chatMessages"
                        className={styles.chatMessages}
                        ref={chatMessagesContainerRef} // 添加引用用于自动滚动
                    >
                        {chatMessages.map((m, i) =>
                            <div key={i} className={`${styles.chatMessage} ${m.role === 'assistant' ? styles.system : styles.user}`}>
                                <span className={styles.chatMessageWrapper}>
                                    <ReactMarkdown>{m.text}</ReactMarkdown>
                                    {m.isTyping && <span className={styles.typingCursor}>|</span>}
                                </span>
                            </div>
                        )}
                        {/* 添加一个不可见的锚点元素用于滚动 */}
                        <div ref={chatMessagesEndRef} />
                    </div>
                    <div className={styles.chatInputArea}>
                        <input
                            type="text"
                            id="chatInput"
                            className={styles.chatInput}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && chatInput.trim()) {
                                    handleChatWithNpc(chatInput);
                                    setChatInput('');
                                }
                            }}
                        />
                        <button
                            id="sendChatBtn"
                            className={styles.sendChatBtn}
                            onClick={() => {
                                if (chatInput.trim()) {
                                    handleChatWithNpc(chatInput);
                                    setChatInput('');
                                }
                            }}
                        >
                        </button>
                    </div>
                </div>
            </div>
            <div className={styles.sceneEventBtnContainer}>
                <div
                    id="triggerSceneEventBtn"
                    className={styles.sceneEventBtn}
                    onClick={() => {
                        // 如果背包打开，先关闭背包
                        if (inventoryOpen) {
                            setInventoryOpen(false);
                        }
                        // 切换地图弹窗
                        setActivePanel((prev) => (prev === 'map' ? 'scene' : 'map'));
                    }}
                >
                    <img src="/data/asset/地图按钮.png" alt="大地图按钮" className={styles.mapBtnImg} />
                </div>
                <button id="toggleInventoryBtn"
                    className={styles.floatingInventoryBtn}
                    title="打开背包"
                    onClick={() => {
                        // 如果地图打开，先关闭地图
                        if (activePanel === 'map') {
                            setActivePanel('scene');
                        }
                        // 切换背包弹窗
                        setInventoryOpen(!inventoryOpen);
                    }}
                >
                    <img src={"/data/asset/背包按钮.png"} alt="背包按钮" className={styles.inventoryBtnImg} />
                </button>
            </div>

            <MapModal
                isOpen={activePanel === 'map'}
                onClose={() => setActivePanel('scene')}
                scenes={scenes}
                currentSceneId={currentSceneId}
                onSceneClick={(id) => { setSceneDetailId(id); setSceneDetailOpen(true); }}
            />


            {/* 事件弹窗组件 */}
            <EventModal
                isOpen={!!activeEvent}
                event={activeEvent}
                onClose={() => setActiveEvent(null)}
                onOptionSelect={handleEventOption}
                currentSceneId={currentSceneId}
                building={currentEventBuilding}
                onOpenDialogue={handleOpenDialogueFromEvent}
            />

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
                    setCurrentEventBuilding(null); // 清空建筑信息
                }}
                title={dialogueTitle}
                playerName={player?.profile.name || '玩家'}
                initialInput={dialogueInitialInput}
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