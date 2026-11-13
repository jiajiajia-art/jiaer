import React from 'react';
import { Button, Popover, Segmented } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { THEMES, resolveMode, useThemeSettings, type ThemeMode } from '../../lib/theme';
import styles from './AdminSkinSwitcher.module.css';

/** 后台右上角皮肤切换：只改根节点 data-theme / data-mode；色块自带 data-theme 读各主题自己的变量 */
const AdminSkinSwitcher: React.FC = () => {
    const { t } = useTranslation();
    const { theme, mode, setTheme, setThemeMode } = useThemeSettings();
    const previewMode = resolveMode(mode);

    const content = (
        <div className={styles.panel}>
            <div className={styles.label}>{t('settings.theme')}</div>
            <div className={styles.swatches}>
                {THEMES.map((id) => (
                    <button
                        key={id}
                        type="button"
                        data-theme={id}
                        data-mode={previewMode}
                        className={`${styles.swatchItem} ${theme === id ? styles.active : ''}`}
                        aria-pressed={theme === id}
                        onClick={() => setTheme(id)}
                    >
                        <span className={styles.swatch}>{theme === id && <CheckOutlined />}</span>
                        <span className={styles.name}>{t(`settings.themes.${id}`)}</span>
                    </button>
                ))}
            </div>
            <div className={styles.label}>{t('settings.mode')}</div>
            <Segmented<ThemeMode>
                block
                value={mode}
                onChange={(value) => setThemeMode(value)}
                options={(['light', 'dark', 'system'] as const).map((m) => ({ value: m, label: t(`settings.modes.${m}`) }))}
            />
        </div>
    );

    return (
        <Popover content={content} trigger="click" placement="bottomRight" arrow={false}>
            <Button type="text" icon={<BgColorsOutlined />} aria-label={t('settings.title')}>
                {t('settings.skin')}
            </Button>
        </Popover>
    );
};

export default AdminSkinSwitcher;
