import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChevronForward } from 'react-icons/io5';
import toast from 'react-hot-toast';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import RechargeModal from '../components/Purchase/RechargeModal';
import { auth } from '../api/account/authApi';
import type {
    GetPointsActivitiesParams,
    KkAssetCategoryFilter,
    KkBalance,
    KkEventTypeFilter,
    KkValidityFilter,
    PointsActivityDirection,
    PointsActivityItem,
    PointsActivityCurrency,
} from '../api/account/auth.type';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { useTranslation } from 'react-i18next';
import CurrencyIcon from '../components/CurrencyIcon';
import styles from './AssetDetails.module.css';
import { formatKk } from '../utils/kkMoney';

type CurrencyTab = 'all' | 'points' | 'diamonds';

const tabs: Array<{ key: CurrencyTab; label: string }> = [
    { key: 'all', label: 'tabAll' },
    { key: 'diamonds', label: 'tabDiamonds' },
    { key: 'points', label: 'tabPoints' },
];

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
const EMPTY_KK_BALANCE: KkBalance = {
    total: 0,
    permanent: 0,
    limited: 0,
    recharge: 0,
    gift: 0,
    nextExpiryAt: null,
    nextExpiryAmount: 0,
};

const KK_VALIDITY_OPTIONS: Array<{ key: KkValidityFilter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'permanent', label: '永久币' },
    { key: 'limited', label: '限时币' },
];

const KK_ASSET_CATEGORY_OPTIONS: Array<{ key: KkAssetCategoryFilter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'recharge', label: '充值币' },
    { key: 'gift', label: '赠币' },
];

const KK_EVENT_TYPE_OPTIONS: Array<{ key: KkEventTypeFilter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'income', label: '收入' },
    { key: 'consume', label: '消费' },
    { key: 'expired', label: '已过期' },
    { key: 'refund', label: '退款' },
];

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
    const [kkValidity, setKkValidity] = useState<KkValidityFilter>('all');
    const [kkAssetCategory, setKkAssetCategory] = useState<KkAssetCategoryFilter>('all');
    const [kkEventType, setKkEventType] = useState<KkEventTypeFilter>('all');
    const [directionOpen, setDirectionOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | null>(defaultYear);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(defaultMonth);
    const [draftYear, setDraftYear] = useState<number | null>(defaultYear);
    const [draftMonth, setDraftMonth] = useState<number | null>(defaultMonth);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [points, setPoints] = useState(0);
    const [diamonds, setDiamonds] = useState(0);
    const [kkBalance, setKkBalance] = useState<KkBalance>(EMPTY_KK_BALANCE);
    const [items, setItems] = useState<PointsActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
    const loadingRef = useRef(false);

    const yearOptions = useMemo(() => {
        const years = new Set<number>([defaultYear]);
        for (let offset = 0; offset < 4; offset += 1) {
            years.add(defaultYear - offset);
        }
        return Array.from(years).sort((left, right) => right - left);
    }, [defaultYear]);

    const buildCurrencyParam = (currencyTab: CurrencyTab): PointsActivityCurrency => {
        if (currencyTab === 'all') {
            return 'wallet';
        }
        return currencyTab;
    };

    const loadActivities = useCallback(async (nextPage = 1, append = false) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setIsLoading(true);
        try {
            const params: GetPointsActivitiesParams = {
                currency: buildCurrencyParam(currencyTab),
                direction,
                page: nextPage,
                pageSize: 20,
            };
            if (currencyTab === 'diamonds') {
                params.validityType = kkValidity;
                params.assetCategory = kkAssetCategory;
                params.eventType = kkEventType;
            }

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
            setKkBalance(payload.kkBalance ?? {
                ...EMPTY_KK_BALANCE,
                total: payload.diamonds ?? 0,
                permanent: payload.diamonds ?? 0,
            });
            setItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
            const nextTotalPages = Number(payload.totalPages);
            setTotalPages(Number.isFinite(nextTotalPages) && nextTotalPages > 0 ? nextTotalPages : 1);
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
            loadingRef.current = false;
            setIsLoading(false);
        }
    }, [currencyTab, direction, kkValidity, kkAssetCategory, kkEventType, selectedYear, selectedMonth]);

    useEffect(() => {
        setItems([]);
        setPage(1);
        setTotalPages(1);
        void loadActivities(1, false);
    }, [loadActivities]);

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

    // 功能注释：滚到底部 sentinel 自动加载下一页（移动端下拉/上滑翻页）
    useEffect(() => {
        const node = loadMoreSentinelRef.current;
        if (!node || !hasMore) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting || loadingRef.current) return;
                void loadActivities(page + 1, true);
            },
            { root: null, rootMargin: '120px', threshold: 0 },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, page, loadActivities, items.length]);

    const openFilter = () => {
        setDirectionOpen(false);
        setDraftYear(selectedYear);
        setDraftMonth(selectedMonth);
        setIsFilterOpen(true);
    };

    const selectCurrencyTab = (tab: CurrencyTab) => {
        setCurrencyTab(tab);
        setDirectionOpen(false);
        setIsFilterOpen(false);
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
    const activeKkFilterCount = [kkValidity, kkAssetCategory, kkEventType]
        .filter((value) => value !== 'all').length;
    const kkFilterLabel = activeKkFilterCount === 0 ? '全部' : `筛选 ${activeKkFilterCount}`;
    const activeKkFilterLabels = [
        KK_VALIDITY_OPTIONS.find((option) => option.key === kkValidity)?.label,
        KK_ASSET_CATEGORY_OPTIONS.find((option) => option.key === kkAssetCategory)?.label,
        KK_EVENT_TYPE_OPTIONS.find((option) => option.key === kkEventType)?.label,
    ].filter((label) => label && label !== '全部');
    const selectKkValidity = (value: Exclude<KkValidityFilter, 'all'>) => {
        setCurrencyTab('diamonds');
        setKkValidity((current) => current === value ? 'all' : value);
        setDirectionOpen(false);
    };
    const selectKkAssetCategory = (value: Exclude<KkAssetCategoryFilter, 'all'>) => {
        setCurrencyTab('diamonds');
        setKkAssetCategory((current) => current === value ? 'all' : value);
        setDirectionOpen(false);
    };
    const clearKkFilters = () => {
        setKkValidity('all');
        setKkAssetCategory('all');
        setKkEventType('all');
    };
    const handleRecharge = async (order: PayOrderRequest) => {
        const response = await payApi.getPayQrCode(order);
        if (response.data.code === 200 && response.data.data) {
            return {
                qrDataUrl: response.data.data.qrDataUrl,
                outTradeNo: response.data.data.outTradeNo,
            };
        }

        toast.error(response.data.message || t('assetDetails.rechargeFailed'));
        return null;
    };
    const formatExpiry = (value: string) => formatActivityTime(value);

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
                                <div className={styles.balanceInfo}>
                                    <div className={styles.balanceHeading}>
                                        <CurrencyIcon currency="diamonds" className={styles.balanceIconDiamond} />
                                        <span className={styles.balanceLabel}>{t('assetDetails.diamonds')}</span>
                                    </div>
                                    <div className={styles.balanceValueRow}>
                                        <span className={styles.balanceValue}>{formatKk(kkBalance.total ?? diamonds)}</span>
                                        <div className={styles.balanceActions}>
                                            <button
                                                type="button"
                                                className={styles.balanceAction}
                                                onClick={() => setIsRechargeModalOpen(true)}
                                            >
                                                <span>{t('assetDetails.goRecharge')}</span>
                                                <IoChevronForward aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.balanceCard}>
                                <div className={styles.balanceInfo}>
                                    <div className={styles.balanceHeading}>
                                        <CurrencyIcon currency="points" className={styles.balanceIcon} />
                                        <span className={styles.balanceLabel}>{t('assetDetails.points')}</span>
                                    </div>
                                    <div className={styles.balanceValueRow}>
                                        <span className={styles.balanceValue}>{points}</span>
                                        <div className={styles.balanceActions}>
                                            <button
                                                type="button"
                                                className={styles.balanceAction}
                                                onClick={() => navigate('/points/earn')}
                                            >
                                                <span>{t('assetDetails.goToTasks')}</span>
                                                <IoChevronForward aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
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
                                    onClick={() => selectCurrencyTab(tab.key)}
                                >
                                    {t(`assetDetails.${tab.label}`)}
                                </button>
                            ))}
                        </div>

                        <div className={styles.filterRow}>
                            {/* KK币页展示业务流水筛选，其余页保留收支筛选。 */}
                            <div className={`${styles.selectArea} ${styles.activityFilterArea}`}>
                                <button
                                    type="button"
                                    className={`${styles.selectTrigger} ${directionOpen ? styles.selectTriggerActive : ''}`}
                                    aria-haspopup={currencyTab === 'diamonds' ? 'dialog' : 'listbox'}
                                    aria-expanded={directionOpen}
                                    onClick={() => {
                                        setIsFilterOpen(false);
                                        setDirectionOpen((value) => !value);
                                    }}
                                >
                                    <span>{currencyTab === 'diamonds' ? kkFilterLabel : directionLabel}</span>
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
                                        {currencyTab === 'diamonds' ? (
                                            <div className={`${styles.selectPopup} ${styles.kkFilterPopup}`} role="dialog" aria-label="KK币组合筛选">
                                                <div className={styles.kkFilterSection}>
                                                    <h3>有效期</h3>
                                                    <div className={styles.kkFilterOptions}>
                                                        {KK_VALIDITY_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                aria-pressed={kkValidity === option.key}
                                                                className={`${styles.kkFilterOption} ${kkValidity === option.key ? styles.kkFilterOptionActive : ''}`}
                                                                onClick={() => setKkValidity(option.key)}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className={styles.kkFilterSection}>
                                                    <h3>来源</h3>
                                                    <div className={styles.kkFilterOptions}>
                                                        {KK_ASSET_CATEGORY_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                aria-pressed={kkAssetCategory === option.key}
                                                                className={`${styles.kkFilterOption} ${kkAssetCategory === option.key ? styles.kkFilterOptionActive : ''}`}
                                                                onClick={() => setKkAssetCategory(option.key)}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className={styles.kkFilterSection}>
                                                    <h3>流水类型</h3>
                                                    <div className={styles.kkFilterOptions}>
                                                        {KK_EVENT_TYPE_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                aria-pressed={kkEventType === option.key}
                                                                className={`${styles.kkFilterOption} ${kkEventType === option.key ? styles.kkFilterOptionActive : ''}`}
                                                                onClick={() => setKkEventType(option.key)}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className={styles.kkFilterFooter}>
                                                    <span>{activeKkFilterLabels.length > 0 ? `当前：${activeKkFilterLabels.join(' · ')}` : '当前：全部流水'}</span>
                                                    <button type="button" onClick={clearKkFilters} disabled={activeKkFilterCount === 0}>
                                                        一键清除
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={styles.selectPopup} role="listbox">
                                                {([
                                                    { key: 'all' as PointsActivityDirection, label: t('assetDetails.directionAll') },
                                                    { key: 'income' as PointsActivityDirection, label: t('assetDetails.directionIncome') },
                                                    { key: 'expense' as PointsActivityDirection, label: t('assetDetails.directionExpense') },
                                                ]).map((option) => (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={direction === option.key}
                                                        className={`${styles.selectOption} ${direction === option.key ? styles.selectOptionActive : ''}`}
                                                        onClick={() => {
                                                            setDirection(option.key);
                                                            setDirectionOpen(false);
                                                        }}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : null}
                            </div>

                            {/* 时间下拉 */}
                            <div className={`${styles.selectArea} ${styles.dateFilterArea}`}>
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

                    {currencyTab === 'diamonds' ? (
                        <section className={styles.kkBreakdownSection} aria-label="KK币余额构成">
                            <h2 className={styles.kkBreakdownTitle}>KK币构成</h2>
                            <div className={styles.kkBreakdownGroups}>
                                <section className={styles.kkBreakdownGroup} aria-labelledby="kk-validity-heading">
                                    <h3 id="kk-validity-heading" className={styles.kkBreakdownHeading}>按有效期</h3>
                                    <div className={styles.kkBreakdownGrid}>
                                        <button
                                            type="button"
                                            className={`${styles.kkBreakdownButton} ${kkValidity === 'permanent' ? styles.kkBreakdownButtonActive : ''}`}
                                            aria-pressed={kkValidity === 'permanent'}
                                            onClick={() => selectKkValidity('permanent')}
                                        >
                                            <span>永久币</span>
                                            <strong>{formatKk(kkBalance.permanent)}</strong>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.kkBreakdownButton} ${kkValidity === 'limited' ? styles.kkBreakdownButtonActive : ''}`}
                                            aria-pressed={kkValidity === 'limited'}
                                            onClick={() => selectKkValidity('limited')}
                                        >
                                            <span>限时币</span>
                                            <strong>{formatKk(kkBalance.limited)}</strong>
                                        </button>
                                    </div>
                                </section>
                                <section className={styles.kkBreakdownGroup} aria-labelledby="kk-source-heading">
                                    <h3 id="kk-source-heading" className={styles.kkBreakdownHeading}>按来源</h3>
                                    <div className={styles.kkBreakdownGrid}>
                                        <button
                                            type="button"
                                            className={`${styles.kkBreakdownButton} ${kkAssetCategory === 'recharge' ? styles.kkBreakdownButtonActive : ''}`}
                                            aria-pressed={kkAssetCategory === 'recharge'}
                                            onClick={() => selectKkAssetCategory('recharge')}
                                        >
                                            <span>充值币</span>
                                            <strong>{formatKk(kkBalance.recharge)}</strong>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.kkBreakdownButton} ${kkAssetCategory === 'gift' ? styles.kkBreakdownButtonActive : ''}`}
                                            aria-pressed={kkAssetCategory === 'gift'}
                                            onClick={() => selectKkAssetCategory('gift')}
                                        >
                                            <span>赠币</span>
                                            <strong>{formatKk(kkBalance.gift)}</strong>
                                        </button>
                                    </div>
                                </section>
                            </div>
                            {kkBalance.nextExpiryAt && kkBalance.nextExpiryAmount > 0 ? (
                                <p className={styles.expiryHint}>
                                    {formatExpiry(kkBalance.nextExpiryAt)} 将有 {formatKk(kkBalance.nextExpiryAmount)} 限时币到期
                                </p>
                            ) : null}
                        </section>
                    ) : null}

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
                                    const hasMembershipDiscount = item.currency === 'diamonds'
                                        && item.direction === 'expense'
                                        && typeof item.originalAmount === 'number'
                                        && item.originalAmount > item.amount
                                        && typeof item.discountPercent === 'number';
                                    const validityText = item.currency !== 'diamonds' || !item.validityType
                                        ? null
                                        : item.validityType === 'permanent'
                                            ? t('assetDetails.validityPermanent')
                                            : item.expiresAt
                                                ? t(
                                                    item.eventStatus === 'expired'
                                                        ? 'assetDetails.validityExpiredAt'
                                                        : 'assetDetails.validityUntil',
                                                    { time: formatActivityTime(item.expiresAt) },
                                                )
                                                : t('assetDetails.validityLimited');
                                    return (
                                        <article key={`${item.currency}-${item.activityType}-${item.id}`} className={styles.item}>
                                            <div className={styles.itemMain}>
                                                <div className={styles.itemTypeRow}>
                                                    <span className={`${styles.itemTypeBadge} ${item.currency === 'points' ? styles.itemTypeBadgePoints : ''}`}>{t(`assetDetails.${typeLabel}`)}</span>
                                                    <h2 className={styles.itemTitle}>{item.title}</h2>
                                                </div>
                                                {item.subtitle ? <p className={styles.itemSubtitle}>{item.subtitle}</p> : null}
                                            </div>
                                            {hasMembershipDiscount ? (
                                                <div className={styles.itemAmountStack}>
                                                    <span className={styles.itemOriginalAmount}>
                                                        -{formatKk(item.originalAmount!)}
                                                    </span>
                                                    <span className={`${styles.itemAmount} ${styles.itemAmountExpense} ${styles.itemActualAmount}`}>
                                                        -{formatKk(displayValue)}
                                                    </span>
                                                    <span className={styles.itemDiscountBadge}>会员{item.discountPercent}折</span>
                                                </div>
                                            ) : (
                                                <div
                                                    className={`${styles.itemAmount} ${
                                                        isIncome ? styles.itemAmountIncome : styles.itemAmountExpense
                                                    }`}
                                                >
                                                    {isIncome ? '+' : '-'}
                                                    {formatKk(displayValue)}
                                                </div>
                                            )}
                                            <p className={styles.itemTime}>
                                                <span>{formatActivityTime(displayTime)}</span>
                                                {validityText ? <span>（{validityText}）</span> : null}
                                            </p>
                                        </article>
                                    );
                                })}
                            </div>
                        )}

                        {items.length > 0 && hasMore ? (
                            <>
                                <div ref={loadMoreSentinelRef} className={styles.loadMoreSentinel} aria-hidden />
                                <button
                                    type="button"
                                    className={styles.loadMoreButton}
                                    disabled={isLoading}
                                    onClick={() => void loadActivities(page + 1, true)}
                                >
                                    {isLoading ? t('assetDetails.loadingMore') : t('assetDetails.loadMore')}
                                </button>
                            </>
                        ) : null}
                        {items.length > 0 && !hasMore ? (
                            <p className={styles.listEndHint}>{t('assetDetails.noMore')}</p>
                        ) : null}
                    </section>
                </section>
            </main>
            <MobileBottomNav hidden />
            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => {
                    setIsRechargeModalOpen(false);
                    void loadActivities(1, false);
                }}
                onRecharge={handleRecharge}
                fixedTab="diamonds"
            />
        </div>
    );
};

export default AssetDetails;
