import React from 'react';
import {
  MdExtension,
  MdMenuBook,
  MdPerson,
  MdGroups,
  MdInventory2,
} from 'react-icons/md';
import panel from './WarehousePanel.module.css';

export type WarehouseEmptyIconKind =
  | 'plugin'
  | 'worldbook'
  | 'persona'
  | 'character'
  | 'generic';

const ICONS: Record<WarehouseEmptyIconKind, typeof MdExtension> = {
  plugin: MdExtension,
  worldbook: MdMenuBook,
  persona: MdPerson,
  character: MdGroups,
  generic: MdInventory2,
};

/**
 * 功能注释：空状态酒红方块内放语义图标，避免纯色占位；kind 对齐资源类型。
 */
const WarehouseEmptyIcon: React.FC<{ kind?: WarehouseEmptyIconKind }> = ({
  kind = 'generic',
}) => {
  const Icon = ICONS[kind] || ICONS.generic;
  return (
    <div className={panel.emptyOrb} aria-hidden>
      <Icon className={panel.emptyOrbIcon} size={28} />
    </div>
  );
};

export default WarehouseEmptyIcon;
