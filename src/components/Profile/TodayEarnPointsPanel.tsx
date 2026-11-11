import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiChevronRight } from 'react-icons/hi';
import { MdPlayCircleOutline } from 'react-icons/md';
import { RiCopperCoinLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import CheckInModal from '../CheckInModal';
import DailyTasksModal from './DailyTasksModal';
import { useDailyTaskStore } from '../../store/dailyTaskStore';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import styles from './TodayEarnPointsPanel.module.css';

const SIGNIN_ICON = `${import.meta.env.BASE_URL}data/assetsv2/personal/signin.svg`;

const TodayEarnPointsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { updateUser } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isDailyTasksOpen, setIsDailyTasksOpen] = useState(false);
    const refreshDailyTasks = useDailyTaskStore((state) => state.refreshDailyTasks);

    useEffect(() => {
        if (searchParams.get('openDailyTasks') !== '1') {
            return;
        }
        setIsDailyTasksOpen(true);
        void refreshDailyTasks({ silent: true });
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('openDailyTasks');
        setSearchParams(nextParams, { replace: true });
    }, [refreshDailyTasks, searchParams, setSearchParams]);

    const handleOpenDailyTasks = () => {
        setIsDailyTasksOpen(true);
        void refreshDailyTasks({ silent: true });
    };

    const handleWatchAd = () => {
        toast.error(t('profile.adFeatureDeveloping'));
    };

    return (
        <>
            <section className={styles.panel} aria-label={t('create.todayEarnPointsTitle')}>
                <h3 className={styles.title}>{t('create.todayEarnPointsTitle')}</h3>
                <div className={styles.cardsRow}>
                    <button
                        type="button"
                        className={styles.card}
                        onClick={() => setIsCheckInOpen(true)}
                    >
                        <span className={styles.cardIcon} aria-hidden="true">
                            <img src={SIGNIN_ICON} alt="" />
                        </span>
                        <span className={styles.cardBody}>
                            <span className={styles.cardLabel}>{t('create.accountCheckIn')}</span>
                            <span className={styles.cardHint}>{t('create.todayEarnCheckInHint')}</span>
                        </span>
                        <span className={styles.cardChevron} aria-hidden="true">
                            <HiChevronRight />
                        </span>
                    </button>

                    <button
                        type="button"
                        className={styles.card}
                        onClick={handleOpenDailyTasks}
                    >
                        <span className={styles.cardIcon} aria-hidden="true">
                            <RiCopperCoinLine />
                        </span>
                        <span className={styles.cardBody}>
                            <span className={styles.cardLabel}>{t('profile.dailyTasks')}</span>
                            <span className={styles.cardHint}>{t('create.todayEarnDailyTasksHint')}</span>
                        </span>
                        <span className={styles.cardChevron} aria-hidden="true">
                            <HiChevronRight />
                        </span>
                    </button>

                    <button
                        type="button"
                        className={styles.card}
                        onClick={handleWatchAd}
                    >
                        <span className={styles.cardIcon} aria-hidden="true">
                            <MdPlayCircleOutline />
                        </span>
                        <span className={styles.cardBody}>
                            <span className={styles.cardLabel}>{t('profile.watchAd')}</span>
                            <span className={styles.cardHint}>{t('create.todayEarnWatchAdHint')}</span>
                        </span>
                        <span className={styles.cardChevron} aria-hidden="true">
                            <HiChevronRight />
                        </span>
                    </button>
                </div>
            </section>

            <CheckInModal
                isOpen={isCheckInOpen}
                mode="profile"
                onClose={() => setIsCheckInOpen(false)}
                onGoToDailyTasks={() => {
                    setIsCheckInOpen(false);
                    setIsDailyTasksOpen(true);
                    void refreshDailyTasks({ silent: true });
                }}
                onSignInSuccess={() => {
                    void auth.getUserInfo().then((response) => {
                        if (response.data.success && response.data.data) {
                            updateUser(response.data.data);
                        }
                    });
                }}
            />
            <DailyTasksModal
                isOpen={isDailyTasksOpen}
                onClose={() => setIsDailyTasksOpen(false)}
            />
        </>
    );
};

export default TodayEarnPointsPanel;
