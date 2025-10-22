/**
 * 事件系统
 * 管理游戏事件，包含事件图片、描述和选项
 */
class EventSystem {
    constructor(player, inventory, scene) {
        this.player = player;
        this.inventory = inventory;
        this.scene = scene;
        
        this.events = {}; // 事件数据缓存
        this.activeEvent = null; // 当前活跃事件
        this.eventHistory = []; // 事件历史记录
        
        this.loadEvents();
        this.bindModalEvents();
    }

    /**
     * 加载事件配置
     */
    async loadEvents() {
        try {
            const response = await fetch('data/events.json');
            if (response.ok) {
                this.events = await response.json();
            } else {
                // 如果文件不存在，使用默认事件数据
                this.events = this.getDefaultEvents();
            }
        } catch (error) {
            console.warn('无法加载事件配置文件，使用默认数据');
            this.events = this.getDefaultEvents();
        }
    }

    /**
     * 获取默认事件数据
     */
    getDefaultEvents() {
        return {
            welcome_event: {
                id: 'welcome_event',
                title: '欢迎来到冒险世界',
                image: 'data/events/welcome.jpg',
                description: '你来到了一个神秘的世界，前方有无数冒险等待着你。作为一位新生的冒险者，你准备好踏上这段旅程了吗？',
                options: [
                    {
                        text: '开始冒险！',
                        effects: {
                            experience: 10,
                            items: [{ id: 'health_potion', quantity: 2 }]
                        },
                        nextEvent: null
                    },
                    {
                        text: '先了解一下这个世界',
                        effects: {
                            experience: 5
                        },
                        nextEvent: 'world_info'
                    },
                    {
                        text: '我需要更多准备',
                        effects: {
                            items: [{ id: 'health_potion', quantity: 3 }]
                        },
                        nextEvent: null
                    }
                ],
                conditions: {
                    minLevel: 1,
                    maxLevel: 5
                }
            },
            
            world_info: {
                id: 'world_info',
                title: '世界知识',
                image: 'data/events/world_info.jpg',
                description: '这个世界充满了魔法和危险。东方的森林中居住着精灵，西方的山脉中有巨龙，南方的沙漠里埋藏着古代遗迹。你的选择将决定你的命运。',
                options: [
                    {
                        text: '我要去森林探索',
                        effects: {
                            experience: 15
                        },
                        nextEvent: 'forest_choice'
                    },
                    {
                        text: '山脉听起来很有趣',
                        effects: {
                            experience: 15
                        },
                        nextEvent: 'mountain_choice'
                    },
                    {
                        text: '古代遗迹更吸引我',
                        effects: {
                            experience: 15
                        },
                        nextEvent: 'ruins_choice'
                    }
                ]
            },

            forest_choice: {
                id: 'forest_choice',
                title: '森林探索',
                image: 'data/events/forest.jpg',
                description: '你进入了茂密的森林。阳光透过树叶洒在地面上，你能听到远处传来的神秘声音。突然，一只友善的精灵出现在你面前。',
                options: [
                    {
                        text: '友好地打招呼',
                        effects: {
                            experience: 20,
                            items: [{ id: 'magic_herb', quantity: 1 }]
                        },
                        nextEvent: null
                    },
                    {
                        text: '保持警惕',
                        effects: {
                            experience: 10,
                            stats: { defense: 1 }
                        },
                        nextEvent: null
                    },
                    {
                        text: '询问森林的秘密',
                        effects: {
                            experience: 25,
                            nextEvent: 'forest_secret'
                        }
                    }
                ]
            },

            forest_secret: {
                id: 'forest_secret',
                title: '森林的秘密',
                image: 'data/events/forest_secret.jpg',
                description: '精灵告诉你森林深处有一棵古老的智慧之树，它掌握着强大的魔法知识。但是到达那里需要面对森林守护者的考验。',
                options: [
                    {
                        text: '接受考验',
                        effects: {
                            experience: 30,
                            stats: { attack: 2 },
                            nextEvent: 'guardian_test'
                        }
                    },
                    {
                        text: '感谢信息，现在离开',
                        effects: {
                            experience: 15,
                            items: [{ id: 'forest_map', quantity: 1 }]
                        },
                        nextEvent: null
                    },
                    {
                        text: '询问其他信息',
                        effects: {
                            experience: 10
                        },
                        nextEvent: null
                    }
                ]
            },

            guardian_test: {
                id: 'guardian_test',
                title: '守护者的考验',
                image: 'data/events/guardian.jpg',
                description: '你来到了智慧之树前，森林守护者出现了。它说只有真正勇敢和智慧的冒险者才能获得智慧之树的祝福。',
                options: [
                    {
                        text: '展示我的勇气',
                        effects: {
                            experience: 40,
                            stats: { attack: 3, health: 20 },
                            items: [{ id: 'courage_medal', quantity: 1 }]
                        },
                        nextEvent: null
                    },
                    {
                        text: '展示我的智慧',
                        effects: {
                            experience: 40,
                            stats: { defense: 3, speed: 2 },
                            items: [{ id: 'wisdom_amulet', quantity: 1 }]
                        },
                        nextEvent: null
                    },
                    {
                        text: '展示我的平衡',
                        effects: {
                            experience: 35,
                            stats: { attack: 1, defense: 1, speed: 1, health: 10 },
                            items: [{ id: 'balance_ring', quantity: 1 }]
                        },
                        nextEvent: null
                    }
                ]
            },

            merchant_encounter: {
                id: 'merchant_encounter',
                title: '神秘商人',
                image: 'data/events/merchant.jpg',
                description: '你在路上遇到了一个神秘的商人。他的马车里装满了各种奇异的物品，有些散发着微弱的魔法光芒。',
                options: [
                    {
                        text: '查看商品',
                        effects: {
                            experience: 5
                        },
                        nextEvent: 'merchant_shop'
                    },
                    {
                        text: '询问他的来历',
                        effects: {
                            experience: 10
                        },
                        nextEvent: 'merchant_story'
                    },
                    {
                        text: '礼貌地离开',
                        effects: {
                            experience: 2
                        },
                        nextEvent: null
                    }
                ]
            },

            merchant_shop: {
                id: 'merchant_shop',
                title: '商人的商品',
                image: 'data/events/merchant_shop.jpg',
                description: '商人向你展示了他的商品：一瓶生命药水（20金币）、一把钢剑（50金币）、一件皮甲（40金币）。你只有30金币。',
                options: [
                    {
                        text: '购买生命药水',
                        effects: {
                            items: [{ id: 'health_potion', quantity: 1 }],
                            gold: -20
                        },
                        nextEvent: null
                    },
                    {
                        text: '讨价还价',
                        effects: {
                            experience: 10,
                            nextEvent: 'merchant_bargain'
                        }
                    },
                    {
                        text: '离开',
                        effects: {
                            experience: 2
                        },
                        nextEvent: null
                    }
                ]
            },

            forest_encounter: {
                id: 'forest_encounter',
                title: '森林遭遇',
                image: 'data/events/forest_encounter.jpg',
                description: '在森林深处，你遇到了一只受伤的小狼。它看起来很害怕，但似乎需要帮助。',
                options: [
                    {
                        text: '帮助小狼',
                        effects: {
                            experience: 15,
                            items: [{ id: 'health_potion', quantity: -1 }],
                            nextEvent: 'wolf_grateful'
                        }
                    },
                    {
                        text: '小心地绕过',
                        effects: {
                            experience: 5
                        },
                        nextEvent: null
                    },
                    {
                        text: '查看周围环境',
                        effects: {
                            experience: 10,
                            items: [{ id: 'forest_berries', quantity: 3 }]
                        },
                        nextEvent: null
                    }
                ]
            },

            wolf_grateful: {
                id: 'wolf_grateful',
                title: '感激的狼',
                image: 'data/events/wolf_grateful.jpg',
                description: '你帮助了小狼，它很快康复了。作为感谢，它带你找到了一个隐藏的宝箱，里面有一些有用的物品。',
                options: [
                    {
                        text: '打开宝箱',
                        effects: {
                            experience: 25,
                            items: [
                                { id: 'gold_coin', quantity: 50 },
                                { id: 'magic_scroll', quantity: 1 }
                            ]
                        },
                        nextEvent: null
                    },
                    {
                        text: '感谢小狼并离开',
                        effects: {
                            experience: 20,
                            stats: { speed: 1 }
                        },
                        nextEvent: null
                    }
                ]
            }
        };
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents() {
        const modal = document.getElementById('eventModal');
        
        // 选项按钮事件
        document.getElementById('option1').addEventListener('click', () => {
            this.selectOption(0);
        });
        
        document.getElementById('option2').addEventListener('click', () => {
            this.selectOption(1);
        });
        
        document.getElementById('option3').addEventListener('click', () => {
            this.selectOption(2);
        });

        // 点击背景关闭模态框（可选）
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEvent();
            }
        });
    }

    /**
     * 触发事件
     */
    triggerEvent(eventId) {
        const event = this.events[eventId];
        
        if (!event) {
            console.error('事件不存在:', eventId);
            return false;
        }

        // 检查事件条件
        if (!this.checkEventConditions(event)) {
            console.log('事件条件不满足:', eventId);
            return false;
        }

        this.activeEvent = event;
        this.showEvent(event);
        this.addToHistory(event);
        
        return true;
    }

    /**
     * 检查事件条件
     */
    checkEventConditions(event) {
        if (!event.conditions) return true;

        const playerData = this.player.getData();
        
        if (event.conditions.minLevel && playerData.stats.level < event.conditions.minLevel) {
            return false;
        }
        
        if (event.conditions.maxLevel && playerData.stats.level > event.conditions.maxLevel) {
            return false;
        }

        return true;
    }

    /**
     * 显示事件
     */
    showEvent(event) {
        const modal = document.getElementById('eventModal');
        
        // 设置事件内容
        document.getElementById('eventImage').src = event.image;
        document.getElementById('eventText').textContent = event.description;
        
        // 设置选项按钮
        const options = event.options;
        const optionButtons = [
            document.getElementById('option1'),
            document.getElementById('option2'),
            document.getElementById('option3')
        ];

        optionButtons.forEach((button, index) => {
            if (index < options.length) {
                button.textContent = options[index].text;
                button.style.display = 'block';
            } else {
                button.style.display = 'none';
            }
        });

        // 显示模态框
        modal.style.display = 'block';
        
        // 添加动画效果
        modal.classList.add('show');
    }

    /**
     * 选择选项
     */
    selectOption(optionIndex) {
        if (!this.activeEvent) return;

        const option = this.activeEvent.options[optionIndex];
        
        if (!option) {
            console.error('选项不存在:', optionIndex);
            return;
        }

        // 应用选项效果
        this.applyOptionEffects(option);
        
        // 关闭当前事件
        this.closeEvent();
        
        // 触发下一个事件
        if (option.nextEvent) {
            setTimeout(() => {
                this.triggerEvent(option.nextEvent);
            }, 500);
        }
    }

    /**
     * 应用选项效果
     */
    applyOptionEffects(option) {
        if (!option.effects) return;

        const effects = option.effects;

        // 经验值
        if (effects.experience) {
            this.player.addExperience(effects.experience);
            console.log(`获得 ${effects.experience} 经验值`);
        }

        // 属性
        if (effects.stats) {
            this.player.modifyStats(effects.stats);
            console.log('属性变化:', effects.stats);
        }

        // 物品
        if (effects.items) {
            effects.items.forEach(item => {
                if (item.quantity > 0) {
                    this.inventory.addItem(item);
                    console.log(`获得物品: ${item.id} x${item.quantity}`);
                } else {
                    this.inventory.removeItem(item.id, Math.abs(item.quantity));
                    console.log(`失去物品: ${item.id} x${Math.abs(item.quantity)}`);
                }
            });
        }

        // 金币
        if (effects.gold) {
            // 这里需要实现金币系统
            console.log(`金币变化: ${effects.gold}`);
        }
    }

    /**
     * 关闭事件
     */
    closeEvent() {
        const modal = document.getElementById('eventModal');
        modal.style.display = 'none';
        modal.classList.remove('show');
        this.activeEvent = null;
    }

    /**
     * 添加到历史记录
     */
    addToHistory(event) {
        this.eventHistory.push({
            id: event.id,
            timestamp: Date.now(),
            title: event.title
        });

        // 限制历史记录数量
        if (this.eventHistory.length > 100) {
            this.eventHistory = this.eventHistory.slice(-100);
        }
    }

    /**
     * 获取事件历史
     */
    getEventHistory() {
        return this.eventHistory;
    }

    /**
     * 获取所有事件
     */
    getAllEvents() {
        return this.events;
    }

    /**
     * 获取指定事件
     */
    getEvent(eventId) {
        return this.events[eventId];
    }

    /**
     * 检查事件是否已触发
     */
    hasTriggeredEvent(eventId) {
        return this.eventHistory.some(event => event.id === eventId);
    }

    /**
     * 随机触发事件
     */
    triggerRandomEvent() {
        const availableEvents = Object.values(this.events).filter(event => 
            this.checkEventConditions(event) && !this.hasTriggeredEvent(event.id)
        );

        if (availableEvents.length > 0) {
            const randomEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
            this.triggerEvent(randomEvent.id);
            return true;
        }

        return false;
    }

    /**
     * 重置事件系统
     */
    reset() {
        this.activeEvent = null;
        this.eventHistory = [];
    }
}
