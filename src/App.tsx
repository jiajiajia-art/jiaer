import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import CreateCharacter from './page/CreateCharacter';
import NewMain from './page/NewMain';
import Home from './page/Home';
import Create from './page/Create';
import MyGames from './page/MyGames';
import Library from './page/Library';
import WareHouse from './page/WareHouse';
import Profile from './page/Profile';
import { ProtectedRoute } from './components/ProtectedRoute';
import CreateGame from './page/CreateGame';

function App() {

  return (
    <BrowserRouter basename='/funloom'>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/home/library" element={<Library />} />
        {/* <Route path="/createCharacter" element={<CreateCharacter />} /> */}
        <Route element={<ProtectedRoute />}>
          <Route path="/newmain" element={<NewMain />} />
          <Route path="/create" element={<Create />} />
          <Route path="/createGame" element={<CreateGame />} />
          <Route path="/create/myGames" element={<MyGames />} />
          <Route path="/warehouse" element={<WareHouse />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
