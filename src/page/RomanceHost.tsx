/**
 * 功能注释：把 Romance 子应用挂进 funloom SPA（同端口），路径 /funloom/romance/。
 * 经 virtual:romance-* 加载，避免主工程 tsc 扫描 Romance 源码。
 * 进入时剥离主站 html.dark / accent / skin / font（否则 Romance 令牌被主站深色壳劫持成图1那种深紫底）；
 * 离开时清掉 Romance 主题 class，并恢复进页前主站 class。
 */
import { Suspense, lazy, useEffect, type ComponentType } from 'react';

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
          <div style={{ padding: '2rem', textAlign: 'center', color: '#5c4033' }}>
            加载 Romance…
          </div>
        )}
      >
        <RomanceApp />
      </Suspense>
    </div>
  );
}
