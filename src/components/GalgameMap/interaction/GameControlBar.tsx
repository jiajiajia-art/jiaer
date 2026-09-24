import React from 'react';
import { BiHistory } from 'react-icons/bi';
import { LuFileText } from 'react-icons/lu';
import { MdOutlineAutoStories, MdSettings, MdOutlinePerson } from 'react-icons/md';
import styles from './GameControlBar.module.css';
import { logWorldButtonClick } from "../../../api/statistics/scriptButtonEvent";
import { useAuthStore } from '../../../store/useAuthStore';

interface GameControlBarProps {
  // 积分显示
  userPoints?: number;
  
  // 历史按钮
  onHistoryClick?: () => void;
  showHistoryButton?: boolean;
  isHistoryActive?: boolean;

  // 玩家属性
  showPlayerButton?: boolean;
  isPlayerActive?: boolean;
  onPlayerClick?: () => void;
  
  // 文本模式切换
  isTextMode?: boolean;
  onTextModeToggle?: () => void;
  showTextModeButton?: boolean;
  
  // 自动播放切换
  isAutoPlay?: boolean;
  onAutoPlayToggle?: () => void;
  showAutoPlayButton?: boolean;
  disableAutoPlay?: boolean;
  
  // 设置
  isSettingsOpen: boolean;
  onSettingsToggle: () => void;
}

const GameControlBar: React.FC<GameControlBarProps> = ({
  userPoints,
  onHistoryClick,
  showHistoryButton = true,
  isHistoryActive = false,
  showPlayerButton = false,
  isPlayerActive = false,
  onPlayerClick,
  isTextMode = false,
  onTextModeToggle,
  showTextModeButton = false,
  isAutoPlay = false,
  onAutoPlayToggle,
  showAutoPlayButton = false,
  disableAutoPlay = false,
  isSettingsOpen,
  onSettingsToggle,
}) => {
  const autoPlayDisabled = disableAutoPlay || isTextMode;
  const account = useAuthStore((state) => state.user?.user);
  const creatorTest = new URLSearchParams(window.location.search).get('testMode') === 'creator';
  const displayedBalance = creatorTest ? userPoints : account?.diamonds;
  const currencyName = creatorTest ? '织梦豆' : 'KK币';

  return (
    <div className={styles.buttonContainer}>
      {/* 积分显示 */}
      {displayedBalance !== undefined && (
        <div className={styles.buttonItem}>
          <div className={styles.buttonInner}>
            <img
              src={`${import.meta.env.BASE_URL}data/assets/金币.png`}
              alt={currencyName}
            />
            <span>{displayedBalance}</span>
          </div>
        </div>
      )}

      {/* 玩家属性按钮（外层用） */}
      {showPlayerButton && onPlayerClick && (
        <div
          className={`${styles.buttonItem} ${
            isPlayerActive ? styles.buttonItemActive : ''
          }`}
          style={{ cursor: 'pointer' }}
          onClick={onPlayerClick}
        >
          <div className={styles.buttonInner}>
            <MdOutlinePerson />
            <span>玩家</span>
          </div>
        </div>
      )}

      {/* 历史按钮 */}
      {showHistoryButton && onHistoryClick && (
        <div
          className={`${styles.buttonItem} ${
            isHistoryActive ? styles.buttonItemActive : ''
          }`}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            logWorldButtonClick("history");
            onHistoryClick();
          }}
        >
          <div className={styles.buttonInner}>
            <BiHistory />
            <span>历史</span>
          </div>
        </div>
      )}

      {/* 文本模式切换 */}
      {showTextModeButton && onTextModeToggle && (
        <div
          className={`${styles.buttonItem} ${
            isTextMode ? styles.buttonItemActive : ''
          }`}
          onClick={() => {
            logWorldButtonClick("text");
            onTextModeToggle();
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.buttonInner}>
            <LuFileText />
            <span>文本</span>
          </div>
        </div>
      )}

      {/* 自动播放切换 */}
      {showAutoPlayButton && onAutoPlayToggle && (
        <div
          className={`${styles.buttonItem} ${
            isAutoPlay ? styles.buttonItemActive : ''
          } ${autoPlayDisabled ? styles.buttonItemDisabled : ''}`}
          onClick={
            autoPlayDisabled
              ? undefined
              : () => {
                  logWorldButtonClick("auto");
                  onAutoPlayToggle();
                }
          }
          style={{ cursor: autoPlayDisabled ? 'not-allowed' : 'pointer' }}
        >
          <div className={styles.buttonInner}>
            <MdOutlineAutoStories />
            <span>自动</span>
          </div>
        </div>
      )}
      
      <div
        className={`${styles.buttonItem} ${
          isSettingsOpen ? styles.buttonItemActive : ''
        }`}
        style={{ cursor: 'pointer' }}
        onClick={onSettingsToggle}
      >
        <div className={styles.buttonInner}>
          <MdSettings />
          <span>设置</span>
        </div>
      </div>

      
    </div>
  );
};

export default GameControlBar;

