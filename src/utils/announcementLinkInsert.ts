import { isValidAnnouncementInternalLink } from './announcementLinks';

export interface AnnouncementQuickPageOption {
    key: string;
    label: string;
    path: string;
}

export interface AnnouncementSelectionRange {
    start: number;
    end: number;
}

export const ANNOUNCEMENT_QUICK_PAGE_OPTIONS: AnnouncementQuickPageOption[] = [
    { key: 'home', label: 'Home', path: '/home' },
    { key: 'categories', label: 'Categories', path: '/categories' },
    { key: 'library', label: 'Library', path: '/library' },
    { key: 'specials', label: 'Specials', path: '/specials' },
    { key: 'promotions', label: 'Promotions', path: '/promotions' },
    { key: 'messages', label: 'Messages', path: '/messages' },
    { key: 'profile', label: 'Profile', path: '/profile' },
    { key: 'create', label: 'Create', path: '/create' },
    { key: 'warehouse', label: 'Warehouse', path: '/warehouse' },
];

export const buildAnnouncementLinkMarkdown = (text: string, path: string): string => `[${text}](${path})`;

export const insertAnnouncementLinkAtSelection = (
    body: string,
    selection: AnnouncementSelectionRange,
    linkText: string,
    path: string,
) => {
    const safeStart = Math.max(0, Math.min(selection.start, body.length));
    const safeEnd = Math.max(safeStart, Math.min(selection.end, body.length));
    const markdown = buildAnnouncementLinkMarkdown(linkText, path);
    const nextBody = `${body.slice(0, safeStart)}${markdown}${body.slice(safeEnd)}`;
    const nextCursor = safeStart + markdown.length;

    return {
        nextBody,
        nextSelection: { start: nextCursor, end: nextCursor },
    };
};

export const normalizeAnnouncementLinkDraft = (
    linkText: string,
    path: string,
    fallbackText: string,
) => {
    const trimmedPath = path.trim();
    const trimmedLinkText = linkText.trim() || fallbackText.trim();

    if (!trimmedPath) {
        return { valid: false as const, message: 'Path is required.' };
    }

    if (!isValidAnnouncementInternalLink(trimmedPath)) {
        return { valid: false as const, message: 'Path must be a valid internal route.' };
    }

    if (!trimmedLinkText) {
        return { valid: false as const, message: 'Link text is required.' };
    }

    return {
        valid: true as const,
        linkText: trimmedLinkText,
        path: trimmedPath,
    };
};
