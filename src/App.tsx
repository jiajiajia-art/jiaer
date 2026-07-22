import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './page/Home';
import Create from './page/Create';
import WithdrawRecords from './page/WithdrawRecords';
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
import Favorites from './page/Favorites';
import ScrollToTop from './components/ScrollToTop';
import Analytics from './page/Analytics';
import RouteReporter from './components/RouteReporter';
import { usePlatformDurationTracking } from './hooks/usePlatformDurationTracking';
import AdminPanel from './page/AdminPanel';
import { AdminRoute } from './components/AdminRoute';
import CommentAdminPage from './page/CommentAdminPage';
import OperatorWorkStats from './page/operator/OperatorWorkStats';
import CreatorWorkStats from './page/creator/CreatorWorkStats';
import OperatorPanel from './page/operator/OperatorPanel';
import { CreatorRoute } from './components/CreatorRoute';
import { OperatorRoute } from './components/OperatorRoute';
import Categories from './page/Categories';
import Rankings from './page/Rankings';
import PromotionCenter from './page/PromotionCenter';
import Messages from './page/Messages';
import AssetDetails from './page/AssetDetails';
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
        <Route path="/rank" element={<Rankings />} />
        <Route path="/library" element={<Library />} />
        <Route path="/specials" element={<Library variant="special" />} />
        <Route path="/game/:fileId" element={<GameDetail />} />
        <Route path="/replay/:replayId" element={<Galgame />} />
        <Route path="/document" element={<Document />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/create" element={<Create />} />
          <Route path="/create/withdraw-records" element={<WithdrawRecords />} />
          <Route path="/asset/details" element={<AssetDetails />} />
          <Route path="/creator" element={<Navigate to="/create" replace />} />
          <Route path="/creator/works/:fileId/stats" element={<CreatorRoute><CreatorWorkStats /></CreatorRoute>} />
          <Route path="/operator" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/reports" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/promotion" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/promotion/:promotionView" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/recruitment" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/daily-tasks" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/withdraw" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/works/:fileId/stats" element={<OperatorRoute><OperatorWorkStats /></OperatorRoute>} />
          <Route path="/points/details" element={<PointsDetails />} />
          <Route path="/createGame" element={<CreateGame />} />
          <Route path="/warehouse" element={<WareHouse />} />
          <Route path="/favorites" element={<Favorites />} />
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
          <Route path="/admin/share-ratio" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/daily-tasks" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/withdraw" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/comments" element={<AdminRoute><CommentAdminPage /></AdminRoute>} />
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
