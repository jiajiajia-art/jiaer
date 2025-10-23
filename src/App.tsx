import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateCharacter from './page/CreateCharacter';
import Home from './page/Home';
import NewMain from './page/NewMain';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/createCharacter" element={<CreateCharacter />} />
        <Route path="/newmain" element={<NewMain />} /> {/* 重新添加 /main 路由 */}
      </Routes>
  </BrowserRouter>
  )
}

export default App
