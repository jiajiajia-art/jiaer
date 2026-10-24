import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
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
}

const ModelPricingDialog: React.FC<Props> = ({ model, onClose, onChanged }) => {
  const [lifecycle, setLifecycle] = useState<AiModelPricingLifecycle | null>(null);
  const [textForm, setTextForm] = useState(blankText);
  const [imageForm, setImageForm] = useState(blankImage);
  const [effectiveAt, setEffectiveAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
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

  useEffect(() => { void load(); }, [model.id]);

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
    if (!lifecycle?.draft) {
      setError('请先保存计费草稿，再发布版本');
      return;
    }
    const scheduled = effectiveAt ? new Date(effectiveAt) : null;
    if (scheduled && Number.isNaN(scheduled.getTime())) {
      setError('生效时间格式无效');
      return;
    }
    const hasScheduled = Boolean(lifecycle.scheduled);
    const replaceScheduled = hasScheduled && window.confirm('已有待生效版本，是否替换为当前草稿？');
    if (hasScheduled && !replaceScheduled) return;
    const confirmation = scheduled
      ? `确认发布，并于 ${scheduled.toLocaleString()} 生效？`
      : '确认立即发布当前计费草稿？';
    if (!window.confirm(confirmation)) return;
    setSaving(true); setError('');
    try {
      const payload = buildModelPublishPayload({
        effectiveAt: scheduled?.toISOString() || null,
        hasScheduledVersion: hasScheduled,
        replaceScheduled,
      });
      await aiModelCenterApi.publishModelPricing(model.id, payload);
      toast.success(scheduled ? '计费版本已定时发布' : '计费版本已发布');
      await load();
      await onChanged();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '计费版本发布失败'));
    } finally { setSaving(false); }
  };

  const history = useMemo(() => lifecycle?.history || [], [lifecycle]);

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pricing-dialog-title">
        <header className={styles.dialogHeader}>
          <div><h3 id="pricing-dialog-title">{model.displayName} · 计费配置</h3><p>计费版本独立发布，不影响其他模型。</p></div>
          <button type="button" className={styles.iconButton} aria-label="关闭计费配置" onClick={onClose}><FiX aria-hidden /></button>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.readonly}>
            <div><span>渠道</span><strong>{model.sourceGatewayLabel}</strong></div>
            <div><span>模型 ID</span><code>{model.modelId}</code></div>
          </div>
          {loading ? <p>加载中…</p> : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {!loading && model.capability === 'text' ? (
            <>
              <div className={styles.readonly}><div><span>用户统一计费标准</span><strong>0.1 KK / 1,000 Token</strong></div><div><span>计费 Token</span><strong>输入 + 输出 + 缓存命中</strong></div></div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>输入真实成本（元 / 百万 Token）<input value={textForm.inputPrice} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, inputPrice: e.target.value })} /></label>
                <label className={styles.field}>输出真实成本（元 / 百万 Token）<input value={textForm.outputPrice} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, outputPrice: e.target.value })} /></label>
                <label className={styles.field}>缓存命中成本（元 / 百万 Token）<input value={textForm.cachedInputPrice} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, cachedInputPrice: e.target.value })} /></label>
                <label className={styles.field}>用户价格倍率<input value={textForm.multiplier} inputMode="decimal" onChange={(e) => setTextForm({ ...textForm, multiplier: e.target.value })} /><span className={styles.helper}>1 表示不加价，权益折扣在动态价之后应用。</span></label>
              </div>
              <label className={styles.field}>版本备注<textarea value={textForm.remark} onChange={(e) => setTextForm({ ...textForm, remark: e.target.value })} /></label>
            </>
          ) : null}
          {!loading && model.capability === 'image' ? (
            <>
              <label className={styles.field}>用户价格倍率<input value={imageForm.multiplier} inputMode="decimal" onChange={(e) => setImageForm({ ...imageForm, multiplier: e.target.value })} /><span className={styles.helper}>生图倍率独立于生文倍率。</span></label>
              <div className={styles.tierHead}><strong>比例档位</strong><button type="button" className={styles.secondary} onClick={() => setImageForm({ ...imageForm, tiers: [...imageForm.tiers, { aspectRatio: '', upstreamCost: '', userBasePrice: '' }] })}><FiPlus aria-hidden /> 添加档位</button></div>
              <div className={styles.tierList}>{imageForm.tiers.map((tier, index) => (
                <div className={styles.tier} key={`${index}-${tier.aspectRatio}`}>
                  <label className={styles.field}>比例<input value={tier.aspectRatio} placeholder="1:1" onChange={(e) => setImageForm({ ...imageForm, tiers: imageForm.tiers.map((item, i) => i === index ? { ...item, aspectRatio: e.target.value } : item) })} /></label>
                  <label className={styles.field}>真实成本（元 / 张）<input value={tier.upstreamCost} inputMode="decimal" onChange={(e) => setImageForm({ ...imageForm, tiers: imageForm.tiers.map((item, i) => i === index ? { ...item, upstreamCost: e.target.value } : item) })} /></label>
                  <label className={styles.field}>用户价格（织梦豆 / 张）<input value={tier.userBasePrice} inputMode="decimal" onChange={(e) => setImageForm({ ...imageForm, tiers: imageForm.tiers.map((item, i) => i === index ? { ...item, userBasePrice: e.target.value } : item) })} /></label>
                  <button type="button" className={styles.iconButton} aria-label={`删除比例档位 ${index + 1}`} onClick={() => setImageForm({ ...imageForm, tiers: imageForm.tiers.filter((_, i) => i !== index) })}><FiTrash2 aria-hidden /></button>
                </div>
              ))}</div>
              <label className={styles.field}>版本备注<textarea value={imageForm.remark} onChange={(e) => setImageForm({ ...imageForm, remark: e.target.value })} /></label>
            </>
          ) : null}
          <div className={styles.fieldGrid}>
            <label className={styles.field}>未来生效时间（可选）<input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} /></label>
          </div>
          {history.length ? <div><strong>发布记录</strong><ul className={styles.history}>{history.map((version) => <li key={version.id}><code>{version.versionCode}</code><span>{version.effectiveAt ? new Date(version.effectiveAt).toLocaleString() : '未设置'}</span></li>)}</ul></div> : null}
          <div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={onClose}>关闭</button><div className={styles.cardActions}><button type="button" className={styles.secondary} disabled={saving || loading} onClick={() => void saveDraft()}>{saving ? '处理中…' : '保存草稿'}</button><button type="button" className={styles.primary} disabled={saving || loading || !lifecycle?.draft} onClick={() => void publish()}>发布版本</button></div></div>
        </div>
      </section>
    </div>
  );
};

export default ModelPricingDialog;
