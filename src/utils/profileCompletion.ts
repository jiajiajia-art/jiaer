export type UserProfileGender = 'male' | 'female';

export const MIN_PROFILE_PREFERENCE_TAGS = 2;

export const normalizeGender = (gender?: string | null): UserProfileGender | null => {
    const value = String(gender || '').trim().toLowerCase();
    if (value === 'male') return 'male';
    if (value === 'female') return 'female';
    return null;
};

export const normalizePreferenceTagIds = (tagIds?: unknown): number[] => {
    const raw = Array.isArray(tagIds) ? tagIds : [];
    return Array.from(new Set(
        raw
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item) && item > 0),
    ));
};

export const isUserProfileComplete = (user?: {
    gender?: string | null;
    preferredTagIds?: unknown;
    profileCompleted?: boolean;
} | null): boolean => {
    if (!user) return false;
    if (user.profileCompleted === true) return true;
    const gender = normalizeGender(user.gender);
    const tagIds = normalizePreferenceTagIds(user.preferredTagIds);
    return Boolean(gender && tagIds.length >= MIN_PROFILE_PREFERENCE_TAGS);
};

export const getGenderSymbol = (gender?: string | null): string => {
    const value = normalizeGender(gender);
    if (value === 'male') return '♂';
    if (value === 'female') return '♀';
    return '';
};

export const togglePreferenceTagId = (selectedTagIds: number[], tagId: number): number[] => {
    const id = Number(tagId);
    if (!Number.isFinite(id) || id <= 0) return normalizePreferenceTagIds(selectedTagIds);
    const current = normalizePreferenceTagIds(selectedTagIds);
    if (current.includes(id)) {
        return current.filter((item) => item !== id);
    }
    return [...current, id];
};

export const canSubmitProfilePreference = (
    gender?: string | null,
    tagIds?: unknown,
): boolean => Boolean(normalizeGender(gender) && normalizePreferenceTagIds(tagIds).length >= MIN_PROFILE_PREFERENCE_TAGS);

export const shouldLoadProfilePreferenceTags = ({
    isOpen,
    themeTagCount,
    isLoadingTags,
    hasRequestedTags,
}: {
    isOpen: boolean;
    themeTagCount: number;
    isLoadingTags: boolean;
    hasRequestedTags: boolean;
}): boolean => Boolean(isOpen && themeTagCount <= 0 && !isLoadingTags && !hasRequestedTags);
