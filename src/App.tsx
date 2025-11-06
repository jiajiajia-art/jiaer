import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import CreateCharacter from './page/CreateCharacter';
import NewMain from './page/NewMain';
import Home from './page/Home';
import Create from './page/Create';
import MyGames from './page/MyGames';
import Library from './page/Library';

function App() {

  return (
    <BrowserRouter basename='/funloom'>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        {/* <Route path="/createCharacter" element={<CreateCharacter />} /> */}
        <Route path="/newmain" element={<NewMain />} /> {/* 重新添加 /main 路由 */}
        <Route path="/home/library" element={<Library />} />
        <Route path="/create" element={<Create />} />
        <Route path="/create/myGames" element={<MyGames />} />
      </Routes>
  </BrowserRouter>
  )
}

export default App
