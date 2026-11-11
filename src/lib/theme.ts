import { useEffect, useState } from 'react';

/** 可切换主题列表；每一项对应 styles/themes/theme-<id>.css */
export const THEMES = ['default', 'ocean', 'amber', 'crimson'] as const;
export type ThemeId = (typeof THEMES)[number];
export type ThemeMode = 'light' | 'dark' | 'system';

// 功能注释：键名与 index.html 首屏脚本保持一致，避免刷新闪色
const THEME_KEY = 'funloom.theme';
const MODE_KEY = 'funloom.themeMode';
const CHANGE_EVENT = 'funloom:theme-change';
const DEFAULT_THEME: ThemeId = 'default';
const DEFAULT_MODE: ThemeMode = 'dark';

const read = (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* 隐私模式忽略 */ }
};

export const getTheme = (): ThemeId => {
    const v = read(THEME_KEY);
    return (THEMES as readonly string[]).includes(v ?? '') ? (v as ThemeId) : DEFAULT_THEME;
};

export const getThemeMode = (): ThemeMode => {
    const v = read(MODE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT_MODE;
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;

export const resolveMode = (mode: ThemeMode): 'light' | 'dark' =>
    mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode;

/** 切换只改根节点的 data-theme / data-mode */
export const applyTheme = () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', getTheme());
    root.setAttribute('data-mode', resolveMode(getThemeMode()));
};

const notify = () => {
    applyTheme();
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export const setTheme = (theme: ThemeId) => { write(THEME_KEY, theme); notify(); };
export const setThemeMode = (mode: ThemeMode) => { write(MODE_KEY, mode); notify(); };

export const initTheme = () => {
    applyTheme();
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (getThemeMode() === 'system') notify();
    });
    // 多标签页同步
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_KEY || e.key === MODE_KEY) notify();
    });
};

export const useThemeSettings = () => {
    const [state, setState] = useState(() => ({ theme: getTheme(), mode: getThemeMode() }));
    useEffect(() => {
        const sync = () => setState({ theme: getTheme(), mode: getThemeMode() });
        window.addEventListener(CHANGE_EVENT, sync);
        return () => window.removeEventListener(CHANGE_EVENT, sync);
    }, []);
    return { ...state, setTheme, setThemeMode };
};

/**
 * 功能注释：把主题表达式（var(--color-*) / color-mix(...)）解析成具体颜色，
 * 仅供 canvas 等读不到 CSS 变量的场景使用；组件样式仍直接写 var()。
 */
export const readThemeColor = (expr: string): string => {
    if (typeof document === 'undefined') return expr;
    const probe = document.createElement('span');
    probe.style.color = expr;
    probe.style.display = 'none';
    document.documentElement.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value || expr;
};
