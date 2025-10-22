# StoryData 文件夹说明

## 📖 目录简介

`StoryData` 文件夹用于存储游戏中心的**游戏列表数据**，所有可选的游戏故事信息都存放在这里。

## 📂 文件结构

```
StoryData/
├── games.json          # 游戏列表数据文件
├── covers/             # 游戏封面图片文件夹
│   ├── fantasy-world.png
│   ├── mystery-mansion.png
│   ├── cultivation-journey.png
│   └── README.md      # 封面图片说明文档
└── README.md           # 本说明文档
```

## 📄 games.json 说明

### 文件用途

`games.json` 存储了游戏中心展示的所有游戏信息，包括：
- 游戏基本信息（标题、副标题、图标等）
- 游戏封面图片
- 游戏标签和分类
- 游戏简介和详细描述
- 游戏特色功能列表
- 游戏统计信息（难度、时长、状态）

### 数据格式

文件格式为 **JSON 数组**，每个元素代表一个游戏：

```json
[
    {
        "id": "game-id",              // 游戏唯一标识符
        "title": "游戏名称",          // 游戏标题
        "subtitle": "游戏副标题",     // 游戏副标题/类型说明
        "icon": "🎮",                 // 游戏图标（emoji）
        "cover": "图片路径",          // 封面图片路径
        "tags": ["标签1", "标签2"],   // 游戏标签数组
        "description": "简短描述",    // 卡片展示的简短描述
        "fullDescription": "完整描述", // 详情面板的完整描述
        "features": [                 // 游戏特色列表
            {
                "title": "特色名称",
                "desc": "特色描述"
            }
        ],
        "stats": {                    // 游戏统计信息
            "difficulty": "难度",     // 游戏难度
            "playtime": "游戏时长",   // 预计游戏时长
            "status": "状态"          // 开发状态
        }
    }
]
```

## ✏️ 如何添加新游戏

### 步骤 1：准备游戏资源

1. **封面图片**：准备一张游戏封面图（推荐尺寸：800x800 像素 正方形）⭐
   - 将图片放入 `StoryData/covers/` 文件夹
   - 命名格式：`游戏id.png` （如：`my-game.png`）
   - 必须是正方形（1:1 比例），卡片会完整展示封面
2. **游戏图标**：选择一个合适的 emoji 表情
3. **游戏内容**：编写游戏简介、特色等文字内容

### 步骤 2：编辑 games.json

打开 `StoryData/games.json` 文件，在数组末尾添加新游戏数据：

```json
[
    // ... 现有游戏 ...
    ,
    {
        "id": "my-new-game",
        "title": "我的新游戏",
        "subtitle": "精彩的冒险故事",
        "icon": "✨",
        "cover": "StoryData/covers/my-new-game.png",
        "tags": ["冒险", "RPG", "新作"],
        "description": "这是一个充满惊喜的冒险游戏，你将体验到前所未有的游戏乐趣。",
        "fullDescription": "详细的游戏背景故事和世界观介绍，可以写得更长更详细...",
        "features": [
            { "title": "创新玩法", "desc": "全新的游戏机制" },
            { "title": "精美画面", "desc": "视觉效果出众" },
            { "title": "丰富剧情", "desc": "引人入胜的故事" }
        ],
        "stats": {
            "difficulty": "中等",
            "playtime": "3-6小时",
            "status": "开发中"
        }
    }
]
```

### 步骤 3：保存并测试

1. 保存 `games.json` 文件
2. 确保 JSON 格式正确（可使用在线 JSON 验证工具）
3. 刷新 `StartGame.html` 页面
4. 检查新游戏是否正确显示

## 🔍 字段说明

### 必填字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | String | 游戏唯一标识 | `"fantasy-world"` |
| `title` | String | 游戏标题 | `"幻想大陆"` |
| `subtitle` | String | 游戏副标题 | `"经典奇幻冒险RPG"` |
| `icon` | String | 游戏图标emoji | `"⚔️"` |
| `cover` | String | 封面图片路径 | `"StoryData/covers/fantasy-world.png"` |
| `tags` | Array | 游戏标签 | `["奇幻", "RPG"]` |
| `description` | String | 简短描述 | `"在充满魔法的世界..."` |
| `fullDescription` | String | 完整描述 | `"这是一个充满魔法..."` |
| `features` | Array | 游戏特色 | 见下方说明 |
| `stats` | Object | 统计信息 | 见下方说明 |

### features 数组格式

```json
"features": [
    {
        "title": "特色名称",    // 特色标题
        "desc": "特色描述"      // 特色详细说明
    }
]
```

### stats 对象格式

```json
"stats": {
    "difficulty": "简单/中等/较难/困难",  // 游戏难度
    "playtime": "1-2小时",               // 预计游戏时长
    "status": "正式版/Beta版/开发中/即将推出"  // 开发状态
}
```

## ⚠️ 注意事项

1. **JSON 格式**
   - 确保 JSON 格式正确，注意逗号和引号
   - 最后一个元素后面不要加逗号
   - 使用双引号 `"` 而不是单引号 `'`

2. **游戏 ID**
   - 必须唯一，不能与其他游戏重复
   - 建议使用小写字母和连字符，如 `my-game`
   - 不要使用空格或特殊字符

3. **图片路径**
   - 封面图片统一存放在 `StoryData/covers/` 文件夹
   - 路径格式：`StoryData/covers/游戏id.png`
   - 确保图片文件存在
   - 支持的格式：PNG、JPG、WEBP

4. **标签建议**
   - 每个游戏 3-5 个标签为宜
   - 标签要简洁明了
   - 常用标签：奇幻、RPG、冒险、解谜、悬疑、修真、武侠等

## 🎮 当前游戏列表

| 游戏 ID | 游戏名称 | 状态 | 难度 |
|---------|---------|------|------|
| `fantasy-world` | 幻想大陆 | 正式版 | 中等 |
| `mystery-mansion` | 神秘庄园 | 开发中 | 较难 |
| `cultivation-journey` | 修仙之路 | 即将推出 | 中等 |

## 🛠️ 数据验证

在修改 `games.json` 后，可以使用以下方法验证数据：

### 方法 1：在线工具
访问 [JSONLint](https://jsonlint.com/) 粘贴代码验证

### 方法 2：浏览器控制台
1. 打开 `StartGame.html`
2. 按 `F12` 打开开发者工具
3. 查看 Console 标签页
4. 如果数据加载成功，会显示：`游戏数据加载成功: X 个游戏`
5. 如果有错误，会显示具体的错误信息

## 💡 扩展建议

未来可以考虑在此文件夹中添加：

1. **游戏详细配置**
   - 每个游戏独立的配置文件
   - 例如：`fantasy-world.json`、`mystery-mansion.json`

2. **多语言支持**
   - `games.zh-CN.json` - 简体中文
   - `games.en-US.json` - 英文

3. **游戏分类**
   - `categories.json` - 游戏分类和筛选规则

---

**编辑愉快！** 🎮✨

