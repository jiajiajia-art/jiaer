import React, { useEffect, useMemo, useState } from 'react';
import {
  PRIZE_DISPLAY,
  PRIZE_KEYS,
  type PrizeKey,
  resolveWheelTargetDegrees,
} from '../lib/lotteryClient';
import styles from './LotteryWheel.module.css';

import imgConsole from '../assets/prize-console.png';
import imgMini from '../assets/prize-mini-handheld.png';
import imgBadge from '../assets/prize-badge.png';
import imgPoke from '../assets/prize-poke-ball.png';
import imgPoints from '../assets/prize-points-300.png';

const PRIZE_IMAGES: Record<PrizeKey, string> = {
  console: imgConsole,
  mini_handheld: imgMini,
  badge: imgBadge,
  poke_ball: imgPoke,
  points_300: imgPoints,
};

interface LotteryWheelProps {
  spinning: boolean;
  targetPrizeKey: string | null;
  onSpinEnd?: () => void;
}

/**
 * 设计方向：Arcade Carnival（游园金边转盘）
 * DFII ≈ 4+5+5+5−1 = 18 → 执行
 * 布局：每奖品独占一条径向 spoke，落在扇区外环中线，正向居中且互不跨区。
 */
const LotteryWheel: React.FC<LotteryWheelProps> = ({ spinning, targetPrizeKey, onSpinEnd }) => {
  const [rotation, setRotation] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);

  const conic = useMemo(() => {
    // 功能注释：CSS conic 默认 0deg=正上方、顺时针；必须与 spoke / resolveWheelTargetDegrees 同一坐标系。
    const n = PRIZE_KEYS.length;
    const slice = 100 / n;
    const stops = PRIZE_KEYS.map((key, i) => {
      const color = PRIZE_DISPLAY[key].color;
      return `${color} ${i * slice}% ${(i + 1) * slice}%`;
    });
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }, []);

  useEffect(() => {
    if (!spinning || !targetPrizeKey) return;
    const target = resolveWheelTargetDegrees(targetPrizeKey, { spins: 5 });
    setTransitionOn(true);
    setRotation((prev) => {
      const base = prev % 360;
      return prev - base + target;
    });
    const timer = window.setTimeout(() => onSpinEnd?.(), 4200);
    return () => window.clearTimeout(timer);
  }, [spinning, targetPrizeKey, onSpinEnd]);

  const sector = 360 / PRIZE_KEYS.length;

  return (
    <div className={styles.stage}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.wrap}>
        <div
          className={styles.wheel}
          style={{
            background: conic,
            transform: `rotate(${rotation}deg)`,
            transition: transitionOn ? 'transform 4s cubic-bezier(0.12, 0.75, 0.18, 1)' : 'none',
          }}
        >
          {PRIZE_KEYS.map((key, index) => {
            const midAngle = index * sector + sector / 2;
            return (
              <div
                key={key}
                className={styles.spoke}
                style={{ ['--spoke-angle' as string]: `${midAngle}deg` }}
              >
                <div className={styles.prizeSlot}>
                  <div className={styles.prizeFace}>
                    <img
                      src={PRIZE_IMAGES[key]}
                      alt={PRIZE_DISPLAY[key].label}
                      className={styles.sectorImg}
                    />
                    <span className={styles.sectorName}>{PRIZE_DISPLAY[key].label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* 功能注释：中心圆压住箭头根部；箭头仍指向 12 点中奖扇区 */}
        <div className={styles.axis} aria-hidden>
          <div className={styles.hub}>
            <span className={styles.hubDot} />
          </div>
          <div className={styles.pointer} />
        </div>
      </div>
    </div>
  );
};

export default LotteryWheel;
export { PRIZE_IMAGES };
