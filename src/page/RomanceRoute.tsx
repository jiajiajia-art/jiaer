import { useEffect, useState, type ComponentType } from 'react';

let ready: ComponentType | undefined;
let pending: Promise<{ default: ComponentType }> | undefined;
const LOAD_TIMEOUT_MS = 30_000;

async function loadRomanceRoute() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const modules = Promise.all([
    import('./RomanceHost'),
    import('virtual:romance-app'),
  ]);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('游戏界面加载超时')), LOAD_TIMEOUT_MS);
  });
  try {
    const [{ default: Host }, { default: RomanceApp }] = await Promise.race([modules, timeout]);
    ready = () => <Host RomanceApp={RomanceApp} />;
    return { default: ready };
  } finally {
    clearTimeout(timer);
  }
}

export function preloadRomanceRoute() {
  pending ??= loadRomanceRoute().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

export default function RomanceRoute() {
  const [Route, setRoute] = useState(() => ready);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Route) return;
    let cancelled = false;
    void preloadRomanceRoute().then(({ default: LoadedRoute }) => {
      if (!cancelled) setRoute(() => LoadedRoute);
    }, (error: unknown) => {
      if (cancelled) return;
      console.error('Failed to load Romance route', error);
      setFailed(true);
    });
    return () => { cancelled = true; };
  }, [Route]);

  if (Route) return <Route />;
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text)' }}>
      {failed ? (
        <>
          <p role="alert">游戏界面加载失败，请刷新页面重试。</p>
          <button type="button" onClick={() => window.location.reload()}>刷新重试</button>
        </>
      ) : <p role="status">正在打开游戏界面…</p>}
    </div>
  );
}
