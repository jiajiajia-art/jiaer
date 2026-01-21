import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
import UploadProgressModal from './components/GameSettingEditor/DocumentUpload/UploadProgressModal';
import CustomIF from './page/CustomIF';
import CustomIFCreate from './page/CustomIFCreate';
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <BrowserRouter basename='/funloom'>
      <Toaster
        position="top-center"
        containerStyle={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        toastOptions={{
          duration: 3000,
          style: {
            minWidth: '250px',
            textAlign: 'center',
            borderRadius: '8px',
          },
        }}
      />
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
          <Route path="/customif/create" element={<CustomIFCreate />} />
          <Route path="/customif/:appId" element={<CustomIF />} />
        </Route>
      </Routes>
      <ScrollToTop />
      <UploadProgressModal />
    </BrowserRouter>
  )
}

export default App