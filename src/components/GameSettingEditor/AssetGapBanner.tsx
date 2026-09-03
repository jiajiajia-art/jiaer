import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AssetGapBanner.module.css';
import {
  IDEA_ASSET_PROGRESS_EVENT,
  mergeAssetProgressRowWithLiveCounts,
  peekIdeaAssetProgress,
  type IdeaAssetPhaseState,
  type IdeaAssetProgressSnapshot,
} from '../../lib/galgame/ideaFullWorkProgress';
import { peekIdeaFullWorkAssets } from '../../lib/galgame/ideaFullWorkSession';
import type { EditorAssetImageCounts } from '../../lib/galgame/assetCompleteness';

interface AssetGapBannerProps {
  kind: 'text' | 'full' | 'generating';
  fileId?: string;
  missingPortraits: number;
  missingScenes: number;
  missingCover: boolean;
  /** 编辑器真实张数：进度分子必须与侧栏已有图对齐 */
  liveAssetCounts?: EditorAssetImageCounts | null;
  onGoCharacters: () => void;
  onGoScenes: () => void;
  onGoCover?: () => void;
  onDismiss: () => void;
}

type RailStep = {
  id: 'text' | 'portraits' | 'scenes' | 'cover';
  label: string;
  state: IdeaAssetPhaseState | 'done';
  meta?: string;
};

/**
 * 功能注释：创作流程页顶部素材提醒；生成中展示分阶段进度轨与百分比。
 */
const AssetGapBanner: React.FC<AssetGapBannerProps> = ({
  kind,
  fileId,
  missingPortraits,
  missingScenes,
  missingCover,
  liveAssetCounts = null,
  onGoCharacters,
  onGoScenes,
  onGoCover,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<IdeaAssetProgressSnapshot | null>(() => (
    fileId ? peekIdeaAssetProgress(fileId) : null
  ));

  useEffect(() => {
    if (!fileId || kind !== 'generating') return;
    setProgress(peekIdeaAssetProgress(fileId));
    const onEvt = (event: Event) => {
      const detail = (event as CustomEvent<IdeaAssetProgressSnapshot>).detail;
      if (detail?.fileId === fileId) {
        setProgress(detail);
      }
    };
    window.addEventListener(IDEA_ASSET_PROGRESS_EVENT, onEvt);
    const timer = window.setInterval(() => {
      setProgress(peekIdeaAssetProgress(fileId));
    }, 1200);
    return () => {
      window.removeEventListener(IDEA_ASSET_PROGRESS_EVENT, onEvt);
      window.clearInterval(timer);
    };
  }, [fileId, kind]);

  const flags = progress?.flags || (fileId ? peekIdeaFullWorkAssets(fileId) : null);

  // 功能注释：缺口张数以编辑器真实列表为准（liveAssetCounts），避免父级 props 滞后显示旧预计值
  const resolvedMissingPortraits = liveAssetCounts
    ? Math.max(0, liveAssetCounts.portraitsTotal - liveAssetCounts.portraitsPresent)
    : missingPortraits;
  const resolvedMissingScenes = liveAssetCounts
    ? Math.max(0, liveAssetCounts.scenesTotal - liveAssetCounts.scenesPresent)
    : missingScenes;
  const resolvedMissingCover = liveAssetCounts
    ? !liveAssetCounts.coverPresent
    : missingCover;

  const steps: RailStep[] = useMemo(() => {
    const phaseMeta = (
      row: { state: IdeaAssetPhaseState; completed: number; total: number; failed?: number } | undefined,
    ) => {
      if (!row || row.state === 'skipped') return undefined;
      if (row.total > 0) {
        const failed = Number(row.failed) || 0;
        if (failed > 0 || row.state === 'failed') {
          return t('createGame.assetProgressCountPartial', {
            completed: Math.min(row.completed, row.total),
            total: row.total,
            failed,
          });
        }
        return t('createGame.assetProgressCount', {
          completed: Math.min(row.completed, row.total),
          total: row.total,
        });
      }
      if (row.state === 'active') return t('createGame.assetProgressStarting');
      return undefined;
    };

    const portraitsRow = mergeAssetProgressRowWithLiveCounts('portraits', progress?.portraits, liveAssetCounts);
    const scenesRow = mergeAssetProgressRowWithLiveCounts('scenes', progress?.scenes, liveAssetCounts);
    const coverRow = mergeAssetProgressRowWithLiveCounts('cover', progress?.cover, liveAssetCounts);

    const list: RailStep[] = [
      {
        id: 'text',
        label: t('createGame.assetProgressStepText'),
        state: 'done',
      },
    ];
    if (!flags || flags.portraits) {
      list.push({
        id: 'portraits',
        label: t('createGame.assetProgressStepPortraits'),
        state: portraitsRow?.state || 'pending',
        meta: phaseMeta(portraitsRow),
      });
    }
    if (!flags || flags.scenes) {
      list.push({
        id: 'scenes',
        label: t('createGame.assetProgressStepScenes'),
        state: scenesRow?.state || 'pending',
        meta: phaseMeta(scenesRow),
      });
    }
    if (flags?.cover) {
      list.push({
        id: 'cover',
        label: t('createGame.assetProgressStepCover'),
        state: coverRow?.state || 'pending',
        meta: phaseMeta(coverRow),
      });
    }
    return list;
  }, [flags, progress, liveAssetCounts, t]);

  const message = kind === 'generating'
    ? t('createGame.assetGapBannerGenerating')
    : kind === 'full'
      ? t('createGame.assetGapBannerFull')
      : t('createGame.assetGapBannerText');
  const title = kind === 'generating'
    ? t('createGame.assetGapBannerGeneratingTitle')
    : t('createGame.assetGapBannerTitle');

  const percent = kind === 'generating' ? (progress?.percent ?? 0) : 0;
  const activeStep = steps.find((s) => s.state === 'active');

  return (
    <div
      className={`${styles.banner} ${kind === 'generating' ? styles.bannerGenerating : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.icon} aria-hidden>
        {kind === 'generating' ? '◎' : '!'}
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <p className={styles.title}>{title}</p>
          {kind === 'generating' && (
            <span className={styles.percentBadge}>
              {t('createGame.assetProgressPercent', { percent })}
            </span>
          )}
        </div>
        <p className={styles.message}>{message}</p>

        {kind === 'generating' && (
          <div className={styles.pipeline}>
            <div className={styles.track}>
              <div className={styles.trackFill} style={{ width: `${percent}%` }} />
            </div>
            <ol className={styles.steps}>
              {steps.map((step, index) => {
                const isActive = step.state === 'active';
                const isDone = step.state === 'done';
                const isFailed = step.state === 'failed';
                return (
                  <li
                    key={step.id}
                    className={[
                      styles.step,
                      isDone ? styles.stepDone : '',
                      isActive ? styles.stepActive : '',
                      isFailed ? styles.stepFailed : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className={styles.stepIndex} aria-hidden>
                      {isDone ? '✓' : isFailed ? '!' : index + 1}
                    </span>
                    <span className={styles.stepLabel}>{step.label}</span>
                    {step.meta && <span className={styles.stepMeta}>{step.meta}</span>}
                  </li>
                );
              })}
            </ol>
            {activeStep && (
              <p className={styles.nowLine}>
                {t('createGame.assetProgressNow', { step: activeStep.label })}
                {activeStep.meta ? ` · ${activeStep.meta}` : ''}
              </p>
            )}
          </div>
        )}

        {kind !== 'generating' && (
          <>
            <div className={styles.meta}>
              {resolvedMissingPortraits > 0 && (
                <span>{t('createGame.missingPortraitsCount', { count: resolvedMissingPortraits })}</span>
              )}
              {resolvedMissingScenes > 0 && (
                <span>{t('createGame.missingScenesCount', { count: resolvedMissingScenes })}</span>
              )}
              {resolvedMissingCover && <span>{t('createGame.missingCoverLabel')}</span>}
            </div>
            <div className={styles.actions}>
              {resolvedMissingPortraits > 0 && (
                <button type="button" className={styles.linkBtn} onClick={onGoCharacters}>
                  {t('createGame.goGeneratePortraits')}
                </button>
              )}
              {resolvedMissingScenes > 0 && (
                <button type="button" className={styles.linkBtn} onClick={onGoScenes}>
                  {t('createGame.goGenerateScenes')}
                </button>
              )}
              {resolvedMissingCover && onGoCover && (
                <button type="button" className={styles.linkBtn} onClick={onGoCover}>
                  {t('createGame.goUploadCover')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {kind !== 'generating' && (
        <button
          type="button"
          className={styles.close}
          onClick={onDismiss}
          aria-label={t('common.close')}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default AssetGapBanner;
