import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getImageUrl } from '../utils/constants';
import getGameDataApi from '../api/home/getGameData';
import { cropImageUrlToAspectDataUrl } from '../utils/imageCrop';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../api/account/authApi';

type MessageData = { url: string; coverImage?: string; title?: string };

const getMiniProgramWx = () => {
  const win = window as any;
  const candidate = win.__mpWx || win.wx || win.jWeixin;
  if (candidate && candidate.miniProgram && !win.__mpWx) {
    win.__mpWx = candidate;
  }
  return win.__mpWx || null;
};

const sendMessageToMiniProgram = (messageData: MessageData) => {
  (window as any).__APP_ROUTE_DATA__ = messageData;

  const tryPostMessage = (remaining: number) => {
    const win = window as any;
    const isMiniProgram = win.__wxjs_environment === 'miniprogram';
    const mpWx = getMiniProgramWx();

    if (isMiniProgram && mpWx?.miniProgram?.postMessage) {
      try {
        mpWx.miniProgram.postMessage({ data: messageData });
        return;
      } catch (err) {
        console.error('[RouteReporter] postMessage failed:', err);
        return;
      }
    }

    if (mpWx?.miniProgram?.postMessage && typeof mpWx.miniProgram.postMessage === 'function') {
      try {
        mpWx.miniProgram.postMessage({ data: messageData });
        return;
      } catch (err) {
        console.error('[RouteReporter] mock postMessage failed:', err);
      }
    }

    if (remaining > 0) {
      window.setTimeout(() => tryPostMessage(remaining - 1), 200);
    }
  };

  tryPostMessage(10);
};

async function buildMessageDataAsync(
  params: {
    sharePath: string;
    isSharablePage: boolean;
    gameDetail: any | null;
  }
): Promise<MessageData> {
  const { sharePath, isSharablePage, gameDetail } = params;
  const messageData: MessageData = { url: sharePath };

  if (isSharablePage && gameDetail) {
    if (gameDetail.title) messageData.title = gameDetail.title;
    if (gameDetail.cover_url) {
      const coverUrl = getImageUrl(gameDetail.cover_url);
      try {
        messageData.coverImage = await cropImageUrlToAspectDataUrl(coverUrl, { w: 5, h: 4 }, { maxWidth: 640 });
      } catch {
        messageData.coverImage = coverUrl;
      }
    }
  }

  return messageData;
}

export const RouteReporter: React.FC = () => {
  const location = useLocation();
  const { gameDetail, fileId: storeFileId } = useGameStore();
  const [localGameDetail, setLocalGameDetail] = useState<typeof gameDetail>(null);
  const lastSentSignatureRef = useRef<string>('');
  const { updateToken, updateUser, user: authUser } = useAuthStore();
  const tokenProcessedRef = useRef<Set<string>>(new Set());

  // 处理 URL 中的 token 参数（小程序场景）
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tokenFromUrl = searchParams.get('token');

    if (!tokenFromUrl || tokenFromUrl.trim() === '') {
      return;
    }

    if (authUser?.token === tokenFromUrl) {
      return;
    }

    if (tokenProcessedRef.current.has(tokenFromUrl)) {
      return;
    }

    tokenProcessedRef.current.add(tokenFromUrl);

    // 限制 tokenProcessedRef 的大小，避免内存泄漏（只保留最近 10 个）
    if (tokenProcessedRef.current.size > 10) {
      const firstToken = Array.from(tokenProcessedRef.current)[0];
      tokenProcessedRef.current.delete(firstToken);
    }

    console.log('[RouteReporter] 检测到 URL 中的 token，开始处理...');

    // 存储 token
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      // 用户已登录，更新 token（保留原有的 refreshToken）
      updateToken(tokenFromUrl);
    } else {
      // 用户未登录，需要先创建一个基础用户对象
      // 由于 updateToken 需要 user 存在，我们需要先创建一个临时用户对象
      useAuthStore.setState({
        user: {
          token: tokenFromUrl,
          refreshToken: '', // 小程序可能不提供 refreshToken
          user: {
            id: 0,
            userId: '',
            name: '',
            phoneNumber: '',
            role: '',
            createTime: '',
            lastLoginTime: null,
            email: '',
            nickname: '',
            avatarUrl: '',
            points: 0,
            inviteCode: '',
            hasSignedIn: false,
          },
        },
        isAuthenticated: true,
      });
    }

    // 调用获取用户信息接口
    auth
      .getUserInfo()
      .then((response) => {
        if (response.data?.data) {
          const userInfo = response.data.data;
          console.log('[RouteReporter] 成功获取用户信息:', userInfo);
          // 更新用户信息
          updateUser(userInfo);
        }
      })
      .catch((error) => {
        console.error('[RouteReporter] 获取用户信息失败:', error);
        // 如果获取用户信息失败，清除已处理的标记，允许重试
        tokenProcessedRef.current.delete(tokenFromUrl);
      });
  }, [location.search, updateToken, updateUser, authUser?.token]);

  useEffect(() => {
    const fullPath = location.pathname + location.search + location.hash;
    (window as any).__APP_ROUTE__ = fullPath;

    const isGameDetailPage = location.pathname.startsWith('/game/');
    const isGamePlayPage = location.pathname === '/galgame' || location.pathname === '/galgameMap';
    const isCustomIfPlayPage =
      location.pathname.startsWith('/customif/') && !location.pathname.startsWith('/customif/create');
    const customIfAppId = isCustomIfPlayPage
      ? location.pathname.match(/^\/customif\/([^/?#]+)/)?.[1] || null
      : null;
    const isSharablePage = isGameDetailPage || isGamePlayPage || isCustomIfPlayPage;

    // 用户确认：CustomIF 的 appId 就是该游戏的 fileId，可复用同一套详情接口
    const effectiveFileId = isGameDetailPage
      ? location.pathname.match(/^\/game\/([^/]+)/)?.[1] || null
      : isGamePlayPage
      ? storeFileId
      : isCustomIfPlayPage
      ? customIfAppId
      : null;

    const currentGameDetail = effectiveFileId
      ? (gameDetail && gameDetail.file_id === effectiveFileId
          ? gameDetail
          : (localGameDetail && localGameDetail.file_id === effectiveFileId ? localGameDetail : null))
      : null;

    // 分享出去的 URL：游戏游玩页一律指向详情页（用户点击先进入详情页）
    const sharePath = (() => {
      if (isGameDetailPage) return fullPath;
      if ((isGamePlayPage || isCustomIfPlayPage) && effectiveFileId) return `/game/${effectiveFileId}`;
      return fullPath;
    })();

    let cancelled = false;

    const sendIfChanged = async (gd: any | null) => {
      const signatureBase = JSON.stringify({
        url: sharePath,
        fileId: effectiveFileId || (gd as any)?.file_id || null,
        title: gd?.title || '',
        cover_url: gd?.cover_url || '',
        customAppId: customIfAppId || '',
      });

      if (lastSentSignatureRef.current === signatureBase) return;
      lastSentSignatureRef.current = signatureBase;

      const messageData = await buildMessageDataAsync({
        sharePath,
        isSharablePage,
        gameDetail: gd,
      });

      if (cancelled) return;
      sendMessageToMiniProgram(messageData);
    };

    if (isSharablePage && effectiveFileId) {
      if (currentGameDetail) {
        void sendIfChanged(currentGameDetail);
      }

      if (
        (gameDetail && gameDetail.file_id === effectiveFileId) ||
        (localGameDetail && localGameDetail.file_id === effectiveFileId)
      ) {
        return () => {
          cancelled = true;
        };
      }

      getGameDataApi
        .getGameDetail({ fileId: effectiveFileId })
        .then((response) => {
          if (cancelled || !response.data?.data) return;
          const gd = response.data.data;
          setLocalGameDetail(gd);
          void sendIfChanged(gd);
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('[RouteReporter] 获取游戏详情失败:', error);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    // 其他页面：只发送 url（不附带封面/标题）
    void sendIfChanged(null);

    setLocalGameDetail(null);
    lastSentSignatureRef.current = '';

    return () => {
      cancelled = true;
    };
  }, [location, gameDetail, storeFileId]);

  return null;
};

export default RouteReporter;


