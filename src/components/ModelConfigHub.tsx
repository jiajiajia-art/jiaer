import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminImageGenConfigApi, {
  type AdminImageGenModuleRow,
} from '../api/admin/imageGenConfigApi';
import adminTextLlmConfigApi from '../api/admin/textLlmConfigApi';
import {
  IMAGE_GEN_MODELS,
  IMAGE_GEN_MODULE_CATALOG,
  normalizeImageGenModel,
  toImageGenModelsPayload,
  type ImageGenModel,
} from '../lib/imageGenConfig';
import {
  DEFAULT_TEXT_LLM_MODEL,
  TEXT_LLM_MODELS,
  TEXT_LLM_USAGE_CATALOG,
  getTextLlmModelLabel,
  getTextLlmModelMeta,
  getTextLlmModelVendor,
  isDefaultTextLlmModel,
  normalizeTextLlmModel,
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
 * 功能注释：生图 / 文案同页双轨 Tab（墨台滑块），URL 同步，侧栏只挂一个「模型配置」。
 */
const ModelConfigHub: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pane = resolveModelConfigPane(location.pathname);

  const [imageModules, setImageModules] = useState<AdminImageGenModuleRow[]>(fallbackImageModules);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);

  const [textModel, setTextModel] = useState<TextLlmModel>(DEFAULT_TEXT_LLM_MODEL);
  const [textLoading, setTextLoading] = useState(false);
  const [textSaving, setTextSaving] = useState(false);

  const loadImage = useCallback(async () => {
    try {
      setImageLoading(true);
      const response = await adminImageGenConfigApi.getConfig();
      if (response.data.success && response.data.data?.modules?.length) {
        setImageModules(
          response.data.data.modules.map((row) => ({
            ...row,
            model: normalizeImageGenModel(row.model),
          })),
        );
      } else {
        toast.error(response.data.message || '加载生图配置失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载生图配置失败'));
    } finally {
      setImageLoading(false);
    }
  }, []);

  const loadText = useCallback(async () => {
    try {
      setTextLoading(true);
      const response = await adminTextLlmConfigApi.getConfig();
      if (response.data.success && response.data.data?.model) {
        setTextModel(normalizeTextLlmModel(response.data.data.model));
      } else {
        toast.error(response.data.message || '加载文案配置失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载文案配置失败'));
    } finally {
      setTextLoading(false);
    }
  }, []);

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
    try {
      setImageSaving(true);
      const response = await adminImageGenConfigApi.saveConfig(
        toImageGenModelsPayload(imageModules),
      );
      if (response.data.success) {
        if (response.data.data?.modules?.length) {
          setImageModules(
            response.data.data.modules.map((row) => ({
              ...row,
              model: normalizeImageGenModel(row.model),
            })),
          );
        }
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

  const handleSaveText = async () => {
    try {
      setTextSaving(true);
      const response = await adminTextLlmConfigApi.saveConfig(textModel);
      if (response.data.success) {
        if (response.data.data?.model) {
          setTextModel(normalizeTextLlmModel(response.data.data.model));
        }
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

  const busy = pane === 'image' ? imageLoading || imageSaving : textLoading || textSaving;

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
              可选 {IMAGE_GEN_MODELS.join(' / ')}。各模块独立配置；保存后约 30 秒对新的生图请求生效。
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
              叙事、私聊、文档解析、记忆压缩与故事结构共用同一模型。DeepSeek 经{' '}
              <a href="https://epone.ggb.today" target="_blank" rel="noreferrer">
                epone.ggb.today
              </a>{' '}
              调用；默认豆包 Seed 1.8。保存后约 30 秒生效。
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
          )}
        </div>
      ) : (
        <div className={styles.pane} role="tabpanel" aria-label="文案配置">
          {textLoading ? (
            <p className={styles.loading}>加载中…</p>
          ) : (
            <div className={styles.stage}>
              <section className={styles.panel} aria-label="选择文案模型">
                <div className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>选择模型</h3>
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
