import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../utils/error';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import promotionApi from '../api/promotion/promotionApi';
import type { PromotionActivity, PromotionReviewStatus, PromotionSubmission } from '../api/promotion/promotion.type';
import styles from './PromotionCenter.module.css';
import { getImageUrl } from '../utils/constants';
import { resolveGameCoverUrl } from '../utils/displayCoverUrl';
import {
    findPromotionActivityByHash,
    getPromotionActivityAnchorId,
    openConfiguredLink,
    resolvePromotionAdLink,
} from '../utils/promotionNavigation';
import { useExternalLinkCopyModal } from '../hooks/useExternalLinkCopyModal';
import { useTranslation } from 'react-i18next';

/** 功能注释：活动中心 Tab 图标对齐效果图（热门火焰 / 我的投稿文档） */
const HOME_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/home`;
const ICON_HOT = `${HOME_ICON_BASE}/icon_hot.webp`;
const ICON_MY_SUBMISSIONS = `${HOME_ICON_BASE}/icon_my_submissions.webp`;

type PromotionTab = 'activities' | 'submissions';
type PromotionActivityStatusTone = 'active' | 'warning' | 'ended';
type SubmissionDraftPayload = {
    texts: string[];
    links: string[];
    images: File[];
    videos: File[];
};
type PromotionActivityStatusBadge = {
    label: string;
    tone: PromotionActivityStatusTone;
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const statusLabelMap = (t: TranslateFn): Record<PromotionReviewStatus, string> => ({
    pending_review: t('promotion.pendingReview'),
    approved: t('promotion.approved'),
    rejected: t('promotion.rejected'),
    reward_pending: t('promotion.rewardPending'),
    reward_issued: t('promotion.rewardIssued'),
});

const statusClassMap: Record<PromotionReviewStatus, string> = {
    pending_review: styles.statusPending,
    approved: styles.statusApproved,
    rejected: styles.statusRejected,
    reward_pending: styles.statusPending,
    reward_issued: styles.statusApproved,
};

const activityStatusClassMap: Record<PromotionActivityStatusTone, string> = {
    active: styles.activityStatusActive,
    warning: styles.activityStatusWarning,
    ended: styles.activityStatusEnded,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatTime = (value?: string | null, t?: TranslateFn) => {
    if (!value) return t ? t('promotion.unrecorded') : '未记录';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const buildTimeSummary = (activity: PromotionActivity, t: TranslateFn) => {
    if (activity.isLongTerm) return t('promotion.longTermActivity');
    return `${formatTime(activity.startAt, t)} - ${formatTime(activity.endAt, t)}`;
};

const buildLimitSummary = (activity: PromotionActivity, t: TranslateFn) => {
    if (activity.submissionLimitType === 'rolling_window') {
        return t('promotion.everyNDaysLimitedN', { days: activity.submissionLimitDays, count: activity.submissionLimitCount });
    }
    return t('promotion.unlimitedDuringActivity');
};

const normalizeSubmissionConfig = (activity: PromotionActivity): PromotionActivity => {
    const acceptTexts = Boolean(activity.submissionConfig?.acceptTexts);
    const acceptLinks = Boolean(activity.submissionConfig?.acceptLinks);
    const acceptImages = Boolean(activity.submissionConfig?.acceptImages);
    const acceptVideos = Boolean(activity.submissionConfig?.acceptVideos);

    return {
        ...activity,
        submissionConfig: {
            acceptTexts,
            acceptLinks,
            acceptImages,
            acceptVideos,
            requireTexts: acceptTexts && Boolean(activity.submissionConfig?.requireTexts),
            requireLinks: acceptLinks && Boolean(activity.submissionConfig?.requireLinks),
            requireImages: acceptImages && Boolean(activity.submissionConfig?.requireImages),
            requireVideos: acceptVideos && Boolean(activity.submissionConfig?.requireVideos),
        },
    };
};

const getMissingRequiredSubmissionItems = (activity: PromotionActivity, payload: SubmissionDraftPayload, t: TranslateFn) => {
    const missingItems: string[] = [];

    if (activity.submissionConfig.requireTexts && payload.texts.length === 0) missingItems.push(t('promotion.text'));
    if (activity.submissionConfig.requireLinks && payload.links.length === 0) missingItems.push(t('promotion.link'));
    if (activity.submissionConfig.requireImages && payload.images.length === 0) missingItems.push(t('promotion.image'));
    if (activity.submissionConfig.requireVideos && payload.videos.length === 0) missingItems.push(t('promotion.video'));

    return missingItems;
};

const hasAnyAcceptedSubmissionContent = (activity: PromotionActivity, payload: SubmissionDraftPayload) => (
    (activity.submissionConfig.acceptTexts && payload.texts.length > 0)
    || (activity.submissionConfig.acceptLinks && payload.links.length > 0)
    || (activity.submissionConfig.acceptImages && payload.images.length > 0)
    || (activity.submissionConfig.acceptVideos && payload.videos.length > 0)
);

const getSubmissionLimitSummary = (activity: PromotionActivity, t: TranslateFn) => {
    if (activity.submissionLimitType === 'once_per_activity') {
        return t('promotion.oncePerActivity');
    }
    if (activity.submissionLimitType === 'rolling_window') {
        return t('promotion.everyNDaysLimitedN', { days: activity.submissionLimitDays, count: activity.submissionLimitCount });
    }
    return t('promotion.unlimitedDuringActivity');
};
void buildLimitSummary;

const getImportableGameId = (game: UserGameData) => String(game.file_id || game.id || '').trim();

const getActivitySubmissionAvailability = (
    activity: PromotionActivity,
    mySubmissions: PromotionSubmission[],
    t: TranslateFn,
): Pick<PromotionActivity, 'canSubmit' | 'availabilityText'> => {
    if (activity.canSubmit === false) {
        return {
            canSubmit: false,
            availabilityText: activity.availabilityText || t('promotion.currentActivityNotSubmittable'),
        };
    }

    const activitySubmissions = mySubmissions.filter((submission) => submission.activityId === activity.id);

    if (activity.submissionLimitType === 'once_per_activity' && activitySubmissions.length > 0) {
        return {
            canSubmit: false,
            availabilityText: t('promotion.eachAccountCanOnlySubmitOnce'),
        };
    }

    if (activity.submissionLimitType === 'rolling_window') {
        const limitDays = Number(activity.submissionLimitDays || 0);
        const limitCount = Number(activity.submissionLimitCount || 0);

        if (limitDays > 0 && limitCount > 0) {
            const submittedAfter = Date.now() - limitDays * DAY_IN_MS;
            const submissionCountInWindow = activitySubmissions.filter((submission) => {
                if (!submission.submittedAt) {
                    return false;
                }

                const submittedAt = new Date(submission.submittedAt).getTime();
                return !Number.isNaN(submittedAt) && submittedAt >= submittedAfter;
            }).length;

            if (submissionCountInWindow >= limitCount) {
                return {
                    canSubmit: false,
                    availabilityText: t('promotion.eachAccountCanOnlySubmitN', { days: activity.submissionLimitDays, count: activity.submissionLimitCount }),
                };
            }
        }
    }

    return {
        canSubmit: true,
        availabilityText: activity.availabilityText || '',
    };
};

const hydrateActivitySubmissionAvailability = (
    activityList: PromotionActivity[],
    mySubmissions: PromotionSubmission[],
    t: TranslateFn,
): PromotionActivity[] => activityList.map((activity) => ({
    ...activity,
    ...getActivitySubmissionAvailability(activity, mySubmissions, t),
}));

const buildPromotionStatusBadge = (activity: PromotionActivity, t: TranslateFn): PromotionActivityStatusBadge | null => {
    if (activity.canSubmit === false) {
        return activity.availabilityText === '活动已结束'
            ? { label: t('promotion.activityEnded'), tone: 'ended' }
            : null;
    }

    if (activity.isLongTerm) {
        return { label: t('promotion.activityInProgress'), tone: 'active' };
    }

    if (!activity.endAt) {
        return null;
    }

    const endTime = new Date(activity.endAt).getTime();
    if (Number.isNaN(endTime)) {
        return null;
    }

    const remainingDays = Math.max(1, Math.ceil((endTime - Date.now()) / DAY_IN_MS));
    return remainingDays > 0
        ? { label: t('promotion.activityDaysLeft', { days: remainingDays }), tone: 'warning' }
        : null;
};

const PromotionCenter: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { requestCopy, modal: externalLinkCopyModal } = useExternalLinkCopyModal();
    const [searchParams] = useSearchParams();
    const buildLimitSummary = getSubmissionLimitSummary;
    const [activeTab, setActiveTab] = useState<PromotionTab>('activities');
    const [activities, setActivities] = useState<PromotionActivity[]>([]);
    const [submissions, setSubmissions] = useState<PromotionSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<PromotionActivity | null>(null);
    const [textInput, setTextInput] = useState('');
    const [linkInputs, setLinkInputs] = useState(['']);
    const [imageFiles, setImageFiles] = useState<FileList | null>(null);
    const [videoFiles, setVideoFiles] = useState<FileList | null>(null);
    const imageFileInputRef = useRef<HTMLInputElement>(null);
    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const [publishedGames, setPublishedGames] = useState<UserGameData[]>([]);
    const [hasLoadedPublishedGames, setHasLoadedPublishedGames] = useState(false);
    const [isLoadingPublishedGames, setIsLoadingPublishedGames] = useState(false);
    const [isGameImportOpen, setIsGameImportOpen] = useState(false);
    const [highlightedSubmissionId, setHighlightedSubmissionId] = useState<number | null>(null);
    const [highlightedActivityId, setHighlightedActivityId] = useState<number | null>(null);
    const submissionCardRefs = useRef<Record<number, HTMLElement | null>>({});
    const activityCardRefs = useRef<Record<number, HTMLElement | null>>({});
    const focusedSubmissionIdRef = useRef<number | null>(null);
    const focusedActivityIdRef = useRef<number | null>(null);
    const missingSubmissionNoticeRef = useRef<number | null>(null);

    const requestedTab = searchParams.get('tab');
    const requestedSubmissionId = useMemo(() => {
        const rawValue = Number(searchParams.get('submissionId') || 0);
        return Number.isInteger(rawValue) && rawValue > 0 ? rawValue : null;
    }, [searchParams]);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [activityResponse, submissionResponse] = await Promise.all([
                promotionApi.list(),
                promotionApi.mySubmissions(),
            ]);

            const nextSubmissions = submissionResponse.data.data || [];
            const nextActivities = hydrateActivitySubmissionAvailability(
                (activityResponse.data.data || []).map(normalizeSubmissionConfig),
                nextSubmissions,
                t,
            );

            setActivities(nextActivities);
            setSubmissions(nextSubmissions);
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('promotion.publishDataLoadFailed')));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (requestedTab === 'submissions') {
            setActiveTab('submissions');
            return;
        }

        if (requestedTab === 'activities' || location.hash) {
            setActiveTab('activities');
        }
    }, [location.hash, requestedTab]);

    useEffect(() => {
        if (!requestedSubmissionId || activeTab !== 'submissions' || isLoading) {
            return;
        }

        const targetSubmission = submissions.find((submission) => submission.id === requestedSubmissionId);
        if (!targetSubmission) {
            if (missingSubmissionNoticeRef.current !== requestedSubmissionId) {
                missingSubmissionNoticeRef.current = requestedSubmissionId;
                toast.error(t('promotion.submissionNotFound'));
            }
            setHighlightedSubmissionId(null);
            focusedSubmissionIdRef.current = null;
            return;
        }

        missingSubmissionNoticeRef.current = null;
        setHighlightedSubmissionId(requestedSubmissionId);

        const cardElement = submissionCardRefs.current[requestedSubmissionId];
        if (cardElement && focusedSubmissionIdRef.current !== requestedSubmissionId) {
            focusedSubmissionIdRef.current = requestedSubmissionId;

            window.requestAnimationFrame(() => {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        const timer = window.setTimeout(() => {
            setHighlightedSubmissionId((current) => (current === requestedSubmissionId ? null : current));
        }, 2600);

        return () => window.clearTimeout(timer);
    }, [activeTab, isLoading, requestedSubmissionId, submissions, t]);

    useEffect(() => {
        if (isLoading || activeTab !== 'activities') {
            return;
        }

        const targetActivity = findPromotionActivityByHash(activities, location.hash);
        if (!targetActivity) {
            setHighlightedActivityId(null);
            focusedActivityIdRef.current = null;
            return;
        }

        setHighlightedActivityId(targetActivity.id);

        const cardElement = activityCardRefs.current[targetActivity.id];
        if (cardElement && focusedActivityIdRef.current !== targetActivity.id) {
            focusedActivityIdRef.current = targetActivity.id;

            window.requestAnimationFrame(() => {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        const timer = window.setTimeout(() => {
            setHighlightedActivityId((current) => (current === targetActivity.id ? null : current));
        }, 2600);

        return () => window.clearTimeout(timer);
    }, [activeTab, activities, isLoading, location.hash]);

    const navigateConfiguredLink = useCallback((url: string) => {
        openConfiguredLink(url, {
            navigate,
            onExternalLinkCopy: requestCopy,
        });
    }, [navigate, requestCopy]);

    const submissionCount = submissions.length;

    const resolveActivitySubmissionState = useCallback((activity: PromotionActivity) => {
        const latestActivity = activities.find((item) => item.id === activity.id) || activity;
        return {
            ...latestActivity,
            ...getActivitySubmissionAvailability(latestActivity, submissions, t),
        };
    }, [activities, submissions, t]);

    const resetSubmitState = () => {
        setSelectedActivity(null);
        setTextInput('');
        setLinkInputs(['']);
        setImageFiles(null);
        setVideoFiles(null);
        setIsGameImportOpen(false);
        if (imageFileInputRef.current) imageFileInputRef.current.value = '';
        if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    };

    const handleStartSubmission = useCallback((activity: PromotionActivity) => {
        const nextActivity = resolveActivitySubmissionState(activity);
        if (nextActivity.canSubmit === false) {
            toast.error(nextActivity.availabilityText || t('promotion.activityNotSubmittableFallback'));
            return;
        }

        setSelectedActivity(nextActivity);
    }, [resolveActivitySubmissionState, t]);

    const openDetail = (activity: PromotionActivity) => {
        const detailLinkUrl = activity.detailLinkUrl.trim();

        if (!detailLinkUrl) {
            toast.error(t('promotion.activityNotConfigured'));
            return;
        }

        navigateConfiguredLink(detailLinkUrl);
    };

    const openPromotionAd = (activity: PromotionActivity) => {
        const targetLink = resolvePromotionAdLink(activity);

        if (!targetLink) {
            toast.error(t('promotion.activityNotConfigured'));
            return;
        }

        navigateConfiguredLink(targetLink);
    };

    const loadPublishedGames = useCallback(async () => {
        try {
            setIsLoadingPublishedGames(true);
            const response = await getGameDataApi.getUserData({ limit: 500 });
            if (!response.data.success) {
                throw new Error(t('promotion.myGamesLoadFailed'));
            }

            const gameList = response.data.data || [];

            setPublishedGames(gameList.filter((game) => game.is_public === 1 && Boolean(getImportableGameId(game))));
            setHasLoadedPublishedGames(true);
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('promotion.myGamesLoadFailed')));
            setPublishedGames([]);
        } finally {
            setIsLoadingPublishedGames(false);
        }
    }, [t]);

    const handleToggleGameImport = useCallback(async () => {
        const nextOpen = !isGameImportOpen;
        setIsGameImportOpen(nextOpen);

        if (nextOpen && !hasLoadedPublishedGames && !isLoadingPublishedGames) {
            await loadPublishedGames();
        }
    }, [hasLoadedPublishedGames, isGameImportOpen, isLoadingPublishedGames, loadPublishedGames]);

    const handleLinkInputChange = (index: number, value: string) => {
        setLinkInputs((prev) => {
            const nextInputs = [...prev];
            nextInputs[index] = value;
            return nextInputs;
        });
    };

    const handleRemoveLinkInput = (index: number) => {
        setLinkInputs((prev) => {
            const nextInputs = prev.filter((_, inputIndex) => inputIndex !== index);
            return nextInputs.length > 0 ? nextInputs : [''];
        });
    };

    const handleImportGameLink = (game: UserGameData) => {
        const fileId = getImportableGameId(game);
        if (!fileId) {
            return;
        }

        const importedLink = `${window.location.origin}/funloom/game/${encodeURIComponent(fileId)}`;

        setLinkInputs((prev) => {
            const firstEmptyIndex = prev.findIndex((item) => item.trim().length === 0);
            if (firstEmptyIndex >= 0) {
                const nextInputs = [...prev];
                nextInputs[firstEmptyIndex] = importedLink;
                return nextInputs;
            }
            return [...prev, importedLink];
        });
        setIsGameImportOpen(false);
    };

    const handleSubmit = async () => {
        if (!selectedActivity) return;
        const currentActivity = resolveActivitySubmissionState(selectedActivity);

        if (currentActivity.canSubmit === false) {
            setSelectedActivity(currentActivity);
            toast.error(currentActivity.availabilityText || t('promotion.activityNotSubmittableFallback'));
            return;
        }

        const formData = new FormData();
        const trimmedText = textInput.trim();
        const trimmedLinks = linkInputs.map((item) => item.trim()).filter(Boolean);
        const submissionPayload: SubmissionDraftPayload = {
            texts: trimmedText ? [trimmedText] : [],
            links: trimmedLinks,
            images: Array.from(imageFiles || []),
            videos: Array.from(videoFiles || []),
        };
        const missingRequiredItems = getMissingRequiredSubmissionItems(currentActivity, submissionPayload, t);

        if (missingRequiredItems.length > 0) {
            toast.error(t('promotion.missingRequiredContent') + missingRequiredItems.join('、'));
            return;
        }

        if (!hasAnyAcceptedSubmissionContent(currentActivity, submissionPayload)) {
            toast.error(t('promotion.submitAtLeastOne'));
            return;
        }

        submissionPayload.texts.forEach((item) => formData.append('texts', item));
        submissionPayload.links.forEach((item) => formData.append('links', item));
        submissionPayload.images.forEach((file) => formData.append('images', file));
        submissionPayload.videos.forEach((file) => formData.append('videos', file));

        try {
            setIsSubmitting(true);
            await promotionApi.submit(currentActivity.id, formData);
            toast.success(t('promotion.submissionSuccess'));
            resetSubmitState();
            await loadData();
            setActiveTab('submissions');
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('promotion.submissionFailed')));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.pageBody}>
                <div className={styles.headerRow}>
                    <button type="button" className={styles.backButton} onClick={() => window.history.back()}>
                        <span>←</span>
                        <span>{t('promotion.back')}</span>
                    </button>
                    <div className={styles.heroCard}>
                        <h2 className={styles.heroText}>{t('promotion.heroText')}</h2>
                    </div>
                </div>

                <div className={styles.tabRow}>
                    <button
                        type="button"
                        className={`${styles.tabButton} ${activeTab === 'activities' ? styles.tabButtonActive : ''}`}
                        onClick={() => setActiveTab('activities')}
                    >
                        <img src={ICON_HOT} alt="" className={styles.tabIcon} />
                        {t('promotion.publishedActivities')}({activities.length})
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabButton} ${activeTab === 'submissions' ? styles.tabButtonActive : ''}`}
                        onClick={() => setActiveTab('submissions')}
                    >
                        <img src={ICON_MY_SUBMISSIONS} alt="" className={styles.tabIcon} />
                        {t('promotion.mySubmissions')}({submissionCount})
                    </button>
                </div>

                <div className={styles.content}>
                    {isLoading ? (
                        <div className={styles.emptyState}>{t('promotion.loadingPromotionData')}</div>
                    ) : activeTab === 'activities' ? (
                        activities.length === 0 ? (
                            <div className={styles.emptyState}>{t('promotion.noPublishedActivities')}</div>
                        ) : (
                            <div className={styles.activityGrid}>
                                {activities.map((activity) => {
                                    const statusBadge = buildPromotionStatusBadge(activity, t);

                                    return (
                                        <article
                                            key={activity.id}
                                            id={getPromotionActivityAnchorId(activity.title)}
                                            ref={(element) => {
                                                activityCardRefs.current[activity.id] = element;
                                            }}
                                            className={`${styles.card} ${highlightedActivityId === activity.id ? styles.cardHighlighted : ''}`}
                                        >
                                            <div
                                                className={`${styles.imageGuard} ${styles.imageGuardLight} ${resolvePromotionAdLink(activity) ? styles.clickableCover : ''}`}
                                                onClick={() => {
                                                    if (!resolvePromotionAdLink(activity)) {
                                                        return;
                                                    }
                                                    openPromotionAd(activity);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key !== 'Enter' && event.key !== ' ') {
                                                        return;
                                                    }
                                                    if (!resolvePromotionAdLink(activity)) {
                                                        return;
                                                    }
                                                    event.preventDefault();
                                                    openPromotionAd(activity);
                                                }}
                                                role={resolvePromotionAdLink(activity) ? 'button' : undefined}
                                                tabIndex={resolvePromotionAdLink(activity) ? 0 : undefined}
                                            >
                                                <img className={styles.cover} src={getImageUrl(activity.coverImageUrl)} alt={activity.title} />
                                            </div>
                                            <div className={styles.cardBody}>
                                                <div className={styles.cardTitleRow}>
                                                    <div className={styles.cardTitle}>{activity.title}</div>
                                                    {statusBadge ? (
                                                        <span className={`${styles.activityStatusTag} ${activityStatusClassMap[statusBadge.tone]}`}>
                                                            {statusBadge.label}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className={styles.cardSummary}>{activity.summary}</div>
                                                <div className={styles.infoGrid}>
                                                    <div className={styles.infoItem}>{t('promotion.activityTime')}{buildTimeSummary(activity, t)}</div>
                                                    <div className={styles.infoItem}>{t('promotion.submissionLimit')}{buildLimitSummary(activity, t)}</div>
                                                    <div className={styles.infoItem}>{t('promotion.rewardPoints')}{t('promotion.rewardPointsAfterApproval', { points: activity.rewardPoints })}</div>
                                                </div>
                                                <div className={styles.configRow}>
                                                    {activity.submissionConfig.acceptTexts && <span className={styles.chip}>{t('promotion.textSubmission')}</span>}
                                                    {activity.submissionConfig.acceptLinks && <span className={styles.chip}>{t('promotion.linkSubmission')}</span>}
                                                    {activity.submissionConfig.acceptImages && <span className={styles.chip}>{t('promotion.imageSubmission')}</span>}
                                                    {activity.submissionConfig.acceptVideos && <span className={styles.chip}>{t('promotion.videoSubmission')}</span>}
                                                </div>
                                                {activity.availabilityText ? (
                                                    <div className={styles.noticeText}>{activity.availabilityText}</div>
                                                ) : null}
                                                <div className={styles.actionRow}>
                                                    {activity.detailLinkUrl.trim() ? (
                                                        <button type="button" className={styles.secondaryButton} onClick={() => openDetail(activity)}>
                                                        {t('promotion.activityDetails')}
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className={`${styles.primaryButton} ${activity.canSubmit === false ? styles.disabledButton : ''}`}
                                                        onClick={() => handleStartSubmission(activity)}
                                                        aria-disabled={activity.canSubmit === false}
                                                    >
                                                        {t('promotion.submitNow')}
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )
                    ) : submissions.length === 0 ? (
                        <div className={styles.emptyState}>{t('promotion.noSubmissions')}</div>
                    ) : (
                        <div className={styles.submissionList}>
                            {submissions.map((submission) => (
                                <article
                                    key={submission.id}
                                    ref={(element) => {
                                        submissionCardRefs.current[submission.id] = element;
                                    }}
                                    className={`${styles.submissionCard} ${highlightedSubmissionId === submission.id ? styles.submissionCardSelected : ''}`}
                                >
                                    <div className={styles.submissionHeader}>
                                        <div>
                                            <div className={styles.submissionTitle}>{submission.activityTitle || `#${submission.activityId}`}</div>
                                            <div className={styles.metaRow}>
                                                <span className={`${styles.statusTag} ${statusClassMap[submission.reviewStatus]}`}>{statusLabelMap(t)[submission.reviewStatus]}</span>
                                                <span className={styles.chip}>{t('promotion.submissionTime')} {formatTime(submission.submittedAt, t)}</span>
                                                {typeof submission.rewardPoints === 'number' ? <span className={styles.chip}>{t('promotion.rewardPoints')} {submission.rewardPoints}</span> : null}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.submissionMeta}>
                                        {submission.submitPayload.texts.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>{t('promotion.submissionText')}</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.texts.map((item, index) => (
                                                        <div key={`${submission.id}-text-${index}`} className={styles.payloadItem}>{item}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.submitPayload.links.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>{t('promotion.submissionLinks')}</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.links.map((item) => (
                                                        <a key={item} className={styles.payloadItem} href={item} target="_blank" rel="noreferrer">{item}</a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.submitPayload.images.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>{t('promotion.submissionImages')}</div>
                                                <div className={styles.payloadImageList}>
                                                    {submission.submitPayload.images.map((item) => (
                                                        <div key={item} className={styles.payloadImageWrap}>
                                                        <img className={styles.payloadImage} src={getImageUrl(item)} alt={t('promotion.submissionImages')} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.submitPayload.videos.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>{t('promotion.submissionVideos')}</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.videos.map((item) => (
                                                        <a key={item} className={styles.videoLink} href={getImageUrl(item)} target="_blank" rel="noreferrer">
                                                            {t('promotion.viewVideoMaterial')}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.reviewRemark ? <div className={styles.payloadItem}>{t('promotion.reviewRemark')} {submission.reviewRemark}</div> : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedActivity ? (
                <div className={styles.modalOverlay} onClick={resetSubmitState}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <h2 className={styles.modalTitle}>{t('promotion.submitActivity', { title: selectedActivity.title })}</h2>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>{t('promotion.activityTime')}{buildTimeSummary(selectedActivity, t)}</div>
                            <div className={styles.infoItem}>{t('promotion.submissionLimit')}{buildLimitSummary(selectedActivity, t)}</div>
                            <div className={styles.infoItem}>{t('promotion.rewardPoints')}{t('promotion.rewardPointsAfterApproval', { points: selectedActivity.rewardPoints })}</div>
                        </div>
                        {selectedActivity.availabilityText ? (
                            <div className={styles.noticeText}>{selectedActivity.availabilityText}</div>
                        ) : null}
                        <div className={styles.formGrid}>
                            {selectedActivity.submissionConfig.acceptTexts ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireTexts ? styles.decoratedFieldLabelRequired : ''}`}
                                >
                                    {t('promotion.textSubmission')}
                                    <textarea
                                        className={styles.textarea}
                                        value={textInput}
                                        placeholder={t('promotion.enterPromotionText')}
                                        onChange={(event) => setTextInput(event.target.value)}
                                    />
                                </label>
                            ) : null}
                            {selectedActivity.submissionConfig.acceptLinks ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireLinks ? styles.decoratedFieldLabelRequired : ''}`}
                                >
                                    {t('promotion.linkSubmission')}
                                    <div className={styles.linkFieldGroup}>
                                        {linkInputs.map((value, index) => (
                                            <div key={`link-${index}`} className={styles.linkInputRow}>
                                                <input
                                                    className={styles.input}
                                                    value={value}
                                                    placeholder={t('promotion.enterPromotionLink')}
                                                    onChange={(event) => handleLinkInputChange(index, event.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.linkRemoveButton}
                                                    onClick={() => handleRemoveLinkInput(index)}
                                                >
                                                    {t('promotion.remove')}
                                                </button>
                                            </div>
                                        ))}
                                        <div className={styles.inlineActionRow}>
                                            <button type="button" className={styles.secondaryButton} onClick={() => setLinkInputs((prev) => [...prev, ''])}>
                                                {t('promotion.addLink')}
                                            </button>
                                            <button type="button" className={styles.secondaryButton} onClick={() => void handleToggleGameImport()}>
                                                {t('promotion.importFromMyGames')}
                                            </button>
                                        </div>
                                        {isGameImportOpen ? (
                                            <div className={styles.importPanel}>
                                                <div className={styles.importTitle}>{t('promotion.selectPublishedGames')}</div>
                                                {isLoadingPublishedGames ? (
                                                    <div className={styles.importState}>{t('promotion.loadingMyGames')}</div>
                                                ) : publishedGames.length === 0 ? (
                                                    <div className={styles.importState}>{t('promotion.noPublishedActivitiesToImport')}</div>
                                                ) : (
                                                    <div className={styles.importGameList}>
                                                        {publishedGames.map((game) => {
                                                            const gameId = getImportableGameId(game);
                                                            const coverPath = resolveGameCoverUrl({
                                                                display_cover_url: game.display_cover_url,
                                                                cover_url: game.cover_url,
                                                            });
                                                            const coverUrl = coverPath ? getImageUrl(coverPath) : '';

                                                            return (
                                                                <button
                                                                    key={gameId}
                                                                    type="button"
                                                                    className={styles.importGameItem}
                                                                    onClick={() => handleImportGameLink(game)}
                                                                >
                                                                    <img
                                                                        className={styles.importGameCover}
                                                                        src={coverUrl || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                                                        alt={game.title || gameId}
                                                                    />
                                                                    <div className={styles.importGameInfo}>
                                                                        <div className={styles.importGameName}>{game.title || t('promotion.untitledGame')}</div>
                                                                        <div className={styles.importGameMeta}>{gameId}</div>
                                                                    </div>
                                                                    <span className={styles.importGameAction}>{t('promotion.importLink')}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </label>
                            ) : null}
                            {selectedActivity.submissionConfig.acceptImages ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireImages ? styles.decoratedFieldLabelRequired : ''}`}
                                >
                                    {t('promotion.imageSubmission')}
                                    <input
                                        ref={imageFileInputRef}
                                        className={styles.input}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={(event) => setImageFiles(event.target.files)}
                                    />
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => imageFileInputRef.current?.click()}
                                    >
                                        {t('promotion.selectImageFile')}
                                    </button>
                                    {imageFiles && imageFiles.length > 0 && (
                                        <span className={styles.fileSelectedHint}>
                                            {t('promotion.filesSelected', { count: imageFiles.length })}
                                        </span>
                                    )}
                                </label>
                            ) : null}
                            {selectedActivity.submissionConfig.acceptVideos ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireVideos ? styles.decoratedFieldLabelRequired : ''}`}
                                >
                                    {t('promotion.videoSubmission')}
                                    <input
                                        ref={videoFileInputRef}
                                        className={styles.input}
                                        type="file"
                                        accept="video/*"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={(event) => setVideoFiles(event.target.files)}
                                    />
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => videoFileInputRef.current?.click()}
                                    >
                                        {t('promotion.selectVideoFile')}
                                    </button>
                                    {videoFiles && videoFiles.length > 0 && (
                                        <span className={styles.fileSelectedHint}>
                                            {t('promotion.filesSelected', { count: videoFiles.length })}
                                        </span>
                                    )}
                                </label>
                            ) : null}
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={resetSubmitState}>{t('promotion.cancel')}</button>
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => void handleSubmit()}
                                disabled={isSubmitting || selectedActivity.canSubmit === false}
                            >
                                {isSubmitting ? t('promotion.submitting') : t('promotion.confirmSubmit')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <MobileBottomNav hidden />
            {externalLinkCopyModal}
        </div>
    );
};

export default PromotionCenter;
