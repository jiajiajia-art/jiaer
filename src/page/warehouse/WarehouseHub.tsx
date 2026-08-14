import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/Layout/Navbar';
import MobileBottomNav from '../../components/Layout/MobileBottomNav';
import FooterArea from '../../components/Layout/FooterArea';
import {
  WAREHOUSE_GROUP_LABEL,
  WAREHOUSE_NAV,
  resolveWarehouseNavItem,
  type WarehouseNavItem,
} from './warehouseNav';
import styles from './WarehouseHub.module.css';

const GROUP_ORDER: WarehouseNavItem['group'][] = ['mine', 'public', 'extra'];

const WarehouseHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const groups = useMemo(
    () => ({
      mine: WAREHOUSE_NAV.filter((i) => i.group === 'mine'),
      public: WAREHOUSE_NAV.filter((i) => i.group === 'public'),
      extra: WAREHOUSE_NAV.filter((i) => i.group === 'extra'),
    }),
    [],
  );

  const current = useMemo(
    () => resolveWarehouseNavItem(location.pathname),
    [location.pathname],
  );

  const railItems = useMemo(() => {
    if (!current) return WAREHOUSE_NAV;
    return WAREHOUSE_NAV.filter((i) => i.group === current.group);
  }, [current]);

  useEffect(() => {
    setSheetOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  const goUpload = () => {
    navigate('/warehouse/public/cards');
    toast.success('可在「我的人设卡」发布到公共卡库');
    setSheetOpen(false);
  };

  const renderNavLinks = (items: WarehouseNavItem[], variant: 'side' | 'sheet' | 'rail') =>
    items.map((item) => (
      <NavLink
        key={item.id}
        to={item.path}
        end
        className={({ isActive }) => {
          if (variant === 'rail') {
            return `${styles.railChip}${isActive ? ` ${styles.railChipActive}` : ''}`;
          }
          if (variant === 'sheet') {
            return `${styles.sheetLink}${isActive ? ` ${styles.sheetLinkActive}` : ''}`;
          }
          return `${styles.navBtn}${isActive ? ` ${styles.navBtnActive}` : ''}`;
        }}
        onClick={() => {
          if (variant !== 'side') setSheetOpen(false);
        }}
      >
        <span>{item.label}</span>
        {item.soon ? <span className={styles.soon}>待开放</span> : null}
      </NavLink>
    ));

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="仓库目录">
          <div className={styles.groupTitle}>我的资源</div>
          {renderNavLinks(groups.mine, 'side')}

          <div className={styles.groupTitle}>公共资源</div>
          {renderNavLinks(groups.public, 'side')}

          <div className={styles.groupTitle}>其它</div>
          {renderNavLinks(groups.extra, 'side')}

          <div className={styles.uploadCard}>
            <p>创建更多精彩 — 上传你的资源，与大家分享</p>
            <button type="button" className={styles.uploadBtn} onClick={goUpload}>
              立即上传
            </button>
          </div>
        </aside>

        <div className={styles.mobileChrome}>
          <div className={styles.mobileTop}>
            <div className={styles.mobileCurrent}>
              <span className={styles.mobileEyebrow}>
                {current ? WAREHOUSE_GROUP_LABEL[current.group] : '资源库'}
              </span>
              <h1 className={styles.mobileTitle}>{current?.label ?? '仓库'}</h1>
            </div>
            <button
              type="button"
              className={styles.mobileCatalogBtn}
              aria-expanded={sheetOpen}
              aria-controls="warehouse-catalog-sheet"
              onClick={() => setSheetOpen(true)}
            >
              目录
            </button>
          </div>

          <nav className={styles.mobileRail} aria-label="同组快捷切换">
            {renderNavLinks(railItems, 'rail')}
          </nav>

          <button type="button" className={styles.mobileUploadStrip} onClick={goUpload}>
            <span className={styles.mobileUploadCopy}>上传资源 · 与大家分享</span>
            <span className={styles.mobileUploadCta}>立即上传</span>
          </button>
        </div>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      {sheetOpen ? (
        <div
          className={styles.sheetRoot}
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            id="warehouse-catalog-sheet"
            className={styles.sheetPanel}
            role="dialog"
            aria-modal="true"
            aria-label="仓库目录"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>选择分区</h2>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={() => setSheetOpen(false)}
              >
                关闭
              </button>
            </div>
            {GROUP_ORDER.map((group) => (
              <section key={group} className={styles.sheetGroup}>
                <div className={styles.sheetGroupTitle}>{WAREHOUSE_GROUP_LABEL[group]}</div>
                <div className={styles.sheetLinks}>{renderNavLinks(groups[group], 'sheet')}</div>
              </section>
            ))}
            <button type="button" className={styles.sheetUpload} onClick={goUpload}>
              立即上传资源
            </button>
          </div>
        </div>
      ) : null}

      <FooterArea />
      <MobileBottomNav />
    </div>
  );
};

export default WarehouseHub;
