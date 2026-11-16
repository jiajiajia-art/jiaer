import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    toast.success(t('warehouse.uploadToast'));
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
        <span>{t(item.label)}</span>
        {item.soon ? <span className={styles.soon}>{t('warehouse.soon')}</span> : null}
      </NavLink>
    ));

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label={t('warehouse.catalogAria')}>
          <div className={styles.groupTitle}>{t(WAREHOUSE_GROUP_LABEL.mine)}</div>
          {renderNavLinks(groups.mine, 'side')}

          <div className={styles.groupTitle}>{t(WAREHOUSE_GROUP_LABEL.public)}</div>
          {renderNavLinks(groups.public, 'side')}

          <div className={styles.groupTitle}>{t(WAREHOUSE_GROUP_LABEL.extra)}</div>
          {renderNavLinks(groups.extra, 'side')}

          <div className={styles.uploadCard}>
            <p>{t('warehouse.uploadShare')}</p>
            <button type="button" className={styles.uploadBtn} onClick={goUpload}>
              {t('warehouse.uploadNow')}
            </button>
          </div>
        </aside>

        <div className={styles.mobileChrome}>
          <div className={styles.mobileTop}>
            <div className={styles.mobileCurrent}>
              <span className={styles.mobileEyebrow}>
                {current ? t(WAREHOUSE_GROUP_LABEL[current.group]) : t('warehouse.resourceLibrary')}
              </span>
              <h1 className={styles.mobileTitle}>
                {current ? t(current.label) : t('warehouse.title')}
              </h1>
            </div>
            <button
              type="button"
              className={styles.mobileCatalogBtn}
              aria-expanded={sheetOpen}
              aria-controls="warehouse-catalog-sheet"
              onClick={() => setSheetOpen(true)}
            >
              {t('warehouse.catalog')}
            </button>
          </div>

          <nav className={styles.mobileRail} aria-label={t('warehouse.catalogAria')}>
            {renderNavLinks(railItems, 'rail')}
          </nav>

          <button type="button" className={styles.mobileUploadStrip} onClick={goUpload}>
            <span className={styles.mobileUploadCopy}>{t('warehouse.uploadShareShort')}</span>
            <span className={styles.mobileUploadCta}>{t('warehouse.uploadNow')}</span>
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
            aria-label={t('warehouse.catalogAria')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{t('warehouse.sheetTitle')}</h2>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={() => setSheetOpen(false)}
              >
                {t('common.close')}
              </button>
            </div>
            {GROUP_ORDER.map((group) => (
              <section key={group} className={styles.sheetGroup}>
                <div className={styles.sheetGroupTitle}>{t(WAREHOUSE_GROUP_LABEL[group])}</div>
                <div className={styles.sheetLinks}>{renderNavLinks(groups[group], 'sheet')}</div>
              </section>
            ))}
            <button type="button" className={styles.sheetUpload} onClick={goUpload}>
              {t('warehouse.uploadNowLong')}
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
