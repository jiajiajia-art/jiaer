import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import styles from './ServerAttributesPanel.module.css';
import { useGameStore } from '../../store/gameStore';
import { streamAttributePanels } from '../../api/galgame/attributePanelsStream';

interface ServerAttributesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Galgame 专用属性面板（SSE）
 * - 打开面板不自动请求；点击“刷新”开始流
 * - 流式期间仅显示“加载中…”，不展示增量文本
 * - 完成后一次性展示解析后的 tabs 文本
 */
const ServerAttributesPanel: React.FC<ServerAttributesPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { sessionId } = useGameStore();
  const [panels, setPanels] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const panelKeys = useMemo(() => Object.keys(panels || {}), [panels]);
  const activeContent = activeKey ? panels[activeKey] : '';

  const startStreaming = async () => {
    if (!sessionId) {
      setError(t('galgame.panelAttrsNoSession'));
      return;
    }
    if (isStreaming) return; // 并发保护

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setIsStreaming(true);
    setPanels({});
    setActiveKey(null);

    try {
      await streamAttributePanels<{ panels: Record<string, string> }>(
        sessionId,
        {
          onStart: () => {},
          onChunk: () => {}, // 不展示增量
          onError: (msg) => setError(msg || 'UNKNOWN_ERROR'),
          onDone: (result) => {
            if (result && result.panels && typeof result.panels === 'object') {
              setPanels(result.panels);
              const firstKey = Object.keys(result.panels)[0] || null;
              setActiveKey(firstKey);
            } else {
              setError(t('galgame.panelAttrsInvalid'));
            }
          },
        },
        controller.signal
      );
    } catch (e: any) {
      setError(e?.message || t('galgameUi.common.requestFailed'));
    } finally {
      setIsStreaming(false);
      setLoading(false);
    }
  };

  // 关闭面板时中断流与 loading
  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setIsStreaming(false);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panelWrapper} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panel}>
          <button className={styles.closeButton} onClick={onClose}>
            <IoClose />
          </button>

          <div className={styles.header}>
            <div className={styles.headerBar}>
              <div style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text) 80%, transparent)' }}>
                {loading ? t('galgame.panelLoading') : ''}
              </div>
              <button
                className={styles.refreshButton}
                onClick={() => startStreaming()}
                disabled={isStreaming}
              >
                {t('galgame.panelRefresh')}
              </button>
            </div>
            <div className={styles.tabs}>
              {panelKeys.map((key) => (
                <button
                  key={key}
                  className={`${styles.tab} ${activeKey === key ? styles.tabActive : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.body}>
            {loading ? (
              <div className={styles.loading}>{t('galgame.panelLoading')}</div>
            ) : panelKeys.length === 0 ? (
              <div className={styles.empty}>{t('galgameUi.serverAttributes.empty')}</div>
            ) : (
              <div className={styles.contentText}>{activeContent}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerAttributesPanel;

