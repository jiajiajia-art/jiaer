/**
 * 功能注释：把 Romance 子应用挂进 funloom SPA（同端口），路径 /funloom/romance/。
 * 经 virtual:romance-* 加载，避免主工程 tsc 扫描 Romance 源码。
 * 离开时清掉写在 <html> 上的主题 class，避免污染主站。
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

function clearRomanceHtmlClasses() {
  const root = document.documentElement;
  root.removeAttribute('data-romance');
  const doomed: string[] = [];
  root.classList.forEach((cls) => {
    if (
      cls === 'dark'
      || ROMANCE_HTML_CLASS_PREFIXES.some((p) => p !== 'dark' && cls.startsWith(p))
    ) {
      doomed.push(cls);
    }
  });
  doomed.forEach((cls) => root.classList.remove(cls));
}

export default function RomanceHost() {
  useEffect(() => {
    document.documentElement.setAttribute('data-romance', '1');
    return () => {
      clearRomanceHtmlClasses();
    };
  }, []);

  return (
    <div className="romance-host" data-app="romance" style={{ minHeight: '100vh' }}>
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
