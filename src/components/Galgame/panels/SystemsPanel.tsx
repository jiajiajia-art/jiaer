import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import GameConfirmModal from '../GameConfirmModal';
import { buildSystemPanelItems } from '../../../lib/galgame/systemPanelFromMorePromptForms';
import {
  GAME_START_UE_COPY,
  type OpeningRouteOption,
} from '../../../lib/galgame/gameStartConfig';

interface SystemsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  morePromptForms: unknown;
  /** 开场路线选项（创作台 keyEvents / 兜底开场路线） */
  openingRoutes?: OpeningRouteOption[];
  currentOpeningRouteId?: string;
  /** 确认更换路线后回调（由页面写入 session） */
  onConfirmOpeningRoute?: (routeId: string) => void | Promise<void>;
  routeChangeDisabled?: boolean;
}

/**
 * 系统面板：世界书条目只读展示 + UE「目前选择路线」可切换（确认后生效）。
 */
const SystemsPanel: React.FC<SystemsPanelProps> = ({
  isOpen,
  onClose,
  morePromptForms,
  openingRoutes = [],
  currentOpeningRouteId = '',
  onConfirmOpeningRoute,
  routeChangeDisabled = false,
}) => {
  const { t } = useTranslation();
  const items = useMemo(() => buildSystemPanelItems(morePromptForms), [morePromptForms]);
  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);

  const pendingRoute = useMemo(
    () => openingRoutes.find((r) => r.id === pendingRouteId) || null,
    [openingRoutes, pendingRouteId],
  );

  const requestRouteChange = (routeId: string) => {
    if (routeChangeDisabled || !onConfirmOpeningRoute) return;
    if (routeId === currentOpeningRouteId) return;
    setPendingRouteId(routeId);
  };

  const confirmRouteChange = async () => {
    if (!pendingRouteId || !onConfirmOpeningRoute) {
      setPendingRouteId(null);
      return;
    }
    setSavingRoute(true);
    try {
      await onConfirmOpeningRoute(pendingRouteId);
      setPendingRouteId(null);
    } catch (err) {
      console.error(err);
      toast.error('更换路线失败，请重试');
    } finally {
      setSavingRoute(false);
    }
  };

  return (
    <>
      <PlayPanelShell
        isOpen={isOpen}
        title={t('galgame.panelSystemsTitle')}
        subtitle={t('galgame.panelSystemsSubtitle')}
        onClose={onClose}
      >
        {openingRoutes.length > 0 ? (
          <section className={shell.card} aria-label={GAME_START_UE_COPY.currentRouteSection}>
            <h3 className={shell.cardTitle}>{GAME_START_UE_COPY.currentRouteSection}</h3>
            <p className={shell.cardMeta}>{GAME_START_UE_COPY.currentRouteHint}</p>
            <div className={shell.routeList}>
              {openingRoutes.map((route) => {
                const active = route.id === currentOpeningRouteId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    className={`${shell.routeChip} ${active ? shell.routeChipActive : ''}`}
                    disabled={routeChangeDisabled || savingRoute}
                    onClick={() => requestRouteChange(route.id)}
                  >
                    <span className={shell.routeChipTitle}>
                      {active ? '● ' : ''}
                      {route.title}
                    </span>
                    {route.summary ? (
                      <span className={shell.routeChipSummary}>{route.summary}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {items.length === 0 ? (
          openingRoutes.length === 0 ? (
            <div className={shell.empty}>{t('galgame.panelSystemsEmpty')}</div>
          ) : null
        ) : (
          items.map((item) => (
            <article key={item.id} className={shell.card}>
              <h3 className={shell.cardTitle}>{item.name}</h3>
              {item.summary ? <p className={shell.cardBody}>{item.summary}</p> : null}
              <p className={shell.cardMeta}>
                {t('galgame.panelSystemsKeywords')}:{' '}
                {item.keywords.length > 0 ? item.keywords.join('、') : t('galgame.panelSystemsNoKeywords')}
                {item.constant ? ` · ${t('galgame.panelSystemsConstant')}` : ''}
              </p>
              <p className={shell.cardMeta}>
                {t('galgame.panelStatus')}: {t('galgame.panelSystemsPlayable')}
              </p>
            </article>
          ))
        )}
      </PlayPanelShell>

      <GameConfirmModal
        isOpen={Boolean(pendingRouteId)}
        title={GAME_START_UE_COPY.changeRouteConfirmTitle}
        message={
          pendingRoute
            ? `${GAME_START_UE_COPY.changeRouteConfirmMessage}\n「${pendingRoute.title}」`
            : GAME_START_UE_COPY.changeRouteConfirmMessage
        }
        confirmText={savingRoute ? '更换中…' : GAME_START_UE_COPY.changeRouteConfirmOk}
        cancelText="取消"
        onConfirm={() => {
          void confirmRouteChange();
        }}
        onCancel={() => {
          if (!savingRoute) setPendingRouteId(null);
        }}
      />
    </>
  );
};

export default SystemsPanel;
