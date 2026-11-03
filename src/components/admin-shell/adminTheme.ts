import { theme, type ThemeConfig } from 'antd';

export const adminTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    colorInfo: '#1677ff',
    colorBgLayout: '#f5f8ff',
    colorBgContainer: '#ffffff',
    colorText: '#262626',
    colorTextSecondary: '#8c8c8c',
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
    borderRadius: 8,
    borderRadiusLG: 12,
    controlHeight: 36,
    controlHeightLG: 40,
    boxShadowSecondary: '0 8px 24px rgba(31, 56, 88, 0.08)',
  },
  components: {
    Layout: {
      bodyBg: '#f5f8ff',
      footerBg: '#f5f8ff',
      headerBg: '#ffffff',
      headerColor: '#262626',
      siderBg: '#ffffff',
      triggerBg: '#f0f5ff',
      triggerColor: '#262626',
    },
    Menu: {
      activeBarBorderWidth: 0,
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: '#e6f4ff',
      itemSelectedColor: '#1677ff',
      itemHoverBg: '#f5faff',
      itemHoverColor: '#1677ff',
      itemHeight: 42,
      itemBorderRadius: 8,
      groupTitleColor: '#8c8c8c',
      groupTitleFontSize: 12,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Card: {
      borderRadiusLG: 12,
      boxShadowTertiary: '0 4px 16px rgba(31, 56, 88, 0.06)',
    },
    Table: {
      headerBg: '#fafcff',
      rowHoverBg: '#f5faff',
      borderColor: '#f0f0f0',
    },
    Input: {
      activeBorderColor: '#1677ff',
      hoverBorderColor: '#69b1ff',
    },
    Select: {
      optionSelectedBg: '#e6f4ff',
    },
  },
};
