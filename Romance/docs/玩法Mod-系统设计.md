# Romance · 玩法 Mod 系统设计

本文把通用 Mod 系统的设计思路（manifest、加载器、API、冲突、工坊）落到 Romance 现有代码上，说明玩法 Mod 从创作到进局的完整链路、每一环的规则，以及现在还缺什么。

边界以 `玩法Mod与手机应用-需求.md` 为准（世界 / 玩法包 / 手机应用三分）。本文只讲**玩法包**。

---

## 0. 一句话

玩法 Mod = **叠加在某部世界之上、只追加或覆盖玩法条目的纯数据包**。平台 SDK 提供能力，创作者用对话产出包，世界通过「添加玩法」记一条安装记录，开局时引擎把世界 + 已装包按顺序合并成一局。

```
创作（对话工坊）→ 体检 → 打包 .kkmod → 上传/私有测试 → 审核 → 上架
                                                         ↓
世界编辑器「添加玩法」→ playModInstalls 记一条 → 预览/开局 resolveChain 合并 → 局内生效
```

---

## 1. 通用概念 ↔ Romance 现有实现

| 通用 Mod 系统 | Romance 里对应的东西 | 位置 |
| --- | --- | --- |
| manifest.json | `ModManifest`（id/version/kind/deps/slotMerge）+ 上架用 `KkmodManifest` | `mods/types.ts`、`mods/kkmod/sdk.ts` |
| Mod 包格式 | `.kkmod`（gameplay），`payload.mod` = 完整 addon；`.nmod` 为本地导入导出格式 | `lib/kkmodFromCreators.ts`、`mods/nmod.ts` |
| 内容注册表 | `ContentSlots` + `SLOT_KEYS`：引擎只认这些内容槽 | `mods/types.ts` |
| 加载顺序 / 合并 | `resolveChain`：world → playModInstalls → 手选叠加包，按 id 合并 | `mods/registry.ts` |
| 依赖检查 | `missingDeps` / `selectionProblems` / `cmpVer` | `mods/registry.ts` |
| Mod API（受控能力） | `KkmodHostApi` + 权限白名单 / 黑名单 | `mods/kkmod/sdk.ts` |
| 事件钩子 / 跨 Mod 通信 | `ModExt.exports / imports / subs`（默认隔离，申请+授权才通） | `mods/types.ts`、`mods/comm.ts` |
| 安全沙箱 | 纯数据 + `sanitizeDeep` 剥脚本 + CSS 作用域前缀 | `mods/nmod.ts` |
| 安装记录 | `PlayModInstallConfig`（版本锁定、显隐、底栏名、配置区） | `mods/playModCatalog.ts` |
| 工坊 | 「添加玩法」= 官方种子 + 已上架包；`/api/components/kkmod/upload` | `AddPlayModModal.tsx`、`PlayModCreateShell.tsx` |

结论：Romance 已经选了最稳的路线——**只开放声明式数据，不开放脚本**（相当于通用设计里的 L1 数据 Mod + 受控逻辑）。下面的设计都在这个前提下展开，不引入任意脚本。

---

## 2. 玩法包长什么样

### 2.1 三种形态（可组合）

| 形态 | 写在哪些字段 | 例子 | 进局后表现 |
| --- | --- | --- | --- |
| **A. 新地点** | `content.rooms`（带 options）、`content.items`、`content.locations` | 旧货铺：翻货架 / 还价 → 拿旧钥匙 | 地图多一处可去的地点 |
| **B. 游戏内页面** | `ext.vars / tables / components / panels / actions / skin` | 通告板、修炼面板 | 大界面多一屏（不是小手机 App） |
| **C. 内置玩法格子** | `customAttrs`、`titles`、`trainings`、`sideJobs`、`weekendActs`、`events`、`gameRules`、`endings`、`income`、`tuning` 等 SLOT | 名气数值 + 头衔 + 每周通告 | 已有玩法系统里多了条目 |

### 2.2 包结构（上架 `.kkmod`）

```jsonc
{
  "manifest": {
    "id": "old-shop", "slug": "old-shop", "name": "旧货铺", "version": "1.0.0",
    "kind": "gameplay",
    "dependencies": [{ "id": "pack-career", "minVersion": "1.0.0" }],
    "permissions": ["ui.panel", "ui.toast", "save.game.read", "save.game.write"],
    "configSchema": [{ "key": "haggleRate", "type": "number", "label": "还价成功率" }],
    "editorPanels": [],            // 装进世界后打开哪些扩展配置区
    "navEntry": { "needed": false },
    "compatMin": "1.0.0",           // 引擎/SDK 版本区间
    "saveMigrate": [], "testCases": []
  },
  "payload": {
    "mod": {
      "id": "old-shop", "kind": "addon", "slotMerge": "merge",
      "content": { /* A + C */ },
      "ext":     { /* B */ }
    }
  }
}
```

### 2.3 硬规则

1. `kind` 永远是 `addon`，`slotMerge` 永远是 `merge`（工坊已强制）。
2. **不能写世界本体字段**：完整清单见 `src/mods/playModGuard.ts` 的 `PLAY_MOD_FORBIDDEN_FIELDS`（世界书、剧本基调、开局日期/资金/地点、货币名、建角池、开场、封面、界面风格、底栏、安装记录、手机应用等）。新增人物可以，但改世界已有人物必须是有意覆盖（`override: true`）。
3. 物品只能通过选项 / 效果发放，不能写进开局背包。
4. 全部可 JSON 序列化；字符串过 `sanitizeDeep`；`skin.css` 自动加 `[data-nmod="<id>"]` 前缀。

---

## 3. 命名空间（防冲突的根）

现在合并规则是「按 id 追加，同 id 覆盖」。两个包都新建了 `id: "shop"` 就会互相吞掉，而且没有任何提示。

**规则：**

| 情况 | id 写法 | 合并行为 |
| --- | --- | --- |
| 包新建的条目 | `<包id>.<本地id>`，如 `old-shop.key` | 追加；不可能与别人撞 |
| 有意覆盖世界或别的包的条目 | 原 id + `"override": true` | 覆盖，并记入修改记录 |
| 未加前缀也未声明 override，却撞上已有 id | — | 体检报错：「与世界/某包的 xxx 同名」 |

落地方式：工坊保存时自动给新增条目补前缀（AI 不需要记），`PLAY_SYS` 提示词只需告诉模型「改原有条目时保留原 id 并写 override」。旧包无前缀照常加载，仅在冲突时给警告。

---

## 4. 加载与合并（预览、开局共用一条路径）

```
1. 取世界 world
2. 读 world.content.playModInstalls（enabled=true），按 sortOrder 排序
3. 每条安装记录 → 找到 versionPinned 对应的包（本地种子 / 已上架缓存）
4. 依赖校验：缺依赖 / 版本不符 / 依赖被禁用 → 该包不进链，并产出一条「加载报告」
5. 拓扑排序：依赖必须排在被依赖者之后；sortOrder 只在不违反依赖时生效；有环 → 环上包全部不进链
6. resolveChain：world → 排好序的包，逐个按槽合并（列表槽 merge by id，对象槽浅合并）
7. 同 id 的世界侧「扩展配置」覆盖包底稿（需求 P1：世界改过的优先）
8. 产出 ResolvedWorld + LoadReport（谁没加载、为什么、谁覆盖了谁）
```

现状对照：

- 第 2、6 步已有（`resolveInstallAddonModIds` + `resolveChain`）。
- 第 4 步缺依赖时现在是 `missingDeps(...).length === 0` **静默跳过**。应改为写入 LoadReport，并在编辑器 / 预览顶部提示「旧货铺未生效：缺少事业经营包」。
- 第 5 步没有拓扑排序，顺序 = 安装顺序。被依赖包后装时会被依赖方覆盖反了。
- 第 8 步没有。

### 4.1 LoadReport（新增，纯函数）

```ts
type LoadIssue =
  | { kind: "missingDep"; mod: string; dep: string; need?: string }
  | { kind: "cycle"; mods: string[] }
  | { kind: "idClash"; slot: string; id: string; by: string[] }      // 未声明 override 的撞名
  | { kind: "override"; slot: string; id: string; from: string; to: string }
  | { kind: "forbiddenField"; mod: string; field: string };

type LoadReport = { chain: string[]; skipped: string[]; issues: LoadIssue[] };
```

`resolveChain` 顺手产出，`registry` 暴露 `getLoadReport()`。编辑器「已安装玩法」列表和作者预览壳顶部各读一次即可。

---

## 5. 安装 / 升级 / 卸载

| 动作 | 世界侧写什么 | 局内效果 | 已开局玩家 |
| --- | --- | --- | --- |
| 安装 | `playModInstalls` 追加一条（modId、slug、versionPinned、installedAt、editorPanels、dependsOn）；依赖链自动装入的标 `autoInstalled` | 包内容进链；扩展配置区出现 | 下次进游戏生效 |
| 隐藏入口 | `visible=false` | 底栏 / 入口不显示，玩法仍运行 | 同上 |
| 停用 | `enabled=false` | 不进链 | 同上 |
| 升级 | 改 `versionPinned`；不自动升级 | 新版本内容进链 | 跑 `saveMigrate` |
| 卸载 | 删安装记录；可提示一并卸掉无人依赖的 `autoInstalled` | 地点、事件、页面消失 | 已拿到的物品保留 |

### 5.1 存档里的残留怎么处理

卸包后存档可能残留：物品、`ext.vars` 私有变量、`flag`、进行中的事件链。

- **物品**：保留，显示原名；若定义已不在链里，用存档里冗余存的 `name` 显示，标「来自已移除的玩法」。
- **私有变量 / flag**：保留在存档，按 `<包id>.` 前缀归属；不再被读取。重装后自动接上。
- **进行中的链式事件**：下一次判定时目标不存在 → 静默结束，不报错。
- 存档头记录开局时的 `[{modId, version}]`；读档时若当前世界少了某包，给一次提示，不阻断。

### 5.2 版本规则（写给创作者）

- 只加条目、调数值 → 升修订号或次版本号，世界可放心升级。
- 删条目、改 id、改变量含义 → 升主版本号，必须填 `saveMigrate` 说明。
- `compatMin / compatMax` 对应平台 SDK 版本，超出范围的包在「添加玩法」里置灰。

---

## 6. 体检（上传前、安装前都跑）

复用 `nmod.ts` 已有体检，补齐玩法包专用项：

| 检查 | 级别 |
| --- | --- |
| 写了世界本体字段（§2.3 第 2 条） | 错误，阻断上传 |
| 新条目未加前缀且与依赖包 / 官方种子撞名 | 错误 |
| 引用了不存在的属性 / 物品 / 地点 / 事件 id（`auditStory`） | 错误 |
| 用到某原生能力但未声明 `nativeDeps`（如写了 `cars` 却没依赖 pack-transport） | 错误 |
| `permissions` 含黑名单或未开放项（`assertManifest`） | 错误 |
| 游戏内页面引用了未定义变量 / 表格 | 错误 |
| 地点有选项但所有分支都没有效果 | 警告 |
| 物品不可获得（没有任何选项发放） | 警告 |
| 预览图少于 1 张 | 阻断上架，不阻断私有测试 |

---

## 7. 对话创作页（PlayModCreateShell + ModWorkshop 玩法模式）

### 7.1 流程

```
1. 选「基于哪部世界试玩」（可选；只用于取属性 / 地点供 AI 引用，不写进包）
2. 对话：一句话描述玩法 → AI 返回 patch → 右侧显示 diff 与进度
3. 快捷追问按钮：新地点 / 游戏内页面 / 新属性 / 头衔 / 日程玩法 / 规则开关 / 结局 / 引擎平衡
4. 「试玩」：beginAuthorPreviewMod 临时挂包进当前世界 → 真实运行时 → 退出还原
5. 体检面板：§6 全部结果，点一条跳到对应字段
6. 保存草稿 → 上传预览图 → 上传玩法包（进入私有测试）
7. 我的玩法 Mod：继续编辑 / 提交审核 / 发新版本
```

### 7.2 页面布局建议

| 区域 | 内容 |
| --- | --- |
| 左：对话 | 历史、输入框、快捷追问；每轮 AI 回复下挂「本轮改了什么」折叠 diff |
| 右上：包概览 | 三种形态各自计数（地点 n / 页面 n / 格子条目 n），点开看清单 |
| 右中：体检 | 错误红、警告黄，实时刷新 |
| 右下：操作 | 试玩、保存、上传；上传按钮在有错误时禁用并说明原因 |

文案遵守需求 C0：只说「上传玩法包」，不说「生成 SDK」。

### 7.3 给 AI 的约束（PLAY_SYS 补充）

- 只输出 §2.1 三种形态涉及的字段；世界本体字段一律不写。
- 新建条目用短本地 id，前缀由保存时自动补。
- 修改世界或依赖包已有条目：保留原 id，写 `"override": true`，并在说明里点名。
- 物品只能出现在选项效果里。

---

## 8. 冲突处理策略

| 场景 | 策略 |
| --- | --- |
| 两包各自新增条目 | 命名空间天然隔离，直接合并 |
| 两包都 override 同一条目 | 后加载者生效（按 §4 的顺序）；LoadReport 记 `override`；编辑器提示「A 与 B 都改了 xxx，当前用 B」，可拖动排序 |
| 两包同时改同一数值（如 tuning 倍率） | 同上，后者生效；不做数值叠乘，避免作者看不懂结果 |
| 包声明互斥 | manifest 新增 `conflictsWith: [{id, range}]`，安装时直接拒绝并说明 |
| 两包都要占底栏 | 超出 `navSize` 时后装的自动放进「更多」，不挤掉世界自己的页签 |
| 跨包读写变量 | 只能走 `exports/imports` 授权（已有），未授权一律读不到 |

---

## 9. 现在代码里的缺口（按影响排序）

1. **上传会丢掉游戏内页面。** `kkmodPackageFromPlayMod` 的 `payload.mod` 只带 `content`，没有 `ext`。形态 B（vars / panels / actions / skin）整块丢失，上架后装进世界看不到页面。应把 `ext` 一并打包，`deps / nativeDeps` 也要带上。
2. **上传包的 `editorPanels` 恒为 `[]`。** 装进世界后不会打开任何扩展配置区。应按包内实际写了哪些槽推导（写了 `titles` → `titles` 面板，依此类推）。
3. **依赖不满足时静默跳过。** `resolveChain` 里 `missingDeps(...).length === 0` 不满足就不进链，作者和玩家都看不到原因。需要 §4.1 的 LoadReport。
4. **没有拓扑排序。** 顺序完全取决于安装先后。
5. **没有命名空间。** 同 id 静默覆盖。
6. **没有世界本体字段拦截。** AI 偶尔写 `npcs`、`prompt` 会直接改掉世界。
7. **存档没记开局时的玩法包版本。** 卸包或升级后无从提示。

---

## 9.1 落地进度

| 项 | 状态 | 位置 |
| --- | --- | --- |
| 打包补 `ext` / `deps` / `nativeDeps`，`editorPanels` 与 manifest 依赖按内容推导 | 已完成 | `lib/kkmodFromCreators.ts` |
| 世界本体字段拦截：工坊每轮补丁、保存、打包、上传四处 | 已完成 | `mods/playModGuard.ts`、`ModWorkshop.tsx`、`PlayModCreateShell.tsx` |
| 依赖拓扑排序 + 环检测 + 跳过原因（LoadReport） | 已完成 | `registry.ts` `resolveChain` / `getLoadReport` / `describeLoadReport` |
| 撞名检测；工坊改底层世界条目时自动标 `override` | 已完成（只报告，不改合并结果） | 同上 |
| 加载报告展示：模组管理问题清单、作者试玩横幅 | 已完成 | `selectionProblems`、`AuthorPreviewPlayShell.tsx` |
| 上传前体检区块（阻断项 + 装机效果说明） | 已完成 | `PlayModCreateShell.tsx` |
| 新条目自动加命名空间前缀 | 暂缓：需同时改写所有引用（事件 nextIds、地点出口等），风险高；先用撞名检测 + override 兜住 | — |
| 存档记录玩法包版本（`modStamp`），读档对比并弹窗提示移除 / 新增 / 更新 | 已完成 | `mods/modStamp.ts`、`lib/store.ts`、`GameContext.tsx` `loadState` |
| 卸包残留：背包物品备忘（`itemMemo`），卸包后显示「来自已移除的玩法」、禁用使用 / 赠送，重装自动恢复 | 已完成 | `GameContext.tsx` `persist`、`Backpack.tsx` |
| `conflictsWith` 互斥（双向）：对话可写、上传带上、商店置灰、合并链路兜底 | 已完成 | `playModGuard.ts` `playModInstallBlock`、`AddPlayModModal.tsx`、`registry.ts` |
| 平台 SDK 版本区间：上传写 `compatMin`，商店按区间置灰 | 已完成（前端）；需后端在 shelf 接口回传 `conflictsWith / compatMin / compatMax` | `playModStore.ts` |
| 卸包后私有变量 / flag | 保持现状即可：存档原样保留、不再被读取，重装后自动接上 | — |

## 10. 落地顺序

| 步 | 做什么 | 验收 |
| --- | --- | --- |
| 1 | 打包补 `ext`、`deps`、`nativeDeps`；`editorPanels` 按内容推导 | 带游戏内页面的包上传→安装后，大界面能打开页面；对应配置区出现 |
| 2 | 世界本体字段拦截（工坊保存 + 体检 + 安装三处） | AI 写了 `npcs` 时保存被拦并提示 |
| 3 | LoadReport + 拓扑排序 | 缺依赖的包在编辑器、预览顶部有明确原因 |
| 4 | 命名空间自动前缀 + override 声明 + 撞名检测 | 两个包都做「商店」互不覆盖 |
| 5 | 存档头记录包版本；卸包残留按 §5.1 处理 | 卸包后读档不崩，物品还在并有来源标注 |
| 6 | `conflictsWith`、版本区间置灰、升级提示 | 不兼容包无法安装；有新版时世界编辑器提示 |

第 1 步是硬 bug，优先修；第 2～4 步决定社区包多了以后会不会互相打架。

---

## 11. 验收用例

- 对话做「旧货铺」（地点 + 选项 + 物品）：试玩能去、选了才拿到钥匙；卸包后地点消失、钥匙还在。
- 对话做「修炼面板」（游戏内页面）：上传 → 上架 → 装进世界 → 大界面出现面板；小手机桌面不出现。
- 包 A 依赖事业经营包，只装 A：编辑器提示缺依赖并可一键补装；补装前预览里 A 不生效且有原因。
- 包 A、B 都新建 `shop`：两者都在；都 override `base.titles.star`：提示冲突，当前用后者。
- 同一包装进两部世界、各自改扩展配置：互不影响。
- AI 在玩法对话里写了 `npcs`：保存被拦截，提示「玩法包不能改人物骨架」。
