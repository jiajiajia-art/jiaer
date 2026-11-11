import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// 独立调试补 preflight；嵌入 funloom 走 virtual:romance-css → 仅 index.css
import './index.standalone.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
