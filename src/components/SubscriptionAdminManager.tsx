import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MdContentCopy, MdLock, MdLockOpen } from 'react-icons/md';
import Pagination from './Pagination';
import MembershipRecordsPanel from './MembershipRecordsPanel';
import subscriptionKeysApi from '../api/subscriptionKeys/subscriptionKeysApi';
import { getApiErrorMessage } from '../utils/error';
import { copyTextToClipboard as copyText } from '../utils/clipboard';
import { planLabelMap } from '../utils/planLabels';
import type {
    AdminSubscriptionKeyRecord,
    CreatedSubscriptionKeyRecord,
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
type AdminMembershipTab = 'membershipRecords' | 'keyGeneration' | 'keyRecords';

const emptyListResult: SubscriptionKeyListResult = {
    total: 0,
    page: 1,
    pageSize: 20,
    items: [],
};

const statusLabelMap: Record<SubscriptionKeyStatus, string> = {
    unused: '未使用',
    used: '已使用',
    expired: '已过期',
    archived: '已归档',
};

const sourceTypeLabelMap: Record<SubscriptionKeySourceType, string> = {
    paid: '充值购买',
    campaign: '运营生成',
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

const SubscriptionAdminManager: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<AdminMembershipTab>('membershipRecords');
    const [planId, setPlanId] = useState<SubscriptionPlanId>('month_v2');
    const [count, setCount] = useState('1');
    const [expireAt, setExpireAt] = useState('');
    const [channel, setChannel] = useState('');
    const [issuedToUserCode, setIssuedToUserCode] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createdKeys, setCreatedKeys] = useState<CreatedSubscriptionKeyRecord[]>([]);

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
            toast.error(getApiErrorMessage(error, t('admin.loadKeyListFailed')));
        } finally {
            setIsLoadingList(false);
        }
    }, [disabledFilter, page, pageSize, planFilter, sourceTypeFilter, statusFilter, userCodeFilter]);

    useEffect(() => {
        if (activeTab === 'keyRecords') {
            void loadList();
        }
    }, [activeTab, loadList]);

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
            setCreatedKeys(data.keys);
            toast.success(issuedToUserCode.trim()
                ? `已向 ${issuedToUserCode.trim()} 发放 ${data.keys.length} 张会员兑换卡`
                : `已生成 ${data.keys.length} 张会员兑换卡`);

            if (page !== 1) {
                setPage(1);
            } else {
                await loadList();
            }
        } catch (error) {
            toast.error(getApiErrorMessage(error, '创建 Key 失败'));
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
            toast.error(getApiErrorMessage(error, '操作失败'));
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
                    <h2 className={styles.heroTitle}>会员管理中心</h2>
                    <p className={styles.heroDesc}>查询会员状态，生成会员兑换卡，并追踪兑换卡的使用与冻结情况。</p>
                </div>
            </section>

            <div className={styles.adminTabs} role="tablist" aria-label="会员管理功能">
                {([
                    ['membershipRecords', '会员状态记录'],
                    ['keyGeneration', '会员兑换卡密钥生成'],
                    ['keyRecords', '会员兑换卡使用记录'],
                ] as const).map(([tab, label]) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={activeTab === tab ? styles.adminTabActive : styles.adminTab}
                        onClick={() => setActiveTab(tab)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'membershipRecords' ? <MembershipRecordsPanel /> : null}

            {activeTab === 'keyGeneration' ? <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>会员兑换卡密钥生成</h3>
                        <div className={styles.cardDesc}>批量生成周卡或月卡兑换密钥，也可以直接发放给指定用户。</div>
                    </div>
                </div>

                <div className={styles.createFormWrap}>
                    <div className={styles.createFormRow}>
                        <label className={styles.fieldLabel}>
                            <span className={styles.fieldLabelText}>会员类型</span>
                            <select className={styles.select} value={planId} onChange={(event) => setPlanId(event.target.value as SubscriptionPlanId)}>
                                <option value="week">周卡</option>
                                <option value="month_v2">月卡</option>
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
                            <span className={styles.fieldLabelText}>兑换截止时间 <span className={styles.optionalTag}>可选</span></span>
                            <input className={styles.textInput} type="datetime-local" value={expireAt} onChange={(event) => setExpireAt(event.target.value)} />
                        </label>
                    </div>
                    <div className={styles.createFormRow}>
                        <label className={styles.fieldLabel}>
                            <span className={styles.fieldLabelText}>渠道标记 <span className={styles.optionalTag}>可选</span></span>
                            <input className={styles.textInput} value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="用于标记更具体的活动" />
                        </label>
                        <label className={`${styles.fieldLabel} ${styles.targetUserCodeField}`}>
                            <span className={styles.fieldLabelText}>直接发放给用户（Kuran号） <span className={styles.optionalTag}>可选</span></span>
                            <input
                                className={styles.textInput}
                                value={issuedToUserCode}
                                onChange={(event) => setIssuedToUserCode(event.target.value)}
                                placeholder="请输入完整 Kuran号"
                            />
                            <small className={styles.formHint}>留空则仅生成密钥，填写后将立即兑换并发放会员。</small>
                        </label>
                        <div className={styles.createAction}>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleCreateKeys()} disabled={isCreating}>
                                {isCreating ? '创建中...' : '创建 Key'}
                            </button>
                        </div>
                    </div>
                </div>

                {createdKeys.length > 0 ? (
                    <div className={styles.generatedPanel}>
                        <div className={styles.generatedPanelHeader}>
                            <strong>本次生成结果</strong>
                            <button type="button" className={styles.ghostButton} onClick={() => setActiveTab('keyRecords')}>查看使用记录</button>
                        </div>
                        <div className={styles.generatedList}>
                            {createdKeys.map((item) => (
                                <div key={item.keyCode} className={styles.generatedItem}>
                                    <code className={styles.keyCode}>{item.keyCode}</code>
                                    <button type="button" className={styles.iconButton} onClick={() => void handleCopyKey(item.keyCode)} aria-label={`复制密钥 ${item.keyCode}`} title="复制密钥">
                                        <MdContentCopy aria-hidden="true" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </section> : null}

            {activeTab === 'keyRecords' ? <section className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>会员兑换卡使用记录</h3>
                        <div className={styles.cardDesc}>查询全部兑换卡状态，并执行冻结或解冻操作。</div>
                    </div>
                    <span className={styles.recordCount}>共 {listResult.total} 条</span>
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
                            <option value="week">周卡</option>
                            <option value="month_v2">月卡</option>
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
                            <option value="expired">已过期</option>
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
                        <table className={`${styles.table} ${styles.responsiveTable}`}>
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
                                            <td data-label="兑换卡密钥">
                                                <div className={styles.keyCell}>
                                                    <code className={styles.keyCode}>{item.key_code}</code>
                                                    <button
                                                        type="button"
                                                        className={styles.iconButton}
                                                        onClick={() => void handleCopyKey(item.key_code)}
                                                        aria-label={`复制密钥 ${item.key_code}`}
                                                        title="复制密钥"
                                                    >
                                                        <MdContentCopy aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td data-label="会员类型">{planLabelMap[item.plan_id]}</td>
                                            <td data-label="来源">{sourceTypeLabelMap[item.source_type]}</td>
                                            <td data-label="状态"><span className={`${styles.statusPill} ${styles[`keyStatus_${item.effective_status ?? item.status}`]}`}>{statusLabelMap[item.effective_status ?? item.status]}</span></td>
                                            <td data-label="冻结状态">{disabled ? <span className={`${styles.statusPill} ${styles.statusFrozen}`}>已冻结</span> : '未冻结'}</td>
                                            <td data-label="兑换截止时间">{formatTime(item.expire_at)}</td>
                                            <td data-label="兑换人">{item.redeemed_by_user_code ?? '-'}</td>
                                            <td data-label="兑换时间">{formatTime(item.redeemed_at)}</td>
                                            <td data-label="渠道" title={item.metadata_json || ''}>{formatMetadataSummary(item.metadata_json)}</td>
                                            <td data-label="创建人">{item.created_by || '-'}</td>
                                            <td data-label="创建时间">{formatTime(item.created_at)}</td>
                                            <td data-label="操作">
                                                <button
                                                    type="button"
                                                    className={`${styles.iconButton} ${disabled ? '' : styles.dangerIconButton}`}
                                                    onClick={() => void handleToggleDisabled(item)}
                                                    disabled={togglingId === item.id}
                                                    aria-label={disabled ? `解冻密钥 ${item.key_code}` : `冻结密钥 ${item.key_code}`}
                                                    title={disabled ? '解冻密钥' : '冻结密钥'}
                                                >
                                                    {disabled ? <MdLockOpen aria-hidden="true" /> : <MdLock aria-hidden="true" />}
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
            </section> : null}
        </div>
    );
};

export default SubscriptionAdminManager;
