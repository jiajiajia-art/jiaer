import React, { useState, useEffect } from 'react';
import styles from './Main.module.css';
import SceneDetailModal from '../components/Mian/SceneDetailModal';
import LorePanel from '../components/Mian/LorePanel';
import EventModal from '../components/Mian/EventModal';
import WorldMap from '../components/Mian/WorldMap'; // 导入 WorldMap 组件
import { useGame } from '../hooks/useGame';
import type { NPC, Scene } from './game';
import ChatPanel from '../components/Mian/ChatPanel';
import InventoryFloatingPanel from '../components/Mian/InventoryFloatingPanel';
import PlayerFloatingPanel from '../components/Mian/PlayerFloatingPanel';
import NpcModal from '../components/Mian/NpcModal';

const Main: React.FC = () => {
    const {
        player,
        currentScene,
        isInitialized,
        showEventModal,
        currentEvent,
        setShowEventModal,
        addTestItems,
        resetGame,
        healPlayer,
    } = useGame();

    const [activePanel, setActivePanel] = useState<'scene' | 'map'>('scene');
    const [showSceneDetailModal, setShowSceneDetailModal] = useState(false);
    const [selectedSceneForDetail, setSelectedSceneForDetail] = useState<Scene | null>(null); // 新增：用于显示详情的场景
    const [showNpcModal, setShowNpcModal] = useState(false);
    const [showChatPanel, setShowChatPanel] = useState(false);
    const [showInventoryPanel, setShowInventoryPanel] = useState(false);
    const [showPlayerPanel, setShowPlayerPanel] = useState(false);
    const [showLorePanel, setShowLorePanel] = useState(false);

    // 处理面板切换
    const handlePanelChange = (panel: 'scene' | 'map') => {
        setActivePanel(panel);
    };

    // 触发场景事件
    const handleTriggerSceneEvent = () => {
        console.log('触发场景事件');
        triggerRandomEvent(); // 调用 useGame 中的触发随机事件函数
    };

    // 处理地图场景节点点击，显示场景详情模态框
    const handleMapSceneSelect = (scene: Scene) => {
        setSelectedSceneForDetail(scene);
        setShowSceneDetailModal(true);
    };

    // 处理场景详情模态框中的“前往此场景”按钮
    const handleGoToScene = (sceneId: string, cost: number) => {
        if (!player || !currentScene) return;

        if (player.currency.gold < cost) {
            alert(`金币不足！需要 ${cost} 金币，你只有 ${player.currency.gold} 金币。`);
            return;
        }

        // 扣除金币
        setPlayerCurrency(player.currency.gold - cost); // 更新玩家金币
        
        changeScene(sceneId); // 切换场景
        console.log(`前往场景: ${sceneId}, 花费: ${cost} 金币`);
        setShowSceneDetailModal(false);
        setActivePanel('scene'); // 切换回场景面板
        // showNotification(`已前往 ${getSceneById(sceneId)?.name}，花费 ${cost} 金币`, 'success');
    };

    // 键盘快捷键处理
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return; // 不在输入框中触发快捷键
            }

            switch (event.key) {
                case '1':
                case 'Digit1':
                    setShowInventoryPanel(prev => !prev);
                    event.preventDefault();
                    break;
                case '2':
                case 'Digit2':
                    setShowPlayerPanel(prev => !prev);
                    event.preventDefault();
                    break;
                case '3':
                case 'Digit3':
                    setActivePanel('map');
                    event.preventDefault();
                    break;
                case 'Escape':
                    if (showEventModal) {
                        setShowEventModal(false);
                    }
                    if (showSceneDetailModal) {
                        setShowSceneDetailModal(false);
                    }
                    if (showNpcModal) {
                        setShowNpcModal(false);
                    }
                    if (showChatPanel) {
                        setShowChatPanel(false);
                    }
                    if (showInventoryPanel) {
                        setShowInventoryPanel(false);
                    }
                    if (showPlayerPanel) {
                        setShowPlayerPanel(false);
                    }
                    if (showLorePanel) {
                        setShowLorePanel(false);
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showEventModal, showSceneDetailModal, showNpcModal, showChatPanel, showInventoryPanel, showPlayerPanel, showLorePanel]);

    if (!isInitialized) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>游戏加载中...</p>
            </div>
        );
    }

    return (
        <>
            <div className={styles.bodyContainer}>
                <div className={styles.gameContainer}>
                    {/* 顶部导航栏 */}
                    <header className={styles.gameHeader}>
                        <h1>文字RPG游戏</h1>
                        <div className={styles.headerButtons}>
                            <button
                                className={`${styles.navBtn} ${activePanel === 'scene' ? styles.active : ''}`}
                                onClick={() => handlePanelChange('scene')}
                            >
                                场景
                            </button>
                            <button
                                className={`${styles.navBtn} ${activePanel === 'map' ? styles.active : ''}`}
                                onClick={() => handlePanelChange('map')}
                            >
                                大地图
                            </button>
                            <button
                                className={styles.sceneEventBtn}
                                onClick={handleTriggerSceneEvent}
                            >
                                📜 奇闻轶事
                            </button>
                        </div>
                    </header>

                    {/* 主要内容区域 */}
                    <main className={styles.mainContent}>
                        {/* 游戏时间栏 */}
                        <div className={styles.gameTimeBar}>
                            <span className={styles.timeIcon}>🕐</span>
                            <span className={styles.gameTimeText}>
                                {gameTime ? 
                                    `${gameTime.yearName} ${gameTime.currentYear}年 ${gameTime.monthNames[gameTime.currentMonth - 1]} ${gameTime.currentDay}日 (${gameTime.season}) ${gameTime.timeOfDay}` :
                                    '加载中...'
                                }
                            </span>
                        </div>

                        {/* 场景面板 */}
                        <div className={`${styles.panel} ${activePanel === 'scene' ? styles.active : ''}`}>
                            <div className={styles.panelHeader}>
                                <h2>{currentScene?.name || '当前场景'}</h2>
                            </div>

                            <div className={styles.sceneContent}>
                                <div className={styles.sceneHero}>
                                    <div className={styles.sceneVisual}>
                                        <img
                                            src={currentScene?.image || 'data/scenes/default.jpg'}
                                            alt="场景图片"
                                        />
                                    </div>
                                    <div className={styles.sceneDescription}>
                                        <p>{currentScene?.description || '欢迎来到文字RPG世界！'}</p>
                                    </div>
                                </div>

                                {/* 建筑列表 */}
                                <div className={styles.sceneBuildings}>
                                    <h3>建筑</h3>
                                    <div className={styles.buildingsGrid}>
                                        {currentScene?.buildings?.map(building => (
                                            <div key={building.id} className={styles.buildingCard}>
                                                <img src={building.image} alt={building.name} />
                                                <h4>{building.name}</h4>
                                                <p>{building.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* NPC列表 */}
                                <div className={styles.sceneNpcs}>
                                    <h3>NPC</h3>
                                    <div className={styles.npcsGrid}>
                                        {currentScene?.npcs?.map(npc => (
                                            <div key={npc.id} className={styles.npcCard}>
                                                <img src={npc.avatar} alt={npc.name} />
                                                <div className={styles.npcTitle}>
                                                    <span className={styles.npcName}>{npc.name}</span>
                                                    <span className={styles.npcJob}>{npc.job}</span>
                                                </div>
                                                <p>{npc.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 场景出口 */}
                                <div className={styles.sceneExits}>
                                    <h3>场景出口</h3>
                                    <div className={styles.exitsGrid}>
                                        {currentScene?.exits && Object.entries(currentScene.exits).map(([direction, targetSceneId]) => (
                                            <div key={direction} className={styles.exitCard}>
                                                <span className={styles.exitDirection}>{direction}</span>
                                                <h4>{getSceneById(targetSceneId)?.name || '未知区域'}</h4> {/* 显示目标场景名称 */}
                                                <p>{getSceneById(targetSceneId)?.description || '暂无描述'}</p> {/* 显示目标场景描述 */}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 大地图面板 */}
                        <div className={`${styles.panel} ${activePanel === 'map' ? styles.active : ''}`}>
                            <div className={styles.panelHeader}>
                                <h2>大地图</h2>
                                {/* 重置视图按钮由 WorldMap 内部处理 */}
                            </div>
                            <div className={styles.mapContent}>
                                {isInitialized && allScenes && currentScene && (
                                    <WorldMap
                                        scenes={allScenes as any}
                                        currentSceneId={currentScene.id}
                                        onSceneSelect={handleMapSceneSelect as any}
                                    />
                                )}
                            </div>
                        </div>
                    </main>

                </div>

                {/* 悬浮面板 - 根据状态显示/隐藏 */}
                {showChatPanel && (
                    <ChatPanel
                        isOpen={showChatPanel}
                        onClose={() => setShowChatPanel(false)}
                 />
                )}
                
                {showInventoryPanel && (
                    <InventoryFloatingPanel
                        isOpen={showInventoryPanel}
                        onClose={() => setShowInventoryPanel(false)}
                        player={player}
                    />
                )}
                
                {showPlayerPanel && (
                    <PlayerFloatingPanel
                        isOpen={showPlayerPanel}
                        onClose={() => setShowPlayerPanel(false)}
                        player={player}
                    />
                )}
                
                {showSceneDetailModal && selectedSceneForDetail && (
                    <SceneDetailModal
                        isOpen={showSceneDetailModal}
                        onClose={() => setShowSceneDetailModal(false)}
                    />
                )}
                
                {showNpcModal && (
                    <NpcModal
                        isOpen={showNpcModal}
                        onClose={() => setShowNpcModal(false)}
                    />
                )}
                
                {showLorePanel && (
                    <LorePanel
                        isOpen={showLorePanel}
                        onClose={() => setShowLorePanel(false)}
                    />
                )}

                {showEventModal && (
                    <EventModal
                        isOpen={showEventModal}
                        onClose={() => setShowEventModal(false)}
                        event={currentEvent ? { ...currentEvent, text: currentEvent.description } : null} // 映射 description 到 text
                        onOptionSelect={(action) => {
                            onEventOptionSelect(action, () => setShowLorePanel(true));
                        }}
                    />
                )}

                {/* 悬浮按钮 */}
                <button
                    className={styles.floatingLoreBtn}
                    onClick={() => setShowLorePanel(true)}
                    title="世界观"
                >
                    📖
                </button>
                <button
                    className={styles.floatingPlayerBtn}
                    onClick={() => setShowPlayerPanel(true)}
                    title="角色信息"
                >
                    👤
                </button>
                <button
                    className={styles.floatingInventoryBtn}
                    onClick={() => setShowInventoryPanel(true)}
                    title="打开背包"
                >
                    🎒
                </button>
                <button
                    className={styles.floatingChatBtn}
                    onClick={() => setShowChatPanel(true)}
                    title="打开聊天"
                >
                    💬
                </button>
            </div>
        </>
    );
};

export default Main;