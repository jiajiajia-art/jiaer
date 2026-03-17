import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { CustomIFHostBridge } from '../custom/hostBridge';
import { useTrackingStore } from '../store/trackingStore';
import { useGameDurationTracking } from '../hooks/useGameDurationTracking';

type CreateSessionResp = {
  sessionId: string;
  version: string;
  entryUrl: string;
  manifestUrl?: string;
  analyticsSessionId: string;
  started_at: string;
};

const CustomIF: React.FC = () => {
  const { appId } = useParams();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<CreateSessionResp | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<CustomIFHostBridge | null>(null);
  const { setStartedAt } = useTrackingStore();
  useGameDurationTracking(appId || undefined);

  const toAbsoluteUrl = (raw?: string) => {
    if (!raw) return '';
    // absolute
    if (/^https?:\/\//i.test(raw)) return raw;
    // backend-served public assets should use HOST_ADDRESS as base
    // 支持“/public/…”与“public/…”两种返回格式
    if (raw.startsWith('/public/') || raw.startsWith('public/')) {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      try { return new URL(path, HOST_ADDRESS).href; } catch { return `${HOST_ADDRESS}${path}`; }
    }
    // fall back to current origin
    try { return new URL(raw, window.location.origin).href; } catch { return raw; }
  };

  const validEntryUrl = useMemo(() => toAbsoluteUrl(session?.entryUrl), [session?.entryUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appId) { setError('缺少 appId'); setLoading(false); return; }
      try {
        setLoading(true);
        // 1) create session
        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${appId}/session/create`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({}) });
        if (!resp.ok) throw new Error(await resp.text());
        const data = await resp.json() as CreateSessionResp;
        if (cancelled) return;
        setSession(data);
        const startTime = new Date().toISOString();
        setStartedAt(startTime);

        // 2) load manifest if provided
        if (data.manifestUrl) {
          try {
            const mu = toAbsoluteUrl(data.manifestUrl);
            const r = await fetch(mu, { credentials: 'include' });
            if (r.ok) { const m = await r.json(); setManifest(m); }
          } catch {}
        }
      } catch (e:any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appId]);

  useEffect(() => {
    // attach host bridge when iframe is ready and session exists
    if (!session || !appId) return;
    const iframe = iframeRef.current; if (!iframe) return;
    const b = new CustomIFHostBridge(iframe, { appId, sessionId: session.sessionId, version: session.version, entryUrl: validEntryUrl, manifest: undefined });
    bridgeRef.current = b;
    b.attach(manifest || undefined);
    return () => { b.dispose(); bridgeRef.current = null; };
  }, [session?.sessionId, session?.version, validEntryUrl, appId, manifest]);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>加载中…</div>;
  if (error) return <div style={{padding:20,color:'#b91c1c'}}>错误：{error}</div>;
  if (!session) return <div style={{padding:20}}>未获取到会话</div>;

  // Full-window canvas: the embedded UI should occupy the entire viewport.
  // We intentionally avoid any fixed-size container so the iframe can adapt.
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <iframe
        ref={iframeRef}
        src={validEntryUrl}
        title="CustomIF"
        // 让 iframe 与外层容器尺寸一致
        style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: '#000' }}
      />
    </div>
  );
};

export default CustomIF;
