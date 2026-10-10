import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdOutlineEdit } from 'react-icons/md';
import toast from 'react-hot-toast';
import styles from './AccountHomepage.module.css';
import createStyles from '../Create.module.css';
import CreatorWorksPanel from '../../components/Create/CreatorWorksPanel';
import accountSocialApi from '../../api/account/accountSocialApi';
import type { AccountProfile } from '../../api/account/accountSocial.type';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../../lib/gameCardAuthor';

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

const formatSocialCount = (value: number | null | undefined): string =>
    value == null ? '—' : String(value);

const AccountHomepage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userCode: routeUserCode = '' } = useParams<{ userCode: string }>();
    const { user } = useAuthStore();

    const selfCode = user?.user?.userCode || '';
    const [profile, setProfile] = useState<AccountProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [followBusy, setFollowBusy] = useState(false);
    const [blockBusy, setBlockBusy] = useState(false);

    useEffect(() => {
        if (!routeUserCode.trim()) {
            toast.error(t('create.previewHomepageNoCode'));
            navigate('/profile', { replace: true });
        }
    }, [routeUserCode, navigate, t]);

    useEffect(() => {
        const code = routeUserCode.trim();
        if (!code) return;

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const response = await accountSocialApi.getProfile(code);
                if (cancelled) return;
                if (!response.data.success || !response.data.data) {
                    throw new Error(response.data.message || t('common.error'));
                }
                setProfile(response.data.data);
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
    }, [routeUserCode, navigate, t]);

    const handleClose = () => {
        navigate('/profile');
    };

    const openSocial = (tab: 'following' | 'followers') => {
        if (!profile || profile.isBlockedBy) return;
        const canView = tab === 'following'
            ? profile.canViewFollowingList
            : profile.canViewFollowersList;
        if (!canView) {
            toast.error(
                tab === 'following'
                    ? t('create.socialFollowingPrivate')
                    : t('create.socialFollowersPrivate'),
            );
            return;
        }
        navigate(`/account/${encodeURIComponent(routeUserCode)}/social?tab=${tab}`);
    };

    const handleToggleFollow = async () => {
        if (!profile || profile.isSelf || profile.isBlocked || profile.isBlockedBy || followBusy) {
            return;
        }
        setFollowBusy(true);
        try {
            const response = profile.isFollowing
                ? await accountSocialApi.unfollowOrRemove(profile.userCode, 'unfollow')
                : await accountSocialApi.follow(profile.userCode);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            const data = response.data.data;
            setProfile((prev) => (
                prev
                    ? {
                        ...prev,
                        isFollowing: data.isFollowing,
                        followingCount: data.followingCount,
                        followersCount: data.followersCount,
                    }
                    : prev
            ));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setFollowBusy(false);
        }
    };

    const handleToggleBlock = async () => {
        if (!profile || profile.isSelf || profile.isBlockedBy || blockBusy) return;
        setBlockBusy(true);
        try {
            const response = profile.isBlocked
                ? await accountSocialApi.unblock(profile.userCode)
                : await accountSocialApi.block(profile.userCode);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            const data = response.data.data;
            setProfile((prev) => (
                prev
                    ? {
                        ...prev,
                        isBlocked: data.isBlocked,
                        isFollowing: data.isFollowing,
                        followingCount: data.followingCount,
                        followersCount: data.followersCount,
                    }
                    : prev
            ));
            toast.success(
                data.isBlocked
                    ? t('create.accountBlockedToast')
                    : t('create.accountUnblockedToast'),
            );
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setBlockBusy(false);
        }
    };

    if (!routeUserCode.trim()) {
        return null;
    }

    const isOwner = Boolean(profile?.isSelf ?? (selfCode && selfCode === routeUserCode));
    const isBlockedBy = Boolean(profile?.isBlockedBy);
    const isBlocked = Boolean(profile?.isBlocked);
    const showSocialAndWorks = !isBlockedBy;
    const displayName = profile?.nickname
        || (isOwner ? (user?.user?.nickname || user?.user?.name) : '')
        || t('create.userNameDefault');
    const avatarUrl = getImageUrl(profile?.avatarUrl)
        || (isOwner ? getImageUrl(user?.user?.avatarUrl) : '')
        || DEFAULT_AVATAR;
    const bioText = profile?.bio?.trim()
        ? profile.bio
        : t('create.accountHomepageBioPlaceholder');
    const bannerCss = profile?.bannerUrl
        ? { backgroundImage: `url(${getImageUrl(profile.bannerUrl)})` }
        : undefined;

    return (
        <div className={`${createStyles.pageRoot} ${styles.pageRoot}`}>
            <button
                type="button"
                className={styles.closeBtn}
                onClick={handleClose}
                aria-label={t('common.close')}
            >
                <span className={styles.closeIcon} aria-hidden="true" />
            </button>

            <div className={styles.mainContent}>
                <div
                    className={styles.banner}
                    style={bannerCss}
                    aria-hidden={!isOwner}
                >
                    {isOwner && (
                        <button
                            type="button"
                            className={styles.settingsBtn}
                            onClick={() => navigate('/account/settings')}
                            aria-label={t('create.accountEditHomepage')}
                        >
                            <MdOutlineEdit className={styles.settingsBtnIcon} aria-hidden="true" />
                            <span>{t('create.accountEditHomepage')}</span>
                        </button>
                    )}
                </div>

                <section className={styles.profileCard}>
                    <div className={styles.identityRow}>
                        <img
                            className={styles.avatar}
                            src={avatarUrl}
                            alt={displayName}
                        />
                        <div className={styles.identityInfo}>
                            <h1 className={styles.displayName}>{displayName}</h1>
                            <p className={styles.bio}>{loading ? '…' : bioText}</p>
                            {profile && !profile.isSelf && !isBlockedBy && (
                                <div className={styles.visitorActions}>
                                    {!isBlocked && (
                                        <button
                                            type="button"
                                            className={`${styles.followBtn} ${profile.isFollowing ? styles.followBtnActive : styles.followBtnIdle}`}
                                            disabled={followBusy || blockBusy || loading}
                                            onClick={() => void handleToggleFollow()}
                                        >
                                            {profile.isFollowing
                                                ? t('create.socialFollowingBtn')
                                                : t('create.socialFollowBtn')}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.blockBtn}
                                        disabled={followBusy || blockBusy || loading}
                                        onClick={() => void handleToggleBlock()}
                                    >
                                        {isBlocked
                                            ? t('create.accountUnblockUser')
                                            : t('create.accountBlockUser')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {showSocialAndWorks && (
                    <>
                        <div className={styles.socialStats}>
                            <button
                                type="button"
                                className={styles.socialItem}
                                onClick={() => openSocial('following')}
                            >
                                <span className={styles.socialLabel}>{t('create.followingLabel')}</span>
                                <span className={styles.socialValue}>
                                    {formatSocialCount(profile?.followingCount)}
                                </span>
                            </button>
                            <span className={styles.socialDivider} aria-hidden="true" />
                            <button
                                type="button"
                                className={styles.socialItem}
                                onClick={() => openSocial('followers')}
                            >
                                <span className={styles.socialLabel}>{t('create.followersLabel')}</span>
                                <span className={styles.socialValue}>
                                    {formatSocialCount(profile?.followersCount)}
                                </span>
                            </button>
                        </div>

                        <div className={styles.worksWrap}>
                            <CreatorWorksPanel
                                mode="full"
                                access={isOwner ? 'owner' : 'visitor'}
                                ownerUserCode={routeUserCode.trim()}
                                initialTab="published"
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AccountHomepage;
