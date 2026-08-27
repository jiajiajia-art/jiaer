import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminTextLlmConfigApi from '../api/admin/textLlmConfigApi';
import {
  DEFAULT_TEXT_LLM_MODEL,
  TEXT_LLM_MODELS,
  TEXT_LLM_USAGE_CATALOG,
  getTextLlmModelLabel,
  normalizeTextLlmModel,
  type TextLlmModel,
} from '../lib/textLlmConfig';
import { getApiErrorMessage } from '../utils/error';
import styles from './PointsAdminManager.module.css';

/** 功能注释：全站统一文案模型；DeepSeek 经 epone.ggb.today OpenAI 兼容网关。 */
const TextLlmConfigManager: React.FC = () => {
  const navigate = useNavigate();
  const [model, setModel] = useState<TextLlmModel>(DEFAULT_TEXT_LLM_MODEL);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminTextLlmConfigApi.getConfig();
      if (response.data.success && response.data.data?.model) {
        setModel(normalizeTextLlmModel(response.data.data.model));
      } else {
        toast.error(response.data.message || '加载文案配置失败');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载文案配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await adminTextLlmConfigApi.saveConfig(model);
      if (response.data.success) {
        if (response.data.data?.model) {
          setModel(normalizeTextLlmModel(response.data.data.model));
        }
        toast.success(response.data.message || '文案模型配置已保存');
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
          <div className={styles.sectionBadge}>文案配置</div>
          <h2 className={styles.heroTitle}>全站统一文本模型</h2>
          <p className={styles.heroDesc}>
            选择一处即对所有文案链路生效。DeepSeek 系列经{' '}
            <a href="https://epone.ggb.today" target="_blank" rel="noreferrer">
              epone.ggb.today
            </a>{' '}
            网关调用；默认豆包 Seed 1.8。保存后约 30 秒内对新请求生效。
          </p>
        </div>
        <div className={styles.tabRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate('/admin/image-gen')}
          >
            返回生图配置
          </button>
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
            {saving ? '保存中…' : '保存文案配置'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        {loading ? (
          <p className={styles.emptyState}>加载中…</p>
        ) : (
          <div className={styles.panelStack}>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxWidth: 480,
              }}
            >
              <span className={styles.itemMeta}>当前文案模型（全站统一）</span>
              <select
                value={model}
                onChange={(e) => setModel(normalizeTextLlmModel(e.target.value))}
                disabled={saving}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(215, 182, 156, 0.55)',
                  background: 'rgba(255, 253, 250, 0.98)',
                  color: '#4c3d31',
                  fontWeight: 600,
                }}
              >
                {TEXT_LLM_MODELS.map((item) => (
                  <option key={item} value={item}>
                    {getTextLlmModelLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700, color: '#2e241d', marginBottom: 10 }}>
                以下能力将使用同一模型
              </div>
              {TEXT_LLM_USAGE_CATALOG.map((row) => (
                <div
                  key={row.key}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(222, 191, 166, 0.35)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#4c3d31', marginBottom: 4 }}>
                    {row.label}
                  </div>
                  <div className={styles.itemMeta}>{row.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default TextLlmConfigManager;
