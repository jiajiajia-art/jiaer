import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ASSET_HOST_ADDRESS, HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { CustomIFHostBridge } from '../custom/hostBridge';
import { useTrackingStore } from '../store/trackingStore';
import { useGameDurationTracking } from '../hooks/useGameDurationTracking';
import { trackingApi } from '../api/statistics/trackingApi';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import { isMiniProgramEnv } from '../utils/miniProgram';

type CreateSessionResp = {
  sessionId: string;
  version: string;
  entryUrl: string;
  manifestUrl?: string;
  analyticsSessionId: string;
  started_at: string;
};

const CustomIF: React.FC = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<CreateSessionResp | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<CustomIFHostBridge | null>(null);
  const { setStartedAt } = useTrackingStore();
  const syncDailyTaskPayload = useDailyTaskStore((state) => state.syncFromPayload);
  useGameDurationTracking(appId || undefined);

  const toAbsoluteUrl = (raw?: string) => {
    if (!raw) return '';
    // absolute
    if (/^https?:\/\//i.test(raw)) return raw;
    // backend-served public assets should use HOST_ADDRESS as base
    // 支持“/public/…”与“public/…”两种返回格式
    if (raw.startsWith('/public/') || raw.startsWith('public/')) {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      // 功能注释：小程序 web-view 必须同源加载 iframe，避免跳到另一域名触发「不支持打开」
      const assetBase = isMiniProgramEnv()
        ? window.location.origin
        : (ASSET_HOST_ADDRESS || HOST_ADDRESS || window.location.origin);
      try { return new URL(path, assetBase).href; } catch { return `${assetBase}${path}`; }
    }
    // fall back to current origin
    try { return new URL(raw, window.location.origin).href; } catch { return raw; }
  };

  const validEntryUrl = useMemo(() => toAbsoluteUrl(session?.entryUrl), [session?.entryUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appId) { setError(t('customIF.missingAppId')); setLoading(false); return; }
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
        trackingApi.reportGameEntry({
          gameFileId: appId,
          source: 'game_detail',
        })
          .then((entryResponse) => {
            syncDailyTaskPayload(entryResponse.data.data);
          })
          .catch(() => {});

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
  }, [appId, setStartedAt, syncDailyTaskPayload]);

  useEffect(() => {
    // attach host bridge when iframe is ready and session exists
    if (!session || !appId) return;
    const iframe = iframeRef.current; if (!iframe) return;
    const b = new CustomIFHostBridge(iframe, { appId, sessionId: session.sessionId, version: session.version, entryUrl: validEntryUrl, manifest: undefined });
    bridgeRef.current = b;
    b.attach(manifest || undefined);
    return () => { b.dispose(); bridgeRef.current = null; };
  }, [session?.sessionId, session?.version, validEntryUrl, appId, manifest]);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>{t('common.loading')}</div>;
  if (error) return <div style={{padding:20,color:'#b91c1c'}}>{t('customIF.errorPrefix')}{error}</div>;
  if (!session) return <div style={{padding:20}}>{t('customIF.noSession')}</div>;

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
