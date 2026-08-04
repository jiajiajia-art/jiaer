import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRIZE_DISPLAY,
  PRIZE_KEYS,
  type PrizeKey,
  readCssRotationDegrees,
  resolveLandingRotationFromCurrent,
  WHEEL_LANDING_MS,
} from '../lib/lotteryClient';
import styles from './LotteryWheel.module.css';

import imgConsole from '../assets/prize-console.jpg';
import imgMini from '../assets/prize-mini-handheld.jpg';
import imgBadge from '../assets/prize-badge.jpg';
import imgPoke from '../assets/prize-poke-ball.jpg';
import imgPoints from '../assets/prize-points-300.jpg';

const PRIZE_IMAGES: Record<PrizeKey, string> = {
  console: imgConsole,
  mini_handheld: imgMini,
  badge: imgBadge,
  poke_ball: imgPoke,
  points_300: imgPoints,
};

interface LotteryWheelProps {
  /** 是否处于抽奖流程（含等接口 / 减速落地） */
  spinning: boolean;
  /** 有值后从当前角减速落到该奖；null 表示等接口时的匀速转 */
  targetPrizeKey: string | null;
  onSpinEnd?: () => void;
}

/**
 * 设计方向：Arcade Carnival（游园金边转盘）
 * 体验：点击后立即匀速转（掩盖 API 等待），结果返回后再减速落点。
 */
const LotteryWheel: React.FC<LotteryWheelProps> = ({ spinning, targetPrizeKey, onSpinEnd }) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);
  const [awaitingSpin, setAwaitingSpin] = useState(false);

  const conic = useMemo(() => {
    const n = PRIZE_KEYS.length;
    const slice = 100 / n;
    const stops = PRIZE_KEYS.map((key, i) => {
      const color = PRIZE_DISPLAY[key].color;
      return `${color} ${i * slice}% ${(i + 1) * slice}%`;
    });
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }, []);

  useEffect(() => {
    if (!spinning) {
      setAwaitingSpin(false);
      setTransitionOn(false);
      return;
    }

    // 阶段1：接口未回，匀速转，消除「点了没反应」
    if (!targetPrizeKey) {
      setTransitionOn(false);
      setAwaitingSpin(true);
      return;
    }

    // 阶段2：结果已到，从当前可视角减速落地
    setAwaitingSpin(false);
    const el = wheelRef.current;
    const computed = el ? getComputedStyle(el).transform : 'none';
    const currentDeg = readCssRotationDegrees(computed);
    const next = resolveLandingRotationFromCurrent(currentDeg, targetPrizeKey, { spins: 4 });

    setTransitionOn(false);
    setRotation(currentDeg);
    let landTimer = 0;
    let rafOuter = 0;
    let rafInner = 0;
    rafOuter = window.requestAnimationFrame(() => {
      rafInner = window.requestAnimationFrame(() => {
        setTransitionOn(true);
        setRotation(next);
        landTimer = window.setTimeout(() => onSpinEnd?.(), WHEEL_LANDING_MS);
      });
    });

    return () => {
      window.cancelAnimationFrame(rafOuter);
      window.cancelAnimationFrame(rafInner);
      if (landTimer) window.clearTimeout(landTimer);
    };
  }, [spinning, targetPrizeKey, onSpinEnd]);

  const sector = 360 / PRIZE_KEYS.length;

  return (
    <div className={`${styles.stage} ${spinning ? styles.stageSpinning : ''}`}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.wrap}>
        <div
          ref={wheelRef}
          className={`${styles.wheel} ${awaitingSpin ? styles.wheelAwaiting : ''}`}
          style={{
            background: conic,
            transform: awaitingSpin ? undefined : `rotate(${rotation}deg)`,
            transition: transitionOn
              ? `transform ${WHEEL_LANDING_MS}ms cubic-bezier(0.12, 0.75, 0.18, 1)`
              : 'none',
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
                      draggable={false}
                      decoding="async"
                    />
                    <span className={styles.sectorName}>{PRIZE_DISPLAY[key].label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
