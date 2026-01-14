# 按钮显示条件说明

## 🔵 "继续游戏" 按钮 (ContinueButton)

**位置：** `src/components/GalgameMap/interactWithNpc.tsx` 第 983-1037 行

### 显示条件（必须全部满足）

#### 1. 必须有 newEvent 数据
```typescript
const newEvent = stepHandlers.newEvent;
if (!newEvent) return false; // ❌ 没有 newEvent，不显示
```

#### 2. newEvent 必须完整（包含三个字段）
```typescript
const hasFullNewEvent = !!(
  newEvent.event &&    // ✅ 必须有 event 对象
  newEvent.npc &&      // ✅ 必须有 npc 对象
  newEvent.subscene    // ✅ 必须有 subscene 对象
);
if (!hasFullNewEvent) return false; // ❌ 不完整，不显示
```

#### 3. 状态条件（必须全部满足）
```typescript
const canShow = 
  !stepHandlers.isWaitingForData &&  // ✅ 不在等待数据
  !finalIsTyping &&                  // ✅ 不在打字中
  !hasPendingRequest &&              // ✅ 没有待处理请求
  (
    (queueEmpty && !stepHandlers.showNextButton) ||  // 队列为空且不显示下一步按钮
    (isChoiceStep && !stepHandlers.showNextButton)   // 或者是选择步骤且不显示下一步按钮
  );
```

**详细条件说明：**

| 条件 | 说明 | 代码位置 |
|------|------|----------|
| `!isWaitingForData` | 不在等待流式响应数据 | `useWorldInteractionStep.ts` |
| `!finalIsTyping` | 打字机效果已完成 | `interactWithNpc.tsx` |
| `!hasPendingRequest` | 没有待处理的请求（localStorage 中的 pendingRequest） | `interactWithNpc.tsx` |
| `queueEmpty` | 步骤队列为空 | `useWorldInteractionStep.ts` |
| `!showNextButton` | 不显示"下一步"按钮 | `useWorldInteractionStep.ts` |
| `isChoiceStep` | 当前步骤是选择类型 | `useWorldInteractionStep.ts` |

### newEvent 数据来源

`newEvent` 是在流式响应过程中从后端返回的数据，包含：
- `event`: 新的事件对象
- `npc`: NPC 信息
- `subscene`: 子场景信息

**数据设置时机：**
- 流式响应过程中，当收到 `newEvent` 或 `completedEvent` 时设置
- 代码位置：`src/hooks/mapGalgame/useWorldInteractionStep.ts` 第 250-295 行

---

## 🟢 "开始下一回合" 按钮 (NextRoundButton)

**位置：** `src/page/GalgameMap.tsx` 第 713-738 行

### 显示条件（必须全部满足）

#### 1. 基础条件
```typescript
const isFirstTime = 
  worldInteractionHistory && 
  worldInteractionHistory.interactions.length === 0;

const baseCondition = 
  !isFirstTime &&                    // ✅ 不是第一次进入（有历史记录）
  (!eventData || eventCompleted) && // ✅ 没有活跃事件 或 事件已完成
  !isLoading;                        // ✅ 不在加载中
```

#### 2. 视图条件
```typescript
const shouldShow = 
  baseCondition &&
  (
    currentView !== MapViewState.INTERACT_NPC ||  // 不在 NPC 交互页面
    (eventCompleted && !isTypingInInteractNpc)    // 或 在 NPC 交互页面但事件完成且不在打字中
  );
```

**详细条件说明：**

| 条件 | 说明 | 设置时机 |
|------|------|----------|
| `!isFirstTime` | 不是第一次进入（有历史交互记录） | 从 `worldInteractionHistory` 判断 |
| `!eventData` | 没有活跃事件数据 | `refreshEventData` 返回 `eventsCount: 0` 时设置 `eventData = null` |
| `eventCompleted` | 事件已完成标志 | `refreshEventData` 返回 `eventsCount: 0` 时设置 `eventCompleted = true` |
| `!isLoading` | 不在加载游戏数据 | `GalgameMap.tsx` 状态 |
| `currentView !== INTERACT_NPC` | 不在 NPC 交互页面 | 或 |
| `eventCompleted && !isTypingInInteractNpc` | 事件完成且不在打字中 | 在 NPC 交互页面时 |

### eventCompleted 设置时机

**设置 `eventCompleted = true` 的情况：**

1. **有活跃事件时：**
   ```typescript
   if (activeEventsResponse.data.events.length > 0) {
     setEventCompleted(false);  // 有活跃事件，设置为 false
     setEventData(newEventData);
   }
   ```

2. **没有活跃事件时：**
   ```typescript
   if (activeEventsResponse.data.events.length === 0) {
     // 在 INTERACT_NPC 视图且已有 eventData，保留 eventData 但设置 eventCompleted = true
     if (currentView === MapViewState.INTERACT_NPC && currentEventData) {
       setEventCompleted(true);  // ✅ 设置完成标志
       return;
     }
     setEventData(null);
     setEventCompleted(true);  // ✅ 设置完成标志
   }
   ```

**代码位置：** `src/hooks/mapGalgame/useRefreshEventData.ts` 第 46-72 行

---

## 📊 两个按钮的关系

### 显示场景对比

| 场景 | 继续游戏按钮 | 开始下一回合按钮 | 说明 |
|------|-------------|----------------|------|
| 流式响应完成，有 newEvent | ✅ 显示 | ❌ 不显示 | 可以继续当前事件 |
| 流式响应完成，无 newEvent，无活跃事件 | ❌ 不显示 | ✅ 显示 | 当前事件已完成，可以开始下一回合 |
| 流式响应完成，无 newEvent，有活跃事件 | ❌ 不显示 | ❌ 不显示 | 有活跃事件但 newEvent 未设置（异常情况） |
| 流式响应进行中 | ❌ 不显示 | ❌ 不显示 | 等待响应完成 |
| 第一次进入（无历史） | ❌ 不显示 | ❌ 不显示 | 显示开场白 |

### 数据流关系

```
流式响应完成
  ↓
refreshEventData() 被调用
  ↓
检查后端是否有活跃事件
  ├─ 有活跃事件 (eventsCount > 0)
  │   ↓
  │   设置 eventData = newEventData
  │   设置 eventCompleted = false
  │   ↓
  │   如果流式响应中返回了 newEvent
  │   → 显示"继续游戏"按钮 ✅
  │
  └─ 无活跃事件 (eventsCount === 0)
      ↓
      设置 eventCompleted = true
      (保留或清除 eventData)
      ↓
      显示"开始下一回合"按钮 ✅
```

---

## 🔍 调试技巧

### 检查"继续游戏"按钮不显示的原因

1. **检查 newEvent：**
   ```javascript
   console.log('newEvent:', stepHandlers.newEvent);
   // 应该包含: { event: {...}, npc: {...}, subscene: {...} }
   ```

2. **检查状态：**
   ```javascript
   console.log({
     isWaitingForData: stepHandlers.isWaitingForData,  // 应该是 false
     finalIsTyping,                                    // 应该是 false
     hasPendingRequest,                                // 应该是 false
     queueEmpty: !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0,  // 应该是 true
     showNextButton: stepHandlers.showNextButton,      // 应该是 false
   });
   ```

### 检查"开始下一回合"按钮不显示的原因

1. **检查 eventCompleted：**
   ```javascript
   console.log('eventCompleted:', eventCompleted);  // 应该是 true
   ```

2. **检查 eventData：**
   ```javascript
   console.log('eventData:', eventData);  // 可能为 null 或保留的值
   ```

3. **检查视图状态：**
   ```javascript
   console.log({
     currentView,                    // 如果在 INTERACT_NPC，需要 eventCompleted && !isTypingInInteractNpc
     isTypingInInteractNpc,          // 应该是 false
     isLoading,                     // 应该是 false
   });
   ```

---

## 📝 总结

### "继续游戏"按钮
- **核心条件：** 必须有完整的 `newEvent`（包含 event、npc、subscene）
- **状态条件：** 不在等待数据、不在打字、无待处理请求、队列为空
- **使用场景：** 当前事件流式响应完成，有新的子事件可以继续

### "开始下一回合"按钮
- **核心条件：** `eventCompleted = true`（没有活跃事件）
- **状态条件：** 不是第一次进入、不在加载中、不在打字中（如果在 NPC 交互页面）
- **使用场景：** 当前事件已完成，可以开始新的回合

