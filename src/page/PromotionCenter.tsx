import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import promotionApi from '../api/promotion/promotionApi';
import type { PromotionActivity, PromotionReviewStatus, PromotionSubmission } from '../api/promotion/promotion.type';
import styles from './PromotionCenter.module.css';
import { getImageUrl } from '../utils/constants';

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

const statusLabelMap: Record<PromotionReviewStatus, string> = {
    pending_review: '待审核',
    approved: '审核通过',
    rejected: '审核驳回',
    reward_pending: '奖励待下发',
    reward_issued: '奖励已发放',
};

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

const formatTime = (value?: string | null) => {
    if (!value) return '未记录';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string; error?: string } } };
        return response.response?.data?.message || response.response?.data?.error || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const buildTimeSummary = (activity: PromotionActivity) => {
    if (activity.isLongTerm) return '长期活动';
    return `${formatTime(activity.startAt)} - ${formatTime(activity.endAt)}`;
};

const buildLimitSummary = (activity: PromotionActivity) => {
    if (activity.submissionLimitType === 'rolling_window') {
        return `每 ${activity.submissionLimitDays} 天限 ${activity.submissionLimitCount} 次`;
    }
    return '活动期内无限次';
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

const getMissingRequiredSubmissionItems = (activity: PromotionActivity, payload: SubmissionDraftPayload) => {
    const missingItems: string[] = [];

    if (activity.submissionConfig.requireTexts && payload.texts.length === 0) missingItems.push('文本');
    if (activity.submissionConfig.requireLinks && payload.links.length === 0) missingItems.push('链接');
    if (activity.submissionConfig.requireImages && payload.images.length === 0) missingItems.push('图片');
    if (activity.submissionConfig.requireVideos && payload.videos.length === 0) missingItems.push('视频');

    return missingItems;
};

const hasAnyAcceptedSubmissionContent = (activity: PromotionActivity, payload: SubmissionDraftPayload) => (
    (activity.submissionConfig.acceptTexts && payload.texts.length > 0)
    || (activity.submissionConfig.acceptLinks && payload.links.length > 0)
    || (activity.submissionConfig.acceptImages && payload.images.length > 0)
    || (activity.submissionConfig.acceptVideos && payload.videos.length > 0)
);

const getImportableGameId = (game: UserGameData) => String(game.file_id || game.id || '').trim();

const buildPromotionStatusBadge = (activity: PromotionActivity): PromotionActivityStatusBadge | null => {
    // 实现 活动状态标识计算
    if (activity.canSubmit === false) {
        return activity.availabilityText === '活动已结束'
            ? { label: '已结束', tone: 'ended' }
            : null;
    }

    if (activity.isLongTerm) {
        return { label: '进行中', tone: 'active' };
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
        ? { label: `活动还有 ${remainingDays} 天`, tone: 'warning' }
        : null;
};

const PromotionCenter: React.FC = () => {
    const [searchParams] = useSearchParams();
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
    const [publishedGames, setPublishedGames] = useState<UserGameData[]>([]);
    const [hasLoadedPublishedGames, setHasLoadedPublishedGames] = useState(false);
    const [isLoadingPublishedGames, setIsLoadingPublishedGames] = useState(false);
    const [isGameImportOpen, setIsGameImportOpen] = useState(false);
    const [highlightedSubmissionId, setHighlightedSubmissionId] = useState<number | null>(null);
    const submissionCardRefs = useRef<Record<number, HTMLElement | null>>({});
    const focusedSubmissionIdRef = useRef<number | null>(null);
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

            setActivities((activityResponse.data.data || []).map(normalizeSubmissionConfig));
            setSubmissions(submissionResponse.data.data || []);
        } catch (error) {
            toast.error(getErrorMessage(error, '推广数据加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (requestedTab === 'submissions') {
            // 实现 消息跳转后自动切到我的投稿
            setActiveTab('submissions');
            return;
        }

        if (requestedTab === 'activities') {
            setActiveTab('activities');
        }
    }, [requestedTab]);

    useEffect(() => {
        if (!requestedSubmissionId || activeTab !== 'submissions' || isLoading) {
            return;
        }

        const targetSubmission = submissions.find((submission) => submission.id === requestedSubmissionId);
        if (!targetSubmission) {
            // 实现 投稿不存在时的单次提示
            if (missingSubmissionNoticeRef.current !== requestedSubmissionId) {
                missingSubmissionNoticeRef.current = requestedSubmissionId;
                toast.error('未找到对应投稿记录');
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

            // 实现 投稿卡片滚动定位
            window.requestAnimationFrame(() => {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        const timer = window.setTimeout(() => {
            setHighlightedSubmissionId((current) => (current === requestedSubmissionId ? null : current));
        }, 2600);

        return () => window.clearTimeout(timer);
    }, [activeTab, isLoading, requestedSubmissionId, submissions]);

    const submissionCount = submissions.length;

    const resetSubmitState = () => {
        setSelectedActivity(null);
        setTextInput('');
        setLinkInputs(['']);
        setImageFiles(null);
        setVideoFiles(null);
        setIsGameImportOpen(false);
    };

    const openDetail = (activity: PromotionActivity) => {
        if (!activity.detailLinkUrl) {
            toast.error('当前活动暂未配置详情地址');
            return;
        }

        if (activity.detailLinkUrl.startsWith('http://') || activity.detailLinkUrl.startsWith('https://')) {
            window.open(activity.detailLinkUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        const detailPath = activity.detailLinkUrl.startsWith('/') ? activity.detailLinkUrl : `/${activity.detailLinkUrl}`;
        window.location.href = `${window.location.origin}/funloom${detailPath}`;
    };

    const loadPublishedGames = useCallback(async () => {
        try {
            setIsLoadingPublishedGames(true);
            const response = await getGameDataApi.getUserData({ limit: 500 });
            if (!response.data.success) {
                throw new Error('我的作品加载失败');
            }

            const gameList = response.data.data || [];

            // 实现 已发布作品筛选
            setPublishedGames(gameList.filter((game) => game.is_public === 1 && Boolean(getImportableGameId(game))));
            setHasLoadedPublishedGames(true);
        } catch (error) {
            toast.error(getErrorMessage(error, '我的作品加载失败'));
            setPublishedGames([]);
        } finally {
            setIsLoadingPublishedGames(false);
        }
    }, []);

    const handleToggleGameImport = useCallback(async () => {
        const nextOpen = !isGameImportOpen;
        setIsGameImportOpen(nextOpen);

        if (nextOpen && !hasLoadedPublishedGames && !isLoadingPublishedGames) {
            // 实现 从我的作品中导入投稿链接
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
        // 实现 投稿链接移除
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

        // 实现 导入链接写入空白输入框
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
        if (selectedActivity.canSubmit === false) {
            toast.error(selectedActivity.availabilityText || '当前活动暂不可投稿');
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
        const missingRequiredItems = getMissingRequiredSubmissionItems(selectedActivity, submissionPayload);

        if (missingRequiredItems.length > 0) {
            toast.error(`缺少必填投稿内容：${missingRequiredItems.join('、')}`);
            return;
        }

        if (!hasAnyAcceptedSubmissionContent(selectedActivity, submissionPayload)) {
            toast.error('请至少提交一种推广内容');
            return;
        }

        // 实现 多类型投稿表单组装
        submissionPayload.texts.forEach((item) => formData.append('texts', item));
        submissionPayload.links.forEach((item) => formData.append('links', item));
        submissionPayload.images.forEach((file) => formData.append('images', file));
        submissionPayload.videos.forEach((file) => formData.append('videos', file));

        try {
            setIsSubmitting(true);
            await promotionApi.submit(selectedActivity.id, formData);
            toast.success('投稿成功');
            resetSubmitState();
            await loadData();
            setActiveTab('submissions');
        } catch (error) {
            toast.error(getErrorMessage(error, '投稿失败'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.pageBody}>
                <section className={styles.hero}>
                    <div>
                        <div className={styles.badge}>推广分享</div>
                        <h1 className={styles.title}>完成投稿后获取积分奖励</h1>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.chip}>已发布活动 {activities.length}</span>
                        <span className={styles.chip}>我的投稿 {submissionCount}</span>
                    </div>
                </section>

                <div className={styles.tabRow}>
                    <button
                        type="button"
                        className={`${styles.tabButton} ${activeTab === 'activities' ? styles.tabButtonActive : ''}`}
                        onClick={() => setActiveTab('activities')}
                    >
                        推广活动
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabButton} ${activeTab === 'submissions' ? styles.tabButtonActive : ''}`}
                        onClick={() => setActiveTab('submissions')}
                    >
                        我的投稿
                    </button>
                </div>

                <div className={styles.content}>
                    {isLoading ? (
                        <div className={styles.emptyState}>正在加载推广数据...</div>
                    ) : activeTab === 'activities' ? (
                        activities.length === 0 ? (
                            <div className={styles.emptyState}>当前还没有已发布的推广活动。</div>
                        ) : (
                            <div className={styles.activityGrid}>
                                {activities.map((activity) => {
                                    const statusBadge = buildPromotionStatusBadge(activity);

                                    return (
                                        <article key={activity.id} className={styles.card}>
                                            <img className={styles.cover} src={getImageUrl(activity.coverImageUrl)} alt={activity.title} />
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
                                                    <div className={styles.infoItem}>活动时间：{buildTimeSummary(activity)}</div>
                                                    <div className={styles.infoItem}>投稿限制：{buildLimitSummary(activity)}</div>
                                                    <div className={styles.infoItem}>奖励积分：审核通过后发放 {activity.rewardPoints} 积分</div>
                                                </div>
                                                <div className={styles.configRow}>
                                                    {activity.submissionConfig.acceptTexts && <span className={styles.chip}>文本投稿</span>}
                                                    {activity.submissionConfig.acceptLinks && <span className={styles.chip}>链接投稿</span>}
                                                    {activity.submissionConfig.acceptImages && <span className={styles.chip}>图片投稿</span>}
                                                    {activity.submissionConfig.acceptVideos && <span className={styles.chip}>视频投稿</span>}
                                                </div>
                                                {activity.availabilityText ? (
                                                    <div className={styles.noticeText}>{activity.availabilityText}</div>
                                                ) : null}
                                                <div className={styles.actionRow}>
                                                    <button type="button" className={styles.secondaryButton} onClick={() => openDetail(activity)}>
                                                        活动详情
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.primaryButton} ${activity.canSubmit === false ? styles.disabledButton : ''}`}
                                                        onClick={() => setSelectedActivity(activity)}
                                                        disabled={activity.canSubmit === false}
                                                    >
                                                        立即投稿
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )
                    ) : submissions.length === 0 ? (
                        <div className={styles.emptyState}>你还没有提交过推广内容，先去参加活动吧。</div>
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
                                            <div className={styles.submissionTitle}>{submission.activityTitle || `活动 #${submission.activityId}`}</div>
                                            <div className={styles.metaRow}>
                                                <span className={`${styles.statusTag} ${statusClassMap[submission.reviewStatus]}`}>{statusLabelMap[submission.reviewStatus]}</span>
                                                <span className={styles.chip}>投稿时间 {formatTime(submission.submittedAt)}</span>
                                                {typeof submission.rewardPoints === 'number' ? <span className={styles.chip}>奖励积分 {submission.rewardPoints}</span> : null}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.submissionMeta}>
                                        {submission.submitPayload.texts.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿文本</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.texts.map((item, index) => (
                                                        <div key={`${submission.id}-text-${index}`} className={styles.payloadItem}>{item}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.submitPayload.links.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿链接</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.links.map((item) => (
                                                        <a key={item} className={styles.payloadItem} href={item} target="_blank" rel="noreferrer">{item}</a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.submitPayload.images.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿图片</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.images.map((item) => (
                                                        <img key={item} className={styles.mediaPreview} src={getImageUrl(item)} alt="投稿图片" />
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.submitPayload.videos.length > 0 ? (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿视频</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.videos.map((item) => (
                                                        <a key={item} className={styles.videoLink} href={getImageUrl(item)} target="_blank" rel="noreferrer">
                                                            查看视频素材
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        {submission.reviewRemark ? <div className={styles.payloadItem}>审核备注：{submission.reviewRemark}</div> : null}
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
                        <h2 className={styles.modalTitle}>投稿到“{selectedActivity.title}”</h2>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>活动时间：{buildTimeSummary(selectedActivity)}</div>
                            <div className={styles.infoItem}>投稿限制：{buildLimitSummary(selectedActivity)}</div>
                            <div className={styles.infoItem}>奖励积分：审核通过后发放 {selectedActivity.rewardPoints} 积分</div>
                        </div>
                        {selectedActivity.availabilityText ? (
                            <div className={styles.noticeText}>{selectedActivity.availabilityText}</div>
                        ) : null}
                        <div className={styles.formGrid}>
                            {selectedActivity.submissionConfig.acceptTexts ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireTexts ? styles.decoratedFieldLabelRequired : ''}`}
                                    data-label="文本投稿"
                                >
                                    文本投稿
                                    <textarea
                                        className={styles.textarea}
                                        value={textInput}
                                        placeholder="请输入你的推广文本内容"
                                        onChange={(event) => setTextInput(event.target.value)}
                                    />
                                </label>
                            ) : null}
                            {selectedActivity.submissionConfig.acceptLinks ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireLinks ? styles.decoratedFieldLabelRequired : ''}`}
                                    data-label="链接投稿"
                                >
                                    链接投稿
                                    <div className={styles.linkFieldGroup}>
                                        {linkInputs.map((value, index) => (
                                            <div key={`link-${index}`} className={styles.linkInputRow}>
                                                <input
                                                    className={styles.input}
                                                    value={value}
                                                    placeholder="请输入你的推广链接"
                                                    onChange={(event) => handleLinkInputChange(index, event.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.linkRemoveButton}
                                                    onClick={() => handleRemoveLinkInput(index)}
                                                >
                                                    移除
                                                </button>
                                            </div>
                                        ))}
                                        <div className={styles.inlineActionRow}>
                                            <button type="button" className={styles.secondaryButton} onClick={() => setLinkInputs((prev) => [...prev, ''])}>
                                                新增链接
                                            </button>
                                            <button type="button" className={styles.secondaryButton} onClick={() => void handleToggleGameImport()}>
                                                从我的作品中导入
                                            </button>
                                        </div>
                                        {isGameImportOpen ? (
                                            <div className={styles.importPanel}>
                                                <div className={styles.importTitle}>选择已发布作品</div>
                                                {isLoadingPublishedGames ? (
                                                    <div className={styles.importState}>正在加载已发布作品...</div>
                                                ) : publishedGames.length === 0 ? (
                                                    <div className={styles.importState}>暂无已发布作品可导入</div>
                                                ) : (
                                                    <div className={styles.importGameList}>
                                                        {publishedGames.map((game) => {
                                                            const gameId = getImportableGameId(game);
                                                            const coverUrl = getImageUrl(game.display_cover_url || game.cover_url);

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
                                                                        <div className={styles.importGameName}>{game.title || '未命名作品'}</div>
                                                                        <div className={styles.importGameMeta}>{gameId}</div>
                                                                    </div>
                                                                    <span className={styles.importGameAction}>导入链接</span>
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
                                    data-label="图片投稿"
                                >
                                    图片投稿
                                    <input className={styles.input} type="file" accept="image/*" multiple onChange={(event) => setImageFiles(event.target.files)} />
                                </label>
                            ) : null}
                            {selectedActivity.submissionConfig.acceptVideos ? (
                                <label
                                    className={`${styles.fieldLabel} ${styles.decoratedFieldLabel} ${selectedActivity.submissionConfig.requireVideos ? styles.decoratedFieldLabelRequired : ''}`}
                                    data-label="视频投稿"
                                >
                                    视频投稿
                                    <input className={styles.input} type="file" accept="video/*" multiple onChange={(event) => setVideoFiles(event.target.files)} />
                                </label>
                            ) : null}
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={resetSubmitState}>取消</button>
                            <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => void handleSubmit()}
                                disabled={isSubmitting || selectedActivity.canSubmit === false}
                            >
                                {isSubmitting ? '提交中...' : '确认投稿'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <MobileBottomNav hidden />
        </div>
    );
};

export default PromotionCenter;
