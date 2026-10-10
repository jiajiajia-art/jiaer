import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import accountSocialApi from '../../api/account/accountSocialApi';
import type { FollowListSort, SocialListUser } from '../../api/account/accountSocial.type';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../../lib/gameCardAuthor';
import styles from './AccountSocialList.module.css';

type SocialTab = 'following' | 'followers';

const SOCIAL_PAGE_LIMIT = 10;
const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

const isSocialTab = (value: string | null): value is SocialTab =>
    value === 'following' || value === 'followers';

const isSort = (value: string | null): value is FollowListSort =>
    value === 'recent' || value === 'earliest';

const AccountSocialList: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userCode = '' } = useParams<{ userCode: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuthStore();

    const selfCode = user?.user?.userCode || '';
    const isOwner = Boolean(selfCode && userCode && selfCode === userCode);

    const tabParam = searchParams.get('tab');
    const sortParam = searchParams.get('sort');
    const activeTab: SocialTab = isSocialTab(tabParam) ? tabParam : 'following';
    const activeSort: FollowListSort = isSort(sortParam) ? sortParam : 'recent';

    const [list, setList] = useState<SocialListUser[]>([]);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [privateBlocked, setPrivateBlocked] = useState(false);
    const [busyUserCode, setBusyUserCode] = useState<string | null>(null);

    useEffect(() => {
        if (!userCode.trim()) {
            navigate('/profile', { replace: true });
        }
    }, [userCode, navigate]);

    useEffect(() => {
        const next: Record<string, string> = {};
        if (!isSocialTab(tabParam)) next.tab = 'following';
        else next.tab = tabParam;
        if (!isSort(sortParam)) next.sort = 'recent';
        else next.sort = sortParam;
        if (!isSocialTab(tabParam) || !isSort(sortParam)) {
            setSearchParams(next, { replace: true });
        }
    }, [tabParam, sortParam, setSearchParams]);

    const fetchPage = useCallback(async (cursor?: string | null) => {
        const code = userCode.trim();
        if (!code) return;

        const isMore = Boolean(cursor);
        if (isMore) setLoadingMore(true);
        else {
            setLoading(true);
            setPrivateBlocked(false);
        }

        try {
            const params = {
                limit: SOCIAL_PAGE_LIMIT,
                sort: activeSort,
                ...(cursor ? { cursor } : {}),
            };
            const response = activeTab === 'following'
                ? await accountSocialApi.getFollowing(code, params)
                : await accountSocialApi.getFollowers(code, params);

            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }

            const data = response.data.data;
            setTotal(data.total);
            setNextCursor(data.nextCursor);
            setList((prev) => (isMore ? [...prev, ...data.list] : data.list));
        } catch (error: unknown) {
            const code = getApiErrorCode(error);
            if (code === 'USER_BLOCKED') {
                setPrivateBlocked(false);
                setList([]);
                setTotal(0);
                setNextCursor(null);
            } else if (code === 'FOLLOWING_LIST_PRIVATE' || code === 'FOLLOWERS_LIST_PRIVATE') {
                setPrivateBlocked(true);
                setList([]);
                setTotal(0);
                setNextCursor(null);
                toast.error(
                    code === 'FOLLOWING_LIST_PRIVATE'
                        ? t('create.socialFollowingPrivate')
                        : t('create.socialFollowersPrivate'),
                );
            } else {
                toast.error(getApiErrorMessage(error, t('common.error')));
                if (!isMore) {
                    setList([]);
                    setTotal(0);
                    setNextCursor(null);
                }
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [userCode, activeTab, activeSort, t]);

    useEffect(() => {
        if (!userCode.trim() || !isSocialTab(tabParam) || !isSort(sortParam)) return;
        setList([]);
        setNextCursor(null);
        void fetchPage(null);
    }, [userCode, activeTab, activeSort, tabParam, sortParam, fetchPage]);

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate(userCode ? `/account/${encodeURIComponent(userCode)}` : '/profile');
    };

    const handleTabChange = (tab: SocialTab) => {
        setSearchParams({ tab, sort: activeSort }, { replace: true });
    };

    const handleSortChange = (sort: FollowListSort) => {
        setSearchParams({ tab: activeTab, sort }, { replace: true });
    };

    const handleToggleFollow = async (item: SocialListUser) => {
        if (busyUserCode) return;
        setBusyUserCode(item.userCode);
        try {
            const response = item.isFollowing
                ? await accountSocialApi.unfollowOrRemove(item.userCode, 'unfollow')
                : await accountSocialApi.follow(item.userCode);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            const { isFollowing } = response.data.data;

            if (activeTab === 'following' && isOwner && !isFollowing) {
                setList((prev) => prev.filter((row) => row.userCode !== item.userCode));
                setTotal((n) => Math.max(0, n - 1));
                return;
            }

            setList((prev) =>
                prev.map((row) => (
                    row.userCode === item.userCode ? { ...row, isFollowing } : row
                )),
            );
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setBusyUserCode(null);
        }
    };

    const handleRemoveFollower = async (item: SocialListUser) => {
        if (busyUserCode || !isOwner) return;
        setBusyUserCode(item.userCode);
        try {
            const response = await accountSocialApi.unfollowOrRemove(item.userCode, 'removeFollower');
            if (!response.data.success) {
                throw new Error(response.data.message || t('common.error'));
            }
            setList((prev) => prev.filter((row) => row.userCode !== item.userCode));
            setTotal((n) => Math.max(0, n - 1));
            toast.success(t('create.socialRemovedFollower'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setBusyUserCode(null);
        }
    };

    const openUser = (code: string) => {
        navigate(`/account/${encodeURIComponent(code)}`);
    };

    if (!userCode.trim()) {
        return null;
    }

    const tabLabel = activeTab === 'following'
        ? t('create.followingLabel')
        : t('create.followersLabel');
    const countLabel = activeTab === 'following'
        ? t('create.socialFollowingCount', { count: total })
        : t('create.socialFollowersCount', { count: total });

    const renderNavTab = (tab: SocialTab, label: string) => (
        <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(tab)}
        >
            <span className={styles.tabLabel}>{label}</span>
            {activeTab === tab && !loading ? (
                <span className={styles.tabCount}>{total}</span>
            ) : null}
        </button>
    );

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
                <h1 className={styles.title}>{t('create.socialFriendsTitle')}</h1>
                <span className={styles.headerSpacer} aria-hidden="true" />
            </header>

            <div className={styles.layout}>
                <nav className={styles.nav} role="tablist" aria-label={t('create.socialFriendsTitle')}>
                    {renderNavTab('following', t('create.followingLabel'))}
                    {renderNavTab('followers', t('create.followersLabel'))}
                </nav>

                <div className={styles.main}>
                    <div className={styles.metaRow}>
                        <div className={styles.metaCopy}>
                            <h2 className={styles.panelTitle}>{tabLabel}</h2>
                            <div className={styles.countRow}>{countLabel}</div>
                        </div>
                        <button
                            type="button"
                            className={styles.sortToggle}
                            aria-label={t('create.socialSortLabel')}
                            onClick={() => handleSortChange(activeSort === 'recent' ? 'earliest' : 'recent')}
                        >
                            <span>
                                {activeSort === 'recent'
                                    ? t('create.socialSortRecent')
                                    : t('create.socialSortEarliest')}
                            </span>
                            <img
                                className={styles.sortIcon}
                                src={`${import.meta.env.BASE_URL}data/assetsv2/personal/change.svg`}
                                alt=""
                                aria-hidden="true"
                            />
                        </button>
                    </div>

                    {loading ? (
                        <p className={styles.emptyHint}>{t('common.loading')}</p>
                    ) : privateBlocked ? (
                        <p className={styles.emptyHint}>
                            {activeTab === 'following'
                                ? t('create.socialFollowingPrivate')
                                : t('create.socialFollowersPrivate')}
                        </p>
                    ) : list.length === 0 ? (
                        <p className={styles.emptyHint}>{t('create.socialListEmpty')}</p>
                    ) : (
                        <ul className={styles.list}>
                            {list.map((item) => {
                                const avatar = getImageUrl(item.avatarUrl) || DEFAULT_AVATAR;
                                const isSelfRow = Boolean(selfCode && item.userCode === selfCode);
                                return (
                                    <li key={item.userCode} className={styles.listItem}>
                                        <button
                                            type="button"
                                            className={styles.userHit}
                                            onClick={() => openUser(item.userCode)}
                                        >
                                            <img className={styles.avatar} src={avatar} alt={item.nickname} />
                                            <div className={styles.meta}>
                                                <div className={styles.nickname}>{item.nickname}</div>
                                                <div className={styles.bio}>
                                                    {item.bio?.trim()
                                                        || t('create.accountHomepageBioPlaceholder')}
                                                </div>
                                            </div>
                                        </button>
                                        <div className={styles.actions}>
                                            {isOwner && activeTab === 'followers' && !isSelfRow && (
                                                <button
                                                    type="button"
                                                    className={styles.removeBtn}
                                                    disabled={busyUserCode === item.userCode}
                                                    onClick={() => void handleRemoveFollower(item)}
                                                >
                                                    {t('create.socialRemoveFollower')}
                                                </button>
                                            )}
                                            {!isSelfRow && (
                                                <button
                                                    type="button"
                                                    className={`${styles.followBtn} ${item.isFollowing ? styles.followBtnActive : styles.followBtnIdle}`}
                                                    disabled={busyUserCode === item.userCode}
                                                    onClick={() => void handleToggleFollow(item)}
                                                >
                                                    {item.isFollowing
                                                        ? t('create.socialFollowingBtn')
                                                        : (isOwner && activeTab === 'followers'
                                                            ? t('create.socialFollowBackBtn')
                                                            : t('create.socialFollowBtn'))}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {!loading && !privateBlocked && nextCursor && (
                        <div className={styles.loadMoreWrap}>
                            <button
                                type="button"
                                className={styles.loadMoreBtn}
                                disabled={loadingMore}
                                onClick={() => void fetchPage(nextCursor)}
                            >
                                {loadingMore ? t('common.loading') : t('create.socialLoadMore')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountSocialList;
