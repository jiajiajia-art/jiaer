import React from 'react';
import {
  AI_IMAGE_RESOLUTIONS,
  AI_VIDEO_PRICE_SCOPES,
  AI_VIDEO_RESOLUTIONS,
  createTierPriceKey,
  type AiModelPricingDraft,
  type AiModelPricingErrors,
} from '../lib/aiModelPricing';
import styles from './AiModelPricingManager.module.css';

interface AiModelPricingPriceFieldsProps {
  draft: AiModelPricingDraft;
  errors: AiModelPricingErrors;
  disabled: boolean;
  onPriceChange: (field: string, value: string) => void;
}

const TOKEN_FIELDS = [
  { field: 'inputPrice', label: '输入价格' },
  { field: 'outputPrice', label: '输出价格' },
  { field: 'cachedInputPrice', label: '缓存命中价格' },
] as const;

const AiModelPricingPriceFields: React.FC<AiModelPricingPriceFieldsProps> = ({
  draft,
  errors,
  disabled,
  onPriceChange,
}) => {
  if (draft.billingType === 'token') {
    return (
      <div className={styles.priceFields}>
        <div className={styles.priceFieldsHeading}>
          <strong>Token 价格</strong>
          <span>元 / 百万 tokens</span>
        </div>
        <div className={styles.tokenPriceGrid}>
          {TOKEN_FIELDS.map(({ field, label }) => (
            <label className={styles.field} key={field}>
              <span>{label}</span>
              <input
                type="text"
                inputMode="decimal"
                value={draft[field]}
                onChange={(event) => onPriceChange(field, event.target.value)}
                placeholder="0.0000"
                disabled={disabled}
              />
              {errors[field] ? <small>{errors[field]}</small> : null}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (draft.billingType === 'image') {
    return (
      <div className={styles.priceFields}>
        <div className={styles.priceFieldsHeading}>
          <strong>生图价格</strong>
          <span>元 / 张</span>
        </div>
        <div className={styles.imagePriceGrid}>
          {AI_IMAGE_RESOLUTIONS.map(({ value, label }) => {
            const key = createTierPriceKey('image_output', value);
            return (
              <label className={styles.field} key={key}>
                <span>{label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.tierPrices[key] || ''}
                  onChange={(event) => onPriceChange(key, event.target.value)}
                  placeholder="不支持可留空"
                  disabled={disabled}
                />
                {errors[key] ? <small>{errors[key]}</small> : null}
              </label>
            );
          })}
        </div>
        {errors.tiers ? <small className={styles.tierError}>{errors.tiers}</small> : null}
      </div>
    );
  }

  return (
    <div className={styles.priceFields}>
      <div className={styles.priceFieldsHeading}>
        <strong>生视频价格</strong>
        <span>元 / 秒</span>
      </div>
      <div className={styles.videoMatrixScroll}>
        <div className={styles.videoMatrix}>
          <div className={styles.videoMatrixCorner}>场景 / 分辨率</div>
          {AI_VIDEO_RESOLUTIONS.map(({ value, label }) => (
            <div className={styles.videoMatrixHeader} key={value}>{label}</div>
          ))}
          {AI_VIDEO_PRICE_SCOPES.map(({ value: scope, label }) => (
            <React.Fragment key={scope}>
              <div className={styles.videoMatrixScope}>{label}</div>
              {AI_VIDEO_RESOLUTIONS.map(({ value: resolution }) => {
                const key = createTierPriceKey(scope, resolution);
                return (
                  <label className={styles.videoMatrixCell} key={key}>
                    <span className={styles.srOnly}>{label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.tierPrices[key] || ''}
                      onChange={(event) => onPriceChange(key, event.target.value)}
                      placeholder="—"
                      aria-invalid={Boolean(errors[key])}
                      title={errors[key] || ''}
                      disabled={disabled}
                    />
                    {errors[key] ? <small>{errors[key]}</small> : null}
                  </label>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      {errors.tiers ? <small className={styles.tierError}>{errors.tiers}</small> : null}
      <p className={styles.priceHint}>有参考视频时，同一分辨率的输入与输出价格必须成对填写。</p>
    </div>
  );
};

export default AiModelPricingPriceFields;
