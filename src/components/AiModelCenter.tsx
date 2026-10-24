import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ModelConfigHub from './ModelConfigHub';
import AiUsageDashboard from './ai-model-center/AiUsageDashboard';
import ModelCatalogCards from './ai-model-center/ModelCatalogCards';
import ModelPricingDialog from './ai-model-center/ModelPricingDialog';
import aiModelCenterApi, { type AiBillingModelCatalogRow } from '../api/operator/aiModelCenterApi';
import { toModelCatalogCards, type AiModelCatalogCard } from '../lib/aiModelCatalog';
import { getApiErrorMessage } from '../utils/error';
import styles from './AiModelCenter.module.css';

type CenterTab = 'models' | 'usage' | 'runtime';

const AiModelCenter: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const [tab, setTab] = useState<CenterTab>('models');
  const [models, setModels] = useState<AiBillingModelCatalogRow[]>([]);
  const [editing, setEditing] = useState<AiModelCatalogCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadModels = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await aiModelCenterApi.listModels();
      setModels(response.data.data?.items || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'AI 模型目录加载失败'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadModels(); }, [loadModels]);

  const grouped = useMemo(() => toModelCatalogCards(models), [models]);
  const tabs = useMemo(() => [
    { id: 'models' as const, label: '模型与计费' },
    { id: 'usage' as const, label: '用量与成本' },
    ...(isAdmin ? [{ id: 'runtime' as const, label: '运行配置' }] : []),
  ], [isAdmin]);

  return <div className={styles.root}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>AI MODEL CENTER</span><h2>AI 模型中心</h2><p>模型目录与计费版本集中管理；每个模型独立发布价格，生文全平台统一启用，生图由业务场景分别选择。</p></div>
      {tab !== 'usage' ? <button type="button" className={styles.secondary} onClick={() => void loadModels()} disabled={loading}>刷新</button> : null}
    </header>
    <div className={styles.tabs} role="tablist" aria-label="AI 模型中心">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? styles.tabActive : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </div>
    {error && tab !== 'usage' ? <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void loadModels()}>重试</button></div> : null}
    {loading && tab !== 'usage' ? <div className={styles.state}>加载中…</div> : null}

    {!loading && tab === 'models' ? <div className={styles.stack}>
      <section className={styles.panel}><div className={styles.panelHead}><div><h3>AI 生文模型</h3><p>用户价统一按 0.1 KK / 1,000 Token 为基础，再应用模型倍率和权益；真实成本分输入、输出、缓存命中。</p></div></div><ModelCatalogCards items={grouped.text} emptyText="尚无生文模型，请由管理员在运行配置中拉取并导入。" onEdit={setEditing} /></section>
      <section className={styles.panel}><div className={styles.panelHead}><div><h3>AI 生图模型</h3><p>按模型配置倍率和不同比例档位的真实成本、用户单张价格。</p></div></div><ModelCatalogCards items={grouped.image} emptyText="尚无生图模型，请由管理员在运行配置中拉取并导入。" onEdit={setEditing} showRuntimeActive={false} /></section>
    </div> : null}

    {tab === 'usage' ? <AiUsageDashboard /> : null}

    {!loading && tab === 'runtime' && isAdmin ? <ModelConfigHub /> : null}
    {editing ? <ModelPricingDialog model={editing} onClose={() => setEditing(null)} onChanged={loadModels} /> : null}
  </div>;
};

export default AiModelCenter;
