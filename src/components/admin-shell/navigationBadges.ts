export interface NavigationBadgeItem {
  badge?: number;
  children?: NavigationBadgeItem[];
}

export const getNavigationBadgeCount = (item: NavigationBadgeItem): number => {
  const ownCount = Number(item.badge);
  if (Number.isFinite(ownCount) && ownCount > 0) return Math.floor(ownCount);
  return item.children?.reduce((total, child) => total + getNavigationBadgeCount(child), 0) || 0;
};
