import React, { useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/Layout/Navbar';
import MobileBottomNav from '../../components/Layout/MobileBottomNav';
import FooterArea from '../../components/Layout/FooterArea';
import { WAREHOUSE_NAV } from './warehouseNav';
import styles from './WarehouseHub.module.css';

const WarehouseHub: React.FC = () => {
  const navigate = useNavigate();

  const groups = useMemo(() => ({
    mine: WAREHOUSE_NAV.filter((i) => i.group === 'mine'),
    public: WAREHOUSE_NAV.filter((i) => i.group === 'public'),
    extra: WAREHOUSE_NAV.filter((i) => i.group === 'extra'),
  }), []);

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.groupTitle}>我的资源</div>
          {groups.mine.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navBtn}${isActive ? ` ${styles.navBtnActive}` : ''}`
              }
            >
              <span>{item.label}</span>
              {item.soon ? <span className={styles.soon}>待开放</span> : null}
            </NavLink>
          ))}

          <div className={styles.groupTitle}>公共资源</div>
          {groups.public.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navBtn}${isActive ? ` ${styles.navBtnActive}` : ''}`
              }
            >
              <span>{item.label}</span>
              {item.soon ? <span className={styles.soon}>待开放</span> : null}
            </NavLink>
          ))}

          <div className={styles.groupTitle}>其它</div>
          {groups.extra.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navBtn}${isActive ? ` ${styles.navBtnActive}` : ''}`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className={styles.uploadCard}>
            <p>创建更多精彩 — 上传你的资源，与大家分享</p>
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => {
                navigate('/warehouse/public/cards');
                toast.success('可在「我的人设卡」发布到公共卡库');
              }}
            >
              立即上传
            </button>
          </div>
        </aside>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      <FooterArea />
      <MobileBottomNav />
    </div>
  );
};

export default WarehouseHub;
