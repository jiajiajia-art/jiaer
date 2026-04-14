import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import promotionApi from '../api/promotion/promotionApi';
import type {
    AdminManualPointChangeType,
    AdminPointsLookupMode,
    AdminPointsUserLookupResult,
    AdminPromotionRewardTaskPagination,
    PromotionRewardTask,
    PromotionSubmission,
} from '../api/promotion/promotion.type';
import { getImageUrl } from '../utils/constants';
import Pagination from './Pagination';
import styles from './PointsAdminManager.module.css';

type PointsTab = 'activity' | 'special';
const emptyRewardTaskPagination: AdminPromotionRewardTaskPagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

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

const getRewardTaskStatusLabel = (status: PromotionRewardTask['status']) => {
    if (status === 'issued') return '已下发';
    return '待下发';
};

const getRewardTaskDisplayName = (task: PromotionRewardTask) => task.nickname || task.userCode || task.phoneNumber || '-';
const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

type PointsAdminManagerProps = {
    pendingRewardCount: number;
    onRefreshCounts: () => Promise<void>;
};

const PointsAdminManager: React.FC<PointsAdminManagerProps> = ({ pendingRewardCount, onRefreshCounts }) => {
    const [activeTab, setActiveTab] = useState<PointsTab>('activity');
    const [rewardTasks, setRewardTasks] = useState<PromotionRewardTask[]>([]);
    const [rewardTaskPagination, setRewardTaskPagination] = useState<AdminPromotionRewardTaskPagination>(emptyRewardTaskPagination);
    const [isLoadingRewardTasks, setIsLoadingRewardTasks] = useState(true);
    const [issuingTaskId, setIssuingTaskId] = useState<number | null>(null);
    const [isBatchIssuing, setIsBatchIssuing] = useState(false);
    const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);
    const [detailTask, setDetailTask] = useState<PromotionRewardTask | null>(null);
    const [detailSubmission, setDetailSubmission] = useState<PromotionSubmission | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [lookupMode, setLookupMode] = useState<AdminPointsLookupMode>('userCode');
    const [lookupKeyword, setLookupKeyword] = useState('');
    const [lookupResult, setLookupResult] = useState<AdminPointsUserLookupResult | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [changeType, setChangeType] = useState<AdminManualPointChangeType>('increment');
    const [adjustPoints, setAdjustPoints] = useState('');
    const [remark, setRemark] = useState('');
    const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

    const [pendingTaskCount, setPendingTaskCount] = useState(0);
    const [pendingRewardPoints, setPendingRewardPoints] = useState(0);

    const loadRewardTasks = async (page = 1) => {
        try {
            setIsLoadingRewardTasks(true);
            // 实现活动积分分页请求
            const response = await promotionApi.adminRewardTasks({ page });
            const payload = response.data.data;
            setRewardTasks(payload?.list || []);
            setRewardTaskPagination(payload?.pagination || emptyRewardTaskPagination);
            setPendingTaskCount(Number(payload?.summary?.pendingCount || 0));
            setPendingRewardPoints(Number(payload?.summary?.pendingRewardPoints || 0));
        } catch (error) {
            toast.error(getErrorMessage(error, '活动积分任务列表加载失败'));
        } finally {
            setIsLoadingRewardTasks(false);
        }
    };

    useEffect(() => {
        void loadRewardTasks();
    }, []);

    const handleIssue = async (taskId: number) => {
        try {
            setIssuingTaskId(taskId);
            await promotionApi.adminIssueRewardTask(taskId);
            toast.success('活动积分发放成功');
            await Promise.all([
                loadRewardTasks(rewardTaskPagination.page),
                onRefreshCounts().catch(() => undefined),
            ]);
        } catch (error) {
            toast.error(getErrorMessage(error, '活动积分发放失败'));
        } finally {
            setIssuingTaskId(null);
        }
    };

    const handleIssueAll = async () => {
        try {
            setIsBatchIssuing(true);
            const response = await promotionApi.adminIssueAllRewardTasks();
            const issuedCount = Number(response.data.data?.issuedCount || 0);
            const skippedCount = Number(response.data.data?.skippedCount || 0);
            toast.success(`批量发放完成，成功 ${issuedCount} 条，跳过 ${skippedCount} 条`);
            setIsBatchConfirmOpen(false);
            await Promise.all([
                loadRewardTasks(rewardTaskPagination.page),
                onRefreshCounts().catch(() => undefined),
            ]);
        } catch (error) {
            toast.error(getErrorMessage(error, '活动积分批量发放失败'));
        } finally {
            setIsBatchIssuing(false);
        }
    };

    const handleRewardTaskPageChange = (page: number) => {
        // 实现活动积分分页切换
        void loadRewardTasks(page);
    };

    const handleOpenDetail = async (task: PromotionRewardTask) => {
        setDetailTask(task);
        setDetailSubmission(null);
        setIsDetailLoading(true);
        try {
            // 实现活动积分详情加载
            const response = await promotionApi.adminSubmissionDetail(task.submissionId);
            setDetailSubmission(response.data.data || null);
        } catch (error) {
            toast.error(getErrorMessage(error, '活动积分详情加载失败'));
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCloseDetail = () => {
        setDetailTask(null);
        setDetailSubmission(null);
        setIsDetailLoading(false);
    };

    const handleLookup = async () => {
        const keyword = lookupKeyword.trim();
        if (!keyword) {
            toast.error(lookupMode === 'userCode' ? '请输入 Kuran 号' : '请输入手机号');
            return;
        }
        try {
            setIsLookingUp(true);
            const response = await promotionApi.lookupAdminPointsUser(lookupMode, keyword);
            setLookupResult(response.data.data || null);
            toast.success('用户查询成功');
        } catch (error) {
            setLookupResult(null);
            toast.error(getErrorMessage(error, '用户查询失败'));
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleAdjust = async () => {
        if (!lookupResult) {
            toast.error('请先查询目标用户');
            return;
        }
        const points = Number(adjustPoints);
        if (!Number.isInteger(points) || points <= 0) {
            toast.error('积分值必须为大于 0 的整数');
            return;
        }
        if (!remark.trim()) {
            toast.error('备注不能为空');
            return;
        }

        try {
            setIsSubmittingAdjust(true);
            const response = await promotionApi.manualAdjustAdminPoints({
                userId: lookupResult.userId,
                changeType,
                points,
                remark: remark.trim(),
            });
            setLookupResult(response.data.data?.user || null);
            setAdjustPoints('');
            setRemark('');
            toast.success(changeType === 'increment' ? '特殊积分增加成功' : '特殊积分扣减成功');
        } catch (error) {
            toast.error(getErrorMessage(error, '特殊积分变更失败'));
        } finally {
            setIsSubmittingAdjust(false);
        }
    };

    const renderActivityTable = () => (
        <section className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <h3 className={styles.cardTitle}>活动积分待发放</h3>
                    <div className={styles.cardDesc}>统一处理活动奖励积分发放，并支持查看发放详情。</div>
                </div>
                <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={pendingTaskCount === 0 || isBatchIssuing || isLoadingRewardTasks}
                    onClick={() => setIsBatchConfirmOpen(true)}
                >
                    {isBatchIssuing ? '发放中...' : '一键发放'}
                </button>
            </div>

            {isLoadingRewardTasks ? (
                <div className={styles.emptyState}>正在加载活动积分任务...</div>
            ) : rewardTasks.length === 0 ? (
                <div className={styles.emptyState}>当前没有活动积分记录。</div>
            ) : (
                <>
                    <div className={styles.reviewTableWrapper}>
                        <table className={styles.reviewTable}>
                            {/* 实现活动积分表格列宽分配 */}
                            <colgroup>
                                <col className={styles.rewardStatusCol} />
                                <col className={styles.rewardTitleCol} />
                                <col className={styles.rewardAccountCol} />
                                <col className={styles.rewardPointsCol} />
                                <col className={styles.rewardDetailCol} />
                                <col className={styles.rewardOperateCol} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>发放状态</th>
                                    <th>活动名称</th>
                                    <th>账号名</th>
                                    <th>奖励积分数目</th>
                                    <th>详情按钮</th>
                                    <th>操作发放积分</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rewardTasks.map((task) => {
                                    const isPending = task.status === 'pending_issue';
                                    const isRowIssuing = issuingTaskId === task.id;

                                    return (
                                        <tr key={task.id} className={styles.reviewTableRow}>
                                            <td>
                                                <span className={`${styles.statusTag} ${isPending ? styles.statusPending : styles.statusIssued}`}>
                                                    {getRewardTaskStatusLabel(task.status)}
                                                </span>
                                            </td>
                                            <td className={styles.rewardTitleCell}>
                                                {task.activityTitle || `活动 #${task.activityId}`}
                                            </td>
                                            <td className={styles.rewardAccountCell}>{getRewardTaskDisplayName(task)}</td>
                                            <td className={styles.rewardPointsCell}>{task.rewardPoints}</td>
                                            <td className={styles.reviewDetailCell}>
                                                <button
                                                    type="button"
                                                    className={`${styles.secondaryButton} ${styles.reviewDetailButton}`}
                                                    onClick={() => void handleOpenDetail(task)}
                                                >
                                                    查看详情
                                                </button>
                                            </td>
                                            <td className={styles.reviewOperateCell}>
                                                {isPending ? (
                                                    <button
                                                        type="button"
                                                        className={styles.primaryButton}
                                                        disabled={Boolean(issuingTaskId) || isBatchIssuing}
                                                        onClick={() => void handleIssue(task.id)}
                                                    >
                                                        {isRowIssuing ? '发放中...' : '发放积分'}
                                                    </button>
                                                ) : (
                                                    <button type="button" className={styles.secondaryButton} disabled>
                                                        已发放
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        className={styles.paginationBar}
                        currentPage={rewardTaskPagination.page}
                        totalPages={rewardTaskPagination.totalPages}
                        onPageChange={handleRewardTaskPageChange}
                        disabled={isLoadingRewardTasks || Boolean(issuingTaskId) || isBatchIssuing}
                        summary={`第 ${rewardTaskPagination.page} 页，共 ${rewardTaskPagination.totalPages} 页，共 ${rewardTaskPagination.total} 条记录`}
                    />
                </>
            )}
        </section>
    );

    const renderSpecialPanel = () => (
        <div className={styles.specialGrid}>
            <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>定位用户</h3>
                        <div className={styles.cardDesc}>按 Kuran 号 或手机号精确定位用户后，再执行特殊积分调整。</div>
                    </div>
                </div>
                <div className={styles.formArea}>
                    <label className={styles.fieldLabel}>
                        定位方式
                        <select className={styles.select} value={lookupMode} onChange={(event) => setLookupMode(event.target.value as AdminPointsLookupMode)}>
                            <option value="userCode">Kuran 号</option>
                            <option value="phoneNumber">手机号</option>
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        用户定位输入
                        <input
                            className={styles.textInput}
                            value={lookupKeyword}
                            onChange={(event) => setLookupKeyword(event.target.value)}
                            placeholder={lookupMode === 'userCode' ? '请输入 Kuran 号' : '请输入手机号'}
                        />
                    </label>
                    <div className={styles.actionRow}>
                        <button type="button" className={styles.primaryButton} onClick={() => void handleLookup()} disabled={isLookingUp}>
                            {isLookingUp ? '查询中...' : '查询用户'}
                        </button>
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>特殊积分管理</h3>
                        <div className={styles.cardDesc}>支持直接对目标账号增加积分或扣减积分，并填写备注。</div>
                    </div>
                </div>
                {lookupResult ? (
                    <div className={styles.formArea}>
                        <div className={styles.userCard}>
                            <div className={styles.userName}>{lookupResult.nickname || '未命名用户'}</div>
                            <div className={styles.itemMeta}>Kuran 号：{lookupResult.userCode || '-'}</div>
                            <div className={styles.itemMeta}>手机号：{lookupResult.phoneNumber || '-'}</div>
                            <div className={styles.itemMeta}>当前积分：{lookupResult.points}</div>
                        </div>
                        <label className={styles.fieldLabel}>
                            变更类型
                            <select className={styles.select} value={changeType} onChange={(event) => setChangeType(event.target.value as AdminManualPointChangeType)}>
                                <option value="increment">增加积分</option>
                                <option value="decrement">扣减积分</option>
                            </select>
                        </label>
                        <label className={styles.fieldLabel}>
                            积分值
                            <input className={styles.textInput} type="number" value={adjustPoints} onChange={(event) => setAdjustPoints(event.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                            备注
                            <textarea className={styles.textArea} value={remark} onChange={(event) => setRemark(event.target.value)} />
                        </label>
                        <div className={styles.actionRow}>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleAdjust()} disabled={isSubmittingAdjust}>
                                {isSubmittingAdjust ? '提交中...' : '确认变更积分'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyState}>请先在左侧输入 Kuran 号或手机号查询用户。</div>
                )}
            </section>
        </div>
    );

    const renderDetailModal = () => {
        if (!detailTask) return null;

        const submission = detailSubmission;
        const statusLabel = getRewardTaskStatusLabel(detailTask.status);
        const accountName = submission?.nickname || getRewardTaskDisplayName(detailTask);

        return (
            <div className={styles.detailOverlay} onClick={(event) => { if (event.target === event.currentTarget) handleCloseDetail(); }}>
                <div className={styles.detailDialog} role="dialog" aria-modal="true" aria-label="活动积分详情">
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>活动积分详情</h3>
                            <div className={styles.cardDesc}>查看积分发放任务基础信息和对应投稿内容。</div>
                        </div>
                        <button type="button" className={styles.secondaryButton} onClick={handleCloseDetail}>关闭</button>
                    </div>

                    {isDetailLoading ? (
                        <div className={styles.emptyState}>正在加载详情...</div>
                    ) : (
                        <div className={styles.detailBody}>
                            <section className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>基础信息</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>活动名称</span><span className={styles.detailValue}>{detailTask.activityTitle || `活动 #${detailTask.activityId}`}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>发放状态</span><span className={`${styles.statusTag} ${detailTask.status === 'pending_issue' ? styles.statusPending : styles.statusIssued}`}>{statusLabel}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>账号名</span><span className={styles.detailValue}>{accountName}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>Kuran 号</span><span className={styles.detailValue}>{submission?.userCode || detailTask.userCode || '未填写'}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>手机号</span><span className={styles.detailValue}>{submission?.phoneNumber || detailTask.phoneNumber || '未填写'}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>用户 ID</span><span className={styles.detailValue}>{submission?.userId || detailTask.userId}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>奖励积分</span><span className={styles.detailValue}>{detailTask.rewardPoints}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>任务 ID</span><span className={styles.detailValue}>{detailTask.id}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>创建时间</span><span className={styles.detailValue}>{formatTime(detailTask.createdAt)}</span></div>
                                    <div className={styles.detailField}><span className={styles.detailLabel}>发放时间</span><span className={styles.detailValue}>{formatTime(detailTask.issuedAt)}</span></div>
                                </div>
                            </section>

                            <section className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>投稿文本</div>
                                {!submission || submission.submitPayload.texts.length === 0 ? (
                                    <div className={styles.detailTextBlock}>无内容</div>
                                ) : (
                                    <div className={styles.detailLinkList}>
                                        {submission.submitPayload.texts.map((item, index) => (
                                            <div key={`${detailTask.id}-text-${index}`} className={styles.detailTextBlock}>{item}</div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>投稿链接</div>
                                {!submission || submission.submitPayload.links.length === 0 ? (
                                    <div className={styles.detailTextBlock}>无内容</div>
                                ) : (
                                    <div className={styles.detailLinkList}>
                                        {submission.submitPayload.links.map((item) => (
                                            <a key={item} className={styles.detailLinkItem} href={item} target="_blank" rel="noreferrer">{item}</a>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>投稿图片</div>
                                {!submission || submission.submitPayload.images.length === 0 ? (
                                    <div className={styles.detailTextBlock}>无内容</div>
                                ) : (
                                    <div className={styles.detailMediaGrid}>
                                        {submission.submitPayload.images.map((item) => (
                                            <img key={item} className={styles.detailImage} src={getImageUrl(item)} alt="投稿图片" />
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>投稿视频</div>
                                {!submission || submission.submitPayload.videos.length === 0 ? (
                                    <div className={styles.detailTextBlock}>无内容</div>
                                ) : (
                                    <div className={styles.detailMediaGrid}>
                                        {submission.submitPayload.videos.map((item) => (
                                            <video key={item} className={styles.detailVideo} controls src={getImageUrl(item)} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderBatchConfirmModal = () => {
        if (!isBatchConfirmOpen) return null;

        return (
            <div className={styles.confirmOverlay} onClick={(event) => { if (event.target === event.currentTarget) setIsBatchConfirmOpen(false); }}>
                <div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-label="批量发放确认">
                    <div className={styles.confirmTitle}>确认发放全部待下发积分</div>
                    <div className={styles.confirmDesc}>
                        {/* 实现批量发放确认弹窗 */}
                        当前待发放 <span className={styles.confirmHighlight}>{pendingTaskCount}</span> 条，
                        总积分 <span className={styles.confirmHighlight}>{pendingRewardPoints}</span>。
                    </div>
                    <div className={styles.actionRow}>
                        <button type="button" className={styles.secondaryButton} onClick={() => setIsBatchConfirmOpen(false)} disabled={isBatchIssuing}>
                            取消
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => void handleIssueAll()} disabled={isBatchIssuing}>
                            {isBatchIssuing ? '发放中...' : '确认发放'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className={styles.panelStack}>
                <section className={styles.heroCard}>
                    <div>
                        <div className={styles.sectionBadge}>积分管理</div>
                        <h2 className={styles.heroTitle}>统一处理活动积分发放与特殊积分变更</h2>
                        <p className={styles.heroDesc}>活动积分管理承接活动奖励发放，特殊积分管理支持按 Kuran 号 或手机号精确调整用户积分。</p>
                    </div>
                </section>

                <div className={styles.tabRow}>
                    <div className={styles.tabButtonWrap}>
                        <button
                            type="button"
                            className={`${styles.tabButton} ${activeTab === 'activity' ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTab('activity')}
                        >
                            活动积分管理
                        </button>
                        {pendingRewardCount > 0 ? <span className={styles.actionBadge}>{formatBadgeCount(pendingRewardCount)}</span> : null}
                    </div>
                    <button
                        type="button"
                        className={`${styles.tabButton} ${activeTab === 'special' ? styles.tabButtonActive : ''}`}
                        onClick={() => setActiveTab('special')}
                    >
                        特殊积分管理
                    </button>
                </div>

                {activeTab === 'activity' ? renderActivityTable() : renderSpecialPanel()}
            </div>

            {renderDetailModal()}
            {renderBatchConfirmModal()}
        </>
    );
};

export default PointsAdminManager;
