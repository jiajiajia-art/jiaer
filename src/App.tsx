import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import CreateCharacter from './page/CreateCharacter';
import NewMain from './page/NewMain';
import Home from './page/Home';
import Create from './page/Create';
import WareHouse from './page/WareHouse';
import Profile from './page/Profile';
import { ProtectedRoute } from './components/ProtectedRoute';
import CreateGame from './page/CreateGame';
import Library from './page/Library';

function App() {

  return (
    <BrowserRouter basename='/funloom'>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        {/* <Route path="/createCharacter" element={<CreateCharacter />} /> */}
        <Route path="/library" element={<Library />} />
        <Route path="/specials" element={<Library variant="special" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/newmain" element={<NewMain />} />
          <Route path="/create" element={<Create />} />
          <Route path="/createGame" element={<CreateGame />} />
          <Route path="/warehouse" element={<WareHouse />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
