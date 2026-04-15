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
import StGameCreate from './page/StGameCreate';
import StGame from './page/StGame';
import UploadProgressModal from './components/GameSettingEditor/DocumentUpload/UploadProgressModal';
import CustomIF from './page/CustomIF';
import CustomIFCreate from './page/CustomIFCreate';
import GameDetail from './page/GameDetail';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './page/Analytics';
import RouteReporter from './components/RouteReporter';
import { usePlatformDurationTracking } from './hooks/usePlatformDurationTracking';
import AdminPanel from './page/AdminPanel';
import { AdminRoute } from './components/AdminRoute';
import Categories from './page/Categories';
import PromotionCenter from './page/PromotionCenter';
import Messages from './page/Messages';

function App() {
  usePlatformDurationTracking();

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
        <Route path="/categories" element={<Categories />} />
        <Route path="/library" element={<Library />} />
        <Route path="/specials" element={<Library variant="special" />} />
        <Route path="/game/:fileId" element={<GameDetail />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/create" element={<Create />} />
          <Route path="/createGame" element={<CreateGame />} />
          <Route path="/warehouse" element={<WareHouse />} />
          <Route path="/gameSettingsEditor" element={<GameSettingsEditor />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/promotions" element={<PromotionCenter />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/promotions" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/promotions/:promotionView" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/points" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/creator-incentives" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/subscriptions" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/galgame" element={<Galgame />} />
          <Route path="/galgameMap" element={<GalgameMap />} />
          <Route path="/customif/create" element={<CustomIFCreate />} />
          <Route path="/customif/:appId" element={<CustomIF />} />
          <Route path="/st/create" element={<StGameCreate />} />
          <Route path="/st/:appId" element={<StGame />} />
        </Route>
      </Routes>
      <ScrollToTop />
      <UploadProgressModal />
    </BrowserRouter>
  )
}

export default App
