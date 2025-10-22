/**
 * 背包系统
 * 管理物品和装备
 */
class Inventory {
    constructor(player) {
        this.player = player;
        this.data = {
            // 装备槽位
            equipment: {
                head: null,      // 头部
                body: null,      // 上身
                legs: null,      // 下身
                hands: null,     // 手部
                feet: null,      // 脚部
                back: null,      // 背部
                leftHand: null,  // 左手武器
                rightHand: null  // 右手武器
            },
            // 物品列表
            items: []
        };
        
        this.maxItems = 50; // 最大物品数量
        this.loadInventoryData();
        this.updateDisplay();
        this.bindEvents();
    }

    /**
     * 加载背包数据（从玩家配置文件）
     */
    loadInventoryData() {
        // 从玩家配置中读取背包数据
        const playerData = this.player.getData();
        if (playerData && playerData.inventory) {
            this.data = { ...this.data, ...playerData.inventory };
            console.log('背包数据从玩家配置文件加载');
        } else {
            console.log('玩家配置中无背包数据，使用空背包');
        }
    }

    /**
     * 保存背包数据（已禁用存档功能）
     */
    saveInventoryData() {
        // 不再保存到localStorage，背包数据仅在内存中
        console.log('背包数据保存功能已禁用，所有数据来自配置文件');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 装备槽位点击事件
        document.querySelectorAll('.equipment-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const slotType = slot.dataset.slot;
                this.showEquipmentOptions(slotType);
            });
        });
    }

    /**
     * 添加物品
     */
    addItem(item) {
        if (this.data.items.length >= this.maxItems) {
            return { success: false, message: '背包已满！' };
        }

        // 检查是否已存在相同物品
        const existingItem = this.data.items.find(i => 
            i.id === item.id && i.stackable !== false
        );

        if (existingItem && existingItem.stackable !== false) {
            existingItem.quantity += item.quantity || 1;
        } else {
            this.data.items.push({
                ...item,
                quantity: item.quantity || 1
            });
        }

        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
        return { success: true, message: `获得 ${item.name}！` };
    }

    /**
     * 移除物品
     */
    removeItem(itemId, quantity = 1) {
        const itemIndex = this.data.items.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            return { success: false, message: '物品不存在！' };
        }

        const item = this.data.items[itemIndex];
        
        if (item.quantity <= quantity) {
            this.data.items.splice(itemIndex, 1);
        } else {
            item.quantity -= quantity;
        }

        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
        return { success: true, message: `使用 ${item.name}！` };
    }

    /**
     * 装备物品
     */
    equipItem(itemId, slotType) {
        const item = this.data.items.find(i => i.id === itemId);
        
        if (!item) {
            return { success: false, message: '物品不存在！' };
        }

        if (!item.equippable || !item.slots.includes(slotType)) {
            return { success: false, message: '该物品无法装备到此位置！' };
        }

        // 卸下当前装备
        const currentEquipped = this.data.equipment[slotType];
        if (currentEquipped) {
            this.addItem(currentEquipped);
        }

        // 装备新物品
        this.data.equipment[slotType] = item;
        this.removeItem(itemId, 1);
        
        // 应用装备属性加成
        this.applyEquipmentStats();
        
        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
        return { success: true, message: `装备了 ${item.name}！` };
    }

    /**
     * 卸下装备
     */
    unequipItem(slotType) {
        const equippedItem = this.data.equipment[slotType];
        
        if (!equippedItem) {
            return { success: false, message: '该位置没有装备！' };
        }

        // 检查背包是否有空间
        if (this.data.items.length >= this.maxItems) {
            return { success: false, message: '背包已满，无法卸下装备！' };
        }

        // 卸下装备
        this.addItem(equippedItem);
        this.data.equipment[slotType] = null;
        
        // 重新计算属性
        this.applyEquipmentStats();
        
        this.updateDisplay();
        // 数据不再保存，仅在内存中修改
        return { success: true, message: `卸下了 ${equippedItem.name}！` };
    }

    /**
     * 应用装备属性加成
     */
    applyEquipmentStats() {
        let totalBonus = {
            health: 0,
            maxHealth: 0,
            attack: 0,
            defense: 0,
            speed: 0
        };

        // 计算所有装备的属性加成
        Object.values(this.data.equipment).forEach(equipment => {
            if (equipment && equipment.stats) {
                Object.keys(equipment.stats).forEach(stat => {
                    if (totalBonus.hasOwnProperty(stat)) {
                        totalBonus[stat] += equipment.stats[stat];
                    }
                });
            }
        });

        // 更新玩家属性
        const playerStats = this.player.getData().stats;
        const newStats = {
            health: Math.max(1, playerStats.health + totalBonus.health),
            maxHealth: Math.max(1, playerStats.maxHealth + totalBonus.maxHealth),
            attack: Math.max(1, playerStats.attack + totalBonus.attack),
            defense: Math.max(1, playerStats.defense + totalBonus.defense),
            speed: Math.max(1, playerStats.speed + totalBonus.speed)
        };

        this.player.setStats(newStats);
    }

    /**
     * 显示装备选项
     */
    showEquipmentOptions(slotType) {
        const availableItems = this.data.items.filter(item => 
            item.equippable && item.slots.includes(slotType)
        );

        if (availableItems.length === 0) {
            // 如果没有可装备的物品，尝试卸下当前装备
            const currentEquipped = this.data.equipment[slotType];
            if (currentEquipped) {
                this.unequipItem(slotType);
            }
            return;
        }

        // 创建选择菜单
        const menu = document.createElement('div');
        menu.className = 'equipment-menu';
        menu.innerHTML = `
            <div class="menu-content">
                <h4>选择装备</h4>
                <div class="menu-items">
                    ${availableItems.map(item => `
                        <div class="menu-item" data-item-id="${item.id}">
                            <img src="${item.icon}" alt="${item.name}">
                            <span>${item.name}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="close-menu">关闭</button>
            </div>
        `;

        // 添加样式
        menu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            padding: 1rem;
            min-width: 300px;
        `;

        document.body.appendChild(menu);

        // 绑定事件
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemId = item.dataset.itemId;
                this.equipItem(itemId, slotType);
                document.body.removeChild(menu);
            });
        });

        menu.querySelector('.close-menu').addEventListener('click', () => {
            document.body.removeChild(menu);
        });

        // 点击背景关闭
        menu.addEventListener('click', (e) => {
            if (e.target === menu) {
                document.body.removeChild(menu);
            }
        });
    }

    /**
     * 更新显示
     */
    updateDisplay() {
        this.updateEquipmentDisplay();
        this.updateItemsDisplay();
    }

    /**
     * 更新装备显示
     */
    updateEquipmentDisplay() {
        Object.keys(this.data.equipment).forEach(slotType => {
            const slot = document.querySelector(`[data-slot="${slotType}"]`);
            const equipment = this.data.equipment[slotType];
            
            if (equipment) {
                slot.innerHTML = `
                    <img src="${equipment.icon}" alt="${equipment.name}">
                    <span>${equipment.name}</span>
                `;
                slot.classList.add('equipped');
            } else {
                slot.innerHTML = `
                    <img src="data/icons/empty.png" alt="空">
                    <span>${this.getSlotName(slotType)}</span>
                `;
                slot.classList.remove('equipped');
            }
        });
    }

    /**
     * 更新物品显示
     */
    updateItemsDisplay() {
        const itemsGrid = document.getElementById('itemsGrid');
        
        if (this.data.items.length === 0) {
            itemsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">背包为空</p>';
            return;
        }

        itemsGrid.innerHTML = this.data.items.map(item => `
            <div class="item-slot" data-item-id="${item.id}" title="${item.description || ''}">
                <img src="${item.icon}" alt="${item.name}">
                <div class="item-name">${item.name}</div>
                ${item.quantity > 1 ? `<div class="item-quantity">${item.quantity}</div>` : ''}
            </div>
        `).join('');

        // 绑定物品点击事件
        itemsGrid.querySelectorAll('.item-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const itemId = slot.dataset.itemId;
                this.showItemOptions(itemId);
            });
        });
    }

    /**
     * 显示物品选项
     */
    showItemOptions(itemId) {
        const item = this.data.items.find(i => i.id === itemId);
        if (!item) return;

        const options = [];
        
        if (item.equippable) {
            item.slots.forEach(slot => {
                options.push({
                    text: `装备到${this.getSlotName(slot)}`,
                    action: () => this.equipItem(itemId, slot)
                });
            });
        }

        if (item.usable) {
            options.push({
                text: '使用',
                action: () => this.useItem(itemId)
            });
        }

        options.push({
            text: '丢弃',
            action: () => this.dropItem(itemId)
        });

        if (options.length === 0) return;

        // 创建选项菜单
        const menu = document.createElement('div');
        menu.className = 'item-options-menu';
        menu.innerHTML = `
            <div class="menu-content">
                <h4>${item.name}</h4>
                <div class="menu-options">
                    ${options.map(option => `
                        <button class="option-btn" data-action="${option.text}">${option.text}</button>
                    `).join('')}
                </div>
                <button class="close-menu">关闭</button>
            </div>
        `;

        menu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            padding: 1rem;
            min-width: 250px;
        `;

        document.body.appendChild(menu);

        // 绑定事件
        options.forEach((option, index) => {
            const btn = menu.querySelectorAll('.option-btn')[index];
            btn.addEventListener('click', () => {
                option.action();
                document.body.removeChild(menu);
            });
        });

        menu.querySelector('.close-menu').addEventListener('click', () => {
            document.body.removeChild(menu);
        });
    }

    /**
     * 使用物品
     */
    useItem(itemId) {
        const item = this.data.items.find(i => i.id === itemId);
        if (!item || !item.usable) {
            return { success: false, message: '该物品无法使用！' };
        }

        // 应用物品效果
        if (item.effects) {
            this.player.modifyStats(item.effects);
        }

        // 移除物品
        this.removeItem(itemId, 1);
        
        return { success: true, message: `使用了 ${item.name}！` };
    }

    /**
     * 丢弃物品
     */
    dropItem(itemId) {
        const item = this.data.items.find(i => i.id === itemId);
        if (!item) return;

        if (confirm(`确定要丢弃 ${item.name} 吗？`)) {
            this.removeItem(itemId, 1);
        }
    }

    /**
     * 获取槽位名称
     */
    getSlotName(slotType) {
        const slotNames = {
            head: '头部',
            body: '上身',
            legs: '下身',
            hands: '手部',
            feet: '脚部',
            back: '背部',
            leftHand: '左手',
            rightHand: '右手'
        };
        return slotNames[slotType] || slotType;
    }

    /**
     * 获取背包数据
     */
    getData() {
        return this.data;
    }

    /**
     * 重置背包数据
     */
    reset() {
        this.data = {
            equipment: {
                head: null,
                body: null,
                legs: null,
                hands: null,
                feet: null,
                back: null,
                leftHand: null,
                rightHand: null
            },
            items: []
        };
        
        // 重新从玩家配置加载
        this.loadInventoryData();
        this.updateDisplay();
    }
}
