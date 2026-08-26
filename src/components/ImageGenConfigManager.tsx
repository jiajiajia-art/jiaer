import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import adminImageGenConfigApi, {
  type AdminImageGenModuleRow,
} from '../api/admin/imageGenConfigApi';
import {
  IMAGE_GEN_MODELS,
  IMAGE_GEN_MODULE_CATALOG,
  normalizeImageGenModel,
  toImageGenModelsPayload,
  type ImageGenModel,
} from '../lib/imageGenConfig';
import { getApiErrorMessage } from '../utils/error';
import styles from './PointsAdminManager.module.css';

function fallbackModules(): AdminImageGenModuleRow[] {
  return IMAGE_GEN_MODULE_CATALOG.map((mod) => ({
    key: mod.key,
    label: mod.label,
    description: mod.description,
    model: 'gpt-image-2',
  }));
}

/** 功能注释：运营按模块选择 nano-banana-2 / gpt-image-2 并保存。 */
const ImageGenConfigManager: React.FC = () => {
  const [modules, setModules] = useState<AdminImageGenModuleRow[]>(fallbackModules);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminImageGenConfigApi.getConfig();
      if (response.data.success && response.data.data?.modules?.length) {
        setModules(
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleModelChange = (key: string, model: ImageGenModel) => {
    setModules((prev) =>
      prev.map((row) => (row.key === key ? { ...row, model } : row)),
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = toImageGenModelsPayload(modules);
      const response = await adminImageGenConfigApi.saveConfig(payload);
      if (response.data.success) {
        if (response.data.data?.modules?.length) {
          setModules(
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
      setSaving(false);
    }
  };

  return (
    <div className={styles.panelStack}>
      <section className={styles.heroCard}>
        <div>
          <div className={styles.sectionBadge}>生图配置</div>
          <h2 className={styles.heroTitle}>按业务模块切换生图模型</h2>
          <p className={styles.heroDesc}>
            可选模型：{IMAGE_GEN_MODELS.join(' / ')}。保存后约 30 秒内对新的生图请求生效（短缓存）。
          </p>
        </div>
        <div className={styles.tabRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadConfig()}
            disabled={loading || saving}
          >
            刷新
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleSave()}
            disabled={loading || saving}
          >
            {saving ? '保存中…' : '保存生图配置'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        {loading && modules.length === 0 ? (
          <p className={styles.emptyState}>加载中…</p>
        ) : (
          <div className={styles.panelStack}>
            {modules.map((row) => (
              <div
                key={row.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(180px, 0.6fr)',
                  gap: 16,
                  alignItems: 'center',
                  padding: '14px 0',
                  borderBottom: '1px solid rgba(222, 191, 166, 0.35)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#2e241d', marginBottom: 6 }}>
                    {row.label}
                  </div>
                  <div className={styles.itemMeta}>{row.description}</div>
                  <div className={styles.itemMeta} style={{ marginTop: 4, fontSize: 12 }}>
                    模块 key：{row.key}
                  </div>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className={styles.itemMeta}>生图模型</span>
                  <select
                    value={normalizeImageGenModel(row.model)}
                    onChange={(e) =>
                      handleModelChange(row.key, normalizeImageGenModel(e.target.value))
                    }
                    disabled={saving}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(215, 182, 156, 0.55)',
                      background: 'rgba(255, 253, 250, 0.98)',
                      color: '#4c3d31',
                      fontWeight: 600,
                    }}
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
        )}
      </section>
    </div>
  );
};

export default ImageGenConfigManager;
