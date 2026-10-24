import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import imageBusinessConfigApi, {
  type AdminImageBusinessConfig,
  type ImageBusinessAvailableModel,
} from '../api/admin/imageBusinessConfigApi';
import { getApiErrorMessage } from '../utils/error';
import styles from './ImageBusinessConfigPanel.module.css';

const CATEGORY_LABELS: Record<string, string> = {
  ai_text_creation: 'AI 文游创作',
  ai_text_play: 'AI 文游游玩',
  platform: '平台',
};

function requiredRatios(item: AdminImageBusinessConfig) {
  return [...new Set(item.resolutions.map((resolution) => resolution.aspectRatio.toLowerCase()))];
}

function isModelCompatible(item: AdminImageBusinessConfig, model: ImageBusinessAvailableModel) {
  if (!model.selectable || !model.activePricingVersionId) return false;
  const available = new Set(model.imageTiers.map((tier) => tier.aspectRatio.toLowerCase()));
  return requiredRatios(item).every((ratio) => available.has(ratio));
}

const ImageBusinessConfigPanel: React.FC = () => {
  const [items, setItems] = useState<AdminImageBusinessConfig[]>([]);
  const [availableModels, setAvailableModels] = useState<ImageBusinessAvailableModel[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number | null>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await imageBusinessConfigApi.list();
      const data = response.data.data;
      setItems(data?.items || []);
      setAvailableModels(data?.availableModels || []);
      setDrafts(Object.fromEntries((data?.items || []).map((item) => [item.scenarioKey, item.modelCatalogId])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, '业务配置加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const compatibleModels = useMemo(() => Object.fromEntries(items.map((item) => [
    item.scenarioKey,
    availableModels.filter((model) => isModelCompatible(item, model)),
  ])), [availableModels, items]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      label: string;
      order: number;
      items: AdminImageBusinessConfig[];
    }>();
    for (const item of items) {
      const key = item.categoryKey || 'platform';
      const group = groups.get(key) || {
        key,
        label: item.categoryLabel || CATEGORY_LABELS[key] || '平台',
        order: item.categoryOrder || 99,
        items: [],
      };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((left, right) => left.order - right.order)
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => left.order - right.order),
      }));
  }, [items]);

  const save = async (item: AdminImageBusinessConfig) => {
    const modelCatalogId = drafts[item.scenarioKey];
    if (!modelCatalogId) return;
    setSavingKey(item.scenarioKey);
    try {
      await imageBusinessConfigApi.update(item.scenarioKey, {
        modelCatalogId,
        primaryAspectRatioKey: item.primaryAspectRatioKey,
        expectedUpdatedAt: item.updatedAt,
      });
      toast.success('业务配置已保存');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '业务配置保存失败'));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className={styles.loading}>正在加载业务配置…</div>;

  return (
    <div className={styles.root}>
      <p className={styles.intro}>
        每个平台业务场景独立选择生图模型。分辨率与降档顺序按当前业务实现固定，最终按实际成功的分辨率档位结算。
      </p>
      <div className={styles.list}>
        {groupedItems.map((group) => (
          <section className={styles.group} key={group.key}>
            <h3 className={styles.groupTitle}>{group.label}</h3>
            <div className={styles.groupRows}>
              {group.items.map((item) => {
                const models = compatibleModels[item.scenarioKey] || [];
                const selected = drafts[item.scenarioKey] || null;
                return (
                  <article className={styles.row} key={item.scenarioKey}>
                    <div>
                      <h4 className={styles.title}>{item.label}</h4>
                      <p className={styles.meta}>
                        {item.resolutions.map((resolution) => `${resolution.size} (${resolution.aspectRatio})`).join(' → ')}
                      </p>
                    </div>
                    <select
                      className={styles.select}
                      value={selected ?? ''}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [item.scenarioKey]: Number(event.target.value) || null,
                      }))}
                    >
                      <option value="">请选择兼容模型</option>
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.displayName} · {model.sourceGatewayLabel}
                        </option>
                      ))}
                    </select>
                    <div>
                      {item.pricing?.resolutions?.length ? (
                        <p className={styles.price}>
                          {item.pricing.resolutions.map((resolution) => (
                            `${resolution.aspectRatio}: ${resolution.estimatedPoints}织梦豆/张`
                          )).join(' · ')}
                        </p>
                      ) : <p className={styles.error}>{item.validationError?.message || '价格暂不可用'}</p>}
                    </div>
                    <button
                      type="button"
                      className={styles.save}
                      disabled={!selected || selected === item.modelCatalogId || savingKey === item.scenarioKey}
                      onClick={() => void save(item)}
                    >
                      {savingKey === item.scenarioKey ? '保存中…' : '保存'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default ImageBusinessConfigPanel;
