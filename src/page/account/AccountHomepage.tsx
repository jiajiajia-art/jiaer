import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdMoreHoriz, MdOutlineEdit } from 'react-icons/md';
import toast from 'react-hot-toast';
import styles from './AccountHomepage.module.css';
import createStyles from '../Create.module.css';
import CreatorWorksPanel from '../../components/Create/CreatorWorksPanel';
import accountSocialApi from '../../api/account/accountSocialApi';
import type { AccountProfile } from '../../api/account/accountSocial.type';
import { auth } from '../../api/account/authApi';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../../lib/gameCardAuthor';
import { isHomeHidden } from '../../lib/userPunishment';
import ReportSheet from '../../components/Report/ReportSheet';
import AuthModal from '../../components/AuthModal';

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

const formatSocialCount = (value: number | null | undefined): string =>
    value == null ? '—' : String(value);

const AccountHomepage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { userCode: routeUserCode = '' } = useParams<{ userCode: string }>();
    const { user, isAuthenticated, updateUser } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();

    const selfCode = user?.user?.userCode || '';
    const [profile, setProfile] = useState<AccountProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [followBusy, setFollowBusy] = useState(false);
    const [blockBusy, setBlockBusy] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const moreWrapRef = useRef<HTMLDivElement | null>(null);
    const ownerHomeHidden = isHomeHidden(user?.user?.homeHidden);

    useEffect(() => {
        if (!moreOpen) return;
        const onDoc = (event: MouseEvent) => {
            if (!moreWrapRef.current?.contains(event.target as Node)) {
                setMoreOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [moreOpen]);

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
                const next = response.data.data;
                // 功能注释：homeHidden 访客空态；勿当 404
                setProfile(next);
            } catch (error: unknown) {
                if (cancelled) return;
                const axiosData = (error as {
                    response?: {
                        data?: {
                            data?: Partial<AccountProfile>;
                            message?: string;
                        };
                    };
                })?.response?.data;
                const flagged = axiosData?.data;
                // 功能注释：主页隐藏勿当 404，展示空态
                if (flagged?.homeHidden === true) {
                    setProfile({
                        userCode: code,
                        nickname: flagged.nickname || '',
                        avatarUrl: flagged.avatarUrl ?? null,
                        bio: flagged.bio || '',
                        bannerUrl: flagged.bannerUrl ?? null,
                        followingCount: null,
                        followersCount: null,
                        isFollowing: false,
                        isSelf: Boolean(selfCode && selfCode === code),
                        isBlocked: false,
                        isBlockedBy: false,
                        followingListPublic: false,
                        followersListPublic: false,
                        canViewFollowingList: false,
                        canViewFollowersList: false,
                        homeHidden: true,
                    });
                    return;
                }
                toast.error(getApiErrorMessage(error, t('common.error')));
                navigate('/profile', { replace: true });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [routeUserCode, navigate, t, selfCode]);

    useEffect(() => {
        const code = routeUserCode.trim();
        if (!code || !selfCode || selfCode !== code) return;
        void auth.getUserInfo().then((response) => {
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        }).catch(() => {
            /* 忽略 */
        });
    }, [routeUserCode, selfCode, updateUser]);

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

    /** 功能注释：管理端带回管理；本人主页固定回个人中心；访客回上一页 */
    const handleClose = () => {
        const from = (location.state as { from?: unknown } | null)?.from;
        if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
            navigate(from);
            return;
        }
        if (isOwner) {
            navigate('/profile');
            return;
        }
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/profile');
    };

    const isBlockedBy = Boolean(profile?.isBlockedBy);
    const isBlocked = Boolean(profile?.isBlocked);
    const homepageHiddenForVisitor = isHomeHidden(profile?.homeHidden) && !isOwner;
    const showSocialAndWorks = !isBlockedBy && !homepageHiddenForVisitor;
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
                {isOwner && ownerHomeHidden ? (
                    <div className={styles.homeHiddenBanner} role="status">
                        {t('report.homeHiddenBanner')}
                    </div>
                ) : null}
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
                    {!isOwner && profile && !isBlockedBy && (
                        <div className={styles.moreWrap} ref={moreWrapRef}>
                            <button
                                type="button"
                                className={styles.moreBtn}
                                aria-label={t('report.moreActions')}
                                aria-expanded={moreOpen}
                                onClick={() => setMoreOpen((v) => !v)}
                            >
                                <MdMoreHoriz size={22} aria-hidden="true" />
                            </button>
                            {moreOpen ? (
                                <div className={styles.moreMenu} role="menu">
                                    <button
                                        type="button"
                                        className={styles.moreMenuItem}
                                        role="menuitem"
                                        onClick={() => {
                                            setMoreOpen(false);
                                            if (!isAuthenticated) {
                                                setIsAuthModalOpen(true);
                                                return;
                                            }
                                            setReportOpen(true);
                                        }}
                                    >
                                        <img
                                            className={styles.moreMenuIcon}
                                            src={`${import.meta.env.BASE_URL}data/assetsv2/common/report.svg`}
                                            alt=""
                                        />
                                        {t('report.reportAction')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
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

                {homepageHiddenForVisitor ? (
                    <div className={styles.unavailableState} role="status">
                        <p className={styles.unavailableReason}>
                            {t('report.homepageUnavailableDefault')}
                        </p>
                    </div>
                ) : null}

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

            {reportOpen && routeUserCode.trim() ? (
                <ReportSheet
                    isOpen={reportOpen}
                    onClose={() => setReportOpen(false)}
                    targetType="user"
                    targetId={routeUserCode.trim()}
                />
            ) : null}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </div>
    );
};

export default AccountHomepage;
