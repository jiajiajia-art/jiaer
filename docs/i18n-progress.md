# 国际化 (i18n) 改造进度

> 更新时间: 2026-06-02 15:33

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
| `src/i18n/locales/zh.json` | ✅ 完成 | ~460 keys |
| `src/i18n/locales/en.json` | ✅ 完成 | ~460 keys |

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

### 新增翻译 Keys (2026-05-27)

| Key | 中文 | 英文 | 用途 |
|-----|------|------|------|
| `createGame.selectGameTypeTitle` | 选择需创建游戏类型 | Select Game Type to Create | 创建游戏类型选择弹窗标题 |
| `createGame.selectGameTypeDesc` | 请选择你要创作的游戏形态，我们会为你匹配合适的创作流程。 | Please select the type of game you want to create... | 创建游戏类型选择描述 |
| `createGame.recommend` | 推荐 | Recommended | 推荐标签 |
| `createGame.new` | 新 | New | 新功能标签 |
| `createGame.custom` | 自定义 | Custom | 自定义选项 |
| `createGame.locked` | 待解锁 | Locked | 待解锁标签 |
| `createGame.cancel` | 取消 | Cancel | 取消按钮 |
| `createGame.bindPhoneFirst` | 建议先绑定手机号 | It is recommended to bind your phone number first | 绑定手机提示 |
| `createGame.bindPhoneTip` | 绑定后可在小程序端和 PC 端使用同一个账号。 | After binding, you can use the same account on both... | 绑定手机说明 |
| `createGame.generationComplete` | 生成结果 | Generation Complete | 生成结果弹窗标题 |
| `createGame.successGenerated` | 成功生成 {{count}} 张图片 | Successfully generated {{count}} image(s) | 成功生成提示 |
| `createGame.thisTimeDeducted` | 本次扣除 {{points}} 积分 | Points deducted this time: {{points}} | 积分扣除提示 |
| `createGame.remainingPoints` | 剩余 {{points}} 积分 | Remaining points: {{points}} | 剩余积分提示 |
| `common.retry` | 重试 | Retry | 重试按钮 |
| `eta.minutes` | 分钟 | minutes | 时间单位 |
| `eta.second` | 秒 | seconds | 时间单位 |
| `eta.minutesAndSeconds` | {{minutes}} 分 {{seconds}} 秒 | {{minutes}} min {{seconds}} sec | 复合时间格式 |
| `eta.remaining` | 预计还需 | Estimated remaining | 预计剩余时间 |
| `eta.takingLonger` | 耗时较长，仍在处理中，请稍候 | Taking longer than expected, still processing... | 处理耗时提示 |
| `eta.generating` | 正在生成第 | Generating item | 生成进度 |
| `eta.generatingMoreTime` | 生成时间比平时更长，请继续等待 | Generation is taking longer than usual... | 超时提示 |
| `eta.item` | 项 | items | 项目计数 |
| `eta.total` | 本次共生成 | Total to generate | 总数提示 |
| `eta.completed` | 已完成 | Completed | 已完成状态 |
| `eta.success` | 成功 | Success | 成功状态 |
| `eta.failed` | 失败 | Failed | 失败状态 |
| `eta.remaining` | 剩余 | Remaining | 剩余数量 |

### 新增翻译 Keys (2026-05-27 下午)

| Key | 中文 | 英文 | 用途 |
|-----|------|------|------|
| `createGame.generatingCharacterPortrait` | 正在生成角色立绘... | Generating character portrait... | 角色立绘生成中 |
| `createGame.generatingDoNotLeave` | 正在生成中，请勿离开当前页面或重复操作 | Generating, please do not leave the page... | 生成中提示 |
| `createGame.generatingScenePortraits` | 正在生成场景立绘... | Generating scene portraits... | 场景立绘生成中 |
| `createGame.divider` | 分界线 | Divider | 分隔线图片 alt |
| `createGame.statsUpdateDaily` | 每晚12:00更新 | Updates daily at 12:00 AM | 统计更新时间提示 |
| `createGame.arrow` | 箭头 | Arrow | 箭头图片 alt |
| `createGame.views` | 浏览量 | Views | 浏览量标签 |
| `createGame.clicks` | 点击 | Clicks | 点击量标签 |
| `createGame.earnings` | 收益 | Earnings | 收益标签 |
| `createGame.untitledScript` | 未命名剧本 | Untitled Script | 未命名游戏标题 |
| `createGame.reviews` | 人评论 | reviews | 评论数后缀 |
| `createGame.loading` | 加载中... | Loading... | 加载状态 |
| `createGame.startTesting` | 开始测试 | Start Testing | 开始测试按钮 |
| `createGame.publish` | 发布 | Publish | 发布按钮 |
| `createGame.unpublish` | 下架 | Unpublish | 下架按钮 |
| `createGame.editGame` | 编辑游戏 | Edit Game | 编辑游戏按钮 |
| `createGame.deleting` | 删除中... | Deleting... | 删除中状态 |
| `createGame.deleteGame` | 删除游戏 | Delete Game | 删除游戏按钮 |
| `createGame.userInfoError` | 用户信息错误，无法创建 session | User info error, cannot create session | 用户信息错误提示 |
| `createGame.unknownGameType` | 未知的游戏类型，无法创建会话 | Unknown game type, cannot create session | 未知游戏类型提示 |
| `createGame.missingCustomAppIdStart` | 缺少自定义 AppID，无法开始游戏 | Missing custom AppID, cannot start game | 缺少 AppID 提示 |
| `createGame.createGameFailed` | 创建游戏失败，请重试 | Failed to create game, please try again | 创建失败提示 |
| `createGame.loadSaveFailed` | 加载存档失败 | Failed to load save | 加载存档失败提示 |
| `createGame.loadMore` | 加载更多 | Load More | 加载更多按钮 |
| `createGame.game` | 游戏 | Game | 游戏默认标题 |
| `createGame.replayVisibilityPrivate` | 私密 | Private | 回放可见性 - 私密 |
| `createGame.replayVisibilityUnlisted` | 仅链接可见 | Unlisted | 回放可见性 - 仅链接可见 |
| `createGame.replayVisibilityPublic` | 公开 | Public | 回放可见性 - 公开 |
| `createGame.loadReplayFailed` | 加载回放失败 | Failed to load replays | 加载回放失败提示 |
| `createGame.copyReplayLinkFailed` | 复制回放链接失败 | Failed to copy replay link | 复制链接失败提示 |
| `createGame.replayLinkCopied` | 回放链接已复制，仅持链接者可查看 | Replay link copied, only link holders can view | 复制成功提示 |
| `createGame.publicReplayLinkCopied` | 公开回放链接已复制 | Public replay link copied | 复制成功提示 |
| `createGame.replayDeleted` | 回放已删除 | Replay deleted | 删除成功提示 |
| `createGame.canOnlyDeleteOwnReplay` | 只能删除自己创建的回放 | You can only delete your own replays | 删除权限错误 |
| `createGame.replayNotExist` | 回放不存在或已删除 | Replay does not exist or has been deleted | 回放不存在提示 |
| `createGame.deleteReplayFailed` | 删除回放失败，请稍后重试 | Failed to delete replay, please try again later | 删除失败提示 |
| `createGame.loadingReplay` | 正在加载回放... | Loading replays... | 加载状态 |
| `createGame.noReplay` | 暂无回放 | No replays yet | 空状态 |
| `createGame.collapse` | 收起 | Collapse | 收起按钮 |
| `createGame.expand` | 展开 | Expand | 展开按钮 |
| `createGame.mine` | 我的 | Mine | 我的标签 |
| `createGame.steps` | 步 | steps | 步数单位 |
| `createGame.play` | 播放 | Play | 播放按钮 |
| `createGame.copyLink` | 复制链接 | Copy Link | 复制链接按钮 |
| `createGame.deleting` | 删除中... | Deleting... | 删除中状态 |
| `createGame.delete` | 删除 | Delete | 删除按钮 |
| `createGame.deleteReplay` | 删除回放 | Delete Replay | 删除弹窗标题 |
| `createGame.confirmDeleteReplay` | 确认删除该回放？删除后不可恢复。 | Confirm delete this replay? This action cannot be undone. | 删除确认消息 |
| `createGame.confirmDelete` | 确认删除 | Confirm Delete | 确认删除按钮 |
| `createGame.authorAvatar` | 作者头像 | Author Avatar | 作者头像 alt |
| `createGame.copyGroupNo` | 复制群号 | Copy Group Number | 复制群号按钮 title |
| `createGame.replayVisibilityFilter` | 回放可见范围筛选 | Replay Visibility Filter | 回放筛选 aria-label |
| `createGame.replayOperation` | 回放操作 | Replay Operation | 回放操作标签 |
| `createGame.settings` | 设置 | Settings | 设置弹窗标题 |
| `createGame.music` | 音乐 | Music | 音乐开关标签 |
| `createGame.musicToggle` | 背景音乐开关 | Background Music Toggle | 音乐开关描述 |
| `createGame.volume` | 音量 | Volume | 音量标签 |
| `createGame.restart` | 重新开始 | Restart | 重新开始按钮 |
| `createGame.saveAndExit` | 保存并退出 | Save and Exit | 保存并退出按钮 |
| `createGame.narration` | 旁白 | Narration | 旁白标签 |
| `createGame.pointsUnit` | 积分 | Points | 积分单位 |
| `createGame.orCustomInput` | 或者自定义输入 | Or custom input | 或者自定义输入 |
| `createGame.customInput` | 自定义输入 | Custom Input | 自定义输入 |
| `createGame.pointsCostHint` | 消耗 {{cost}} 积分 | Costs {{cost}} points | 积分消耗提示 |
| `createGame.inputPlaceholder` | 输入你想说的话或行动... | Enter what you want to say... | 输入框占位符 |
| `createGame.send` | 发送 | Send | 发送按钮 |
| `createGame.noContent` | 暂无内容 | No content yet | 空状态 |
| `createGame.organizingMemory` | 正在整理故事记忆 | Organizing story memory | 整理记忆状态 |
| `createGame.aiThinking` | AI 推演中 | AI Thinking | AI 思考状态 |
| `createGame.history` | 历史记录 | History | 历史记录标题 |
| `createGame.noHistory` | 暂无历史记录 | No history yet | 空状态 |
| `createGame.saving` | 保存中... | Saving... | 保存中状态 |
| `createGame.save` | 保存 | Save | 保存按钮 |
| `createGame.editMessage` | 编辑消息 | Edit Message | 编辑按钮 title |
| `createGame.edit` | 编辑 | Edit | 编辑按钮文本 |
| `createGame.regenerate` | 重新生成 | Regenerate | 重新生成按钮 |
| `createGame.myReplay` | 我的回放 | My Replay | 默认标题 |
| `createGame.close` | 关闭 | Close | 关闭按钮 |
| `createGame.titleLabel` | 标题 | Title | 标题标签 |
| `createGame.titlePlaceholder` | 如：第一章·与艾琳的选择 | e.g., Chapter 1·Choice with Eileen | 标题占位符 |
| `createGame.descriptionOptional` | 简介（可选） | Description (Optional) | 描述标签 |
| `createGame.descriptionPlaceholder` | 简要说明这个回放发生了什么 | Briefly describe what happened... | 描述占位符 |
| `createGame.visibility` | 可见性 | Visibility | 可见性标签 |
| `createGame.public` | 公开 | Public | 公开选项 |
| `createGame.unlisted` | 不公开（持链接可见） | Unlisted (Link holders only) | 不公开选项 |
| `createGame.privateVisibility` | 私密（仅自己可见） | Private (Only visible to you) | 私密选项 |
| `createGame.creating` | 创建中… | Creating... | 创建中状态 |
| `createGame.createReplay` | 创建回放 | Create Replay | 创建回放按钮 |
| `common.download` | 下载 | Download | 下载按钮 |
| `home.specialThemeTagCodes.official-picks` | 官方精选 | Featured | 首页 special theme tag 翻译 |

### 新增翻译 Keys (2026-06-02)

| Key | 中文 | 英文 | 用途 |
|-----|------|------|------|
| `createGame.storylineModalEditTitle` | 编辑故事线 | Edit Storyline | 故事线编辑弹窗标题 |
| `createGame.storylineModalAddTitle` | 添加故事线 | Add Storyline | 故事线添加弹窗标题 |
| `createGame.storylineModalIndexPlaceholder` | 输入序号 | Enter order number | 序号输入框占位符 |
| `createGame.storylineModalTagPlaceholder` | 例如：阶段 1、第一章、关键转折点 | e.g., Stage 1, Chapter 1, Key Turning Point | 标签输入框占位符 |
| `createGame.storylineModalContentPlaceholder` | 描述关键剧情走向... | Describe key plot developments... | 内容输入框占位符 |
| `createGame.statusUpload` | 上传中 | Uploading | 上传状态 |
| `createGame.statusParsing` | 解析中 | Parsing | 解析状态 |
| `createGame.statusComplete` | 完成 | Complete | 完成状态 |
| `createGame.statusFailed` | 失败 | Failed | 失败状态 |
| `createGame.statusProcessing` | 处理中 | Processing | 处理状态 |
| `createGame.remove` | 移除 | Remove | 移除按钮 |
| `createGame.fileId` | 文件ID | File ID | 文件ID标签 |
| `common.minute` | 分 | min | 分钟单位 |
| `common.second` | 秒 | seconds | 秒单位 |
| `createGame.uploadTimeout` | 上传超时，请重试 | Upload timeout, please retry | 超时错误 |
| `createGame.parsingCompleteLoadFailed` | 文件解析完成，但加载数据失败，请刷新页面 | File parsing complete, but failed to load data... | 加载失败提示 |
| `createGame.parsingCompleteMissingFileId` | 完成但缺少 fileId | Completed but missing fileId | 缺少 fileId 错误 |
| `createGame.parsingFailed` | 解析失败，请重试 | Parsing failed, please retry | 解析失败提示 |
| `createGame.jobNotFound` | 任务不存在或已回收 | Task does not exist or has been recycled | 任务不存在错误 |
| `createGame.jobNotFoundRetry` | 任务不存在或已回收，请重试上传 | Task does not exist or has been recycled... | 重试提示 |
| `createGame.pollingFailed` | 轮询状态失败，请重试 | Status polling failed, please retry | 轮询失败提示 |
| `createGame.ideaGenerationOnlyVisual` | 一句话生成功能仅在 visual 模式下可用 | Idea generation is only available in visual mode | 模式不支持提示 |
| `createGame.generatingGame` | 生成游戏 | Generating game | 生成游戏标题 |
| `createGame.inQueue` | 排队中 | In queue | 排队状态 |
| `createGame.uploadFailed` | 上传失败，请重试 | Upload failed, please retry | 上传失败提示 |

---

## API i18n 映射 (2026-06-02)

### `/api/auth/special-theme-tags` 响应字段

| 字段 | 说明 | i18n 映射 |
|------|------|-----------|
| `code` | 标签唯一标识 | `home.specialThemeTagCodes.{code}` |
| `name` | 后端返回名称（不直接使用） | fallback |

> **展示优先级**: i18n 翻译 → API name (fallback)

---

## 新增文件

### Utils 工具函数 ✅
||| 文件 | 说明 |
||------|------|
|| `src/utils/etaText.ts` | ETA 文本格式化工具，支持可选翻译函数参数 |

### Hooks ✅
||| 文件 | 说明 |
||------|------|
|| `src/hooks/editor/useBatchImageProgressText.ts` | 批量图片进度文本 Hook，内置 i18n |
|| `src/hooks/editor/useGenerationEta.ts` | 生成 ETA Hook，内置 i18n |
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
| `src/components/CreateGame/CreateGameModals.tsx` | ✅ |

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
| `src/components/Galgame/NormalModeDisplay.tsx` | ✅ |

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
| common | 11 | 11 |
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
| createGame | 200+ | 200+ |
| gameDetail | 37 | 37 |
| stGame | 6 | 6 |
| promotion | 61 | 61 |
| eta | 11 | 11 |
| **总计** | **~850** | **~850** |

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
- [x] **GameStatsView.tsx** (2026-05-27)：
  - 新增 23 个翻译 keys（myData、divider、statsUpdateDaily、arrow、views、clicks、earnings、untitledScript、reviews、loading、startTesting、publish、unpublish、editGame、deleting、deleteGame、userInfoError、unknownGameType、missingCustomAppIdStart、createGameFailed、loadSaveFailed、loadSaveFailedRetry、aiGenerate）
  - 替换所有硬编码中文：统计面板标签、按钮文本、alert 消息、图片 alt 属性
- [x] **SceneDetailForm.tsx** (2026-05-27)：AI生成 按钮文本国际化
- [x] **CharactersPanel.tsx** (2026-05-27)：AI生成 按钮文本国际化（1处）
- [x] **ReplayList.tsx** (2026-05-27)：
  - 新增 26 个翻译 keys（replayVisibilityPrivate/Unlisted/Public、loadReplayFailed、copyReplayLinkFailed、replayLinkCopied、publicReplayLinkCopied、replayDeleted、canOnlyDeleteOwnReplay、replayNotExist、deleteReplayFailed、loadingReplay、noReplay、collapse、expand、mine、steps、play、copyLink、deleting、delete、loadMore、deleteReplay、confirmDeleteReplay、confirmDelete、replayOperation）
  - 替换所有硬编码中文：可见性标签、按钮文本、toast 消息、空状态、ConfirmModal
- [x] **GameDetail.tsx** (2026-05-27)：
  - 回放集锦标签：`回放集锦` → `t('gameDetail.replayHighlights')`
  - QQ群号：`QQ群：` → `{t('gameDetail.qqGroup')}: `
  - 作者头像 alt：`作者头像` → `t('createGame.authorAvatar')`
  - 复制群号 title：`复制群号` → `t('createGame.copyGroupNo')`
  - 回放筛选 aria-label：`回放可见范围筛选` → `t('createGame.replayVisibilityFilter')`
  - 默认标题：`'游戏'` → `t('createGame.game')`
- [x] **SettingsModal.tsx** (2026-05-27)：设置弹窗国际化（设置、音乐、背景音乐开关、音量、重新开始、保存并退出）
- [x] **TextModeDisplay.tsx** (2026-05-27)：文本模式国际化（旁白、积分、输入、自定义输入、发送、空状态、AI思考、整理记忆）
- [x] **GalgameHistoryModal.tsx** (2026-05-27)：历史记录弹窗国际化（历史记录、空状态、编辑、重新生成、保存、取消）
- [x] **ShareReplayModal.tsx** (2026-05-27)：分享回放弹窗国际化（标题、简介、可见性、创建回放）
- [x] **CreateGame.tsx** (2026-05-27)：
  - 将 `'未找到游戏详情'` 替换为 `t('createGame.gameNotFound')`
- [x] **CreateGameModals.tsx** (2026-05-27 下午)：
  - 新增 9 个翻译 keys
  - 所有弹窗文本国际化（标题、描述、标签、按钮）
- [x] **NormalModeDisplay.tsx** (2026-05-27 下午)：
  - 所有中文文本国际化（自定义输入、输入框 placeholder、发送按钮、AI思考、整理记忆）
- [x] **GenerateResultModal.tsx** (2026-05-27 下午)：
  - 新增 5 个翻译 keys
  - 默认值改为使用 `t()` 函数
- [x] **etaText.ts / useBatchImageProgressText.ts / useGenerationEta.ts** (2026-05-27 下午)：
  - 重构 `etaText.ts` 支持可选翻译函数参数
  - `useBatchImageProgressText.ts` 内置 `useTranslation`
  - `useGenerationEta.ts` 内置 `useTranslation`
  - 新增 `eta` 节翻译（11个keys）
- [x] **CharactersPanel.tsx** (2026-05-27 下午)：
  - 批量生成角色立绘进度文本国际化
- [x] **ScenesPanel.tsx** (2026-05-27 下午)：
  - 批量生成场景立绘进度文本国际化

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

##### StorylineModal.tsx ✅ 已完成 (2026-06-02)

- 添加 `useTranslation` hook
- 标题：编辑故事线 / 添加故事线 (`storylineModalEditTitle` / `storylineModalAddTitle`)
- 序号标签 (`storylineOrder`)
- 序号占位符 (`storylineModalIndexPlaceholder`)
- 标签占位符 (`storylineModalTagPlaceholder`)
- 内容标签 (`storylineContent`)
- 内容占位符 (`storylineModalContentPlaceholder`)
- 取消按钮 (`common.cancel`)
- 保存按钮 (`common.save`)

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

##### GameStatsView.tsx ✅ 已完成 (2026-05-27)
- `myData` - 我的数据
- `divider` - 分界线
- `statsUpdateDaily` - 每晚12:00更新
- `arrow` - 箭头
- `views` - 浏览量
- `clicks` - 点击
- `earnings` - 收益
- `untitledScript` - 未命名剧本
- `reviews` - 人评论
- `loading` - 加载中...
- `startTesting` - 开始测试
- `publish` - 发布
- `unpublish` - 下架
- `editGame` - 编辑游戏
- `deleting` - 删除中...
- `deleteGame` - 删除游戏
- `userInfoError` - 用户信息错误
- `unknownGameType` - 未知的游戏类型
- `missingCustomAppIdStart` - 缺少自定义 AppID
- `createGameFailed` - 创建游戏失败
- `loadSaveFailed` - 加载存档失败
- `loadSaveFailedRetry` - 加载存档失败（重试）

##### `textUtils.ts` 场景切换文案 ✅ 已完成 (2026-06-04)
- `sceneChangePrefix` - 场景切换：
- 已将 `SCENE_CHANGE` 解析结果中的固定前缀改为翻译 key，并在历史记录渲染链路中传入 `t`


| 文件 | 行号 | 硬编码文本 | 类型 |
|------|------|-----------|------|
| `AttributeDetailForm.tsx` | 67 | `NPC 属性` | 中文 |

#### 本次补充说明（2026-06-04）

本次在 `GameStatsView.tsx` 这一块继续完善国际化记录，重点不是新增组件，而是把已经完成的文案改造过程补写得更清楚，便于后续追踪和补齐遗漏项。

- 这一段记录的是 `GameStatsView.tsx` 相关的统计面板文案国际化状态，包含“我的数据”“分界线”“每晚12:00更新”“浏览量”“点击”“收益”“未命名剧本”“人评论”“加载中”“开始测试”“发布”“下架”“编辑游戏”“删除中”“删除游戏”等按钮、标签和状态文案。
- 同时也把异常和兜底提示一并纳入记录，例如“用户信息错误”“未知的游戏类型”“缺少自定义 AppID”“创建游戏失败”“加载存档失败”等，这些属于运行时提示，之前容易在页面翻译完成后被忽略。
- 这类文案的国际化重点是统一命名和统一接入翻译 key，避免同义文案在不同组件里重复硬编码，后续便于维护和批量替换。
- 由于这个模块偏“管理台 / 数据统计”性质，文案里混有业务词和界面词，所以在记录时除了说明 key 名称，也尽量保留原始中文语义，方便英文翻译对照和审核。
- 如果后续还继续整理 `CreateGame` 相关统计、运营或编辑区块，建议沿用同样的记录方式，把“已完成的 key + 作用场景 + 未覆盖的边角提示”一起写清楚。

#### 这部分的记录价值

- 方便确认 `GameStatsView.tsx` 已经完成到什么程度。
- 方便后续检查是否遗漏了统计面板里的状态提示、按钮 title、空状态文案。
- 方便把“页面主文案”和“异常提示文案”一起纳入国际化范围，避免只完成视觉文本、没完成行为文本。

####`textUtils.ts` 中 `SCENE_CHANGE` 的输出文案 `场景切换：`

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
- **已完成国际化**: 约 135 个文件
- **完成率**: ~97%
- **主要翻译模块**: 17 个模块，850+ 个翻译 key
- **Firebase 集成**: 已完成 Google 登录功能
- **最新更新 (2026-05-27 下午)**: eta 工具函数国际化、CreateGameModals、GenerateResultModal、NormalModeDisplay 等组件国际化
