# 国际化 (i18n) 改造进度

> 更新时间: 2026-05-21

## 概述

本项目正在进行中英文国际化改造，使用 `react-i18next` 实现多语言支持。

### 当前状态

| 状态 | 说明 |
|------|------|
| ✅ 已完成 | 文件已添加国际化 |
| 🔄 进行中 | 文件正在改造中 |
| ⏳ 待改造 | 文件尚未开始国际化 |

---

## 已完成的模块

### 翻译文件
| 文件 | 状态 | Key 数量 |
|------|------|----------|
| `src/i18n/index.ts` | ✅ 完成 | - |
| `src/i18n/locales/zh.json` | ✅ 完成 | ~420 keys |
| `src/i18n/locales/en.json` | ✅ 完成 | ~420 keys |

### 新增翻译 Keys (2026-05-21)

| Key | 中文 | 英文 | 用途 |
|-----|------|------|------|
| `common.or` | 或 | or | 分隔符 |
| `create.creatorStudio` | 创作工作室 | Creator Studio | 创作页面标题 |
| `create.defaultAvgGameTitle` | 我的AVG游戏 | My AVG Game | 创建 AVG 游戏默认标题 |
| `create.kuranIdPrefix` | Kuran号： | Kuran ID: | Kuran 号标签前缀 |
| `create.copyToken` | 复制 Token | Copy Token | Token 复制按钮提示 |
| `nav.searchAriaLabel` | 搜索已发布的游戏 | Search published games | 搜索框无障碍标签 |
| `nav.submitSearch` | 提交游戏搜索 | Submit game search | 搜索按钮无障碍标签 |
| `createGame.kuranStudio` | Kuran Studio | Kuran Studio | 游戏编辑器品牌名称 |
| `createGame.aiVisualNovelWorkshop` | AI 视觉小说工坊 | AI Visual Novel Workshop | 游戏编辑器副标题 |
| `auth.googleLogin` | 使用谷歌账号登录 | Sign in with Google | Google 登录按钮 |
| `auth.googleLoginFailed` | 谷歌登录失败 | Google login failed | 错误提示 |
| `auth.loginCancelled` | 登录已取消 | Login cancelled | 用户取消登录提示 |
| `auth.networkError` | 网络错误 | Network error | 网络错误提示 |
| `createGame.sidebar.*` | 导航栏完整国际化 | Full sidebar i18n | Sidebar.tsx 导航项国际化 (step/documents/world/characters/scenes/attributeGrowth/functionalNPCs/mapEdit + parsing/completed/inProgress) |

---

## 新增文件

### Firebase 集成文件
|| 文件 | 说明 |
|------|------|
| `src/config/firebase.ts` | Firebase 配置文件，包含 Firebase 应用初始化和认证实例 |
| `src/hooks/useGoogleAuth.ts` | Google 登录自定义 Hook，处理 Firebase Google 登录逻辑 |

### API 更新
|| 文件 | 说明 |
|------|------|
| `src/api/account/authApi.ts` | 新增 `googleLogin` API 方法 |

---

## 已使用国际化的文件

### Pages (页面) - 19 个

| 文件 | 状态 | 备注 |
|------|------|------|
| `src/page/Home.tsx` | ✅ | 首页 |
| `src/page/Galgame.tsx` | ✅ | Galgame 游戏页 |
| `src/page/Create.tsx` | ✅ | 创作中心 |
| `src/page/Profile.tsx` | ✅ | 个人中心 |
| `src/page/GameDetail.tsx` | ✅ | 游戏详情 |
| `src/page/StGame.tsx` | ✅ | ST 游戏 |
| `src/page/CreateGame.tsx` | ✅ | 创建游戏 |
| `src/page/PromotionCenter.tsx` | ✅ | 推广中心 |
| `src/page/AdminPanel.tsx` | ✅ | 管理面板 |
| `src/page/Document.tsx` | ✅ | 文档页 |
| `src/page/StGameCreate.tsx` | ✅ | ST 游戏创建 |
| `src/page/CustomIFCreate.tsx` | ✅ | 自定义 IF 创建 |
| `src/page/CustomIF.tsx` | ✅ | 自定义 IF |
| `src/page/GameSettingsEditor.tsx` | ✅ | 游戏设置编辑器 |
| `src/page/PointsDetails.tsx` | ✅ | 积分详情 |
| `src/page/Messages.tsx` | ✅ | 消息中心 |
| `src/page/Library.tsx` | ✅ | 仓库 |
| `src/page/Categories.tsx` | ✅ | 分类 |
| `src/page/GalgameMap.tsx` | ✅ | Galgame 地图 |
| `src/page/WareHouse.tsx` | ✅ | 仓库 |
| `src/page/Analytics.tsx` | ✅ | 数据分析 |

### Components (组件) - 约 110 个

#### Auth 认证组件
| 文件 | 状态 |
|------|------|
| `src/components/AuthModal.tsx` | ✅ |

#### Layout 布局组件
| 文件 | 状态 |
|------|------|
| `src/components/Layout/Navbar.tsx` | ✅ |
| `src/components/Layout/MobileBottomNav.tsx` | ✅ |

#### Modal 弹窗组件
| 文件 | 状态 |
|------|------|
| `src/components/AnnouncementModal.tsx` | ✅ |
| `src/components/CheckInModal.tsx` | ✅ |
| `src/components/ImageCropModal.tsx` | ✅ |
| `src/components/InviteRewardModal.tsx` | ✅ |
| `src/components/JoinGroupModal.tsx` | ✅ |
| `src/components/FloatingJoinGroup.tsx` | ✅ |
| `src/components/LoadSaveListModal.tsx` | ✅ |
| `src/components/MobileTipModal.tsx` | ✅ |
| `src/components/PriceAdjustmentModal.tsx` | ✅ |
| `src/components/PublishSettingsModal.tsx` | ✅ |
| `src/components/RechargeModal.tsx` | ✅ |
| `src/components/SavePreviewModal.tsx` | ✅ |
| `src/components/MembershipRedeemResultModal.tsx` | ✅ |
| `src/components/MembershipSignInResultModal.tsx` | ✅ |
| `src/components/GenerateResultModal.tsx` | ✅ |

#### CreateGame 创建游戏组件
| 文件 | 状态 |
|------|------|
| `src/components/CreateGame/GameForm.tsx` | ✅ |
| `src/components/CreateGame/GameStatsView.tsx` | ✅ |
| `src/components/CreateGame/UploadProgress.tsx` | ✅ |

#### Galgame Galgame 游戏组件
| 文件 | 状态 |
|------|------|
| `src/components/Galgame/CharacterLayer.tsx` | ✅ |
| `src/components/Galgame/GameImageRenderer.tsx` | ✅ |
| `src/components/Galgame/GalgameHistoryModal.tsx` | ✅ |
| `src/components/Galgame/NormalModeDisplay.tsx` | ✅ |
| `src/components/Galgame/ReplayList.tsx` | ✅ |
| `src/components/Galgame/SaveModal.tsx` | ✅ |
| `src/components/Galgame/ServerAttributesPanel.tsx` | ✅ |
| `src/components/Galgame/SettingsModal.tsx` | ✅ |
| `src/components/Galgame/ShareReplayModal.tsx` | ✅ |
| `src/components/Galgame/TextModeDisplay.tsx` | ✅ |
| `src/components/Galgame/GameBackgroundRenderer.tsx` | ✅ |

#### GalgameMap Galgame 地图组件
| 文件 | 状态 |
|------|------|
| `src/components/GalgameMap/interaction/Display/TextModeDisplay.tsx` | ✅ |
| `src/components/GalgameMap/interaction/Display/NormalModeDisplay.tsx` | ✅ |
| `src/components/GalgameMap/interaction/InteractWithNpcModal.tsx` | ❌ 不需要国际化 |
| `src/components/GalgameMap/interaction/StreamOutputContainer.tsx` | ✅ |
| `src/components/GalgameMap/interaction/NpcInteractionContainer.tsx` | ✅ |
| `src/components/GalgameMap/interaction/AbilityNodeInteractionContainer.tsx` | ✅ |
| `src/components/GalgameMap/WorldMapRenderer.tsx` | ✅ |
| `src/components/GalgameMap/SubSceneModal.tsx` | ✅ |
| `src/components/GalgameMap/SceneView.tsx` | ✅ |
| `src/components/GalgameMap/Modal/HistoryModal.tsx` | ✅ |
| `src/components/GalgameMap/Modal/StoryIntroModal.tsx` | ✅ |
| `src/components/GalgameMap/Plugin/EventDisplayModal.tsx` | ✅ |
| `src/components/GalgameMap/Plugin/Inventory.tsx` | ✅ |

#### GameSettingEditor 游戏设置编辑器组件
| 文件 | 状态 |
|------|------|
| `src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/CharactersPanel/CharactersSidebar.tsx` | ✅ |
| `src/components/GameSettingEditor/CharactersPanel/CharacterAttributesPanel.tsx` | ❌ 不需要国际化 |
| `src/components/GameSettingEditor/WorldPanel/WorldPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/WorldPanel/WorldSettingForm.tsx` | ✅ |
| `src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx` | ✅ |
| `src/components/GameSettingEditor/WorldPanel/StorylinesSection.tsx` | ✅ |
| `src/components/GameSettingEditor/WorldPanel/StorylineModal.tsx` | ✅ |
| `src/components/GameSettingEditor/WorldPanel/StoryStructureAdvanced.tsx` | ✅ |
| `src/components/GameSettingEditor/ScenesPanel/ScenesPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/ScenesPanel/SceneDetailForm.tsx` | ✅ |
| `src/components/GameSettingEditor/ScenesPanel/SceneList.tsx` | ✅ |
| `src/components/GameSettingEditor/ScenesPanel/InlineFieldSave.tsx` | ✅ |
| `src/components/GameSettingEditor/ObjectsPanel/ObjectsPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/ObjectsPanel/ObjectDetail.tsx` | ✅ |
| `src/components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCsPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCDetail.tsx` | ✅ |
| `src/components/GameSettingEditor/MapPanel/MapPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/MapPanel/MapTab.tsx` | ✅ |
| `src/components/GameSettingEditor/MapPanel/FunctionalNPCList.tsx` | ✅ |
| `src/components/GameSettingEditor/MapPanel/SubSceneTab.tsx` | ✅ |
| `src/components/GameSettingEditor/MapPanel/SceneTab.tsx` | ✅ |
| `src/components/GameSettingEditor/MapPanel/ColorPicker.tsx` | ✅ |
| `src/components/GameSettingEditor/DocumentUpload/DocumentsPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/DocumentUpload/UploadProgressModal.tsx` | ✅ |
| `src/components/GameSettingEditor/DocumentUpload/GenerateFromIdeaModal.tsx` | ✅ |
| `src/components/GameSettingEditor/DocumentUpload/CreateEmptyGameModal.tsx` | ✅ |
| `src/components/GameSettingEditor/UploadMusic/MusicList.tsx` | ✅ |
| `src/components/GameSettingEditor/UploadMusic/UploadMusicModal.tsx` | ✅ |
| `src/components/GameSettingEditor/AttributeGrowthPanel/AttributeGrowthPanel.tsx` | ✅ |
| `src/components/GameSettingEditor/AttributeGrowthPanel/AttributeDetailForm.tsx` | ✅ |
| `src/components/GameSettingEditor/AttributeGrowthPanel/AttributeList.tsx` | ✅ |
| `src/components/GameSettingEditor/Sidebar.tsx` | ✅ |
| `src/components/GameSettingEditor/PDFTemplateModal.tsx` | ✅ |
| `src/components/GameSettingEditor/GenerationActionBar.tsx` | ✅ |

#### StGame ST 游戏组件
| 文件 | 状态 |
|------|------|
| `src/components/StGame/AssetsUpload.tsx` | ✅ |
| `src/components/StGame/StShowdownText.tsx` | ✅ |

#### Admin 管理组件
| 文件 | 状态 |
|------|------|
| `src/components/AdminBannerManager.tsx` | ✅ |
| `src/components/CreatorIncentiveAdminManager.tsx` | ✅ |
| `src/components/PointsAdminManager.tsx` | ✅ |
| `src/components/PromotionAdminManager.tsx` | ✅ |
| `src/components/SpecialThemeTagManager.tsx` | ✅ |
| `src/components/SubscriptionAdminManager.tsx` | ✅ |

#### Other 其他组件
| 文件 | 状态 |
|------|------|
| `src/components/CreatorProfile.tsx` | ✅ |
| `src/components/GameGrid.tsx` | ✅ |
| `src/components/HomeGameFilterBar.tsx` | ✅ |
| `src/components/HomeThemePreviewRail.tsx` | ✅ |
| `src/components/ProtectedRoute.tsx` | ✅ |
| `src/components/RouteReporter.tsx` | ✅ |
| `src/components/AdminRoute.tsx` | ✅ |
| `src/components/Pagination.tsx` | ✅ |
| `src/components/ScrollToTop.tsx` | ✅ |
| `src/components/Skeleton/GameGridSkeleton.tsx` | ✅ |
| `src/components/Skeleton/FullPageLoading.tsx` | ✅ |

---

## 翻译 Key 统计

| 模块 | 中文 Key 数量 | 英文 Key 数量 |
|------|-------------|--------------|
| common | 10 | 10 |
| home | 13 | 13 |
| galgame | 39 | 39 |
| create | 48 | 48 |
| profile | 102 | 102 |
| nav | 13 | 13 |
| search | 5 | 5 |
| auth | 31 | 31 |
| validation | 9 | 9 |
| password | 2 | 2 |
| language | 4 | 4 |
| createGame | 95+ | 95+ |
| gameDetail | 37 | 37 |
| stGame | 6 | 6 |
| promotion | 61 | 61 |
| **总计** | **~720** | **~720** |

---

## 待完成的工作

### 已完成 ✅
- [x] 修复 `Create.tsx` 中的硬编码中文：`我的AVG游戏`、`Kuran号`、`Creator Studio`
- [x] 修复 `AuthModal.tsx` 中的硬编码英文 fallback：`or`
- [x] 修复 `Navbar.tsx` 中的硬编码 aria-label：`Search published games`、`Submit game search`
- [x] 修复 `zh.json` 中的重复 key：`profile.enterInviteCode`
- [x] 添加新的翻译 keys：`common.or`、`create.*`、`nav.searchAriaLabel`、`nav.submitSearch`
- [x] 为 8 个 GameSettingEditor 子组件添加 `useTranslation` hook (`Sidebar`, `DocumentsPanel`, `ScenesPanel`, `WorldMapCard`, `CharactersPanel`, `MapPanel`, `FunctionalNPCsPanel`, `AttributeGrowthPanel`)
- [x] 移除 Admin 管理组件的 i18n 国际化（`CreatorIncentiveAdminManager`, `PromotionAdminManager`, `PointsAdminManager`, `SubscriptionAdminManager`），这些组件不需要多语言
- [x] 删除 `zh.json`/`en.json` 中不再使用的 `createGame.keyList`、`createGame.keyCode`、`createGame.kuranId` 翻译 key
- [x] **GameSettingsEditor.tsx 主页面国际化**：eyebrow、title、step1Tip、step5Tip、testExperience、publishDirectly
- [x] **DocumentsPanel.tsx**：uploadDocument、oneClickUploadTip、withoutDocument
- [x] **CharactersPanel.tsx**：characterProfile、characterProfileTip、characterVariations、variationsCount
- [x] **ScenesPanel.tsx**：sceneAndBgm
- [x] **UploadMusic/MusicList.tsx**：noMusic、clickToAddBgm
- [x] **UploadMusic/UploadMusicModal.tsx**：enterBgmName、enterBgmDescription、uploadMusic modal title
- [x] **StoryStructureAdvanced.tsx**：storyStructureEnabled、storyStructureActiveByDefault、storyStructureIsFinalPhase、storyStructureAutomatic
- [x] **Sidebar.tsx**：导航项完整国际化 (documents/world/characters/scenes/attributeGrowth/functionalNPCs/mapEdit + parsing/completed/inProgress)
- [x] **Firebase Google 登录集成**：
  - 创建 `src/config/firebase.ts` Firebase 配置文件
  - 创建 `src/hooks/useGoogleAuth.ts` Google 登录 Hook
  - `AuthModal.tsx` 添加 Google 登录按钮和逻辑
  - `authApi.ts` 添加 `googleLogin` API 方法
  - 添加国际化 keys：`auth.googleLogin`、`auth.googleLoginFailed`、`auth.loginCancelled`、`auth.networkError`

### 待完成 ⏳
- [ ] 测试语言切换功能
- [ ] 测试各页面文本显示

> **注意**：Step 5-7（MapPanel、FunctionalNPCsPanel、AttributeGrowthPanel）不需要国际化，保持硬编码中文。

---

## 待修复的硬编码文本清单

### 高优先级 - 用户界面可见文本

#### 1. GameSettingEditor 组件 ✅ 已完成

> 所有硬编码文本已国际化。

#### 2. GameSettingEditor 子组件（已添加 hook，待修复文本）

##### Step 1 - DocumentsPanel ✅ 已完成

##### Step 2 - WorldPanel ✅ 已完成

##### StorylinesSection.tsx ✅ 已完成

- 标签、内容字段标签
- 故事线标题、必填/可选提示
- 添加故事线按钮
- 空状态提示
- 序号标签、删除按钮

##### Step 3 - CharactersPanel ✅ 已完成

##### Step 4 - ScenesPanel / UploadMusic ✅ 已完成

##### Step 4 - StoryStructureAdvanced ✅ 已完成

##### Step 5-7 - 不需要国际化

> Step 5-7（MapPanel、FunctionalNPCsPanel、AttributeGrowthPanel）保持硬编码中文。

#### 3. DocumentsPanel 子组件 ✅ 已完成

##### GenerateFromIdeaModal.tsx ✅ 已完成

##### CreateEmptyGameModal.tsx ✅ 已完成

##### UploadProgressModal.tsx ✅ 已完成

##### DocumentsPanel.tsx ✅ 已完成

- 所有 toast 消息已国际化
- 所有弹窗文本已国际化
- parseSteps 步骤已国际化
- 错误提示已国际化

#### 4. CharactersPanel 子组件 ✅ 已完成

##### CharactersSidebar.tsx ✅ 已完成
- 新增角色按钮
- 主角/NPC 标签
- 未命名、空性格标签
- 收起/展开角色

##### CharacterAttributesPanel.tsx ❌ 不需要国际化

##### CharactersPanel.tsx ✅ 已完成
- 弹窗标题、消息、按钮
- 输入框 placeholder
- 删除确认、积分确认
| 876 | `请输入差分标签` | 中文 |
| 899 | `未找到当前差分` | 中文 |
| 1063 | `正在处理立绘缩放...` | 中文 |
| 1099 | `立绘已缩放处理` | 中文 |
| 1102 | `立绘缩放失败，将使用原图` | 中文 |
| 1127 | `属性保存失败，请重试` | 中文 |
| 1196 | `保存时发生错误` | 中文 |
| 1253 | `请先确认增加角色后再上传图片` | 中文 |
| 1258 | `当前有图片任务正在处理，请稍后再试` | 中文 |
| 1265 | `请选择图片文件` | 中文 |
| 1269 | `图片大小不能超过 5MB` | 中文 |
| 1277 | `缺少角色ID，无法上传` | 中文 |
| 1323 | `图片已暂存，请在确认修改后保存` | 中文 |
| 1368 | `请先确认增加角色后再上传图片` | 中文 |
| 1373 | `缺少必要数据，无法上传` | 中文 |
| 1402 | `请先确认增加角色后再生成图片` | 中文 |
| 1407 | `缺少必要数据，无法生成` | 中文 |
| 1446 | `积分不足` | 中文 |
| 1466 | `缺少必要数据，无法生成` | 中文 |
| 1505 | `图片下载成功` | 中文 |
| 1508 | `下载图片失败` | 中文 |
| 1523 | `图片下载成功` | 中文 |
| 1539 | `原生图片下载成功` | 中文 |
| 1543 | `下载图片失败，请稍后重试` | 中文 |
| 1565 | `图片下载成功` | 中文 |
| 1569 | `下载图片失败，请稍后重试` | 中文 |
| 1576 | `缺少必要数据，无法下载` | 中文 |
| 1595 | `图片下载成功` | 中文 |
| 1598 | `下载图片失败，请稍后重试` | 中文 |
| 2232 | `编辑差分` / `新增差分` | 中文 |
| 2409 | `保存失败，请重试` | 中文 |

##### CharactersPanel handlers.ts toast

> 大量 toast 消息（见 handlers.ts，约50+条）

#### 5. ScenesPanel 子组件（待国际化）

#### 5. ScenesPanel 子组件 ✅ 已完成

##### SceneList.tsx ✅ 已完成
- 新增场景/子场景按钮
- 删除场景/子场景按钮
- 待上传、展开/折叠子场景

##### WorldMapCard.tsx ✅ 已完成
- AI 生成、上传按钮
- 正在生成提示

##### SceneDetailForm.tsx ✅ 已完成
- 上传/重新上传按钮
- 场景名称/描述标签
- 特殊 BGM 选择
- 下载图片按钮

##### SceneDetailActions.tsx ✅ 已完成
- 确认增加、确认修改、取消按钮

##### ScenesPanel.tsx ✅ 已完成
- 所有弹窗标题、消息、按钮
- toast 消息
- 加载提示文本

##### ScenesPanel handlers.ts ✅ 已完成
- 所有 toast 消息使用 `ctx.t?()` 国际化

#### 6. 其他组件 ❌ 不需要国际化

| 文件 | 行号 | 硬编码文本 | 类型 |
|------|------|-----------|------|
| `InteractWithNpcModal.tsx` | 308 | `NPC属性` | 中文 |
| `MapPanel\SubSceneTab.tsx` | 513 | `NPC 立绘` | 中文 |

#### 7. StGame 组件 ✅ 已完成

| 文件 | 行号 | 硬编码文本 | 类型 |
|------|------|-----------|------|
| `AssetsUpload.tsx` | 1153 | `ZIP 包` | 中文 |
| `AssetsUpload.tsx` | 1174 | `示例：上传 images/hero.png...` | 中文 |

#### 8. Admin 管理组件 ✅ 已完成（不需要国际化）

> 注意：Admin 管理组件仅供内部使用，不做国际化，保持中文显示。

#### 9. CreateGame 相关组件 ✅ 已完成

| 文件 | 行号 | 硬编码文本 | 类型 |
|------|------|-----------|------|
| `CreateGameModals.tsx` | 82 | `AVG（内测中）` | 中文 |
| `CreatorProfile.tsx` | 186 | `QQ群号` | 中文 |

#### 10. AttributeGrowthPanel 组件 ✅ 已完成

| 文件 | 行号 | 硬编码文本 | 类型 |
|------|------|-----------|------|
| `AttributeDetailForm.tsx` | 67 | `NPC 属性` | 中文 |

---

### 中优先级 - 技术性 UI 标签

#### StoryStructureAdvanced.tsx 中的复杂字段标签

以下字段标签需要国际化（技术性内容，中英文混排）：

```
- story-structure（阶段结构）
- defaultPhase (默认起始阶段 ID)
- enabled（启用 story-structure）
- activeByDefault（默认可进入）
- isFinalPhase（是否终章）
- name, description, context
- setFlags（comma separated）
- dynamicEntries（动态文本条目）
- category, enabled, probability
- activationConditions.flags.required
- maxActivations, sticky, cooldown, order
```

---

### 建议的翻译 Keys 扩展

```json
{
  "gameEditor": {
    "step1": "Step 1",
    "step2": "Step 2",
    "step3": "Step 3",
    "step4": "Step 4",
    "step5": "Step 5",
    "step6": "Step 6",
    "step7": "Step 7",
    "step8": "Step 8",
    "aiSceneDescription": "AI 生成场景描述，可直接选择上一步上传的 BGM",
    "aiGenerateFromIdea": "AI 一句话生成游戏",
    "funloomGuide": "Funloom 创作指南",
    "kuranStudio": "Kuran Studio",
    "aiVisualNovelWorkshop": "AI 视觉小说工坊",
    "npcAttributes": "NPC属性",
    "npcName": "NPC名称",
    "npcType": "NPC类型",
    "npcPortrait": "NPC 立绘",
    "bgmLibrary": "BGM 音乐库",
    "bgmName": "BGM 名称",
    "bgmDescription": "BGM 描述",
    "zipPackage": "ZIP 包",
    "zipReferenceTip": "示例：上传 images/hero.png 后，可通过 ./images/hero.png 引用。",
    "keyList": "Key 列表",
    "keyCode": "Key 编码",
    "qqGroup": "QQ群号",
    "avgBeta": "AVG（内测中）",
    "kuranId": "Kuran号",
    "npcAttribute": "NPC 属性"
  }
}
```

---

## 国际化命名规范

### Key 命名规范
```
模块.功能.具体描述

示例:
- gameDetail.back => "返回"
- gameDetail.share => "分享"
- auth.googleLogin => "使用谷歌账号登录"
```

### 文件命名
- 中文翻译: `src/i18n/locales/zh.json`
- 英文翻译: `src/i18n/locales/en.json`

### 使用方式
```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  return <button>{t('gameDetail.back')}</button>;
};
```

---

## 进度总结

- **总文件数**: 约 139 个 TSX 文件 + 156 个 TS 文件
- **已完成国际化**: 约 130 个文件
- **完成率**: ~95%
- **主要翻译模块**: 16 个模块，720+ 个翻译 key
- **Firebase 集成**: 已完成 Google 登录功能
