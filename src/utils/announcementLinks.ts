export type AnnouncementBodyPart =
    | { type: 'text'; text: string }
    | { type: 'link'; text: string; path: string; raw: string };

const ANNOUNCEMENT_LINK_PATTERN = /\[([^\]\n]+)\]\(([^)]*)\)/g;
const INVALID_INTERNAL_LINK_CHARS = /[\u0000-\u001F\u007F\s<>"'`\\]/;
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export const isValidAnnouncementInternalLink = (path: string): boolean => {
    const trimmedPath = path.trim();

    if (!trimmedPath || !trimmedPath.startsWith('/') || trimmedPath.startsWith('//')) {
        return false;
    }

    if (URL_SCHEME_PATTERN.test(trimmedPath) || /^https?:\/\//i.test(trimmedPath)) {
        return false;
    }

    return !INVALID_INTERNAL_LINK_CHARS.test(trimmedPath);
};

export const parseAnnouncementBody = (body: string): AnnouncementBodyPart[] => {
    const parts: AnnouncementBodyPart[] = [];
    let lastIndex = 0;

    for (const match of body.matchAll(ANNOUNCEMENT_LINK_PATTERN)) {
        const matchIndex = match.index ?? 0;
        const raw = match[0];
        const linkText = match[1];
        const linkPath = match[2].trim();

        if (matchIndex > lastIndex) {
            parts.push({ type: 'text', text: body.slice(lastIndex, matchIndex) });
        }

        if (linkText && isValidAnnouncementInternalLink(linkPath)) {
            parts.push({ type: 'link', text: linkText, path: linkPath, raw });
        } else {
            parts.push({ type: 'text', text: raw });
        }

        lastIndex = matchIndex + raw.length;
    }

    if (lastIndex < body.length) {
        parts.push({ type: 'text', text: body.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', text: body }];
};

export const toAnnouncementPlainText = (body: string): string => (
    parseAnnouncementBody(body)
        .map((part) => part.text)
        .join('')
);
