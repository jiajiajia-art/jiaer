/**
 * 主入口文件
 * 处理页面加载和用户交互
 */

// 全局变量
let game = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化游戏...');
    
    // 创建游戏实例
    game = new Game();
    
    // 绑定导航按钮事件
    bindNavigationEvents();
    
    // 绑定其他UI事件
    bindUIEvents();
    
    console.log('游戏初始化完成');
});

/**
 * 绑定导航按钮事件
 */
function bindNavigationEvents() {
    const navButtons = {
        sceneBtn: 'scenePanel',
        mapBtn: 'mapPanel'
    };

    Object.keys(navButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        const panelId = navButtons[buttonId];
        
        if (button && panelId) {
            button.addEventListener('click', () => {
                switchPanel(panelId);
            });
        }
    });
}

/**
 * 切换面板
 */
function switchPanel(targetPanelId) {
    // 隐藏所有面板
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // 移除所有导航按钮的激活状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示目标面板
    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    // 激活对应的导航按钮
    const buttonMapping = {
        'scenePanel': 'sceneBtn',
        'mapPanel': 'mapBtn'
    };
    
    const targetButton = document.getElementById(buttonMapping[targetPanelId]);
    if (targetButton) {
        targetButton.classList.add('active');
    }

    // 如果切到大地图，刷新渲染
    if (targetPanelId === 'mapPanel') {
        renderWorldMap();
    }
}

/**
 * 绑定其他UI事件
 */
function bindUIEvents() {
    // 键盘快捷键
    document.addEventListener('keydown', handleKeyboard);
    
    // 添加调试功能（开发模式下）
    if (isDevelopmentMode()) {
        addDebugFeatures();
    }

    // 角色和背包已移至悬浮面板

    // 渲染大地图
    renderWorldMap();

    // 绑定聊天面板事件
    bindChatEvents();

    // 绑定背包悬浮面板事件
    bindInventoryFloatingEvents();

    // 绑定角色悬浮面板事件
    bindPlayerFloatingEvents();

    // 绑定世界观悬浮面板事件
    bindLoreFloatingEvents();

    // 绑定场景事件按钮
    bindSceneEventButton();

    // 初始化游戏时间显示
    initGameTime();
}

/**
 * 处理键盘事件
 */
function handleKeyboard(event) {
    // 避免在输入框中触发快捷键
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(event.key) {
        case '1':
        case 'Digit1': {
            // 切换背包悬浮面板
            const inventoryPanel = document.getElementById('inventoryFloatingPanel');
            if (inventoryPanel) {
                inventoryPanel.classList.toggle('show');
            }
            event.preventDefault();
            break;
        }
        case '2':
        case 'Digit2': {
            // 切换角色悬浮面板
            const playerPanel = document.getElementById('playerFloatingPanel');
            if (playerPanel) {
                playerPanel.classList.toggle('show');
            }
            event.preventDefault();
            break;
        }
        case '3':
        case 'Digit3': {
            switchPanel('mapPanel');
            event.preventDefault();
            break;
        }
        case 'Escape':
            // 关闭任何打开的模态框
            const modal = document.getElementById('eventModal');
            if (modal && modal.style.display === 'block') {
                game.getEvent().closeEvent();
            }
            break;
    }
}

/**
 * 检查是否为开发模式
 */
function isDevelopmentMode() {
    // 可以通过URL参数、localStorage或其他方式判断
    return window.location.search.includes('debug=true') || 
           localStorage.getItem('debug_mode') === 'true';
}

/**
 * 添加调试功能
 */
function addDebugFeatures() {
    console.log('开发模式已启用，添加调试功能...');
    
    // 添加调试按钮到页面
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.innerHTML = `
        <div class="debug-controls">
            <h4>调试控制</h4>
            <button onclick="game.addTestItems()">添加测试物品</button>
            <button onclick="game.quickLevelUp()">快速升级</button>
            <button onclick="game.healPlayer()">恢复生命值</button>
            <button onclick="game.triggerRandomEvent()">触发随机事件</button>
            <button onclick="game.showDebugInfo()">显示调试信息</button>
            <button onclick="game.resetGame()">重置游戏</button>
        </div>
    `;
    
    // 添加调试面板样式
    const debugStyles = `
        <style>
            #debug-panel {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-size: 12px;
                z-index: 9999;
                max-width: 200px;
            }
            .debug-controls button {
                display: block;
                width: 100%;
                margin: 2px 0;
                padding: 5px;
                font-size: 11px;
                background: #333;
                color: white;
                border: 1px solid #555;
                border-radius: 3px;
                cursor: pointer;
            }
            .debug-controls button:hover {
                background: #555;
            }
            .debug-controls h4 {
                margin: 0 0 5px 0;
                text-align: center;
                color: #ffd700;
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', debugStyles);
    document.body.appendChild(debugPanel);
}

/**
 * 显示通知消息
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        animation: notificationSlideIn 0.3s ease-out;
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes notificationSlideIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // 3秒后移除通知
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
 * 全局错误处理
 */
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    showNotification('发生了一个错误，请检查控制台', 'error');
});


// 全局变量：当前对话的NPC
let currentChatNPC = null;

/**
 * 设置当前聊天对象
 */
function setChatNPC(npc) {
    currentChatNPC = npc;
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle && npc) {
        chatTitle.textContent = `与 ${npc.name} 对话`;
    } else if (chatTitle) {
        chatTitle.textContent = '聊天';
    }
}

/**
 * 绑定聊天面板事件
 */
function bindChatEvents() {
    const toggleBtn = document.getElementById('toggleChatBtn');
    const chatPanel = document.getElementById('chatPanel');
    const closeBtn = document.getElementById('closeChatBtn');
    const sendBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    // 切换聊天面板显示/隐藏
    toggleBtn.addEventListener('click', () => {
        chatPanel.classList.toggle('show');
        if (chatPanel.classList.contains('show')) {
            chatInput.focus();
        }
    });

    // 关闭聊天面板
    closeBtn.addEventListener('click', () => {
        chatPanel.classList.remove('show');
    });

    // 发送消息
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addChatMessage(message, 'user');
            chatInput.value = '';
            
            // 如果有对话NPC，显示NPC回复
            if (currentChatNPC) {
                setTimeout(() => {
                    const npcName = currentChatNPC.name;
                    addChatMessage(`${npcName}: "我明白了，让我想想..."`, 'system');
                }, 500);
            } else {
                // 普通聊天回复
                setTimeout(() => {
                    addChatMessage('收到您的消息：' + message, 'system');
                }, 500);
            }
        }
    }

    // 点击发送按钮
    sendBtn.addEventListener('click', sendMessage);

    // 按回车发送
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

/**
 * 添加聊天消息
 */
function addChatMessage(message, type = 'system') {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    
    // 自动滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 绑定场景事件按钮
 */
function bindSceneEventButton() {
    const eventBtn = document.getElementById('triggerSceneEventBtn');
    if (eventBtn) {
        eventBtn.addEventListener('click', () => {
            if (window.game && window.game.scene) {
                window.game.scene.triggerSceneEvent();
            }
        });
    }
}

/**
 * 绑定世界观悬浮面板事件
 */
function bindLoreFloatingEvents() {
    const toggleBtn = document.getElementById('toggleLoreBtn');
    const lorePanel = document.getElementById('lorePanel');
    const closeBtn = document.getElementById('closeLoreBtn');

    if (!toggleBtn || !lorePanel || !closeBtn) {
        console.warn('世界观悬浮面板元素未找到');
        return;
    }

    // 切换世界观面板显示/隐藏
    toggleBtn.addEventListener('click', () => {
        lorePanel.classList.toggle('show');
        // 首次打开时加载世界观数据
        if (lorePanel.classList.contains('show') && !lorePanel.dataset.loaded) {
            loadLoreData();
            lorePanel.dataset.loaded = 'true';
        }
    });

    // 关闭世界观面板
    closeBtn.addEventListener('click', () => {
        lorePanel.classList.remove('show');
    });
}

/**
 * 加载世界观数据
 */
async function loadLoreData() {
    try {
        const response = await fetch('data/lore.json');
        if (response.ok) {
            const loreData = await response.json();
            displayLoreData(loreData);
        } else {
            displayDefaultLore();
        }
    } catch (error) {
        console.warn('无法加载世界观配置文件，使用默认数据');
        displayDefaultLore();
    }
}

/**
 * 显示世界观数据
 */
function displayLoreData(loreData) {
    // 显示世界背景
    const worldLoreContent = document.getElementById('worldLoreContent');
    if (worldLoreContent && loreData.worldBackground) {
        worldLoreContent.innerHTML = loreData.worldBackground.content
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
    }

    // 显示主角故事
    const playerLoreContent = document.getElementById('playerLoreContent');
    if (playerLoreContent && loreData.playerStory) {
        playerLoreContent.innerHTML = loreData.playerStory.content
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
    }
}

/**
 * 显示默认世界观
 */
function displayDefaultLore() {
    const worldLoreContent = document.getElementById('worldLoreContent');
    if (worldLoreContent) {
        worldLoreContent.innerHTML = '<p>这是一个充满魔法与冒险的世界...</p>';
    }

    const playerLoreContent = document.getElementById('playerLoreContent');
    if (playerLoreContent) {
        playerLoreContent.innerHTML = '<p>你是一位初出茅庐的冒险者...</p>';
    }
}

/**
 * 绑定角色悬浮面板事件
 */
function bindPlayerFloatingEvents() {
    const toggleBtn = document.getElementById('togglePlayerBtn');
    const playerPanel = document.getElementById('playerFloatingPanel');
    const closeBtn = document.getElementById('closePlayerBtn');

    if (!toggleBtn || !playerPanel || !closeBtn) {
        console.warn('角色悬浮面板元素未找到');
        return;
    }

    // 切换角色面板显示/隐藏
    toggleBtn.addEventListener('click', () => {
        playerPanel.classList.toggle('show');
    });

    // 关闭角色面板
    closeBtn.addEventListener('click', () => {
        playerPanel.classList.remove('show');
    });
}

/**
 * 绑定背包悬浮面板事件
 */
function bindInventoryFloatingEvents() {
    const toggleBtn = document.getElementById('toggleInventoryBtn');
    const inventoryPanel = document.getElementById('inventoryFloatingPanel');
    const closeBtn = document.getElementById('closeInventoryBtn');

    if (!toggleBtn || !inventoryPanel || !closeBtn) {
        console.warn('背包悬浮面板元素未找到');
        return;
    }

    // 切换背包面板显示/隐藏
    toggleBtn.addEventListener('click', () => {
        inventoryPanel.classList.toggle('show');
    });

    // 关闭背包面板
    closeBtn.addEventListener('click', () => {
        inventoryPanel.classList.remove('show');
    });
}

// 导出一些全局函数供调试使用
window.game = null; // 将在Game类中设置
window.showNotification = showNotification;
window.switchPanel = switchPanel;
window.addChatMessage = addChatMessage;
window.setChatNPC = setChatNPC;

/**
 * 渲染大地图（场景关系图）
 */
function renderWorldMap() {
    if (!window.game || !window.game.scene) return;

    const scenes = window.game.scene.getAllScenes() || {};
    const sceneList = Object.values(scenes);
    if (!sceneList.length) return;

    // 计算场景位置（使用力导向布局的简化版）
    const positions = calculateScenePositions(scenes);

    // 渲染连接线
    renderConnections(scenes, positions);

    // 渲染场景节点
    renderSceneNodes(scenes, positions);

    // 绑定重置视图按钮
    const resetBtn = document.getElementById('resetMapView');
    if (resetBtn) {
        resetBtn.onclick = () => renderWorldMap();
    }
}

/**
 * 计算场景位置
 */
function calculateScenePositions(scenes) {
    const positions = {};
    const sceneIds = Object.keys(scenes);
    
    // 使用网格布局算法
    const gridSize = Math.ceil(Math.sqrt(sceneIds.length));
    const cellWidth = 1000 / (gridSize + 1);
    const cellHeight = 800 / (gridSize + 1);
    
    sceneIds.forEach((id, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        positions[id] = {
            x: (col + 1) * cellWidth,
            y: (row + 1) * cellHeight
        };
    });

    // 优化位置：将有连接的场景放得更近
    optimizePositions(scenes, positions);

    return positions;
}

/**
 * 优化场景位置（基于连接关系）
 */
function optimizePositions(scenes, positions) {
    const directionOffsets = {
        north: { x: 0, y: -150 },
        south: { x: 0, y: 150 },
        east: { x: 150, y: 0 },
        west: { x: -150, y: 0 },
        northeast: { x: 120, y: -120 },
        northwest: { x: -120, y: -120 },
        southeast: { x: 120, y: 120 },
        southwest: { x: -120, y: 120 }
    };

    // 从第一个场景开始，根据方向关系调整位置
    const visited = new Set();
    const queue = [Object.keys(scenes)[0]];
    
    // 设置起始场景在中心
    if (queue[0]) {
        positions[queue[0]] = { x: 500, y: 400 };
    }

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const scene = scenes[currentId];
        const currentPos = positions[currentId];

        if (scene.exits) {
            Object.entries(scene.exits).forEach(([direction, targetId]) => {
                if (!visited.has(targetId) && scenes[targetId]) {
                    const offset = directionOffsets[direction] || { x: 100, y: 100 };
                    positions[targetId] = {
                        x: currentPos.x + offset.x,
                        y: currentPos.y + offset.y
                    };
                    queue.push(targetId);
                }
            });
        }
    }
}

/**
 * 渲染连接线
 */
function renderConnections(scenes, positions) {
    const connectionsGroup = document.getElementById('mapConnections');
    if (!connectionsGroup) return;

    let html = '';
    const drawnConnections = new Set();

    Object.entries(scenes).forEach(([sceneId, scene]) => {
        if (!scene.exits) return;

        const startPos = positions[sceneId];
        if (!startPos) return;

        Object.entries(scene.exits).forEach(([direction, targetId]) => {
            const endPos = positions[targetId];
            if (!endPos) return;

            // 避免重复绘制双向连接
            const connectionKey = [sceneId, targetId].sort().join('-');
            if (drawnConnections.has(connectionKey)) return;
            drawnConnections.add(connectionKey);

            // 绘制连接线
            html += `<line class="connection-line" 
                x1="${startPos.x}" y1="${startPos.y}" 
                x2="${endPos.x}" y2="${endPos.y}" />`;
        });
    });

    connectionsGroup.innerHTML = html;
}

/**
 * 渲染场景节点
 */
function renderSceneNodes(scenes, positions) {
    const nodesGroup = document.getElementById('mapNodes');
    if (!nodesGroup) return;

    const currentSceneId = window.game.scene.getData().currentScene;

    let html = '';
    Object.entries(scenes).forEach(([sceneId, scene]) => {
        const pos = positions[sceneId];
        if (!pos) return;

        const isCurrent = sceneId === currentSceneId;
        const radius = isCurrent ? 50 : 40;
        const strokeColor = isCurrent ? '#e74c3c' : '#4a90e2';
        const strokeWidth = isCurrent ? 4 : 3;

        // 使用clipPath创建圆形裁剪区域
        const clipId = `clip-${sceneId}`;
        
        html += `
            <defs>
                <clipPath id="${clipId}">
                    <circle cx="${pos.x}" cy="${pos.y}" r="${radius}" />
                </clipPath>
            </defs>
            <g class="scene-node" data-scene-id="${sceneId}">
                <!-- 场景图片 -->
                <image 
                    href="${scene.background || 'data/icons/empty.png'}" 
                    x="${pos.x - radius}" 
                    y="${pos.y - radius}" 
                    width="${radius * 2}" 
                    height="${radius * 2}" 
                    clip-path="url(#${clipId})"
                    preserveAspectRatio="xMidYMid slice" />
                <!-- 圆形边框 -->
                <circle class="node-circle" 
                    cx="${pos.x}" cy="${pos.y}" r="${radius}" 
                    fill="none"
                    stroke="${strokeColor}"
                    stroke-width="${strokeWidth}" />
                <!-- 半透明遮罩和文字背景 -->
                <circle 
                    cx="${pos.x}" cy="${pos.y}" r="${radius}" 
                    fill="rgba(0,0,0,0.4)" />
                <!-- 场景名称 -->
                <text class="node-text" 
                    x="${pos.x}" y="${pos.y + 5}">
                    ${scene.name.length > 4 ? scene.name.substring(0, 4) : scene.name}
                </text>
                <!-- 当前标记 -->
                ${isCurrent ? `<text class="node-label" x="${pos.x}" y="${pos.y + radius + 20}" fill="#e74c3c" font-weight="bold">● 当前</text>` : ''}
            </g>
        `;
    });

    nodesGroup.innerHTML = html;

    // 绑定点击事件 - 显示场景详情
    nodesGroup.querySelectorAll('.scene-node').forEach(node => {
        node.addEventListener('click', () => {
            const sceneId = node.getAttribute('data-scene-id');
            if (sceneId && scenes[sceneId]) {
                showSceneDetailModal(scenes[sceneId]);
            }
        });
    });
}

/**
 * 显示场景详情弹窗
 */
function showSceneDetailModal(scene) {
    const modal = document.getElementById('sceneDetailModal');
    if (!modal) return;

    // 设置场景信息
    document.getElementById('sceneDetailImage').src = scene.background || 'data/icons/empty.png';
    document.getElementById('sceneDetailName').textContent = scene.name || '未知场景';
    document.getElementById('sceneDetailDesc').textContent = scene.description || '暂无描述';

    // 计算旅行费用（基于场景复杂度）
    const travelCost = calculateTravelCost(scene);
    document.getElementById('travelCost').textContent = travelCost;

    // 显示玩家当前金币
    const playerGold = window.game.player.getGold();
    document.getElementById('playerGoldDisplay').textContent = playerGold;

    // 显示弹窗
    modal.style.display = 'block';

    // 绑定关闭按钮
    const closeBtn = modal.querySelector('.close-scene-modal');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // 绑定前往按钮
    const goBtn = document.getElementById('goToSceneBtn');
    if (goBtn) {
        const newGoBtn = goBtn.cloneNode(true);
        goBtn.parentNode.replaceChild(newGoBtn, goBtn);
        
        // 检查是否是当前场景
        const currentSceneId = window.game.scene.getData().currentScene;
        if (scene.id === currentSceneId) {
            newGoBtn.textContent = '✓ 当前所在场景';
            newGoBtn.disabled = true;
            newGoBtn.style.background = '#95a5a6';
            newGoBtn.style.cursor = 'not-allowed';
        } else {
            newGoBtn.addEventListener('click', () => {
                // 检查金币是否足够
                if (!window.game.player.hasEnoughGold(travelCost)) {
                    alert(`金币不足！需要 ${travelCost} 金币，你只有 ${playerGold} 金币。`);
                    return;
                }

                // 扣除金币
                window.game.player.modifyGold(-travelCost);
                
                // 跳转场景
                window.game.scene.changeScene(scene.id);
                modal.style.display = 'none';
                switchPanel('scenePanel');
                
                // 显示通知
                if (typeof showNotification === 'function') {
                    showNotification(`已前往 ${scene.name}，花费 ${travelCost} 金币`, 'success');
                }
            });
        }
    }

    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

/**
 * 计算旅行费用
 */
function calculateTravelCost(scene) {
    // 基础费用
    let cost = 10;
    
    // 根据场景特征调整费用
    if (scene.buildings && scene.buildings.length > 3) {
        cost += 5; // 建筑多的场景费用更高
    }
    
    if (scene.npcs && scene.npcs.length > 2) {
        cost += 5; // NPC多的场景费用更高
    }
    
    // 特殊场景费用
    if (scene.type === 'dangerous') {
        cost += 10;
    } else if (scene.type === 'safe') {
        cost -= 5;
    }
    
    return Math.max(5, cost); // 最低5金币
}

/**
 * 初始化游戏时间
 */
async function initGameTime() {
    try {
        const response = await fetch('data/lore.json');
        if (response.ok) {
            const loreData = await response.json();
            if (loreData.gameTime) {
                displayGameTime(loreData.gameTime);
            } else {
                displayDefaultGameTime();
            }
        } else {
            displayDefaultGameTime();
        }
    } catch (error) {
        console.warn('无法加载游戏时间配置，使用默认时间');
        displayDefaultGameTime();
    }
}

/**
 * 显示游戏时间
 */
function displayGameTime(gameTimeData) {
    const display = document.getElementById('gameTimeDisplay');
    if (!display) return;

    const { currentYear, yearName, currentMonth, currentDay, monthNames, season } = gameTimeData;
    const monthName = monthNames[currentMonth - 1] || '未知月';
    
    // 格式：和平纪元 580年 初春月 15日 (春季)
    const timeText = `${yearName} ${currentYear}年 ${monthName} ${currentDay}日 (${season})`;
    display.textContent = timeText;
}

/**
 * 显示默认游戏时间
 */
function displayDefaultGameTime() {
    const display = document.getElementById('gameTimeDisplay');
    if (display) {
        display.textContent = '纪元元年 一月 1日';
    }
}
