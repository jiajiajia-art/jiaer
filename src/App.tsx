import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateCharacter from './page/CreateCharacter';
import Home from './page/Home';
import NewMain from './page/NewMain';
import HomeNew from './page/HomeNew';
import Create from './page/Create';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/homeNew" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/createCharacter" element={<CreateCharacter />} />
        <Route path="/newmain" element={<NewMain />} /> {/* 重新添加 /main 路由 */}
        <Route path="/homeNew" element={<HomeNew />} />
        <Route path="/create" element={<Create />} />
      </Routes>
  </BrowserRouter>
  )
}

export default App
