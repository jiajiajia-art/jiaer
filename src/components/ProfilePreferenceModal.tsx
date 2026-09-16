import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './ProfilePreferenceModal.module.css';
import { auth } from '../api/account/authApi';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import type { UserGender } from '../api/account/auth.type';
import { useAuthStore } from '../store/useAuthStore';
import {
    canSubmitProfilePreference,
    MIN_PROFILE_PREFERENCE_TAGS,
    normalizeGender,
    normalizePreferenceTagIds,
    shouldLoadProfilePreferenceTags,
    togglePreferenceTagId,
} from '../utils/profileCompletion';
import { flattenThemeTags, useLocalizedThemeTags, type FlatThemeTag } from '../utils/themeTags';
import { getApiErrorMessage } from '../utils/error';

type ProfilePreferenceModalProps = {
    isOpen: boolean;
    required?: boolean;
    onClose?: () => void;
    onSaved?: () => void;
};

const ProfilePreferenceModal: React.FC<ProfilePreferenceModalProps> = ({
    isOpen,
    required = false,
    onClose,
    onSaved,
}) => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const currentUser = user?.user;
    const [selectedGender, setSelectedGender] = useState<UserGender | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [themeTags, setThemeTags] = useState<FlatThemeTag[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [hasRequestedTags, setHasRequestedTags] = useState(false);
    const [hasTagLoadFailed, setHasTagLoadFailed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const tagRequestRef = useRef(0);
    const localizedThemeTags = useLocalizedThemeTags(themeTags);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedGender(normalizeGender(currentUser?.gender));
        setSelectedTagIds(normalizePreferenceTagIds(currentUser?.preferredTagIds));
        setError('');
    }, [currentUser?.gender, currentUser?.preferredTagIds, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            tagRequestRef.current += 1;
            setHasRequestedTags(false);
            setHasTagLoadFailed(false);
            setIsLoadingTags(false);
            return;
        }
        if (!shouldLoadProfilePreferenceTags({
            isOpen,
            themeTagCount: themeTags.length,
            isLoadingTags,
            hasRequestedTags,
        })) return;

        const requestId = tagRequestRef.current + 1;
        tagRequestRef.current = requestId;
        setHasRequestedTags(true);
        setHasTagLoadFailed(false);
        setIsLoadingTags(true);
        gameTagsApi.getGameTagsTree()
            .then((response) => {
                if (tagRequestRef.current !== requestId) return;
                const tags = flattenThemeTags(response.data?.data || [])
                    .filter((tag) => Number.isFinite(Number(tag.id)) && Number(tag.id) > 0);
                setThemeTags(tags);
                setHasTagLoadFailed(false);
                setError('');
            })
            .catch((fetchError) => {
                if (tagRequestRef.current !== requestId) return;
                setHasTagLoadFailed(true);
                setError(getApiErrorMessage(fetchError, t('profilePreference.loadTagsFailed')));
            })
            .finally(() => {
                if (tagRequestRef.current === requestId) setIsLoadingTags(false);
            });
    }, [hasRequestedTags, isLoadingTags, isOpen, t, themeTags.length]);

    const canSubmit = useMemo(
        () => canSubmitProfilePreference(selectedGender, selectedTagIds),
        [selectedGender, selectedTagIds],
    );

    const selectedCount = selectedTagIds.length;
    const submitHint = selectedGender
        ? t('profilePreference.tagRequirement', { count: MIN_PROFILE_PREFERENCE_TAGS })
        : t('profilePreference.genderRequirement');

    const closeIfAllowed = () => {
        if (required || isSaving) return;
        onClose?.();
    };

    const handleTagToggle = (tagId: number) => {
        setSelectedTagIds((prev) => togglePreferenceTagId(prev, tagId));
        setError('');
    };

    const handleRetryLoadTags = () => {
        setError('');
        setHasTagLoadFailed(false);
        setHasRequestedTags(false);
    };

    const handleSave = async () => {
        if (!selectedGender || !canSubmit) {
            setError(t('profilePreference.incompleteError', { count: MIN_PROFILE_PREFERENCE_TAGS }));
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const response = await auth.saveProfilePreferences({
                gender: selectedGender,
                tagIds: selectedTagIds,
            });
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            updateUser(response.data.data.user || {
                gender: response.data.data.gender,
                preferredTagIds: response.data.data.preferredTagIds,
                profileCompleted: response.data.data.profileCompleted,
            });
            toast.success(t('profilePreference.saveSuccess'));
            onSaved?.();
            if (!required) onClose?.();
        } catch (saveError) {
            setError(getApiErrorMessage(saveError, t('profilePreference.saveFailed')));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const content = (
        <div className={styles.overlay} onClick={closeIfAllowed}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={t(required ? 'profilePreference.requiredTitle' : 'profilePreference.editTitle')}
                onClick={(event) => event.stopPropagation()}
            >
                {!required ? (
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={closeIfAllowed}
                        disabled={isSaving}
                        aria-label={t('common.close')}
                    >
                        <span aria-hidden="true" />
                    </button>
                ) : null}

                <div className={styles.header}>
                    <span className={styles.eyebrow}>{t('profilePreference.eyebrow')}</span>
                    <h2 className={styles.title}>
                        {t(required ? 'profilePreference.requiredTitle' : 'profilePreference.editTitle')}
                    </h2>
                    <p className={styles.subtitle}>
                        {t(required ? 'profilePreference.requiredSubtitle' : 'profilePreference.editSubtitle')}
                    </p>
                </div>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h3>{t('profilePreference.genderTitle')}</h3>
                        <span>{selectedGender ? t('profilePreference.selected') : t('profilePreference.required')}</span>
                    </div>
                    <div className={styles.genderGrid}>
                        {(['male', 'female'] as UserGender[]).map((gender) => {
                            const active = selectedGender === gender;
                            const genderToneClass = gender === 'male' ? styles.genderCardMale : styles.genderCardFemale;
                            return (
                                <button
                                    key={gender}
                                    type="button"
                                    className={`${styles.genderCard} ${genderToneClass} ${active ? styles.genderCardActive : ''}`}
                                    aria-pressed={active}
                                    onClick={() => {
                                        setSelectedGender(gender);
                                        setError('');
                                    }}
                                >
                                    <span className={styles.genderSymbol}>{gender === 'male' ? '♂' : '♀'}</span>
                                    <span className={styles.genderLabel}>
                                        {t(gender === 'male' ? 'profilePreference.male' : 'profilePreference.female')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h3>{t('profilePreference.themeTitle')}</h3>
                        <span>{t('profilePreference.selectedCount', { count: selectedCount })}</span>
                    </div>
                    <p className={styles.themeHint}>
                        {t('profilePreference.themeHint', { count: MIN_PROFILE_PREFERENCE_TAGS })}
                    </p>
                    <div className={styles.tagPanel}>
                        {isLoadingTags ? (
                            <div className={styles.loading}>{t('profilePreference.loadingTags')}</div>
                        ) : hasTagLoadFailed ? (
                            <div className={styles.loadFailed}>
                                <span>{error || t('profilePreference.loadTagsFailed')}</span>
                                <button
                                    type="button"
                                    className={styles.retryButton}
                                    onClick={handleRetryLoadTags}
                                >
                                    {t('profilePreference.retryLoadTags')}
                                </button>
                            </div>
                        ) : localizedThemeTags.length > 0 ? (
                            localizedThemeTags.map((tag) => {
                                const active = selectedTagIds.includes(Number(tag.id));
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={`${styles.tagChip} ${active ? styles.tagChipActive : ''}`}
                                        aria-pressed={active}
                                        title={tag.pathLabel || tag.name}
                                        onClick={() => handleTagToggle(Number(tag.id))}
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })
                        ) : (
                            <div className={styles.loading}>{t('profilePreference.emptyTags')}</div>
                        )}
                    </div>
                </section>

                {error && !hasTagLoadFailed ? <div className={styles.error}>{error}</div> : null}
                {!canSubmit && !error ? <div className={styles.helper}>{submitHint}</div> : null}

                <button
                    type="button"
                    className={styles.submitButton}
                    onClick={() => void handleSave()}
                    disabled={!canSubmit || isSaving || isLoadingTags}
                >
                    {isSaving ? t('profilePreference.saving') : t('profilePreference.save')}
                </button>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default ProfilePreferenceModal;
