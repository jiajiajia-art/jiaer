import { isMiniProgramEnv } from './miniProgram';

export function isExternalLink(url: string): boolean {
    const trimmed = url.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function normalizeInternalPath(url: string): string {
    const trimmed = url.trim();
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function splitPathAndHash(url: string): { pathname: string; hash: string } {
    const trimmed = normalizeInternalPath(url);
    const hashIndex = trimmed.indexOf('#');

    if (hashIndex === -1) {
        return { pathname: trimmed, hash: '' };
    }

    return {
        pathname: trimmed.slice(0, hashIndex) || '/',
        hash: trimmed.slice(hashIndex),
    };
}

export function getPromotionActivityAnchorId(title: string): string {
    return `promotion-${encodeURIComponent(title.trim())}`;
}

export function buildPromotionInternalLinkExample(title: string): string {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
        return '/promotions#活动标题';
    }

    return `/promotions#${trimmedTitle}`;
}

export function decodeLocationHash(rawHash?: string): string {
    const hash = (rawHash ?? (typeof window !== 'undefined' ? window.location.hash : '')).replace(/^#/, '');
    if (!hash) {
        return '';
    }

    try {
        return decodeURIComponent(hash);
    } catch {
        return hash;
    }
}

export function findPromotionActivityByHash<T extends { title: string }>(
    activities: T[],
    rawHash?: string,
): T | null {
    const decodedHash = decodeLocationHash(rawHash);
    if (!decodedHash) {
        return null;
    }

    return activities.find((activity) => activity.title.trim() === decodedHash.trim()) || null;
}

export type OpenConfiguredLinkOptions = {
    navigate: (path: string) => void;
    onExternalLinkCopy?: (url: string) => void;
};

export function openConfiguredLink(url: string, options: OpenConfiguredLinkOptions): void {
    const trimmed = url.trim();
    if (!trimmed) {
        return;
    }

    if (isExternalLink(trimmed)) {
        if (isMiniProgramEnv()) {
            options.onExternalLinkCopy?.(trimmed);
            return;
        }

        window.open(trimmed, '_blank', 'noopener,noreferrer');
        return;
    }

    const { pathname, hash } = splitPathAndHash(trimmed);
    options.navigate(`${pathname}${hash}`);
}

export function resolvePromotionAdLink(activity: {
    internalLinkUrl?: string;
    detailLinkUrl?: string;
}): string {
    const internalLink = (activity.internalLinkUrl || '').trim();
    if (internalLink) {
        return internalLink;
    }

    return (activity.detailLinkUrl || '').trim();
}
