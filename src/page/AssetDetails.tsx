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
    PointsActivitiesResponse,
} from '../api/account/auth.type';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { useTranslation } from 'react-i18next';
import CurrencyIcon from '../components/CurrencyIcon';
import CenteredPageHeader from '../components/Layout/CenteredPageHeader';
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

const KK_VALIDITY_OPTIONS: Array<{ key: KkValidityFilter; labelKey: string }> = [
    { key: 'all', labelKey: 'filterAll' },
    { key: 'permanent', labelKey: 'kkPermanent' },
    { key: 'limited', labelKey: 'kkLimited' },
];

const KK_ASSET_CATEGORY_OPTIONS: Array<{ key: KkAssetCategoryFilter; labelKey: string }> = [
    { key: 'all', labelKey: 'filterAll' },
    { key: 'recharge', labelKey: 'kkRecharge' },
    { key: 'gift', labelKey: 'kkGift' },
];

const KK_EVENT_TYPE_OPTIONS: Array<{ key: KkEventTypeFilter; labelKey: string }> = [
    { key: 'all', labelKey: 'filterAll' },
    { key: 'income', labelKey: 'eventIncome' },
    { key: 'consume', labelKey: 'eventConsume' },
    { key: 'expired', labelKey: 'eventExpired' },
    { key: 'refund', labelKey: 'eventRefund' },
];

const LEDGER_PHRASES: Record<string, string> = {
    '钻石收入': 'assetDetails.ledgerIncome',
    'KK币收入': 'assetDetails.ledgerIncome',
    '钻石支出': 'assetDetails.ledgerExpense',
    'KK币支出': 'assetDetails.ledgerExpense',
    '钻石变动': 'assetDetails.ledgerChange',
    'KK币变动': 'assetDetails.ledgerChange',
    '钻石充值': 'assetDetails.ledgerRecharge',
    'KK币充值': 'assetDetails.ledgerRecharge',
    '充值获得KK币': 'assetDetails.ledgerRechargeSub',
    '充值获得钻石': 'assetDetails.ledgerRechargeSub',
    '充值赠送KK币': 'assetDetails.ledgerRechargeBonus',
    '充值赠送钻石': 'assetDetails.ledgerRechargeBonus',
    '活动赠送': 'assetDetails.ledgerBonusGift',
    '购买付费游戏': 'assetDetails.ledgerGamePurchase',
    '付费内容消费': 'assetDetails.ledgerPaidContent',
    '会员订阅': 'assetDetails.ledgerMembership',
    '会员功能订阅': 'assetDetails.ledgerMembershipSub',
    '创作者收益': 'assetDetails.ledgerCreatorRevenue',
    '作品KK币分成': 'assetDetails.ledgerRevenueShare',
    '首次注册福利': 'assetDetails.ledgerRegisterReward',
    '邀请好友福利': 'assetDetails.ledgerInviteInviter',
    '好友邀请福利': 'assetDetails.ledgerInviteInvitee',
    '兑换织梦豆': 'assetDetails.ledgerExchangePoints',
    'KK币兑换织梦豆': 'assetDetails.ledgerExchangePointsSub',
    '钻石兑换织梦豆': 'assetDetails.ledgerExchangePointsSub',
    '凤华录新人赠送': 'assetDetails.ledgerFenghuaGift',
    '首次进入凤华录获得': 'assetDetails.ledgerFenghuaGiftSub',
    '限时KK币已过期': 'assetDetails.ledgerExpired',
    '退款KK币已过期': 'assetDetails.ledgerRefundExpired',
    '创作者分成KK币提取': 'assetDetails.ledgerCreatorWithdraw',
    'AI文游消费': 'assetDetails.ledgerAiPlay',
    '织梦豆兑换退款': 'assetDetails.ledgerPointsRefund',
    '兑换凤华': 'assetDetails.ledgerFenghuaExchange',
    '凤华兑换退款': 'assetDetails.ledgerFenghuaRefund',
    '互动影游消费退款': 'assetDetails.ledgerIvgRefund',
    '系统补发KK币': 'assetDetails.ledgerSystemGrant',
    '系统扣减KK币': 'assetDetails.ledgerSystemDeduct',
    '账户KK币清零': 'assetDetails.ledgerForfeit',
    'Funloom官方增加KK币': 'assetDetails.ledgerOfficialGrant',
    'Funloom官方扣减KK币': 'assetDetails.ledgerOfficialDeduct',
    '活动KK币福利': 'assetDetails.ledgerPromo',
    '外部游戏退款': 'assetDetails.ledgerExternalRefund',
    '外部游戏消费': 'assetDetails.ledgerExternalSpend',
};

function localizeLedgerPhrase(text: string, translate: (key: string) => string) {
    const key = LEDGER_PHRASES[String(text || '').trim()];
    return key ? translate(key) : text;
}

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

type AssetDetailsProps = {
    /** 功能注释：嵌入模式——在游戏页上以浮层打开，返回 = 关闭浮层，不切路由（切路由会卸载游戏页导致会话丢失，P-14 / P-12） */
    embedded?: boolean;
    onClose?: () => void;
};

const AssetDetails: React.FC<AssetDetailsProps> = ({ embedded = false, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { defaultYear, defaultMonth, defaultDay } = useMemo(() => {
        const parts = new Intl.DateTimeFormat('en', {
            timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric',
        }).formatToParts(new Date());
        return {
            defaultYear: Number(parts.find(({ type }) => type === 'year')?.value),
            defaultMonth: Number(parts.find(({ type }) => type === 'month')?.value),
            defaultDay: Number(parts.find(({ type }) => type === 'day')?.value),
        };
    }, []);
    const [currencyTab, setCurrencyTab] = useState<CurrencyTab>('all');
    const [direction, setDirection] = useState<PointsActivityDirection>('all');
    const [kkValidity, setKkValidity] = useState<KkValidityFilter>('all');
    const [kkAssetCategory, setKkAssetCategory] = useState<KkAssetCategoryFilter>('all');
    const [kkEventType, setKkEventType] = useState<KkEventTypeFilter>('all');
    const [directionOpen, setDirectionOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | null>(defaultYear);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(defaultMonth);
    const [selectedDay, setSelectedDay] = useState<number | null>(defaultDay);
    const [draftDay, setDraftDay] = useState<number | null>(defaultDay);
    const [draftYear, setDraftYear] = useState<number | null>(defaultYear);
    const [draftMonth, setDraftMonth] = useState<number | null>(defaultMonth);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [points, setPoints] = useState(0);
    const [diamonds, setDiamonds] = useState(0);
    const [kkBalance, setKkBalance] = useState<KkBalance>(EMPTY_KK_BALANCE);
    const [items, setItems] = useState<PointsActivityItem[]>([]);
    const [totals, setTotals] = useState<PointsActivitiesResponse['totals']>();
    const [isLoading, setIsLoading] = useState(false);
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
    const loadingRef = useRef(false);
    const requestIdRef = useRef(0);

    const yearOptions = useMemo(() => {
        const years = new Set<number>([defaultYear]);
        for (let offset = 0; offset < 4; offset += 1) {
            years.add(defaultYear - offset);
        }
        return Array.from(years).sort((left, right) => right - left);
    }, [defaultYear]);

    // 功能注释：远端旧接口还不认 wallet；「全部」用 all，再在前端去掉凤华，效果等同钱包口径
    const buildCurrencyParam = (tab: CurrencyTab): PointsActivityCurrency => (
        tab === 'all' ? 'all' : tab
    );

    const loadActivities = useCallback(async (nextPage = 1, append = false) => {
        if (append && loadingRef.current) return;
        const requestId = ++requestIdRef.current;
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
                if (selectedDay !== null) params.day = selectedDay;
            }

            const response = await auth.getPointsActivities(params);
            if (requestId !== requestIdRef.current) return;
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || 'Failed to load asset activities.');
            }

            const payload = response.data.data;
            if (!append) setTotals(payload.totals);
            setPoints(payload.points ?? 0);
            setDiamonds(payload.diamonds ?? 0);
            setKkBalance(payload.kkBalance ?? {
                ...EMPTY_KK_BALANCE,
                total: payload.diamonds ?? 0,
                permanent: payload.diamonds ?? 0,
            });
            const nextItems = currencyTab === 'all'
                ? payload.items.filter((item) => item.currency === 'points' || item.currency === 'diamonds')
                : payload.items;
            setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
            const nextTotalPages = Number(payload.totalPages);
            setTotalPages(Number.isFinite(nextTotalPages) && nextTotalPages > 0 ? nextTotalPages : 1);
            setPage(nextPage);
        } catch (error: unknown) {
            if (requestId !== requestIdRef.current) return;
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    : error instanceof Error
                        ? error.message
                        : 'Failed to load asset activities.';
            toast.error(message || 'Failed to load asset activities.');
        } finally {
            if (requestId === requestIdRef.current) {
                loadingRef.current = false;
                setIsLoading(false);
            }
        }
    }, [currencyTab, direction, kkValidity, kkAssetCategory, kkEventType, selectedYear, selectedMonth, selectedDay]);

    useEffect(() => {
        setItems([]);
        setTotals(undefined);
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

    const hasMore = page < totalPages;
    const daysInDraftMonth = draftYear !== null && draftMonth !== null
        ? new Date(Date.UTC(draftYear, draftMonth, 0)).getUTCDate()
        : 0;
    const filterLabel = selectedYear === defaultYear && selectedMonth === defaultMonth && selectedDay === defaultDay
        ? t('assetDetails.today', { defaultValue: '今天' })
        : selectedYear !== null && selectedMonth !== null
            ? [selectedYear, selectedMonth, selectedDay].filter((part) => part !== null).map((part) => String(part).padStart(2, '0')).join('.')
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
        setDraftDay(selectedDay);
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
        setSelectedDay(draftDay);
        setIsFilterOpen(false);
    };

    const directionLabel = direction === 'all'
        ? t('assetDetails.directionAll')
        : direction === 'income'
            ? t('assetDetails.directionIncome')
            : t('assetDetails.directionExpense');
    const activeKkFilterCount = [kkValidity, kkAssetCategory, kkEventType]
        .filter((value) => value !== 'all').length;
    const kkFilterLabel = activeKkFilterCount === 0
        ? t('assetDetails.filterAll')
        : t('assetDetails.filterCount', { count: activeKkFilterCount });
    const activeKkFilterLabels = [
        kkValidity === 'all' ? '' : t(`assetDetails.${KK_VALIDITY_OPTIONS.find((option) => option.key === kkValidity)?.labelKey}`),
        kkAssetCategory === 'all' ? '' : t(`assetDetails.${KK_ASSET_CATEGORY_OPTIONS.find((option) => option.key === kkAssetCategory)?.labelKey}`),
        kkEventType === 'all' ? '' : t(`assetDetails.${KK_EVENT_TYPE_OPTIONS.find((option) => option.key === kkEventType)?.labelKey}`),
    ].filter(Boolean);
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
                    <div className={styles.headerDock}>
                        <CenteredPageHeader
                            title={t('assetDetails.title')}
                            backLabel={t('common.back')}
                            onBack={() => (embedded ? onClose?.() : navigate(-1))}
                        />
                    </div>

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
                                                onClick={() => {
                                                    // 功能注释：嵌入模式不离开游戏页，任务页在新标签打开
                                                    if (embedded) window.open(`${import.meta.env.BASE_URL}points/earn`, '_blank', 'noopener');
                                                    else navigate('/points/earn');
                                                }}
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
                                            <div className={`${styles.selectPopup} ${styles.kkFilterPopup}`} role="dialog" aria-label={t('assetDetails.kkFilterAria')}>
                                                <div className={styles.kkFilterSection}>
                                                    <h3>{t('assetDetails.kkValidity')}</h3>
                                                    <div className={styles.kkFilterOptions}>
                                                        {KK_VALIDITY_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                aria-pressed={kkValidity === option.key}
                                                                className={`${styles.kkFilterOption} ${kkValidity === option.key ? styles.kkFilterOptionActive : ''}`}
                                                                onClick={() => setKkValidity(option.key)}
                                                            >
                                                                {t(`assetDetails.${option.labelKey}`)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className={styles.kkFilterSection}>
                                                    <h3>{t('assetDetails.kkSource')}</h3>
                                                    <div className={styles.kkFilterOptions}>
                                                        {KK_ASSET_CATEGORY_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                aria-pressed={kkAssetCategory === option.key}
                                                                className={`${styles.kkFilterOption} ${kkAssetCategory === option.key ? styles.kkFilterOptionActive : ''}`}
                                                                onClick={() => setKkAssetCategory(option.key)}
                                                            >
                                                                {t(`assetDetails.${option.labelKey}`)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className={styles.kkFilterSection}>
                                                    <h3>{t('assetDetails.kkEventType')}</h3>
                                                    <div className={styles.kkFilterOptions}>
                                                        {KK_EVENT_TYPE_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                aria-pressed={kkEventType === option.key}
                                                                className={`${styles.kkFilterOption} ${kkEventType === option.key ? styles.kkFilterOptionActive : ''}`}
                                                                onClick={() => setKkEventType(option.key)}
                                                            >
                                                                {t(`assetDetails.${option.labelKey}`)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className={styles.kkFilterFooter}>
                                                    <span>
                                                        {activeKkFilterLabels.length > 0
                                                            ? t('assetDetails.filterCurrent', { value: activeKkFilterLabels.join(' · ') })
                                                            : t('assetDetails.filterCurrentAll')}
                                                    </span>
                                                    <button type="button" onClick={clearKkFilters} disabled={activeKkFilterCount === 0}>
                                                        {t('assetDetails.clearAll')}
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
                                                            onClick={() => { setDraftYear(year); setDraftMonth(draftMonth ?? defaultMonth); setDraftDay(null); }}
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
                                                            onClick={() => { setDraftMonth(month); setDraftYear(draftYear ?? defaultYear); setDraftDay(null); }}
                                                        >
                                                            {month}{t('assetDetails.month')}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className={styles.filterColumn}>
                                                    {daysInDraftMonth > 0 && [null, ...Array.from({ length: daysInDraftMonth }, (_, index) => index + 1)].map((day) => (
                                                        <button
                                                            key={day ?? 'month'}
                                                            type="button"
                                                            className={`${styles.filterOption} ${draftDay === day ? styles.filterOptionActive : ''}`}
                                                            onClick={() => setDraftDay(day)}
                                                        >
                                                            {day === null ? t('assetDetails.wholeMonth', { defaultValue: '整月' }) : day}
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
                                                        setDraftDay(null);
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
                                                        setDraftDay(defaultDay);
                                                    }}
                                                >
                                                    {t('assetDetails.today', { defaultValue: '今天' })}
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
                        <section className={styles.kkBreakdownSection} aria-label={t('assetDetails.kkBreakdownAria')}>
                            <h2 className={styles.kkBreakdownTitle}>{t('assetDetails.kkBreakdownTitle')}</h2>
                            <div className={styles.kkBreakdownGroup}>
                                <div className={styles.kkBreakdownGrid}>
                                    <button
                                        type="button"
                                        className={`${styles.kkBreakdownButton} ${kkValidity === 'permanent' ? styles.kkBreakdownButtonActive : ''}`}
                                        aria-pressed={kkValidity === 'permanent'}
                                        onClick={() => selectKkValidity('permanent')}
                                    >
                                        <span>{t('assetDetails.kkPermanent')}</span>
                                        <strong>{formatKk(kkBalance.permanent)}</strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.kkBreakdownButton} ${kkValidity === 'limited' ? styles.kkBreakdownButtonActive : ''}`}
                                        aria-pressed={kkValidity === 'limited'}
                                        onClick={() => selectKkValidity('limited')}
                                    >
                                        <span>{t('assetDetails.kkLimited')}</span>
                                        <strong>{formatKk(kkBalance.limited)}</strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.kkBreakdownButton} ${kkAssetCategory === 'recharge' ? styles.kkBreakdownButtonActive : ''}`}
                                        aria-pressed={kkAssetCategory === 'recharge'}
                                        onClick={() => selectKkAssetCategory('recharge')}
                                    >
                                        <span>{t('assetDetails.kkRecharge')}</span>
                                        <strong>{formatKk(kkBalance.recharge)}</strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.kkBreakdownButton} ${kkAssetCategory === 'gift' ? styles.kkBreakdownButtonActive : ''}`}
                                        aria-pressed={kkAssetCategory === 'gift'}
                                        onClick={() => selectKkAssetCategory('gift')}
                                    >
                                        <span>{t('assetDetails.kkGift')}</span>
                                        <strong>{formatKk(kkBalance.gift)}</strong>
                                    </button>
                                </div>
                            </div>
                            {kkBalance.nextExpiryAt && kkBalance.nextExpiryAmount > 0 ? (
                                <p className={styles.expiryHint}>
                                    {t('assetDetails.kkExpiry', {
                                        time: formatExpiry(kkBalance.nextExpiryAt),
                                        amount: formatKk(kkBalance.nextExpiryAmount),
                                    })}
                                </p>
                            ) : null}
                        </section>
                    ) : null}

                    <section className={styles.listSection}>
                        {totals && (
                            <div className={styles.activityTotals}>
                                {(['income', 'expense'] as const).map((kind) => (
                                    <span key={kind}>
                                        {t(`assetDetails.total_${kind}`)}{' '}
                                        <strong>
                                            {tabs.flatMap(({ key, label }) => {
                                                if (key === 'all' || !totals[key]) return [];
                                                return `${formatKk(totals[key][kind])} ${t(`assetDetails.${label}`)}`;
                                            }).join(' · ')}
                                        </strong>
                                    </span>
                                ))}
                            </div>
                        )}
                        {isLoading && items.length === 0 ? (
                            <div className={styles.stateBlock}>{t('assetDetails.loading')}</div>
                        ) : items.length === 0 ? (
                            <div className={styles.stateBlock}>{t('assetDetails.empty')}</div>
                        ) : (
                            <>
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
                                                    <h2 className={styles.itemTitle}>{localizeLedgerPhrase(item.title, t)}</h2>
                                                </div>
                                                {item.subtitle ? <p className={styles.itemSubtitle}>{localizeLedgerPhrase(item.subtitle, t)}</p> : null}
                                            </div>
                                            {hasMembershipDiscount ? (
                                                <div className={styles.itemAmountStack}>
                                                    <span className={styles.itemOriginalAmount}>
                                                        -{formatKk(item.originalAmount!)}
                                                    </span>
                                                    <span className={`${styles.itemAmount} ${styles.itemAmountExpense} ${styles.itemActualAmount}`}>
                                                        -{formatKk(displayValue)}
                                                    </span>
                                                    <span className={styles.itemDiscountBadge}>{t('assetDetails.memberDiscount', { percent: item.discountPercent })}</span>
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
                            </>
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
            {embedded ? null : <MobileBottomNav hidden />}
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
