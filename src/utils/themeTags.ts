import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameTagTreeNode } from '../api/gameTags/gameTagsApi.type';
import { localizeChineseByLanguage } from './chineseScript.ts';

export interface FlatThemeTag {
    id: number;
    name: string;
    parentName: string;
    parentId?: number | null;
    depth?: number;
    pathNames?: string[];
    pathLabel?: string;
    isLeaf?: boolean;
}

export const flattenThemeTags = (tree: GameTagTreeNode[]): FlatThemeTag[] => {
    const flat: FlatThemeTag[] = [];

    const walk = (node: GameTagTreeNode, path: GameTagTreeNode[] = []) => {
        const currentPath = [...path, node];
        const children = Array.isArray(node.children) ? node.children : [];
        const hasChildren = children.length > 0;

        if (path.length > 0 || !hasChildren) {
            flat.push({
                id: Number(node.id),
                name: String(node.name || ''),
                parentName: String(path[path.length - 1]?.name || ''),
                parentId: Number(path[path.length - 1]?.id || 0) || null,
                depth: path.length,
                pathNames: currentPath.map((item) => String(item.name || '')).filter(Boolean),
                pathLabel: currentPath.map((item) => String(item.name || '')).filter(Boolean).join(' / '),
                isLeaf: !hasChildren,
            });
        }

        children.forEach((child) => walk(child, currentPath));
    };

    (tree || []).forEach((root) => walk(root));

    return flat.filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name);
};

type ThemeLabelTranslator = (key: string, options?: { defaultValue?: string }) => string;

/** 功能注释：后台题材名优先用语言包；没有译文时简体保持原文，繁体只做字形转换 */
export function translateThemeLabel(
    name: string,
    t: ThemeLabelTranslator,
    language?: string | null,
): string {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '';
    const translated = t(`themeNames.${trimmed}`, { defaultValue: '' });
    if (translated) return translated;
    return localizeChineseByLanguage(trimmed, language);
}

function translateThemePath(pathLabel: string, t: ThemeLabelTranslator, language?: string | null): string {
    return pathLabel
        .split('/')
        .map((part) => translateThemeLabel(part.trim(), t, language))
        .filter(Boolean)
        .join(' / ');
}

/** 功能注释：题材名来自后台简体；按当前语言转繁体，id 不变以免提交错标签 */
export function localizeFlatThemeTags(
    tags: FlatThemeTag[],
    language?: string | null,
): FlatThemeTag[] {
    return (tags || []).map((tag) => ({
        ...tag,
        name: localizeChineseByLanguage(tag.name, language),
        parentName: localizeChineseByLanguage(tag.parentName, language),
        pathNames: tag.pathNames?.map((name) => localizeChineseByLanguage(name, language)),
        pathLabel: tag.pathLabel
            ? localizeChineseByLanguage(tag.pathLabel, language)
            : tag.pathLabel,
    }));
}

export function useLocalizedThemeTags<T extends Pick<FlatThemeTag, 'id' | 'name'> & Partial<FlatThemeTag>>(
    tags: T[],
): T[] {
    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage || i18n.language;
    return useMemo(
        () => (tags || []).map((tag) => ({
            ...tag,
            name: translateThemeLabel(tag.name, t, language),
            parentName: tag.parentName ? translateThemeLabel(tag.parentName, t, language) : tag.parentName,
            pathNames: tag.pathNames?.map((name) => translateThemeLabel(name, t, language)),
            pathLabel: tag.pathLabel ? translateThemePath(tag.pathLabel, t, language) : tag.pathLabel,
        })) as T[],
        [language, t, tags],
    );
}
