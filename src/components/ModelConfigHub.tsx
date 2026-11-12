import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  DEFAULT_TEXT_LLM_GGB_GATEWAY_ID,
  buildTextLlmGatewayTabs,
  normalizeTextLlmOpenAiBaseUrl,
  resolveTextLlmGatewayPresetId,
  type TextLlmGatewayPreset,
  type TextLlmGatewayTab,
} from '../lib/textLlmConfig';
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
type GatewayKeyState = { keySet: boolean; keyHint: string };
type PendingAction =
  | { type: 'activate'; model: AiModelCatalogCard }
  | { type: 'deactivate'; model: AiModelCatalogCard }
  | null;

const emptyGateway = (): GatewayForm => ({
  baseUrl: '',
  fallback: '',
  apiKey: '',
  apiKeySet: false,
  apiKeyHint: '',
  clearApiKey: false,
});

const ModelConfigHub: React.FC = () => {
  const [pane, setPane] = useState<Pane>('text');
  const [textGateway, setTextGateway] = useState(emptyGateway);
  const [imageGateway, setImageGateway] = useState(emptyGateway);
  const [gatewayPresets, setGatewayPresets] = useState<readonly TextLlmGatewayPreset[]>(DEFAULT_TEXT_LLM_GATEWAY_PRESETS);
  const [gatewayKeyStates, setGatewayKeyStates] = useState<Record<string, GatewayKeyState>>({});
  const [customGatewayTabs, setCustomGatewayTabs] = useState<TextLlmGatewayTab[]>([]);
  const [activeGatewayTabId, setActiveGatewayTabId] = useState(DEFAULT_TEXT_LLM_GGB_GATEWAY_ID);
  const [addingCustomGateway, setAddingCustomGateway] = useState(false);
  const [customGatewayDraft, setCustomGatewayDraft] = useState('');
  const [customGatewayKeyDraft, setCustomGatewayKeyDraft] = useState('');
  const [customGatewayKeyVisible, setCustomGatewayKeyVisible] = useState(false);
  const [models, setModels] = useState<AiBillingModelCatalogRow[]>([]);
  const [fetched, setFetched] = useState<Record<Pane, string[]>>({ text: [], image: [] });
  const [importCapability, setImportCapability] = useState<AiModelCapability | null>(null);
  const [editing, setEditing] = useState<AiModelCatalogCard | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [catalogGatewayTab, setCatalogGatewayTab] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState<Record<Pane, boolean>>({ text: false, image: false });
  const [apiKeyLoading, setApiKeyLoading] = useState<Pane | null>(null);

  const applyTextConfig = (data: AdminTextLlmConfigData) => {
    const baseUrl = String(data.openaiBaseUrl || '');
    const presets = data.gatewayPresets?.length ? data.gatewayPresets : DEFAULT_TEXT_LLM_GATEWAY_PRESETS;
    setGatewayPresets(presets);
    setGatewayKeyStates(data.gatewayKeyStates || {});
    setTextGateway({
      baseUrl,
      fallback: String(data.openaiBaseUrlFallback || ''),
      apiKey: '',
      apiKeySet: Boolean(data.apiKeySet),
      apiKeyHint: String(data.apiKeyHint || ''),
      clearApiKey: false,
    });
    const presetId = resolveTextLlmGatewayPresetId(baseUrl);
    if (presetId) setActiveGatewayTabId(presetId);
    else if (baseUrl) setActiveGatewayTabId(`custom-${normalizeTextLlmOpenAiBaseUrl(baseUrl)}`);
    else setActiveGatewayTabId(DEFAULT_TEXT_LLM_GGB_GATEWAY_ID);
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
      toast.error(getApiErrorMessage(error, '运行配置加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => toModelCatalogCards(models), [models]);
  const currentGateway = pane === 'text' ? textGateway : imageGateway;
  const setCurrentGateway = (next: GatewayForm) => (pane === 'text' ? setTextGateway(next) : setImageGateway(next));
  const currentModels = pane === 'text' ? grouped.text : grouped.image;

  const gatewayTabs = useMemo(
    () => buildTextLlmGatewayTabs({
      presets: gatewayPresets,
      activeBaseUrl: textGateway.baseUrl,
      gatewayKeyStates,
      customTabs: customGatewayTabs,
    }),
    [gatewayPresets, textGateway.baseUrl, gatewayKeyStates, customGatewayTabs],
  );
  const showGatewayAsTabs = gatewayTabs.length >= 2;

  const catalogGatewayOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of currentModels) {
      const key = String(item.sourceGatewayKey || 'unknown');
      if (!map.has(key)) {
        const label = item.sourceGatewayKey === DEFAULT_TEXT_LLM_GGB_GATEWAY_ID
          ? 'GGB（默认）'
          : (item.sourceGatewayLabel || key);
        map.set(key, label);
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [currentModels]);

  const filteredCatalogModels = useMemo(() => {
    if (catalogGatewayTab === 'all' || catalogGatewayOptions.length < 2) return currentModels;
    return currentModels.filter((item) => String(item.sourceGatewayKey || 'unknown') === catalogGatewayTab);
  }, [catalogGatewayTab, catalogGatewayOptions.length, currentModels]);

  useEffect(() => {
    if (catalogGatewayTab !== 'all' && !catalogGatewayOptions.some((o) => o.id === catalogGatewayTab)) {
      setCatalogGatewayTab('all');
    }
  }, [catalogGatewayOptions, catalogGatewayTab]);

  const resetCustomGatewayDraft = () => {
    setAddingCustomGateway(false);
    setCustomGatewayDraft('');
    setCustomGatewayKeyDraft('');
    setCustomGatewayKeyVisible(false);
  };

  const handlePaneChange = (nextPane: Pane) => {
    setApiKeyVisible({ text: false, image: false });
    setPane(nextPane);
    setCatalogGatewayTab('all');
    resetCustomGatewayDraft();
  };

  /** 功能注释：切换网关 Tab——带出该槽密钥状态；明文需再点小眼睛拉取 */
  const selectGatewayTab = (tab: TextLlmGatewayTab) => {
    resetCustomGatewayDraft();
    setActiveGatewayTabId(tab.id);
    setApiKeyVisible((current) => ({ ...current, text: false }));
    const state = gatewayKeyStates[tab.id];
    const presetHit = resolveTextLlmGatewayPresetId(tab.baseUrl);
    const hint = state?.keyHint || (presetHit ? gatewayKeyStates[presetHit]?.keyHint : '') || '';
    const keySet = Boolean(state?.keySet || (presetHit && gatewayKeyStates[presetHit]?.keySet));
    const sameUrl = normalizeTextLlmOpenAiBaseUrl(textGateway.baseUrl) === normalizeTextLlmOpenAiBaseUrl(tab.baseUrl);
    setTextGateway((current) => ({
      ...current,
      baseUrl: tab.baseUrl,
      apiKey: '',
      apiKeySet: keySet || (sameUrl && current.apiKeySet),
      apiKeyHint: hint || (sameUrl ? current.apiKeyHint : ''),
      clearApiKey: false,
    }));
  };

  /** 功能注释：自定义网关必须同时录入 URL + 密钥，禁止只换地址沿用旧槽密钥 */
  const openAddCustomGateway = () => {
    setAddingCustomGateway(true);
    setCustomGatewayDraft('');
    setCustomGatewayKeyDraft('');
    setCustomGatewayKeyVisible(false);
  };

  const confirmAddCustomGateway = () => {
    const baseUrl = normalizeTextLlmOpenAiBaseUrl(customGatewayDraft);
    if (!baseUrl) {
      toast.error('API 地址无效，请填写 https:// 开头的基础 URL');
      return;
    }
    const apiKey = customGatewayKeyDraft.trim();
    if (!apiKey) {
      toast.error('请填写该网关的 API 密钥');
      return;
    }
    const id = `custom-${baseUrl}`;
    const tab: TextLlmGatewayTab = { id, label: '自定义网关', baseUrl, isCustom: true };
    setCustomGatewayTabs((current) => (current.some((t) => t.id === id) ? current : [...current, tab]));
    setActiveGatewayTabId(id);
    setApiKeyVisible((current) => ({ ...current, text: true }));
    setTextGateway((current) => ({
      ...current,
      baseUrl,
      apiKey,
      apiKeySet: false,
      apiKeyHint: '',
      clearApiKey: false,
    }));
    resetCustomGatewayDraft();
    toast.success('已填入自定义网关与密钥，可保存或添加模型');
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
      toast.error(getApiErrorMessage(error, '密钥读取失败'));
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
    if (showToast) toast.success(`${capability === 'text' ? '生文' : '生图'}网关已保存`);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await saveGateway(pane); }
    catch (error) { toast.error(getApiErrorMessage(error, '网关保存失败')); }
    finally { setSaving(false); }
  };

  /** 功能注释：「添加模型」/「保存并拉取模型」= 先保存当前网关，再拉取上游列表并打开导入弹窗 */
  const handleAddModels = async () => {
    setSaving(true);
    try {
      const gateway = pane === 'text' ? textGateway : imageGateway;
      await saveGateway(pane, false);
      const response = pane === 'text'
        ? await adminTextLlmConfigApi.listModels({
          openaiBaseUrl: gateway.baseUrl,
          openaiApiKey: gateway.apiKey || undefined,
        })
        : await adminImageGenConfigApi.listModels({
          openaiBaseUrl: gateway.baseUrl,
          openaiApiKey: gateway.apiKey || undefined,
        });
      const ids = response.data.data?.models || [];
      setFetched((current) => ({ ...current, [pane]: ids }));
      setImportCapability(pane);
      if (!ids.length) toast.error('上游未返回可用模型');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '模型拉取失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (capability: AiModelCapability, modelIds: string[]) => {
    try {
      await aiModelCatalogApi.importModels({ capability, modelIds });
      toast.success(`已导入 ${modelIds.length} 个模型`);
      await load();
    } catch (error) {
      throw new Error(getApiErrorMessage(error, '模型导入失败'));
    }
  };

  const requestActivate = (model: AiModelCatalogCard) => {
    if (model.active) return;
    setPendingAction({ type: 'activate', model });
  };

  const requestDeactivate = (model: AiModelCatalogCard) => {
    setPendingAction({ type: 'deactivate', model });
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (action.type === 'activate') {
      setActivatingId(action.model.id);
      try {
        await aiModelCatalogApi.activateModel(action.model.id, action.model.capability);
        toast.success('模型已启用');
        await load();
      } catch (error) {
        toast.error(getApiErrorMessage(error, '模型启用失败'));
      } finally {
        setActivatingId(null);
      }
      return;
    }
    setDeactivatingId(action.model.id);
    try {
      await aiModelCatalogApi.deactivateModel(action.model.id);
      toast.success('生图模型已停用');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '模型停用失败'));
    } finally {
      setDeactivatingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>加载运行配置…</div>;

  const pendingTitle = pendingAction?.type === 'activate' ? '启用模型' : '停用模型';
  const pendingMessage = pendingAction?.type === 'activate'
    ? `确认将 ${pendingAction.model.displayName} 设为全平台${pendingAction.model.capability === 'text' ? '生文' : '生图'}模型？`
    : pendingAction
      ? `确认停用生图模型 ${pendingAction.model.displayName}？正在被业务场景使用时将无法停用。`
      : '';

  return (
    <div className={styles.root}>
      <header className={styles.masthead} data-watermark={pane === 'text' ? 'TXT' : 'IMG'}>
        <div className={styles.mastTop}>
          <span className={styles.badge}>运行配置 · MODEL HUB</span>
          <div className={styles.rail} role="tablist" aria-label="模型能力切换">
            <span className={`${styles.railThumb} ${pane === 'image' ? styles.railThumbImage : styles.railThumbText}`} aria-hidden />
            <button type="button" role="tab" aria-selected={pane === 'text'} className={`${styles.railBtn} ${pane === 'text' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('text')}>生文配置</button>
            <button type="button" role="tab" aria-selected={pane === 'image'} className={`${styles.railBtn} ${pane === 'image' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('image')}>生图配置</button>
          </div>
        </div>
        <h2 className={styles.mastTitle}>{pane === 'text' ? '全平台统一生文模型' : '各业务场景独立选择生图模型'}</h2>
        <p className={styles.mastDesc}>管理员维护 URL 与密钥，从上游拉取模型后导入目录。模型 ID 不允许手填；生文模型在价格生效后启用，生图模型由各业务场景独立选择。默认 GGB 网关始终可切换；密钥点击小眼睛可显示明文。</p>
        <div className={styles.mastActions}>
          <button type="button" className={styles.ghostBtn} onClick={() => void load()} disabled={saving}>刷新</button>
          <button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving}>{saving ? '处理中…' : '保存网关配置'}</button>
        </div>
      </header>

      <div className={styles.pane} role="tabpanel" aria-label={pane === 'text' ? '生文运行配置' : '生图运行配置'}>
        <div className={styles.mainCol}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>{pane === 'text' ? '生文' : '生图'}请求设置</h3>
              <p className={styles.panelHint}>密钥点击小眼睛可显示明文</p>
            </div>

            {pane === 'text' && showGatewayAsTabs ? (
              <div className={styles.gatewayTabs} role="tablist" aria-label="生文网关">
                {gatewayTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeGatewayTabId === tab.id}
                    className={activeGatewayTabId === tab.id ? styles.gatewayTabActive : styles.gatewayTab}
                    onClick={() => selectGatewayTab(tab)}
                  >
                    {tab.label}
                    {gatewayKeyStates[tab.id]?.keySet ? <span className={styles.gatewayKeyDot} title="已保存密钥" /> : null}
                  </button>
                ))}
                <button type="button" className={styles.gatewayTabAdd} onClick={openAddCustomGateway} title="添加自定义 API 地址">
                  <FiPlus aria-hidden /> 自定义
                </button>
              </div>
            ) : pane === 'text' ? (
              <div className={styles.presetRow} role="group" aria-label="快捷网关">
                {gatewayTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeGatewayTabId === tab.id ? styles.presetChipActive : styles.presetChip}
                    onClick={() => selectGatewayTab(tab)}
                  >
                    {tab.label}
                  </button>
                ))}
                <button type="button" className={styles.presetChip} onClick={openAddCustomGateway}>
                  <FiPlus aria-hidden /> 自定义
                </button>
              </div>
            ) : null}

            {pane === 'text' && addingCustomGateway ? (
              <div className={styles.customGatewayPanel}>
                <p className={styles.customGatewayTitle}>添加自定义网关</p>
                <p className={styles.customGatewayHint}>需同时填写新的 API 地址与密钥，不会沿用当前 Tab 的密钥。</p>
                <label className={styles.fieldLabel}>
                  API 地址
                  <input
                    className={styles.fieldInput}
                    type="url"
                    value={customGatewayDraft}
                    placeholder="https://example.com"
                    onChange={(e) => setCustomGatewayDraft(e.target.value)}
                    autoComplete="off"
                    aria-label="自定义 API 地址"
                  />
                </label>
                <div className={styles.fieldLabel}>
                  <label htmlFor="custom-gateway-api-key">API 密钥</label>
                  <div className={styles.apiKeyInputWrap}>
                    <input
                      id="custom-gateway-api-key"
                      className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`}
                      type={customGatewayKeyVisible ? 'text' : 'password'}
                      value={customGatewayKeyDraft}
                      placeholder="请输入该网关密钥"
                      onChange={(e) => setCustomGatewayKeyDraft(e.target.value)}
                      autoComplete="new-password"
                      aria-label="自定义 API 密钥"
                    />
                    <button
                      type="button"
                      className={styles.apiKeyToggle}
                      onClick={() => setCustomGatewayKeyVisible((visible) => !visible)}
                      aria-label={customGatewayKeyVisible ? '隐藏自定义 API 密钥' : '显示自定义 API 密钥'}
                      title={customGatewayKeyVisible ? '隐藏明文' : '显示明文'}
                    >
                      {customGatewayKeyVisible
                        ? <FiEyeOff size={18} aria-hidden />
                        : <FiEye size={18} aria-hidden />}
                    </button>
                  </div>
                </div>
                <div className={styles.customGatewayActions}>
                  <button type="button" className={styles.fetchBtn} onClick={confirmAddCustomGateway}>确认添加</button>
                  <button type="button" className={styles.secondaryBtn} onClick={resetCustomGatewayDraft}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <label className={styles.fieldLabel}>
                  API 地址
                  <input
                    className={styles.fieldInput}
                    type="url"
                    value={currentGateway.baseUrl}
                    placeholder={currentGateway.fallback || 'https://epone.ggb.today'}
                    onChange={(e) => setCurrentGateway({ ...currentGateway, baseUrl: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <p className={styles.fieldHint}>
                  留空时使用服务器默认地址：
                  <strong>{currentGateway.fallback || 'https://epone.ggb.today（GGB）'}</strong>
                </p>

                <div className={styles.fieldLabel}>
                  <label htmlFor={`${pane}-gateway-api-key`}>API 密钥</label>
                  <div className={styles.apiKeyInputWrap}>
                    <input
                      id={`${pane}-gateway-api-key`}
                      className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`}
                      type={apiKeyVisible[pane] ? 'text' : 'password'}
                      value={currentGateway.apiKey}
                      placeholder={currentGateway.apiKeySet ? `已缓存 ${currentGateway.apiKeyHint || '••••'}，点击小眼睛显示明文` : '请输入密钥'}
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
                      aria-label={apiKeyLoading === pane ? '正在读取 API 密钥' : apiKeyVisible[pane] ? '隐藏 API 密钥' : '显示 API 密钥'}
                      title={apiKeyVisible[pane] ? '隐藏明文' : '显示明文'}
                    >
                      {apiKeyLoading === pane
                        ? <span className={styles.apiKeySpinner} aria-hidden />
                        : apiKeyVisible[pane]
                          ? <FiEyeOff size={18} aria-hidden />
                          : <FiEye size={18} aria-hidden />}
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
                    清除已保存密钥
                  </label>
                ) : null}
              </>
            )}

            {!(pane === 'text' && addingCustomGateway) ? (
              <div className={styles.modelFetchRow}>
                <p className={styles.fieldHint} style={{ margin: 0, flex: 1 }}>
                  「添加模型」会先保存当前网关，再读取上游模型列表供多选导入（模型 ID 不允许手填）。
                </p>
                <button type="button" className={styles.addModelBtn} onClick={() => void handleAddModels()} disabled={saving}>
                  <FiPlus aria-hidden />
                  {saving ? '处理中…' : '添加模型'}
                </button>
                <button type="button" className={styles.fetchBtn} onClick={() => void handleAddModels()} disabled={saving}>
                  {saving ? '处理中…' : '保存并拉取模型'}
                </button>
              </div>
            ) : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>{pane === 'text' ? '生文' : '生图'}模型目录</h3>
              <p className={styles.panelHint}>{currentModels.length} 个模型</p>
            </div>

            {catalogGatewayOptions.length >= 2 ? (
              <div className={styles.catalogTabs} role="tablist" aria-label="按网关筛选模型">
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogGatewayTab === 'all'}
                  className={catalogGatewayTab === 'all' ? styles.catalogTabActive : styles.catalogTab}
                  onClick={() => setCatalogGatewayTab('all')}
                >
                  全部
                </button>
                {catalogGatewayOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={catalogGatewayTab === opt.id}
                    className={catalogGatewayTab === opt.id ? styles.catalogTabActive : styles.catalogTab}
                    onClick={() => setCatalogGatewayTab(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}

            <ModelCatalogCards
              items={filteredCatalogModels}
              emptyText="尚无模型，请先保存网关并点击「添加模型」。"
              onEdit={setEditing}
              onActivate={pane === 'text' ? requestActivate : undefined}
              onDeactivate={pane === 'image' ? requestDeactivate : undefined}
              activatingId={activatingId}
              deactivatingId={deactivatingId}
              showRuntimeActive={pane === 'text'}
            />
          </section>

          {pane === 'image' ? (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>业务模块配置</h3>
                <p className={styles.panelHint}>保存后仅影响新请求</p>
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
        isOpen={Boolean(pendingAction)}
        title={pendingTitle}
        message={pendingMessage}
        confirmButtonText={pendingAction?.type === 'activate' ? '启用' : '停用'}
        cancelButtonText="取消"
        tone="admin"
        onConfirm={() => { void confirmPendingAction(); }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default ModelConfigHub;
