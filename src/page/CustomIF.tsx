import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    // backend-served /public/... should use HOST_ADDRESS as base
    if (raw.startsWith('/public/')) {
      try { return new URL(raw, HOST_ADDRESS).href; } catch { return `${HOST_ADDRESS}${raw}`; }
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

      {/* 顶部左上角回退按钮（悬浮于 iframe 之上） */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1000,
        }}
      >
        <button
          onClick={() => {
            try {
              // Prefer going back to the previous page; fallback to home if history is shallow
              if (window.history.length > 1) navigate(-1);
              else navigate('/home');
            } catch {
              navigate('/home');
            }
          }}
          title="返回首页"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.4)',
            background: 'rgba(15,23,42,0.7)',
            color: '#e5e7eb',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1, transform: 'translateY(-1px)' }}>←</span>
        </button>
      </div>
    </div>
  );
};

export default CustomIF;
