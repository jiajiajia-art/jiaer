import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import adminAiModelPricingApi from '../api/admin/aiModelPricingApi';
import {
  AI_MODEL_BILLING_TYPES,
  getAiModelBillingTypeLabel,
  getAiModelPricingSummary,
  isAiModelPricingIncomplete,
  requiresBillingTypeConfirmation,
  requiresModelCodeConfirmation,
  toAiModelPricingDraft,
  toAiModelPricingPayload,
  validateAiModelPricingDraft,
  type AiModelBillingType,
  type AiModelPricingDraft,
  type AiModelPricingErrors,
  type AiModelPricingRecord,
  type AiModelPricingStatus,
} from '../lib/aiModelPricing';
import { getApiErrorMessage } from '../utils/error';
import AiModelPricingPriceFields from './AiModelPricingPriceFields';
import styles from './AiModelPricingManager.module.css';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const AiModelPricingManager: React.FC = () => {
  const [items, setItems] = useState<AiModelPricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AiModelPricingStatus>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<'all' | AiModelBillingType>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AiModelPricingRecord | null>(null);
  const [draft, setDraft] = useState<AiModelPricingDraft>(() => toAiModelPricingDraft());
  const [formErrors, setFormErrors] = useState<AiModelPricingErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [confirmRiskChange, setConfirmRiskChange] = useState(false);

  const loadItems = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError('');
    try {
      const response = await adminAiModelPricingApi.list();
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '模型计费配置加载失败');
      }
      setItems(response.data.data.items || []);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, '模型计费配置加载失败'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!editorOpen && !confirmRiskChange) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      if (confirmRiskChange) setConfirmRiskChange(false);
      else setEditorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmRiskChange, editorOpen, saving]);

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesBillingType = billingTypeFilter === 'all' || item.billingType === billingTypeFilter;
      const matchesKeyword = !keyword
        || item.modelCode.toLowerCase().includes(keyword)
        || item.displayName.toLowerCase().includes(keyword);
      return matchesStatus && matchesBillingType && matchesKeyword;
    });
  }, [billingTypeFilter, items, search, statusFilter]);

  const enabledCount = items.filter((item) => item.status === 'enabled').length;
  const incompleteCount = items.filter(isAiModelPricingIncomplete).length;
  const codeChanged = Boolean(editing && requiresModelCodeConfirmation(editing.modelCode, draft.modelCode));
  const billingTypeChanged = Boolean(editing && requiresBillingTypeConfirmation(
    editing.billingType,
    draft.billingType,
  ));
  const billingTypeLocked = editing?.status === 'enabled';

  const openCreate = () => {
    setEditing(null);
    setDraft(toAiModelPricingDraft());
    setFormErrors({});
    setFormError('');
    setConfirmRiskChange(false);
    setEditorOpen(true);
  };

  const openEdit = (item: AiModelPricingRecord, nextStatus = item.status) => {
    const nextDraft = { ...toAiModelPricingDraft(item), status: nextStatus };
    setEditing(item);
    setDraft(nextDraft);
    setFormErrors(nextStatus === 'enabled' ? validateAiModelPricingDraft(nextDraft) : {});
    setFormError(nextStatus === 'enabled' && isAiModelPricingIncomplete(item)
      ? '启用前请先补全当前计费类型所需价格。'
      : '');
    setConfirmRiskChange(false);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setConfirmRiskChange(false);
    setEditorOpen(false);
  };

  const persistDraft = async () => {
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = toAiModelPricingPayload(draft, editing?.updatedAt);
      const response = editing
        ? await adminAiModelPricingApi.update(editing.id, payload)
        : await adminAiModelPricingApi.create(payload);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '保存失败');
      }
      toast.success(response.data.message || (editing ? '模型计费配置已更新' : '模型计费配置已创建'));
      setConfirmRiskChange(false);
      setEditorOpen(false);
      await loadItems(false);
    } catch (error) {
      const apiError = error as { response?: { data?: { code?: string } } };
      if (apiError.response?.data?.code === 'PRICING_STALE') {
        toast.error('该记录已被其他管理员修改，列表已刷新，请重新编辑');
        setConfirmRiskChange(false);
        setEditorOpen(false);
        await loadItems(false);
      } else {
        setConfirmRiskChange(false);
        setFormError(getApiErrorMessage(error, '保存失败'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const errors = validateAiModelPricingDraft(draft);
    setFormErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return;
    if (codeChanged || billingTypeChanged) {
      setConfirmRiskChange(true);
      return;
    }
    void persistDraft();
  };

  const handlePriceChange = (field: string, value: string) => {
    setDraft((current) => {
      if (field === 'inputPrice' || field === 'outputPrice' || field === 'cachedInputPrice') {
        return { ...current, [field]: value };
      }
      return { ...current, tierPrices: { ...current.tierPrices, [field]: value } };
    });
    setFormErrors((current) => ({ ...current, [field]: undefined, tiers: undefined }));
  };

  const handleBillingTypeChange = (nextType: AiModelBillingType) => {
    setDraft((current) => ({
      ...current,
      billingType: nextType,
      inputPrice: '',
      outputPrice: '',
      cachedInputPrice: '',
      tierPrices: {},
    }));
    setFormErrors({});
    setFormError('');
  };

  const handleStatusChange = async (item: AiModelPricingRecord) => {
    if (changingStatusId !== null || saving) return;
    const nextStatus: AiModelPricingStatus = item.status === 'enabled' ? 'disabled' : 'enabled';
    if (nextStatus === 'enabled' && isAiModelPricingIncomplete(item)) {
      openEdit(item, 'enabled');
      return;
    }

    setChangingStatusId(item.id);
    try {
      const nextDraft = { ...toAiModelPricingDraft(item), status: nextStatus };
      const response = await adminAiModelPricingApi.update(
        item.id,
        toAiModelPricingPayload(nextDraft, item.updatedAt),
      );
      if (!response.data.success) throw new Error(response.data.message || '状态更新失败');
      toast.success(nextStatus === 'enabled' ? '模型已启用' : '模型已停用');
      await loadItems(false);
    } catch (error) {
      const apiError = error as { response?: { data?: { code?: string } } };
      if (apiError.response?.data?.code === 'PRICING_STALE') {
        toast.error('该记录已被其他管理员修改，列表已刷新');
        await loadItems(false);
      } else {
        toast.error(getApiErrorMessage(error, '状态更新失败'));
      }
    } finally {
      setChangingStatusId(null);
    }
  };

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>AI COST CATALOG</span>
          <h2>AI 模型计费管理</h2>
          <p>统一维护 Token、生图与生视频模型价格，分别按百万 tokens、张和秒计价。</p>
          <div className={styles.notice}>当前仅维护价格表，不会改变现有结算流程。</div>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadItems()}
            disabled={loading}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
          <button type="button" className={styles.primaryButton} onClick={openCreate}>
            新增模型
          </button>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="模型计费概览">
        <div className={styles.summaryCard}>
          <span>模型总数</span>
          <strong>{items.length}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>已启用</span>
          <strong>{enabledCount}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>待补价格</span>
          <strong>{incompleteCount}</strong>
        </div>
      </section>

      <section className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div>
            <h3>价格表</h3>
            <p>价格支持 4 位小数；停用草稿可暂不填写价格。</p>
          </div>
          <div className={styles.filters}>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>搜索模型</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索名称或 model_code"
              />
            </label>
            <label>
              <span className={styles.srOnly}>筛选计费类型</span>
              <select
                value={billingTypeFilter}
                onChange={(event) => setBillingTypeFilter(event.target.value as 'all' | AiModelBillingType)}
              >
                <option value="all">全部类型</option>
                {AI_MODEL_BILLING_TYPES.map((item) => (
                  <option value={item.value} key={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={styles.srOnly}>筛选状态</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | AiModelPricingStatus)}
              >
                <option value="all">全部状态</option>
                <option value="enabled">已启用</option>
                <option value="disabled">已停用</option>
              </select>
            </label>
          </div>
        </div>

        {loadError ? (
          <div className={styles.errorBanner} role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => void loadItems()}>重新加载</button>
          </div>
        ) : null}

        {loadError && items.length === 0 ? null : loading && items.length === 0 ? (
          <div className={styles.stateBox} aria-live="polite">
            <span className={styles.spinner} aria-hidden />
            <strong>加载中…</strong>
            <p>正在读取模型计费配置</p>
          </div>
        ) : !loadError && items.length === 0 ? (
          <div className={styles.stateBox}>
            <strong>暂无模型计费配置</strong>
            <p>从第一个模型开始建立价格表。</p>
            <button type="button" className={styles.primaryButton} onClick={openCreate}>新增模型</button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className={styles.stateBox}>
            <strong>没有符合条件的模型</strong>
            <p>调整搜索关键词或筛选条件后再试。</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>模型</th>
                  <th>计费类型</th>
                  <th>价格配置</th>
                  <th>状态</th>
                  <th>审计信息</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const changing = changingStatusId === item.id;
                  const summaries = getAiModelPricingSummary(item);
                  return (
                    <tr key={item.id}>
                      <td data-label="模型">
                        <strong className={styles.modelName}>{item.displayName}</strong>
                        <code className={styles.modelCode}>{item.modelCode}</code>
                        {item.remark ? <span className={styles.remark}>{item.remark}</span> : null}
                      </td>
                      <td data-label="计费类型">
                        <span className={styles.billingTypeBadge} data-type={item.billingType}>
                          {getAiModelBillingTypeLabel(item.billingType)}
                        </span>
                      </td>
                      <td data-label="价格配置" className={styles.priceSummaryCell}>
                        {summaries.length > 0 ? summaries.map((summary) => (
                          <span className={styles.priceSummaryChip} key={summary}>{summary}</span>
                        )) : <span>—</span>}
                      </td>
                      <td data-label="状态">
                        <span className={item.status === 'enabled' ? styles.statusEnabled : styles.statusDisabled}>
                          {item.status === 'enabled' ? '已启用' : '已停用'}
                        </span>
                      </td>
                      <td data-label="审计信息" className={styles.auditCell}>
                        <span>最后修改：{item.updatedBy || '—'}</span>
                        <time dateTime={item.updatedAt}>{dateFormatter.format(new Date(item.updatedAt))}</time>
                        <span>创建人：{item.createdByUser?.nickname || '—'}</span>
                        <span>Kuran号：{item.createdByUser?.userCode || '—'}</span>
                        <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
                      </td>
                      <td data-label="操作">
                        <div className={styles.rowActions}>
                          <button type="button" onClick={() => openEdit(item)} disabled={changing}>编辑</button>
                          <button
                            type="button"
                            className={item.status === 'enabled' ? styles.stopButton : styles.enableButton}
                            onClick={() => void handleStatusChange(item)}
                            disabled={changing}
                          >
                            {changing ? '处理中…' : item.status === 'enabled' ? '停用' : '启用'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editorOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <section className={styles.editor} role="dialog" aria-modal="true" aria-labelledby="pricing-editor-title">
            <header className={styles.editorHeader}>
              <div>
                <span>{editing ? 'EDIT MODEL' : 'NEW MODEL'}</span>
                <h3 id="pricing-editor-title">{editing ? '编辑模型价格' : '新增模型价格'}</h3>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeEditor} disabled={saving} aria-label="关闭">×</button>
            </header>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>模型名称</span>
                  <input
                    autoFocus
                    value={draft.displayName}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, displayName: event.target.value }));
                      setFormErrors((current) => ({ ...current, displayName: undefined }));
                    }}
                    maxLength={128}
                    disabled={saving}
                  />
                  {formErrors.displayName ? <small>{formErrors.displayName}</small> : null}
                </label>

                <label className={styles.field}>
                  <span>model_code</span>
                  <input
                    value={draft.modelCode}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, modelCode: event.target.value }));
                      setFormErrors((current) => ({ ...current, modelCode: undefined }));
                    }}
                    maxLength={128}
                    spellCheck={false}
                    disabled={saving}
                  />
                  <em>必须与调用链路中的模型标识完全一致，且全局唯一。</em>
                  {formErrors.modelCode ? <small>{formErrors.modelCode}</small> : null}
                </label>

                <label className={`${styles.field} ${styles.fullField}`}>
                  <span>计费类型</span>
                  <select
                    value={draft.billingType}
                    onChange={(event) => handleBillingTypeChange(event.target.value as AiModelBillingType)}
                    disabled={saving || billingTypeLocked}
                  >
                    {AI_MODEL_BILLING_TYPES.map((item) => (
                      <option value={item.value} key={item.value}>{item.label}</option>
                    ))}
                  </select>
                  {billingTypeLocked
                    ? <em>已启用记录不能直接修改计费类型，请先停用并保存后再编辑。</em>
                    : <em>修改计费类型会清空当前表单中的旧类型价格，并在保存前再次确认。</em>}
                </label>

                <AiModelPricingPriceFields
                  draft={draft}
                  errors={formErrors}
                  disabled={saving}
                  onPriceChange={handlePriceChange}
                />

                <fieldset className={styles.statusField}>
                  <legend>状态</legend>
                  <label className={draft.status === 'disabled' ? styles.statusOptionActive : styles.statusOption}>
                    <input
                      type="radio"
                      name="pricing-status"
                      value="disabled"
                      checked={draft.status === 'disabled'}
                      onChange={() => setDraft((current) => ({ ...current, status: 'disabled' }))}
                      disabled={saving}
                    />
                    <span><strong>停用</strong><small>可作为未完成草稿保存</small></span>
                  </label>
                  <label className={draft.status === 'enabled' ? styles.statusOptionActive : styles.statusOption}>
                    <input
                      type="radio"
                      name="pricing-status"
                      value="enabled"
                      checked={draft.status === 'enabled'}
                      onChange={() => setDraft((current) => ({ ...current, status: 'enabled' }))}
                      disabled={saving}
                    />
                    <span><strong>启用</strong><small>必须满足当前类型的价格规则</small></span>
                  </label>
                </fieldset>

                <label className={`${styles.field} ${styles.fullField}`}>
                  <span>备注 <b>可选</b></span>
                  <textarea
                    value={draft.remark}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, remark: event.target.value }));
                      setFormErrors((current) => ({ ...current, remark: undefined }));
                    }}
                    maxLength={500}
                    rows={3}
                    disabled={saving}
                  />
                  <em>{draft.remark.length} / 500</em>
                  {formErrors.remark ? <small>{formErrors.remark}</small> : null}
                </label>
              </div>

              {formError ? <div className={styles.formError} role="alert">{formError}</div> : null}

              <footer className={styles.editorFooter}>
                <button type="button" className={styles.secondaryButton} onClick={closeEditor} disabled={saving}>取消</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? '保存中…' : editing ? '保存修改' : '创建模型'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {confirmRiskChange ? (
        <div className={styles.confirmBackdrop} role="presentation">
          <section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="risk-confirm-title">
            <span className={styles.warningMark} aria-hidden>!</span>
            <h3 id="risk-confirm-title">确认高风险修改？</h3>
            <div className={styles.confirmWarnings}>
              {codeChanged ? (
                <p>修改 model_code 可能导致历史调用无法匹配价格，请确认新标识已与实际调用参数一致。</p>
              ) : null}
              {billingTypeChanged ? (
                <p>修改计费类型后，旧计费类型的价格将被清空，且无法从当前记录中恢复。</p>
              ) : null}
            </div>
            {codeChanged ? (
              <div className={styles.codeChange}>
                <code>{editing?.modelCode}</code>
                <span aria-hidden>→</span>
                <code>{draft.modelCode.trim()}</code>
              </div>
            ) : null}
            {billingTypeChanged ? (
              <div className={styles.typeChange}>
                <span>{editing ? getAiModelBillingTypeLabel(editing.billingType) : ''}</span>
                <b aria-hidden>→</b>
                <span>{getAiModelBillingTypeLabel(draft.billingType)}</span>
              </div>
            ) : null}
            <div className={styles.confirmActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setConfirmRiskChange(false)} disabled={saving}>返回检查</button>
              <button type="button" className={styles.dangerButton} onClick={() => void persistDraft()} disabled={saving}>
                {saving ? '保存中…' : '确认修改并保存'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default AiModelPricingManager;
