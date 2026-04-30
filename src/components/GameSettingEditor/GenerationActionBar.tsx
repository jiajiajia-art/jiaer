import React, { useEffect } from 'react';
import { FaCoins } from 'react-icons/fa';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './GenerationActionBar.module.css';

interface GenerationActionBarProps {
    children: React.ReactNode;
}

const GenerationActionBar: React.FC<GenerationActionBarProps> = ({ children }) => {
    const { user, isAuthenticated, updateUser } = useAuthStore();
    const userId = user?.user?.userId;
    const token = user?.token;
    const userPoints = isAuthenticated ? user?.user?.points ?? 0 : 0;

    useEffect(() => {
        if (!isAuthenticated || !token) return;

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
    }, [isAuthenticated, token, userId, updateUser]);

    return (
        <div className={styles.actionBar}>
            <div className={styles.pointsPill} aria-label={`我的积分 ${userPoints}`}>
                <FaCoins className={styles.pointsIcon} aria-hidden="true" />
                <span className={styles.pointsLabel}>我的积分</span>
                <span className={styles.pointsValue}>{userPoints}</span>
            </div>
            {children}
        </div>
    );
};

export default GenerationActionBar;
