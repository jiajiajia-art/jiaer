import { useMemo } from 'react';
import { theme, type ThemeConfig } from 'antd';
import { readThemeColor, resolveMode, useThemeSettings } from '../../lib/theme';

/**
 * 功能注释：antd 在 JS 里推导衍生色，读不到 var()；这里把当前主题令牌解析成具体颜色再交给 antd，
 * 深浅色切换算法。hover / 选中等衍生色交给 antd 从 colorPrimary 自行推导，不写死任何色值。
 */
export function useAdminTheme(): ThemeConfig {
    const { theme: themeId, mode } = useThemeSettings();
    return useMemo(() => {
        const c = (name: string) => readThemeColor(`var(--color-${name})`);
        const primary = c('primary');
        return {
            algorithm: resolveMode(mode) === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: {
                colorPrimary: primary,
                colorInfo: c('info'),
                colorSuccess: c('success'),
                colorWarning: c('highlight'),
                colorError: c('danger'),
                colorBgLayout: c('bg'),
                colorBgContainer: c('surface'),
                colorBgElevated: c('surface'),
                colorText: c('text'),
                colorTextSecondary: c('text-secondary'),
                colorBorder: c('border'),
                colorBorderSecondary: c('border'),
                borderRadius: 8,
                borderRadiusLG: 12,
                controlHeight: 36,
                controlHeightLG: 40,
            },
            components: {
                Layout: {
                    bodyBg: c('bg'),
                    footerBg: c('bg'),
                    headerBg: c('surface'),
                    headerColor: c('text'),
                    siderBg: c('surface'),
                    triggerBg: c('surface-2'),
                    triggerColor: c('text'),
                },
                Menu: {
                    activeBarBorderWidth: 0,
                    itemBg: 'transparent',
                    subMenuItemBg: 'transparent',
                    itemSelectedBg: c('primary-lighter'),
                    itemSelectedColor: c('primary-fg'),
                    itemHoverColor: c('primary-fg'),
                    itemHeight: 42,
                    itemBorderRadius: 8,
                    groupTitleColor: c('text-muted'),
                    groupTitleFontSize: 12,
                },
                Button: { borderRadius: 8, controlHeight: 36 },
                Card: { borderRadiusLG: 12 },
                Table: { headerBg: c('surface-2'), borderColor: c('border') },
                Select: { optionSelectedBg: c('primary-lighter') },
            },
        };
        // themeId/mode 变化时根节点属性已更新，需要重新解析令牌
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [themeId, mode]);
}
