import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle, FiEdit2, FiPower } from 'react-icons/fi';
import type { AiModelCatalogCard } from '../../lib/aiModelCatalog';
import styles from './modelCatalog.module.css';

interface Props {
  items: AiModelCatalogCard[];
  emptyText: string;
  onEdit?: (item: AiModelCatalogCard) => void;
  onActivate?: (item: AiModelCatalogCard) => void;
  onDeactivate?: (item: AiModelCatalogCard) => void;
  activatingId?: number | null;
  deactivatingId?: number | null;
  showRuntimeActive?: boolean;
}

const ModelCatalogCards: React.FC<Props> = ({
  items,
  emptyText,
  onEdit,
  onActivate,
  onDeactivate,
  activatingId,
  deactivatingId,
  showRuntimeActive = true,
}) => {
  const { t } = useTranslation();
  const pricingLabels = useMemo(() => ({
    active: t('aiModelCenter.catalog.pricingActive'),
    scheduled: t('aiModelCenter.catalog.pricingScheduled'),
    draft: t('aiModelCenter.catalog.pricingDraft'),
    unpriced: t('aiModelCenter.catalog.pricingUnpriced'),
  }), [t]);

  if (items.length === 0) return <div className={styles.empty}>{emptyText}</div>;
  return (
    <div className={styles.cardGrid}>
      {items.map((item) => (
        <article key={item.id} className={showRuntimeActive && item.active ? styles.cardActive : styles.card}>
          <div className={styles.cardTopline}>
            <span className={styles.vendor}>{item.sourceGatewayLabel}</span>
            <div className={styles.cardActions}>
              {showRuntimeActive && item.active ? (
                <span className={styles.activeBadge}><FiCheckCircle aria-hidden /> {t('aiModelCenter.catalog.enabled')}</span>
              ) : null}
              {onActivate ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t('aiModelCenter.catalog.enableModelAria', { name: item.displayName })}
                  title={item.pricingStatus === 'active' ? t('aiModelCenter.catalog.enableModel') : t('aiModelCenter.catalog.needPricingFirst')}
                  onClick={() => onActivate(item)}
                  disabled={item.pricingStatus !== 'active' || activatingId === item.id}
                >
                  <FiPower aria-hidden />
                </button>
              ) : null}
              {onDeactivate ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t('aiModelCenter.catalog.disableModelAria', { name: item.displayName })}
                  title={t('aiModelCenter.catalog.disableModel')}
                  onClick={() => onDeactivate(item)}
                  disabled={deactivatingId === item.id}
                >
                  <FiPower aria-hidden />
                </button>
              ) : null}
              {onEdit ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t('aiModelCenter.catalog.editBillingAria', { name: item.displayName })}
                  title={t('aiModelCenter.catalog.editBilling')}
                  onClick={() => onEdit(item)}
                >
                  <FiEdit2 aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <h4>{item.displayName}</h4>
          <code className={styles.modelId}>{item.modelId}</code>
          <div className={styles.cardMeta}>
            <span>{item.sourceKind === 'preset' ? t('aiModelCenter.catalog.presetModel') : t('aiModelCenter.catalog.upstreamImport')}</span>
            <span data-status={item.pricingStatus}>{pricingLabels[item.pricingStatus]}</span>
          </div>
        </article>
      ))}
    </div>
  );
};

export default ModelCatalogCards;
