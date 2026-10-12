import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IoArrowBack,
  IoChevronBack,
  IoChevronDown,
  IoChevronForward,
  IoChevronUp,
  IoClose,
  IoHelpCircleOutline,
  IoRefresh,
} from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import creatorBenefitsApi from '../api/creatorBenefits/creatorBenefitsApi';
import type {
  CreatorBenefitSummary,
  CreatorBenefitWork,
  CreatorBenefitWorksResult,
} from '../api/creatorBenefits/creatorBenefits.type';
import styles from './CreatorBenefits.module.css';

const formatRatio = (value: number) => `${Math.round((Number(value) || 0) * 100)}%`;
const formatNumber = (value: number) => (Number(value) || 0).toLocaleString('zh-CN');
const INCLUDED_WORKS_PER_PAGE = 10;
const CREATOR_BENEFIT_LEVELS = [
  { levelKey: 'guideLevel1', threshold: 0, editorRatio: '10%', customRatio: '55%' },
  { levelKey: 'guideLevel2', threshold: 5000, editorRatio: '15%', customRatio: '60%' },
  { levelKey: 'guideLevel3', threshold: 10000, editorRatio: '20%', customRatio: '65%' },
  { levelKey: 'guideLevel4', threshold: 50000, editorRatio: '25%', customRatio: '70%' },
  { levelKey: 'guideLevel5', threshold: 100000, editorRatio: '30%', customRatio: '75%' },
  { levelKey: 'guideSpecial', threshold: null, editorRatio: '40%-50%', customRatio: '80%-90%' },
] as const;

const CreatorBenefits: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CreatorBenefitSummary | null>(null);
  const [works, setWorks] = useState<CreatorBenefitWorksResult>({ included: [], excluded: [] });
  const [includedPage, setIncludedPage] = useState(1);
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

  const includedPageCount = Math.max(1, Math.ceil(works.included.length / INCLUDED_WORKS_PER_PAGE));
  const includedPageStart = (includedPage - 1) * INCLUDED_WORKS_PER_PAGE;
  const paginatedIncludedWorks = works.included.slice(
    includedPageStart,
    includedPageStart + INCLUDED_WORKS_PER_PAGE,
  );

  useEffect(() => {
    setIncludedPage((page) => Math.min(page, includedPageCount));
  }, [includedPageCount]);

  const closeBenefitGuide = useCallback(() => {
    setIsBenefitGuideOpen(false);
    window.setTimeout(() => benefitGuideTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!isBenefitGuideOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBenefitGuide();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeBenefitGuide, isBenefitGuideOpen]);

  const renderWorkRows = (items: CreatorBenefitWork[]) => {
    if (items.length === 0) return <div className={styles.emptyState}>{t('creatorBenefits.noWorks')}</div>;
    return (
      <div className={styles.workList}>
        {items.map((work) => (
          <div key={work.fileId} className={styles.workRow}>
            <div className={styles.workMain}>
              <strong>{work.title}</strong>
              <span>{work.engine || t('creatorBenefits.unknownType')} · {work.fileId}</span>
              {work.takedownReason ? <small>{work.takedownReason}</small> : null}
            </div>
            <div className={styles.workMetrics}>
              <span className={styles.statusTag}>{t(`creatorBenefits.status.${work.status}`)}</span>
              <strong>{t('creatorBenefits.playCount', { count: formatNumber(work.pv) })}</strong>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/create')} aria-label={t('creatorBenefits.back')}>
            <IoArrowBack aria-hidden="true" />
          </button>
          <div>
            <h1>{t('creatorBenefits.title')}</h1>
            <p>{t('creatorBenefits.subtitle')}</p>
          </div>
        </header>

        {isLoading ? <div className={styles.stateBox}>{t('creatorBenefits.loading')}</div> : null}
        {!isLoading && error ? (
          <div className={styles.stateBox} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadBenefits()}>
              <IoRefresh aria-hidden="true" />
              {t('creatorBenefits.retry')}
            </button>
          </div>
        ) : null}

        {!isLoading && summary ? (
          <>
            <section className={styles.summaryBand} aria-labelledby="creator-benefit-level">
              <div className={styles.levelBlock}>
                <span id="creator-benefit-level" className={styles.levelBadge}>{summary.label}</span>
                <div>
                  <h2>{summary.isSpecialAuthor ? t('creatorBenefits.specialTitle') : t('creatorBenefits.levelTitle', { level: summary.level })}</h2>
                  <p>{summary.isSpecialAuthor ? t('creatorBenefits.specialHint') : t('creatorBenefits.levelHint')}</p>
                </div>
              </div>
              <div className={styles.totalPv}>
                <span>{t('creatorBenefits.totalPv')}</span>
                <strong>{formatNumber(summary.totalPv)}</strong>
              </div>
            </section>

            <section className={styles.ratioSection} aria-labelledby="creator-benefit-ratios">
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
                <p>{t('creatorBenefits.ratioHint')}</p>
              </div>
              <div className={styles.ratioGrid}>
                <div className={styles.ratioItem}>
                  <span>{t('creatorBenefits.editorRatio')}</span>
                  <strong>{formatRatio(summary.editorShareRatio)}</strong>
                  <small>{t('creatorBenefits.editorRatioHint')}</small>
                </div>
                <div className={styles.ratioItem}>
                  <span>{t('creatorBenefits.customRatio')}</span>
                  <strong>{formatRatio(summary.customShareRatio)}</strong>
                  <small>{t('creatorBenefits.customRatioHint')}</small>
                </div>
                <div className={styles.ratioItem}>
                  <span>{t('creatorBenefits.freeCreation')}</span>
                  <strong>{summary.freeTxtCreation ? t('creatorBenefits.enabled') : t('creatorBenefits.disabled')}</strong>
                  <small>{t('creatorBenefits.freeCreationHint')}</small>
                </div>
              </div>
            </section>

            {!summary.isSpecialAuthor && summary.nextLevelPv ? (
              <section className={styles.progressSection} aria-labelledby="creator-benefit-progress">
                <div className={styles.progressCopy}>
                  <div>
                    <h2 id="creator-benefit-progress">{t('creatorBenefits.nextLevel', { level: summary.nextLevel })}</h2>
                    <p>{t('creatorBenefits.progressHint', { current: formatNumber(summary.totalPv), target: formatNumber(summary.nextLevelPv) })}</p>
                  </div>
                  <strong>{summary.progressPercent}%</strong>
                </div>
                <progress max={100} value={summary.progressPercent} aria-label={t('creatorBenefits.progressLabel')} />
              </section>
            ) : null}

            <section className={styles.worksSection}>
              <div className={styles.sectionHeading}>
                <h2>{t('creatorBenefits.includedWorks')}</h2>
                <p>{t('creatorBenefits.includedWorksHint')}</p>
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

            <section className={styles.worksSection}>
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
                  {renderWorkRows(works.excluded)}
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
      </main>
      {isBenefitGuideOpen ? (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBenefitGuide();
          }}
        >
          <div
            className={styles.benefitModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-benefit-guide-title"
            aria-describedby="creator-benefit-guide-description"
          >
            <header className={styles.modalHeader}>
              <div>
                <h2 id="creator-benefit-guide-title">{t('creatorBenefits.guideTitle')}</h2>
                <p id="creator-benefit-guide-description">{t('creatorBenefits.guideDescription')}</p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeBenefitGuide}
                aria-label={t('creatorBenefits.guideClose')}
                title={t('creatorBenefits.guideClose')}
                autoFocus
              >
                <IoClose aria-hidden="true" />
              </button>
            </header>
            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('creatorBenefits.guideLevel')}</th>
                    {CREATOR_BENEFIT_LEVELS.map((item) => (
                      <th key={item.levelKey} scope="col">{t(`creatorBenefits.${item.levelKey}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t('creatorBenefits.guideUpgradeCondition')}</th>
                    {CREATOR_BENEFIT_LEVELS.map((item) => (
                      <td key={item.levelKey}>
                        {item.threshold === 0
                          ? t('creatorBenefits.guideInitial')
                          : item.threshold === null
                            ? t('creatorBenefits.guideNotApplicable')
                            : t('creatorBenefits.guidePlayThreshold', { count: formatNumber(item.threshold) })}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">{t('creatorBenefits.guideEditorRatio')}</th>
                    {CREATOR_BENEFIT_LEVELS.map((item) => <td key={item.levelKey}>{item.editorRatio}</td>)}
                  </tr>
                  <tr>
                    <th scope="row">{t('creatorBenefits.guideCustomRatio')}</th>
                    {CREATOR_BENEFIT_LEVELS.map((item) => <td key={item.levelKey}>{item.customRatio}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.modalNote}>{t('creatorBenefits.guideSpecialNote')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CreatorBenefits;
