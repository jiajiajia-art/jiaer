import React from 'react';
import panel from './WarehousePanel.module.css';

type Props = {
  title: string;
  description?: string;
};

const WarehouseComingSoon: React.FC<Props> = ({ title, description }) => (
  <div className={panel.panelRoot}>
    <header className={panel.header}>
      <h1 className={panel.title}>{title}</h1>
      <p className={panel.sub}>{description || '功能开发中，敬请期待'}</p>
    </header>
    <div className={panel.emptyStage}>
      <div className={panel.emptyOrb} aria-hidden />
      <h2>即将开放</h2>
      <p>界面骨架已就绪，能力模块正在接入。先去「玩家人设卡」或「公共卡库」逛逛吧。</p>
    </div>
  </div>
);

export default WarehouseComingSoon;
