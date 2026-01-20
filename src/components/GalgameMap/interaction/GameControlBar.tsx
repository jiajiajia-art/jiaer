import React from 'react';
import { BiHistory } from 'react-icons/bi';
import { LuFileText } from 'react-icons/lu';
import { MdOutlineAutoStories } from 'react-icons/md';
import { PiMusicNoteDuotone } from 'react-icons/pi';
import styles from './GameControlBar.module.css';

interface GameControlBarProps {
  // 积分显示
  userPoints?: number;
  
  // 历史按钮
  onHistoryClick: () => void;
  
  // 文本模式切换
  isTextMode: boolean;
  onTextModeToggle: () => void;
  
  // 自动播放切换
  isAutoPlay: boolean;
  onAutoPlayToggle: () => void;
  
  // 音乐控制
  isMusicPlaying: boolean;
  onMusicToggle: () => void;
}

const GameControlBar: React.FC<GameControlBarProps> = ({
  userPoints,
  onHistoryClick,
  isTextMode,
  onTextModeToggle,
  isAutoPlay,
  onAutoPlayToggle,
  isMusicPlaying,
  onMusicToggle,
}) => {
  return (
    <div className={styles.buttonContainer}>
      {/* 积分显示 */}
      {userPoints !== undefined && (
        <div className={styles.buttonItem}>
          <div className={styles.buttonInner}>
            <img
              src={`${import.meta.env.BASE_URL}data/assets/金币.png`}
              alt="积分"
            />
            <span>{userPoints}</span>
          </div>
        </div>
      )}

      {/* 历史按钮 */}
      <div
        className={styles.buttonItem}
        style={{ cursor: 'pointer' }}
        onClick={onHistoryClick}
      >
        <div className={styles.buttonInner}>
          <BiHistory />
          <span>历史</span>
        </div>
      </div>

      {/* 文本模式切换 */}
      <div
        className={`${styles.buttonItem} ${
          isTextMode ? styles.buttonItemActive : ''
        }`}
        onClick={onTextModeToggle}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.buttonInner}>
          <LuFileText />
          <span>文本</span>
        </div>
      </div>

      {/* 自动播放切换 */}
      <div
        className={`${styles.buttonItem} ${
          isAutoPlay ? styles.buttonItemActive : ''
        }`}
        onClick={onAutoPlayToggle}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.buttonInner}>
          <MdOutlineAutoStories />
          <span>自动</span>
        </div>
      </div>

      {/* 音乐控制 */}
      <div
        className={`${styles.buttonItem} ${
          isMusicPlaying ? styles.buttonItemActive : ''
        }`}
        style={{ cursor: 'pointer' }}
        onClick={onMusicToggle}
      >
        <div className={styles.buttonInner}>
          <PiMusicNoteDuotone />
          <span>音乐</span>
        </div>
      </div>
    </div>
  );
};

export default GameControlBar;

