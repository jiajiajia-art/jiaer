/**
 * 场景系统
 * 管理游戏场景、建筑和NPC
 */
class Scene {
    constructor() {
        this.data = {
            currentScene: 'village_square', // 当前场景ID
            visitedScenes: ['village_square'] // 已访问的场景
        };
        
        this.scenes = {}; // 场景数据缓存
        this.loadSceneData();
        this.loadScenes();
    }

    /**
     * 加载场景数据
     */
    loadSceneData() {
        const savedData = localStorage.getItem('rpg_scene_data');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                this.data = { ...this.data, ...parsedData };
            } catch (error) {
                console.error('加载场景数据失败:', error);
            }
        }
    }

    /**
     * 保存场景数据
     */
    saveSceneData() {
        try {
            localStorage.setItem('rpg_scene_data', JSON.stringify(this.data));
        } catch (error) {
            console.error('保存场景数据失败:', error);
        }
    }

    /**
     * 加载场景配置
     */
    async loadScenes() {
        try {
            const response = await fetch('data/scenes.json');
            if (response.ok) {
                this.scenes = await response.json();
            } else {
                // 如果文件不存在，使用默认场景数据
                this.scenes = this.getDefaultScenes();
            }
        } catch (error) {
            console.warn('无法加载场景配置文件，使用默认数据');
            this.scenes = this.getDefaultScenes();
        }
        
        this.updateDisplay();

        // 场景加载完后尝试渲染大地图（如果可用）
        if (typeof window !== 'undefined' && typeof window.renderWorldMap === 'function') {
            window.renderWorldMap();
        }
    }

    /**
     * 获取默认场景数据（后备数据）
     */
    getDefaultScenes() {
        return {
            village_square: {
                id: 'village_square',
                name: '村庄广场',
                description: '这是一个宁静的村庄广场。请确保scenes.json文件存在。',
                background: 'data/scenes/village_square.png',
                buildings: [],
                npcs: [],
                events: [],
                exits: {}
            }
        };
    }

    /**
     * 切换到指定场景
     */
    changeScene(sceneId) {
        if (!this.scenes[sceneId]) {
            console.error('场景不存在:', sceneId);
            return false;
        }

        this.data.currentScene = sceneId;
        
        // 添加到已访问场景列表
        if (!this.data.visitedScenes.includes(sceneId)) {
            this.data.visitedScenes.push(sceneId);
        }

        this.updateDisplay();
        this.saveSceneData();
        
        // 触发场景切换事件
        this.onSceneChange(sceneId);
        
        return true;
    }

    /**
     * 场景切换回调
     */
    onSceneChange(sceneId) {
        const scene = this.scenes[sceneId];
        
        // 场景切换时不再自动触发事件
        console.log(`切换到场景: ${scene.name}`);
    }

    /**
     * 手动触发场景事件（奇闻轶事）
     */
    triggerSceneEvent() {
        const currentScene = this.getCurrentScene();
        
        if (!currentScene) {
            console.error('当前场景不存在');
            return;
        }

        // 从场景事件列表中随机选择一个事件
        if (currentScene.events && currentScene.events.length > 0) {
            const randomEvent = currentScene.events[Math.floor(Math.random() * currentScene.events.length)];
            
            if (window.game && window.game.event) {
                window.game.event.triggerEvent(randomEvent);
                console.log(`触发场景事件: ${randomEvent}`);
            }
        } else {
            alert('当前场景暂无奇闻轶事。');
        }
    }

    /**
     * 获取当前场景
     */
    getCurrentScene() {
        return this.scenes[this.data.currentScene];
    }

    /**
     * 获取指定场景
     */
    getScene(sceneId) {
        return this.scenes[sceneId];
    }

    /**
     * 获取所有场景（对象）
     */
    getAllScenes() {
        return this.scenes;
    }

    /**
     * 更新显示
     */
    updateDisplay() {
        const currentScene = this.getCurrentScene();
        
        if (!currentScene) {
            console.error('当前场景数据不存在');
            return;
        }

        // 更新场景标题和描述
        document.getElementById('sceneTitle').textContent = currentScene.name;
        document.getElementById('sceneDescription').textContent = currentScene.description;

        // 更新场景图片
        const sceneImageEl = document.getElementById('sceneImage');
        const sceneVisualWrap = document.querySelector('.scene-visual');
        if (sceneImageEl && sceneVisualWrap) {
            if (currentScene.background) {
                sceneImageEl.src = currentScene.background;
                sceneVisualWrap.style.display = '';
            } else {
                sceneImageEl.removeAttribute('src');
                sceneVisualWrap.style.display = 'none';
            }
        }

        // 更新建筑列表
        this.updateBuildingsDisplay(currentScene.buildings);

        // 更新NPC列表
        this.updateNPCsDisplay(currentScene.npcs);

        // 更新场景出口列表
        this.updateExitsDisplay(currentScene.exits);
    }

    /**
     * 更新建筑显示
     */
    updateBuildingsDisplay(buildings) {
        const buildingsList = document.getElementById('buildingsList');
        
        if (!buildingsList) {
            console.error('buildingsList 元素未找到');
            return;
        }
        
        if (!buildings || buildings.length === 0) {
            buildingsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">没有建筑</p>';
            return;
        }
        
        console.log('渲染建筑列表:', buildings.length, '个建筑');

        buildingsList.innerHTML = buildings.map(building => `
            <div class="building-card" data-building-id="${building.id}">
                <img src="${building.icon}" alt="${building.name}">
                <h4>${building.name}</h4>
                <p>${building.description}</p>
            </div>
        `).join('');

        // 绑定建筑点击事件
        buildingsList.querySelectorAll('.building-card').forEach(card => {
            card.addEventListener('click', () => {
                const buildingId = card.dataset.buildingId;
                this.interactWithBuilding(buildingId);
            });
        });
    }

    /**
     * 更新NPC显示
     */
    updateNPCsDisplay(npcs) {
        const npcsList = document.getElementById('npcsList');
        
        if (!npcsList) {
            console.error('npcsList 元素未找到');
            return;
        }
        
        if (!npcs || npcs.length === 0) {
            npcsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">没有NPC</p>';
            return;
        }
        
        console.log('渲染NPC列表:', npcs.length, '个NPC');

        npcsList.innerHTML = npcs.map(npc => `
            <div class="npc-card" data-npc-id="${npc.id}">
                <img src="${npc.icon}" alt="${npc.name}">
                <h4>${npc.name}</h4>
                <p>${npc.description}</p>
            </div>
        `).join('');

        // 绑定NPC点击事件
        npcsList.querySelectorAll('.npc-card').forEach(card => {
            card.addEventListener('click', () => {
                const npcId = card.dataset.npcId;
                this.interactWithNPC(npcId);
            });
        });
    }

    /**
     * 更新场景出口显示
     */
    updateExitsDisplay(exits) {
        const exitsList = document.getElementById('exitsList');
        
        if (!exitsList) {
            console.error('exitsList 元素未找到');
            return;
        }
        
        if (!exits || Object.keys(exits).length === 0) {
            exitsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">没有出口</p>';
            return;
        }

        console.log('渲染场景出口:', Object.keys(exits).length, '个出口');

        const directionNames = {
            north: '北方',
            south: '南方',
            east: '东方',
            west: '西方',
            northeast: '东北',
            northwest: '西北',
            southeast: '东南',
            southwest: '西南',
            up: '上方',
            down: '下方'
        };

        exitsList.innerHTML = Object.entries(exits).map(([direction, sceneId]) => {
            const targetScene = this.scenes[sceneId];
            if (!targetScene) return '';

            const directionText = directionNames[direction] || direction;
            
            return `
                <div class="exit-card" data-scene-id="${sceneId}">
                    <span class="exit-direction">${directionText}</span>
                    <h4>${targetScene.name}</h4>
                    <p>${targetScene.description ? targetScene.description.substring(0, 50) + '...' : '未知区域'}</p>
                </div>
            `;
        }).join('');

        // 绑定场景出口点击事件
        exitsList.querySelectorAll('.exit-card').forEach(card => {
            card.addEventListener('click', () => {
                const sceneId = card.dataset.sceneId;
                this.changeScene(sceneId);
            });
        });
    }

    /**
     * 与建筑交互
     */
    interactWithBuilding(buildingId) {
        const currentScene = this.getCurrentScene();
        const building = currentScene.buildings.find(b => b.id === buildingId);
        
        if (!building) {
            console.error('建筑不存在:', buildingId);
            return;
        }

        console.log(`与建筑交互: ${building.name}`);
        
        // 触发建筑功能事件（基于features动态生成）
        this.triggerFixedBuildingEvent(building, this.data.currentScene);
    }

    /**
     * 与NPC交互
     */
    interactWithNPC(npcId) {
        const currentScene = this.getCurrentScene();
        const npc = currentScene.npcs.find(n => n.id === npcId);
        
        if (!npc) {
            console.error('NPC不存在:', npcId);
            return;
        }

        console.log(`与NPC交互: ${npc.name}`);
        
        // 显示NPC详情弹窗
        this.showNPCDetailModal(npc, currentScene);
    }


    /**
     * 建筑点击：根据建筑features动态生成事件
     */
    triggerFixedBuildingEvent(building, sceneId) {
        if (!window.game || !window.game.event) return;

        // 如果建筑有features，动态生成事件
        if (building && building.features && Array.isArray(building.features) && building.features.length > 0) {
            this.showBuildingFeaturesEvent(building);
            return;
        }

        // 如果没有features，回退到原有事件查找逻辑
        const eventsMap = window.game.event.getAllEvents ? window.game.event.getAllEvents() : {};
        const candidates = [];
        if (building && building.eventId) candidates.push(building.eventId);
        if (building && building.id) {
            candidates.push(`${sceneId}_building_${building.id}`);
            candidates.push(`building_${building.id}`);
        }

        for (const id of candidates) {
            if (eventsMap && eventsMap[id]) {
                window.game.event.triggerEvent(id);
                return;
            }
        }

        console.warn('建筑没有配置 features 或 eventId');
    }

    /**
     * 显示建筑功能事件（基于features动态生成）
     */
    showBuildingFeaturesEvent(building) {
        const modal = document.getElementById('eventModal');
        const eventImage = document.getElementById('eventImage');
        const eventText = document.getElementById('eventText');
        const optionButtons = [
            document.getElementById('option1'),
            document.getElementById('option2'),
            document.getElementById('option3')
        ];

        // 设置事件图片和描述
        eventImage.src = building.icon || 'data/icons/empty.png';
        eventText.textContent = `${building.name}\n\n${building.description}\n\n可用功能：`;

        // 动态生成选项按钮（最多3个）
        const features = building.features.slice(0, 3);
        optionButtons.forEach((button, index) => {
            if (index < features.length) {
                button.textContent = features[index];
                button.style.display = 'block';
                
                // 移除旧的事件监听器
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                // 添加新的点击事件
                newButton.addEventListener('click', () => {
                    alert(`使用功能：${features[index]} - 成功！`);
                    modal.style.display = 'none';
                });
            } else {
                button.style.display = 'none';
            }
        });

        // 显示模态框
        modal.style.display = 'block';
    }


    /**
     * 显示NPC详情弹窗
     */
    showNPCDetailModal(npc, currentScene) {
        const modal = document.getElementById('npcModal');
        if (!modal) return;

        // 设置NPC基本信息
        document.getElementById('npcDetailAvatar').src = npc.icon || 'data/avatars/default.png';
        document.getElementById('npcDetailName').textContent = npc.name || '未知';
        document.getElementById('npcDetailJob').textContent = npc.job || npc.type || '未知';
        document.getElementById('npcDetailGender').textContent = npc.gender || '未知';
        document.getElementById('npcDetailAge').textContent = `${npc.age || '?'}岁`;
        document.getElementById('npcDetailDesc').textContent = npc.description || '暂无描述';

        // 渲染关系列表
        const relationshipsList = document.getElementById('npcRelationshipsList');
        if (npc.relationships && Object.keys(npc.relationships).length > 0) {
            const allNPCs = this.getAllNPCsFromAllScenes();
            
            relationshipsList.innerHTML = Object.entries(npc.relationships).map(([npcId, relation]) => {
                const relatedNPC = allNPCs[npcId];
                if (!relatedNPC) return '';
                
                return `
                    <div class="relationship-card">
                        <img src="${relatedNPC.icon || 'data/avatars/default.png'}" alt="${relatedNPC.name}">
                        <div class="relationship-name">${relatedNPC.name}</div>
                        <div class="relationship-type">${relation}</div>
                    </div>
                `;
            }).join('');
        } else {
            relationshipsList.innerHTML = '<p style="text-align: center; color: #999;">暂无人际关系</p>';
        }

        // 显示弹窗
        modal.style.display = 'block';

        // 绑定关闭按钮（移除旧监听器）
        const closeBtn = modal.querySelector('.close-npc-modal');
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // 绑定对话按钮
        const chatBtn = document.getElementById('chatWithNPCBtn');
        if (chatBtn) {
            const newChatBtn = chatBtn.cloneNode(true);
            chatBtn.parentNode.replaceChild(newChatBtn, chatBtn);
            
            newChatBtn.addEventListener('click', () => {
                this.openChatWithNPC(npc);
                modal.style.display = 'none';
            });
        }

        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    /**
     * 打开与NPC的对话
     */
    openChatWithNPC(npc) {
        // 设置当前聊天对象
        if (typeof window.setChatNPC === 'function') {
            window.setChatNPC(npc);
        }

        // 打开聊天面板
        const chatPanel = document.getElementById('chatPanel');
        if (chatPanel) {
            chatPanel.classList.add('show');
        }

        // 在聊天面板中添加系统消息
        if (typeof window.addChatMessage === 'function') {
            window.addChatMessage(`━━━ 开始与 ${npc.name}（${npc.job || npc.type}）对话 ━━━`, 'system');
            
            // 添加NPC的开场白
            setTimeout(() => {
                const greetings = [
                    `${npc.name}: "你好，冒险者！有什么我可以帮助你的吗？"`,
                    `${npc.name}: "欢迎！很高兴见到你。"`,
                    `${npc.name}: "你找我有什么事吗？"`,
                    `${npc.name}: "看起来你是个有趣的冒险者。"`
                ];
                const greeting = greetings[Math.floor(Math.random() * greetings.length)];
                window.addChatMessage(greeting, 'system');
            }, 500);
        }

        // 聚焦聊天输入框
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.focus();
        }
    }

    /**
     * 获取所有场景中的所有NPC（用于查找关系）
     */
    getAllNPCsFromAllScenes() {
        const allNPCs = {};
        Object.values(this.scenes).forEach(scene => {
            if (scene.npcs && Array.isArray(scene.npcs)) {
                scene.npcs.forEach(npc => {
                    allNPCs[npc.id] = npc;
                });
            }
        });
        return allNPCs;
    }


    /**
     * 获取场景数据
     */
    getData() {
        return this.data;
    }

    /**
     * 重置场景数据
     */
    reset() {
        this.data = {
            currentScene: 'village_square',
            visitedScenes: ['village_square']
        };
        
        this.saveSceneData();
        this.updateDisplay();
    }
}
