import React from 'react';
import { FiCheckCircle, FiEdit2, FiPower } from 'react-icons/fi';
import type { AiModelCatalogCard } from '../../lib/aiModelCatalog';
import styles from './modelCatalog.module.css';

const pricingLabels = {
  active: '价格已生效',
  scheduled: '价格待生效',
  draft: '价格草稿',
  unpriced: '未配置价格',
} as const;

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
  if (items.length === 0) return <div className={styles.empty}>{emptyText}</div>;
  return (
    <div className={styles.cardGrid}>
      {items.map((item) => (
        <article key={item.id} className={showRuntimeActive && item.active ? styles.cardActive : styles.card}>
          <div className={styles.cardTopline}>
            <span className={styles.vendor}>{item.sourceGatewayLabel}</span>
            <div className={styles.cardActions}>
              {showRuntimeActive && item.active ? (
                <span className={styles.activeBadge}><FiCheckCircle aria-hidden /> 已启用</span>
              ) : null}
              {onActivate ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`启用模型 ${item.displayName}`}
                  title={item.pricingStatus === 'active' ? '启用模型' : '需先发布并生效价格'}
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
                  aria-label={`停用模型 ${item.displayName}`}
                  title="停用模型"
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
                  aria-label={`编辑模型 ${item.displayName} 的计费配置`}
                  title="编辑计费配置"
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
            <span>{item.sourceKind === 'preset' ? '预置模型' : '上游导入'}</span>
            <span data-status={item.pricingStatus}>{pricingLabels[item.pricingStatus]}</span>
          </div>
        </article>
      ))}
    </div>
  );
};

export default ModelCatalogCards;
