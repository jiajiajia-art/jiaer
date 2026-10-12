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

type SocialTab = 'following' | 'followers' | 'mutual';

const SOCIAL_PAGE_LIMIT = 10;
const DESKTOP_MEDIA = '(min-width: 768px)';
const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

const readIsDesktop = (): boolean => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(DESKTOP_MEDIA).matches
        : false
);

const isSocialTab = (value: string | null): value is SocialTab =>
    value === 'following' || value === 'followers' || value === 'mutual';

const isSort = (value: string | null): value is FollowListSort =>
    value === 'recent' || value === 'earliest';

/** 功能注释：关注按钮文案按 isFollowing + isFollowedBy（v1.2） */
const resolveFollowButtonLabel = (
    item: SocialListUser,
    t: (key: string) => string,
): string => {
    const isFollowedBy = Boolean(item.isFollowedBy);
    if (item.isFollowing && isFollowedBy) return t('create.socialMutualBtn');
    if (item.isFollowing) return t('create.socialFollowingBtn');
    if (isFollowedBy) return t('create.socialFollowBackBtn');
    return t('create.socialFollowBtn');
};

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
    /** 功能注释：本人粉丝 Tab 点 ⋮ 后待移除的用户 */
    const [removeTarget, setRemoveTarget] = useState<SocialListUser | null>(null);
    /** 功能注释：PC 用按钮旁下拉；手机用底部面板 */
    const [isDesktop, setIsDesktop] = useState(readIsDesktop);

    useEffect(() => {
        if (!userCode.trim()) {
            navigate('/profile', { replace: true });
        }
    }, [userCode, navigate]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia(DESKTOP_MEDIA);
        const onChange = () => setIsDesktop(mediaQuery.matches);
        onChange();
        mediaQuery.addEventListener('change', onChange);
        return () => mediaQuery.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        if (!removeTarget || !isDesktop) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest(`.${styles.moreWrap}`)) return;
            setRemoveTarget(null);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setRemoveTarget(null);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [removeTarget, isDesktop]);

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
                : activeTab === 'followers'
                    ? await accountSocialApi.getFollowers(code, params)
                    : await accountSocialApi.getMutual(code, params);

            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }

            const data = response.data.data;
            setTotal(data.total);
            setNextCursor(data.nextCursor);
            setList((prev) => (isMore ? [...prev, ...data.list] : data.list));
        } catch (error: unknown) {
            const errCode = getApiErrorCode(error);
            if (errCode === 'USER_BLOCKED') {
                setPrivateBlocked(false);
                setList([]);
                setTotal(0);
                setNextCursor(null);
            } else if (errCode === 'FOLLOWING_LIST_PRIVATE' || errCode === 'FOLLOWERS_LIST_PRIVATE') {
                setPrivateBlocked(true);
                setList([]);
                setTotal(0);
                setNextCursor(null);
                toast.error(
                    errCode === 'FOLLOWERS_LIST_PRIVATE'
                        ? t('create.socialFollowersPrivate')
                        : t('create.socialFollowingPrivate'),
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
        setRemoveTarget(null);
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

            // 功能注释：本人关注/互关列表取关后该项不再属于该 Tab，直接移除
            if (
                isOwner
                && !isFollowing
                && (activeTab === 'following' || activeTab === 'mutual')
            ) {
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

    const closeRemoveMenu = () => {
        if (busyUserCode) return;
        setRemoveTarget(null);
    };

    const openRemoveMenu = (item: SocialListUser) => {
        setRemoveTarget((prev) => (
            prev?.userCode === item.userCode ? null : item
        ));
    };

    const handleRemoveFollower = async () => {
        const item = removeTarget;
        if (!item || busyUserCode || !isOwner) return;
        setBusyUserCode(item.userCode);
        try {
            const response = await accountSocialApi.unfollowOrRemove(item.userCode, 'removeFollower');
            if (!response.data.success) {
                throw new Error(response.data.message || t('common.error'));
            }
            setList((prev) => prev.filter((row) => row.userCode !== item.userCode));
            setTotal((n) => Math.max(0, n - 1));
            setRemoveTarget(null);
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
        : activeTab === 'followers'
            ? t('create.followersLabel')
            : t('create.mutualLabel');
    const countLabel = activeTab === 'following'
        ? t('create.socialFollowingCount', { count: total })
        : activeTab === 'followers'
            ? t('create.socialFollowersCount', { count: total })
            : t('create.socialMutualCount', { count: total });
    const privateHint = activeTab === 'followers'
        ? t('create.socialFollowersPrivate')
        : t('create.socialFollowingPrivate');

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
                    {renderNavTab('mutual', t('create.mutualLabel'))}
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
                        <p className={styles.emptyHint}>{privateHint}</p>
                    ) : list.length === 0 ? (
                        <p className={styles.emptyHint}>{t('create.socialListEmpty')}</p>
                    ) : (
                        <ul className={styles.list}>
                            {list.map((item) => {
                                const avatar = getImageUrl(item.avatarUrl) || DEFAULT_AVATAR;
                                const isSelfRow = Boolean(selfCode && item.userCode === selfCode);
                                const followLabel = resolveFollowButtonLabel(item, t);
                                return (
                                    <li key={item.userCode} className={styles.listItem}>
                                        <button
                                            type="button"
                                            className={styles.avatarHit}
                                            onClick={() => openUser(item.userCode)}
                                            aria-label={item.nickname}
                                        >
                                            <img className={styles.avatar} src={avatar} alt="" />
                                        </button>
                                        <div className={styles.body}>
                                            <button
                                                type="button"
                                                className={styles.metaHit}
                                                onClick={() => openUser(item.userCode)}
                                            >
                                                <div className={styles.nickname}>{item.nickname}</div>
                                                <div className={styles.bio}>
                                                    {item.bio?.trim()
                                                        || t('create.accountHomepageBioPlaceholder')}
                                                </div>
                                            </button>
                                            <div className={styles.actions}>
                                                {!isSelfRow && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.followBtn} ${item.isFollowing ? styles.followBtnActive : styles.followBtnIdle}`}
                                                        disabled={busyUserCode === item.userCode}
                                                        onClick={() => void handleToggleFollow(item)}
                                                    >
                                                        {followLabel}
                                                    </button>
                                                )}
                                                {isOwner && activeTab === 'followers' && !isSelfRow && (
                                                    <div className={styles.moreWrap}>
                                                        <button
                                                            type="button"
                                                            className={styles.moreBtn}
                                                            disabled={busyUserCode === item.userCode}
                                                            aria-label={t('create.socialMoreActions')}
                                                            aria-expanded={removeTarget?.userCode === item.userCode}
                                                            aria-haspopup="menu"
                                                            onClick={() => openRemoveMenu(item)}
                                                        >
                                                            <img
                                                                className={styles.moreIcon}
                                                                src={`${import.meta.env.BASE_URL}data/assetsv2/personal/more.svg`}
                                                                alt=""
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                        {isDesktop && removeTarget?.userCode === item.userCode ? (
                                                            <div
                                                                className={styles.moreMenu}
                                                                role="menu"
                                                                aria-label={t('create.socialMoreActions')}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    role="menuitem"
                                                                    className={styles.moreMenuItem}
                                                                    disabled={busyUserCode === item.userCode}
                                                                    onClick={() => void handleRemoveFollower()}
                                                                >
                                                                    {t('create.socialRemoveFollower')}
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
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

            {!isDesktop && removeTarget ? (
                <div className={styles.sheetRoot} role="presentation">
                    <button
                        type="button"
                        className={styles.sheetBackdrop}
                        aria-label={t('common.cancel')}
                        onClick={closeRemoveMenu}
                    />
                    <div
                        className={styles.sheetPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('create.socialMoreActions')}
                    >
                        <button
                            type="button"
                            className={styles.sheetAction}
                            disabled={busyUserCode === removeTarget.userCode}
                            onClick={() => void handleRemoveFollower()}
                        >
                            <img
                                className={styles.sheetActionIcon}
                                src={`${import.meta.env.BASE_URL}data/assetsv2/personal/delete.svg`}
                                alt=""
                                aria-hidden="true"
                            />
                            <span>{t('create.socialRemoveFollower')}</span>
                        </button>
                        <button
                            type="button"
                            className={styles.sheetCancel}
                            disabled={Boolean(busyUserCode)}
                            onClick={closeRemoveMenu}
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default AccountSocialList;
