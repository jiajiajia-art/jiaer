import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles/funloomToast.css';
import Home from './page/Home';
import Create from './page/Create';
import CreateType from './page/CreateType';
import CreateWorks from './page/CreateWorks';
import WithdrawRecords from './page/WithdrawRecords';
import WareHouse from './page/WareHouse';
import WarehouseHub from './page/warehouse/WarehouseHub';
import WarehousePersonaCards from './page/warehouse/WarehousePersonaCards';
import WarehouseCharacterCards from './page/warehouse/WarehouseCharacterCards';
import WarehousePublicCards from './page/warehouse/WarehousePublicCards';
import WarehousePlayHistory from './page/warehouse/WarehousePlayHistory';
import WarehouseResourceLibrary from './page/warehouse/WarehouseResourceLibrary';
import WarehouseAvatarLibrary from './page/warehouse/WarehouseAvatarLibrary';
import AccountHomepage from './page/account/AccountHomepage';
import AccountSocialList from './page/account/AccountSocialList';
import AccountSettings from './page/account/AccountSettings';
import PrivacySettings from './page/account/PrivacySettings';
import { PrivacyFindMe, PrivacyMuted } from './page/account/PrivacyStubList';
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
import InteractiveVideoPurchased from './page/InteractiveVideoPurchased';
import GameDetail from './page/GameDetail';
import NovelReader from './page/NovelReader';
import Favorites from './page/Favorites';
import ScrollToTop from './components/ScrollToTop';
import ProfilePreferenceGate from './components/ProfilePreferenceGate';
import Analytics from './page/Analytics';
import RouteReporter from './components/RouteReporter';
import { usePlatformDurationTracking } from './hooks/usePlatformDurationTracking';
import AdminPanel from './page/AdminPanel';
import { AdminRoute } from './components/AdminRoute';
import CommentAdminPage from './page/CommentAdminPage';
import Appeals from './page/Appeals';
import AppealResult from './page/AppealResult';
import AppealSubmit from './page/AppealSubmit';
import ModerationAudit from './page/ModerationAudit';
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
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useGeoRegionStore } from './store/useGeoRegionStore';
import { getAppBasePath } from './lib/appBasePath';

const FunloomLotteryPage = lazy(() => import('./activities/funloom-lottery-20260731'));
const RomanceHost = lazy(() => import('./page/RomanceHost'));

function App() {
  usePlatformDurationTracking();
  const initializeAuth = useAuthStore((state) => state.initialize);
  const hydrateFromIp = useGeoRegionStore((state) => state.hydrateFromIp);
  // 功能注释：与 Vite base / VITE_BASE 对齐，避免 /funloom-test 下 Router 不渲染
  const routerBasename = getAppBasePath();

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  // 功能注释：每次进站按 IP 强制语言与支付区域（覆盖本地语言偏好）
  useEffect(() => {
    void hydrateFromIp();
  }, [hydrateFromIp]);

  return (
    <BrowserRouter basename={routerBasename}>
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
        <Route path="/rank" element={<Rankings />} />
        <Route path="/library" element={<Library />} />
        <Route path="/specials" element={<Library variant="special" />} />
        <Route path="/game/:fileId" element={<GameDetail />} />
        <Route path="/novel/:fileId/read" element={<NovelReader />} />
        <Route path="/replay/:replayId" element={<Galgame />} />
        <Route path="/document" element={<Document />} />
        {/* Funloom 限定抽奖：独立活动链接；懒加载避免拖大主包 */}
        <Route
          path="/activity/funloom-lottery-20260731"
          element={(
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>加载中…</div>}>
              <FunloomLotteryPage />
            </Suspense>
          )}
        />
        {/* Romance 子应用：同构建同端口，访问 /funloom/romance/ */}
        <Route
          path="/romance/*"
          element={(
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>加载中…</div>}>
              <RomanceHost />
            </Suspense>
          )}
        />
        <Route element={<ProtectedRoute />}>
          <Route path="/bookshelf" element={<CreateWorks />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/create/new" element={<CreateType />} />
          <Route path="/create/works" element={<CreateWorks />} />
          <Route path="/create/withdraw-records" element={<WithdrawRecords />} />
          <Route path="/asset/details" element={<AssetDetails />} />
          <Route path="/creator" element={<Navigate to="/profile" replace />} />
          <Route path="/account/settings" element={<AccountSettings />} />
          <Route path="/account/privacy" element={<PrivacySettings />} />
          <Route path="/account/privacy/find-me" element={<PrivacyFindMe />} />
          <Route path="/account/privacy/muted" element={<PrivacyMuted />} />
          <Route path="/account/:userCode/social" element={<AccountSocialList />} />
          <Route path="/account/:userCode" element={<AccountHomepage />} />
          <Route path="/creator/works/:fileId/stats" element={<CreatorRoute><CreatorWorkStats /></CreatorRoute>} />
          <Route path="/operator" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/reports" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/promotion" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/promotion/:promotionView" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/recruitment" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/daily-tasks" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/withdraw" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/avatars" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/locations" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/components" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/play-mods" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/content-reports" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/appeals" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/publish-queue" element={<OperatorRoute><OperatorPanel /></OperatorRoute>} />
          <Route path="/operator/works/:fileId/stats" element={<OperatorRoute><OperatorWorkStats /></OperatorRoute>} />
          <Route path="/points/details" element={<PointsDetails />} />
          <Route path="/createGame" element={<CreateGame />} />
          <Route path="/warehouse" element={<WarehouseHub />}>
            <Route index element={<Navigate to="persona" replace />} />
            <Route path="persona" element={<WarehousePersonaCards />} />
            <Route path="characters" element={<WarehouseCharacterCards />} />
            <Route path="avatars" element={<WarehouseAvatarLibrary />} />
            <Route path="worldbooks" element={<WarehouseResourceLibrary resourceType="worldbook" mode="mine" />} />
            <Route path="plugins" element={<WarehouseResourceLibrary resourceType="plugin" mode="mine" />} />
            <Route path="public/cards" element={<WarehousePublicCards />} />
            <Route path="public/worldbooks" element={<WarehouseResourceLibrary resourceType="worldbook" mode="public" />} />
            <Route path="public/plugins" element={<WarehouseResourceLibrary resourceType="plugin" mode="public" />} />
            <Route path="history" element={<WarehousePlayHistory />} />
          </Route>
          {/* 兼容旧链接：直进游玩历史 */}
          <Route path="/warehouse-legacy" element={<WareHouse />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/gameSettingsEditor" element={<GameSettingsEditor />} />
          <Route path="/profile" element={<Create />} />
          <Route path="/promotions" element={<PromotionCenter />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/appeals" element={<Appeals />} />
          {/* 功能注释：发起申诉勿挂在 /appeals/:id 下，否则 submit 会被当成 appealId */}
          <Route path="/appeal/submit" element={<AppealSubmit />} />
          <Route path="/appeals/:appealId" element={<AppealResult />} />
          <Route path="/moderation/:moderationId" element={<ModerationAudit />} />
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
          <Route path="/admin/image-gen" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/text-llm" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/lottery" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/avatars" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/components" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/play-mods" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          <Route path="/admin/comments" element={<AdminRoute><CommentAdminPage /></AdminRoute>} />
          {/* 功能注释：内容举报/申诉复核已迁到运营中心；旧路径兼容跳转 */}
          <Route path="/admin/content-reports" element={<Navigate to="/operator/content-reports" replace />} />
          <Route path="/admin/appeals" element={<Navigate to="/operator/appeals" replace />} />
          <Route path="/galgame" element={<Galgame />} />
          <Route path="/galgameMap" element={<GalgameMap />} />
          <Route path="/customif/create" element={<CustomIFCreate />} />
          <Route path="/customif/:appId" element={<CustomIF />} />
          <Route path="/interactive-video/edit/:fileId" element={<InteractiveVideoEdit />} />
          <Route path="/interactive-video/purchased" element={<InteractiveVideoPurchased />} />
          <Route path="/interactive-video/:fileId" element={<InteractiveVideo />} />
          <Route path="/st/create" element={<StGameCreate />} />
          <Route path="/st/:appId" element={<StGame />} />
        </Route>
      </Routes>
      <ScrollToTop />
      <UploadProgressModal />
      <ProfilePreferenceGate />
    </BrowserRouter>
  )
}

export default App
