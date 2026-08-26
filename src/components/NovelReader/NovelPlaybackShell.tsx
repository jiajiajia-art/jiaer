/**
 * 视觉小说回放式阅读壳：严格对齐「回放」底栏交互
 * 底栏：进度 / 文本 / 自动 / 设置 / 退出（与经典回放一致）
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CiLocationOn } from 'react-icons/ci';
import { MdTimeline, MdTextSnippet, MdCampaign, MdSettings } from 'react-icons/md';
import { RiLogoutCircleRLine } from 'react-icons/ri';
import NormalModeDisplay from '../Galgame/NormalModeDisplay';
import TextModeDisplay from '../Galgame/TextModeDisplay';
import CharacterLayer from '../Galgame/CharacterLayer';
import GameBackgroundRenderer from '../Galgame/GameBackgroundRenderer';
import SettingsModal from '../Galgame/SettingsModal';
import type { DisplayMessage } from '../../lib/galgame/stepToDisplayMessage';
import styles from './NovelPlaybackShell.module.css';
import galgameStyles from '../../page/Galgame.module.css';

type NovelPlaybackShellProps = {
  backgroundImage: string;
  sceneName?: string;
  currentMessage: DisplayMessage | null;
  finalDisplayText: string;
  finalIsTyping: boolean;
  isAutoPlay: boolean;
  isTextMode: boolean;
  playbackIndex: number;
  stepsCount: number;
  playbackSpeed: number;
  playbackSpeedOptions: readonly number[];
  textModalSteps: unknown[];
  stepHandlers: {
    isWaitingForData: boolean;
    currentStep: unknown;
    showNextButton: boolean;
    selectedOptionIndex: number | null;
  };
  onNextMessage: () => void;
  onChoiceClick: () => void;
  onToggleAutoPlay: () => void;
  onToggleTextMode: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onExit: () => void;
};

const NovelPlaybackShell: React.FC<NovelPlaybackShellProps> = ({
  backgroundImage,
  sceneName,
  currentMessage,
  finalDisplayText,
  finalIsTyping,
  isAutoPlay,
  isTextMode,
  playbackIndex,
  stepsCount,
  playbackSpeed,
  playbackSpeedOptions,
  textModalSteps,
  stepHandlers,
  onNextMessage,
  onChoiceClick,
  onToggleAutoPlay,
  onToggleTextMode,
  onSeek,
  onSpeedChange,
  onExit,
}) => {
  const { t } = useTranslation();
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className={styles.root}>
      {!isTextMode ? (
        <GameBackgroundRenderer
          src={backgroundImage}
          className={styles.background}
          useCanvas
          transitionDuration={300}
        />
      ) : (
        <div className={styles.textModeBackdrop} />
      )}

      {!isTextMode && sceneName ? (
        <div className={styles.sceneHeader}>
          <CiLocationOn />
          <span>{sceneName}</span>
        </div>
      ) : null}

      {!isTextMode && currentMessage?.characterImage ? (
        <div className={styles.characterSlot}>
          <CharacterLayer
            characterImage={currentMessage.characterImage}
            characterPosition={currentMessage.characterPosition}
            portraitScale={currentMessage.portraitScale}
            portraitOffsetX={currentMessage.portraitOffsetX}
            portraitOffsetY={currentMessage.portraitOffsetY}
          />
        </div>
      ) : null}

      {/* 对话层 z-index 高于立绘，对齐 Galgame gameContentWrapper */}
      <div className={`${styles.content} ${isTextMode ? styles.contentTextMode : ''}`}>
        {!isTextMode ? (
          <div className={styles.dialogueWrap}>
            <NormalModeDisplay
              currentMessage={currentMessage as any}
              finalDisplayText={finalDisplayText}
              finalIsTyping={finalIsTyping}
              canRegenerateCurrentMessage={false}
              stepHandlers={stepHandlers as any}
              isAutoPlay={isAutoPlay}
              historyLength={0}
              onNextMessage={onNextMessage}
              onChoiceClick={() => onChoiceClick()}
              onCustomInputSubmit={() => undefined}
              isFreeRound={false}
            />
          </div>
        ) : (
          <div className={styles.textModeWrap}>
            <TextModeDisplay
              steps={textModalSteps as any}
              currentStepIndex={playbackIndex}
              currentDisplayText={finalDisplayText}
              isTyping={finalIsTyping}
              isWaitingForData={stepHandlers.isWaitingForData}
              historyLength={0}
              isFreeRound
              readOnly
              surface="dark"
            />
          </div>
        )}
      </div>

      {/* 进度面板：对齐 Galgame.replayControlBar */}
      {isProgressOpen ? (
        <div className={galgameStyles.replayControlBar}>
          <div className={galgameStyles.replayProgressHeader}>
            <span>{t('galgame.progress')}</span>
            <span>
              {stepsCount > 0 ? `${playbackIndex + 1}/${stepsCount}` : '0/0'}
            </span>
          </div>
          <input
            className={galgameStyles.replayProgressRange}
            type="range"
            min={0}
            max={Math.max(stepsCount - 1, 0)}
            step={1}
            value={Math.min(playbackIndex, Math.max(stepsCount - 1, 0))}
            disabled={stepsCount <= 1}
            onChange={(event) => onSeek(Number(event.currentTarget.value))}
            aria-label={t('galgame.progress')}
          />
          <div className={galgameStyles.replaySpeedRow}>
            <span className={galgameStyles.replaySpeedLabel}>{t('galgame.autoPlaySpeed')}</span>
            <div className={galgameStyles.replaySpeedOptions}>
              {playbackSpeedOptions.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`${galgameStyles.replaySpeedButton} ${playbackSpeed === speed ? galgameStyles.replaySpeedButtonActive : ''}`}
                  onClick={() => onSpeedChange(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 经典回放底栏：进度 / 文本 / 自动 / 设置 / 退出 */}
      <div className={`${galgameStyles.buttonContainer} ${styles.novelButtonBar}`}>
        <div
          className={`${galgameStyles.buttonItem} ${isProgressOpen ? galgameStyles.buttonItemActive : ''}`}
          onClick={() => {
            setIsSettingsOpen(false);
            setIsProgressOpen((prev) => !prev);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className={galgameStyles.buttonInner}>
            <MdTimeline />
            <span>{t('galgame.progress')}</span>
          </div>
        </div>
        <div
          className={`${galgameStyles.buttonItem} ${isTextMode ? galgameStyles.buttonItemActive : ''}`}
          onClick={() => {
            setIsProgressOpen(false);
            onToggleTextMode();
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className={galgameStyles.buttonInner}>
            <MdTextSnippet />
            <span>{t('galgame.text')}</span>
          </div>
        </div>
        <div
          className={`${galgameStyles.buttonItem} ${isAutoPlay ? galgameStyles.buttonItemActive : ''}`}
          onClick={() => {
            if (isTextMode) return;
            onToggleAutoPlay();
          }}
          style={{ cursor: isTextMode ? 'not-allowed' : 'pointer', opacity: isTextMode ? 0.45 : 1 }}
        >
          <div className={galgameStyles.buttonInner}>
            <MdCampaign />
            <span>{t('galgame.auto')}</span>
          </div>
        </div>
        <div
          className={`${galgameStyles.buttonItem} ${isSettingsOpen ? galgameStyles.buttonItemActive : ''}`}
          onClick={() => {
            setIsProgressOpen(false);
            setIsSettingsOpen((prev) => !prev);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className={galgameStyles.buttonInner}>
            <MdSettings />
            <span>{t('galgame.settings')}</span>
          </div>
        </div>
        <div
          className={galgameStyles.buttonItem}
          onClick={onExit}
          style={{ cursor: 'pointer' }}
        >
          <div className={galgameStyles.buttonInner}>
            <RiLogoutCircleRLine />
            <span>{t('galgame.exit')}</span>
          </div>
        </div>
      </div>

      {/* 视觉小说只读：设置主钮「完成」仅关弹窗；真正退出用底栏「退出」 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hideExitButton
        isMusicPlaying={false}
        musicDisabled
        musicDisabledReason={t('galgame.musicUnavailable')}
        onToggleMusic={() => undefined}
        volume={0}
        onVolumeChange={() => undefined}
        points={null}
        isTextMode={isTextMode}
        onToggleTextMode={onToggleTextMode}
        isAutoPlay={isAutoPlay}
        autoPlayDisabled={isTextMode}
        onToggleAutoPlay={onToggleAutoPlay}
      />
    </div>
  );
};

export default NovelPlaybackShell;
