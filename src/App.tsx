import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './page/Home';
import Create from './page/Create';
import WareHouse from './page/WareHouse';
import Profile from './page/Profile';
import { ProtectedRoute } from './components/ProtectedRoute';
import CreateGame from './page/CreateGame';
import Library from './page/Library';
import Galgame from './page/Galgame';
import GameSettingsEditor from './page/GameSettingsEditor';
import GalgameMap from './page/GalgameMap';
import RpgGame from './page/RpgGame';
import UploadProgressModal from './components/GameSettingEditor/UploadProgressModal';

function App() {
  return (
    <BrowserRouter basename='/funloom'>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/library" element={<Library />} />
        <Route path="/specials" element={<Library variant="special" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/rpgGame" element={<RpgGame />} />
          <Route path="/create" element={<Create />} />
          <Route path="/createGame" element={<CreateGame />} />
          <Route path="/warehouse" element={<WareHouse />} />
          <Route path="/gameSettingsEditor" element={<GameSettingsEditor />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/galgame" element={<Galgame />} />
          <Route path="/galgameMap" element={<GalgameMap />} />
        </Route>
      </Routes>
      <UploadProgressModal />
    </BrowserRouter>
  )
}

export default App
