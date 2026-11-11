import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import commentsApi, { type PendingCommentItem, type CommentReviewStatus } from '../../api/admin/commentsApi';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { getApiErrorMessage } from '../../utils/error';
import styles from './CommentAdminManager.module.css';

const PAGE_SIZE = 20;

const statusLabelMap: Record<CommentReviewStatus, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
};

const formatTime = (value: string | null | undefined): string => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const truncate = (value: string | null | undefined, max = 56): string => {
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max)}…` : value;
};

interface CommentAdminManagerProps {
    fileId?: string;
}

const CommentAdminManager: React.FC<CommentAdminManagerProps> = ({ fileId }) => {
    const [comments, setComments] = useState<PendingCommentItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(PAGE_SIZE);
    const [isLoading, setIsLoading] = useState(true);
    const [isReviewing, setIsReviewing] = useState(false);

    const [commentToReview, setCommentToReview] = useState<PendingCommentItem | null>(null);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const [detailComment, setDetailComment] = useState<PendingCommentItem | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const loadComments = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await commentsApi.listPending(page, pageSize, 'pending', fileId);
            const data = response.data.data;
            if (data) {
                setComments(data.list || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            toast.error(getApiErrorMessage(error, '评论列表加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, fileId]);

    useEffect(() => {
        void loadComments();
    }, [loadComments]);

    const handleReviewClick = (comment: PendingCommentItem, action: 'approve' | 'reject') => {
        setCommentToReview(comment);
        setReviewAction(action);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmReview = async () => {
        if (!commentToReview) return;

        try {
            setIsReviewing(true);
            const response = await commentsApi.review(commentToReview.rating_id, { action: reviewAction });
            toast.success(response.data.message || (reviewAction === 'approve' ? '审核通过' : '已拒绝'));
            setIsConfirmModalOpen(false);
            setCommentToReview(null);
            if (page === 1) {
                void loadComments();
            } else {
                setPage(1);
            }
        } catch (error) {
            toast.error(getApiErrorMessage(error, reviewAction === 'approve' ? '审核失败' : '拒绝失败'));
        } finally {
            setIsReviewing(false);
        }
    };

    const handleCancelReview = () => {
        if (isReviewing) return;
        setIsConfirmModalOpen(false);
        setCommentToReview(null);
    };

    const openDetail = (comment: PendingCommentItem) => {
        setDetailComment(comment);
        setIsDetailModalOpen(true);
    };

    const closeDetail = () => {
        if (isReviewing) return;
        setIsDetailModalOpen(false);
        setDetailComment(null);
    };

    const handleReviewFromDetail = (action: 'approve' | 'reject') => {
        if (!detailComment) return;
        setIsDetailModalOpen(false);
        setDetailComment(null);
        handleReviewClick(detailComment, action);
    };

    return (
        <div className={styles.panelStack}>
            <section className={styles.heroCard}>
                <div className={styles.heroMetric}>
                    <span className={styles.heroMetricLabel}>待审核</span>
                    <span className={styles.heroMetricValue}>{total}</span>
                    <span className={styles.heroMetricUnit}>条</span>
                </div>
            </section>

            <section className={styles.card}>
                {isLoading ? (
                    <div className={styles.emptyState}>正在加载评论列表...</div>
                ) : comments.length === 0 ? (
                    <div className={styles.emptyState}>当前没有待审核的评论。</div>
                ) : (
                    <>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th className={styles.colContent}>评论内容</th>
                                        <th className={styles.colStatus}>状态</th>
                                        <th className={styles.colAction}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comments.map((comment) => (
                                        <tr key={comment.rating_id}>
                                            <td className={styles.colContent}>
                                                <div className={styles.commentContent}>
                                                    <span className={styles.commentQuote} aria-hidden="true">
                                                        “
                                                    </span>
                                                    <span className={styles.commentText}>
                                                        {truncate(comment.comment_content, 60)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={styles.colStatus}>
                                                <span className={`${styles.statusTag} ${styles.statusPending}`}>
                                                    {statusLabelMap[comment.review_status]}
                                                </span>
                                            </td>
                                            <td className={styles.colAction}>
                                                <div className={styles.actionCluster}>
                                                    <div className={styles.actionRow}>
                                                        <button
                                                            type="button"
                                                            className={styles.approveButton}
                                                            onClick={() => handleReviewClick(comment, 'approve')}
                                                            disabled={isReviewing}
                                                        >
                                                            通过
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.rejectButton}
                                                            onClick={() => handleReviewClick(comment, 'reject')}
                                                            disabled={isReviewing}
                                                        >
                                                            拒绝
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={styles.detailButton}
                                                        onClick={() => openDetail(comment)}
                                                        disabled={isReviewing}
                                                    >
                                                        详情
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className={styles.pagination}>
                                <button
                                    type="button"
                                    className={styles.pageButton}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1 || isLoading}
                                >
                                    上一页
                                </button>
                                <span className={styles.pageInfo}>
                                    第 {page} / {totalPages} 页，共 {total} 条
                                </span>
                                <button
                                    type="button"
                                    className={styles.pageButton}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || isLoading}
                                >
                                    下一页
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onConfirm={handleConfirmReview}
                onCancel={handleCancelReview}
                title={reviewAction === 'approve' ? '通过评论' : '拒绝评论'}
                message={
                    commentToReview
                        ? reviewAction === 'approve'
                            ? `确定要通过用户 "${commentToReview.nickname || '未知用户'}" 的评论吗？`
                            : `确定要拒绝用户 "${commentToReview.nickname || '未知用户'}" 的评论吗？`
                        : ''
                }
                confirmButtonText={isReviewing ? '处理中...' : reviewAction === 'approve' ? '确认通过' : '确认拒绝'}
                cancelButtonText="取消"
            />

            {isDetailModalOpen && detailComment && (
                <div
                    className={styles.detailOverlay}
                    onClick={closeDetail}
                    role="presentation"
                >
                    <div
                        className={styles.detailModal}
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className={styles.detailHeader}>
                            <div className={styles.detailHeaderMeta}>
                                <span className={styles.detailKicker}>评论详情</span>
                                <span className={`${styles.statusTag} ${styles.statusPending}`}>
                                    {statusLabelMap[detailComment.review_status]}
                                </span>
                            </div>
                            <button
                                type="button"
                                className={styles.detailClose}
                                onClick={closeDetail}
                                aria-label="关闭"
                            >
                                ×
                            </button>
                        </div>

                        <blockquote className={styles.detailQuote}>
                            <span className={styles.detailQuoteMark} aria-hidden="true">
                                “
                            </span>
                            <p className={styles.detailQuoteText}>{detailComment.comment_content}</p>
                        </blockquote>

                        <dl className={styles.detailMeta}>
                            <div className={styles.detailMetaRow}>
                                <dt>用户</dt>
                                <dd>{detailComment.nickname || '匿名用户'}</dd>
                            </div>
                            <div className={styles.detailMetaRow}>
                                <dt>作品</dt>
                                <dd>{detailComment.game_title || '未关联作品'}</dd>
                            </div>
                            <div className={styles.detailMetaRow}>
                                <dt>提交时间</dt>
                                <dd>{formatTime(detailComment.created_at)}</dd>
                            </div>
                            <div className={styles.detailMetaRow}>
                                <dt>评分 ID</dt>
                                <dd className={styles.detailMetaMono}>{detailComment.rating_id}</dd>
                            </div>
                        </dl>

                        <div className={styles.detailFooter}>
                            <button
                                type="button"
                                className={styles.detailCancel}
                                onClick={closeDetail}
                                disabled={isReviewing}
                            >
                                关闭
                            </button>
                            <div className={styles.detailActions}>
                                <button
                                    type="button"
                                    className={styles.rejectButton}
                                    onClick={() => handleReviewFromDetail('reject')}
                                    disabled={isReviewing}
                                >
                                    拒绝
                                </button>
                                <button
                                    type="button"
                                    className={styles.approveButton}
                                    onClick={() => handleReviewFromDetail('approve')}
                                    disabled={isReviewing}
                                >
                                    通过
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommentAdminManager;
