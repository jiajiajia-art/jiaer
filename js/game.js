/**
 * 主游戏类
 * 整合所有系统并管理游戏状态
 */
class Game {
    constructor() {
        this.player = null;
        this.inventory = null;
        this.scene = null;
        this.event = null;
        this.isInitialized = false;
        
        this.init();
    }

    /**
     * 初始化游戏
     */
    async init() {
        console.log('初始化游戏...');
        
        // 创建游戏系统实例
        this.player = new Player();
        
        // 等待玩家配置加载完成后再初始化背包
        await this.waitForPlayerConfig();
        
        this.inventory = new Inventory(this.player);
        this.scene = new Scene();
        this.event = new EventSystem(this.player, this.inventory, this.scene);
        
        // 将游戏实例暴露到全局，供其他系统使用
        window.game = this;
        
        this.isInitialized = true;
        console.log('游戏初始化完成');
        
        // 触发欢迎事件
        setTimeout(() => {
            this.event.triggerEvent('welcome_event');
        }, 1000);
    }

    /**
     * 等待玩家配置加载完成
     */
    async waitForPlayerConfig() {
        // 等待最多3秒让玩家配置加载完成
        for (let i = 0; i < 30; i++) {
            if (this.player.getData().profile.name !== '未命名') {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 获取玩家实例
     */
    getPlayer() {
        return this.player;
    }

    /**
     * 获取背包实例
     */
    getInventory() {
        return this.inventory;
    }

    /**
     * 获取场景实例
     */
    getScene() {
        return this.scene;
    }

    /**
     * 获取事件系统实例
     */
    getEvent() {
        return this.event;
    }

    /**
     * 添加测试物品到背包
     */
    addTestItems() {
        const testItems = [
            { id: 'health_potion', quantity: 5 },
            { id: 'iron_sword', quantity: 1 },
            { id: 'leather_armor', quantity: 1 },
            { id: 'leather_helmet', quantity: 1 },
            { id: 'wooden_shield', quantity: 1 }
        ];

        testItems.forEach(item => {
            this.inventory.addItem(item);
        });
        
        console.log('测试物品已添加到背包');
    }


    /**
     * 重置游戏
     */
    resetGame() {
        if (confirm('确定要重置游戏吗？这将清除所有进度！')) {
            // 清除本地存储（玩家数据不再存储，只清除背包和场景）
            localStorage.removeItem('rpg_inventory_data');
            localStorage.removeItem('rpg_scene_data');
            
            // 重新加载页面
            location.reload();
        }
    }

    /**
     * 获取游戏状态
     */
    getGameState() {
        return {
            player: this.player.getData(),
            inventory: this.inventory.getData(),
            scene: this.scene.getData(),
            eventHistory: this.event.getEventHistory()
        };
    }


    /**
     * 显示调试信息
     */
    showDebugInfo() {
        const gameState = this.getGameState();
        console.log('=== 游戏调试信息 ===');
        console.log('玩家数据:', gameState.player);
        console.log('背包数据:', gameState.inventory);
        console.log('场景数据:', gameState.scene);
        console.log('事件历史:', gameState.eventHistory);
        console.log('==================');
    }

    /**
     * 随机触发事件
     */
    triggerRandomEvent() {
        if (this.event.triggerRandomEvent()) {
            console.log('随机事件已触发');
        } else {
            console.log('没有可触发的随机事件');
        }
    }

    /**
     * 快速升级玩家
     */
    quickLevelUp() {
        this.player.addExperience(1000);
        console.log('玩家快速升级');
    }

    /**
     * 恢复玩家生命值
     */
    healPlayer() {
        const playerData = this.player.getData();
        this.player.setStats({
            health: playerData.stats.maxHealth
        });
        console.log('玩家生命值已恢复');
    }
}
