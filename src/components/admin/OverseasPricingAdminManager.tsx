import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import overseasPricingApi, { type OverseasPricingPlan } from '../../api/admin/overseasPricingApi';
import { DEFAULT_OVERSEAS_RATE, toOverseasPrice } from '../../lib/rechargeAmountRules';
import { getApiErrorMessage } from '../../utils/error';
import baseStyles from '../DiamondAdminManager.module.css';
import styles from './OverseasPricingAdminManager.module.css';

/** 后端未返回档位时的兜底列表（与前台默认 KK 币档位一致） */
const FALLBACK_PLANS: OverseasPricingPlan[] = [6, 30, 68, 128, 328].map((price) => ({
  planId: `dr_${price}_v2`,
  label: `${price * 10} KK币`,
  cnyPrice: price,
  multiplier: null,
}));

const parseMultiplier = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

/** 功能注释：后台配置海外充值倍率，海外价 = 人民币价 × 倍率；档位可单独覆盖默认倍率。 */
const OverseasPricingAdminManager: React.FC = () => {
  const [plans, setPlans] = useState<OverseasPricingPlan[]>(FALLBACK_PLANS);
  const [defaultInput, setDefaultInput] = useState(String(DEFAULT_OVERSEAS_RATE));
  const [planInputs, setPlanInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await overseasPricingApi.get();
      const cfg = data.data;
      if (cfg) {
        const list = cfg.plans?.length ? cfg.plans : FALLBACK_PLANS;
        setPlans(list);
        setDefaultInput(String(cfg.defaultMultiplier ?? DEFAULT_OVERSEAS_RATE));
        setPlanInputs(Object.fromEntries(list.map((p) => [p.planId, p.multiplier == null ? '' : String(p.multiplier)])));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载海外倍率配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const defaultMultiplier = parseMultiplier(defaultInput);
  const defaultInvalid = defaultMultiplier == null || Number.isNaN(defaultMultiplier);
  const invalidPlanIds = useMemo(
    () => plans.filter((p) => Number.isNaN(parseMultiplier(planInputs[p.planId] ?? ''))).map((p) => p.planId),
    [planInputs, plans],
  );

  const handleSave = async () => {
    if (defaultInvalid || invalidPlanIds.length) {
      toast.error('倍率需为大于 0 的数字');
      return;
    }
    setSaving(true);
    try {
      await overseasPricingApi.update({
        defaultMultiplier: defaultMultiplier as number,
        plans: plans.map((p) => ({ ...p, multiplier: parseMultiplier(planInputs[p.planId] ?? '') })),
      });
      toast.success('海外倍率已保存');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={baseStyles.card}>
      <div className={baseStyles.cardHeader}>
        <div>
          <h3 className={baseStyles.cardTitle}>海外充值倍率</h3>
          <p className={baseStyles.cardDesc}>海外价（USD）= 人民币价 × 倍率。档位留空则使用默认倍率，KK币到账数不变。</p>
        </div>
      </div>

      <div className={baseStyles.formArea}>
        <label className={baseStyles.fieldLabel} htmlFor="overseas-default-multiplier">默认倍率</label>
        <div className={styles.multiplierField}>
          <span className={styles.multiplierPrefix}>人民币 ×</span>
          <input
            id="overseas-default-multiplier"
            className={`${baseStyles.textInput} ${defaultInvalid ? baseStyles.inputError : ''}`}
            inputMode="decimal"
            value={defaultInput}
            onChange={(e) => setDefaultInput(e.target.value.replace(/[^\d.]/g, ''))}
            disabled={loading || saving}
          />
        </div>

        <div className={styles.table} role="table" aria-label="档位倍率">
          <div className={`${styles.row} ${styles.headRow}`} role="row">
            <span>档位</span><span>人民币价</span><span>倍率</span><span>海外价</span>
          </div>
          {plans.map((plan) => {
            const raw = planInputs[plan.planId] ?? '';
            const own = parseMultiplier(raw);
            const effective = own && !Number.isNaN(own) ? own : defaultInvalid ? null : (defaultMultiplier as number);
            const invalid = invalidPlanIds.includes(plan.planId);
            return (
              <div className={styles.row} role="row" key={plan.planId}>
                <span className={styles.planLabel}>{plan.label}</span>
                <span>¥{plan.cnyPrice}</span>
                <span className={styles.multiplierField}>
                  <span className={styles.multiplierPrefix}>×</span>
                  <input
                    aria-label={`${plan.label} 倍率`}
                    className={`${baseStyles.textInput} ${invalid ? baseStyles.inputError : ''}`}
                    inputMode="decimal"
                    placeholder={`默认 ${defaultInvalid ? '-' : defaultMultiplier}`}
                    value={raw}
                    onChange={(e) => setPlanInputs((prev) => ({ ...prev, [plan.planId]: e.target.value.replace(/[^\d.]/g, '') }))}
                    disabled={loading || saving}
                  />
                </span>
                <strong className={styles.price}>
                  {effective == null ? '—' : `$${toOverseasPrice(plan.cnyPrice, effective).toFixed(2)}`}
                </strong>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={baseStyles.primaryButton}
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          {saving ? '保存中...' : '保存倍率'}
        </button>
      </div>
    </section>
  );
};

export default OverseasPricingAdminManager;
