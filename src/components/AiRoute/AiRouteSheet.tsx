/**
 * 功能注释：AI 线路选择弹窗。手机底部弹出、桌面居中。
 * 顶部余额（织梦豆 / KK 币 + 充值）→ 正在使用 → 按厂商分组的线路（可折叠）→ 底部确认。
 * 线路只在点「使用」后生效；「恢复平台默认」清除选择。
 */
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import styles from './AiRouteSheet.module.css';
import RechargeModal from '../Purchase/RechargeModal';
import payApi from '../../api/pay/payApi';
import type { PayOrderRequest } from '../../api/pay/pay.type';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import { formatKk } from '../../utils/kkMoney';
import {
  fmtMultiplier,
  resolveActiveRoute,
  setSelectedAiRouteId,
  type AiRouteBillingMode,
  type AiRouteOption,
} from '../../lib/aiRouteSelection';

const MODE_LABEL: Record<AiRouteBillingMode, string> = { per_token: '按量扣费', per_call: '按次扣费' };

/** 功能注释：分组图标没有图片时，用名称首字 + 稳定色相的徽记 */
function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function fmtPrice(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

interface Props {
  routes: AiRouteOption[];
  selectedId: string;
  onClose: () => void;
  onReload: () => void;
}

const AiRouteSheet: React.FC<Props> = ({ routes, selectedId, onClose, onReload }) => {
  const { user, updateUser } = useAuthStore();
  const active = resolveActiveRoute(routes, selectedId);
  const defaultRoute = routes.find((r) => r.isDefault && r.available);
  const [pick, setPick] = useState<string>(active?.id ?? '');
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const modes = useMemo(() => [...new Set(routes.map((r) => r.billingMode).filter(Boolean))] as AiRouteBillingMode[], [routes]);
  const [mode, setMode] = useState<AiRouteBillingMode | null>(() => (modes.length > 1 ? (active?.billingMode ?? modes[0]) : null));

  const groups = useMemo(() => {
    const list = mode ? routes.filter((r) => r.billingMode === mode) : routes;
    const map = new Map<string, AiRouteOption[]>();
    for (const r of list) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return [...map.entries()].map(([name, items]) => ({ name, icon: items.find((x) => x.groupIcon)?.groupIcon, items }));
  }, [routes, mode]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(active ? [active.group] : groups.slice(0, 1).map((g) => g.name)));
  const toggleGroup = (g: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(g)) n.delete(g); else n.add(g);
    return n;
  });

  // 功能注释：打开时刷新一次余额，确保显示的是最新值
  useEffect(() => {
    let alive = true;
    void auth.getUserInfo().then((res) => {
      if (alive && res.data.success && res.data.data) updateUser(res.data.data);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [updateUser]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !rechargeOpen) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechargeOpen]);

  const close = () => {
    setClosing(true);
    window.setTimeout(onClose, 180);
  };

  const points = user?.user?.points ?? 0;
  const kk = user?.user?.kkBalance?.total ?? user?.user?.diamonds ?? 0;
  const picked = routes.find((r) => r.id === pick);
  const changed = !!picked && picked.id !== active?.id;
  const baseMultiplier = defaultRoute?.multiplier ?? 1;

  const confirm = () => {
    if (!picked || !changed) return close();
    setSelectedAiRouteId(picked.id);
    toast.success(`已切换到「${picked.name}」，下一次生成开始生效`);
    close();
  };

  const resetDefault = () => {
    setSelectedAiRouteId('');
    toast.success(defaultRoute ? `已恢复平台默认「${defaultRoute.name}」` : '已恢复平台默认线路');
    close();
  };

  const handleRecharge = async (order: PayOrderRequest) => {
    try {
      const response = await payApi.getPayQrCode(order);
      if (response.data.code === 200 && response.data.data) return response.data.data;
      toast.error(response.data.message || '创建充值订单失败');
    } catch {
      toast.error('创建充值订单失败');
    }
    return null;
  };

  const closeRecharge = () => {
    setRechargeOpen(false);
    void auth.getUserInfo().then((res) => {
      if (res.data.success && res.data.data) updateUser(res.data.data);
    }).catch(() => undefined);
  };

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayOut : ''}`} onClick={close} role="presentation">
      <section
        className={`${styles.sheet} ${closing ? styles.sheetOut : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-route-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.grabber} aria-hidden="true" />
        <header className={styles.head}>
          <div>
            <h2 id="ai-route-sheet-title" className={styles.title}>AI 线路</h2>
            <p className={styles.subtitle}>决定剧情由哪个模型生成，以及每次怎么扣费</p>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className={styles.wallet}>
          <div className={styles.balance}>
            <span className={styles.balanceLabel}>织梦豆</span>
            <span className={styles.balanceValue}>{points.toLocaleString('zh-CN')}</span>
          </div>
          <span className={styles.walletDivider} aria-hidden="true" />
          <div className={styles.balance}>
            <span className={styles.balanceLabel}>KK 币</span>
            <span className={styles.balanceValue}>{formatKk(kk)}</span>
          </div>
          <button type="button" className={styles.topup} onClick={() => setRechargeOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            充值
          </button>
        </div>

        {active && (
          <div className={styles.current}>
            <span className={styles.currentDot} aria-hidden="true" />
            <span className={styles.currentLabel}>正在使用</span>
            <span className={styles.currentName}>{active.name}</span>
            {!selectedId && <span className={styles.chipSoft}>平台默认</span>}
            <span className={styles.currentMult}>{fmtMultiplier(active.multiplier)}</span>
          </div>
        )}

        {modes.length > 1 && mode && (
          <div className={styles.modes} role="tablist" aria-label="扣费方式">
            {modes.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={`${styles.mode} ${mode === m ? styles.modeOn : ''}`} onClick={() => setMode(m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        )}

        <div className={styles.list} role="radiogroup" aria-label="可选线路">
          {groups.map((g) => {
            const isOpen = expanded.has(g.name);
            const hasPicked = g.items.some((r) => r.id === pick);
            return (
              <div key={g.name} className={`${styles.group} ${isOpen ? styles.groupOpen : ''}`}>
                <button type="button" className={styles.groupHead} onClick={() => toggleGroup(g.name)} aria-expanded={isOpen}>
                  {g.icon ? (
                    <img className={styles.groupIcon} src={g.icon} alt="" />
                  ) : (
                    <span className={styles.groupMono} style={{ '--hue': hueOf(g.name) } as React.CSSProperties} aria-hidden="true">{g.name.slice(0, 1)}</span>
                  )}
                  <span className={styles.groupName}>{g.name}</span>
                  {hasPicked && !isOpen && <span className={styles.groupPicked}>已选</span>}
                  <span className={styles.groupCount}>{g.items.length}</span>
                  <svg className={styles.chev} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {isOpen && (
                  <div className={styles.groupBody}>
                    {g.items.map((r) => {
                      const on = pick === r.id;
                      const rel = r.multiplier > baseMultiplier ? 'up' : r.multiplier < baseMultiplier ? 'down' : 'same';
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!r.available}
                          className={`${styles.route} ${on ? styles.routeOn : ''}`}
                          onClick={() => setPick(r.id)}
                        >
                          <span className={styles.radio} aria-hidden="true" />
                          <span className={styles.routeMain}>
                            <span className={styles.routeTitle}>
                              <span className={styles.routeName}>{r.name}</span>
                              {r.isDefault && <span className={styles.chipAccent}>推荐</span>}
                              {r.tag && r.tag !== g.name && <span className={styles.chipSoft}>{r.tag}</span>}
                              {!r.available && <span className={styles.chipMuted}>维护中</span>}
                            </span>
                            {r.desc && <span className={styles.routeDesc}>{r.desc}</span>}
                            <span className={styles.prices}>
                              <span className={`${styles.mult} ${styles[`mult_${rel}`]}`}>倍率 {fmtMultiplier(r.multiplier)}</span>
                              {r.pricePoints !== undefined && (
                                <span className={styles.price}>{fmtPrice(r.pricePoints)} 织梦豆<small> / {r.priceUnit || '万 token'}</small></span>
                              )}
                              {r.priceKk !== undefined && (
                                <span className={styles.price}>{fmtPrice(r.priceKk)} KK 币<small> / {r.priceUnit || '万 token'}</small></span>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <p className={styles.note}>
            倍率由平台设定：实际扣费 = 本次用量计价 × 倍率。切换后从下一次生成开始生效，已生成的内容不受影响。
            <button type="button" className={styles.linkBtn} onClick={onReload}>刷新线路</button>
          </p>
        </div>

        <footer className={styles.foot}>
          {selectedId ? (
            <button type="button" className={styles.ghost} onClick={resetDefault}>恢复平台默认</button>
          ) : (
            <span className={styles.footHint}>当前为平台默认线路</span>
          )}
          <button type="button" className={styles.primary} onClick={confirm} disabled={!picked || !picked.available}>
            {changed ? `使用「${picked!.name}」` : '完成'}
          </button>
        </footer>
      </section>
      <RechargeModal isOpen={rechargeOpen} onClose={closeRecharge} onRecharge={handleRecharge} fixedTab="diamonds" />
    </div>
  );
};

export default AiRouteSheet;
