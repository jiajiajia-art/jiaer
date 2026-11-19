import React from 'react';
import { useTranslation } from 'react-i18next';
import panel from './WarehousePanel.module.css';
import WarehouseEmptyIcon from './WarehouseEmptyIcon';

type Props = {
  title: string;
  description?: string;
};

const WarehouseComingSoon: React.FC<Props> = ({ title, description }) => {
  const { t } = useTranslation();
  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>{title}</h1>
        <p className={panel.sub}>{description || t('warehouse.comingSoon.defaultDescription')}</p>
      </header>
      <div className={panel.emptyStage}>
        <WarehouseEmptyIcon kind="generic" />
        <h2>{t('warehouse.comingSoon.title')}</h2>
        <p>{t('warehouse.comingSoon.body')}</p>
      </div>
    </div>
  );
};

export default WarehouseComingSoon;
