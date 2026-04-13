import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Pagination from './Pagination';
import subscriptionKeysApi from '../api/subscriptionKeys/subscriptionKeysApi';
import type {
    AdminSubscriptionKeyRecord,
    CreateSubscriptionKeysPayload,
    SubscriptionKeyListResult,
    SubscriptionKeySourceType,
    SubscriptionKeyStatus,
    SubscriptionPlanId,
} from '../api/subscriptionKeys/subscriptionKeysApi.type';
import styles from './SubscriptionAdminManager.module.css';

type FilterPlan = 'all' | SubscriptionPlanId;
type FilterStatus = 'all' | SubscriptionKeyStatus;
type FilterSourceType = 'all' | SubscriptionKeySourceType;
type FilterDisabled = 'all' | 'enabled' | 'disabled';

const emptyListResult: SubscriptionKeyListResult = {
    total: 0,
    page: 1,
    pageSize: 20,
    items: [],
};

const planLabelMap: Record<SubscriptionPlanId, string> = {
    month: '月卡',
    season: '季卡',
    year: '年卡',
};

const statusLabelMap: Record<SubscriptionKeyStatus, string> = {
    unused: '未使用',
    used: '已使用',
    archived: '已归档',
};

const sourceTypeLabelMap: Record<SubscriptionKeySourceType, string> = {
    paid: '付费',
    campaign: '活动',
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string; error?: string } } };
        return response.response?.data?.message || response.response?.data?.error || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const formatTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const normalizeListResult = (data: SubscriptionKeyListResult | null | undefined): SubscriptionKeyListResult => {
    if (!data) return emptyListResult;
    return {
        total: Number(data.total) || 0,
        page: Math.max(1, Number(data.page) || 1),
        pageSize: Math.max(1, Number(data.pageSize) || 20),
        items: Array.isArray(data.items) ? data.items : [],
    };
};

const parseMetadataJson = (raw: string | null) => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
};

const formatMetadataSummary = (raw: string | null) => {
    const parsed = parseMetadataJson(raw);
    if (!parsed) return raw || '-';
    const channel = typeof parsed.channel === 'string' ? parsed.channel : '';

    if (channel) return `${channel}`;
    return '-';
};

const toIsoDateTime = (value: string) => {
    if (!value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (!copied) throw new Error('copy failed');
};

const SubscriptionAdminManager: React.FC = () => {
    const [planId, setPlanId] = useState<SubscriptionPlanId>('month');
    const [count, setCount] = useState('1');
    const [expireAt, setExpireAt] = useState('');
    const [channel, setChannel] = useState('');
    const [issuedToUserCode, setIssuedToUserCode] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [planFilter, setPlanFilter] = useState<FilterPlan>('all');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [sourceTypeFilter, setSourceTypeFilter] = useState<FilterSourceType>('all');
    const [disabledFilter, setDisabledFilter] = useState<FilterDisabled>('all');
    const [userCodeFilter, setUserCodeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [listResult, setListResult] = useState<SubscriptionKeyListResult>(emptyListResult);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(listResult.total / Math.max(1, listResult.pageSize))),
        [listResult.total],
    );

    const loadList = useCallback(async () => {
        try {
            setIsLoadingList(true);
            const response = await subscriptionKeysApi.list({
                page,
                pageSize,
                planId: planFilter === 'all' ? undefined : planFilter,
                status: statusFilter === 'all' ? undefined : statusFilter,
                sourceType: sourceTypeFilter === 'all' ? undefined : sourceTypeFilter,
                disabled: disabledFilter === 'all' ? undefined : disabledFilter === 'disabled',
                userCode: userCodeFilter.trim() || undefined,
            });
            const normalizedResult = normalizeListResult(response.data.data);
            setListResult(normalizedResult);
            if (normalizedResult.page !== page) {
                setPage(normalizedResult.page);
            }
        } catch (error) {
            toast.error(getErrorMessage(error, '加载会员 Key 列表失败'));
        } finally {
            setIsLoadingList(false);
        }
    }, [disabledFilter, page, pageSize, planFilter, sourceTypeFilter, statusFilter, userCodeFilter]);

    useEffect(() => {
        void loadList();
    }, [loadList]);

    const handleCreateKeys = async () => {
        const nextCount = Number(count);
        if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > 500) {
            toast.error('数量必须是 1 到 500 之间的整数');
            return;
        }

        const normalizedExpireAt = toIsoDateTime(expireAt);
        if (normalizedExpireAt === null) {
            toast.error('过期时间格式不正确');
            return;
        }

        const payload: CreateSubscriptionKeysPayload = { planId, count: nextCount };
        if (normalizedExpireAt) payload.expireAt = normalizedExpireAt;
        if (channel.trim()) payload.metadata = { channel: channel.trim() };
        if (issuedToUserCode.trim()) payload.userCode = issuedToUserCode.trim();

        try {
            setIsCreating(true);
            const response = await subscriptionKeysApi.create(payload);
            const data = response.data.data;
            if (!data) {
                toast.error('接口未返回可用的 Key');
                return;
            }
            toast.success(`已创建 ${data.keys.length} 个 Key`);

            if (page !== 1) {
                setPage(1);
            } else {
                await loadList();
            }
        } catch (error) {
            toast.error(getErrorMessage(error, '创建 Key 失败'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleDisabled = async (item: AdminSubscriptionKeyRecord) => {
        const isDisabled = Number(item.disabled) === 1;
        try {
            setTogglingId(item.id);
            if (isDisabled) {
                await subscriptionKeysApi.enable(item.id);
                toast.success(`已解冻`);
            } else {
                await subscriptionKeysApi.disable(item.id);
                toast.success(`已冻结`);
            }
            await loadList();
        } catch (error) {
            toast.error(getErrorMessage(error, '操作失败'));
        } finally {
            setTogglingId(null);
        }
    };

    const handleCopyKey = async (keyCode: string) => {
        try {
            await copyText(keyCode);
            toast.success('已复制 Key');
        } catch {
            toast.error('复制失败');
        }
    };

    return (
        <div className={styles.panelStack}>
            <section className={styles.heroCard}>
                <div>
                    <div className={styles.sectionBadge}>会员管理</div>
                    <h2 className={styles.heroTitle}>会员订阅 Key 管理</h2>
                    <p className={styles.heroDesc}>用于管理月卡、季卡、年卡的 Key 发放、查询与冻结/解冻。</p>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>发放 Key</h3>
                        <div className={styles.cardDesc}>支持批量创建会员 Key，用于活动或手动发放。</div>
                    </div>
                </div>

                <div className={styles.createFormWrap}>
                    <div className={styles.createFormRow}>
                        <label className={styles.fieldLabel}>
                            <span className={styles.fieldLabelText}>会员类型</span>
                            <select className={styles.select} value={planId} onChange={(event) => setPlanId(event.target.value as SubscriptionPlanId)}>
                                <option value="month">月卡</option>
                                <option value="season">季卡</option>
                                <option value="year">年卡</option>
                            </select>
                        </label>
                        <label className={styles.fieldLabel}>
                            <span className={styles.fieldLabelText}>数量</span>
                            <input
                                className={styles.textInput}
                                type="number"
                                min={1}
                                max={500}
                                value={count}
                                onChange={(event) => setCount(event.target.value)}
                            />
                        </label>
                        <label className={styles.fieldLabel}>
                            <span className={styles.fieldLabelText}>过期时间</span>
                            <input className={styles.textInput} type="datetime-local" value={expireAt} onChange={(event) => setExpireAt(event.target.value)} />
                        </label>
                    </div>
                    <div className={styles.createFormRow}>
                        <label className={styles.fieldLabel}>
                            <span className={styles.fieldLabelText}>渠道标记 <span className={styles.optionalTag}>可选</span></span>
                            <input className={styles.textInput} value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="用于标记更具体的活动" />
                        </label>
                        <label className={`${styles.fieldLabel} ${styles.targetUserCodeField}`}>
                            <span className={styles.fieldLabelText}>指定兑换人 <span className={styles.optionalTag}>可选</span></span>
                            <input
                                className={styles.textInput}
                                value={issuedToUserCode}
                                onChange={(event) => setIssuedToUserCode(event.target.value)}
                                placeholder="输入后该 Key 仅限指定用户兑换"
                            />
                        </label>
                        <div className={styles.createAction}>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleCreateKeys()} disabled={isCreating}>
                                {isCreating ? '创建中...' : '创建 Key'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>Key 列表</h3>
                        <div className={styles.cardDesc}>支持筛选查询，并执行冻结/解冻操作。</div>
                    </div>
                </div>

                <div className={styles.filterGrid}>
                    <label className={styles.fieldLabel}>
                        会员类型
                        <select
                            className={styles.select}
                            value={planFilter}
                            onChange={(event) => {
                                setPlanFilter(event.target.value as FilterPlan);
                                setPage(1);
                            }}
                        >
                            <option value="all">全部</option>
                            <option value="month">月卡</option>
                            <option value="season">季卡</option>
                            <option value="year">年卡</option>
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        状态
                        <select
                            className={styles.select}
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value as FilterStatus);
                                setPage(1);
                            }}
                        >
                            <option value="all">全部</option>
                            <option value="unused">未使用</option>
                            <option value="used">已使用</option>
                            <option value="archived">已归档</option>
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        来源
                        <select
                            className={styles.select}
                            value={sourceTypeFilter}
                            onChange={(event) => {
                                setSourceTypeFilter(event.target.value as FilterSourceType);
                                setPage(1);
                            }}
                        >
                            <option value="all">全部</option>
                            <option value="paid">付费</option>
                            <option value="campaign">活动</option>
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        冻结状态
                        <select
                            className={styles.select}
                            value={disabledFilter}
                            onChange={(event) => {
                                setDisabledFilter(event.target.value as FilterDisabled);
                                setPage(1);
                            }}
                        >
                            <option value="all">全部</option>
                            <option value="enabled">未冻结</option>
                            <option value="disabled">已冻结</option>
                        </select>
                    </label>
                    <label className={styles.fieldLabel}>
                        Kuran号
                        <input
                            className={styles.textInput}
                            value={userCodeFilter}
                            onChange={(event) => {
                                setUserCodeFilter(event.target.value);
                                setPage(1);
                            }}
                            placeholder="兑换人 Kuran号"
                        />
                    </label>
                    <label className={styles.fieldLabel}>
                        每页条数
                        <select
                            className={styles.select}
                            value={String(pageSize)}
                            onChange={(event) => {
                                setPageSize(Number(event.target.value) || 20);
                                setPage(1);
                            }}
                        >
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </label>
                </div>

                {isLoadingList ? (
                    <div className={styles.emptyState}>加载中...</div>
                ) : listResult.items.length === 0 ? (
                    <div className={styles.emptyState}>当前筛选条件下暂无数据。</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Key 编码</th>
                                    <th>会员类型</th>
                                    <th>来源</th>
                                    <th>状态</th>
                                    <th>是否冻结</th>
                                    <th>过期时间</th>
                                    <th>兑换人</th>
                                    <th>兑换时间</th>
                                    <th>扩展信息</th>
                                    <th>创建人</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listResult.items.map((item) => {
                                    const disabled = Number(item.disabled) === 1;
                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div className={styles.keyCell}>
                                                    <code className={styles.keyCode}>{item.key_code}</code>
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        onClick={() => void handleCopyKey(item.key_code)}
                                                    >
                                                        复制
                                                    </button>
                                                </div>
                                            </td>
                                            <td>{planLabelMap[item.plan_id]}</td>
                                            <td>{sourceTypeLabelMap[item.source_type]}</td>
                                            <td>{statusLabelMap[item.status]}</td>
                                            <td>{disabled ? '是' : '否'}</td>
                                            <td>{formatTime(item.expire_at)}</td>
                                            <td>{item.redeemed_by_user_code ?? '-'}</td>
                                            <td>{formatTime(item.redeemed_at)}</td>
                                            <td title={item.metadata_json || ''}>{formatMetadataSummary(item.metadata_json)}</td>
                                            <td>{item.created_by || '-'}</td>
                                            <td>{formatTime(item.created_at)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={disabled ? styles.secondaryButton : styles.dangerButton}
                                                    onClick={() => void handleToggleDisabled(item)}
                                                    disabled={togglingId === item.id}
                                                >
                                                    {togglingId === item.id ? '处理中...' : disabled ? '解冻' : '冻结'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination
                    className={styles.paginationBar}
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    disabled={isLoadingList || togglingId !== null}
                    summary={`第 ${page} 页，共 ${totalPages} 页，共 ${listResult.total} 条记录`}
                />
            </section>
        </div>
    );
};

export default SubscriptionAdminManager;
