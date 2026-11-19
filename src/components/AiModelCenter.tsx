import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
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
  const { t } = useTranslation();
  const location = useLocation();
  const tab: CenterTab = location.pathname.endsWith('/usage')
    ? 'usage'
    : location.pathname.endsWith('/runtime') && isAdmin
      ? 'runtime'
      : 'models';
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
      setError(getApiErrorMessage(requestError, t('aiModelCenter.center.catalogLoadFailed')));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void loadModels(); }, [loadModels]);

  const grouped = useMemo(() => toModelCatalogCards(models), [models]);
  return <div className={styles.root}>
    {error && tab !== 'usage' ? <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void loadModels()}>{t('aiModelCenter.center.retry')}</button></div> : null}
    {loading && tab !== 'usage' ? <div className={styles.state}>{t('aiModelCenter.center.loading')}</div> : null}

    {!loading && tab === 'models' ? <div className={styles.stack}>
      <section className={styles.panel}><div className={styles.panelHead}><div><h3>{t('aiModelCenter.center.textModelsTitle')}</h3><p>{t('aiModelCenter.center.textModelsDesc')}</p></div><button type="button" className={styles.secondary} onClick={() => void loadModels()} disabled={loading}>{t('aiModelCenter.center.refresh')}</button></div><ModelCatalogCards items={grouped.text} emptyText={t('aiModelCenter.center.emptyTextModels')} onEdit={setEditing} /></section>
      <section className={styles.panel}><div className={styles.panelHead}><div><h3>{t('aiModelCenter.center.imageModelsTitle')}</h3><p>{t('aiModelCenter.center.imageModelsDesc')}</p></div></div><ModelCatalogCards items={grouped.image} emptyText={t('aiModelCenter.center.emptyImageModels')} onEdit={setEditing} showRuntimeActive={false} /></section>
    </div> : null}

    {tab === 'usage' ? <AiUsageDashboard /> : null}

    {!loading && tab === 'runtime' && isAdmin ? <ModelConfigHub /> : null}
    {editing ? <ModelPricingDialog model={editing} onClose={() => setEditing(null)} onChanged={loadModels} /> : null}
  </div>;
};

export default AiModelCenter;
