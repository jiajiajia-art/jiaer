import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiPlus } from 'react-icons/fi';
import adminTextLlmConfigApi, { type AdminTextLlmConfigData } from '../api/admin/textLlmConfigApi';
import adminImageGenConfigApi, { type AdminImageGenConfigData } from '../api/admin/imageGenConfigApi';
import aiModelCatalogApi from '../api/admin/aiModelCatalogApi';
import aiModelCenterApi, { type AiBillingModelCatalogRow } from '../api/operator/aiModelCenterApi';
import ModelCatalogCards from './ai-model-center/ModelCatalogCards';
import ModelImportDialog from './ai-model-center/ModelImportDialog';
import ModelPricingDialog from './ai-model-center/ModelPricingDialog';
import ImageBusinessConfigPanel from './ImageBusinessConfigPanel';
import ConfirmModal from './CommonModal/ConfirmModal';
import { toModelCatalogCards, type AiModelCapability, type AiModelCatalogCard } from '../lib/aiModelCatalog';
import {
  DEFAULT_TEXT_LLM_GATEWAY_PRESETS,
  normalizeTextLlmOpenAiBaseUrl,
  type TextLlmGatewayPreset,
} from '../lib/textLlmConfig';
import {
  buildGatewayTabs,
  draftFromKeyState,
  formatActiveGatewayUsageHint,
  isCustomGatewayTabId,
  labelForCustomGateway,
  makeCustomGatewayTabId,
  resolveGatewayLabelForBaseUrl,
  resolveGatewayTabId,
  type GatewayTabItem,
} from '../lib/modelConfigGatewayTabs';
import { getApiErrorMessage } from '../utils/error';
import styles from './ModelConfigHub.module.css';

type Pane = 'text' | 'image';
type GatewayForm = {
  baseUrl: string;
  fallback: string;
  apiKey: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  clearApiKey: boolean;
};
type GatewayDraft = Omit<GatewayForm, 'fallback'>;

const emptyGateway = (): GatewayForm => ({
  baseUrl: '',
  fallback: '',
  apiKey: '',
  apiKeySet: false,
  apiKeyHint: '',
  clearApiKey: false,
});

const emptyDraft = (baseUrl = ''): GatewayDraft => ({
  baseUrl,
  apiKey: '',
  apiKeySet: false,
  apiKeyHint: '',
  clearApiKey: false,
});

const ModelConfigHub: React.FC = () => {
  const { t } = useTranslation();
  const capabilityLabel = (cap: 'text' | 'image') => (
    cap === 'text' ? t('aiModelCenter.catalog.capabilityText') : t('aiModelCenter.catalog.capabilityImage')
  );
  const [pane, setPane] = useState<Pane>('text');
  const [textGateway, setTextGateway] = useState(emptyGateway);
  const [imageGateway, setImageGateway] = useState(emptyGateway);
  const [textPresets, setTextPresets] = useState<readonly TextLlmGatewayPreset[]>(DEFAULT_TEXT_LLM_GATEWAY_PRESETS);
  const [textKeyStates, setTextKeyStates] = useState<Record<string, { keySet: boolean; keyHint: string }>>({});
  const [textExtraCustoms, setTextExtraCustoms] = useState<GatewayTabItem[]>([]);
  const [textEditingTabId, setTextEditingTabId] = useState('');
  const [textSavedBaseUrl, setTextSavedBaseUrl] = useState('');
  const [textDrafts, setTextDrafts] = useState<Record<string, GatewayDraft>>({});
  const [models, setModels] = useState<AiBillingModelCatalogRow[]>([]);
  const [fetched, setFetched] = useState<Record<Pane, string[]>>({ text: [], image: [] });
  const [importCapability, setImportCapability] = useState<AiModelCapability | null>(null);
  const [editing, setEditing] = useState<AiModelCatalogCard | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | { kind: 'activate' | 'deactivate'; model: AiModelCatalogCard }>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState<Record<Pane, boolean>>({ text: false, image: false });
  const [apiKeyLoading, setApiKeyLoading] = useState<Pane | null>(null);

  const applyTextConfig = (data: AdminTextLlmConfigData) => {
    const baseUrl = String(data.openaiBaseUrl || '');
    const fallback = String(data.openaiBaseUrlFallback || '');
    const presets = data.gatewayPresets?.length ? data.gatewayPresets : DEFAULT_TEXT_LLM_GATEWAY_PRESETS;
    const keyStates = data.gatewayKeyStates || {};
    setTextPresets(presets);
    setTextKeyStates(keyStates);
    setTextSavedBaseUrl(baseUrl);
    setTextExtraCustoms([]);

    const tabs = buildGatewayTabs({
      presets,
      activeBaseUrl: baseUrl,
      normalizeBaseUrl: normalizeTextLlmOpenAiBaseUrl,
      customFallbackLabel: t('aiModelCenter.configHub.customGatewayLabel'),
    });
    const tabId = resolveGatewayTabId(baseUrl, tabs, normalizeTextLlmOpenAiBaseUrl);
    const drafts: Record<string, GatewayDraft> = {};
    for (const tab of tabs) {
      if (tab.isCustom) {
        drafts[tab.id] = draftFromKeyState(tab.baseUrl, {
          keySet: Boolean(data.apiKeySet) && normalizeTextLlmOpenAiBaseUrl(baseUrl) === normalizeTextLlmOpenAiBaseUrl(tab.baseUrl),
          keyHint: String(data.apiKeyHint || ''),
        });
      } else {
        const state = keyStates[tab.id];
        const isActive = normalizeTextLlmOpenAiBaseUrl(tab.baseUrl) === normalizeTextLlmOpenAiBaseUrl(baseUrl);
        drafts[tab.id] = draftFromKeyState(tab.baseUrl, {
          keySet: Boolean(state?.keySet) || (isActive && Boolean(data.apiKeySet)),
          keyHint: String(state?.keyHint || (isActive ? data.apiKeyHint : '') || ''),
        });
      }
    }
    const activeDraft = drafts[tabId] || draftFromKeyState(baseUrl, {
      keySet: Boolean(data.apiKeySet),
      keyHint: String(data.apiKeyHint || ''),
    });
    setTextDrafts(drafts);
    setTextEditingTabId(tabId);
    setTextGateway({
      ...activeDraft,
      fallback,
    });
  };

  const applyImageConfig = (data: AdminImageGenConfigData) => setImageGateway({
    baseUrl: String(data.openaiBaseUrl || ''),
    fallback: String(data.openaiBaseUrlFallback || ''),
    apiKey: '',
    apiKeySet: Boolean(data.apiKeySet),
    apiKeyHint: String(data.apiKeyHint || ''),
    clearApiKey: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setApiKeyVisible({ text: false, image: false });
    try {
      const [textResponse, imageResponse, modelsResponse] = await Promise.all([
        adminTextLlmConfigApi.getConfig(),
        adminImageGenConfigApi.getConfig(),
        aiModelCenterApi.listModels(),
      ]);
      if (textResponse.data.data) applyTextConfig(textResponse.data.data);
      if (imageResponse.data.data) applyImageConfig(imageResponse.data.data);
      setModels(modelsResponse.data.data?.items || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => toModelCatalogCards(models), [models]);
  const currentGateway = pane === 'text' ? textGateway : imageGateway;
  const setCurrentGateway = (next: GatewayForm) => (
    pane === 'text' ? setTextGateway(next) : setImageGateway(next)
  );
  const currentModels = pane === 'text' ? grouped.text : grouped.image;

  const textTabs = useMemo(() => buildGatewayTabs({
    presets: textPresets,
    activeBaseUrl: textSavedBaseUrl,
    extraCustoms: textExtraCustoms,
    normalizeBaseUrl: normalizeTextLlmOpenAiBaseUrl,
    customFallbackLabel: t('aiModelCenter.configHub.customGatewayLabel'),
  }), [textPresets, textSavedBaseUrl, textExtraCustoms, t]);

  const textSavedTabId = useMemo(
    () => resolveGatewayTabId(textSavedBaseUrl, textTabs, normalizeTextLlmOpenAiBaseUrl),
    [textSavedBaseUrl, textTabs],
  );

  const activeTextModel = useMemo(
    () => grouped.text.find((item) => item.active) || null,
    [grouped.text],
  );

  const activeUsageHint = useMemo(() => {
    const gatewayLabel = resolveGatewayLabelForBaseUrl(
      textSavedBaseUrl,
      textTabs,
      normalizeTextLlmOpenAiBaseUrl,
      t('aiModelCenter.configHub.notConfigured'),
    );
    return formatActiveGatewayUsageHint({
      gatewayLabel,
      modelName: activeTextModel?.displayName || '',
    });
  }, [textSavedBaseUrl, textTabs, activeTextModel, t]);

  const handlePaneChange = (nextPane: Pane) => {
    setApiKeyVisible({ text: false, image: false });
    setPane(nextPane);
  };

  /** 功能注释：切换生文书签前，把当前表单写回 drafts，避免丢未保存的密钥/地址。 */
  const commitTextDraft = useCallback((tabId: string, form: GatewayForm) => {
    if (!tabId) return;
    setTextDrafts((current) => ({
      ...current,
      [tabId]: {
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        apiKeySet: form.apiKeySet,
        apiKeyHint: form.apiKeyHint,
        clearApiKey: form.clearApiKey,
      },
    }));
    if (isCustomGatewayTabId(tabId)) {
      setTextExtraCustoms((current) => current.map((tab) => (
        tab.id === tabId
          ? {
            ...tab,
            baseUrl: form.baseUrl,
            label: labelForCustomGateway(form.baseUrl, t('aiModelCenter.configHub.customGatewayLabel')),
          }
          : tab
      )));
    }
  }, [t]);

  const switchTextTab = (nextTabId: string) => {
    if (!nextTabId || nextTabId === textEditingTabId) return;
    commitTextDraft(textEditingTabId, textGateway);
    const nextTab = textTabs.find((tab) => tab.id === nextTabId);
    const draft = textDrafts[nextTabId] || draftFromKeyState(
      nextTab?.baseUrl || '',
      nextTab && !nextTab.isCustom ? textKeyStates[nextTab.id] : null,
    );
    setTextEditingTabId(nextTabId);
    setTextGateway({
      ...draft,
      fallback: textGateway.fallback,
    });
    setApiKeyVisible((current) => ({ ...current, text: false }));
  };

  const handleAddTextGatewayTab = () => {
    commitTextDraft(textEditingTabId, textGateway);
    const seed = `new-${Date.now()}`;
    const id = makeCustomGatewayTabId('', normalizeTextLlmOpenAiBaseUrl, seed);
    const tab: GatewayTabItem = {
      id,
      label: t('aiModelCenter.configHub.newGatewayTabLabel'),
      baseUrl: '',
      isCustom: true,
    };
    setTextExtraCustoms((current) => [...current, tab]);
    setTextDrafts((current) => ({ ...current, [id]: emptyDraft('') }));
    setTextEditingTabId(id);
    setTextGateway({
      ...emptyDraft(''),
      fallback: textGateway.fallback,
    });
    setApiKeyVisible((current) => ({ ...current, text: false }));
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
    if (capability === 'text') {
      commitTextDraft(textEditingTabId, gateway);
    }
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.fetchModelsFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (capability: AiModelCapability, modelIds: string[]) => {
    try {
      await aiModelCatalogApi.importModels({ capability, modelIds });
      toast.success(t('aiModelCenter.configHub.importedModels', { count: modelIds.length }));
      await load();
    } catch (error) {
      throw new Error(getApiErrorMessage(error, t('aiModelCenter.configHub.importFailed')));
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    const { kind, model } = confirmAction;
    setConfirmAction(null);
    if (kind === 'activate') {
      setActivatingId(model.id);
      try {
        await aiModelCatalogApi.activateModel(model.id, model.capability);
        toast.success(t('aiModelCenter.configHub.modelActivated'));
        await load();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.activateFailed')));
      } finally {
        setActivatingId(null);
      }
      return;
    }
    setDeactivatingId(model.id);
    try {
      await aiModelCatalogApi.deactivateModel(model.id);
      toast.success(t('aiModelCenter.configHub.imageModelDeactivated'));
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiModelCenter.configHub.deactivateFailed')));
    } finally {
      setDeactivatingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>{t('aiModelCenter.configHub.loading')}</div>;

  return (
    <div className={styles.root}>
      <header className={styles.masthead} data-watermark={pane === 'text' ? 'TXT' : 'IMG'}>
        <div className={styles.mastTop}>
          <span className={styles.badge}>{t('aiModelCenter.configHub.badge')}</span>
          <div className={styles.rail} role="tablist" aria-label={t('aiModelCenter.configHub.capabilitySwitchAria')}>
            <span className={`${styles.railThumb} ${pane === 'image' ? styles.railThumbImage : styles.railThumbText}`} aria-hidden />
            <button type="button" role="tab" aria-selected={pane === 'text'} className={`${styles.railBtn} ${pane === 'text' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('text')}>{t('aiModelCenter.configHub.textConfigTab')}</button>
            <button type="button" role="tab" aria-selected={pane === 'image'} className={`${styles.railBtn} ${pane === 'image' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('image')}>{t('aiModelCenter.configHub.imageConfigTab')}</button>
          </div>
        </div>
        <h2 className={styles.mastTitle}>{pane === 'text' ? t('aiModelCenter.configHub.textMastTitle') : t('aiModelCenter.configHub.imageMastTitle')}</h2>
        <p className={styles.mastDesc}>{t('aiModelCenter.configHub.mastDesc')}</p>
        <div className={styles.mastActions}>
          <button type="button" className={styles.ghostBtn} onClick={() => void load()} disabled={saving}>{t('aiModelCenter.configHub.refresh')}</button>
          <button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving}>{saving ? t('aiModelCenter.configHub.processing') : t('aiModelCenter.configHub.saveGateway')}</button>
        </div>
      </header>

      <div className={styles.pane} role="tabpanel" aria-label={pane === 'text' ? t('aiModelCenter.configHub.textPanelAria') : t('aiModelCenter.configHub.imagePanelAria')}>
        <div className={styles.mainCol}>
          <section className={styles.panel}>
            <div className={styles.panelHeadStack}>
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>{t('aiModelCenter.configHub.requestSettings', { capability: capabilityLabel(pane) })}</h3>
                <p className={styles.panelHint}>{t('aiModelCenter.configHub.apiKeyAdminHint')}</p>
              </div>
              {pane === 'text' ? (
                <div className={styles.gatewayTabBar} role="tablist" aria-label={t('aiModelCenter.configHub.gatewayTabsAria')}>
                  {textTabs.map((tab) => {
                    const selected = tab.id === textEditingTabId;
                    const inUse = tab.id === textSavedTabId;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={selected ? styles.gatewayTabActive : styles.gatewayTab}
                        onClick={() => switchTextTab(tab.id)}
                        disabled={saving}
                      >
                        <span>{tab.label}</span>
                        {inUse ? <span className={styles.gatewayTabBadge}>{t('aiModelCenter.configHub.inUseBadge')}</span> : null}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={styles.gatewayTabAdd}
                    onClick={handleAddTextGatewayTab}
                    disabled={saving}
                    aria-label={t('aiModelCenter.configHub.addGatewayAria')}
                  >
                    <FiPlus size={14} aria-hidden />
                    <span>{t('aiModelCenter.configHub.addGateway')}</span>
                  </button>
                  <p className={styles.gatewayActiveHint}>
                    {activeUsageHint.modelName
                      ? t('aiModelCenter.configHub.activeUsageWithModel', {
                        gateway: activeUsageHint.gatewayLabel,
                        model: activeUsageHint.modelName,
                      })
                      : t('aiModelCenter.configHub.activeUsage', {
                        gateway: activeUsageHint.gatewayLabel,
                      })}
                  </p>
                </div>
              ) : null}
            </div>

            <label className={styles.fieldLabel}>
              {t('aiModelCenter.configHub.apiUrl')}
              <input
                className={styles.fieldInput}
                type="url"
                value={currentGateway.baseUrl}
                placeholder={currentGateway.fallback}
                onChange={(e) => {
                  const next = { ...currentGateway, baseUrl: e.target.value };
                  setCurrentGateway(next);
                  if (pane === 'text' && isCustomGatewayTabId(textEditingTabId)) {
                    commitTextDraft(textEditingTabId, next);
                  }
                }}
                autoComplete="off"
              />
            </label>
            <p className={styles.fieldHint}>
              {t('aiModelCenter.configHub.defaultUrlHint')}
              <strong>{currentGateway.fallback || t('aiModelCenter.configHub.notConfigured')}</strong>
            </p>

            <div className={styles.fieldLabel}>
              <label htmlFor={`${pane}-gateway-api-key`}>{t('aiModelCenter.configHub.apiKeyLabel')}</label>
              <div className={styles.apiKeyInputWrap}>
                <input
                  id={`${pane}-gateway-api-key`}
                  className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`}
                  type={apiKeyVisible[pane] ? 'text' : 'password'}
                  value={currentGateway.apiKey}
                  placeholder={currentGateway.apiKeySet
                    ? t('aiModelCenter.configHub.apiKeySavedHint', { hint: currentGateway.apiKeyHint || '••••' })
                    : t('aiModelCenter.configHub.apiKeyPlaceholder')}
                  onChange={(e) => setCurrentGateway({ ...currentGateway, apiKey: e.target.value, clearApiKey: false })}
                  disabled={currentGateway.clearApiKey || apiKeyLoading === pane}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.apiKeyToggle}
                  onClick={() => void handleToggleApiKey()}
                  disabled={currentGateway.clearApiKey || apiKeyLoading === pane}
                  aria-busy={apiKeyLoading === pane}
                  aria-label={apiKeyLoading === pane
                    ? t('aiModelCenter.configHub.readingApiKeyAria')
                    : apiKeyVisible[pane]
                      ? t('aiModelCenter.configHub.hideApiKeyAria')
                      : t('aiModelCenter.configHub.showApiKeyAria')}
                  title={apiKeyVisible[pane]
                    ? t('aiModelCenter.configHub.hideApiKeyAria')
                    : t('aiModelCenter.configHub.showApiKeyAria')}
                >
                  {apiKeyLoading === pane
                    ? <span className={styles.apiKeySpinner} aria-hidden />
                    : apiKeyVisible[pane] ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                </button>
              </div>
            </div>

            {currentGateway.apiKeySet ? (
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={currentGateway.clearApiKey}
                  onChange={(e) => {
                    setCurrentGateway({
                      ...currentGateway,
                      clearApiKey: e.target.checked,
                      apiKey: e.target.checked ? '' : currentGateway.apiKey,
                    });
                    if (e.target.checked) setApiKeyVisible((current) => ({ ...current, [pane]: false }));
                  }}
                />
                {t('aiModelCenter.configHub.clearSavedKey')}
              </label>
            ) : null}

            <div className={styles.modelFetchRow}>
              <p className={styles.fieldHint} style={{ margin: 0, flex: 1 }}>{t('aiModelCenter.configHub.fetchHint')}</p>
              <button type="button" className={styles.fetchBtn} onClick={() => void handleFetch()} disabled={saving}>
                {saving ? t('aiModelCenter.configHub.processing') : t('aiModelCenter.configHub.saveAndFetch')}
              </button>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>{t('aiModelCenter.configHub.modelCatalog', { capability: capabilityLabel(pane) })}</h3>
              <p className={styles.panelHint}>{t('aiModelCenter.configHub.modelCount', { count: currentModels.length })}</p>
            </div>
            <ModelCatalogCards
              items={currentModels}
              emptyText={t('aiModelCenter.configHub.emptyCatalog')}
              onEdit={setEditing}
              onActivate={pane === 'text' ? (model) => setConfirmAction({ kind: 'activate', model }) : undefined}
              onDeactivate={pane === 'image' ? (model) => setConfirmAction({ kind: 'deactivate', model }) : undefined}
              activatingId={activatingId}
              deactivatingId={deactivatingId}
              showRuntimeActive={pane === 'text'}
            />
          </section>

          {pane === 'image' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>{t('aiModelCenter.configHub.businessModule')}</h3>
                <p className={styles.panelHint}>{t('aiModelCenter.configHub.businessModuleHint')}</p>
              </div>
              <ImageBusinessConfigPanel />
            </section>
          ) : null}
        </div>
      </div>

      {importCapability ? (
        <ModelImportDialog
          capability={importCapability}
          modelIds={fetched[importCapability]}
          importedModelIds={models.filter((item) => item.capability === importCapability).map((item) => item.modelId)}
          onImport={(ids) => handleImport(importCapability, ids)}
          onClose={() => setImportCapability(null)}
        />
      ) : null}
      {editing ? (
        <ModelPricingDialog model={editing} onClose={() => setEditing(null)} onChanged={load} showGatewayCredentials />
      ) : null}
      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        tone="admin"
        title={confirmAction?.kind === 'deactivate'
          ? t('aiModelCenter.configHub.deactivateConfirmTitle', { defaultValue: '停用生图模型' })
          : t('aiModelCenter.configHub.activateConfirmTitle', { defaultValue: '启用生文模型' })}
        message={confirmAction?.kind === 'deactivate'
          ? t('aiModelCenter.configHub.deactivateConfirm', { name: confirmAction.model.displayName })
          : t('aiModelCenter.configHub.activateConfirm', {
            name: confirmAction?.model.displayName,
            capability: capabilityLabel(confirmAction?.model.capability || 'text'),
          })}
        confirmButtonText={t('aiModelCenter.configHub.confirmAction', { defaultValue: '确认' })}
        cancelButtonText={t('aiModelCenter.configHub.cancelAction', { defaultValue: '取消' })}
        onConfirm={() => { void runConfirmAction(); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default ModelConfigHub;
