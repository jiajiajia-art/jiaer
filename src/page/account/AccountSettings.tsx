import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IoCameraOutline } from 'react-icons/io5';
import { MdOutlineEdit } from 'react-icons/md';
import toast from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import type { UserGender } from '../../api/account/auth.type';
import accountSocialApi from '../../api/account/accountSocialApi';
import type { AccountPrivacy } from '../../api/account/accountSocial.type';
import ImageCropModal from '../../components/CommonModal/ImageCropModal';
import { useImageCropper } from '../../hooks/useImageCropper';
import { useProfileIdentityEdit } from '../../hooks/useProfileIdentityEdit';
import { useAuthStore } from '../../store/useAuthStore';
import {
    MIN_PROFILE_PREFERENCE_TAGS,
    normalizeGender,
    normalizePreferenceTagIds,
} from '../../utils/profileCompletion';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../../lib/gameCardAuthor';
import {
    MAX_UPLOAD_IMAGE_SIZE,
    UPLOAD_IMAGE_ACCEPT,
    UPLOAD_IMAGE_MIME_TYPES,
} from '../../utils/uploadImageCrop';
import styles from './AccountSettings.module.css';

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;
const ACCOUNT_BIO_MAX_LENGTH = 120;

const AccountSettings: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const {
        isUploadingAvatar,
        avatarInputRef,
        openAvatarPicker,
        handleAvatarFileChange,
        openEditNickname,
        identityEditModal,
    } = useProfileIdentityEdit();
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const bioInputRef = useRef<HTMLTextAreaElement>(null);

    const selfCode = user?.user?.userCode || '';
    const [bio, setBio] = useState('');
    const [savedBio, setSavedBio] = useState('');
    const [editingBio, setEditingBio] = useState(false);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [privacy, setPrivacy] = useState<AccountPrivacy>({
        followingListPublic: true,
        followersListPublic: true,
        listDiscoverable: true,
        peopleSuggestIn: false,
        peopleSuggestOut: true,
    });
    const [loading, setLoading] = useState(true);
    const [savingBio, setSavingBio] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [savingPrivacyKey, setSavingPrivacyKey] = useState<keyof AccountPrivacy | null>(null);
    const [gender, setGender] = useState<UserGender | null>(null);
    const [savingGender, setSavingGender] = useState(false);

    useEffect(() => {
        if (!selfCode) {
            toast.error(t('create.previewHomepageNoCode'));
            navigate('/profile', { replace: true });
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [profileRes, privacyRes, userInfoRes] = await Promise.all([
                    accountSocialApi.getProfile(selfCode),
                    accountSocialApi.getPrivacy(),
                    auth.getUserInfo(),
                ]);
                if (cancelled) return;
                if (!profileRes.data.success || !profileRes.data.data) {
                    throw new Error(profileRes.data.message || t('common.error'));
                }
                if (!privacyRes.data.success || !privacyRes.data.data) {
                    throw new Error(privacyRes.data.message || t('common.error'));
                }
                if (!userInfoRes.data.success || !userInfoRes.data.data) {
                    throw new Error(userInfoRes.data.message || t('common.error'));
                }
                const nextBio = profileRes.data.data.bio || '';
                setBio(nextBio);
                setSavedBio(nextBio);
                setBannerUrl(profileRes.data.data.bannerUrl);
                setPrivacy(privacyRes.data.data);
                setGender(normalizeGender(userInfoRes.data.data.gender));
                updateUser({
                    gender: userInfoRes.data.data.gender,
                    preferredTagIds: userInfoRes.data.data.preferredTagIds,
                    profileCompleted: userInfoRes.data.data.profileCompleted,
                });
            } catch (error: unknown) {
                if (!cancelled) {
                    toast.error(getApiErrorMessage(error, t('common.error')));
                    navigate('/profile', { replace: true });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [selfCode, navigate, t]);

    useEffect(() => {
        if (!editingBio) return;
        bioInputRef.current?.focus();
        const el = bioInputRef.current;
        if (el) {
            const len = el.value.length;
            el.setSelectionRange(len, len);
        }
    }, [editingBio]);

    const handleBack = () => {
        // 功能注释：replace 掉 settings，避免主页再 -1 回到编辑页形成循环
        if (selfCode) {
            navigate(`/account/${encodeURIComponent(selfCode)}`, { replace: true });
            return;
        }
        navigate('/profile', { replace: true });
    };

    const bioDirty = bio.trim() !== savedBio.trim();
    const bioLen = bio.length;

    const startEditBio = () => {
        setEditingBio(true);
    };

    const cancelEditBio = () => {
        setBio(savedBio);
        setEditingBio(false);
    };

    const handleSaveBio = async () => {
        const next = bio.trim();
        if (next.length > ACCOUNT_BIO_MAX_LENGTH) {
            toast.error(t('create.accountBioTooLong', { max: ACCOUNT_BIO_MAX_LENGTH }));
            return;
        }
        if (!bioDirty || savingBio) {
            setEditingBio(false);
            return;
        }

        setSavingBio(true);
        try {
            const response = await accountSocialApi.updateBio(next);
            if (!response.data.success || response.data.data == null) {
                throw new Error(response.data.message || t('common.error'));
            }
            const committed = response.data.data.bio;
            setBio(committed);
            setSavedBio(committed);
            setEditingBio(false);
            toast.success(t('create.accountBioSaved'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setSavingBio(false);
        }
    };

    const uploadBannerFile = useCallback(async (file: File) => {
        setUploadingBanner(true);
        try {
            const response = await accountSocialApi.uploadBanner(file);
            if (!response.data.success || !response.data.data?.bannerUrl) {
                throw new Error(response.data.message || t('common.error'));
            }
            setBannerUrl(response.data.data.bannerUrl);
            toast.success(t('create.accountBannerUploaded'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setUploadingBanner(false);
        }
    }, [t]);

    const {
        cropPreset: bannerCropPreset,
        pendingCropFile: pendingBannerCrop,
        openCropper: openBannerCropper,
        closeCropper: closeBannerCropper,
        handleCropComplete: handleBannerCropComplete,
    } = useImageCropper({
        preset: 'accountBanner',
        onCropped: async (croppedFile) => {
            await uploadBannerFile(croppedFile);
        },
    });

    const openBannerPicker = () => {
        if (uploadingBanner || pendingBannerCrop) return;
        bannerInputRef.current?.click();
    };

    const handleBannerPick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || uploadingBanner) return;

        if (!UPLOAD_IMAGE_MIME_TYPES.some((mime) => mime === file.type)) {
            toast.error(t('create.accountBannerTypeInvalid'));
            return;
        }
        if (file.size > MAX_UPLOAD_IMAGE_SIZE) {
            toast.error(t('create.accountBannerTooLarge'));
            return;
        }

        void openBannerCropper(file).catch((error) => {
            console.error('open account banner cropper failed:', error);
            toast.error(t('create.accountBannerCropOpenFailed'));
        });
    };

    const handleGenderChange = async (nextGender: UserGender) => {
        if (savingGender || gender === nextGender) return;

        const tagIds = normalizePreferenceTagIds(user?.user?.preferredTagIds);
        if (tagIds.length < MIN_PROFILE_PREFERENCE_TAGS) {
            toast.error(t('create.accountGenderNeedsTags', { count: MIN_PROFILE_PREFERENCE_TAGS }));
            return;
        }

        setSavingGender(true);
        try {
            const response = await auth.saveProfilePreferences({
                gender: nextGender,
                tagIds,
            });
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            const savedGender = normalizeGender(response.data.data.gender) || nextGender;
            setGender(savedGender);
            updateUser(response.data.data.user || {
                gender: savedGender,
                preferredTagIds: response.data.data.preferredTagIds,
                profileCompleted: response.data.data.profileCompleted,
            });
            toast.success(t('create.accountGenderSaved'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setSavingGender(false);
        }
    };

    const handlePrivacyToggle = async (key: keyof AccountPrivacy) => {
        if (savingPrivacyKey) return;
        const prev = privacy;
        const nextValue = !privacy[key];
        setPrivacy({ ...privacy, [key]: nextValue });
        setSavingPrivacyKey(key);
        try {
            const response = await accountSocialApi.updatePrivacy({ [key]: nextValue });
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            setPrivacy(response.data.data);
        } catch (error: unknown) {
            setPrivacy(prev);
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setSavingPrivacyKey(null);
        }
    };

    const bannerPreview = getImageUrl(bannerUrl) || '';
    const avatarPreview = getImageUrl(user?.user?.avatarUrl) || DEFAULT_AVATAR;
    const displayName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
    const bioDisplay = savedBio.trim();

    return (
        <div className={styles.pageRoot}>
            <header className={styles.header}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={handleBack}
                    aria-label={t('common.close')}
                >
                    <span className={styles.backIcon} aria-hidden="true" />
                </button>
                <h1 className={styles.title}>{t('create.accountSettingsTitle')}</h1>
                <span className={styles.headerSpacer} aria-hidden="true" />
            </header>

            {loading ? (
                <div className={styles.content} aria-busy="true" aria-live="polite">
                    <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonBlockShort}`} />
                </div>
            ) : (
                <div className={styles.content}>
                    <section className={styles.profileCard} aria-label={t('create.accountSettingsTitle')}>
                        <input
                            ref={bannerInputRef}
                            type="file"
                            accept={UPLOAD_IMAGE_ACCEPT}
                            className={styles.hiddenInput}
                            onChange={handleBannerPick}
                        />
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className={styles.hiddenInput}
                            onChange={handleAvatarFileChange}
                        />

                        <div
                            className={`${styles.bannerBand} ${bannerPreview ? styles.bannerBandFilled : styles.bannerBandEmpty}`}
                            style={bannerPreview ? { backgroundImage: `url(${bannerPreview})` } : undefined}
                        >
                            <div className={styles.bannerActions}>
                                <button
                                    type="button"
                                    className={styles.uploadCoverBtn}
                                    onClick={openBannerPicker}
                                    disabled={uploadingBanner || Boolean(pendingBannerCrop)}
                                >
                                    <IoCameraOutline aria-hidden="true" />
                                    <span>
                                        {uploadingBanner
                                            ? t('common.loading')
                                            : bannerPreview
                                                ? t('create.accountChangeBanner')
                                                : t('create.accountUploadBanner')}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className={styles.profileBody}>
                            <div className={styles.avatarFrame}>
                                <button
                                    type="button"
                                    className={styles.avatarBtn}
                                    onClick={openAvatarPicker}
                                    disabled={isUploadingAvatar}
                                    aria-label={t('profile.changeAvatar')}
                                >
                                    <img
                                        className={styles.avatar}
                                        src={avatarPreview}
                                        alt={displayName}
                                    />
                                    {isUploadingAvatar && (
                                        <span className={styles.avatarLoading} aria-hidden="true" />
                                    )}
                                </button>
                                <span className={styles.avatarCameraBadge} aria-hidden="true">
                                    <IoCameraOutline />
                                </span>
                            </div>
                            <div className={styles.identity}>
                                <div className={styles.nameRow}>
                                    <h2 className={styles.displayName}>{displayName}</h2>
                                    <button
                                        type="button"
                                        className={styles.editNameBtn}
                                        onClick={openEditNickname}
                                        aria-label={t('profile.editNickname')}
                                    >
                                        <MdOutlineEdit aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.genderSection}>
                            <div className={styles.genderHead}>
                                <span className={styles.genderLabel}>
                                    {t('create.accountGenderSection')}
                                </span>
                                {!gender && (
                                    <span className={styles.genderUnset}>
                                        {t('create.accountGenderUnset')}
                                    </span>
                                )}
                            </div>
                            <div className={styles.genderOptions} role="radiogroup" aria-label={t('create.accountGenderSection')}>
                                {(['male', 'female'] as UserGender[]).map((option) => {
                                    const active = gender === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            className={`${styles.genderOption} ${option === 'male' ? styles.genderOptionMale : styles.genderOptionFemale} ${active ? styles.genderOptionActive : ''}`}
                                            disabled={savingGender}
                                            onClick={() => void handleGenderChange(option)}
                                        >
                                            <span className={styles.genderSymbol} aria-hidden="true">
                                                {option === 'male' ? '♂' : '♀'}
                                            </span>
                                            <span>
                                                {t(option === 'male' ? 'profilePreference.male' : 'profilePreference.female')}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {editingBio ? (
                            <div className={styles.bioEditor}>
                                <textarea
                                    ref={bioInputRef}
                                    className={styles.bioInput}
                                    value={bio}
                                    maxLength={ACCOUNT_BIO_MAX_LENGTH}
                                    rows={3}
                                    placeholder={t('create.accountBioEditPlaceholder')}
                                    onChange={(e) => setBio(e.target.value)}
                                />
                                <div className={styles.bioFooter}>
                                    <span
                                        className={`${styles.charCount} ${bioLen >= ACCOUNT_BIO_MAX_LENGTH ? styles.charCountWarn : ''}`}
                                    >
                                        {bioLen}/{ACCOUNT_BIO_MAX_LENGTH}
                                    </span>
                                    <div className={styles.bioActions}>
                                        <button
                                            type="button"
                                            className={styles.textBtn}
                                            disabled={savingBio}
                                            onClick={cancelEditBio}
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.primaryBtn}
                                            disabled={!bioDirty || savingBio}
                                            onClick={() => void handleSaveBio()}
                                        >
                                            {savingBio
                                                ? t('common.loading')
                                                : t('create.accountSaveBio')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className={styles.bioHit}
                                onClick={startEditBio}
                            >
                                <span
                                    className={bioDisplay ? styles.bioText : styles.bioPlaceholder}
                                >
                                    {bioDisplay || t('create.accountBioClickPlaceholder')}
                                </span>
                                <MdOutlineEdit className={styles.editIcon} aria-hidden="true" />
                            </button>
                        )}
                    </section>

                    <section className={styles.panel} aria-labelledby="account-privacy-title">
                        <div className={styles.sectionHead}>
                            <h2 id="account-privacy-title" className={styles.sectionTitle}>
                                {t('create.accountPrivacySection')}
                            </h2>
                        </div>

                        <div className={styles.toggleGroup}>
                            <button
                                type="button"
                                className={styles.toggleRow}
                                disabled={savingPrivacyKey === 'followingListPublic'}
                                onClick={() => void handlePrivacyToggle('followingListPublic')}
                            >
                                <span className={styles.toggleCopy}>
                                    <span className={styles.toggleLabel}>
                                        {t('create.accountFollowingListPublic')}
                                    </span>
                                    <span className={styles.toggleStatus}>
                                        {privacy.followingListPublic
                                            ? t('create.accountPrivacyPublic')
                                            : t('create.accountPrivacyPrivate')}
                                    </span>
                                </span>
                                <span
                                    role="switch"
                                    aria-checked={privacy.followingListPublic}
                                    className={`${styles.switch} ${privacy.followingListPublic ? styles.switchOn : ''}`}
                                />
                            </button>

                            <button
                                type="button"
                                className={styles.toggleRow}
                                disabled={savingPrivacyKey === 'followersListPublic'}
                                onClick={() => void handlePrivacyToggle('followersListPublic')}
                            >
                                <span className={styles.toggleCopy}>
                                    <span className={styles.toggleLabel}>
                                        {t('create.accountFollowersListPublic')}
                                    </span>
                                    <span className={styles.toggleStatus}>
                                        {privacy.followersListPublic
                                            ? t('create.accountPrivacyPublic')
                                            : t('create.accountPrivacyPrivate')}
                                    </span>
                                </span>
                                <span
                                    role="switch"
                                    aria-checked={privacy.followersListPublic}
                                    className={`${styles.switch} ${privacy.followersListPublic ? styles.switchOn : ''}`}
                                />
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {pendingBannerCrop ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingBannerCrop.imageSrc}
                    title={bannerCropPreset.title}
                    description={bannerCropPreset.description}
                    aspectRatio={bannerCropPreset.aspectRatio}
                    aspectLabel={bannerCropPreset.aspectLabel}
                    defaultCropScale={bannerCropPreset.defaultCropScale}
                    mimeType={pendingBannerCrop.mimeType}
                    onClose={closeBannerCropper}
                    onCropComplete={handleBannerCropComplete}
                />
            ) : null}

            {identityEditModal}
        </div>
    );
};

export default AccountSettings;
