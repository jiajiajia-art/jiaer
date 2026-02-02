import './App.css'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import UploadProgressModal from './components/GameSettingEditor/DocumentUpload/UploadProgressModal';
import CustomIF from './page/CustomIF';
import CustomIFCreate from './page/CustomIFCreate';
import GameDetail from './page/GameDetail';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './page/Analytics';
import { useEffect } from 'react';

const RouteReporter: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const fullPath = location.pathname + location.search + location.hash;

    // 挂到全局变量，方便壳子直接读取
    (window as any).__APP_ROUTE__ = fullPath;

    // 1）如果运行在微信小程序环境，通过 wx.miniProgram.postMessage 通知外层 web-view
    const wxGlobal = (window as any).wx;

    wxGlobal.miniProgram.postMessage({
      data: { url: fullPath },
    });
  
  }, [location]);

  return null;
};

function App() {
  return (
    <BrowserRouter basename='/funloom'>
      <RouteReporter />
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
          success: { duration: 2500 },
          error: { duration: 8000 },
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
        <Route path="/game/:fileId" element={<GameDetail />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/analytics" element={<Analytics />} />
          {/* <Route path="/rpgGame" element={<RpgGame />} /> */}
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
