import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from './Pagination';
import subscriptionKeysApi from '../api/subscriptionKeys/subscriptionKeysApi';
import type {
    AdminMembershipListResult,
    AdminMembershipSourceType,
    AdminMembershipStatus,
    SubscriptionPlanId,
} from '../api/subscriptionKeys/subscriptionKeysApi.type';
import { getApiErrorMessage } from '../utils/error';
import { planLabelMap } from '../utils/planLabels';
import styles from './SubscriptionAdminManager.module.css';

type FilterPlan = 'all' | SubscriptionPlanId;
type FilterStatus = 'all' | AdminMembershipStatus;
type FilterSource = 'all' | AdminMembershipSourceType;

const emptyResult: AdminMembershipListResult = {
    total: 0,
    page: 1,
    pageSize: 20,
    items: [],
};

const statusLabels: Record<AdminMembershipStatus, string> = {
    active: '生效中',
    pending: '待生效',
    expired: '已过期',
};

const sourceLabels: Record<AdminMembershipSourceType, string> = {
    purchase: '充值购买',
    redeem: '兑换卡兑换',
    migration: '旧会员迁移',
};

const formatTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const MembershipRecordsPanel: React.FC = () => {
    const [planFilter, setPlanFilter] = useState<FilterPlan>('all');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [sourceFilter, setSourceFilter] = useState<FilterSource>('all');
    const [userCodeDraft, setUserCodeDraft] = useState('');
    const [userCodeFilter, setUserCodeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [result, setResult] = useState<AdminMembershipListResult>(emptyResult);
    const [isLoading, setIsLoading] = useState(true);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(result.total / Math.max(1, result.pageSize))),
        [result.pageSize, result.total],
    );

    const loadRecords = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await subscriptionKeysApi.listMemberships({
                page,
                pageSize,
                planId: planFilter === 'all' ? undefined : planFilter,
                status: statusFilter === 'all' ? undefined : statusFilter,
                sourceType: sourceFilter === 'all' ? undefined : sourceFilter,
                userCode: userCodeFilter || undefined,
            });
            const data = response.data.data;
            setResult({
                total: Number(data?.total) || 0,
                page: Math.max(1, Number(data?.page) || 1),
                pageSize: Math.max(1, Number(data?.pageSize) || 20),
                items: Array.isArray(data?.items) ? data.items : [],
            });
        } catch (error) {
            toast.error(getApiErrorMessage(error, '会员状态记录加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, planFilter, sourceFilter, statusFilter, userCodeFilter]);

    useEffect(() => {
        void loadRecords();
    }, [loadRecords]);

    const applyUserCodeFilter = (event: React.FormEvent) => {
        event.preventDefault();
        setPage(1);
        setUserCodeFilter(userCodeDraft.trim());
    };

    const clearFilters = () => {
        setPlanFilter('all');
        setStatusFilter('all');
        setSourceFilter('all');
        setUserCodeDraft('');
        setUserCodeFilter('');
        setPage(1);
    };

    return (
        <section className={styles.card} aria-labelledby="membership-records-title">
            <div className={styles.cardHeader}>
                <div>
                    <h3 id="membership-records-title" className={styles.cardTitle}>会员状态记录</h3>
                    <div className={styles.cardDesc}>每次充值、兑换或旧会员迁移均独立记录，可查询当前与历史会员周期。</div>
                </div>
                <span className={styles.recordCount}>共 {result.total} 条</span>
            </div>

            <div className={styles.membershipFilterGrid}>
                <label className={styles.fieldLabel}>
                    会员类型
                    <select className={styles.select} value={planFilter} onChange={(event) => { setPlanFilter(event.target.value as FilterPlan); setPage(1); }}>
                        <option value="all">全部</option>
                        <option value="week">周卡</option>
                        <option value="month_v2">月卡</option>
                    </select>
                </label>
                <label className={styles.fieldLabel}>
                    会员状态
                    <select className={styles.select} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as FilterStatus); setPage(1); }}>
                        <option value="all">全部</option>
                        <option value="active">生效中</option>
                        <option value="pending">待生效</option>
                        <option value="expired">已过期</option>
                    </select>
                </label>
                <label className={styles.fieldLabel}>
                    开通来源
                    <select className={styles.select} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value as FilterSource); setPage(1); }}>
                        <option value="all">全部</option>
                        <option value="purchase">充值购买</option>
                        <option value="redeem">兑换卡兑换</option>
                        <option value="migration">旧会员迁移</option>
                    </select>
                </label>
                <label className={styles.fieldLabel}>
                    每页条数
                    <select className={styles.select} value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value) || 20); setPage(1); }}>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </label>
            </div>

            <form className={styles.searchRow} onSubmit={applyUserCodeFilter}>
                <label className={styles.searchField}>
                    <span className={styles.fieldLabelText}>用户 Kuran号</span>
                    <input className={styles.textInput} value={userCodeDraft} onChange={(event) => setUserCodeDraft(event.target.value)} placeholder="输入完整 Kuran号精确查询" />
                </label>
                <button type="submit" className={styles.primaryButton}>查询</button>
                <button type="button" className={styles.ghostButton} onClick={clearFilters}>重置</button>
            </form>

            {isLoading ? (
                <div className={styles.emptyState}>会员记录加载中...</div>
            ) : result.items.length === 0 ? (
                <div className={styles.emptyState}>当前筛选条件下暂无会员记录。</div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={`${styles.table} ${styles.membershipTable} ${styles.responsiveTable}`}>
                        <thead>
                            <tr>
                                <th>用户</th>
                                <th>会员类型</th>
                                <th>状态</th>
                                <th>来源</th>
                                <th>生效时间</th>
                                <th>到期时间</th>
                                <th>来源凭证</th>
                                <th>开通时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((item) => (
                                <tr key={item.id}>
                                    <td data-label="用户">
                                        <strong className={styles.userCode}>{item.user_code || item.user_id}</strong>
                                        <small className={styles.userNickname}>{item.nickname || '-'}</small>
                                    </td>
                                    <td data-label="会员类型">{planLabelMap[item.plan_id]}</td>
                                    <td data-label="状态"><span className={`${styles.statusPill} ${styles[`status_${item.status}`]}`}>{statusLabels[item.status]}</span></td>
                                    <td data-label="来源">{sourceLabels[item.source_type]}</td>
                                    <td data-label="生效时间">{formatTime(item.discount_start_at)}</td>
                                    <td data-label="到期时间">{formatTime(item.discount_end_at)}</td>
                                    <td data-label="来源凭证"><code className={styles.referenceCode}>{item.key_code || (item.source_type === 'migration' ? '旧会员迁移' : item.source_order_no)}</code></td>
                                    <td data-label="开通时间">{formatTime(item.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination
                className={styles.paginationBar}
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                disabled={isLoading}
                summary={`第 ${page} 页，共 ${totalPages} 页，共 ${result.total} 条记录`}
            />
        </section>
    );
};

export default MembershipRecordsPanel;
