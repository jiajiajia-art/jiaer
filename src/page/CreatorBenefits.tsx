import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoChevronBack,
  IoChevronDown,
  IoChevronForward,
  IoChevronUp,
  IoHelpCircleOutline,
  IoRefresh,
} from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import CenteredPageHeader from '../components/Layout/CenteredPageHeader';
import CreatorBenefitModeFilter from '../components/CreatorBenefits/CreatorBenefitModeFilter';
import CreatorBenefitRulesModal from '../components/CreatorBenefits/CreatorBenefitRulesModal';
import creatorBenefitsApi from '../api/creatorBenefits/creatorBenefitsApi';
import type {
  CreatorBenefitSummary,
  CreatorBenefitWork,
  CreatorBenefitWorksResult,
} from '../api/creatorBenefits/creatorBenefits.type';
import {
  filterCreatorBenefitWorksByMode,
  formatCreatorProgressPercent,
  creatorLevelProgress,
  metricLabel,
  sortCreatorBenefitWorksByContribution,
  type CreatorBenefitMode,
} from '../lib/creatorLevelView';
import styles from './CreatorBenefits.module.css';

const formatRatio = (value: number) => `${Math.round((Number(value) || 0) * 100)}%`;
const formatNumber = (value: number) => (Number(value) || 0).toLocaleString('zh-CN');
const INCLUDED_WORKS_PER_PAGE = 5;
const EXCLUDED_WORKS_PER_PAGE = 10;

const CreatorBenefits: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CreatorBenefitSummary | null>(null);
  const [works, setWorks] = useState<CreatorBenefitWorksResult>({ included: [], excluded: [] });
  const [includedPage, setIncludedPage] = useState(1);
  const [excludedPage, setExcludedPage] = useState(1);
  const [includedMode, setIncludedMode] = useState<CreatorBenefitMode>('all');
  const [isExcludedExpanded, setIsExcludedExpanded] = useState(false);
  const [isBenefitGuideOpen, setIsBenefitGuideOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const benefitGuideTriggerRef = useRef<HTMLButtonElement>(null);

  const loadBenefits = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [summaryResponse, worksResponse] = await Promise.all([
        creatorBenefitsApi.getSummary(),
        creatorBenefitsApi.getWorks(),
      ]);
      if (!summaryResponse.data.success || !summaryResponse.data.data) {
        throw new Error(summaryResponse.data.message || t('creatorBenefits.loadFailed'));
      }
      setSummary(summaryResponse.data.data);
      setWorks(worksResponse.data.data || { included: [], excluded: [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('creatorBenefits.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBenefits();
  }, [loadBenefits]);

  const sortedIncludedWorks = useMemo(
    () => sortCreatorBenefitWorksByContribution(works.included),
    [works.included],
  );
  const filteredIncludedWorks = useMemo(
    () => filterCreatorBenefitWorksByMode(sortedIncludedWorks, includedMode),
    [includedMode, sortedIncludedWorks],
  );
  const sortedExcludedWorks = useMemo(
    () => sortCreatorBenefitWorksByContribution(works.excluded),
    [works.excluded],
  );
  const includedPageCount = Math.max(1, Math.ceil(filteredIncludedWorks.length / INCLUDED_WORKS_PER_PAGE));
  const includedPageStart = (includedPage - 1) * INCLUDED_WORKS_PER_PAGE;
  const paginatedIncludedWorks = filteredIncludedWorks.slice(
    includedPageStart,
    includedPageStart + INCLUDED_WORKS_PER_PAGE,
  );
  const excludedPageCount = Math.max(1, Math.ceil(sortedExcludedWorks.length / EXCLUDED_WORKS_PER_PAGE));
  const excludedPageStart = (excludedPage - 1) * EXCLUDED_WORKS_PER_PAGE;
  const paginatedExcludedWorks = sortedExcludedWorks.slice(
    excludedPageStart,
    excludedPageStart + EXCLUDED_WORKS_PER_PAGE,
  );

  useEffect(() => {
    setIncludedPage((page) => Math.min(page, includedPageCount));
  }, [includedPageCount]);

  useEffect(() => {
    setExcludedPage((page) => Math.min(page, excludedPageCount));
  }, [excludedPageCount]);

  const closeBenefitGuide = useCallback(() => {
    setIsBenefitGuideOpen(false);
    window.setTimeout(() => benefitGuideTriggerRef.current?.focus(), 0);
  }, []);

  const levelProgress = summary ? creatorLevelProgress(summary) : null;

  const renderWorkRows = (items: CreatorBenefitWork[]) => {
    if (items.length === 0) return <div className={styles.emptyState}>{t('creatorBenefits.noWorks')}</div>;
    return (
      <div className={styles.workList}>
        {items.map((work) => (
          <div key={work.fileId} className={styles.workRow}>
            <div className={styles.workIdentity}>
              <div className={styles.workTitle}>
                <span className={styles.modeTag}>{work.engine || t('creatorBenefits.unknownType')}</span>
                <strong>{work.title}</strong>
              </div>
              {work.takedownReason ? <small className={styles.workReason}>{work.takedownReason}</small> : null}
            </div>
            <span className={styles.statusTag}>{t(`creatorBenefits.status.${work.status}`)}</span>
            <strong className={styles.workMetric}>
              {metricLabel(work)} {formatNumber(work.quarterMetricCount)}
            </strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.pageRoot}>
      <div className={styles.desktopChrome}><Navbar /></div>
      <main className={styles.mainContent}>
        <div className={styles.dashboard}>
          <CenteredPageHeader
            title={t('creatorBenefits.title')}
            backLabel={t('creatorBenefits.back')}
            onBack={() => navigate('/create')}
          />

          {isLoading ? <div className={`${styles.panel} ${styles.stateBox}`}>{t('creatorBenefits.loading')}</div> : null}
          {!isLoading && error ? (
            <div className={`${styles.panel} ${styles.stateBox}`} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void loadBenefits()}>
                <IoRefresh aria-hidden="true" />
                {t('creatorBenefits.retry')}
              </button>
            </div>
          ) : null}

          {!isLoading && summary ? (
            <>
              <section className={`${styles.panel} ${styles.summaryBand}`} aria-labelledby="creator-benefit-level">
              <div className={styles.levelBlock}>
                <span id="creator-benefit-level" className={styles.levelBadge}>{summary.label}</span>
              </div>
              <div className={styles.totalPv}>
                <span>{t('creatorBenefits.growthValue')}</span>
                <strong>{formatNumber(summary.effectiveCount)}</strong>
              </div>
            </section>

              <section className={`${styles.panel} ${styles.ratioSection}`} aria-labelledby="creator-benefit-ratios">
              <div className={styles.sectionHeading}>
                <div className={styles.sectionTitleRow}>
                  <h2 id="creator-benefit-ratios">{t('creatorBenefits.ratioTitle')}</h2>
                  <button
                    ref={benefitGuideTriggerRef}
                    type="button"
                    className={styles.helpButton}
                    onClick={() => setIsBenefitGuideOpen(true)}
                    aria-label={t('creatorBenefits.guideOpen')}
                    title={t('creatorBenefits.guideOpen')}
                  >
                    <IoHelpCircleOutline aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className={styles.ratioGrid}>
                <div className={styles.ratioItem}>
                  <span>{t('creatorBenefits.editorRatio')}</span>
                  <strong>{formatRatio(summary.editorShareRatio)}</strong>
                </div>
                <div className={styles.ratioItem}>
                  <span>{t('creatorBenefits.customRatio')}</span>
                  <strong>{formatRatio(summary.customShareRatio)}</strong>
                </div>
                <div className={styles.ratioItem}>
                  <span>{t('creatorBenefits.freeCreation')}</span>
                  <strong>{summary.freeTxtCreation ? t('creatorBenefits.enabled') : t('creatorBenefits.disabled')}</strong>
                </div>
              </div>
            </section>

            {!summary.isSpecialAuthor && summary.nextLevel && levelProgress?.target ? (
              <section className={`${styles.panel} ${styles.progressSection}`} aria-labelledby="creator-benefit-progress">
                <div className={styles.progressCopy}>
                  <div>
                    <h2 id="creator-benefit-progress">{t('creatorBenefits.nextLevel', { level: summary.nextLevel })}</h2>
                    <p>{t('creatorBenefits.progressHint', { current: formatNumber(levelProgress.current), target: formatNumber(levelProgress.target) })}</p>
                  </div>
                  <strong>{formatCreatorProgressPercent(levelProgress.percent)}</strong>
                </div>
                <progress max={100} value={levelProgress.percent} aria-label={t('creatorBenefits.progressLabel')} />
              </section>
            ) : null}

              <section className={`${styles.panel} ${styles.worksSection}`}>
              <div className={`${styles.sectionHeading} ${styles.worksHeading}`}>
                <div>
                  <h2>{t('creatorBenefits.includedWorks')}</h2>
                  <p>{t('creatorBenefits.includedWorksHint')}</p>
                </div>
                <CreatorBenefitModeFilter
                  value={includedMode}
                  onChange={(mode) => {
                    setIncludedMode(mode);
                    setIncludedPage(1);
                  }}
                />
              </div>
              {renderWorkRows(paginatedIncludedWorks)}
              {includedPageCount > 1 ? (
                <nav className={styles.pagination} aria-label={t('creatorBenefits.paginationLabel')}>
                  <button
                    type="button"
                    onClick={() => setIncludedPage((page) => Math.max(1, page - 1))}
                    disabled={includedPage === 1}
                    aria-label={t('creatorBenefits.previousPage')}
                    title={t('creatorBenefits.previousPage')}
                  >
                    <IoChevronBack aria-hidden="true" />
                  </button>
                  <span>{t('creatorBenefits.pageStatus', { current: includedPage, total: includedPageCount })}</span>
                  <button
                    type="button"
                    onClick={() => setIncludedPage((page) => Math.min(includedPageCount, page + 1))}
                    disabled={includedPage === includedPageCount}
                    aria-label={t('creatorBenefits.nextPage')}
                    title={t('creatorBenefits.nextPage')}
                  >
                    <IoChevronForward aria-hidden="true" />
                  </button>
                </nav>
              ) : null}
            </section>

              <section className={`${styles.panel} ${styles.worksSection}`}>
              <div className={styles.sectionHeading}>
                <h2>
                  <button
                    type="button"
                    className={styles.collapsibleTrigger}
                    onClick={() => setIsExcludedExpanded((expanded) => !expanded)}
                    aria-expanded={isExcludedExpanded}
                    aria-controls="excluded-creator-works"
                  >
                    <span>
                      {t('creatorBenefits.excludedWorks')}
                      <span className={styles.workCount}>
                        {t('creatorBenefits.workCount', { count: formatNumber(works.excluded.length) })}
                      </span>
                    </span>
                    {isExcludedExpanded ? <IoChevronUp aria-hidden="true" /> : <IoChevronDown aria-hidden="true" />}
                  </button>
                </h2>
                <p>{t('creatorBenefits.excludedWorksHint')}</p>
              </div>
              {isExcludedExpanded ? (
                <div id="excluded-creator-works">
                      {renderWorkRows(paginatedExcludedWorks)}
                      {excludedPageCount > 1 ? (
                        <nav className={styles.pagination} aria-label={t('creatorBenefits.paginationLabel')}>
                          <button
                            type="button"
                            onClick={() => setExcludedPage((page) => Math.max(1, page - 1))}
                            disabled={excludedPage === 1}
                            aria-label={t('creatorBenefits.previousPage')}
                            title={t('creatorBenefits.previousPage')}
                          >
                            <IoChevronBack aria-hidden="true" />
                          </button>
                          <span>{t('creatorBenefits.pageStatus', { current: excludedPage, total: excludedPageCount })}</span>
                          <button
                            type="button"
                            onClick={() => setExcludedPage((page) => Math.min(excludedPageCount, page + 1))}
                            disabled={excludedPage === excludedPageCount}
                            aria-label={t('creatorBenefits.nextPage')}
                            title={t('creatorBenefits.nextPage')}
                          >
                            <IoChevronForward aria-hidden="true" />
                          </button>
                        </nav>
                      ) : null}
                  <button
                    type="button"
                    className={styles.collapseFooterButton}
                    onClick={() => setIsExcludedExpanded(false)}
                  >
                    <IoChevronUp aria-hidden="true" />
                    {t('creatorBenefits.collapseExcluded')}
                  </button>
                </div>
              ) : null}
            </section>
            </>
          ) : null}
        </div>
      </main>
      <CreatorBenefitRulesModal
        open={isBenefitGuideOpen}
        currentLevel={summary?.level}
        isSpecialAuthor={summary?.isSpecialAuthor}
        onClose={closeBenefitGuide}
      />
    </div>
  );
};

export default CreatorBenefits;
