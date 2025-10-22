/**
 * 玩家属性系统
 * 管理玩家的人设和属性数据
 */
class Player {
    constructor() {
        this.data = {
            // 人设信息
            profile: {
                avatar: 'data/avatars/default.png',
                name: '未命名',
                age: 18,
                gender: '男',
                job: '冒险者'
            },
            // 属性信息
            stats: {
                level: 1,
                health: 100,
                maxHealth: 100,
                attack: 10,
                defense: 5,
                speed: 8
            },
            // 经验值
            experience: {
                current: 0,
                required: 100
            },
            // 货币
            currency: {
                gold: 100
            }
        };
        
        this.loadPlayerConfig();
    }

    /**
     * 加载玩家配置文件
     */
    async loadPlayerConfig() {
        try {
            // 优先检查localStorage中是否有自定义角色数据
            const customPlayerData = localStorage.getItem('playerData');
            if (customPlayerData) {
                const customConfig = JSON.parse(customPlayerData);
                this.data = { ...this.data, ...customConfig };
                console.log('已加载自定义角色数据:', this.data.profile.name);
            } else {
                // 如果没有自定义数据，从配置文件加载
                const response = await fetch('data/player.json');
                if (response.ok) {
                    const config = await response.json();
                    this.data = { ...this.data, ...config };
                    console.log('已加载默认玩家配置');
                }
            }
        } catch (error) {
            console.warn('无法加载玩家配置文件，使用默认数据');
        }
        
        this.updateDisplay();
    }

    /**
     * 加载玩家数据（已禁用存档功能）
     */
    loadPlayerData() {
        // 不再从localStorage加载数据，直接使用配置文件
        console.log('玩家数据直接从配置文件加载，不使用存档');
    }

    /**
     * 保存玩家数据（已禁用存档功能）
     */
    savePlayerData() {
        // 不再保存到localStorage
        console.log('玩家数据保存功能已禁用，所有数据来自配置文件');
    }

    /**
     * 更新显示
     */
    updateDisplay() {
        // 更新人设信息
        document.getElementById('playerAvatar').src = this.data.profile.avatar;
        document.getElementById('playerName').textContent = this.data.profile.name;
        document.getElementById('playerAge').textContent = this.data.profile.age;
        document.getElementById('playerGender').textContent = this.data.profile.gender;
        document.getElementById('playerJob').textContent = this.data.profile.job;

        // 更新属性信息
        document.getElementById('playerLevel').textContent = this.data.stats.level;
        document.getElementById('playerHealth').textContent = 
            `${this.data.stats.health}/${this.data.stats.maxHealth}`;
        document.getElementById('playerAttack').textContent = this.data.stats.attack;
        document.getElementById('playerDefense').textContent = this.data.stats.defense;
        document.getElementById('playerSpeed').textContent = this.data.stats.speed;
    }

    /**
     * 设置玩家人设
     */
    setProfile(profile) {
        this.data.profile = { ...this.data.profile, ...profile };
        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
    }

    /**
     * 修改玩家属性
     */
    modifyStats(stats) {
        Object.keys(stats).forEach(key => {
            if (this.data.stats.hasOwnProperty(key)) {
                this.data.stats[key] += stats[key];
                
                // 确保生命值不超过最大值
                if (key === 'health') {
                    this.data.stats.health = Math.min(
                        this.data.stats.health, 
                        this.data.stats.maxHealth
                    );
                }
            }
        });
        
        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
    }

    /**
     * 设置玩家属性
     */
    setStats(stats) {
        this.data.stats = { ...this.data.stats, ...stats };
        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
    }

    /**
     * 增加经验值
     */
    addExperience(amount) {
        this.data.experience.current += amount;
        
        // 检查是否升级
        while (this.data.experience.current >= this.data.experience.required) {
            this.levelUp();
        }
        
        // 数据不再保存，仅在内存中修改
    }

    /**
     * 升级
     */
    levelUp() {
        this.data.experience.current -= this.data.experience.required;
        this.data.stats.level++;
        
        // 升级时增加属性
        const healthIncrease = Math.floor(Math.random() * 10) + 5;
        const attackIncrease = Math.floor(Math.random() * 3) + 1;
        const defenseIncrease = Math.floor(Math.random() * 2) + 1;
        const speedIncrease = Math.floor(Math.random() * 2);
        
        this.data.stats.maxHealth += healthIncrease;
        this.data.stats.health = this.data.stats.maxHealth; // 升级时恢复满血
        this.data.stats.attack += attackIncrease;
        this.data.stats.defense += defenseIncrease;
        this.data.stats.speed += speedIncrease;
        
        // 计算下一级所需经验
        this.data.experience.required = Math.floor(this.data.experience.required * 1.5);
        
        this.updateDisplay();
        
        // 显示升级提示
        this.showLevelUpNotification();
    }

    /**
     * 显示升级提示
     */
    showLevelUpNotification() {
        // 创建升级提示元素
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>恭喜升级！</h3>
                <p>等级: ${this.data.stats.level - 1} → ${this.data.stats.level}</p>
                <p>生命值上限增加，所有属性提升！</p>
            </div>
        `;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(45deg, #4a90e2, #357abd);
            color: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 2000;
            text-align: center;
            animation: levelUpAnimation 3s ease-in-out forwards;
        `;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes levelUpAnimation {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // 3秒后移除提示
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 3000);
    }

    /**
     * 获取当前生命值百分比
     */
    getHealthPercentage() {
        return (this.data.stats.health / this.data.stats.maxHealth) * 100;
    }

    /**
     * 获取金币数量
     */
    getGold() {
        return this.data.currency ? this.data.currency.gold : 0;
    }

    /**
     * 修改金币数量
     */
    modifyGold(amount) {
        if (!this.data.currency) {
            this.data.currency = { gold: 0 };
        }
        this.data.currency.gold += amount;
        // 确保金币不为负数
        this.data.currency.gold = Math.max(0, this.data.currency.gold);
        console.log(`金币变化: ${amount > 0 ? '+' : ''}${amount}，当前: ${this.data.currency.gold}`);
    }

    /**
     * 检查是否有足够金币
     */
    hasEnoughGold(amount) {
        return this.getGold() >= amount;
    }

    /**
     * 获取玩家数据
     */
    getData() {
        return this.data;
    }

    /**
     * 重置玩家数据（重新加载配置文件）
     */
    async reset() {
        // 重新从配置文件加载数据
        await this.loadPlayerConfig();
        console.log('玩家数据已从配置文件重置');
    }
}
