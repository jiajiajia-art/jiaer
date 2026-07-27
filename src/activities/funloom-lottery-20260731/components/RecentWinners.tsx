import React from 'react';
import styles from './RecentWinners.module.css';
import { PRIZE_DISPLAY, type PrizeKey } from '../lib/lotteryClient';
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

/** 功能注释：活动页展示刚刚中奖用户（公开脱敏名 + 奖品 + 时间）。 */
const RecentWinners: React.FC<RecentWinnersProps> = ({ items }) => {
  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>刚刚中奖</h2>
      {items.length === 0 ? (
        <p className={styles.empty}>还没有人抽奖，来抢第一个吧</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const key = item.prizeKey as PrizeKey;
            const img = PRIZE_IMAGES[key];
            const label = item.prizeName || PRIZE_DISPLAY[key]?.label || item.prizeKey;
            return (
              <li key={item.id} className={styles.item}>
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
      )}
    </section>
  );
};

export default RecentWinners;
