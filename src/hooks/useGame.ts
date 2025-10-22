import { useState, useEffect, useCallback } from 'react';
import type { GameEvent, PlayerData, Scene } from '../page/game';

export const useGame = () => {
    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [currentScene, setCurrentScene] = useState<Scene | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);

    /**
     * 初始化游戏
     */
    const initGame = useCallback(async () => {
        console.log('初始化游戏...');
        
        try {
            // 加载玩家数据
            const savedPlayerData = localStorage.getItem('playerData');
            let playerData: PlayerData;
            
            if (savedPlayerData) {
                playerData = JSON.parse(savedPlayerData);
            } else {
                // 如果没有玩家数据，跳转到创建角色页面
                window.location.href = '/createCharacter';
                return;
            }
            
            setPlayer(playerData);

            // 加载场景数据
            const mockScene: Scene = {
                id: 'start',
                name: '起始村庄',
                description: '一个宁静的小村庄，村民们过着平静的生活。',
                image: 'data/scenes/village.jpg',
                buildings: [
                    {
                        id: 'tavern',
                        name: '酒馆',
                        description: '村民们聚集的地方',
                        image: 'data/buildings/tavern.jpg'
                    }
                ],
                npcs: [
                    {
                        id: 'elder',
                        name: '村长',
                        job: '村长',
                        gender: '男',
                        age: 65,
                        avatar: 'data/avatars/elder.png',
                        description: '村庄的领导者，经验丰富',
                        relationships: []
                    }
                ],
                exits: [
                    {
                        id: 'forest',
                        name: '神秘森林',
                        description: '通往未知的森林',
                        direction: '北',
                        targetSceneId: 'forest',
                        travelCost: 10
                    }
                ]
            };
            
            setCurrentScene(mockScene);
            setIsInitialized(true);
            console.log('游戏初始化完成');

            // 触发欢迎事件
            setTimeout(() => {
                triggerWelcomeEvent();
            }, 1000);

        } catch (error) {
            console.error('游戏初始化失败:', error);
        }
    }, []);

    /**
     * 触发欢迎事件
     */
    const triggerWelcomeEvent = () => {
        const welcomeEvent: GameEvent = {
            id: 'welcome_event',
            title: '欢迎来到冒险世界',
            description: '你来到了一个充满神秘与冒险的世界。准备好开始你的旅程了吗？',
            image: 'data/events/welcome.jpg',
            options: [
                {
                    text: '开始冒险',
                    action: () => {
                        console.log('开始冒险');
                        setShowEventModal(false);
                    }
                },
                {
                    text: '了解世界观',
                    action: () => {
                        console.log('打开世界观');
                        setShowEventModal(false);
                        // 这里可以打开世界观面板
                    }
                }
            ]
        };
        
        setCurrentEvent(welcomeEvent);
        setShowEventModal(true);
    };

    /**
     * 添加测试物品到背包
     */
    const addTestItems = useCallback(() => {
        // 这里可以添加测试物品逻辑
        console.log('添加测试物品');
    }, []);

    /**
     * 重置游戏
     */
    const resetGame = useCallback(() => {
        if (confirm('确定要重置游戏吗？这将清除所有进度！')) {
            localStorage.removeItem('playerData');
            localStorage.removeItem('rpg_inventory_data');
            localStorage.removeItem('rpg_scene_data');
            window.location.reload();
        }
    }, []);

    /**
     * 恢复玩家生命值
     */
    const healPlayer = useCallback(() => {
        if (player) {
            const updatedPlayer = {
                ...player,
                stats: {
                    ...player.stats,
                    health: player.stats.maxHealth
                }
            };
            setPlayer(updatedPlayer);
            console.log('玩家生命值已恢复');
        }
    }, [player]);

    // 组件挂载时初始化游戏
    useEffect(() => {
        initGame();
    }, [initGame]);

    return {
        player,
        currentScene,
        isInitialized,
        showEventModal,
        currentEvent,
        setShowEventModal,
        addTestItems,
        resetGame,
        healPlayer
    };
};