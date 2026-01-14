# GalgameMap 完整逻辑流程文档

## 📋 目录
1. [页面初始化流程](#页面初始化流程)
2. [状态存储机制](#状态存储机制)
3. [流式响应处理流程](#流式响应处理流程)
4. [按钮显示逻辑](#按钮显示逻辑)
5. [缓存恢复机制](#缓存恢复机制)
6. [关键状态说明](#关键状态说明)

---

## 页面初始化流程

### 1. GalgameMap.tsx 初始化

```
进入页面
  ↓
useEffect: 检查 sessionId 变化
  ↓
useEffect: 加载游戏数据 (gameData)
  ↓
useEffect: 恢复 eventData (从 sessionStorage)
  ↓
useEffect: 获取世界交互历史 (worldInteractionHistory)
  ↓
useEffect: 刷新活跃事件 (refreshEventData)
  ↓
根据 currentView 渲染对应视图
```

**关键代码位置：**
- `src/page/GalgameMap.tsx` 第 98-150 行：sessionId 检查
- `src/page/GalgameMap.tsx` 第 152-200 行：加载游戏数据
- `src/page/GalgameMap.tsx` 第 202-250 行：恢复 eventData
- `src/page/GalgameMap.tsx` 第 252-300 行：获取历史记录

### 2. InteractWithNpc 组件初始化

```
InteractWithNpc 组件挂载
  ↓
useInteractionInit Hook 执行
  ↓
检查本地缓存 (localStorage)
  ├─ 有缓存且 incomplete=true → 恢复缓存步骤
  ├─ 有 pendingRequest → 启动轮询
  └─ 无缓存 → 发起初始交互请求
  ↓
流式响应处理
  ↓
更新状态
```

**关键代码位置：**
- `src/hooks/mapGalgame/useInteractionInit.ts` 第 87-271 行：初始化逻辑

---

## 状态存储机制

### localStorage 存储键

**存储键格式：** `world-{type}-{sessionId}-{eventId}`

| 键名 | 类型 | 说明 | 存储时机 | 清除时机 |
|------|------|------|----------|----------|
| `allSteps` | `allsteps` | 所有步骤的 JSON 数组 | 流式响应过程中实时保存 | 步骤队列为空且无等待数据时 |
| `incomplete` | `allsteps-incomplete` | 标记缓存是否未完成 | 与 allSteps 同时设置 | 与 allSteps 同时清除 |
| `pendingRequest` | `pending-request` | 未完成的请求信息 | 发起请求时 | 请求完成或超时 |

**代码位置：**
- `src/hooks/mapGalgame/interactionUtils.ts` 第 163-167 行：存储键定义

### sessionStorage 存储（Zustand persist）

**存储内容：**
- `eventData`: 当前事件数据（EventData）
- `currentView`: 当前视图状态
- `selectedSubscene`: 选中的子场景
- `selectedScene`: 选中的场景
- `storedSessionId`: 存储的 sessionId（用于比对）

**代码位置：**
- `src/store/mapGalgameStore.ts` 第 104-114 行：持久化配置

### 状态存储时机

#### 1. 步骤缓存存储
```typescript
// 位置: src/hooks/mapGalgame/useWorldInteractionStep.ts
// 在流式响应过程中，每收到一个 step 就保存到 localStorage
processStreamResponse() {
  // 每收到一个 step
  setStepQueue(prev => {
    const newQueue = [...prev, step];
    // 保存到 localStorage
    safeSetLocalStorage(storageKeys.allSteps, JSON.stringify([currentStep, ...newQueue]));
    safeSetLocalStorage(storageKeys.incomplete, 'true');
    return newQueue;
  });
}
```

#### 2. 请求状态存储
```typescript
// 位置: src/components/GalgameMap/interactWithNpc.tsx
// 发起请求时保存 pendingRequest
handleInteract() {
  safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify({
    type: 'interact',
    timestamp: Date.now()
  }));
}

handleChoiceOption() {
  safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify({
    type: 'select-option',
    optionId: optionId,
    timestamp: Date.now()
  }));
}
```

#### 3. 缓存清除时机
```typescript
// 位置: src/components/GalgameMap/interactWithNpc.tsx 第 841-908 行
useEffect(() => {
  const shouldCleanCache = 
    queueEmpty && 
    !isWaitingForData && 
    !showNextButton && 
    !finalIsTyping;
  
  if (shouldCleanCache) {
    safeRemoveLocalStorage(storageKeys.allSteps);
    safeRemoveLocalStorage(storageKeys.incomplete);
    // 延迟 3 秒后刷新 active 事件
    setTimeout(() => refreshEventData(), 3000);
  }
}, [/* 依赖项 */]);
```

---

## 流式响应处理流程

### 1. 初始交互流程 (handleInteract)

```
用户点击/自动触发
  ↓
设置 pendingRequest 到 localStorage
  ↓
发起 /interact 请求
  ↓
processStreamResponse 处理流式响应
  ├─ onFirstStep: 清除 pendingRequest，设置 isWaitingForData=false
  ├─ 每收到一个 step: 添加到队列，保存到 localStorage
  └─ onSuccess: 
      ├─ 清除超时定时器
      ├─ 刷新 active 事件 (refreshEventData)
      └─ 更新属性 (onUpdateAttributes)
```

**关键代码位置：**
- `src/hooks/mapGalgame/useWorldInteractionStep.ts` 第 200-300 行：handleInteract
- `src/hooks/mapGalgame/useInteractionInit.ts` 第 204-221 行：onSuccess 回调

### 2. 选择选项流程 (handleChoiceOption)

```
用户选择选项
  ↓
设置 pendingRequest 到 localStorage
  ↓
设置超时定时器 (60秒)
  ↓
发起 /select-option 请求
  ↓
processStreamResponse 处理流式响应
  ├─ onFirstStep: 清除 pendingRequest，设置 isWaitingForData=false
  ├─ 每收到一个 step: 添加到队列，保存到 localStorage
  └─ onSuccess:
      ├─ 清除超时定时器
      ├─ 刷新 active 事件 (refreshEventData)
      └─ 清除 pendingRequest
```

**关键代码位置：**
- `src/components/GalgameMap/interactWithNpc.tsx` 第 1298-1320 行：handleChoiceOption

### 3. 流式响应解析 (processStreamResponse)

```
收到 SSE 数据
  ↓
解析 JSON 数据
  ├─ 包含 step → 添加到队列
  ├─ 包含 newEvent → 更新 newEvent 状态
  ├─ 包含 completedEvent → 更新 newEvent.completed
  └─ 流结束 → 触发 onSuccess
```

**关键代码位置：**
- `src/hooks/story/useStepStreamResponse.ts`：流式响应处理核心逻辑

---

## 按钮显示逻辑

### 1. "继续游戏" 按钮 (shouldShowContinueButton)

**显示条件：**
```typescript
const shouldShowContinueButton = useMemo(() => {
  // 1. 必须有 newEvent
  if (!newEvent) return false;
  
  // 2. newEvent 必须完整（有 event、npc、subscene）
  const hasFullNewEvent = !!(newEvent.event && newEvent.npc && newEvent.subscene);
  if (!hasFullNewEvent) return false;
  
  // 3. 状态条件
  const canShow = 
    !isWaitingForData &&
    !finalIsTyping &&
    !hasPendingRequest &&
    ((queueEmpty && !showNextButton) || (isChoiceStep && !showNextButton));
  
  return canShow;
}, [/* 依赖项 */]);
```

**代码位置：**
- `src/components/GalgameMap/interactWithNpc.tsx` 第 983-1033 行

**触发时机：**
- 流式响应完成后，收到 `newEvent` 数据
- 步骤队列为空且无等待数据

### 2. "开始下一回合" 按钮 (NextRoundButton)

**显示条件：**
```typescript
const shouldShow = 
  !isFirstTime &&                    // 不是第一次进入
  (!eventData || eventCompleted) &&  // 没有活跃事件或事件已完成
  !isLoading &&                      // 不在加载中
  (currentView !== INTERACT_NPC ||  // 不在 NPC 交互页面，或
   (eventCompleted && !isTypingInInteractNpc)); // 事件完成且不在打字中
```

**代码位置：**
- `src/page/GalgameMap.tsx` 第 715-726 行

**触发时机：**
- `refreshEventData` 返回 `eventsCount: 0`（没有活跃事件）
- 设置 `eventCompleted = true`

### 3. "下一步" 按钮 (showNextButton)

**显示条件：**
```typescript
// 在 useWorldInteractionStep.ts 中
const shouldShowNext = step.type !== "choice"; // 非选择步骤显示
setShowNextButton(shouldShowNext);

// 队列为空时隐藏
if (stepQueue.length === 0 && currentStep?.type !== "choice") {
  setShowNextButton(false);
}
```

**代码位置：**
- `src/hooks/mapGalgame/useWorldInteractionStep.ts` 第 121-126 行、第 135-142 行

---

## 缓存恢复机制

### 恢复流程

```
组件挂载
  ↓
useInteractionInit 执行
  ↓
检查 localStorage
  ├─ 有 allSteps 且 incomplete=true
  │   ↓
  │   解析步骤数组
  │   ↓
  │   恢复步骤队列
  │   ├─ 第一个步骤 → currentStep
  │   └─ 其余步骤 → stepQueue
  │   ↓
  │   设置 showNextButton
  │   ↓
  │   标记 isRestoringFromCache = true
  │   ↓
  │   1 秒后恢复为 false
  │
  ├─ 有 pendingRequest
  │   ↓
  │   检查请求年龄（< 5 分钟）
  │   ↓
  │   启动轮询 (useHistoryPolling)
  │   ↓
  │   等待匹配历史记录
  │
  └─ 无缓存
      ↓
      发起初始交互请求
```

**代码位置：**
- `src/hooks/mapGalgame/useInteractionInit.ts` 第 102-158 行：缓存恢复逻辑

### 轮询机制 (useHistoryPolling)

```
检测到 pendingRequest
  ↓
每 6 秒轮询一次历史记录
  ↓
匹配请求类型和选项 ID
  ├─ 找到匹配 → 触发 onMatchFound
  └─ 超时（60秒）→ 触发 onTimeout
```

**代码位置：**
- `src/hooks/mapGalgame/useHistoryPolling.ts`：轮询逻辑

---

## 关键状态说明

### 1. 组件状态 (InteractWithNpc)

| 状态 | 类型 | 说明 |
|------|------|------|
| `gameStarted` | boolean | 游戏是否已开始 |
| `isAutoPlay` | boolean | 是否自动播放 |
| `isTextMode` | boolean | 是否文本模式 |
| `completedSteps` | array | 已完成的步骤 |
| `hasPendingRequest` | boolean | 是否有待处理请求 |
| `isAttributesVisible` | boolean | 属性面板是否可见 |
| `isInventoryVisible` | boolean | 背包面板是否可见 |

### 2. 步骤状态 (useWorldInteractionStep)

| 状态 | 类型 | 说明 |
|------|------|------|
| `currentStep` | object | 当前显示的步骤 |
| `stepQueue` | array | 待显示的步骤队列 |
| `showNextButton` | boolean | 是否显示"下一步"按钮 |
| `isWaitingForData` | boolean | 是否等待数据 |
| `newEvent` | object | 新事件数据（用于"继续游戏"按钮） |

### 3. 全局状态 (useMapGalgameStore)

| 状态 | 类型 | 说明 |
|------|------|------|
| `eventData` | EventData | 当前事件数据 |
| `eventCompleted` | boolean | 事件是否完成（用于"开始下一回合"按钮） |
| `currentView` | MapViewState | 当前视图状态 |
| `isTypingInInteractNpc` | boolean | NPC 交互页面是否在打字 |

### 4. 状态同步时机

| 操作 | 触发状态更新 | 说明 |
|------|-------------|------|
| 流式响应开始 | `isWaitingForData = false` | onFirstStep 回调 |
| 流式响应完成 | `isWaitingForData = false`, `showNextButton = false` | onSuccess 回调 |
| 刷新 active 事件 | `eventData`, `eventCompleted` | refreshEventData |
| 步骤队列为空 | `showNextButton = false` | useEffect 监听 |

---

## 关键问题与解决方案

### 问题 1: 继续游戏按钮延迟显示

**原因：**
- `refreshEventData` 在流式响应完成后延迟 3 秒调用（缓存清理延迟）
- `newEvent` 状态更新不及时

**解决方案：**
- 在流式响应的 `onSuccess` 回调中立即调用 `refreshEventData`
- 确保 `newEvent` 在流式响应过程中及时更新

**代码位置：**
- `src/components/GalgameMap/interactWithNpc.tsx` 第 1305-1310 行
- `src/hooks/mapGalgame/useInteractionInit.ts` 第 216-220 行

### 问题 2: 开始下一回合按钮不显示

**原因：**
- 在 `INTERACT_NPC` 视图中，`refreshEventData` 返回时保留了 `eventData`，但没有设置 `eventCompleted = true`

**解决方案：**
- 即使保留 `eventData`，也要设置 `eventCompleted = true`

**代码位置：**
- `src/hooks/mapGalgame/useRefreshEventData.ts` 第 62-65 行

### 问题 3: 超时弹窗在数据返回后仍显示

**原因：**
- 定时器清除后，回调函数仍可能执行

**解决方案：**
- 在定时器回调中检查定时器是否仍存在
- 清除定时器时同时关闭弹窗

**代码位置：**
- `src/components/GalgameMap/interactWithNpc.tsx` 第 1282-1286 行
- `src/hooks/mapGalgame/useInteractionInit.ts` 第 193-198 行

---

## 优化建议

### 1. 减少状态耦合

**当前问题：**
- 多个状态相互依赖，修改一处可能影响其他功能

**建议：**
- 使用状态机模式管理复杂状态
- 将状态更新逻辑集中到统一的 reducer 中

### 2. 简化缓存逻辑

**当前问题：**
- 缓存存储和清除逻辑分散在多个地方

**建议：**
- 创建统一的缓存管理 Hook
- 统一管理所有 localStorage 操作

### 3. 优化按钮显示逻辑

**当前问题：**
- 按钮显示条件复杂，依赖多个状态

**建议：**
- 创建统一的按钮状态管理 Hook
- 使用状态机管理按钮显示状态

---

## 总结

整个系统的主要流程：

1. **初始化** → 检查缓存 → 恢复或发起请求
2. **流式响应** → 保存步骤 → 更新状态 → 触发回调
3. **状态同步** → 刷新 active 事件 → 更新按钮显示
4. **缓存管理** → 实时保存 → 完成后清除

关键是要理解：
- **状态存储时机**：流式响应过程中实时保存
- **状态恢复时机**：组件初始化时检查缓存
- **按钮显示时机**：依赖多个状态的组合判断
- **状态同步时机**：流式响应完成后立即刷新

