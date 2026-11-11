import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MdCheck, MdOutlineDarkMode, MdOutlineLightMode, MdOutlineSettingsBrightness } from 'react-icons/md';
import { THEMES, resolveMode, useThemeSettings, type ThemeMode } from '../../lib/theme';
import { APP_LANGUAGE_OPTIONS, applyAppLanguage, normalizeAppLanguage } from '../../utils/appLanguage';
import styles from './AppearanceSettingsModal.module.css';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const MODES: { key: ThemeMode; icon: React.ReactNode }[] = [
    { key: 'light', icon: <MdOutlineLightMode /> },
    { key: 'dark', icon: <MdOutlineDarkMode /> },
    { key: 'system', icon: <MdOutlineSettingsBrightness /> },
];

/** 外观与语言：主题 / 深浅色 / 语言。色块自带 data-theme，直接读各主题自己的变量，不写死色值 */
const AppearanceSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const { theme, mode, setTheme, setThemeMode } = useThemeSettings();

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const activeLang = normalizeAppLanguage(i18n.resolvedLanguage || i18n.language) ?? 'zh';
    const previewMode = resolveMode(mode);

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <section
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="appearance-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <h2 id="appearance-title">{t('settings.title')}</h2>
                    <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.cancel')}>×</button>
                </header>

                <h3 className={styles.label}>{t('settings.theme')}</h3>
                <div className={styles.themeGrid}>
                    {THEMES.map((id) => (
                        <button
                            key={id}
                            type="button"
                            data-theme={id}
                            data-mode={previewMode}
                            className={`${styles.themeItem} ${theme === id ? styles.selected : ''}`}
                            aria-pressed={theme === id}
                            onClick={() => setTheme(id)}
                        >
                            <span className={styles.swatch}>
                                {theme === id && <MdCheck />}
                            </span>
                            <span className={styles.themeName}>{t(`settings.themes.${id}`)}</span>
                        </button>
                    ))}
                </div>

                <h3 className={styles.label}>{t('settings.mode')}</h3>
                <div className={styles.segment} role="group" aria-label={t('settings.mode')}>
                    {MODES.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`${styles.segmentItem} ${mode === item.key ? styles.segmentActive : ''}`}
                            aria-pressed={mode === item.key}
                            onClick={() => setThemeMode(item.key)}
                        >
                            {item.icon}
                            {t(`settings.modes.${item.key}`)}
                        </button>
                    ))}
                </div>

                <h3 className={styles.label}>{t('nav.language')}</h3>
                <div className={styles.list}>
                    {APP_LANGUAGE_OPTIONS.map((opt) => (
                        <button
                            key={opt.code}
                            type="button"
                            className={styles.row}
                            onClick={() => { void applyAppLanguage(opt.code, (lng) => i18n.changeLanguage(lng)); }}
                        >
                            {opt.label}
                            {activeLang === opt.code && <MdCheck className={styles.rowCheck} />}
                        </button>
                    ))}
                </div>
            </section>
        </div>,
        document.body,
    );
};

export default AppearanceSettingsModal;
