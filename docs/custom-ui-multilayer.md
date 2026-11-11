# Galgame 单文件自定义 UI 接入说明（Shadow DOM）

本文描述当前采用的“极简接入”方案：使用一个 HTML 文件作为自定义界面入口，由系统把该 HTML 注入到 Shadow DOM 中运行，与宿主隔离并通过统一接口交互。

## 1. 目标
- 单文件接入：使用方只需提供一个 HTML（可包含内联/外链 CSS 与 JS）。
- 零侵扰：自定义 UI 在 Shadow DOM 内渲染，不影响宿主样式与结构。
- 简单通信：通过 `window.gameAPI` 订阅宿主状态与调用动作。

## 2. 目录结构与入口
- `examples/custom_ui_system/host.js`：Shadow DOM 宿主与基础层管理。
- `examples/custom_ui_system/simple_loader.js`：单文件 HTML 加载器。
- `examples/custom_ui/user_ui.html`：用户自定义的单个 HTML（可直接替换）。
- `src/page/Galgame.tsx`：对话页面内挂载自定义 UI 容器并注入加载器。
- `src/page/Galgame.module.css`：容器样式 `.customUIRoot`。

## 3. 在 Galgame 中的接入点
1) 页面容器（已接入）
- `src/page/Galgame.tsx` 在主舞台内增加：
  - `<div id="custom-ui-root" className={styles.customUIRoot}></div>`
- 容器样式（`src/page/Galgame.module.css`）：
  - `.customUIRoot { position:absolute; inset:0; z-index:1600; pointer-events:auto; }`

2) 注入加载器脚本（已接入）
- `src/page/Galgame.tsx` 中使用 `useEffect` 注入：
  - `${import.meta.env.BASE_URL}examples/custom_ui_system/simple_loader.js`
  - 仅当 `#custom-ui-root` 存在时注入；避免重复注入

3) 用户 HTML 加载
- `simple_loader.js` 默认从 `examples/custom_ui/user_ui.html` 拉取并注入 Shadow DOM；执行其中脚本（保持顺序），并提供 `window.__CUSTOM_UI_SHADOW__` 便于脚本定位根节点。

## 4. 用户 HTML 编写规范（user_ui.html）
- 定位与层级：相对宿主容器定位，避免 `fixed` 相对视口：
  - `.user-hud { position:absolute; top:16px; right:16px; z-index:1700; }`
  - `.drawer  { position:absolute; top:0; right:0; bottom:0; z-index:1710; }`
- 获取 ShadowRoot：
  ```js
  const root = window.__CUSTOM_UI_SHADOW__
             || document.currentScript?.getRootNode?.()
             || document.querySelector('#custom-ui-root')?.shadowRoot
             || document;
  const $ = (sel) => root.querySelector(sel);
  ```
- 订阅状态与动作调用：
  ```js
  window.gameAPI.on('stateChange', (s)=>{ /* 渲染界面 */ });
  const s = window.gameAPI.getState(); // 首次同步
  window.gameAPI.setAutoPlay();
  window.gameAPI.setTextMode(true);
  window.gameAPI.toggleMusic();
  ```

## 5. 系统接口（简版）
- 事件：`ready(state)`、`stateChange(state)`、`messageChange({message})`、`sceneChange({scene, backgroundImage})`、`autoPlayChange`、`textModeChange`、`musicChange`。
- 动作：`setAutoPlay(on?)`、`setTextMode(on?)`、`toggleMusic()`（其余动作可按需扩展到宿主）。
- 状态结构（示意）：
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

## 6. 调试与注意事项
- 资源路径：用户 HTML 中外链脚本/样式相对 `user_ui.html` 解析；跨域需 CORS。
- 指针事件：宿主容器允许 `pointer-events`；用户可在可点击层设置 `pointer-events:auto`。
- 安全：本方案会执行用户脚本，默认无沙箱；敏感场景可改为 iframe + postMessage。
- Hooks 顺序：已确保对话页中注入脚本的 `useEffect` 顺序稳定，不会引发 React Hooks 顺序错误。

## 7. 运行与接入步骤
- 开发本地启动：`npm run dev`，访问 `/galgame` 即可看到单文件 UI。
- 替换 UI：把 `examples/custom_ui/user_ui.html` 替换为你提供的 HTML 即可。
- 可选增强：把 `simple_loader.js` 改为支持 `?ui=/path/to/foo.html` 按 URL 指定加载；或把 `gameAPI` 接入真实控制器。

---

如需回到“多层界面/页面栈”的插件体系，参考 `examples/custom_ui_system/README.md`（保留了设计与接口说明），但当前默认方案为本文件描述的“单文件 HTML 接入”。
