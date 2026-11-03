import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, ConfigProvider, Dropdown, Layout, Menu } from 'antd';
import { HomeOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import { getImageUrl } from '../../utils/constants';
import { adminTheme } from './adminTheme';
import { flattenNavigationItems, getAdminNavigation, resolveNavigationSelection, toMenuItems, type AdminShellMode } from './adminNavigation';
import styles from './AdminShell.module.css';

const { Header, Sider, Content } = Layout;

interface AdminShellProps {
  mode: AdminShellMode;
  activeKey: string;
  children: React.ReactNode;
  userId?: string;
  badges?: Record<string, number>;
}

const AdminShell: React.FC<AdminShellProps> = ({ mode, activeKey, children, userId, badges }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const authUser = useAuthStore((state) => state.user?.user);
  const logout = useAuthStore((state) => state.logout);

  const groups = useMemo(
    () => getAdminNavigation(mode, {
      isAdmin: isAdminRole(authUser?.role),
      userId: userId ?? authUser?.userId,
      badges,
    }),
    [authUser?.role, authUser?.userId, badges, mode, userId],
  );
  const menuItems = useMemo(() => toMenuItems(groups), [groups]);
  const navigationItems = useMemo(() => flattenNavigationItems(groups), [groups]);
  const selection = useMemo(() => resolveNavigationSelection(groups, location.pathname), [groups, location.pathname]);
  const selectedKey = selection?.key ?? activeKey;

  useEffect(() => {
    if (selection) setOpenKeys(selection.openKeys);
  }, [selection]);
  const avatarUrl = getImageUrl(authUser?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/default_avatar.png`;

  const menu = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') {
        logout();
        navigate('/home');
      }
    },
  };

  return (
    <ConfigProvider theme={adminTheme}>
      <div className={styles.shell}>
        <Layout className={styles.layout}>
          <Header className={styles.header}>
            <div className={styles.brand} aria-label={mode === 'admin' ? '管理面板' : '运营中心'}>
              <span className={styles.brandMark}><SettingOutlined /></span>
              <span className={styles.brandName}>{mode === 'admin' ? '管理面板' : '运营中心'}</span>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="text"
                icon={<HomeOutlined />}
                className={styles.homeButton}
                onClick={() => navigate('/home')}
              >
                返回首页
              </Button>
              <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
                <button type="button" className={styles.avatarButton} aria-label="打开用户菜单">
                  <Avatar src={avatarUrl} icon={<UserOutlined />} size={34} />
                </button>
              </Dropdown>
            </div>
          </Header>
          <Layout hasSider>
            <Sider width={240} className={styles.sider} theme="light">
              <div className={styles.siderInner}>
                <Menu
                  className={styles.menu}
                  mode="inline"
                  selectedKeys={[selectedKey]}
                  openKeys={openKeys}
                  items={menuItems}
                  onOpenChange={setOpenKeys}
                  onClick={({ key }) => {
                    const selected = navigationItems.find((item) => item.key === key);
                    if (selected?.path) navigate(selected.path);
                  }}
                />
              </div>
            </Sider>
            <Content className={styles.content}>{children}</Content>
          </Layout>
        </Layout>
      </div>
    </ConfigProvider>
  );
};

export default AdminShell;
