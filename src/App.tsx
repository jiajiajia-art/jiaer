import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles/funloomToast.css';
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
import InteractiveVideo from './page/InteractiveVideo';
import InteractiveVideoEdit from './page/InteractiveVideoEdit';
import GameDetail from './page/GameDetail';
import NovelReader from './page/NovelReader';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './page/Analytics';
import RouteReporter from './components/RouteReporter';
import { usePlatformDurationTracking } from './hooks/usePlatformDurationTracking';
import AdminPanel from './page/AdminPanel';
import { AdminRoute } from './components/AdminRoute';
import Categories from './page/Categories';
import PromotionCenter from './page/PromotionCenter';
import Messages from './page/Messages';
import PointsDetails from './page/PointsDetails';
import Document from './page/Document';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';

function App() {
  usePlatformDurationTracking();
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter basename='/funloom'>
      <RouteReporter />
      <Toaster
        position="top-center"
        gutter={12}
        containerStyle={{
          top: 24,
          zIndex: 4000,
        }}
        toastOptions={{
          className: 'funloom-toast',
          duration: 3200,
          success: {
            duration: 2600,
            className: 'funloom-toast funloom-toast-success',
            iconTheme: {
              primary: '#2f9d6a',
              secondary: '#ffffff',
            },
          },
          error: {
            duration: 6500,
            className: 'funloom-toast funloom-toast-error',
            iconTheme: {
              primary: '#fb4655',
              secondary: '#fff5f5',
            },
          },
          blank: {
            className: 'funloom-toast funloom-toast-blank',
          },
          loading: {
            className: 'funloom-toast funloom-toast-loading',
            iconTheme: {
              primary: '#c9a27a',
              secondary: '#fff8f0',
            },
          },
          style: {
            boxShadow: 'none',
            background: 'transparent',
            color: 'inherit',
            padding: 0,
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
        <Route path="/novel/:fileId/read" element={<NovelReader />} />
        <Route path="/replay/:replayId" element={<Galgame />} />
        <Route path="/document" element={<Document />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/create" element={<Create />} />
          <Route path="/points/details" element={<PointsDetails />} />
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
          <Route path="/admin/documents" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/galgame" element={<Galgame />} />
          <Route path="/galgameMap" element={<GalgameMap />} />
          <Route path="/customif/create" element={<CustomIFCreate />} />
          <Route path="/customif/:appId" element={<CustomIF />} />
          <Route path="/interactive-video/edit/:fileId" element={<InteractiveVideoEdit />} />
          <Route path="/interactive-video/:fileId" element={<InteractiveVideo />} />
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
