import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

// Simple analytics dashboard page ported from provided static HTML.
// Notes:
// - Requires login via <ProtectedRoute/> in App.tsx router.
// - Uses fetch with credentials: 'include' so server can do cookie/session whitelist.
// - Allows overriding API base via localStorage key 'analyticsApiBase'.

type DAURow = { day: string; dau: number | string };
type PVUVRow = { scriptId: string; pv: number | string; uv: number | string };
type ActiveRow = { day: string; activeScripts: number | string };
type ActiveSeriesRow = { day: string; dau: number | string; wau: number | string; mau: number | string };
type RetentionRow = { start: string; base: number | string; retained: number | string; rate: number | string };

const STORAGE_KEY = 'analyticsApiBase';

function fmt(n: number | string | undefined) {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return '0';
  return v.toLocaleString('zh-CN');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function maxOf<T extends Record<string, any>>(arr: T[], key: keyof T): number {
  let m = 0;
  for (const x of arr) m = Math.max(m, Number(x[key] || 0));
  return m;
}

function drawLineChart(
  canvas: HTMLCanvasElement | null,
  series: Array<Record<string, any>>,
  lines: Array<{ key: string; label: string }>,
  opts?: { padding?: number; colors?: string[] }
) {
  if (!canvas) return;
  const { padding = 24, colors = ['#2f81f7', '#23d18b', '#d29922', '#ff6b6b', '#b15cff'] } = opts || {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!series || !series.length) return;
  const left = padding, right = padding, top = padding, bottom = padding;
  const innerW = W - left - right, innerH = H - top - bottom;
  const n = series.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  let ymax = 0;
  for (const ln of lines) ymax = Math.max(ymax, maxOf(series, ln.key));
  if (ymax <= 0) ymax = 1;
  // grid lines
  ctx.strokeStyle = '#1f2633';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const t of [0.5, 1.0]) {
    const y = top + innerH * (1 - t);
    ctx.moveTo(left, y);
    ctx.lineTo(W - right, y);
  }
  ctx.stroke();
  // max label
  ctx.fillStyle = '#9da3ae';
  ctx.font = '12px system-ui';
  ctx.fillText(String(Math.round(ymax)), 4, top + 8);
  // lines
  lines.forEach((ln, idx) => {
    ctx.strokeStyle = colors[idx % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((pt, i) => {
      const x = left + stepX * i;
      const v = Number(pt[ln.key] || 0);
      const y = top + innerH * (1 - v / ymax);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

export default function Analytics() {
  // inputs
  const [apiBase, setApiBase] = useState<string>('');
  const [start, setStart] = useState<string>(daysAgo(6));
  const [end, setEnd] = useState<string>(today());
  const [limit, setLimit] = useState<number>(100);

  // data
  const [dauRows, setDauRows] = useState<DAURow[]>([]);
  const [pvuvRows, setPvuvRows] = useState<PVUVRow[]>([]);
  const [activeRows, setActiveRows] = useState<ActiveRow[]>([]);
  const [activeSeriesRows, setActiveSeriesRows] = useState<ActiveSeriesRow[]>([]);
  const [retentionWeekRows, setRetentionWeekRows] = useState<RetentionRow[]>([]);
  const [retentionMonthRows, setRetentionMonthRows] = useState<RetentionRow[]>([]);

  // errors
  const [errDau, setErrDau] = useState<string>('');
  const [errPvuv, setErrPvuv] = useState<string>('');
  const [errActive, setErrActive] = useState<string>('');
  const [errActiveSeries, setErrActiveSeries] = useState<string>('');
  const [errRetentionW, setErrRetentionW] = useState<string>('');
  const [errRetentionM, setErrRetentionM] = useState<string>('');

  const baseTrimmed = useMemo(() => (apiBase || '').replace(/\/$/, ''), [apiBase]);
  const token = useAuthStore((s) => s.user?.token);

  const fetchJSON = useCallback(async (path: string) => {
    const url = baseTrimmed + path;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(url, { credentials: 'include', headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }, [baseTrimmed, token]);

  const reloadAll = useCallback(async () => {
    // persist api base so user only inputs once
    localStorage.setItem(STORAGE_KEY, (apiBase || '').trim());
    setErrDau(''); setErrPvuv(''); setErrActive(''); setErrActiveSeries(''); setErrRetentionW(''); setErrRetentionM('');
    try {
      const [dau, pvuv, active, activeSeries, retentionW, retentionM] = await Promise.all([
        fetchJSON(`/api/admin/analytics/dau?start=${start}&end=${end}`),
        fetchJSON(`/api/admin/analytics/script-pv-uv?start=${start}&end=${end}&limit=${Number(limit || 100)}`),
        fetchJSON(`/api/admin/analytics/active-scripts-daily?start=${start}&end=${end}`),
        fetchJSON(`/api/admin/analytics/active-series?start=${start}&end=${end}&mode=natural`),
        fetchJSON(`/api/admin/analytics/retention/active-natural?start=${start}&end=${end}&period=week`),
        fetchJSON(`/api/admin/analytics/retention/active-natural?start=${start}&end=${end}&period=month`),
      ]);
      setDauRows(Array.isArray(dau?.data) ? dau.data : []);
      setPvuvRows(Array.isArray(pvuv?.data) ? pvuv.data : []);
      setActiveRows(Array.isArray(active?.data) ? active.data : []);
      setActiveSeriesRows(Array.isArray(activeSeries?.data) ? activeSeries.data : []);
      setRetentionWeekRows(Array.isArray(retentionW?.data) ? retentionW.data : []);
      setRetentionMonthRows(Array.isArray(retentionM?.data) ? retentionM.data : []);
    } catch (e) {
      console.error(e);
      setErrDau('加载失败，请检查接口地址/权限');
      setErrPvuv('');
      setErrActive('');
      setErrActiveSeries('');
      setErrRetentionW('');
      setErrRetentionM('');
    }
  }, [apiBase, end, fetchJSON, limit, start]);

  // totals
  const dauTotal = useMemo(() => dauRows.reduce((a, b) => a + Number(b.dau || 0), 0), [dauRows]);
  const pvSum = useMemo(() => pvuvRows.reduce((a, b) => a + Number(b.pv || 0), 0), [pvuvRows]);
  const uvSum = useMemo(() => pvuvRows.reduce((a, b) => a + Number(b.uv || 0), 0), [pvuvRows]);
  const activeTotal = useMemo(() => activeRows.reduce((a, b) => a + Number(b.activeScripts || 0), 0), [activeRows]);
  const retentionWeekPct = useMemo(() => retentionWeekRows.map(r => ({ ...r, ratePct: Number(r.rate || 0) * 100 })), [retentionWeekRows]);
  const retentionMonthPct = useMemo(() => retentionMonthRows.map(r => ({ ...r, ratePct: Number(r.rate || 0) * 100 })), [retentionMonthRows]);

  // charts
  const chartActiveRef = useRef<HTMLCanvasElement | null>(null);
  const chartRetentionWRef = useRef<HTMLCanvasElement | null>(null);
  const chartRetentionMRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    drawLineChart(chartActiveRef.current, activeSeriesRows as any[], [
      { key: 'dau', label: 'DAU' },
      { key: 'wau', label: 'WAU' },
      { key: 'mau', label: 'MAU' },
    ]);
  }, [activeSeriesRows]);

  useEffect(() => {
    drawLineChart(chartRetentionWRef.current, retentionWeekPct as any[], [
      { key: 'ratePct', label: '周留存(%)' },
    ]);
  }, [retentionWeekPct]);

  useEffect(() => {
    drawLineChart(chartRetentionMRef.current, retentionMonthPct as any[], [
      { key: 'ratePct', label: '月留存(%)' },
    ]);
  }, [retentionMonthPct]);

  useEffect(() => {
    // init inputs from storage
    setApiBase(localStorage.getItem(STORAGE_KEY) || '');
    // start/end already initialized above; just trigger initial load
    // Delay to ensure state is set (apiBase) before first reload
    const t = setTimeout(() => { reloadAll(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Scoped styles: keep them self-contained for this page */}
      <style>{`
        :root { --bg: #0f1115; --panel: #151923; --text: #e6edf3; --muted:#9da3ae; --accent:#2f81f7; --warn:#d29922; }
        .ana-root { background: var(--bg); color: var(--text); min-height: calc(100vh - 1px); }
        .ana-header { position: sticky; top:0; background: rgba(15,17,21,0.9); backdrop-filter: blur(6px); border-bottom:1px solid #232a36; padding: 12px 16px; z-index: 10; }
        .ana-h1 { margin:0; font-size: 16px; }
        .controls { display:flex; gap:12px; flex-wrap: wrap; margin-top:8px; }
        .card { background: var(--panel); border:1px solid #232a36; border-radius:8px; padding: 12px; }
        .ana-main { padding: 16px; display: grid; grid-template-columns: 1fr; gap: 12px; }
        .ana-label { display:flex; align-items:center; gap:6px; color: var(--muted); }
        .ana-input, .ana-select, .ana-button { background:#0f1320; color:var(--text); border:1px solid #232a36; border-radius:6px; padding:6px 8px; }
        input[type="date"].ana-input { padding:4px 8px; }
        .ana-button.primary { background: var(--accent); border-color: #2b6cdf; color:#fff; }
        .grid { overflow:auto; }
        table { width:100%; border-collapse: collapse; min-width: 420px; }
        th, td { padding:8px 10px; border-bottom:1px solid #232a36; }
        th { text-align:left; color: var(--muted); font-weight: 600; user-select: none; }
        tr:hover td { background: #121724; }
        .muted { color: var(--muted); }
        .row { display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
        .pill { display:inline-block; padding:2px 6px; border-radius:100px; border:1px solid #2a3344; color:#cbd5e1; font-size: 12px; }
        .help { color:#9aa4b2; font-size:12px; }
        .error { color:#ff6b6b; }
        .ok { color:#52c41a; }
      `}</style>

      <div className="ana-root">
        <header className="ana-header">
          <h1 className="ana-h1">项目数据报表</h1>
          <div className="controls">
            <label className="ana-label">API 基址
              <input
                className="ana-input"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="默认同源，如 https://your-host"
                style={{ minWidth: 280 }}
              />
            </label>
            <label className="ana-label">开始日期
              <input className="ana-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="ana-label">结束日期
              <input className="ana-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <label className="ana-label">单剧本TopN
              <input
                className="ana-input"
                type="number" value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value || 0))))}
                min={1} max={1000} style={{ width: 90 }}
              />
            </label>
            <button className="ana-button primary" onClick={reloadAll}>刷新</button>
            <span className="pill">范围：{start} ~ {end}</span>
          </div>
        </header>

        <main className="ana-main">
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>DAU（日活用户数）</strong>
                <div className="help">基于 user_point_activities 中 activity_type = deduct_option（有效消费事件）</div>
              </div>
              <div className="muted">合计：<span>{fmt(dauTotal)}</span></div>
            </div>
            {errDau && <div className="error">{errDau}</div>}
            <div className="grid">
              <table>
                <thead><tr><th>日期</th><th>DAU</th></tr></thead>
                <tbody>
                  {dauRows.map((r) => (
                    <tr key={r.day}><td>{r.day}</td><td>{fmt(r.dau)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>单剧本维度 PV / UV</strong>
                <div className="help">PV = 消费事件次数；UV = 发生消费事件的去重用户数（描述字段=剧本ID）</div>
              </div>
              <div className="muted">合计 PV：<span>{fmt(pvSum)}</span>；合计 UV：<span>{fmt(uvSum)}</span></div>
            </div>
            {errPvuv && <div className="error">{errPvuv}</div>}
            <div className="grid">
              <table>
                <thead><tr><th>#</th><th>剧本ID</th><th>PV</th><th>UV</th></tr></thead>
                <tbody>
                  {pvuvRows.map((r, i) => (
                    <tr key={`${r.scriptId}-${i}`}>
                      <td>{i + 1}</td>
                      <td className="muted">{r.scriptId}</td>
                      <td>{fmt(r.pv)}</td>
                      <td>{fmt(r.uv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>每日活跃剧本数</strong>
                <div className="help">每天发生过至少一次消费事件的剧本数量</div>
              </div>
              <div className="muted">合计：<span>{fmt(activeTotal)}</span></div>
            </div>
            {errActive && <div className="error">{errActive}</div>}
            <div className="grid">
              <table>
                <thead><tr><th>日期</th><th>活跃剧本数</th></tr></thead>
                <tbody>
                  {activeRows.map((r) => (
                    <tr key={r.day}><td>{r.day}</td><td>{fmt(r.activeScripts)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>活跃趋势（DAU / WAU / MAU）</strong>
                <div className="help">WAU=自然周去重活跃；MAU=自然月去重活跃（按自然口径）</div>
              </div>
            </div>
            {errActiveSeries && <div className="error">{errActiveSeries}</div>}
            <div className="grid" style={{ marginBottom: 8 }}>
              <canvas ref={chartActiveRef} width={800} height={240} />
            </div>
            <div className="grid">
              <table>
                <thead><tr><th>日期</th><th>DAU</th><th>WAU</th><th>MAU</th></tr></thead>
                <tbody>
                  {activeSeriesRows.map((r) => (
                    <tr key={r.day}><td>{r.day}</td><td>{fmt(r.dau)}</td><td>{fmt(r.wau)}</td><td>{fmt(r.mau)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>周留存（自然周）</strong>
                <div className="help">以每个自然周的活跃用户为基数，下一自然周仍活跃的占比</div>
              </div>
            </div>
            {errRetentionW && <div className="error">{errRetentionW}</div>}
            <div className="grid" style={{ marginBottom: 8 }}>
              <canvas ref={chartRetentionWRef} width={800} height={240} />
            </div>
            <div className="grid">
              <table>
                <thead><tr><th>周起始日</th><th>基数(WAU)</th><th>次周活跃</th><th>留存率</th></tr></thead>
                <tbody>
                  {retentionWeekPct.map((r) => (
                    <tr key={r.start}><td>{r.start}</td><td>{fmt(r.base)}</td><td>{fmt(r.retained)}</td><td>{(Number(r.ratePct)).toFixed(1)}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>月留存（自然月）</strong>
                <div className="help">以每个自然月的活跃用户为基数，下一自然月仍活跃的占比</div>
              </div>
            </div>
            {errRetentionM && <div className="error">{errRetentionM}</div>}
            <div className="grid" style={{ marginBottom: 8 }}>
              <canvas ref={chartRetentionMRef} width={800} height={240} />
            </div>
            <div className="grid">
              <table>
                <thead><tr><th>月起始日</th><th>基数(MAU)</th><th>次月活跃</th><th>留存率</th></tr></thead>
                <tbody>
                  {retentionMonthPct.map((r) => (
                    <tr key={r.start}><td>{r.start}</td><td>{fmt(r.base)}</td><td>{fmt(r.retained)}</td><td>{(Number(r.ratePct)).toFixed(1)}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
