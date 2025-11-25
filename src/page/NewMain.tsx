// ==================== 导入 ====================
import React, { useEffect, useState, useRef } from 'react';
import styles from './NewMain.module.css';
import { HOST_ADDRESS } from '../config';
import { useGameStore } from '../store/gameStore';
import { MdLockClock } from 'react-icons/md';

// Hooks
import { useEventSystem } from '../hooks/useEventSystem';
import { useGameData } from '../hooks/useGameData';
import { useChat } from '../hooks/useChat';
import { useLore } from '../hooks/useLore';
import { useInventory } from '../hooks/useInventory';
import { useMusic } from '../hooks/useMusic';
import { useAutoFontSize } from '../hooks/useAutoFontSize';

// 组件
import NpcModal from '../components/Mian/NpcModal';
import SceneDetailModal from '../components/Mian/SceneDetailModal';
import EventModal from '../components/Mian/EventModal';
import PlayerFloatingPanel from '../components/Mian/PlayerFloatingPanel';
import InventoryFloatingPanel from '../components/Mian/InventoryFloatingPanel';
import MapModal from '../components/Mian/MapModal';
import ChatPanel from '../components/Mian/ChatPanel';
import SettingModal from '../components/Mian/SettingModal';
import AlertModal from '../components/AlertModal';
import changeSceneApi from '../api/game/changeSenceAPi';
import MissionsModal from '../components/Mian/MissionsModal';
import StoryModal from '../components/storyModal/StoryModal';

const NewMain: React.FC = () => {
    const { player, inventory, scenes, currentSceneId, setCurrentSceneId, backendDataLoaded, worldMapImageUrl } = useGameData();
    const { chatOpen, setChatOpen, chatInput, setChatInput, chatMessages, setChatMessages, currentChatNpc, handleStartChatWithNpc, chatWithNpc, loadChatHistory } = useChat();
    const { gameTimeText } = useLore();
    const { inventoryOpen, setInventoryOpen, equipItem, useItem } = useInventory();

    // 自动调整游戏时间文字大小
    const [gameTimeRef, gameTimeFontSize] = useAutoFontSize<HTMLDivElement>(gameTimeText, {
        minFontSize: 8,
        maxFontSize: 13,
        padding: 28, // 左右内边距总和 (14px * 2)
    });
    const { activeEvent, setActiveEvent, setEventHistory, triggerEventById, closeEvent } = useEventSystem();
    const { sessionId } = useGameStore();
    const { tracks, isPlaying, play } = useMusic();

    const [mapModalOpen, setMapModalOpen] = useState(false);
    const [playerOpen, setPlayerOpen] = useState(false);
    const [npcModalOpen, setNpcModalOpen] = useState(false);
    const [settingModalOpen, setSettingModalOpen] = useState(false);
    const [sceneDetailOpen, setSceneDetailOpen] = useState(false);
    const [sceneDetailId, setSceneDetailId] = useState<string | null>(null);
    const [dialogueOpen, setDialogueOpen] = useState(false);
    const [_dialogueInitialInput, setDialogueInitialInput] = useState('');
    const [alertModalOpen, setAlertModalOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [npcDetail, setNpcDetail] = useState<any | null>(null);
    const [missionModalOpen, setMissionModalOpen] = useState(false);
    const { loadMissions } = useGameData();
    const { missionData } = useGameStore();

    // 统一处理三个弹窗的互斥逻辑
    const closeOtherPanels = () => {
        if (inventoryOpen) setInventoryOpen(false);
        if (missionModalOpen) setMissionModalOpen(false);
        if (mapModalOpen) setMapModalOpen(false);
    };


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

        closeEvent();
        if (opt.nextEvent) {
            triggerEventById(opt.nextEvent);
        }
    };

    // 建筑点击： fallback 对 features 选项
    const handleBuildingClick = (building: any) => {
        if (!building) {
            return;
        }
        // 后端返回的数据没有选项id之类的
        if (Array.isArray(building.features) && building.features.length > 0) {
            const tempEvent = {
                id: `${building.id }`,
                title: building.name,
                image: building.icon || '',
                description: building.description || '',
                options: building.features.map((text: string) => ({
                    text,
                    effects: {},
                    nextEvent: null
                })),
            };
            setActiveEvent(tempEvent);
            setEventHistory((h) => [...h, { id: tempEvent.id, title: tempEvent.title, timestamp: Date.now() }]);
            return;
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
        const npc = currentChatNpc || npcDetail;
        if (!sessionId || !npc) {
            alert('请点击npc与其对话');
            return;
        }
        setChatInput('');
        await chatWithNpc(sessionId, npc, message);
    };

    const currentSceneBackground = currentSceneId && scenes[currentSceneId]?.background
        ? `${HOST_ADDRESS}${scenes[currentSceneId].background}`
        : '';
    const hasScenes = scenes && Object.keys(scenes).length > 0;
    const isDataReady = backendDataLoaded && !!player && hasScenes;

    // if (!isDataReady) {
    //     return (
    //         <div className={styles.loadingWrapper}>
    //             <div className={styles.loadingSpinner}></div>
    //             <p className={styles.loadingText}>正在加载世界，请稍候…</p>
    //         </div>
    //     );
    // }

    const handleSceneClick = (targetId: string) => {
        changeScenes(targetId);
    }

    const changeScenes = async (targetId: string): Promise<boolean> => {
        // 检查 sessionId 是否存在
        if (!sessionId) {
            setAlertMessage('游戏会话不存在，请重新开始游戏');
            setAlertModalOpen(true);
            return false;
        }

        try {
            const response = await changeSceneApi.changeScene(sessionId, { sceneId: targetId });
            const data = response.data;

            console.log('场景切换响应:', data);

            // 使用类型守卫检查响应类型
            if (data.success === false) {
                // 这是 ChangeSceneErrorResponse 类型
                // 检查是否是 session 不存在
                if (data.error === 'Session not found') {
                    setAlertMessage('游戏会话不存在或已过期，请重新开始游戏');
                    setAlertModalOpen(true);
                    return false;
                }

                // 检查场景是否被锁定
                if (data.locked === true) {
                    setAlertMessage(data.message || '该场景尚未解锁');
                    setAlertModalOpen(true);
                    return false;
                }

                // 其他错误
                setAlertMessage(data.message || `场景切换失败: ${data.error || '未知错误'}`);
                setAlertModalOpen(true);
                return false;
            }

            // 这是 ChangeSceneSuccessResponse 类型，切换成功
            if (data.success === true) {
                setCurrentSceneId(targetId);
                const targetScene = scenes[targetId];
                if (targetScene) {
                    const sceneDescElement = document.getElementById('sceneDescription');
                    if (sceneDescElement) {
                        sceneDescElement.textContent = targetScene.description || '欢迎来到文字RPG世界！';
                    }
                }
                return true;
            }

            return false;
        } catch (error: any) {
            console.error('获取新场景数据失败:', error);

            // 处理 axios 错误响应
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                if (status === 404 || errorData?.error === 'Session not found') {
                    setAlertMessage('场景切换失败，请稍后重试');
                } else {
                    setAlertMessage(errorData?.message || '场景切换失败，请稍后重试');
                }
            } else {
                setAlertMessage('场景切换失败，请稍后重试');
            }

            setAlertModalOpen(true);
            return false;
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
                            src={player?.profile?.avatar || '/data/avatars/hunter.png'}
                            alt="人物头像"
                            onClick={() => setPlayerOpen(!playerOpen)}
                        />
                        <div className={styles.playerName}>
                            {player?.profile?.name || '未命名'}
                        </div>
                    </div>
                    <button id="triggerSceneEventBtn" className={styles.storyBtn} onClick={() => {
                        setDialogueOpen(!dialogueOpen);
                    }}>
                        {
                            dialogueOpen ?
                                <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/时间暂停按钮.png`} alt="关闭" className={styles.storyBtnImg} /> :
                                <img src={`${import.meta.env.BASE_URL}data/asset/时间消逝按钮.png`} alt="时间消逝按钮" className={styles.storyBtnImg} />
                        }
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
                        <div
                            ref={gameTimeRef}
                            className={styles.gameTimeText}
                            style={{
                                fontSize: `${gameTimeFontSize}px`
                            }}
                        >
                            {gameTimeText}
                        </div>
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
                                        const isUnlocked = player?.unlockedScenes?.includes(targetId) ?? false;
                                        return (
                                            <div
                                                key={direction}
                                                className={`${styles.exitCard} ${!isUnlocked ? styles.exitCardLocked : ''}`}
                                                onClick={() => { handleSceneClick(targetId) }}
                                            >
                                                <img
                                                    src={targetScene.background ? `${HOST_ADDRESS}${targetScene.background}` : '/data/icons/empty.png'}
                                                    alt={''}
                                                    className={!isUnlocked ? styles.exitImageLocked : ''}
                                                />
                                                {!isUnlocked && (
                                                    <div className={styles.lockIcon}>
                                                        <MdLockClock />
                                                    </div>
                                                )}
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
                <button id="triggerMissionBtn" className={styles.missionBtn} onClick={() => {
                    closeOtherPanels();
                    loadMissions();
                    setMissionModalOpen(!missionModalOpen);
                }}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/mission.png`} alt="任务按钮" className={styles.missionBtnImg} />
                </button>
                <button
                    id="triggerSceneEventBtn"
                    className={styles.sceneEventBtn}
                >
                    <img
                        onClick={() => {
                            closeOtherPanels();
                            setMapModalOpen(!mapModalOpen);
                        }}
                        src={`${import.meta.env.BASE_URL}data/asset/地图按钮.png`}
                        alt="大地图按钮"
                        className={styles.mapBtnImg}
                    />
                </button>
                <button id="toggleInventoryBtn"
                    className={styles.floatingInventoryBtn}
                    title="打开背包"
                >
                    <img
                        onClick={() => {
                            closeOtherPanels();
                            setInventoryOpen(!inventoryOpen);
                        }}
                        src={`${import.meta.env.BASE_URL}data/asset/背包按钮.png`}
                        alt="背包按钮"
                        className={styles.inventoryBtnImg}
                    />
                </button>
            </div>

            <MapModal
                isOpen={mapModalOpen}
                onClose={() => setMapModalOpen(false)}
                scenes={scenes}
                currentSceneId={currentSceneId}
                onSceneClick={async (id) => {
                    setSceneDetailId(id);
                    // 先尝试切换场景，如果成功（未被锁定）才打开详情弹窗
                    const success = await changeScenes(id);
                    if (success) {
                        setSceneDetailOpen(true);
                    }
                }}
                worldMapImageUrl={worldMapImageUrl}
                player={player}
            />

            {
                missionModalOpen && (
                    <div className={styles.missionModal}>
                        <MissionsModal
                            onClose={() => setMissionModalOpen(false)}
                            missionData={missionData}
                        />
                    </div>
                )
            }

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


            {/* 对话弹窗组件 */}
            <StoryModal
                isOpen={dialogueOpen}
                onClose={() => {
                    setDialogueOpen(false);
                    setDialogueInitialInput(''); // 关闭时清空初始输入
                }}
                playerName={player?.profile?.name || '未命名'}
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
                    if (player && player.currency) {
                        const setPlayer = useGameStore.getState().setPlayer;
                        setPlayer({
                            ...player,
                            currency: {
                                ...player.currency,
                                gold: Math.max(0, (player.currency.gold ?? 0) - cost)
                            }
                        });
                    }
                    setCurrentSceneId(sceneId);
                    setSceneDetailOpen(false);
                    setMapModalOpen(false);
                }}
            />

            {/* 提示弹窗组件 */}
            <AlertModal
                isOpen={alertModalOpen}
                onClose={() => setAlertModalOpen(false)}
                message={alertMessage}
                title="提示"
            />

            <ChatPanel
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                chatMessages={chatMessages}
                chatInput={chatInput}
                onInputChange={setChatInput}
                onSendMessage={handleSendChatMessage}
                onAddMessage={(message) => {
                    setChatMessages((prev) => [...prev, message]);
                }}
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