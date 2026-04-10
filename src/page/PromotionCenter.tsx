import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import promotionApi from '../api/promotion/promotionApi';
import type { PromotionActivity, PromotionReviewStatus, PromotionSubmission } from '../api/promotion/promotion.type';
import styles from './PromotionCenter.module.css';
import { getImageUrl } from '../utils/constants';

type PromotionTab = 'activities' | 'submissions';

const statusLabelMap: Record<PromotionReviewStatus, string> = {
    pending_review: '待审核',
    approved: '审核通过',
    rejected: '审核不通过',
    reward_pending: '奖励待下发',
    reward_issued: '奖励已下发',
};

const statusClassMap: Record<PromotionReviewStatus, string> = {
    pending_review: styles.statusPending,
    approved: styles.statusApproved,
    rejected: styles.statusRejected,
    reward_pending: styles.statusPending,
    reward_issued: styles.statusApproved,
};

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

const PromotionCenter: React.FC = () => {
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

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [activityResponse, submissionResponse] = await Promise.all([
                promotionApi.list(),
                promotionApi.mySubmissions(),
            ]);
            setActivities(activityResponse.data.data || []);
            setSubmissions(submissionResponse.data.data || []);
        } catch (error) {
            toast.error(getErrorMessage(error, '推广数据加载失败'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const submissionCount = useMemo(() => submissions.length, [submissions.length]);

    const resetSubmitState = () => {
        setSelectedActivity(null);
        setTextInput('');
        setLinkInputs(['']);
        setImageFiles(null);
        setVideoFiles(null);
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
        window.location.href = `${window.location.origin}/funloom${activity.detailLinkUrl.startsWith('/') ? activity.detailLinkUrl : `/${activity.detailLinkUrl}`}`;
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

        // 实现文本与多类型投稿组装
        if (trimmedText) formData.append('texts', trimmedText);
        trimmedLinks.forEach((item) => formData.append('links', item));
        Array.from(imageFiles || []).forEach((file) => formData.append('images', file));
        Array.from(videoFiles || []).forEach((file) => formData.append('videos', file));

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
                        <h1 className={styles.title}>自由推广，完成投稿后获取积分奖励</h1>
                        <p className={styles.desc}>在这里查看当前推广活动、跳转活动详情并提交你的推广成果。审核通过后，你可以在“我的投稿”里随时查看进度。</p>
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
                                {activities.map((activity) => (
                                    <article key={activity.id} className={styles.card}>
                                        <img className={styles.cover} src={getImageUrl(activity.coverImageUrl)} alt={activity.title} />
                                        <div className={styles.cardBody}>
                                            <div className={styles.cardTitle}>{activity.title}</div>
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
                                            {activity.availabilityText && (
                                                <div className={styles.noticeText}>{activity.availabilityText}</div>
                                            )}
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
                                ))}
                            </div>
                        )
                    ) : submissions.length === 0 ? (
                        <div className={styles.emptyState}>你还没有提交过推广内容，先去参加活动吧。</div>
                    ) : (
                        <div className={styles.submissionList}>
                            {submissions.map((submission) => (
                                <article key={submission.id} className={styles.submissionCard}>
                                    <div className={styles.submissionHeader}>
                                        <div>
                                            <div className={styles.submissionTitle}>{submission.activityTitle || `活动 #${submission.activityId}`}</div>
                                            <div className={styles.metaRow}>
                                                <span className={`${styles.statusTag} ${statusClassMap[submission.reviewStatus]}`}>{statusLabelMap[submission.reviewStatus]}</span>
                                                <span className={styles.chip}>投稿时间 {formatTime(submission.submittedAt)}</span>
                                                {typeof submission.rewardPoints === 'number' && <span className={styles.chip}>奖励积分 {submission.rewardPoints}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.submissionMeta}>
                                        {submission.submitPayload.texts.length > 0 && (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿文本</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.texts.map((item, index) => (
                                                        <div key={`${submission.id}-text-${index}`} className={styles.payloadItem}>{item}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {submission.submitPayload.links.length > 0 && (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿链接</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.links.map((item) => (
                                                        <a key={item} className={styles.payloadItem} href={item} target="_blank" rel="noreferrer">{item}</a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {submission.submitPayload.images.length > 0 && (
                                            <div className={styles.payloadBlock}>
                                                <div className={styles.payloadLabel}>投稿图片</div>
                                                <div className={styles.payloadList}>
                                                    {submission.submitPayload.images.map((item) => (
                                                        <img key={item} className={styles.mediaPreview} src={getImageUrl(item)} alt="投稿图片" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {submission.submitPayload.videos.length > 0 && (
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
                                        )}
                                        {submission.reviewRemark && <div className={styles.payloadItem}>审核备注：{submission.reviewRemark}</div>}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedActivity && (
                <div className={styles.modalOverlay} onClick={resetSubmitState}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <h2 className={styles.modalTitle}>投稿到“{selectedActivity.title}”</h2>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>活动时间：{buildTimeSummary(selectedActivity)}</div>
                            <div className={styles.infoItem}>投稿限制：{buildLimitSummary(selectedActivity)}</div>
                            <div className={styles.infoItem}>奖励积分：审核通过后发放 {selectedActivity.rewardPoints} 积分</div>
                        </div>
                        {selectedActivity.availabilityText && (
                            <div className={styles.noticeText}>{selectedActivity.availabilityText}</div>
                        )}
                        <div className={styles.formGrid}>
                            {selectedActivity.submissionConfig.acceptTexts && (
                                <label className={styles.fieldLabel}>
                                    文本投稿
                                    <textarea
                                        className={styles.input}
                                        value={textInput}
                                        placeholder="请输入你的推广文本内容"
                                        onChange={(event) => setTextInput(event.target.value)}
                                    />
                                    <div className={styles.uploadHint}>可直接提交文本内容，支持和其他投稿方式一起提交。</div>
                                </label>
                            )}
                            {selectedActivity.submissionConfig.acceptLinks && (
                                <label className={styles.fieldLabel}>
                                    链接投稿
                                    {linkInputs.map((value, index) => (
                                        <input
                                            key={`link-${index}`}
                                            className={styles.input}
                                            value={value}
                                            placeholder="请输入你的推广链接"
                                            onChange={(event) => {
                                                const next = [...linkInputs];
                                                next[index] = event.target.value;
                                                setLinkInputs(next);
                                            }}
                                        />
                                    ))}
                                    <button type="button" className={styles.secondaryButton} onClick={() => setLinkInputs((prev) => [...prev, ''])}>
                                        新增链接
                                    </button>
                                </label>
                            )}
                            {selectedActivity.submissionConfig.acceptImages && (
                                <label className={styles.fieldLabel}>
                                    图片投稿
                                    <input className={styles.input} type="file" accept="image/*" multiple onChange={(event) => setImageFiles(event.target.files)} />
                                    <div className={styles.uploadHint}>支持多张图片上传，提交时将按后台配置一并保存。</div>
                                </label>
                            )}
                            {selectedActivity.submissionConfig.acceptVideos && (
                                <label className={styles.fieldLabel}>
                                    视频投稿
                                    <input className={styles.input} type="file" accept="video/*" multiple onChange={(event) => setVideoFiles(event.target.files)} />
                                    <div className={styles.uploadHint}>支持多个视频文件上传，一期按原始文件保存。</div>
                                </label>
                            )}
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.secondaryButton} onClick={resetSubmitState}>取消</button>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleSubmit()} disabled={isSubmitting || selectedActivity.canSubmit === false}>
                                {isSubmitting ? '提交中...' : '确认投稿'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MobileBottomNav hidden />
        </div>
    );
};

export default PromotionCenter;
