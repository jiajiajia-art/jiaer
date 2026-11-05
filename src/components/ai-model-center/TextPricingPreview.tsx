import React, { useMemo, useState } from 'react';
import type { TextPricingDraftForm } from '../../lib/aiModelCatalog';
import {
  calculateTextPricingPreview,
  formatKkMinor,
  formatMarginTenths,
  formatMicroYuan,
  type TextPricingPreviewContext,
  type TextPricingPreviewView,
} from '../../lib/aiPricingPreview';
import styles from './modelCatalog.module.css';

interface Props {
  pricing: TextPricingDraftForm;
  context: TextPricingPreviewContext;
}

interface ResultColumnProps {
  title: string;
  view: TextPricingPreviewView;
  realCostMicroYuan: bigint;
  kkMinorScale: number;
  member?: boolean;
}

const ResultColumn: React.FC<ResultColumnProps> = ({
  title,
  view,
  realCostMicroYuan,
  kkMinorScale,
  member = false,
}) => {
  const marginValue = view.marginTenths === null ? 0 : Number(view.marginTenths) / 10;
  const meterValue = Math.min(100, Math.max(0, marginValue));
  const isLoss = view.profitMicroYuan < 0n;
  const chargeLabel = member ? '会员实际扣费' : '用户扣费';
  const revenueLabel = member ? '折后人民币收入' : '人民币收入等值';
  const costLabel = member ? '模型真实成本（折扣不影响）' : '模型真实成本';
  const profitLabel = member ? '折后真实毛利额' : '真实毛利额';
  const marginLabel = member ? '折后真实毛利率' : '真实毛利率';

  return (
    <section className={styles.previewResultCard} aria-label={title}>
      <h5>{title}</h5>
      <dl className={styles.previewMetrics}>
        <div><dt>{chargeLabel}</dt><dd>{formatKkMinor(view.userChargeKkMinor, kkMinorScale)} KK币</dd></div>
        <div><dt>{revenueLabel}</dt><dd>¥{formatMicroYuan(view.revenueMicroYuan)}</dd></div>
        <div><dt>{costLabel}</dt><dd>¥{formatMicroYuan(realCostMicroYuan)}</dd></div>
        <div><dt>{profitLabel}</dt><dd className={isLoss ? styles.previewLoss : undefined}>¥{formatMicroYuan(view.profitMicroYuan)}</dd></div>
      </dl>
      <div className={`${styles.marginPanel} ${isLoss ? styles.marginPanelLoss : ''}`}>
        <span>{marginLabel}</span>
        <strong>{formatMarginTenths(view.marginTenths)}</strong>
        <div
          className={styles.marginTrack}
          role="meter"
          aria-label={`${title}${marginLabel}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meterValue}
          aria-valuetext={formatMarginTenths(view.marginTenths)}
        >
          <span style={{ width: `${meterValue}%` }} />
        </div>
      </div>
    </section>
  );
};

const TextPricingPreview: React.FC<Props> = ({ pricing, context }) => {
  const [inputTokens, setInputTokens] = useState('600000');
  const [outputTokens, setOutputTokens] = useState('400000');
  const [cachedInputTokens, setCachedInputTokens] = useState('0');

  const preview = useMemo(() => {
    try {
      return {
        result: calculateTextPricingPreview({
          inputTokens,
          outputTokens,
          cachedInputTokens,
          inputPrice: pricing.inputPrice,
          outputPrice: pricing.outputPrice,
          cachedInputPrice: pricing.cachedInputPrice,
          multiplier: pricing.multiplier,
          context,
        }),
        error: '',
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : '核价参数无效',
      };
    }
  }, [cachedInputTokens, context, inputTokens, outputTokens, pricing]);

  const memberDiscountLabel = context.memberChargePercent === 100
    ? '无折扣'
    : `${context.memberChargePercent / 10}折`;

  return (
    <section className={styles.pricingPreview} aria-labelledby="pricing-preview-title">
      <header className={styles.previewHeader}>
        <div>
          <h4 id="pricing-preview-title">运营核价实时预览</h4>
          <p>修改 tokens、真实成本或用户价格倍率后自动重新计算。</p>
        </div>
        <span>会员比例由后端只读同步：{memberDiscountLabel}</span>
      </header>

      <div className={styles.previewTokenGrid}>
        <label className={styles.field} htmlFor="preview-input-tokens">
          预计输入 tokens（未缓存）
          <input id="preview-input-tokens" value={inputTokens} inputMode="numeric" onChange={(event) => setInputTokens(event.target.value)} />
        </label>
        <label className={styles.field} htmlFor="preview-output-tokens">
          预计输出 tokens
          <input id="preview-output-tokens" value={outputTokens} inputMode="numeric" onChange={(event) => setOutputTokens(event.target.value)} />
        </label>
        <label className={styles.field} htmlFor="preview-cached-tokens">
          预计缓存命中 tokens
          <input id="preview-cached-tokens" value={cachedInputTokens} inputMode="numeric" onChange={(event) => setCachedInputTokens(event.target.value)} />
        </label>
      </div>

      {preview.error ? (
        <div className={styles.previewError} role="alert">无法试算：{preview.error}。请检查 tokens、成本和倍率。</div>
      ) : null}

      {preview.result ? (
        <div className={styles.previewResults} aria-live="polite">
          <ResultColumn
            title="创作端 / 游玩端普通用户"
            view={preview.result.regular}
            realCostMicroYuan={preview.result.realCostMicroYuan}
            kkMinorScale={context.kkMinorScale}
          />
          <ResultColumn
            title={`游玩端会员折后（${memberDiscountLabel}）`}
            view={preview.result.member}
            realCostMicroYuan={preview.result.realCostMicroYuan}
            kkMinorScale={context.kkMinorScale}
            member
          />
        </div>
      ) : null}

      <p className={styles.previewFootnote}>
        收入等值按 1 元 = {context.kkPerYuan} KK币换算；输入 tokens 指未缓存输入，缓存命中单独按缓存成本计算。
        会员折扣只影响用户扣费和收入，不改变模型真实成本；最终订单仍按实际 tokens 与锁定计费版本结算。
      </p>
    </section>
  );
};

export default TextPricingPreview;
