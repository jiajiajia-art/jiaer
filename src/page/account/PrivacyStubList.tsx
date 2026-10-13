import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import accountSocialApi from '../../api/account/accountSocialApi';
import type { AccountPrivacy, BlockedListUser } from '../../api/account/accountSocial.type';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../../lib/gameCardAuthor';
import styles from './PrivacySettings.module.css';

const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;
const BLOCKED_PAGE_LIMIT = 10;

const DEFAULT_PRIVACY: AccountPrivacy = {
    followingListPublic: true,
    followersListPublic: true,
    listDiscoverable: true,
    peopleSuggestIn: false,
    peopleSuggestOut: true,
};

/** 功能注释：找到我的方式——listDiscoverable 接真接口 */
export const PrivacyFindMe: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    /** 功能注释：未拉到前为 null，避免默认开闪一下 */
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const response = await accountSocialApi.getPrivacy();
                if (cancelled) return;
                if (!response.data.success || !response.data.data) {
                    throw new Error(response.data.message || t('common.error'));
                }
                setEnabled(Boolean(response.data.data.listDiscoverable));
            } catch (error: unknown) {
                if (!cancelled) {
                    toast.error(getApiErrorMessage(error, t('common.error')));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const handleToggle = async () => {
        if (enabled == null || loading || saving) return;
        const prev = enabled;
        const nextValue = !enabled;
        setEnabled(nextValue);
        setSaving(true);
        try {
            const response = await accountSocialApi.updatePrivacy({ listDiscoverable: nextValue });
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            setEnabled(Boolean(response.data.data.listDiscoverable ?? DEFAULT_PRIVACY.listDiscoverable));
        } catch (error: unknown) {
            setEnabled(prev);
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <header className={styles.header}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => navigate('/account/privacy')}
                    aria-label={t('common.close')}
                >
                    <span className={styles.backIcon} aria-hidden="true" />
                </button>
                <h1 className={styles.title}>{t('profile.privacyFindMe')}</h1>
                <span className={styles.headerSpacer} aria-hidden="true" />
            </header>

            <div className={styles.content} aria-busy={loading}>
                {loading ? (
                    <p className={styles.emptyHint}>{t('common.loading')}</p>
                ) : enabled == null ? (
                    <p className={styles.emptyHint}>{t('common.error')}</p>
                ) : (
                    <div className={styles.group}>
                        <button
                            type="button"
                            className={styles.row}
                            disabled={saving}
                            onClick={() => void handleToggle()}
                            aria-pressed={enabled}
                        >
                            <span className={styles.rowLabel}>
                                {t('profile.privacyFindMeViaSocialLists')}
                            </span>
                            <span
                                role="switch"
                                aria-checked={enabled}
                                className={`${styles.switch} ${enabled ? styles.switchOn : ''}`}
                            />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/** 功能注释：不看他(她)——屏蔽名单分页 + 取消屏蔽 */
export const PrivacyMuted: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [list, setList] = useState<BlockedListUser[]>([]);
    const [total, setTotal] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [busyUserCode, setBusyUserCode] = useState<string | null>(null);

    const fetchPage = useCallback(async (cursor?: string | null) => {
        const isMore = Boolean(cursor);
        if (isMore) setLoadingMore(true);
        else setLoading(true);
        try {
            const response = await accountSocialApi.getBlocked({
                limit: BLOCKED_PAGE_LIMIT,
                ...(cursor ? { cursor } : {}),
            });
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            const data = response.data.data;
            setTotal(data.total);
            setNextCursor(data.nextCursor);
            setList((prev) => (isMore ? [...prev, ...data.list] : data.list));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [t]);

    useEffect(() => {
        void fetchPage();
    }, [fetchPage]);

    const handleUnblock = async (item: BlockedListUser) => {
        if (busyUserCode) return;
        setBusyUserCode(item.userCode);
        try {
            const response = await accountSocialApi.unblock(item.userCode);
            if (!response.data.success) {
                throw new Error(response.data.message || t('common.error'));
            }
            setList((prev) => prev.filter((row) => row.userCode !== item.userCode));
            setTotal((prev) => Math.max(0, prev - 1));
            toast.success(t('create.accountUnblockedToast'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setBusyUserCode(null);
        }
    };

    const openHomepage = (userCode: string) => {
        navigate(`/account/${encodeURIComponent(userCode)}`);
    };

    return (
        <div className={styles.pageRoot}>
            <header className={styles.header}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => navigate('/account/privacy')}
                    aria-label={t('common.close')}
                >
                    <span className={styles.backIcon} aria-hidden="true" />
                </button>
                <h1 className={styles.title}>{t('profile.privacyHideThem')}</h1>
                <span className={styles.headerSpacer} aria-hidden="true" />
            </header>

            <div className={styles.content} aria-busy={loading}>
                {loading ? (
                    <p className={styles.emptyHint}>{t('common.loading')}</p>
                ) : list.length === 0 ? (
                    <div className={styles.group}>
                        <p className={styles.emptyHint}>{t('profile.privacyHideThemEmpty')}</p>
                    </div>
                ) : (
                    <>
                        {total > 0 ? (
                            <p className={styles.listMeta}>
                                {t('profile.privacyBlockedCount', { count: total })}
                            </p>
                        ) : null}
                        <div className={styles.group}>
                            {list.map((item) => {
                                const avatar = getImageUrl(item.avatarUrl) || DEFAULT_AVATAR;
                                const busy = busyUserCode === item.userCode;
                                return (
                                    <div key={item.userCode} className={styles.userRow}>
                                        <button
                                            type="button"
                                            className={styles.userHit}
                                            onClick={() => openHomepage(item.userCode)}
                                        >
                                            <img
                                                className={styles.userAvatar}
                                                src={avatar}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            <span className={styles.userCopy}>
                                                <span className={styles.userName}>
                                                    {item.nickname || item.userCode}
                                                </span>
                                                {item.bio ? (
                                                    <span className={styles.userBio}>{item.bio}</span>
                                                ) : null}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.unblockBtn}
                                            disabled={busy}
                                            onClick={() => void handleUnblock(item)}
                                        >
                                            {t('create.accountUnblockUser')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {nextCursor ? (
                            <div className={styles.loadMoreWrap}>
                                <button
                                    type="button"
                                    className={styles.loadMoreBtn}
                                    disabled={loadingMore}
                                    onClick={() => void fetchPage(nextCursor)}
                                >
                                    {loadingMore ? t('common.loading') : t('profile.privacyLoadMore')}
                                </button>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};
