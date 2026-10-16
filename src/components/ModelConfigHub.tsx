import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminImageGenConfigApi, {
  type AdminImageGenModuleRow,
} from '../api/admin/imageGenConfigApi';
import adminTextLlmConfigApi from '../api/admin/textLlmConfigApi';
import {
  DEFAULT_IMAGE_GEN_GATEWAY_PRESETS,
  DEFAULT_IMAGE_GEN_OPENAI_BASE_URL,
  IMAGE_GEN_MODELS,
  IMAGE_GEN_MODULE_CATALOG,
  normalizeImageGenModel,
  normalizeImageGenOpenAiBaseUrl,
  toImageGenModelsPayload,
  type ImageGenGatewayPreset,
  type ImageGenModel,
} from '../lib/imageGenConfig';
import {
  DEFAULT_TEXT_LLM_GATEWAY_PRESETS,
  DEFAULT_TEXT_LLM_MODEL,
  TEXT_LLM_MODELS,
  TEXT_LLM_USAGE_CATALOG,
  getTextLlmModelLabel,
  getTextLlmModelMeta,
  getTextLlmModelVendor,
  isDefaultTextLlmModel,
  isSafeCustomTextLlmModelId,
  normalizeTextLlmModel,
  normalizeTextLlmOpenAiBaseUrl,
  type TextLlmGatewayPreset,
  type TextLlmModel,
} from '../lib/textLlmConfig';
import { getApiErrorMessage } from '../utils/error';
import { resolveModelConfigPane, type ModelConfigPane } from '../lib/modelConfigPane';
import styles from './ModelConfigHub.module.css';

export type { ModelConfigPane };
export { resolveModelConfigPane };

function fallbackImageModules(): AdminImageGenModuleRow[] {
  return IMAGE_GEN_MODULE_CATALOG.map((mod) => ({
    key: mod.key,
    label: mod.label,
    description: mod.description,
    model: 'gpt-image-2',
  }));
}

/**
 * 功能注释：生图 / 文案同页双轨 Tab；文案轨含 OpenAI 兼容网关（官方 DeepSeek 等）。
 */
const ModelConfigHub: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pane = resolveModelConfigPane(location.pathname);

  const [imageModules, setImageModules] = useState<AdminImageGenModuleRow[]>(fallbackImageModules);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
  // 功能注释：生图网关状态与文案网关完全独立，禁止共用一套 state
  const [imageOpenaiBaseUrl, setImageOpenaiBaseUrl] = useState('');
  const [imageOpenaiBaseUrlFallback, setImageOpenaiBaseUrlFallback] = useState(
    DEFAULT_IMAGE_GEN_OPENAI_BASE_URL,
  );
  const [imageOpenaiApiKey, setImageOpenaiApiKey] = useState('');
  const [imageApiKeySet, setImageApiKeySet] = useState(false);
  const [imageApiKeyHint, setImageApiKeyHint] = useState('');
  const [imageClearApiKey, setImageClearApiKey] = useState(false);
  const [imageGatewayPresets, setImageGatewayPresets] = useState<readonly ImageGenGatewayPreset[]>(
    DEFAULT_IMAGE_GEN_GATEWAY_PRESETS,
  );
  const [imageFetchedModels, setImageFetchedModels] = useState<string[]>([]);
  const [imageFetchingModels, setImageFetchingModels] = useState(false);

  const [textModel, setTextModel] = useState<TextLlmModel>(DEFAULT_TEXT_LLM_MODEL);
  const [textLoading, setTextLoading] = useState(false);
  const [textSaving, setTextSaving] = useState(false);
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiBaseUrlFallback, setOpenaiBaseUrlFallback] = useState('https://epone.ggb.today');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyHint, setApiKeyHint] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [gatewayPresets, setGatewayPresets] = useState<readonly TextLlmGatewayPreset[]>(
    DEFAULT_TEXT_LLM_GATEWAY_PRESETS,
  );
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const applyImageConfigData = useCallback((data: {
    modules?: AdminImageGenModuleRow[];
    openaiBaseUrl?: string;
    openaiBaseUrlFallback?: string;
    apiKeySet?: boolean;
    apiKeyHint?: string;
    gatewayPresets?: ImageGenGatewayPreset[];
  }) => {
    if (data.modules?.length) {
      setImageModules(
        data.modules.map((row) => ({
          ...row,
          model: normalizeImageGenModel(row.model),
        })),
      );
    }
    setImageOpenaiBaseUrl(String(data.openaiBaseUrl || ''));
    if (data.openaiBaseUrlFallback) {
      setImageOpenaiBaseUrlFallback(String(data.openaiBaseUrlFallback));
    }
    setImageApiKeySet(Boolean(data.apiKeySet));
    setImageApiKeyHint(String(data.apiKeyHint || ''));
    setImageOpenaiApiKey('');
    setImageClearApiKey(false);
    if (data.gatewayPresets?.length) setImageGatewayPresets(data.gatewayPresets);
  }, []);

  const loadImage = useCallback(async () => {
    try {
      setImageLoading(true);
      const response = await adminImageGenConfigApi.getConfig();
      if (response.data.success && response.data.data?.modules?.length) {
        applyImageConfigData(response.data.data);
      } else {
        toast.error(response.data.message || '加载生图配置失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载生图配置失败'));
    } finally {
      setImageLoading(false);
    }
  }, [applyImageConfigData]);

  const applyTextConfigData = useCallback((data: {
    model?: string;
    openaiBaseUrl?: string;
    openaiBaseUrlFallback?: string;
    apiKeySet?: boolean;
    apiKeyHint?: string;
    gatewayPresets?: TextLlmGatewayPreset[];
  }) => {
    if (data.model) setTextModel(normalizeTextLlmModel(data.model));
    setOpenaiBaseUrl(String(data.openaiBaseUrl || ''));
    if (data.openaiBaseUrlFallback) {
      setOpenaiBaseUrlFallback(String(data.openaiBaseUrlFallback));
    }
    setApiKeySet(Boolean(data.apiKeySet));
    setApiKeyHint(String(data.apiKeyHint || ''));
    setOpenaiApiKey('');
    setClearApiKey(false);
    if (data.gatewayPresets?.length) setGatewayPresets(data.gatewayPresets);
  }, []);

  const loadText = useCallback(async () => {
    try {
      setTextLoading(true);
      const response = await adminTextLlmConfigApi.getConfig();
      if (response.data.success && response.data.data?.model) {
        applyTextConfigData(response.data.data);
      } else {
        toast.error(response.data.message || '加载文案配置失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载文案配置失败'));
    } finally {
      setTextLoading(false);
    }
  }, [applyTextConfigData]);

  useEffect(() => {
    if (pane === 'image') void loadImage();
    else void loadText();
  }, [pane, loadImage, loadText]);

  const switchPane = (next: ModelConfigPane) => {
    if (next === pane) return;
    navigate(next === 'text' ? '/admin/text-llm' : '/admin/image-gen');
  };

  const handleImageModelChange = (key: string, model: ImageGenModel) => {
    setImageModules((prev) =>
      prev.map((row) => (row.key === key ? { ...row, model } : row)),
    );
  };

  const handleSaveImage = async () => {
    const baseNormalized = normalizeImageGenOpenAiBaseUrl(imageOpenaiBaseUrl);
    if (imageOpenaiBaseUrl.trim() && !baseNormalized) {
      toast.error('生图 API 地址无效，请填写 https:// 开头的基础 URL');
      return;
    }
    try {
      setImageSaving(true);
      const response = await adminImageGenConfigApi.saveConfig({
        models: toImageGenModelsPayload(imageModules),
        openaiBaseUrl: baseNormalized,
        openaiApiKey: imageClearApiKey ? undefined : imageOpenaiApiKey,
        clearApiKey: imageClearApiKey,
      });
      if (response.data.success && response.data.data) {
        applyImageConfigData(response.data.data);
        toast.success(response.data.message || '生图配置已保存');
      } else {
        toast.error(response.data.message || '保存失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setImageSaving(false);
    }
  };

  /** 功能注释：生图独立拉模型，走 image-gen-config/models，不碰文案密钥 */
  const handleFetchImageModels = async () => {
    const baseNormalized = normalizeImageGenOpenAiBaseUrl(imageOpenaiBaseUrl)
      || normalizeImageGenOpenAiBaseUrl(imageOpenaiBaseUrlFallback);
    if (!baseNormalized) {
      toast.error('请先填写生图 API 地址');
      return;
    }
    if (!imageOpenaiApiKey.trim() && !imageApiKeySet) {
      toast.error('请先填写生图 API 密钥');
      return;
    }
    try {
      setImageFetchingModels(true);
      const response = await adminImageGenConfigApi.listModels({
        openaiBaseUrl: baseNormalized,
        openaiApiKey: imageOpenaiApiKey.trim() || undefined,
      });
      if (response.data.success && response.data.data?.models) {
        setImageFetchedModels(response.data.data.models);
        toast.success(`已拉取 ${response.data.data.count} 个模型`);
      } else {
        toast.error(response.data.message || '拉取模型失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '拉取模型失败'));
    } finally {
      setImageFetchingModels(false);
    }
  };

  const handleSaveText = async () => {
    const model = normalizeTextLlmModel(textModel);
    if (!isSafeCustomTextLlmModelId(model) && !TEXT_LLM_MODELS.includes(model as typeof TEXT_LLM_MODELS[number])) {
      toast.error('模型 id 无效');
      return;
    }
    const baseNormalized = normalizeTextLlmOpenAiBaseUrl(openaiBaseUrl);
    if (openaiBaseUrl.trim() && !baseNormalized) {
      toast.error('API 地址无效，请填写 https:// 开头的基础 URL');
      return;
    }
    try {
      setTextSaving(true);
      const response = await adminTextLlmConfigApi.saveConfig({
        model,
        openaiBaseUrl: baseNormalized,
        openaiApiKey: clearApiKey ? undefined : openaiApiKey,
        clearApiKey,
      });
      if (response.data.success && response.data.data) {
        applyTextConfigData(response.data.data);
        toast.success(response.data.message || '文案模型配置已保存');
      } else {
        toast.error(response.data.message || '保存失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setTextSaving(false);
    }
  };

  /** 功能注释：用当前表单地址/密钥（或已保存密钥）打 /v1/models */
  const handleFetchModels = async () => {
    const baseNormalized = normalizeTextLlmOpenAiBaseUrl(openaiBaseUrl)
      || normalizeTextLlmOpenAiBaseUrl(openaiBaseUrlFallback);
    if (!baseNormalized) {
      toast.error('请先填写 API 地址');
      return;
    }
    if (!openaiApiKey.trim() && !apiKeySet) {
      toast.error('请先填写 API 密钥');
      return;
    }
    try {
      setFetchingModels(true);
      const response = await adminTextLlmConfigApi.listModels({
        openaiBaseUrl: baseNormalized,
        openaiApiKey: openaiApiKey.trim() || undefined,
      });
      if (response.data.success && response.data.data?.models) {
        setFetchedModels(response.data.data.models);
        toast.success(`已拉取 ${response.data.data.count} 个模型`);
      } else {
        toast.error(response.data.message || '拉取模型失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '拉取模型失败'));
    } finally {
      setFetchingModels(false);
    }
  };

  const busy = pane === 'image'
    ? imageLoading || imageSaving || imageFetchingModels
    : textLoading || textSaving || fetchingModels;

  const effectiveImageGatewayHint = imageOpenaiBaseUrl.trim() || imageOpenaiBaseUrlFallback;
  const effectiveGatewayHint = openaiBaseUrl.trim() || openaiBaseUrlFallback;

  return (
    <div className={styles.root}>
      <header
        className={styles.masthead}
        data-watermark={pane === 'image' ? 'IMG' : 'ONE'}
      >
        <div className={styles.mastTop}>
          <span className={styles.badge}>模型配置 · MODEL HUB</span>
          <div className={styles.rail} role="tablist" aria-label="生图与文案切换">
            <span
              className={`${styles.railThumb} ${
                pane === 'image' ? styles.railThumbImage : styles.railThumbText
              }`}
              aria-hidden
            />
            <button
              type="button"
              role="tab"
              aria-selected={pane === 'image'}
              className={`${styles.railBtn} ${pane === 'image' ? styles.railBtnActive : ''}`}
              onClick={() => switchPane('image')}
            >
              生图配置
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pane === 'text'}
              className={`${styles.railBtn} ${pane === 'text' ? styles.railBtnActive : ''}`}
              onClick={() => switchPane('text')}
            >
              文案配置
            </button>
          </div>
        </div>

        {pane === 'image' ? (
          <>
            <h2 className={styles.mastTitle}>按业务模块切换生图模型</h2>
            <p className={styles.mastDesc}>
              可选 {IMAGE_GEN_MODELS.join(' / ')}。下方「生图请求设置」可配独立 API 地址/密钥（默认 ggb），
              与「文案配置」完全隔离、互不影响。未填地址时回落{' '}
              <code className={styles.inlineCode}>{imageOpenaiBaseUrlFallback}</code>
              。保存后约 30 秒生效。
            </p>
            <div className={styles.mastActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => void loadImage()}
                disabled={busy}
              >
                刷新
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSaveImage()}
                disabled={busy}
              >
                {imageSaving ? '保存中…' : '保存生图配置'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.mastTitle}>一处配置，全站文案同模型</h2>
            <p className={styles.mastDesc}>
              叙事、私聊、文档解析、记忆压缩与故事结构共用同一模型。下方「文案请求设置」仅作用于文案链路（可切官方 DeepSeek），
              与生图网关互不影响。未填文案地址时回落{' '}
              <code className={styles.inlineCode}>{openaiBaseUrlFallback}</code>
              。保存后约 30 秒生效。
            </p>
            <div className={styles.mastActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => void loadText()}
                disabled={busy}
              >
                刷新
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSaveText()}
                disabled={busy}
              >
                {textSaving ? '保存中…' : '保存文案配置'}
              </button>
            </div>
          </>
        )}
      </header>

      {pane === 'image' ? (
        <div className={styles.pane} role="tabpanel" aria-label="生图配置">
          {imageLoading && imageModules.length === 0 ? (
            <p className={styles.loading}>加载中…</p>
          ) : (
            <div className={styles.mainCol}>
              <section className={styles.panel} aria-label="生图请求设置">
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>生图请求设置</h3>
                  <p className={styles.panelHint}>仅生图 · 与文案网关隔离</p>
                </div>
                <label className={styles.fieldLabel}>
                  生图 API 地址
                  <input
                    className={styles.fieldInput}
                    type="url"
                    value={imageOpenaiBaseUrl}
                    placeholder={imageOpenaiBaseUrlFallback || 'https://epone.ggb.today'}
                    onChange={(e) => setImageOpenaiBaseUrl(e.target.value)}
                    disabled={imageSaving}
                    autoComplete="off"
                  />
                </label>
                <p className={styles.fieldHint}>
                  只需填写基础 URL，系统自动拼接 /v1/images/generations。当前生效预览：
                  {' '}
                  <strong>{effectiveImageGatewayHint || '（未配置）'}</strong>
                </p>
                <div className={styles.presetRow} role="group" aria-label="生图常用网关">
                  {imageGatewayPresets.map((preset) => {
                    const active = normalizeImageGenOpenAiBaseUrl(imageOpenaiBaseUrl) === preset.baseUrl;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={active ? styles.presetChipActive : styles.presetChip}
                        onClick={() => setImageOpenaiBaseUrl(preset.baseUrl)}
                        disabled={imageSaving}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <label className={styles.fieldLabel}>
                  生图 API 密钥
                  <input
                    className={styles.fieldInput}
                    type="password"
                    value={imageOpenaiApiKey}
                    placeholder={
                      imageApiKeySet
                        ? `已保存 ${imageApiKeyHint || '••••'}，留空不修改`
                        : 'sk-...（仅生图；文案密钥另存）'
                    }
                    onChange={(e) => {
                      setImageOpenaiApiKey(e.target.value);
                      if (imageClearApiKey) setImageClearApiKey(false);
                    }}
                    disabled={imageSaving || imageClearApiKey}
                    autoComplete="new-password"
                  />
                </label>
                {imageApiKeySet ? (
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={imageClearApiKey}
                      onChange={(e) => {
                        setImageClearApiKey(e.target.checked);
                        if (e.target.checked) setImageOpenaiApiKey('');
                      }}
                      disabled={imageSaving}
                    />
                    清除已保存生图密钥（改回使用服务器环境变量）
                  </label>
                ) : null}
                <div className={styles.modelFetchRow}>
                  <p className={styles.fieldHint} style={{ margin: 0, flex: 1 }}>
                    模块模型仍用下方下拉（nano-banana-2 / gpt-image-2）。「拉取模型」用于校验网关连通性。
                  </p>
                  <button
                    type="button"
                    className={styles.fetchBtn}
                    onClick={() => void handleFetchImageModels()}
                    disabled={busy}
                  >
                    {imageFetchingModels ? '拉取中…' : '拉取模型'}
                  </button>
                </div>
                {imageFetchedModels.length > 0 ? (
                  <p className={styles.fieldHint}>
                    网关返回 {imageFetchedModels.length} 个模型（连通正常）。生图业务仍用模块下拉中的模型名。
                  </p>
                ) : null}
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>业务模块</h3>
                  <p className={styles.panelHint}>{imageModules.length} 个模块</p>
                </div>
                <div className={styles.moduleList}>
                  {imageModules.map((row) => (
                    <div key={row.key} className={styles.moduleRow}>
                      <div>
                        <p className={styles.moduleLabel}>{row.label}</p>
                        <p className={styles.moduleDesc}>{row.description}</p>
                        <p className={styles.moduleKey}>key · {row.key}</p>
                      </div>
                      <label className={styles.moduleSelectLabel}>
                        生图模型
                        <select
                          className={styles.moduleSelect}
                          value={normalizeImageGenModel(row.model)}
                          onChange={(e) =>
                            handleImageModelChange(
                              row.key,
                              normalizeImageGenModel(e.target.value),
                            )
                          }
                          disabled={imageSaving}
                        >
                          {IMAGE_GEN_MODELS.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.pane} role="tabpanel" aria-label="文案配置">
          {textLoading ? (
            <p className={styles.loading}>加载中…</p>
          ) : (
            <div className={styles.stage}>
              <div className={styles.mainCol}>
                {/* 功能注释：参照中转站设置——基础 URL / 密钥 / 拉取模型 */}
                <section className={styles.panel} aria-label="文案模型请求设置">
                  <div className={styles.panelHead}>
                    <h3 className={styles.panelTitle}>文案请求设置</h3>
                    <p className={styles.panelHint}>仅文案 · 不影响生图 ggb</p>
                  </div>

                  <label className={styles.fieldLabel}>
                    文案 API 地址
                    <input
                      className={styles.fieldInput}
                      type="url"
                      value={openaiBaseUrl}
                      placeholder={openaiBaseUrlFallback || 'https://api.deepseek.com'}
                      onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                      disabled={textSaving}
                      autoComplete="off"
                    />
                  </label>
                  <p className={styles.fieldHint}>
                    只需填写基础 URL，系统自动拼接 /v1/chat/completions。当前生效预览：
                    {' '}
                    <strong>{effectiveGatewayHint || '（未配置）'}</strong>
                  </p>
                  <div className={styles.presetRow} role="group" aria-label="常用网关">
                    {gatewayPresets.map((preset) => {
                      const active = normalizeTextLlmOpenAiBaseUrl(openaiBaseUrl) === preset.baseUrl;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={active ? styles.presetChipActive : styles.presetChip}
                          onClick={() => setOpenaiBaseUrl(preset.baseUrl)}
                          disabled={textSaving}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <label className={styles.fieldLabel}>
                    文案 API 密钥
                    <input
                      className={styles.fieldInput}
                      type="password"
                      value={openaiApiKey}
                      placeholder={
                        apiKeySet
                          ? `已保存 ${apiKeyHint || '••••'}，留空不修改`
                          : 'sk-...（仅文案；生图仍用服务器 ggb 密钥）'
                      }
                      onChange={(e) => {
                        setOpenaiApiKey(e.target.value);
                        if (clearApiKey) setClearApiKey(false);
                      }}
                      disabled={textSaving || clearApiKey}
                      autoComplete="new-password"
                    />
                  </label>
                  {apiKeySet ? (
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={clearApiKey}
                        onChange={(e) => {
                          setClearApiKey(e.target.checked);
                          if (e.target.checked) setOpenaiApiKey('');
                        }}
                        disabled={textSaving}
                      />
                      清除已保存密钥（改回使用服务器环境变量）
                    </label>
                  ) : null}

                  <div className={styles.modelFetchRow}>
                    <label className={styles.fieldLabelGrow}>
                      模型
                      <input
                        className={styles.fieldInput}
                        type="text"
                        value={textModel}
                        onChange={(e) => setTextModel(e.target.value.trim())}
                        disabled={textSaving}
                        placeholder="deepseek-chat / deepseek-v4.1-flash …"
                        spellCheck={false}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.fetchBtn}
                      onClick={() => void handleFetchModels()}
                      disabled={busy}
                    >
                      {fetchingModels ? '拉取中…' : '拉取模型'}
                    </button>
                  </div>
                  {fetchedModels.length > 0 ? (
                    <label className={styles.fieldLabel}>
                      从网关选择
                      <select
                        className={styles.fieldSelect}
                        value={fetchedModels.includes(String(textModel)) ? String(textModel) : ''}
                        onChange={(e) => {
                          if (e.target.value) setTextModel(e.target.value);
                        }}
                        disabled={textSaving}
                      >
                        <option value="">— 选择已拉取的模型 —</option>
                        {fetchedModels.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </section>

                <section className={styles.panel} aria-label="选择文案模型">
                  <div className={styles.panelHead}>
                    <h3 className={styles.panelTitle}>预置模型</h3>
                    <p className={styles.panelHint}>当前：{getTextLlmModelLabel(textModel)}</p>
                  </div>
                  <div className={styles.modelGrid} role="radiogroup" aria-label="文案模型">
                    {TEXT_LLM_MODELS.map((item) => {
                      const active = item === textModel;
                      return (
                        <button
                          key={item}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={active ? styles.modelCardActive : styles.modelCard}
                          onClick={() => setTextModel(item)}
                          disabled={textSaving}
                        >
                          <span className={styles.modelVendor}>
                            {getTextLlmModelVendor(item)}
                          </span>
                          <span className={styles.modelName}>
                            {getTextLlmModelLabel(item)}
                            {isDefaultTextLlmModel(item) ? ' · 默认' : ''}
                          </span>
                          <span className={styles.modelMeta}>{getTextLlmModelMeta(item)}</span>
                          <span className={styles.checkDot} aria-hidden>
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className={styles.sidePanel} aria-label="生效范围">
                <h3 className={styles.sideTitle}>同步生效范围</h3>
                <p className={styles.sideSub}>
                  改一处即覆盖下列全部文案链路，无需分模块配置。
                </p>
                <ol className={styles.usageList}>
                  {TEXT_LLM_USAGE_CATALOG.map((row, index) => (
                    <li key={row.key} className={styles.usageItem}>
                      <span className={styles.usageIndex}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className={styles.usageLabel}>{row.label}</p>
                        <p className={styles.usageDesc}>{row.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelConfigHub;
