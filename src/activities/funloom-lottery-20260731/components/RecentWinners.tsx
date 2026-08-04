import React, { useMemo } from 'react';
import styles from './RecentWinners.module.css';
import { PRIZE_DISPLAY, type PrizeKey } from '../lib/lotteryClient';
import { resolveRecentWinnersMarqueeSeconds } from '../lib/recentWinnersMarquee';
import { PRIZE_IMAGES } from './LotteryWheel';

export interface RecentWinnerItem {
  id: number;
  prizeKey: string;
  prizeName: string;
  displayName: string;
  createdAt: string;
}

interface RecentWinnersProps {
  items: RecentWinnerItem[];
  /** 抽奖旋转时暂停跑马灯，降低合成压力 */
  paused?: boolean;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export { resolveRecentWinnersMarqueeSeconds };

/** 功能注释：活动页「刚刚中奖」固定高度 + 自动向上轮播，避免撑长整页。 */
const RecentWinners: React.FC<RecentWinnersProps> = ({ items, paused = false }) => {
  const marqueeSeconds = useMemo(
    () => resolveRecentWinnersMarqueeSeconds(items.length),
    [items.length],
  );
  const autoScroll = marqueeSeconds != null && !paused;
  // 功能注释：复制一份列表做无缝循环（动画位移 50%）
  const renderItems = autoScroll ? [...items, ...items] : items;

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>刚刚中奖</h2>
      {items.length === 0 ? (
        <p className={styles.empty}>还没有人抽奖，来抢第一个吧</p>
      ) : (
        <div className={styles.viewport}>
          <ul
            className={autoScroll ? styles.marqueeTrack : styles.staticList}
            style={
              autoScroll
                ? ({ ['--marquee-seconds' as string]: `${marqueeSeconds}s` } as React.CSSProperties)
                : undefined
            }
          >
            {renderItems.map((item, index) => {
              const key = item.prizeKey as PrizeKey;
              const img = PRIZE_IMAGES[key];
              const label = item.prizeName || PRIZE_DISPLAY[key]?.label || item.prizeKey;
              return (
                <li key={`${item.id}-${index}`} className={styles.item}>
                  {img ? <img src={img} alt={label} className={styles.thumb} /> : null}
                  <div className={styles.text}>
                    <strong>{item.displayName}</strong>
                    <span>抽中了 {label}</span>
                  </div>
                  <time className={styles.time}>{formatTime(item.createdAt)}</time>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default RecentWinners;
