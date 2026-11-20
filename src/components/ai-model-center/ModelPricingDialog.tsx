import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiEye, FiEyeOff, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import adminImageGenConfigApi from '../../api/admin/imageGenConfigApi';
import adminTextLlmConfigApi from '../../api/admin/textLlmConfigApi';
import aiModelCenterApi, {
  type AiModelPricingLifecycle,
  type AiModelPricingVersion,
} from '../../api/operator/aiModelCenterApi';
import { x10000ToDecimal } from '../../lib/aiBillingCenter';
import {
  buildModelPublishPayload,
  serializeImagePricingDraft,
  serializeTextPricingDraft,
  type AiModelCatalogCard,
  type ImagePricingDraftForm,
  type TextPricingDraftForm,
} from '../../lib/aiModelCatalog';
import { getApiErrorMessage } from '../../utils/error';
import TextPricingPreview from './TextPricingPreview';
import styles from './modelCatalog.module.css';

const blankText = (): TextPricingDraftForm => ({
  inputPrice: '', outputPrice: '', cachedInputPrice: '', multiplier: '1', remark: '',
});
const blankImage = (): ImagePricingDraftForm => ({
  multiplier: '1', remark: '',
  tiers: [{ aspectRatio: '1:1', upstreamCost: '', userBasePrice: '' }],
});

function versionToText(version: AiModelPricingVersion | null): TextPricingDraftForm {
  if (!version) return blankText();
  return {
    inputPrice: x10000ToDecimal(version.rate.inputPriceX10000),
    outputPrice: x10000ToDecimal(version.rate.outputPriceX10000),
    cachedInputPrice: x10000ToDecimal(version.rate.cachedInputPriceX10000),
    multiplier: x10000ToDecimal(version.rate.textMultiplierX10000),
    remark: version.remark || '',
  };
}

function versionToImage(version: AiModelPricingVersion | null): ImagePricingDraftForm {
  if (!version) return blankImage();
  return {
    multiplier: x10000ToDecimal(version.rate.imageMultiplierX10000),
    remark: version.remark || '',
    tiers: version.rate.imageTiers.length ? version.rate.imageTiers.map((tier) => ({
      aspectRatio: tier.aspectRatio,
      upstreamCost: x10000ToDecimal(tier.upstreamCostYuanX10000),
      userBasePrice: x10000ToDecimal(tier.userBasePriceKkX10000),
    })) : blankImage().tiers,
  };
}

interface Props {
  model: AiModelCatalogCard;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  showGatewayCredentials?: boolean;
}

const ModelPricingDialog: React.FC<Props> = ({ model, onClose, onChanged, showGatewayCredentials = false }) => {
  const [lifecycle, setLifecycle] = useState<AiModelPricingLifecycle | null>(null);
  const [textForm, setTextForm] = useState(blankText);
  const [imageForm, setImageForm] = useState(blankImage);
  const [effectiveAt, setEffectiveAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const active = lifecycle?.active;
  const scheduledVersion = lifecycle?.scheduled;
  const draft = lifecycle?.draft;
  const draftChanged = draft && (model.capability === 'text'
    ? JSON.stringify(textForm) !== JSON.stringify(versionToText(draft))
    : JSON.stringify(imageForm) !== JSON.stringify(versionToImage(draft)));

  const load = async () => {
    setLoading(true); setError(''); setLifecycle(null);
    try {
      const response = await aiModelCenterApi.getModelPricing(model.id);
      const data = response.data.data;
      if (!data) throw new Error(response.data.message || '计费配置不存在');
      setLifecycle(data);
      const source = data.draft || data.active || data.scheduled;
      if (model.capability === 'text') setTextForm(versionToText(source));
      else setImageForm(versionToImage(source));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '计费配置加载失败'));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    setApiKey('');
    setApiKeyLoaded(false);
    setApiKeyVisible(false);
    setApiKeyError('');
    void load();
  }, [model.id]);

  const toggleApiKey = async () => {
    if (apiKeyVisible) {
      setApiKeyVisible(false);
      return;
    }
    if (apiKeyLoaded) {
      setApiKeyVisible(true);
      return;
    }

    setApiKeyLoading(true);
    setApiKeyError('');
    try {
      const response = model.capability === 'text'
        ? await adminTextLlmConfigApi.getApiKey(model.sourceBaseUrl)
        : await adminImageGenConfigApi.getApiKey();
      setApiKey(String(response.data.data?.openaiApiKey || ''));
      setApiKeyLoaded(true);
      setApiKeyVisible(true);
    } catch (requestError) {
      setApiKeyError(getApiErrorMessage(requestError, 'API Key 读取失败'));
    } finally {
      setApiKeyLoading(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true); setError('');
    try {
      const payload = model.capability === 'text'
        ? serializeTextPricingDraft(textForm)
        : serializeImagePricingDraft(imageForm);
      await aiModelCenterApi.saveModelPricingDraft(model.id, payload);
      toast.success('计费草稿已保存');
      await load();
      await onChanged();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '计费草稿保存失败'));
    } finally { setSaving(false); }
  };

  const publish = async () => {
    if (!draft || draftChanged) return;
    const scheduled = effectiveAt ? new Date(effectiveAt) : null;
    if (scheduled && Number.isNaN(scheduled.getTime())) {
      setError('生效时间格式无效');
      return;
    }
    if (scheduled && scheduled.getTime() <= Date.now()) {
      setError('请选择未来的生效时间，或清空时间以立即生效');
      return;
    }
    const hasScheduled = Boolean(scheduledVersion);
    const confirmation = scheduled
      ? `确认发布，并于 ${scheduled.toLocaleString()} 生效？`
      : '确认立即发布当前计费草稿？';
    const replacePrompt = hasScheduled ? '\n本次发布将替换已有的待生效版本。' : '';
    if (!window.confirm(confirmation + replacePrompt)) return;
    setSaving(true); setError('');
    try {
      const payload = buildModelPublishPayload({
        effectiveAt: scheduled?.toISOString() || null,
        hasScheduledVersion: hasScheduled,
        replaceScheduled: hasScheduled,
      });
      await aiModelCenterApi.publishModelPricing(model.id, payload);
      setEffectiveAt('');
      toast.success(scheduled ? '计费版本已定时发布' : '计费版本已发布');
      await load();
      await onChanged();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '计费版本发布失败'));
    } finally { setSaving(false); }
  };

  const history = useMemo(() => lifecycle?.history || [], [lifecycle]);

  return (
    <div className={styles.overlay} role="presentation">
      <section className={`${styles.dialog} ${model.capability === 'text' ? styles.pricingDialogWide : ''}`} role="dialog" aria-modal="true" aria-labelledby="pricing-dialog-title">
        <header className={styles.dialogHeader}>
          <div><h3 id="pricing-dialog-title">{model.displayName} · 计费配置</h3><p>保存草稿后，可选择立即发布或定时生效。</p></div>
          <button type="button" className={styles.iconButton} aria-label="关闭计费配置" onClick={onClose} disabled={saving}><FiX aria-hidden /></button>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.readonly}>
            <div><span>渠道</span><strong>{model.sourceGatewayLabel}</strong></div>
            <div><span>模型 ID</span><code>{model.modelId}</code></div>
          </div>
          {showGatewayCredentials ? (
            <div className={styles.readonly}>
              <div><span>渠道 URL</span><code>{model.sourceBaseUrl || '未设置'}</code></div>
              <div>
                <span>API Key</span>
                <div className={styles.credentialValue}>
                  <code>{apiKeyVisible ? (apiKey || '未保存') : '••••••••••••'}</code>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.secretButton}`}
                    aria-label={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'}
                    aria-busy={apiKeyLoading}
                    disabled={apiKeyLoading}
                    onClick={() => void toggleApiKey()}
                  >
                    {apiKeyVisible ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
                  </button>
                </div>
                {apiKeyError ? <small className={styles.credentialError}>{apiKeyError}</small> : null}
              </div>
            </div>
          ) : null}
          {loading ? <p>加载中…</p> : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {!loading && !lifecycle ? (
            <button type="button" className={styles.secondary} onClick={() => void load()}>重新加载计费配置</button>
          ) : null}
          {lifecycle ? <>
          <div className={styles.readonly}>
            <div><span>{model.capability === 'text' ? '创作引擎' : '玩家端生图线路'}</span><strong>
              {!model.selectable ? '模型目录设为不可选' : active ? '玩家可选' : '等待计费版本生效'}
            </strong></div>
            <div><span>当前生效版本</span><strong>
              {active ? `${active.versionCode} · ×${x10000ToDecimal(model.capability === 'text' ? active.rate.textMultiplierX10000 : active.rate.imageMultiplierX10000)}` : '暂无'}
            </strong></div>
            <div><span>待生效版本</span><strong>
              {scheduledVersion?.effectiveAt ? `${scheduledVersion.versionCode} · ${new Date(scheduledVersion.effectiveAt).toLocaleString()}` : '暂无'}
            </strong></div>
            <div><span>计费草稿</span><strong>{draft?.versionCode || '暂无'}</strong></div>
          </div>
          <fieldset className={styles.pricingFields} disabled={saving}>
          {model.capability === 'text' ? (
            <>
              <div className={styles.readonly}><div><span>用户统一计费标准</span><strong>0.1 KK / 1,000 Token</strong></div><div><span>计费 Token</span><strong>输入 + 输出 + 缓存命中</strong></div></div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>输入真实成本（元 / 百万 Token）<input value={textForm.inputPrice} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, inputPrice: e.target.value })} /></label>
                <label className={styles.field}>输出真实成本（元 / 百万 Token）<input value={textForm.outputPrice} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, outputPrice: e.target.value })} /></label>
                <label className={styles.field}>缓存命中成本（元 / 百万 Token）<input value={textForm.cachedInputPrice} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, cachedInputPrice: e.target.value })} /></label>
                <label className={styles.field}>用户价格倍率（x1 表示不加价，权益折扣在动态价之后应用）<input value={textForm.multiplier} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, multiplier: e.target.value })} /></label>
              </div>
              {lifecycle?.previewContext ? (
                <TextPricingPreview pricing={textForm} context={lifecycle.previewContext} />
              ) : null}
            </>
          ) : null}
          {model.capability === 'image' ? (
            <>
              <label className={styles.field}>用户价格倍率<input value={imageForm.multiplier} inputMode="decimal" onChange={(e) => setImageForm({ ...imageForm, multiplier: e.target.value })} /><span className={styles.helper}>生图倍率独立于生文倍率。</span></label>
              <div className={styles.tierHead}><strong>比例档位</strong><button type="button" className={styles.secondary} onClick={() => setImageForm({ ...imageForm, tiers: [...imageForm.tiers, { aspectRatio: '', upstreamCost: '', userBasePrice: '' }] })}><FiPlus aria-hidden /> 添加档位</button></div>
              <div className={styles.tierList}>{imageForm.tiers.map((tier, index) => (
                <div className={styles.tier} key={index}>
                  <label className={styles.field}>比例<input value={tier.aspectRatio} placeholder="1:1" onChange={(e) => setImageForm({ ...imageForm, tiers: imageForm.tiers.map((item, i) => i === index ? { ...item, aspectRatio: e.target.value } : item) })} /></label>
                  <label className={styles.field}>真实成本（元 / 张）<input value={tier.upstreamCost} inputMode="decimal" onChange={(e) => setImageForm({ ...imageForm, tiers: imageForm.tiers.map((item, i) => i === index ? { ...item, upstreamCost: e.target.value } : item) })} /></label>
                  <label className={styles.field}>用户价格（织梦豆 / 张）<input value={tier.userBasePrice} inputMode="decimal" onChange={(e) => setImageForm({ ...imageForm, tiers: imageForm.tiers.map((item, i) => i === index ? { ...item, userBasePrice: e.target.value } : item) })} /></label>
                  <button type="button" className={styles.iconButton} aria-label={`删除比例档位 ${index + 1}`} onClick={() => setImageForm({ ...imageForm, tiers: imageForm.tiers.filter((_, i) => i !== index) })}><FiTrash2 aria-hidden /></button>
                </div>
              ))}</div>
            </>
          ) : null}
            <label className={styles.field}>
              未来生效时间（可选）
              <input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />
              <span className={styles.helper}>按浏览器所在时区填写，留空即发布后立即生效。</span>
            </label>
            <label className={styles.field}>
              版本备注（备注内容为发布记录留存显示文本）
              {model.capability === 'text' ? (
                <textarea value={textForm.remark} onChange={(e) => setTextForm({ ...textForm, remark: e.target.value })} />
              ) : (
                <textarea value={imageForm.remark} onChange={(e) => setImageForm({ ...imageForm, remark: e.target.value })} />
              )}
            </label>
          </fieldset>
          </> : null}
          {history.length ? (
            <details className={styles.historyDisclosure}>
              <summary className={styles.historySummary}>
                <span>发布记录</span>
                <span className={styles.historySummaryMeta}>{history.length} 条 <FiChevronDown aria-hidden /></span>
              </summary>
              <ul className={styles.history}>{history.map((version) => <li key={version.id}><code>{version.versionCode}</code><span>{version.effectiveAt ? new Date(version.effectiveAt).toLocaleString() : '未设置'}</span></li>)}</ul>
            </details>
          ) : null}
          <div className={styles.dialogActions}>
            <p className={styles.helper} role="status">{saving ? '正在提交…' : lifecycle && (!draft || draftChanged) ? '请先保存草稿，再发布版本。' : ''}</p>
            <div className={styles.cardActions}>
              <button type="button" className={styles.secondary} disabled={saving || !lifecycle} onClick={() => void saveDraft()}>保存草稿</button>
              <button type="button" className={styles.primary} disabled={saving || !draft || Boolean(draftChanged)} onClick={() => void publish()}>{effectiveAt ? '定时发布' : '立即发布'}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ModelPricingDialog;
