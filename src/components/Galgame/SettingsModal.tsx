import React from 'react';
import styles from './SettingsModal.module.css';
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExitGame: () => void;
  onDeleteSession?: () => void;
  hideExitButton?: boolean;
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}

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
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const volumePercent = Math.round((volume ?? 0) * 100);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t('createGame.settings')}</h3>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              <div className={styles.rowTitle}>{t('createGame.music')}</div>
              <div className={styles.rowDesc}>{t('createGame.musicToggle')}</div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={isMusicPlaying}
                onChange={onToggleMusic}
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

          <div className={styles.buttonContainer}>
            {onDeleteSession && (
              <button
                className={styles.dangerButton}
                onClick={onDeleteSession}
              >
                <span>{t('createGame.restart')}</span>
              </button>
            )}
            {!hideExitButton && (
              <button className={styles.dangerButton} onClick={onExitGame}>
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
