import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import adminTextLlmConfigApi, { type AdminTextLlmConfigData } from '../api/admin/textLlmConfigApi';
import adminImageGenConfigApi, { type AdminImageGenConfigData } from '../api/admin/imageGenConfigApi';
import aiModelCatalogApi from '../api/admin/aiModelCatalogApi';
import aiModelCenterApi, { type AiBillingModelCatalogRow } from '../api/operator/aiModelCenterApi';
import ModelCatalogCards from './ai-model-center/ModelCatalogCards';
import ModelImportDialog from './ai-model-center/ModelImportDialog';
import ModelPricingDialog from './ai-model-center/ModelPricingDialog';
import ImageBusinessConfigPanel from './ImageBusinessConfigPanel';
import { toModelCatalogCards, type AiModelCapability, type AiModelCatalogCard } from '../lib/aiModelCatalog';
import { getApiErrorMessage } from '../utils/error';
import styles from './ModelConfigHub.module.css';

type Pane = 'text' | 'image';
type GatewayForm = { baseUrl: string; fallback: string; apiKey: string; apiKeySet: boolean; apiKeyHint: string; clearApiKey: boolean };
const emptyGateway = (): GatewayForm => ({ baseUrl: '', fallback: '', apiKey: '', apiKeySet: false, apiKeyHint: '', clearApiKey: false });

const ModelConfigHub: React.FC = () => {
  const { t } = useTranslation();
  const capabilityLabel = (cap: 'text' | 'image') => (
    cap === 'text' ? t('aiModelCenter.catalog.capabilityText') : t('aiModelCenter.catalog.capabilityImage')
  );
  const [pane, setPane] = useState<Pane>('text');
  const [textGateway, setTextGateway] = useState(emptyGateway);
  const [imageGateway, setImageGateway] = useState(emptyGateway);
  const [models, setModels] = useState<AiBillingModelCatalogRow[]>([]);
  const [fetched, setFetched] = useState<Record<Pane, string[]>>({ text: [], image: [] });
  const [importCapability, setImportCapability] = useState<AiModelCapability | null>(null);
  const [editing, setEditing] = useState<AiModelCatalogCard | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState<Record<Pane, boolean>>({ text: false, image: false });
  const [apiKeyLoading, setApiKeyLoading] = useState<Pane | null>(null);

  const applyTextConfig = (data: AdminTextLlmConfigData) => setTextGateway({
    baseUrl: String(data.openaiBaseUrl || ''),
    fallback: String(data.openaiBaseUrlFallback || ''),
    apiKey: '', apiKeySet: Boolean(data.apiKeySet), apiKeyHint: String(data.apiKeyHint || ''), clearApiKey: false,
  });
  const applyImageConfig = (data: AdminImageGenConfigData) => setImageGateway({
    baseUrl: String(data.openaiBaseUrl || ''),
    fallback: String(data.openaiBaseUrlFallback || ''),
    apiKey: '', apiKeySet: Boolean(data.apiKeySet), apiKeyHint: String(data.apiKeyHint || ''), clearApiKey: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setApiKeyVisible({ text: false, image: false });
    try {
      const [textResponse, imageResponse, modelsResponse] = await Promise.all([
        adminTextLlmConfigApi.getConfig(), adminImageGenConfigApi.getConfig(), aiModelCenterApi.listModels(),
      ]);
      if (textResponse.data.data) applyTextConfig(textResponse.data.data);
      if (imageResponse.data.data) applyImageConfig(imageResponse.data.data);
      setModels(modelsResponse.data.data?.items || []);
    } catch (error) { toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.loadFailed'))); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  const grouped = useMemo(() => toModelCatalogCards(models), [models]);
  const currentGateway = pane === 'text' ? textGateway : imageGateway;
  const setCurrentGateway = (next: GatewayForm) => pane === 'text' ? setTextGateway(next) : setImageGateway(next);
  const currentModels = pane === 'text' ? grouped.text : grouped.image;

  const handlePaneChange = (nextPane: Pane) => {
    setApiKeyVisible({ text: false, image: false });
    setPane(nextPane);
  };

  const handleToggleApiKey = async () => {
    const capability = pane;
    const gateway = capability === 'text' ? textGateway : imageGateway;
    if (apiKeyVisible[capability]) {
      setApiKeyVisible((current) => ({ ...current, [capability]: false }));
      return;
    }
    if (gateway.apiKey || !gateway.apiKeySet) {
      setApiKeyVisible((current) => ({ ...current, [capability]: true }));
      return;
    }

    setApiKeyLoading(capability);
    try {
      const response = capability === 'text'
        ? await adminTextLlmConfigApi.getApiKey(gateway.baseUrl)
        : await adminImageGenConfigApi.getApiKey();
      const openaiApiKey = String(response.data.data?.openaiApiKey || '');
      if (capability === 'text') {
        setTextGateway((current) => ({ ...current, apiKey: openaiApiKey }));
      } else {
        setImageGateway((current) => ({ ...current, apiKey: openaiApiKey }));
      }
      setApiKeyVisible((current) => ({ ...current, [capability]: true }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.apiKeyReadFailed')));
    } finally {
      setApiKeyLoading(null);
    }
  };

  const saveGateway = async (capability: Pane, showToast = true) => {
    const gateway = capability === 'text' ? textGateway : imageGateway;
    const payload = {
      openaiBaseUrl: gateway.baseUrl.trim(),
      openaiApiKey: gateway.clearApiKey ? '' : gateway.apiKey.trim() || undefined,
      clearApiKey: gateway.clearApiKey,
    };
    if (capability === 'text') {
      const response = await adminTextLlmConfigApi.saveConfig(payload);
      if (response.data.data) applyTextConfig(response.data.data);
    } else {
      const response = await adminImageGenConfigApi.saveConfig(payload);
      if (response.data.data) applyImageConfig(response.data.data);
    }
    setApiKeyVisible((current) => ({ ...current, [capability]: false }));
    if (showToast) toast.success(t('aiModelCenter.configHub.gatewaySaved', { capability: capabilityLabel(capability) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try { await saveGateway(pane); }
    catch (error) { toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.gatewaySaveFailed'))); }
    finally { setSaving(false); }
  };

  const handleFetch = async () => {
    setSaving(true);
    try {
      const gateway = pane === 'text' ? textGateway : imageGateway;
      await saveGateway(pane, false);
      const response = pane === 'text'
        ? await adminTextLlmConfigApi.listModels({ openaiBaseUrl: gateway.baseUrl, openaiApiKey: gateway.apiKey || undefined })
        : await adminImageGenConfigApi.listModels({ openaiBaseUrl: gateway.baseUrl, openaiApiKey: gateway.apiKey || undefined });
      const ids = response.data.data?.models || [];
      setFetched((current) => ({ ...current, [pane]: ids }));
      setImportCapability(pane);
    } catch (error) { toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.fetchModelsFailed'))); }
    finally { setSaving(false); }
  };

  const handleImport = async (capability: AiModelCapability, modelIds: string[]) => {
    try {
      await aiModelCatalogApi.importModels({ capability, modelIds });
      toast.success(t('aiModelCenter.configHub.importedModels', { count: modelIds.length }));
      await load();
    } catch (error) { throw new Error(getApiErrorMessage(error, t('aiModelCenter.configHub.importFailed'))); }
  };

  const handleActivate = async (model: AiModelCatalogCard) => {
    if (model.active) return;
    if (!window.confirm(t('aiModelCenter.configHub.activateConfirm', { name: model.displayName, capability: capabilityLabel(model.capability) }))) return;
    setActivatingId(model.id);
    try {
      await aiModelCatalogApi.activateModel(model.id, model.capability);
      toast.success(t('aiModelCenter.configHub.modelActivated'));
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.activateFailed'))); }
    finally { setActivatingId(null); }
  };

  const handleDeactivate = async (model: AiModelCatalogCard) => {
    if (!window.confirm(t('aiModelCenter.configHub.deactivateConfirm', { name: model.displayName }))) return;
    setDeactivatingId(model.id);
    try {
      await aiModelCatalogApi.deactivateModel(model.id);
      toast.success(t('aiModelCenter.configHub.imageModelDeactivated'));
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.deactivateFailed'))); }
    finally { setDeactivatingId(null); }
  };

  if (loading) return <div className={styles.loading}>{t('aiModelCenter.configHub.loading')}</div>;
  return <div className={styles.root}>
    <header className={styles.masthead} data-watermark={pane === 'text' ? 'TXT' : 'IMG'}>
      <div className={styles.mastTop}><span className={styles.badge}>{t('aiModelCenter.configHub.badge')}</span><div className={styles.rail} role="tablist" aria-label={t('aiModelCenter.configHub.capabilitySwitchAria')}><span className={`${styles.railThumb} ${pane === 'image' ? styles.railThumbImage : styles.railThumbText}`} aria-hidden /><button type="button" role="tab" aria-selected={pane === 'text'} className={`${styles.railBtn} ${pane === 'text' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('text')}>{t('aiModelCenter.configHub.textConfigTab')}</button><button type="button" role="tab" aria-selected={pane === 'image'} className={`${styles.railBtn} ${pane === 'image' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('image')}>{t('aiModelCenter.configHub.imageConfigTab')}</button></div></div>
      <h2 className={styles.mastTitle}>{pane === 'text' ? t('aiModelCenter.configHub.textMastTitle') : t('aiModelCenter.configHub.imageMastTitle')}</h2>
      <p className={styles.mastDesc}>{t('aiModelCenter.configHub.mastDesc')}</p>
      <div className={styles.mastActions}><button type="button" className={styles.ghostBtn} onClick={() => void load()} disabled={saving}>{t('aiModelCenter.configHub.refresh')}</button><button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving}>{saving ? t('aiModelCenter.configHub.processing') : t('aiModelCenter.configHub.saveGateway')}</button></div>
    </header>
    <div className={styles.pane} role="tabpanel" aria-label={pane === 'text' ? t('aiModelCenter.configHub.textPanelAria') : t('aiModelCenter.configHub.imagePanelAria')}>
      <div className={styles.mainCol}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><h3 className={styles.panelTitle}>{t('aiModelCenter.configHub.requestSettings', { capability: capabilityLabel(pane) })}</h3><p className={styles.panelHint}>{t('aiModelCenter.configHub.apiKeyAdminHint')}</p></div>
          <label className={styles.fieldLabel}>{t('aiModelCenter.configHub.apiUrl')}<input className={styles.fieldInput} type="url" value={currentGateway.baseUrl} placeholder={currentGateway.fallback} onChange={(e) => setCurrentGateway({ ...currentGateway, baseUrl: e.target.value })} autoComplete="off" /></label>
          <p className={styles.fieldHint}>{t('aiModelCenter.configHub.defaultUrlHint')}<strong>{currentGateway.fallback || t('aiModelCenter.configHub.notConfigured')}</strong></p>
          <div className={styles.fieldLabel}>
            <label htmlFor={`${pane}-gateway-api-key`}>{t('aiModelCenter.configHub.apiKeyLabel')}</label>
            <div className={styles.apiKeyInputWrap}>
              <input id={`${pane}-gateway-api-key`} className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`} type={apiKeyVisible[pane] ? 'text' : 'password'} value={currentGateway.apiKey} placeholder={currentGateway.apiKeySet ? t('aiModelCenter.configHub.apiKeySavedHint', { hint: currentGateway.apiKeyHint || '••••' }) : t('aiModelCenter.configHub.apiKeyPlaceholder')} onChange={(e) => setCurrentGateway({ ...currentGateway, apiKey: e.target.value, clearApiKey: false })} disabled={currentGateway.clearApiKey || apiKeyLoading === pane} autoComplete="new-password" />
              <button type="button" className={styles.apiKeyToggle} onClick={() => void handleToggleApiKey()} disabled={currentGateway.clearApiKey || apiKeyLoading === pane} aria-busy={apiKeyLoading === pane} aria-label={apiKeyLoading === pane ? t('aiModelCenter.configHub.readingApiKeyAria') : apiKeyVisible[pane] ? t('aiModelCenter.configHub.hideApiKeyAria') : t('aiModelCenter.configHub.showApiKeyAria')} title={apiKeyVisible[pane] ? t('aiModelCenter.configHub.hideApiKeyAria') : t('aiModelCenter.configHub.showApiKeyAria')}>
                {apiKeyLoading === pane ? <span className={styles.apiKeySpinner} aria-hidden /> : apiKeyVisible[pane] ? <FiEye size={18} /> : <FiEyeOff size={18} />}
              </button>
            </div>
          </div>
          {currentGateway.apiKeySet ? <label className={styles.checkRow}><input type="checkbox" checked={currentGateway.clearApiKey} onChange={(e) => { setCurrentGateway({ ...currentGateway, clearApiKey: e.target.checked, apiKey: e.target.checked ? '' : currentGateway.apiKey }); if (e.target.checked) setApiKeyVisible((current) => ({ ...current, [pane]: false })); }} />{t('aiModelCenter.configHub.clearSavedKey')}</label> : null}
          <div className={styles.modelFetchRow}><p className={styles.fieldHint} style={{ margin: 0, flex: 1 }}>{t('aiModelCenter.configHub.fetchHint')}</p><button type="button" className={styles.fetchBtn} onClick={() => void handleFetch()} disabled={saving}>{saving ? t('aiModelCenter.configHub.processing') : t('aiModelCenter.configHub.saveAndFetch')}</button></div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}><h3 className={styles.panelTitle}>{t('aiModelCenter.configHub.modelCatalog', { capability: capabilityLabel(pane) })}</h3><p className={styles.panelHint}>{t('aiModelCenter.configHub.modelCount', { count: currentModels.length })}</p></div>
          <ModelCatalogCards
            items={currentModels}
            emptyText={t('aiModelCenter.configHub.emptyCatalog')}
            onEdit={setEditing}
            onActivate={pane === 'text' ? (model) => void handleActivate(model) : undefined}
            onDeactivate={pane === 'image' ? (model) => void handleDeactivate(model) : undefined}
            activatingId={activatingId}
            deactivatingId={deactivatingId}
            showRuntimeActive={pane === 'text'}
          />
        </section>
        {pane === 'image' ? <section className={styles.panel}>
          <div className={styles.panelHead}><h3 className={styles.panelTitle}>{t('aiModelCenter.configHub.businessModule')}</h3><p className={styles.panelHint}>{t('aiModelCenter.configHub.businessModuleHint')}</p></div>
          <ImageBusinessConfigPanel />
        </section> : null}
      </div>
    </div>
    {importCapability ? <ModelImportDialog capability={importCapability} modelIds={fetched[importCapability]} importedModelIds={models.filter((item) => item.capability === importCapability).map((item) => item.modelId)} onImport={(ids) => handleImport(importCapability, ids)} onClose={() => setImportCapability(null)} /> : null}
    {editing ? <ModelPricingDialog model={editing} onClose={() => setEditing(null)} onChanged={load} showGatewayCredentials /> : null}
  </div>;
};

export default ModelConfigHub;
