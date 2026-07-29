import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { auth } from '../api/account/authApi';
import type { GetPointsActivitiesParams, PointsActivityDirection, PointsActivityItem, PointsActivityCurrency } from '../api/account/auth.type';
import { useTranslation } from 'react-i18next';
import styles from './AssetDetails.module.css';

type CurrencyTab = 'all' | 'points' | 'diamonds';

const tabs: Array<{ key: CurrencyTab; label: string }> = [
    { key: 'all', label: 'tabAll' },
    { key: 'points', label: 'tabPoints' },
    { key: 'diamonds', label: 'tabDiamonds' },
];

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

function formatActivityTime(value: string) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return value;
    }

    const sqliteUtcMatch = normalizedValue.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    const date = sqliteUtcMatch
        ? new Date(`${sqliteUtcMatch[1]}-${sqliteUtcMatch[2]}-${sqliteUtcMatch[3]}T${sqliteUtcMatch[4]}:${sqliteUtcMatch[5]}:${sqliteUtcMatch[6] || '00'}Z`)
        : new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}`;
}

const CURRENCY_TYPE_LABEL: Record<PointsActivityItem['currency'], string> = {
    points: 'points',
    diamonds: 'diamonds',
};

const AssetDetails: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const now = useMemo(() => new Date(), []);
    const defaultYear = now.getFullYear();
    const defaultMonth = now.getMonth() + 1;
    const [currencyTab, setCurrencyTab] = useState<CurrencyTab>('all');
    const [direction, setDirection] = useState<PointsActivityDirection>('all');
    const [directionOpen, setDirectionOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | null>(defaultYear);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(defaultMonth);
    const [draftYear, setDraftYear] = useState<number | null>(defaultYear);
    const [draftMonth, setDraftMonth] = useState<number | null>(defaultMonth);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [points, setPoints] = useState(0);
    const [diamonds, setDiamonds] = useState(0);
    const [items, setItems] = useState<PointsActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const yearOptions = useMemo(() => {
        const years = new Set<number>([defaultYear]);
        for (let offset = 0; offset < 4; offset += 1) {
            years.add(defaultYear - offset);
        }
        return Array.from(years).sort((left, right) => right - left);
    }, [defaultYear]);

    const buildCurrencyParam = (currencyTab: CurrencyTab): PointsActivityCurrency => {
        if (currencyTab === 'all') {
            return 'all';
        }
        return currencyTab;
    };

    const loadActivities = async (nextPage = 1, append = false) => {
        setIsLoading(true);
        try {
            const params: GetPointsActivitiesParams = {
                currency: buildCurrencyParam(currencyTab),
                direction,
                page: nextPage,
                pageSize: 20,
            };

            if (selectedYear !== null && selectedMonth !== null) {
                params.year = selectedYear;
                params.month = selectedMonth;
            }

            const response = await auth.getPointsActivities(params);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || 'Failed to load asset activities.');
            }

            const payload = response.data.data;
            setPoints(payload.points ?? 0);
            setDiamonds(payload.diamonds ?? 0);
            setItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
            setTotalPages(1);
            setPage(nextPage);
        } catch (error: unknown) {
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    : error instanceof Error
                        ? error.message
                        : 'Failed to load asset activities.';
            toast.error(message || 'Failed to load asset activities.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadActivities(1, false);
        setItems([]);
        setPage(1);
        setTotalPages(1);
    }, [currencyTab, direction, selectedYear, selectedMonth]);

    useEffect(() => {
        if (!isFilterOpen) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFilterOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFilterOpen]);

    useEffect(() => {
        if (!directionOpen) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setDirectionOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [directionOpen]);

    useEffect(() => {
        if (!isFilterOpen) {
            setDraftYear(selectedYear);
            setDraftMonth(selectedMonth);
        }
    }, [isFilterOpen, selectedMonth, selectedYear]);

    const hasMore = page < totalPages;
    const filterLabel = selectedYear !== null && selectedMonth !== null
        ? `${selectedYear}.${String(selectedMonth).padStart(2, '0')}`
        : t('assetDetails.allTime');

    const openFilter = () => {
        setDraftYear(selectedYear);
        setDraftMonth(selectedMonth);
        setIsFilterOpen(true);
    };

    const confirmFilter = () => {
        setSelectedYear(draftYear);
        setSelectedMonth(draftMonth);
        setIsFilterOpen(false);
    };

    const directionLabel = direction === 'all'
        ? t('assetDetails.directionAll')
        : direction === 'income'
            ? t('assetDetails.directionIncome')
            : t('assetDetails.directionExpense');

    return (
        <div className={styles.pageRoot}>
            <main className={styles.main}>
                <section className={styles.shell}>
                    <header className={styles.header}>
                        <button
                            type="button"
                            className={styles.backButton}
                            aria-label={t('common.back')}
                            onClick={() => navigate(-1)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.backIcon}>
                                <path d="M14.5 5.5L8 12l6.5 6.5" />
                            </svg>
                        </button>
                        <h1 className={styles.headerTitle}>{t('assetDetails.title')}</h1>
                        <div className={styles.headerSpacer} aria-hidden="true" />
                    </header>

                    <section className={styles.balanceSection}>
                        <div className={styles.balanceRow}>
                            <div className={styles.balanceCard}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" className={styles.balanceIcon} />
                                <div className={styles.balanceInfo}>
                                    <span className={styles.balanceLabel}>{t('assetDetails.points')}</span>
                                    <span className={styles.balanceValue}>{points}</span>
                                </div>
                            </div>
                            <div className={styles.balanceCard}>
                                <svg className={styles.balanceIconDiamond} viewBox="0 0 1024 1024" width="18" height="18">
                                    <path d="M296.42524445 392.80526222H50.38421333L216.76942222 148.46179555h246.03875556zM798.02823111 149.81233778H551.98833778l166.38520889 244.34232889h246.03989333zM403.65169778 392.80526222L511.19786667 226.41777778l106.40611555 166.38748444zM617.75075555 487.09859555L511.34350222 1000.40248889 407.21066667 487.09859555zM300.18901333 487.09859555l211.90883556 531.02364445-454.30670222-531.02364445zM719.77642667 487.09859555l-207.35658667 531.02364445 449.75559111-531.02364445z" fill="#FB4655"/>
                                </svg>
                                <div className={styles.balanceInfo}>
                                    <span className={styles.balanceLabel}>{t('assetDetails.diamonds')}</span>
                                    <span className={styles.balanceValue}>{diamonds}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={styles.toolbar}>
                        <div className={styles.tabs} role="tablist" aria-label="asset currency tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`${styles.tabButton} ${currencyTab === tab.key ? styles.tabButtonActive : ''}`}
                                    onClick={() => setCurrencyTab(tab.key)}
                                >
                                    {t(`assetDetails.${tab.label}`)}
                                </button>
                            ))}
                        </div>

                        <div className={styles.filterRow}>
                            {/* 收支下拉 */}
                            <div className={styles.selectArea}>
                                <button
                                    type="button"
                                    className={`${styles.selectTrigger} ${directionOpen ? styles.selectTriggerActive : ''}`}
                                    aria-haspopup="listbox"
                                    aria-expanded={directionOpen}
                                    onClick={() => setDirectionOpen((v) => !v)}
                                >
                                    <span>{directionLabel}</span>
                                    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.filterChevron}>
                                        <path d="M5.5 7.5L10 12l4.5-4.5" />
                                    </svg>
                                </button>
                                {directionOpen ? (
                                    <>
                                        <button
                                            type="button"
                                            className={styles.filterBackdrop}
                                            aria-label={t('assetDetails.closeFilter')}
                                            onClick={() => setDirectionOpen(false)}
                                        />
                                        <div className={styles.selectPopup} role="listbox">
                                            {([
                                                { key: 'all' as PointsActivityDirection, label: 'directionAll' },
                                                { key: 'income' as PointsActivityDirection, label: 'directionIncome' },
                                                { key: 'expense' as PointsActivityDirection, label: 'directionExpense' },
                                            ]).map((opt) => (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={direction === opt.key}
                                                    className={`${styles.selectOption} ${direction === opt.key ? styles.selectOptionActive : ''}`}
                                                    onClick={() => {
                                                        setDirection(opt.key);
                                                        setDirectionOpen(false);
                                                    }}
                                                >
                                                    {t(`assetDetails.${opt.label}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                            </div>

                            {/* 时间下拉 */}
                            <div className={styles.selectArea}>
                                <button
                                    type="button"
                                    className={`${styles.selectTrigger} ${isFilterOpen ? styles.selectTriggerActive : ''}`}
                                    aria-haspopup="dialog"
                                    aria-expanded={isFilterOpen}
                                    onClick={() => {
                                        if (isFilterOpen) {
                                            setIsFilterOpen(false);
                                            return;
                                        }
                                        openFilter();
                                    }}
                                >
                                    <span>{filterLabel}</span>
                                    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.filterChevron}>
                                        <path d="M5.5 7.5L10 12l4.5-4.5" />
                                    </svg>
                                </button>

                                {isFilterOpen ? (
                                    <>
                                        <button
                                            type="button"
                                            className={styles.filterBackdrop}
                                            aria-label={t('assetDetails.closeFilter')}
                                            onClick={() => setIsFilterOpen(false)}
                                        />
                                        <div className={styles.filterPopup} role="dialog" aria-label={t('assetDetails.yearMonthFilter')}>
                                            <div className={styles.filterColumns}>
                                                <div className={styles.filterColumn}>
                                                    {yearOptions.map((year) => (
                                                        <button
                                                            key={year}
                                                            type="button"
                                                            className={`${styles.filterOption} ${draftYear === year ? styles.filterOptionActive : ''}`}
                                                            onClick={() => setDraftYear(year)}
                                                        >
                                                            {year}{t('assetDetails.year')}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className={styles.filterColumn}>
                                                    {monthOptions.map((month) => (
                                                        <button
                                                            key={month}
                                                            type="button"
                                                            className={`${styles.filterOption} ${draftMonth === month ? styles.filterOptionActive : ''}`}
                                                            onClick={() => setDraftMonth(month)}
                                                        >
                                                            {month}{t('assetDetails.month')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className={styles.filterActions}>
                                                <button
                                                    type="button"
                                                    className={styles.filterActionButton}
                                                    onClick={() => {
                                                        setDraftYear(null);
                                                        setDraftMonth(null);
                                                    }}
                                                >
                                                    {t('assetDetails.clear')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.filterActionButton}
                                                    onClick={() => {
                                                        setDraftYear(defaultYear);
                                                        setDraftMonth(defaultMonth);
                                                    }}
                                                >
                                                    {t('assetDetails.thisMonth')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.filterActionButton} ${styles.filterConfirmButton}`}
                                                    onClick={confirmFilter}
                                                >
                                                    {t('assetDetails.confirm')}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </section>

                    <section className={styles.listSection}>
                        {isLoading && items.length === 0 ? (
                            <div className={styles.stateBlock}>{t('assetDetails.loading')}</div>
                        ) : items.length === 0 ? (
                            <div className={styles.stateBlock}>{t('assetDetails.empty')}</div>
                        ) : (
                            <div className={styles.list}>
                                {items.map((item) => {
                                    const isIncome = item.direction === 'income';
                                    const displayValue = item.amount;
                                    const displayTime = item.occurredAt;
                                    const typeLabel = CURRENCY_TYPE_LABEL[item.currency];
                                    return (
                                        <article key={`${item.currency}-${item.activityType}-${item.id}`} className={styles.item}>
                                            <div className={styles.itemMain}>
                                                <div className={styles.itemTypeRow}>
                                                    <span className={`${styles.itemTypeBadge} ${item.currency === 'points' ? styles.itemTypeBadgePoints : ''}`}>{t(`assetDetails.${typeLabel}`)}</span>
                                                    <h2 className={styles.itemTitle}>{item.title}</h2>
                                                </div>
                                                {item.subtitle ? <p className={styles.itemSubtitle}>{item.subtitle}</p> : null}
                                                <p className={styles.itemTime}>{formatActivityTime(displayTime)}</p>
                                            </div>
                                            <div
                                                className={`${styles.itemAmount} ${
                                                    isIncome ? styles.itemAmountIncome : styles.itemAmountExpense
                                                }`}
                                            >
                                                {isIncome ? '+' : '-'}
                                                {displayValue}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {items.length > 0 && hasMore ? (
                            <button
                                type="button"
                                className={styles.loadMoreButton}
                                disabled={isLoading}
                                onClick={() => void loadActivities(page + 1, true)}
                            >
                                {isLoading ? t('assetDetails.loadingMore') : t('assetDetails.loadMore')}
                            </button>
                        ) : null}
                    </section>
                </section>
            </main>
            <MobileBottomNav hidden />
        </div>
    );
};

export default AssetDetails;
