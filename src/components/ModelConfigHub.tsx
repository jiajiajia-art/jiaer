import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    } catch (error) { toast.error(getApiErrorMessage(error, '运行配置加载失败')); }
    finally { setLoading(false); }
  }, []);

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
    } catch (error) { toast.error(getApiErrorMessage(error, '模型拉取失败')); }
    finally { setSaving(false); }
  };

  const handleImport = async (capability: AiModelCapability, modelIds: string[]) => {
    try {
      await aiModelCatalogApi.importModels({ capability, modelIds });
      toast.success(`已导入 ${modelIds.length} 个模型`);
      await load();
    } catch (error) { throw new Error(getApiErrorMessage(error, '模型导入失败')); }
  };

  const handleActivate = async (model: AiModelCatalogCard) => {
    if (model.active) return;
    if (!window.confirm(`确认将 ${model.displayName} 设为全平台${model.capability === 'text' ? '生文' : '生图'}模型？`)) return;
    setActivatingId(model.id);
    try {
      await aiModelCatalogApi.activateModel(model.id, model.capability);
      toast.success('模型已启用');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, '模型启用失败')); }
    finally { setActivatingId(null); }
  };

  const handleDeactivate = async (model: AiModelCatalogCard) => {
    if (!window.confirm(`确认停用生图模型 ${model.displayName}？正在被业务场景使用时将无法停用。`)) return;
    setDeactivatingId(model.id);
    try {
      await aiModelCatalogApi.deactivateModel(model.id);
      toast.success('生图模型已停用');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, '模型停用失败')); }
    finally { setDeactivatingId(null); }
  };

  if (loading) return <div className={styles.loading}>加载运行配置…</div>;
  return <div className={styles.root}>
    <header className={styles.masthead} data-watermark={pane === 'text' ? 'TXT' : 'IMG'}>
      <div className={styles.mastTop}><span className={styles.badge}>运行配置 · MODEL HUB</span><div className={styles.rail} role="tablist" aria-label="模型能力切换"><span className={`${styles.railThumb} ${pane === 'image' ? styles.railThumbImage : styles.railThumbText}`} aria-hidden /><button type="button" role="tab" aria-selected={pane === 'text'} className={`${styles.railBtn} ${pane === 'text' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('text')}>生文配置</button><button type="button" role="tab" aria-selected={pane === 'image'} className={`${styles.railBtn} ${pane === 'image' ? styles.railBtnActive : ''}`} onClick={() => handlePaneChange('image')}>生图配置</button></div></div>
      <h2 className={styles.mastTitle}>{pane === 'text' ? '全平台统一生文模型' : '各业务场景独立选择生图模型'}</h2>
      <p className={styles.mastDesc}>管理员维护 URL 与密钥，从上游拉取模型后导入目录。模型 ID 不允许手填；生文模型在价格生效后启用，生图模型由各业务场景独立选择。</p>
      <div className={styles.mastActions}><button type="button" className={styles.ghostBtn} onClick={() => void load()} disabled={saving}>刷新</button><button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving}>{saving ? '处理中…' : '保存网关配置'}</button></div>
    </header>
    <div className={styles.pane} role="tabpanel" aria-label={pane === 'text' ? '生文运行配置' : '生图运行配置'}>
      <div className={styles.mainCol}>
        <section className={styles.panel}>
          <div className={styles.panelHead}><h3 className={styles.panelTitle}>{pane === 'text' ? '生文' : '生图'}请求设置</h3><p className={styles.panelHint}>密钥仅管理员可按需显示</p></div>
          <label className={styles.fieldLabel}>API 地址<input className={styles.fieldInput} type="url" value={currentGateway.baseUrl} placeholder={currentGateway.fallback} onChange={(e) => setCurrentGateway({ ...currentGateway, baseUrl: e.target.value })} autoComplete="off" /></label>
          <p className={styles.fieldHint}>留空时使用服务器默认地址：<strong>{currentGateway.fallback || '未配置'}</strong></p>
          <div className={styles.fieldLabel}>
            <label htmlFor={`${pane}-gateway-api-key`}>API 密钥</label>
            <div className={styles.apiKeyInputWrap}>
              <input id={`${pane}-gateway-api-key`} className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`} type={apiKeyVisible[pane] ? 'text' : 'password'} value={currentGateway.apiKey} placeholder={currentGateway.apiKeySet ? `已保存 ${currentGateway.apiKeyHint || '••••'}，留空不修改` : '请输入密钥'} onChange={(e) => setCurrentGateway({ ...currentGateway, apiKey: e.target.value, clearApiKey: false })} disabled={currentGateway.clearApiKey || apiKeyLoading === pane} autoComplete="new-password" />
              <button type="button" className={styles.apiKeyToggle} onClick={() => void handleToggleApiKey()} disabled={currentGateway.clearApiKey || apiKeyLoading === pane} aria-busy={apiKeyLoading === pane} aria-label={apiKeyLoading === pane ? '正在读取 API 密钥' : apiKeyVisible[pane] ? '隐藏 API 密钥' : '显示 API 密钥'} title={apiKeyVisible[pane] ? '隐藏 API 密钥' : '显示 API 密钥'}>
                {apiKeyLoading === pane ? <span className={styles.apiKeySpinner} aria-hidden /> : apiKeyVisible[pane] ? <FiEye size={18} /> : <FiEyeOff size={18} />}
              </button>
            </div>
          </div>
          {currentGateway.apiKeySet ? <label className={styles.checkRow}><input type="checkbox" checked={currentGateway.clearApiKey} onChange={(e) => { setCurrentGateway({ ...currentGateway, clearApiKey: e.target.checked, apiKey: e.target.checked ? '' : currentGateway.apiKey }); if (e.target.checked) setApiKeyVisible((current) => ({ ...current, [pane]: false })); }} />清除已保存密钥</label> : null}
          <div className={styles.modelFetchRow}><p className={styles.fieldHint} style={{ margin: 0, flex: 1 }}>“保存并拉取模型”会先保存当前网关，再读取上游模型列表供多选导入。</p><button type="button" className={styles.fetchBtn} onClick={() => void handleFetch()} disabled={saving}>{saving ? '处理中…' : '保存并拉取模型'}</button></div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHead}><h3 className={styles.panelTitle}>{pane === 'text' ? '生文' : '生图'}模型目录</h3><p className={styles.panelHint}>{currentModels.length} 个模型</p></div>
          <ModelCatalogCards
            items={currentModels}
            emptyText="尚无模型，请先保存网关并拉取模型。"
            onEdit={setEditing}
            onActivate={pane === 'text' ? (model) => void handleActivate(model) : undefined}
            onDeactivate={pane === 'image' ? (model) => void handleDeactivate(model) : undefined}
            activatingId={activatingId}
            deactivatingId={deactivatingId}
            showRuntimeActive={pane === 'text'}
          />
        </section>
        {pane === 'image' ? <section className={styles.panel}>
          <div className={styles.panelHead}><h3 className={styles.panelTitle}>业务模块配置</h3><p className={styles.panelHint}>保存后仅影响新请求</p></div>
          <ImageBusinessConfigPanel />
        </section> : null}
      </div>
    </div>
    {importCapability ? <ModelImportDialog capability={importCapability} modelIds={fetched[importCapability]} importedModelIds={models.filter((item) => item.capability === importCapability).map((item) => item.modelId)} onImport={(ids) => handleImport(importCapability, ids)} onClose={() => setImportCapability(null)} /> : null}
    {editing ? <ModelPricingDialog model={editing} onClose={() => setEditing(null)} onChanged={load} showGatewayCredentials /> : null}
  </div>;
};

export default ModelConfigHub;
