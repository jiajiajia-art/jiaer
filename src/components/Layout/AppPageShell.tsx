import React, { type ReactNode, type Ref } from 'react';
import Navbar from './Navbar';
import MobileBottomNav from './MobileBottomNav';
import styles from './AppPageShell.module.css';

type NavbarProps = React.ComponentProps<typeof Navbar>;

type AppPageShellProps = {
  children: ReactNode;
  /** 不渲染底栏（创作全屏等） */
  hideBottomNav?: boolean;
  /** 底栏占位但视觉隐藏 */
  bottomNavHidden?: boolean;
  navbarProps?: NavbarProps;
  /** 透传给中间滚动区，例如页面自带的 mainContent class */
  mainClassName?: string;
  /** 透传给最外层壳 */
  shellClassName?: string;
  /** 中间滚动容器 ref（无限滚动等） */
  mainRef?: Ref<HTMLElement>;
};

/**
 * 功能注释：统一页面壳。顶栏/底栏固定在屏幕边缘；中间内容区用剩余视口高度单独滚动。
 * 页面不要再写死 navbar 上边距——避让由 --app-navbar-offset / --app-bottom-nav-offset 负责。
 */
const AppPageShell: React.FC<AppPageShellProps> = ({
  children,
  hideBottomNav = false,
  bottomNavHidden = false,
  navbarProps,
  mainClassName,
  shellClassName,
  mainRef,
}) => {
  const mainCls = [
    styles.main,
    hideBottomNav ? styles.mainNoBottomNav : '',
    mainClassName || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.shell, shellClassName || ''].filter(Boolean).join(' ')} data-app-page-shell="1">
      <Navbar {...navbarProps} />
      <main ref={mainRef} className={mainCls} data-app-page-main="1">
        {children}
      </main>
      {!hideBottomNav ? <MobileBottomNav hidden={bottomNavHidden} /> : null}
    </div>
  );
};

export default AppPageShell;
