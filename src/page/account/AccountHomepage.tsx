import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './AccountHomepage.module.css';
import createStyles from '../Create.module.css';
import CreatorWorksPanel from '../../components/Create/CreatorWorksPanel';
import { useAuthStore } from '../../store/useAuthStore';
import { getImageUrl } from '../../utils/constants';
import {
    PLACEHOLDER_FOLLOWERS_COUNT,
    PLACEHOLDER_FOLLOWING_COUNT,
} from '../../constants/accountSocial';

const AccountHomepage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { userCode: routeUserCode = '' } = useParams<{ userCode: string }>();
    const { user } = useAuthStore();

    const selfCode = user?.user?.userCode || '';
    const isOwner = Boolean(selfCode && routeUserCode && selfCode === routeUserCode);

    const displayName = isOwner
        ? (user?.user?.nickname || user?.user?.name || t('create.userNameDefault'))
        : (routeUserCode || t('create.userNameDefault'));
    const avatarUrl = isOwner
        ? (getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`)
        : `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;

    const handleClose = () => {
        navigate('/profile');
    };

    React.useEffect(() => {
        if (!routeUserCode.trim()) {
            toast.error(t('create.previewHomepageNoCode'));
            navigate('/profile', { replace: true });
        }
    }, [routeUserCode, navigate, t]);

    if (!routeUserCode.trim()) {
        return null;
    }

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
                <div className={styles.banner} aria-hidden="true" />

                <section className={styles.profileCard}>
                    <div className={styles.identityRow}>
                        <img
                            className={styles.avatar}
                            src={avatarUrl}
                            alt={displayName}
                        />
                        <div className={styles.identityInfo}>
                            <h1 className={styles.displayName}>{displayName}</h1>
                            <p className={styles.bio}>{t('create.accountHomepageBioPlaceholder')}</p>
                        </div>
                    </div>
                </section>

                <div className={styles.socialStats}>
                    <button
                        type="button"
                        className={styles.socialItem}
                        onClick={() => navigate(`/account/${encodeURIComponent(routeUserCode)}/social?tab=following`)}
                    >
                        <span className={styles.socialLabel}>{t('create.followingLabel')}</span>
                        <span className={styles.socialValue}>{PLACEHOLDER_FOLLOWING_COUNT}</span>
                    </button>
                    <span className={styles.socialDivider} aria-hidden="true" />
                    <button
                        type="button"
                        className={styles.socialItem}
                        onClick={() => navigate(`/account/${encodeURIComponent(routeUserCode)}/social?tab=followers`)}
                    >
                        <span className={styles.socialLabel}>{t('create.followersLabel')}</span>
                        <span className={styles.socialValue}>{PLACEHOLDER_FOLLOWERS_COUNT}</span>
                    </button>
                </div>

                <div className={styles.worksWrap}>
                    <CreatorWorksPanel
                        mode="full"
                        access={isOwner ? 'owner' : 'visitor'}
                        initialTab="published"
                    />
                </div>
            </div>
        </div>
    );
};

export default AccountHomepage;
