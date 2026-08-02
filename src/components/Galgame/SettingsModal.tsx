import React from 'react';
import styles from './SettingsModal.module.css';
import { useTranslation } from 'react-i18next';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExitGame: () => void;
  onDeleteSession?: () => void;
  hideExitButton?: boolean;
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  /** 当前场景无 soundtrack 时禁用音乐开关 */
  musicDisabled?: boolean;
  musicDisabledReason?: string;
  /** 积分只读 */
  points?: number | string | null;
  onOpenSave?: () => void;
  onOpenHistory?: () => void;
  isTextMode?: boolean;
  onToggleTextMode?: () => void;
  isAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
  autoPlayDisabled?: boolean;
  /** Debug：仅原逻辑开启时传入回调即显示 */
  onOpenMemoryDebug?: () => void;
  onToggleAutoToCompression?: () => void;
  isAutoToCompression?: boolean;
  autoToCompressionDisabled?: boolean;
}

/** 功能注释：原底栏功能（除设置外）收纳于此；Debug 仅迁移入口，行为由调用方保持原逻辑。 */
const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onExitGame,
  onDeleteSession,
  hideExitButton = false,
  isMusicPlaying,
  onToggleMusic,
  volume,
  onVolumeChange,
  musicDisabled = false,
  musicDisabledReason,
  points,
  onOpenSave,
  onOpenHistory,
  isTextMode,
  onToggleTextMode,
  isAutoPlay,
  onToggleAutoPlay,
  autoPlayDisabled,
  onOpenMemoryDebug,
  onToggleAutoToCompression,
  isAutoToCompression,
  autoToCompressionDisabled,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const volumePercent = Math.round((volume ?? 0) * 100);

  const runAndClose = (fn?: () => void) => {
    fn?.();
    onClose();
  };

  /**
   * 功能注释：文本/自动/压测会立刻改游玩态，若弹窗仍开着会挡住画面。
   * 先关设置，再在下一帧执行切换，避免「功能已开、弹窗还在」的体验。
   */
  const togglePlayModeAndClose = (fn?: () => void) => {
    onClose();
    if (!fn) return;
    window.setTimeout(() => {
      fn();
    }, 0);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t('createGame.settings')}</h3>
        </div>

        <div className={styles.body}>
          {points != null && points !== '' ? (
            <div className={styles.row}>
              <div className={styles.rowLabel}>
                <div className={styles.rowTitle}>{t('galgame.points')}</div>
                <div className={styles.rowDesc}>{t('galgame.pointsReadonly')}</div>
              </div>
              <span className={styles.value}>{points}</span>
            </div>
          ) : null}

          <div className={`${styles.row} ${musicDisabled ? styles.rowDisabled : ''}`}>
            <div className={styles.rowLabel}>
              <div className={styles.rowTitle}>{t('createGame.music')}</div>
              <div className={styles.rowDesc}>
                {musicDisabled
                  ? musicDisabledReason || t('galgame.musicUnavailable')
                  : t('createGame.musicToggle')}
              </div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={!!isMusicPlaying && !musicDisabled}
                disabled={musicDisabled}
                onChange={() => {
                  if (!musicDisabled) onToggleMusic();
                }}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          <div className={styles.row}>
            <div className={styles.rowLabel}>
              <div className={styles.rowTitle}>{t('createGame.volume')}</div>
              <div className={styles.rowDesc}>0 - 100</div>
            </div>
            <div className={styles.sliderWrap}>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                value={Number.isFinite(volumePercent) ? volumePercent : 50}
                style={
                  {
                    ['--percent' as const]: `${Number.isFinite(volumePercent) ? volumePercent : 50}%`,
                  } as React.CSSProperties
                }
                onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              />
              <span className={styles.value}>{volumePercent}%</span>
            </div>
          </div>

          {onOpenSave ? (
            <button type="button" className={styles.actionRow} onClick={() => runAndClose(onOpenSave)}>
              <span className={styles.rowTitle}>{t('galgame.save')}</span>
              <span className={styles.rowDesc}>{t('galgame.settingsActionOpen')}</span>
            </button>
          ) : null}

          {onOpenHistory ? (
            <button type="button" className={styles.actionRow} onClick={() => runAndClose(onOpenHistory)}>
              <span className={styles.rowTitle}>{t('galgame.history')}</span>
              <span className={styles.rowDesc}>{t('galgame.settingsActionOpen')}</span>
            </button>
          ) : null}

          {onToggleTextMode ? (
            <div className={styles.row}>
              <div className={styles.rowLabel}>
                <div className={styles.rowTitle}>{t('galgame.text')}</div>
                <div className={styles.rowDesc}>{t('galgame.settingsTextToggle')}</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={!!isTextMode}
                  onChange={() => togglePlayModeAndClose(onToggleTextMode)}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>
          ) : null}

          {onToggleAutoPlay ? (
            <div className={styles.row}>
              <div className={styles.rowLabel}>
                <div className={styles.rowTitle}>{t('galgame.auto')}</div>
                <div className={styles.rowDesc}>{t('galgame.settingsAutoToggle')}</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={!!isAutoPlay}
                  disabled={autoPlayDisabled}
                  onChange={() => {
                    if (!autoPlayDisabled) togglePlayModeAndClose(onToggleAutoPlay);
                  }}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>
          ) : null}

          {onOpenMemoryDebug ? (
            <button
              type="button"
              className={styles.actionRow}
              onClick={() => runAndClose(onOpenMemoryDebug)}
            >
              <span className={styles.rowTitle}>{t('galgame.debugMemory')}</span>
              <span className={styles.rowDesc}>{t('galgame.settingsActionOpen')}</span>
            </button>
          ) : null}

          {onToggleAutoToCompression ? (
            <div className={styles.row}>
              <div className={styles.rowLabel}>
                <div className={styles.rowTitle}>{t('galgame.debugCompression')}</div>
                <div className={styles.rowDesc}>{t('galgame.debugCompressionDesc')}</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={!!isAutoToCompression}
                  disabled={autoToCompressionDisabled}
                  onChange={() => {
                    if (!autoToCompressionDisabled) {
                      togglePlayModeAndClose(onToggleAutoToCompression);
                    }
                  }}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>
          ) : null}

          <div className={styles.buttonContainer}>
            {onDeleteSession && (
              <button type="button" className={styles.restartButton} onClick={onDeleteSession}>
                <span className={styles.btnIcon} aria-hidden>
                  <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none">
                    <path
                      d="M3.2 8a4.8 4.8 0 0 1 8.2-3.3M12.8 8a4.8 4.8 0 0 1-8.2 3.3"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path d="M11.2 2.6v2.6H8.6M4.8 13.4v-2.6H7.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>{t('createGame.restart')}</span>
              </button>
            )}
            {!hideExitButton && (
              <button type="button" className={styles.exitButton} onClick={onExitGame}>
                <span className={styles.btnIcon} aria-hidden>
                  <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none">
                    <path
                      d="M6.2 3.2H4.1A1.3 1.3 0 0 0 2.8 4.5v7a1.3 1.3 0 0 0 1.3 1.3h2.1M7.2 8h6M10.8 5.4 13.4 8l-2.6 2.6"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{t('createGame.saveAndExit')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
