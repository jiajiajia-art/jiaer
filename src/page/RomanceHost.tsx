/**
 * 功能注释：把 Romance 子应用挂进 funloom SPA（同端口），路径 /funloom/romance/。
 * 经 virtual:romance-* 加载，避免主工程 tsc 扫描 Romance 源码。
 * 进入时剥离主站 html.dark / accent / skin / font（否则 Romance 令牌被主站深色壳劫持成图1那种深紫底）；
 * 离开时清掉 Romance 主题 class，并恢复进页前主站 class。
 */
import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import AuthModal from '../components/AuthModal';
import AiRouteFab from '../components/AiRoute/AiRouteFab';
import { useLocation } from 'react-router-dom';
import { authModalStore } from '../store/useAuthStore';

import 'virtual:romance-css';

const RomanceApp = lazy(() =>
  import('virtual:romance-app').then((m) => ({
    default: m.default as ComponentType,
  })),
);

const ROMANCE_HTML_CLASS_PREFIXES = [
  'dark',
  'accent-',
  'skin-',
  'font-',
] as const;

function isRomanceThemeClass(cls: string): boolean {
  return (
    cls === 'dark'
    || ROMANCE_HTML_CLASS_PREFIXES.some((p) => p !== 'dark' && cls.startsWith(p))
  );
}

function clearRomanceHtmlClasses() {
  const root = document.documentElement;
  root.removeAttribute('data-romance');
  const doomed: string[] = [];
  root.classList.forEach((cls) => {
    if (isRomanceThemeClass(cls)) doomed.push(cls);
  });
  doomed.forEach((cls) => root.classList.remove(cls));
}

export default function RomanceHost() {
  const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
  // 功能注释：玩家进局 / 审核预览显示 AI 线路悬浮球；创作编辑器本体不显示，Studio 预览靠 romance:screen
  const { search } = useLocation();
  const q = new URLSearchParams(search);
  const fileId = String(q.get('fileId') || '').trim();
  const isPlayerPlay = !!fileId && (q.get('play') === '1' || q.get('reviewPreview') === '1');
  // 功能注释：对话生成玩法 / 生成世界创作壳默认不挂悬浮球；进入试玩（screen=game）时仍显示
  const isCreatorShell = q.get('createPlayMod') === '1' || q.get('createPlayMod') === 'true'
    || q.get('createWorld') === '1' || q.get('createWorld') === 'true'
    || q.get('worldGen') === '1' || q.get('worldGen') === 'true';
  // 功能注释：局内 game / opening 都要用 AI，开幕页也挂悬浮球；含编辑器 Studio 预览
  const [inGame, setInGame] = useState(() => {
    const s = (window as unknown as { __romanceScreen?: string }).__romanceScreen;
    return s === 'game' || s === 'opening';
  });
  useEffect(() => {
    const h = (e: Event) => {
      const s = (e as CustomEvent<string>).detail;
      setInGame(s === 'game' || s === 'opening');
    };
    window.addEventListener('romance:screen', h);
    return () => window.removeEventListener('romance:screen', h);
  }, []);
  useEffect(() => {
    // 功能注释：生成世界「知道了」通过该事件拉起平台登录；本页没有顶栏，须在宿主挂 AuthModal
    const openAuth = () => setIsAuthModalOpen(true);
    window.addEventListener('funloom:open-auth', openAuth);
    return () => window.removeEventListener('funloom:open-auth', openAuth);
  }, [setIsAuthModalOpen]);
  useEffect(() => {
    const root = document.documentElement;
    // 功能注释：先记下主站主题 class，再摘掉，避免与 Romance 同名 dark/accent 抢 CSS 变量
    const hostThemeClasses = [...root.classList].filter(isRomanceThemeClass);
    hostThemeClasses.forEach((cls) => root.classList.remove(cls));
    root.setAttribute('data-romance', '1');
    return () => {
      clearRomanceHtmlClasses();
      hostThemeClasses.forEach((cls) => root.classList.add(cls));
    };
  }, []);

  return (
    <div
      className="romance-host"
      data-app="romance"
      style={{
        minHeight: '100vh',
        background: 'var(--paper, #f3e9d6)',
        color: 'var(--ink, #342c28)',
      }}
    >
      <Suspense
        fallback={(
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            加载 Romance…
          </div>
        )}
      >
        <RomanceApp />
      </Suspense>
      {(isPlayerPlay || inGame) && (!isCreatorShell || inGame) && <AiRouteFab />}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
