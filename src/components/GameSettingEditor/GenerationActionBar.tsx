import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import CurrencyIcon from '../CurrencyIcon';
import styles from './GenerationActionBar.module.css';

interface GenerationActionBarProps {
    children: React.ReactNode;
    /** dock：效果图拼合胶囊——左积分右生成；pill：独立积分胶囊 */
    layout?: 'pill' | 'hero';
}

const GenerationActionBar: React.FC<GenerationActionBarProps> = ({ children, layout = 'pill' }) => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const userId = user?.user?.userId;
    const token = user?.token;
    const pointsValue = Number(user?.user?.points);
    const userPoints = Number.isFinite(pointsValue) ? pointsValue : 0;

    useEffect(() => {
        if (!token) return;

        let isCancelled = false;

        const syncUserPoints = async () => {
            try {
                const response = await auth.getUserInfo();
                const latestUser = response.data?.data;
                if (!isCancelled && latestUser && typeof latestUser.points === 'number') {
                    updateUser({ points: latestUser.points });
                }
            } catch (error) {
                console.error('Failed to sync user points:', error);
            }
        };

        syncUserPoints();

        return () => {
            isCancelled = true;
        };
    }, [token, userId, updateUser]);

    return (
        <div className={`${styles.actionBar} ${layout === 'hero' ? styles.actionBarHero : ''}`}>
            <div
                className={layout === 'hero' ? styles.pointsHero : styles.pointsPill}
                aria-label={`${t('profile.myPoints')} ${userPoints}`}
            >
                {layout === 'hero' ? (
                    <>
                        <span className={styles.pointsValue}>{userPoints}</span>
                        <span className={styles.pointsLabel}>{t('profile.myPoints')}</span>
                    </>
                ) : (
                    <>
                        <CurrencyIcon currency="points" className={styles.pointsIcon} aria-hidden="true" />
                        <span className={styles.pointsLabel}>{t('profile.myPoints')}</span>
                        <span className={styles.pointsValue}>{userPoints}</span>
                    </>
                )}
            </div>
            {children}
        </div>
    );
};

export default GenerationActionBar;
