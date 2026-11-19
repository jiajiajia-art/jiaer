import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdPlayCircleOutline } from 'react-icons/md';
import { RiCopperCoinLine } from 'react-icons/ri';
import CheckInModal from '../components/CheckInModal';
import DailyTasksModal from '../components/Profile/DailyTasksModal';
import ExchangeModal from '../components/Purchase/ExchangeModal';
import CenteredPageHeader from '../components/Layout/CenteredPageHeader';
import { auth } from '../api/account/authApi';
import { useAuthStore } from '../store/useAuthStore';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import styles from './EarnPoints.module.css';

const SIGNIN_ICON = `${import.meta.env.BASE_URL}data/assetsv2/personal/signin.svg`;
const EXCHANGE_ICON = `${import.meta.env.BASE_URL}data/assetsv2/personal/mall.svg`;

const EarnPoints: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const refreshDailyTasks = useDailyTaskStore((state) => state.refreshDailyTasks);
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isDailyTasksOpen, setIsDailyTasksOpen] = useState(false);
    const [isExchangeOpen, setIsExchangeOpen] = useState(false);

    const signedInToday = Boolean(user?.user?.hasSignedIn);

    const refreshUser = useCallback(async () => {
        const response = await auth.getUserInfo().catch(() => null);
        if (response?.data.success && response.data.data) {
            updateUser(response.data.data);
        }
    }, [updateUser]);

    useEffect(() => {
        void refreshUser();
    }, [refreshUser]);

    const openCheckIn = () => {
        setIsCheckInOpen(true);
    };

    const openDailyTasks = () => {
        setIsDailyTasksOpen(true);
        void refreshDailyTasks({ silent: true });
    };

    return (
        <div className={styles.pageRoot}>
            <main className={styles.main}>
                <section className={styles.shell}>
                    <CenteredPageHeader
                        title={t('earnPoints.title')}
                        backLabel={t('earnPoints.back')}
                        onBack={() => navigate(-1)}
                    />

                    <section className={styles.balanceCard} aria-label={t('earnPoints.balanceLabel')}>
                        <span>{t('earnPoints.balanceLabel')}</span>
                        <strong>
                            {user?.user?.points ?? 0}
                            <small>{t('earnPoints.pointsUnit')}</small>
                        </strong>
                    </section>

                    <section className={styles.exchangeCard}>
                        <span className={styles.exchangeIcon}><img src={EXCHANGE_ICON} alt="" /></span>
                        <div className={styles.exchangeCopy}>
                            <h2>{t('earnPoints.exchangeTitle')}</h2>
                            <p>{t('earnPoints.exchangeHint')}</p>
                        </div>
                        <button type="button" onClick={() => setIsExchangeOpen(true)}>
                            {t('earnPoints.viewExchange')}
                        </button>
                    </section>

                    <section className={styles.tasksSection}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionHeaderCopy}>
                                <h2>{t('earnPoints.todayTasks')}</h2>
                                <p>{t('earnPoints.todayTasksHint')}</p>
                            </div>
                        </header>

                        {/* 功能注释：页内只保留签到入口，本周签到样式统一在弹窗内展示，避免嵌入月历形成第二套签到窗 */}
                        <button type="button" className={styles.taskRow} onClick={openCheckIn}>
                            <span className={styles.itemIcon}><img src={SIGNIN_ICON} alt="" /></span>
                            <span className={styles.taskCopy}>
                                <strong>{t('earnPoints.checkIn')}</strong>
                                <small>{t('earnPoints.checkInHint')}</small>
                            </span>
                            <span className={signedInToday ? styles.disabledAction : styles.primaryAction}>
                                {signedInToday ? t('checkIn.titleSignedIn') : t('earnPoints.openCheckIn')}
                            </span>
                        </button>

                        <button type="button" className={styles.taskRow} onClick={openDailyTasks}>
                            <span className={styles.itemIcon}><RiCopperCoinLine aria-hidden="true" /></span>
                            <span className={styles.taskCopy}>
                                <strong>{t('earnPoints.dailyTasks')}</strong>
                                <small>{t('earnPoints.dailyTasksHint')}</small>
                            </span>
                            <span className={styles.primaryAction}>{t('earnPoints.goToTasks')}</span>
                        </button>

                        <div className={`${styles.taskRow} ${styles.taskRowDisabled}`} aria-disabled="true">
                            <span className={styles.itemIcon}><MdPlayCircleOutline aria-hidden="true" /></span>
                            <span className={styles.taskCopy}>
                                <strong>{t('earnPoints.watchAd')}</strong>
                                <small>{t('earnPoints.watchAdHint')}</small>
                            </span>
                            <span className={styles.disabledAction}>{t('earnPoints.comingSoon')}</span>
                        </div>
                    </section>
                </section>
            </main>

            <CheckInModal
                isOpen={isCheckInOpen}
                mode="profile"
                onClose={() => {
                    setIsCheckInOpen(false);
                    void refreshUser();
                }}
                onGoToDailyTasks={() => {
                    setIsCheckInOpen(false);
                    openDailyTasks();
                }}
                onSignInSuccess={() => void refreshUser()}
            />
            <DailyTasksModal
                isOpen={isDailyTasksOpen}
                onClose={() => {
                    setIsDailyTasksOpen(false);
                    void refreshUser();
                }}
            />
            <ExchangeModal
                isOpen={isExchangeOpen}
                onClose={() => setIsExchangeOpen(false)}
                onSuccess={() => void refreshUser()}
            />
        </div>
    );
};

export default EarnPoints;
