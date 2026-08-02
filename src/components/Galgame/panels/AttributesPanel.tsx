import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import { useGameStore } from '../../../store/gameStore';
import { streamAttributePanels } from '../../../api/galgame/attributePanelsStream';
import { fetchPlayUiState } from '../../../api/galgame/playUi';
import {
  isAbortError,
  normalizeAttributePanels,
  pickAttributeCardsFromPanels,
  shouldSkipAttributeAutoRefresh,
} from '../../../lib/galgame/attributePanelValues';
import type { SessionPlayerProfile } from '../../../lib/galgame/playerCharacterCard';
import PlayerArchiveSection, { type PlayerArchiveView } from './PlayerArchiveSection';

interface AttributesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** 父组件串行刷新用；面板内仅手动刷新与打开补拉 */
  autoRefreshToken?: number;
  /** 为 true 时忽略 autoRefreshToken（改由父组件拉流，避免与任务抢锁） */
  suppressAutoRefresh?: boolean;
  cachedPanels?: Record<string, string>;
  onPanelsUpdated?: (panels: Record<string, string>) => void;
  onPlayerEditableNpcsUpdated?: (profiles: unknown[]) => void;
  sessionPlayerProfile?: SessionPlayerProfile | null;
  onSessionPlayerProfileChange?: (profile: SessionPlayerProfile) => void;
}

/**
 * 功能注释：属性面板优先数值卡；「刷新」只读 session 已存面板，不重跑 LLM（避免数值被重新推断改掉）。
 * LLM 重算仅由父组件在叙事回合结束后触发（auto）。
 */
const AttributesPanel: React.FC<AttributesPanelProps> = ({
  isOpen,
  onClose,
  autoRefreshToken = 0,
  suppressAutoRefresh = false,
  cachedPanels,
  onPanelsUpdated,
  onPlayerEditableNpcsUpdated,
  sessionPlayerProfile = null,
  onSessionPlayerProfileChange,
}) => {
  const { t } = useTranslation();
  const { sessionId } = useGameStore();
  const [playerProfile, setPlayerProfile] = useState<SessionPlayerProfile | null>(sessionPlayerProfile);
  const [archiveView, setArchiveView] = useState<PlayerArchiveView>('overview');
  const [panels, setPanels] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastStartedAtRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const requestSeqRef = useRef(0);
  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  const panelKeys = useMemo(() => Object.keys(panels || {}), [panels]);
  const { cards } = useMemo(() => pickAttributeCardsFromPanels(panels), [panels]);
  const activeContent = activeKey ? panels[activeKey] || '' : '';

  useEffect(() => {
    setPlayerProfile(sessionPlayerProfile);
  }, [sessionPlayerProfile]);

  useEffect(() => {
    if (!isOpen) setArchiveView('overview');
  }, [isOpen]);

  useEffect(() => {
    if (cachedPanels && Object.keys(cachedPanels).length > 0) {
      const normalizedPanels = normalizeAttributePanels(cachedPanels);
      setPanels(normalizedPanels);
      const keys = Object.keys(normalizedPanels);
      setActiveKey((prev) => (prev && normalizedPanels[prev] != null ? prev : keys[0] || null));
      setError(null);
    }
  }, [cachedPanels]);

  const applyPanels = useCallback(
    (next: Record<string, string>) => {
      const normalizedPanels = normalizeAttributePanels(next);
      setPanels(normalizedPanels);
      onPanelsUpdated?.(normalizedPanels);
      const keys = Object.keys(normalizedPanels);
      setActiveKey((prev) => (prev && normalizedPanels[prev] != null ? prev : keys[0] || null));
      setError(null);
    },
    [onPanelsUpdated]
  );

  /** 功能注释：只读已持久化属性，不触发 LLM，保证刷新不会改数值。 */
  const reloadCachedPanels = useCallback(async () => {
    if (!sessionId) {
      setError(t('galgame.panelAttrsNoSession'));
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlayUiState(sessionId);
      if (seq !== requestSeqRef.current) return;
      const next =
        data.attributePanels && typeof data.attributePanels === 'object'
          ? data.attributePanels
          : {};
      applyPanels(next);
    } catch (e: unknown) {
      if (seq !== requestSeqRef.current) return;
      setError(e instanceof Error ? e.message : t('galgame.requestError'));
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [sessionId, t, applyPanels]);

  /** 功能注释：叙事回合后由父组件触发；允许 LLM 增量更新并写回 session。 */
  const regenerateFromLlm = useCallback(
    async (_reason: 'auto') => {
      if (!sessionId) {
        setError(t('galgame.panelAttrsNoSession'));
        return;
      }
      if (
        shouldSkipAttributeAutoRefresh({
          isStreaming: isStreamingRef.current,
          lastStartedAt: lastStartedAtRef.current,
          now: Date.now(),
        })
      ) {
        return;
      }
      if (isStreamingRef.current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeqRef.current;
      lastStartedAtRef.current = Date.now();
      isStreamingRef.current = true;
      setLoading(true);
      setError(null);
      setIsStreaming(true);

      try {
        const result = await streamAttributePanels<{
          panels: Record<string, string>;
          playerEditableNpcs?: unknown[];
        }>(
          sessionId,
          {
            onError: (msg) => {
              if (controller.signal.aborted || seq !== requestSeqRef.current) return;
              if (msg === 'INVALID_JSON') return;
              if (msg === 'Session is busy') {
                setError(t('galgame.panelAttrsBusy'));
                return;
              }
              setError(msg || t('galgame.requestError'));
            },
          },
          controller.signal
        );

        if (controller.signal.aborted || seq !== requestSeqRef.current) {
          return;
        }

        if (result?.panels && typeof result.panels === 'object') {
          applyPanels(result.panels);
        }
        if (Array.isArray(result?.playerEditableNpcs)) {
          onPlayerEditableNpcsUpdated?.(result.playerEditableNpcs);
        }
      } catch (e: unknown) {
        if (isAbortError(e) || controller.signal.aborted || seq !== requestSeqRef.current) {
          return;
        }
        setError(e instanceof Error ? e.message : t('galgame.requestError'));
      } finally {
        if (seq === requestSeqRef.current) {
          isStreamingRef.current = false;
          setIsStreaming(false);
          setLoading(false);
        }
      }
    },
    [sessionId, t, applyPanels, onPlayerEditableNpcsUpdated]
  );

  const regenerateFromLlmRef = useRef(regenerateFromLlm);
  regenerateFromLlmRef.current = regenerateFromLlm;
  const reloadCachedPanelsRef = useRef(reloadCachedPanels);
  reloadCachedPanelsRef.current = reloadCachedPanels;

  useEffect(() => {
    if (suppressAutoRefresh) return;
    if (!autoRefreshToken || !sessionId) return;
    void regenerateFromLlmRef.current('auto');
  }, [autoRefreshToken, sessionId, suppressAutoRefresh]);

  // 打开面板：有缓存则已由 cachedPanels 同步；无数据时只读库，不重算
  useEffect(() => {
    if (!isOpen || !sessionId) return;
    if (Object.keys(panelsRef.current).length > 0 || isStreamingRef.current) return;
    void reloadCachedPanelsRef.current();
  }, [isOpen, sessionId]);

  const showCards = cards.length > 0;
  const showTextFallback = false;
  const showEmpty = !loading && !error && !showCards && !showTextFallback;
  const isOverview = archiveView === 'overview';

  const shellTitle =
    archiveView === 'import'
      ? '导入已有角色卡'
      : archiveView === 'preview'
        ? '导入预览'
        : t('galgame.panelAttrsTitle');

  const shellSubtitle =
    archiveView === 'import'
      ? '从账号卡库选择一张覆盖本局档案'
      : archiveView === 'preview'
        ? undefined
        : isOverview
          ? t('galgame.panelAttrsSubtitle')
          : undefined;

  const handleArchiveBack = () => {
    if (archiveView === 'preview') {
      setArchiveView('import');
      return;
    }
    if (archiveView === 'import') {
      setArchiveView('overview');
    }
  };

  const handleClose = () => {
    setArchiveView('overview');
    onClose();
  };

  return (
    <PlayPanelShell
      isOpen={isOpen}
      title={shellTitle}
      subtitle={shellSubtitle}
      onClose={handleClose}
      hideHeader={archiveView === 'edit'}
      showBack={isOverview}
      onHeaderBack={
        archiveView === 'import' || archiveView === 'preview'
          ? handleArchiveBack
          : undefined
      }
      footer={
        isOverview ? (
          <button
            type="button"
            className={shell.backButton}
            disabled={isStreaming || loading}
            onClick={() => void reloadCachedPanels()}
          >
            {t('galgame.panelRefresh')}
          </button>
        ) : null
      }
    >
      {isOverview && error ? <div className={shell.empty}>{error}</div> : null}
      {isOverview && loading ? <div className={shell.empty}>{t('galgame.panelLoading')}</div> : null}

      <PlayerArchiveSection
        profile={playerProfile}
        view={archiveView}
        onViewChange={setArchiveView}
        onProfileChange={(next) => {
          setPlayerProfile(next);
          onSessionPlayerProfileChange?.(next);
        }}
      />

      {isOverview && !loading && showCards ? (
        <section className={shell.attrSection} aria-label="属性数值">
          <h3 className={shell.attrSectionTitle}>属性数值</h3>
          <div className={`${shell.grid} ${shell.attrGrid}`}>
            {cards.map((card) => (
              <div key={`${card.label}-${card.value}-${card.rawLine}`} className={shell.attrCard}>
                <div>
                  <div className={shell.cardTitle}>{card.label}</div>
                  <div className={shell.cardMeta}>{t('galgame.panelAttrsCurrent')}</div>
                </div>
                <div className={shell.attrValue}>{card.value}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isOverview && !loading && showTextFallback ? (
        <>
          {panelKeys.length > 1 ? (
            <div className={shell.tabRow}>
              {panelKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`${shell.tab} ${activeKey === key ? shell.tabActive : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          ) : null}
          <pre className={shell.contentText}>{activeContent}</pre>
        </>
      ) : null}

      {isOverview && showEmpty ? <div className={shell.empty}>{t('galgame.panelAttrsEmpty')}</div> : null}
    </PlayPanelShell>
  );
};

export default AttributesPanel;
