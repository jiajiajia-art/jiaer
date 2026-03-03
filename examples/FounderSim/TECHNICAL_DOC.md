# 创始人模拟器 - 技术文档

## 项目概述

**创始人模拟器（FounderSim）** 是一个基于Web的回合制人生模拟游戏，玩家从大学毕业开始，可以选择找工作、读研究生或创业，通过不同的路径体验人生发展。游戏采用纯前端技术栈，无需后端服务器，所有数据存储在浏览器本地。

### 核心特性

- **回合制游戏机制**：每回合代表一个月，玩家需要做出关键决策
- **多路径发展**：工作、读研、创业三种不同的发展路径
- **属性系统**：精力、智商、沟通、气运、理想五大属性影响游戏进程
- **随机事件系统**：根据玩家状态触发不同类型的突发事件
- **项目管理系统**：创业模式下可进行项目立项、设计、研发、销售
- **员工管理系统**：招聘、分配、管理员工，每个员工只能参与一个项目

---

## 技术架构

### 技术栈

- **前端框架**：原生 JavaScript（ES6+）
- **HTML5**：页面结构和布局
- **CSS3**：样式和响应式设计
- **JSON**：游戏数据配置
- **Fetch API**：异步加载游戏数据

### 架构设计

```
┌─────────────────────────────────────┐
│         index.html (UI层)            │
│  - 游戏界面结构                        │
│  - 各种面板和按钮                      │
└──────────────┬────────────────────────┘
               │
┌──────────────▼────────────────────────┐
│      script.js (逻辑层)               │
│  - Game对象：核心游戏逻辑              │
│  - 状态管理                            │
│  - 事件处理                            │
└──────────────┬────────────────────────┘
               │
┌──────────────▼────────────────────────┐
│      data.json (数据层)               │
│  - 游戏配置数据                        │
│  - 事件定义                            │
│  - 静态资源                            │
└───────────────────────────────────────┘
```

### 核心设计模式

- **单例模式**：`Game` 对象作为全局单例管理所有游戏状态
- **观察者模式**：通过事件监听器响应玩家操作
- **状态机模式**：游戏状态在 `character-creation`、`playing`、`event` 之间切换

---

## 文件结构

```
FounderSim/
├── index.html          # 主页面结构（299行）
├── script.js           # 游戏核心逻辑（2358行）
├── style.css           # 样式文件
├── data.json           # 游戏数据配置（70行）
├── main.js             # 备用/旧版本代码（689行）
├── package.json        # 项目配置
├── README.md           # 项目说明
└── TECHNICAL_DOC.md    # 技术文档（本文件）
```

---

## 核心模块详解

### 1. 游戏初始化模块

**位置**：`script.js` 第 44-64 行

**功能**：
- 异步加载 `data.json` 游戏数据
- 绑定所有事件监听器
- 初始化游戏状态

**关键函数**：
```javascript
async init()           // 游戏初始化
async loadData()       // 加载JSON数据
bindEvents()           // 绑定事件监听器
```

### 2. 角色创建模块

**位置**：`script.js` 第 301-346 行

**功能**：
- 玩家输入姓名和性别
- 随机生成玩家属性（30-100）
- 随机生成学校（普通本科/211/985/藤校）
- 固定初始学历为"学士"

**关键函数**：
```javascript
createCharacter()      // 创建角色
```

**数据结构**：
```javascript
player: {
    name: string,
    gender: string,
    age: number,
    money: number,
    attributes: {
        energy: number,
        intelligence: number,
        communication: number,
        luck: number,
        ideal: number
    },
    school: string,
    schoolLevel: number,
    degreeLevel: number
}
```

### 3. 工作路径模块

**位置**：`script.js` 第 491-620 行

**功能**：
- 工作选择：根据学历筛选可用工作
- 工作管理：显示岗位信息，提供行动选择
- 工作行动：
  - **努力板砖**：精力检定，通过获得奖金
  - **偷偷摸鱼**：气运检定，通过获得气运+1
  - **自主学习**：随机获得智商/沟通/理想+1
  - **辞职**：失去工作，返回选择面板

**关键函数**：
```javascript
showWorkPanel()        // 显示工作选择面板
selectJob(job)         // 选择工作
updateWorkPanel()      // 更新工作管理面板
workHard()             // 努力板砖
workSlack()            // 偷偷摸鱼
workLearn()            // 自主学习
workQuit()             // 辞职
```

**工作事件系统**：
- 触发概率：30%
- 检定通过奖励：70%属性提升，20%加薪，10%升职
- 检定失败惩罚：50%被开除，50%降低属性
- 升职奖励：职级提升，加薪30%

### 4. 研究生路径模块

**位置**：`script.js` 第 694-735 行

**功能**：
- 专业选择：根据学历筛选可用专业
- 学习状态：每回合获得1000元，持续36个月
- 毕业：36个月后自动毕业，学历提升（学士→硕士→博士）

**关键函数**：
```javascript
showGraduatePanel()    // 显示专业选择面板
selectMajor(major)     // 选择专业
```

**研究生事件系统**：
- 每回合必触发
- 检定通过：属性+5
- 检定失败：属性-3

### 5. 创业路径模块

**位置**：`script.js` 第 746-900 行

**功能**：
- 行业选择：选择创业行业
- 资金来源：存款/无息贷款/融资
- 公司管理：员工管理、项目管理

**关键函数**：
```javascript
selectIndustry(industry)    // 选择行业
handleFundingChoice()       // 处理资金来源选择
handleLoan()                // 处理无息贷款
handleInvestment()          // 处理融资
startStartup()              // 开始创业
```

**融资计算公式**：
```javascript
融资额 = 100 × (1 + 学校等级×0.5 + 学历等级×0.3 + 工作年限×0.2) 万元
公司估值 = 融资额 × 10
融资条件：属性总和 ≥ 400
```

### 6. 员工管理模块

**位置**：`script.js` 第 1105-1262 行

**功能**：
- 招聘员工：生成随机候选人，薪资与能力正相关
- 员工分配：为项目分配员工，一个员工只能参与一个项目
- 玩家作为员工：玩家可担任任意岗位，能力根据属性计算

**关键函数**：
```javascript
showHirePanel()                    // 显示招聘面板
hireEmployee(employee)            // 招聘员工
fireEmployee(index)                // 辞退员工
showAssignEmployeesPanel()         // 显示员工分配面板
assignEmployeeToProject()           // 分配员工到项目
getTotalAbilityByPosition()         // 获取岗位能力总和（包含玩家）
getPlayerAbilityByPosition()       // 计算玩家在指定岗位的能力
```

**员工能力分布**：
- 50%概率：能力 < 50
- 40%概率：能力 50-100
- 10%概率：能力 100-200

**薪资计算公式**：
```javascript
基础薪资 = 业务能力 × 250
最终薪资 = 基础薪资 × (1 ± 10%)
```

**玩家能力计算**：
- 产品岗位：(智商 + 沟通) / 2
- 研发岗位：(智商 + 精力) / 2
- 销售岗位：(沟通 + 精力) / 2
- 行政岗位：(沟通 + 理想) / 2

### 7. 项目管理模块

**位置**：`script.js` 第 1317-1760 行

**功能**：
- 项目立项：根据产品员工能力确定项目评级（C/B/A/S/SS）
- 项目设计：根据项目级别和产品员工能力计算设计时间
- 项目研发：根据项目级别和研发员工能力计算研发时间
- 项目销售：根据项目级别和销售员工能力计算收入

**关键函数**：
```javascript
showProjectCreatePanel()    // 显示项目立项面板
createProject()              // 创建项目
startDevelop()              // 开始研发
startSales()                // 开始销售
```

**项目状态流程**：
```
立项 → 设计阶段 → 设计完成 → 研发阶段 → 研发完成 → 销售阶段
```

**项目时间计算**：

**设计时间**：
```javascript
基础时间：C=1月, B=2月, A=3月, S=4月, SS=5月
实际时间 = 基础时间 × (100 / (产品能力 + 50))
```

**研发时间**：
```javascript
基础时间：C=3月, B=5月, A=8月, S=12月, SS=18月
实际时间 = 基础时间 × (100 / (研发能力 + 50))
```

**销售收入**：
```javascript
基础倍数：C=50, B=75, A=100, S=150, SS=200
月收入 = 销售能力总和 × 基础倍数
每回合递减：5%-15%，最低降至初始收入的20%
```

### 8. 回合推进模块

**位置**：`script.js` 第 1836-2010 行

**功能**：
- 推进游戏回合（每月）
- 扣除每月开销
- 应用生活标准属性提升
- 根据当前状态处理不同逻辑
- 触发随机事件

**关键函数**：
```javascript
nextTurn()                      // 下一回合
calculateMonthlyExpenses()      // 计算每月开销
applyLivingStandardBenefits()   // 应用生活标准属性提升
```

**每月开销**：
- 租房：简朴(-2000) / 普通(-4000) / 豪华(-8000)
- 饮食：简朴(-1000) / 普通(-2000) / 豪华(-4000)
- 社交：简朴(-500) / 普通(-1000) / 豪华(-2000)
- 豪华标准：每月随机增加0-1点对应属性

### 9. 事件系统模块

**位置**：`script.js` 第 2028-2235 行

**功能**：
- 触发随机事件
- 进行属性检定
- 应用奖励或惩罚

**关键函数**：
```javascript
triggerEvent(type)          // 触发随机事件
applyEventReward()          // 应用事件奖励
applyEventPenalty()         // 应用事件惩罚
closeEventModal()           // 关闭事件弹窗
```

**事件类型**：
- `work`：工作事件（30%概率触发）
- `graduate`：研究生事件（每回合触发）
- `startup`：创业事件（10%概率触发）

**检定难度**：
- 工作事件：30-70
- 研究生事件：40-80
- 创业事件：50-90

**奖励/惩罚解析**：
支持逗号和竖线分隔的多重效果，例如：
- `"精力+5，公司余额+50000"`
- `"加薪1000元|精力+2|升职"`

### 10. UI更新模块

**位置**：`script.js` 第 347-471 行

**功能**：
- 更新玩家信息面板
- 更新开销面板
- 更新工作面板
- 更新创业管理面板

**关键函数**：
```javascript
updatePlayerPanel()         // 更新玩家信息
updateExpensesPanel()       // 更新开销显示
updateWorkPanel()           // 更新工作面板
updateStartupPanel()        // 更新创业管理面板
```

---

## 数据结构

### 玩家状态对象

```javascript
player: {
    // 基本信息
    name: string,
    gender: string,
    age: number,
    money: number,
    
    // 教育背景
    education: string,
    school: string,
    schoolLevel: number,      // 1-4
    degreeLevel: number,       // 1-3
    
    // 属性
    attributes: {
        energy: number,       // 精力
        intelligence: number, // 智商
        communication: number,// 沟通
        luck: number,         // 气运
        ideal: number         // 理想
    },
    
    // 工作相关
    currentJob: object,
    jobLevel: number,         // 1-4
    workYears: number,
    workActionUsed: boolean,
    
    // 研究生相关
    currentMajor: object,
    graduateStartTurn: number,
    
    // 创业相关
    startup: {
        industry: object,
        balance: number,
        employees: array,
        projects: array,
        fundingRound: number,
        valuation: number,
        playerEmployee: {
            name: string,
            position: string,
            salary: number,
            isPlayer: boolean
        }
    },
    
    // 生活标准
    housingStandard: string,  // simple/normal/luxury
    foodStandard: string,
    socialStandard: string
}
```

### 项目对象

```javascript
project: {
    name: string,
    grade: string,            // C/B/A/S/SS
    status: string,            // designing/design_completed/developing/completed/selling
    designCurrentMonth: number,
    designTotalMonths: number,
    currentMonth: number,
    totalMonths: number,
    monthlyRevenue: number,
    initialRevenue: number,
    assignedEmployees: array   // 员工索引列表，'player'表示玩家
}
```

### 员工对象

```javascript
employee: {
    name: string,
    position: string,          // 产品/研发/销售/行政
    ability: number,           // 0-200
    salary: number
}
```

---

## 关键算法

### 1. 属性检定算法

```javascript
// 随机生成检定值
checkValue = randomInt(min, max)

// 玩家属性值
playerAttr = player.attributes[eventType]

// 检定结果
passed = playerAttr >= checkValue
```

### 2. 项目评级算法

```javascript
productAbility = 产品员工能力总和

if (productAbility >= 400) grade = 'SS'
else if (productAbility >= 300) grade = 'S'
else if (productAbility >= 200) grade = 'A'
else if (productAbility >= 100) grade = 'B'
else grade = 'C'
```

### 3. 研发时间加速算法

```javascript
// 基础时间
baseMonths = baseMonthsByGrade[grade]

// 能力加速
actualMonths = baseMonths × (100 / (devAbility + 50))

// 最少1个月
finalMonths = max(1, ceil(actualMonths))
```

### 4. 收入递减算法

```javascript
// 每回合减少5%-15%
decreaseRate = randomInt(5, 15) / 100
newRevenue = currentRevenue × (1 - decreaseRate)

// 最低收入保护
minRevenue = initialRevenue × 0.2
finalRevenue = max(minRevenue, newRevenue)
```

### 5. 最大员工数算法

```javascript
base = 5
adminAbility = 行政员工能力总和
additional = floor(adminAbility / 10)
maxEmployees = base + additional
```

---

## 事件系统详解

### 事件数据结构

**位置**：`data.json` 第 36-57 行

```json
{
  "events": {
    "work": [...],
    "graduate": [...],
    "startup": [...]
  }
}
```

### 事件对象结构

```javascript
{
    type: string,           // 检定属性类型
    description: string,    // 事件描述
    passReward: string,     // 通过奖励（支持逗号/竖线分隔）
    failPenalty: string    // 失败惩罚（支持逗号/竖线分隔）
}
```

### 事件处理流程

1. **触发条件检查**：根据游戏状态和概率决定是否触发
2. **事件选择**：从对应类型的事件列表中随机选择
3. **难度计算**：根据事件类型生成检定难度
4. **属性检定**：比较玩家属性值与检定难度
5. **结果应用**：应用奖励或惩罚，更新游戏状态
6. **UI更新**：显示事件弹窗，更新相关面板

---

## UI组件说明

### 主要面板

1. **角色创建面板** (`character-creation`)
   - 输入姓名和性别
   - 创建角色按钮

2. **主游戏界面** (`main-game`)
   - 游戏头部：回合数和"进入下个月"按钮
   - 选择面板：找工作/读研究生/创业

3. **工作管理面板** (`work-management`)
   - 岗位信息：名称、职级、月薪
   - 行动按钮：努力板砖/偷偷摸鱼/自主学习/辞职

4. **创业管理面板** (`startup-management`)
   - 公司信息：账户余额、融资轮次、公司估值
   - 行动按钮：招聘员工/项目立项/总结学习
   - 员工列表：显示所有员工（包括玩家）
   - 项目列表：显示所有项目及其状态

5. **员工分配面板** (`assign-employees-panel`)
   - 可用员工列表
   - 已分配员工列表
   - 分配/移除按钮

### 模态框

- **事件弹窗** (`event-modal`)：显示突发事件和检定结果

---

## 开发指南

### 添加新工作

在 `data.json` 的 `jobs` 数组中添加：

```json
{
    "name": "工作名称",
    "salary": 薪资,
    "schoolRequirement": 学校等级要求,
    "description": "工作描述"
}
```

### 添加新专业

在 `data.json` 的 `majors` 数组中添加：

```json
{
    "name": "专业名称",
    "schoolRequirement": 学校等级要求,
    "description": "专业描述"
}
```

### 添加新事件

在 `data.json` 的 `events` 对应类型数组中添加：

```json
{
    "type": "属性类型",
    "description": "事件描述",
    "passReward": "奖励描述",
    "failPenalty": "惩罚描述"
}
```

### 修改事件触发概率

在 `script.js` 的 `nextTurn()` 函数中修改：

```javascript
// 工作事件
if (Math.random() < 0.3) {  // 修改0.3为其他值
    this.triggerEvent('work');
}

// 创业事件
if (Math.random() < 0.1) {  // 修改0.1为其他值
    this.triggerEvent('startup');
}
```

### 修改项目时间计算

在 `script.js` 的 `createProject()` 函数中修改：

```javascript
// 设计时间基础值
const baseDesignMonthsByGrade = {
    'C': 1, 'B': 2, 'A': 3, 'S': 4, 'SS': 5
};

// 研发时间基础值
const baseMonthsByGrade = {
    'C': 3, 'B': 5, 'A': 8, 'S': 12, 'SS': 18
};
```

---

## 性能优化建议

1. **DOM操作优化**：减少频繁的DOM查询，缓存常用元素
2. **事件委托**：使用事件委托减少事件监听器数量
3. **数据缓存**：避免重复计算，缓存计算结果
4. **懒加载**：面板内容按需渲染

---

## 已知问题和限制

1. **数据持久化**：游戏数据仅存储在内存中，刷新页面会丢失
2. **浏览器兼容性**：需要支持ES6+的现代浏览器
3. **移动端适配**：响应式设计可能需要进一步优化

---

## 未来改进方向

1. **数据持久化**：使用LocalStorage保存游戏进度
2. **存档系统**：支持多个存档槽位
3. **成就系统**：添加成就和里程碑
4. **数据统计**：游戏结束后的数据统计和回顾
5. **音效和动画**：增强游戏体验
6. **多语言支持**：国际化支持

---

## 版本历史

- **v1.0.0**：初始版本
  - 基础游戏循环
  - 三种发展路径
  - 事件系统
  - 项目管理系统
  - 员工管理系统

---

## 联系方式

如有问题或建议，请查看项目README或提交Issue。
