const SHANGHAI_OFFSET_SUFFIX = '+08:00';
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function fromShanghaiDateTimeLocal(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!DATE_TIME_LOCAL_PATTERN.test(trimmed)) return null;

    const timestamp = Date.parse(`${trimmed}:00${SHANGHAI_OFFSET_SUFFIX}`);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function toShanghaiDateTimeLocal(value: string | null | undefined): string {
    if (!value) return '';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '';
    return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 16);
}

export function validateActivityBannerWindow(
    startAt: string | null,
    endAt: string | null,
): string | null {
    const startMs = startAt ? Date.parse(startAt) : null;
    const endMs = endAt ? Date.parse(endAt) : null;

    if ((startAt && !Number.isFinite(startMs)) || (endAt && !Number.isFinite(endMs))) {
        return '活动时间格式无效';
    }
    if (startMs !== null && endMs !== null && startMs >= endMs) {
        return '活动开始时间必须早于结束时间';
    }
    return null;
}
