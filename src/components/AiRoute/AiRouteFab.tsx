/**
 * 功能注释：游玩页 AI 线路悬浮球（AI 文游 / 酒馆卡 / Romance 游玩共用）。
 * - 默认用平台默认线路；点开弹窗可看余额、切换线路，确认后下一次生成生效。
 * - 悬浮球可拖动；松手贴左 / 右边；拖到屏幕边缘收成半隐藏小标签，点一下弹回。位置记在本机。
 * - 后端暂无可选线路时仍显示（标「平台默认」），弹窗里说明暂无可切换线路；入口不再消失。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './AiRouteFab.module.css';
import AiRouteSheet from './AiRouteSheet';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchAiRouteOptions,
  getSelectedAiRouteId,
  resolveActiveRoute,
  subscribeAiRoute,
  type AiRouteOption,
} from '../../lib/aiRouteSelection';

type FabPos = { side: 'left' | 'right'; y: number; docked: boolean };
const POS_KEY = 'funloom:aiRouteFab';
const SIZE = 52;
const EDGE_DOCK_PX = 28;
const DRAG_THRESHOLD = 6;

function readPos(): FabPos {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) || 'null') as Partial<FabPos> | null;
    if (v && (v.side === 'left' || v.side === 'right') && typeof v.y === 'number') {
      return { side: v.side, y: Math.min(0.92, Math.max(0.08, v.y)), docked: !!v.docked };
    }
  } catch {
    /* ignore */
  }
  return { side: 'right', y: 0.62, docked: false };
}

function savePos(p: FabPos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const AiRouteFab: React.FC<{ label?: string }> = ({ label = 'AI 线路' }) => {
  const token = useAuthStore((s) => s.user?.token);
  const [routes, setRoutes] = useState<AiRouteOption[] | null>(null);
  const [selectedId, setSelectedId] = useState(getSelectedAiRouteId);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FabPos>(readPos);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ px: number; py: number; moved: boolean } | null>(null);

  const load = useCallback((force = false) => {
    void fetchAiRouteOptions(token, force).then(setRoutes);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribeAiRoute(() => setSelectedId(getSelectedAiRouteId())), []);

  const active = routes ? resolveActiveRoute(routes, selectedId) : undefined;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    startRef.current = { px: e.clientX, py: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = startRef.current;
    if (!st) return;
    if (!st.moved && Math.hypot(e.clientX - st.px, e.clientY - st.py) < DRAG_THRESHOLD) return;
    st.moved = true;
    setDrag({ x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = startRef.current;
    startRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!st) return;
    if (!st.moved) {
      // 功能注释：点按——收起状态先弹回，展开状态打开弹窗
      if (pos.docked) {
        const next = { ...pos, docked: false };
        setPos(next);
        savePos(next);
      } else {
        setOpen(true);
        load(true);
      }
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const side: FabPos['side'] = e.clientX < w / 2 ? 'left' : 'right';
    const nearEdge = e.clientX <= EDGE_DOCK_PX || e.clientX >= w - EDGE_DOCK_PX;
    const next: FabPos = { side, y: Math.min(0.92, Math.max(0.08, e.clientY / h)), docked: nearEdge };
    setDrag(null);
    setPos(next);
    savePos(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (pos.docked) {
        const next = { ...pos, docked: false };
        setPos(next);
        savePos(next);
      } else {
        setOpen(true);
        load(true);
      }
    }
  };

  // 功能注释：线路接口还没返回前不渲染；返回空列表也照常显示入口（走平台默认）
  if (!routes) return null;

  const style: React.CSSProperties = drag
    ? { left: drag.x - SIZE / 2, top: drag.y - SIZE / 2 }
    : {
      top: `calc(${(pos.y * 100).toFixed(2)}% - ${SIZE / 2}px)`,
      [pos.side]: pos.docked ? -SIZE * 0.58 : 12,
    };

  const name = active?.name ?? '平台默认';

  return createPortal(
    <>
      <button
        type="button"
        className={`${styles.fab} ${drag ? styles.dragging : ''} ${pos.docked && !drag ? styles.docked : ''} ${pos.side === 'left' ? styles.left : styles.right}`}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { startRef.current = null; setDrag(null); }}
        onKeyDown={onKeyDown}
        aria-label={pos.docked ? `展开${label}按钮` : `${label}：当前 ${name}，点击切换`}
        title={pos.docked ? '点击展开' : `${label} · ${name}`}
        data-ai-route-fab="1"
      >
        <span className={styles.ring} aria-hidden="true" />
        <span className={styles.core} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="18" r="2.2" />
            <circle cx="18" cy="6" r="2.2" />
            <path d="M6 15.8V10a4 4 0 0 1 4-4h5.8" />
            <path d="M18 8.2V14a4 4 0 0 1-4 4H8.2" strokeOpacity="0.55" />
          </svg>
        </span>
        {pos.docked && !drag && <span className={styles.peekGrip} aria-hidden="true" />}
      </button>
      {open && (
        <AiRouteSheet
          routes={routes}
          selectedId={selectedId}
          onClose={() => setOpen(false)}
          onReload={() => load(true)}
        />
      )}
    </>,
    document.body,
  );
};

export default AiRouteFab;
