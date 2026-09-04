# funloom home icons (`assetsv2/home`)

高清 WebP（默认 **192×192**），来源严格为 `Downloads/download`：

1. **SVG 矢量** → `@resvg/resvg-js` 栅格化到 256，再规范到 192（导航/编辑/社群等）
2. **@3x/@4x 效果图容器** → 裁切按钮内图标（手柄、胶片等）
3. **切图 PNG** → LANCZOS/NEAREST 放大后导出（补齐无 SVG 的符号）

## 关键导航

| 文件 | 含义 | 来源 |
|------|------|------|
| `nav_menu.webp` | 汉堡菜单 | 容器 7713@4x 裁切 |
| `nav_search.webp` | 搜索 | `路径-11.svg` |
| `nav_message.webp` / `nav_message.svg` | 消息（圆角气泡+两行文案，对齐效果图顶栏） | 图2 / 容器 7713 顶栏消息 glyph |
| `nav_btn_bg.webp` / `nav_btn_bg.png` | 顶栏圆形按钮半透明底 | 效果图 `___1041@3x` |
| `nav_back.webp` | 返回 | 切图 PNG |
| `nav_chevron_right.webp` | 向右 | 切图 PNG |

## 详情 / 操作

| 文件 | 含义 | 来源 |
|------|------|------|
| `icon_gamepad.webp` | 开始体验/游戏 | 容器 7718@3x 按钮裁切 |
| `icon_filmstrip.webp` / `icon_playback.webp` | 剧情回放 | 同上 |
| `icon_edit.webp` | 编辑 | `切图 72.svg` |
| `icon_share.webp` | 分享 | 切图 PNG |
| `icon_star.webp` | 收藏 | 切图 PNG |
| `icon_heart.webp` / `icon_heart_pink.webp` | 点赞 | 切图 PNG |
| `icon_eye.webp` | 浏览 | 切图 PNG |
| `icon_download.webp` | 下载/播放量角标 | 切图 PNG |
| `icon_community.webp` / `icon_group.webp` | 交流群 | `切图 74.svg` |
| `icon_flame_pink.webp` / `icon_hot.webp` | 热门 | 切图 PNG |
| `icon_comment.webp` | 评论 | `切图 78.svg` |

## 数据概览

| 文件 | 含义 |
|------|------|
| `stats_play.webp` | 播放 |
| `stats_view.webp` | 点击/浏览 |
| `stats_income.webp` | 收益 |
| `stats_share.webp` | 分享 |

完整映射见 `manifest.json`。页面内展示约 20–24px，源图 192 以保证 Retina 清晰。
