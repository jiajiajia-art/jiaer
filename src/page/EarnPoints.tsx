import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdPlayCircleOutline } from 'react-icons/md';
import { RiCopperCoinLine } from 'react-icons/ri';
import CheckInModal from '../components/CheckInModal';
import DailyTasksModal from '../components/Profile/DailyTasksModal';
import ExchangeModal from '../components/Purchase/ExchangeModal';
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
    const [isDailyTasksOpen, setIsDailyTasksOpen] = useState(false);
    const [isExchangeOpen, setIsExchangeOpen] = useState(false);
    const [checkInActionContainer, setCheckInActionContainer] = useState<HTMLDivElement | null>(null);

    const refreshUser = useCallback(async () => {
        const response = await auth.getUserInfo().catch(() => null);
        if (response?.data.success && response.data.data) {
            updateUser(response.data.data);
        }
    }, [updateUser]);

    useEffect(() => {
        void refreshUser();
    }, [refreshUser]);

    const openDailyTasks = () => {
        setIsDailyTasksOpen(true);
        void refreshDailyTasks({ silent: true });
    };

    return (
        <div className={styles.pageRoot}>
            <main className={styles.main}>
                <section className={styles.shell}>
                    <header className={styles.pageHeader}>
                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={() => navigate(-1)}
                            aria-label={t('earnPoints.back')}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M14.5 5.5L8 12l6.5 6.5" />
                            </svg>
                            <span>{t('earnPoints.back')}</span>
                        </button>
                        <h1>{t('earnPoints.title')}</h1>
                        <div className={styles.headerSpacer} aria-hidden="true" />
                    </header>

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
                            <div
                                ref={setCheckInActionContainer}
                                className={styles.checkInActionSlot}
                                aria-live="polite"
                            />
                        </header>

                        <article className={styles.checkInCard}>
                            <div className={styles.checkInIntro}>
                                <span className={styles.itemIcon}><img src={SIGNIN_ICON} alt="" /></span>
                                <div>
                                    <h3>{t('earnPoints.checkIn')}</h3>
                                    <p>{t('earnPoints.checkInHint')}</p>
                                </div>
                            </div>
                            <CheckInModal
                                isOpen
                                mode="profile"
                                presentation="embedded"
                                onClose={() => undefined}
                                onGoToDailyTasks={openDailyTasks}
                                onSignInSuccess={() => void refreshUser()}
                                embeddedActionContainer={checkInActionContainer}
                            />
                        </article>

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
