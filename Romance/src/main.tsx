import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// 独立调试补 preflight；嵌入 funloom 走 virtual:romance-css → 仅 index.css
import './index.standalone.css'
import './index.css'

// 功能注释：独立预览也要挂 data-romance，否则 --paper 等 token 不生效，阅读卡会变成透明黑块
document.documentElement.setAttribute('data-romance', '1')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
