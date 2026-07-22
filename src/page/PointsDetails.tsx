import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { auth } from '../api/account/authApi';
import type { GetPointsActivitiesParams, PointsActivityDirection, PointsActivityItem } from '../api/account/auth.type';
import { getApiErrorMessage } from '../utils/error';
import { useTranslation } from 'react-i18next';
import styles from './PointsDetails.module.css';

const TABS: Array<{ key: PointsActivityDirection; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'income', label: '收入' },
  { key: 'expense', label: '支出' },
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

const PointsDetails: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;
  const [direction, setDirection] = useState<PointsActivityDirection>('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(defaultMonth);
  const [draftYear, setDraftYear] = useState<number | null>(defaultYear);
  const [draftMonth, setDraftMonth] = useState<number | null>(defaultMonth);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(0);
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

  const loadActivities = async (nextPage = 1, append = false) => {
    setIsLoading(true);
    try {
      const params: GetPointsActivitiesParams = {
        currency: 'points',
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
        throw new Error(response.data.message || 'Failed to load points activities.');
      }

      const payload = response.data.data;
      setCurrentPoints(payload.points ?? 0);
      setItems((prev) => (append ? [...prev, ...payload.items] : payload.items));
      setTotalPages(1);
      setPage(nextPage);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to load points activities.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities(1, false);
  }, [direction, selectedYear, selectedMonth]);

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

  return (
    <div className={styles.pageRoot}>
      <main className={styles.main}>
        <section className={styles.shell}>
          <header className={styles.header}>
            <button
              type="button"
              className={styles.backButton}
              aria-label="返回"
              onClick={() => navigate(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.backIcon}>
                <path d="M14.5 5.5L8 12l6.5 6.5" />
              </svg>
            </button>
            <h1 className={styles.headerTitle}>{t('assetDetails.points')}</h1>
            <div className={styles.headerSpacer} aria-hidden="true" />
          </header>

          <section className={styles.summary}>
            <p className={styles.summaryLabel}>{t('assetDetails.points')}</p>
            <p className={styles.summaryValue}>{currentPoints}</p>
          </section>

          <section className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label="points direction tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${styles.tabButton} ${direction === tab.key ? styles.tabButtonActive : ''}`}
                  onClick={() => setDirection(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.filterArea}>
              <button
                type="button"
                className={styles.filterTrigger}
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
                  const displayPoints = item.amount;
                  const displayTime = item.occurredAt;
                  return (
                    <article key={`${item.activityType}-${item.id}`} className={styles.item}>
                      <div className={styles.itemMain}>
                        <h2 className={styles.itemTitle}>{item.title}</h2>
                        {item.subtitle ? <p className={styles.itemSubtitle}>{item.subtitle}</p> : null}
                        <p className={styles.itemTime}>{formatActivityTime(displayTime)}</p>
                      </div>
                      <div
                        className={`${styles.itemPoints} ${
                          isIncome ? styles.itemPointsIncome : styles.itemPointsExpense
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {displayPoints}
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

export default PointsDetails;
