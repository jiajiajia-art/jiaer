import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import accountSocialApi from '../../api/account/accountSocialApi';
import type { AccountPrivacy } from '../../api/account/accountSocial.type';
import { getApiErrorMessage } from '../../utils/error';
import styles from './PrivacySettings.module.css';

const DEFAULT_PRIVACY: AccountPrivacy = {
    followingListPublic: true,
    followersListPublic: true,
    listDiscoverable: true,
    peopleSuggestIn: false,
    peopleSuggestOut: true,
};

const PrivacySettings: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    /** 功能注释：未拉到隐私前为 null，避免默认开/关闪一下 */
    const [privacy, setPrivacy] = useState<AccountPrivacy | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<keyof AccountPrivacy | null>(null);

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
                setPrivacy({ ...DEFAULT_PRIVACY, ...response.data.data });
            } catch (error: unknown) {
                if (!cancelled) {
                    toast.error(getApiErrorMessage(error, t('common.error')));
                    setPrivacy(null);
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

    const handleBack = () => {
        navigate('/profile');
    };

    const handleToggle = async (key: keyof AccountPrivacy) => {
        if (!privacy || savingKey) return;
        const prev = privacy;
        const nextValue = !privacy[key];
        setPrivacy({ ...privacy, [key]: nextValue });
        setSavingKey(key);
        try {
            const response = await accountSocialApi.updatePrivacy({ [key]: nextValue });
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            setPrivacy({ ...DEFAULT_PRIVACY, ...response.data.data });
        } catch (error: unknown) {
            setPrivacy(prev);
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setSavingKey(null);
        }
    };

    const listStatusText = (isPublic: boolean) => (
        isPublic ? t('create.accountPrivacyPublic') : t('create.accountPrivacyPrivate')
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
                <h1 className={styles.title}>{t('profile.privacySettings')}</h1>
                <span className={styles.headerSpacer} aria-hidden="true" />
            </header>

            <div className={styles.content} aria-busy={loading}>
                {loading ? (
                    <p className={styles.emptyHint}>{t('common.loading')}</p>
                ) : !privacy ? (
                    <p className={styles.emptyHint}>{t('common.error')}</p>
                ) : (
                    <>
                        <section className={styles.section} aria-labelledby="privacy-relation-title">
                            <h2 id="privacy-relation-title" className={styles.sectionLabel}>
                                {t('profile.privacyRelationSection')}
                            </h2>
                            <div className={styles.group}>
                                <button
                                    type="button"
                                    className={styles.row}
                                    onClick={() => navigate('/account/privacy/find-me')}
                                >
                                    <span className={styles.rowLabel}>{t('profile.privacyFindMe')}</span>
                                    <span className={styles.rowExtra} aria-hidden="true">
                                        <span className={styles.chevron} />
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={styles.row}
                                    disabled={savingKey === 'peopleSuggestIn'}
                                    onClick={() => void handleToggle('peopleSuggestIn')}
                                    aria-pressed={privacy.peopleSuggestIn}
                                >
                                    <span className={styles.rowLabel}>{t('profile.privacyRecommendToMe')}</span>
                                    <span
                                        role="switch"
                                        aria-checked={privacy.peopleSuggestIn}
                                        className={`${styles.switch} ${privacy.peopleSuggestIn ? styles.switchOn : ''}`}
                                    />
                                </button>

                                <button
                                    type="button"
                                    className={styles.row}
                                    disabled={savingKey === 'peopleSuggestOut'}
                                    onClick={() => void handleToggle('peopleSuggestOut')}
                                    aria-pressed={privacy.peopleSuggestOut}
                                >
                                    <span className={styles.rowLabel}>{t('profile.privacyRecommendMe')}</span>
                                    <span
                                        role="switch"
                                        aria-checked={privacy.peopleSuggestOut}
                                        className={`${styles.switch} ${privacy.peopleSuggestOut ? styles.switchOn : ''}`}
                                    />
                                </button>
                            </div>
                        </section>

                        <section className={styles.section} aria-labelledby="privacy-block-title">
                            <h2 id="privacy-block-title" className={styles.sectionLabel}>
                                {t('profile.privacyBlockSection')}
                            </h2>
                            <div className={styles.group}>
                                <button
                                    type="button"
                                    className={styles.row}
                                    onClick={() => navigate('/account/privacy/muted')}
                                >
                                    <span className={styles.rowLabel}>{t('profile.privacyHideThem')}</span>
                                    <span className={styles.rowExtra} aria-hidden="true">
                                        <span className={styles.chevron} />
                                    </span>
                                </button>
                            </div>
                        </section>

                        <section className={styles.section} aria-labelledby="privacy-list-title">
                            <h2 id="privacy-list-title" className={styles.sectionLabel}>
                                {t('create.accountPrivacySection')}
                            </h2>
                            <div className={styles.group}>
                                <button
                                    type="button"
                                    className={styles.row}
                                    disabled={savingKey === 'followingListPublic'}
                                    onClick={() => void handleToggle('followingListPublic')}
                                    aria-pressed={privacy.followingListPublic}
                                >
                                    <span className={styles.rowCopy}>
                                        <span className={styles.rowLabel}>
                                            {t('create.accountFollowingListPublic')}
                                        </span>
                                        <span className={styles.rowStatus}>
                                            {listStatusText(privacy.followingListPublic)}
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
                                    className={styles.row}
                                    disabled={savingKey === 'followersListPublic'}
                                    onClick={() => void handleToggle('followersListPublic')}
                                    aria-pressed={privacy.followersListPublic}
                                >
                                    <span className={styles.rowCopy}>
                                        <span className={styles.rowLabel}>
                                            {t('create.accountFollowersListPublic')}
                                        </span>
                                        <span className={styles.rowStatus}>
                                            {listStatusText(privacy.followersListPublic)}
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
                    </>
                )}
            </div>
        </div>
    );
};

export default PrivacySettings;
