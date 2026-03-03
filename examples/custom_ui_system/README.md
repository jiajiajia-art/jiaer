# 单文件自定义 UI 加载系统说明（Simple HTML UI Loader）

本说明介绍当前示例中“单文件 HTML 自定义界面”方案的设计、用法与接口。目标是让使用方只提供一个 HTML 文件，系统即可把该界面完整加载到 Shadow DOM 中运行，与宿主保持样式与事件隔离，同时通过统一的 `gameAPI` 与宿主通信。

## 目录结构

- examples/custom_ui_multilayer.html
  - 入口页面（演示用）。已接入 `simple_loader.js`，会自动加载用户的 HTML。
- examples/custom_ui_system/
  - host.js：Shadow DOM 宿主与基础层管理（定位、层级、根容器）。
  - simple_loader.js：单文件 HTML 加载器（加载、挂载、脚本执行、API 暴露）。
- examples/custom_ui/user_ui.html
  - 用户提供的单个 HTML 文件（可直接替换）。

## 设计原则

- 单文件接入：仅需一个 HTML（可含内联/外链 CSS 与 JS），无需清单或页面栈配置。
- Shadow DOM 隔离：用户 UI 在 Shadow DOM 内渲染，样式与事件天然隔离，避免干扰宿主页面。
- 渲染顺序可控：先挂载静态 DOM，再顺序执行 HTML 中的 `<script>`，确保用户脚本能找到已渲染的节点。
- 只占可见区域：宿主 Shadow 根锚定在画布右上角（不铺满）；自定义 UI 仅在自身可见区域内接管交互，其余点击天然透传给宿主。
- 简单通信：系统向用户脚本暴露 `window.gameAPI`；若需要更复杂通信，可扩展 postMessage 或共享数据总线。

## 工作流程（simple_loader.js）

1. 创建宿主（`host.js`）：在 `#custom-ui-root` 下建立 ShadowRoot，并准备状态/事件桥接（`gameAPI`）。
2. 加载用户 HTML：默认从 `../custom_ui/user_ui.html` 获取文本。
3. 解析与挂载：用 `<template>` 解析成 DOM 片段，先移除其中的 `<script>` 后把 DOM 挂到 Shadow DOM。
4. 执行脚本：逐个复刻 `<script>`（保持属性与 src），在 Shadow DOM 中依序注入执行，并提供 `window.__CUSTOM_UI_SHADOW__` 便于脚本定位根节点。
5. 暴露接口：`window.gameAPI` 挂到全局（用户脚本可直接调用）。

## 页面定义要求（必须遵守）

为确保宿主（对话/按钮等）保持可交互，自定义 UI 必须仅占据“自身可见区域”，不要铺满整个舞台。

- 布局锚点
  - 系统 Shadow 根锚定在右上角：`position:absolute; top:0; right:0`。
  - 建议你的主面板容器（如 `.user-hud`）使用 `position: static` 或仅设置右上角偏移，不要 `inset:0` 或 `100vw/100vh`。
  - 示例（推荐）：
    ```css
    .user-hud { position: static; width: 280px; margin: 16px 16px 0 0; pointer-events:auto; }
    ```

- 抽屉/弹层
  - 仅在需要的方向占位，例如右侧 340px；避免全屏透明遮罩层。
  - 示例：
    ```css
    .drawer { position:absolute; top:0; right:0; bottom:0; width:340px; pointer-events:auto; }
    .drawer.open { transform: translateX(0); }
    ```
  - 如确需遮罩，请确保遮罩元素 `pointer-events:none`，避免吞掉宿主点击。

- 指针事件
  - 宿主根只在自身可见元素上接管点击；不要让根容器或大面积透明层设置 `pointer-events:auto` 覆盖整页。
  - 仅交互元素（按钮、抽屉内容区）需 `pointer-events:auto`；背景、间隔层尽量 `pointer-events:none`。

- 定位禁忌
  - 禁止：`position:fixed` + `inset:0` 覆盖全页；
  - 禁止：给根容器或外层 wrapper 设置 `width/height: 100vw/100vh`；
  - 禁止：用不可见（透明/0 尺寸）但可点击的层覆盖宿主。

- 层级规范
  - 主面板建议 z-index ~1700；抽屉/弹层略高（~1710）；避免超过宿主高优先层（如伤害/超时遮罩 1999/2000）。

- 脚本执行
  - 脚本在 Shadow DOM 内执行，建议经典 `<script>`；若使用 `type=module`，通过 `window.__CUSTOM_UI_SHADOW__` 获取根节点。

满足上述约束后，宿主页面的“下一句/音乐/文本/自动”等区域点击将自动透传，无需额外的事件代理或打标。

## 系统用法

- 本地运行：
  - `npm run dev`
  - 打开 `/examples/custom_ui_multilayer.html`
- 接入方式：
  - 仅需替换 `examples/custom_ui/user_ui.html` 的内容（示例已提供一个“状态面板 + 属性抽屉”）。
  - 如果需要从其他地址加载 HTML，可在 `simple_loader.js` 中改为按 URL 参数（如 `?ui=/path/to/xxx.html`）解析并加载。

### 用户 HTML（user_ui.html）编写约定

- 布局建议：仅占可见区域（详见“页面定义要求”）。例如：
  ```css
  .user-hud { position: static; width: 280px; margin: 16px 16px 0 0; z-index:1700; }
  .drawer  { position:absolute; top:0; right:0; bottom:0; width:340px; z-index:1710; }
  ```
  - 需要交互的元素务必设置 `pointer-events:auto`（容器层默认已放开）。
- 脚本获取 ShadowRoot：
  ```js
  // 兼容 module/经典脚本的多重回退；推荐优先使用全局注入的 __CUSTOM_UI_SHADOW__
  const root = (window.__CUSTOM_UI_SHADOW__) ||
               (document.currentScript && document.currentScript.getRootNode && document.currentScript.getRootNode()) ||
               (document.querySelector('#custom-ui-root') && document.querySelector('#custom-ui-root').shadowRoot) ||
               document;
  const $ = (sel) => root.querySelector(sel);
  ```
- 与宿主交互（示例）：
  ```js
  // 订阅宿主状态
  window.gameAPI.on('stateChange', (state) => {
    // state: { scene, backgroundImage, message, isTyping, isAutoPlay, isTextMode, isWaiting, historyLength, points, music }
  });

  // 读取当前状态
  const s = window.gameAPI.getState();

  // 调用动作（根据宿主实现可用）
  window.gameAPI.setAutoPlay();
  window.gameAPI.setTextMode(true);
  window.gameAPI.toggleMusic();
  ```

## 接口说明（gameAPI）

> 注：`simple_loader.js` 中演示性绑定了 `setAutoPlay / setTextMode / toggleMusic` 三个动作，其余动作需接入真实控制器后由宿主实现。宿主（`host.js`）默认提供了完整 facade，未绑定的动作为 no-op。

- 读取与订阅
  - `getState(): State`
  - `on(event: string, cb: (payload:any)=>void)`
- 事件（常用）
  - `ready(state)`：用户 UI 就绪（宿主已设置初始状态）
  - `stateChange(state)`：聚合状态变更
  - `messageChange({ message })`：当前消息变更
  - `sceneChange({ scene, backgroundImage })`：场景与背景变更
  - `autoPlayChange({ isAutoPlay })`、`textModeChange({ isTextMode })`、`musicChange({ isPlaying })`
- 动作（按需接入）
  - `setAutoPlay(on?: boolean)`、`setTextMode(on?: boolean)`、`toggleMusic()`
  - 预留：`next()`、`choose(indexOrId:number)`、`send(text:string)`、`openHistory()`、`closeHistory()`、`start()`、`exit()`

### State 结构（示意）
```ts
interface State {
  scene: { id: string; name: string } | null;
  backgroundImage: string;
  message: { id: number; type: string; text?: string } | null;
  isTyping: boolean;
  isAutoPlay: boolean;
  isTextMode: boolean;
  isWaiting: boolean;
  historyLength: number;
  points: number;
  music: { isPlaying: boolean };
}
```

## 注意事项与边界

- 资源路径：用户 HTML 中外链脚本/样式的相对路径以 `user_ui.html` 所在目录为基准；跨域加载需服务器允许 CORS。
- 脚本执行：系统会重新创建并按顺序执行 `<script>`；`type="module"` 与经典脚本均可，推荐经典脚本；如为 module，亦可通过全局 `__CUSTOM_UI_SHADOW__` 获取根节点。
- 样式隔离：所有样式仅作用于 Shadow DOM 内，避免全局污染；尽量不要在用户 HTML 内做全局 reset。
- 定位与交互：优先使用 `absolute` 相对宿主定位；需要交互的层（如抽屉/弹窗）设置更高 `z-index` 与 `pointer-events:auto`。
- 安全：示例中会执行用户脚本，默认无沙箱隔离，请确保来源受信任；如需更强隔离，可改为 iframe + postMessage。

## 扩展建议

- 按 URL 参数动态加载不同 HTML：支持 `?ui=/path/to/foo.html` 并做白名单校验。
- 与真实控制器对接：把 `simple_loader.js` 中的演示状态与动作替换为真实 store/hook。
- 组件化：在用户 HTML 中引入组件脚本或简易路由，以单文件形态管理多层界面。

---

如需把本说明替换为“团队版使用文档”，我可以根据你们的控制器 API 与状态定义，进一步补充 `gameAPI` 的动作说明与错误处理规范。
