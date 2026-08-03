import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import lotteryApi from './api/lotteryApi';
import {
  evaluateClientDrawGate,
  LOTTERY_SLUG,
  PRIZE_DISPLAY,
  PRIZE_KEYS,
  type LotteryCampaign,
  type LotteryDraw,
  type PrizeKey,
} from './lib/lotteryClient';
import LotteryWheel, { PRIZE_IMAGES } from './components/LotteryWheel';
import WinModal from './components/WinModal';
import ShippingFormModal from './components/ShippingFormModal';
import PrizePreviewModal from './components/PrizePreviewModal';
import RecentWinners, { type RecentWinnerItem } from './components/RecentWinners';
import styles from './FunloomLottery.module.css';
import heroBanner from './assets/hero-banner.jpg';

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
}

/** 功能注释：活动页视觉对齐主 KV（蓝紫霓虹）；抽奖逻辑不变。 */
const FunloomLotteryPage: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.user?.token);
  const isLoggedIn = Boolean(token);

  const [campaign, setCampaign] = useState<LotteryCampaign | null>(null);
  const [myTodayDraw, setMyTodayDraw] = useState<LotteryDraw | null>(null);
  const [myDraw, setMyDraw] = useState<LotteryDraw | null>(null);
  const [canDraw, setCanDraw] = useState(false);
  const [recentWinners, setRecentWinners] = useState<RecentWinnerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawing, setDrawing] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [targetPrizeKey, setTargetPrizeKey] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{
    draw: LotteryDraw;
    prizeKey: string;
    prizeName: string;
    fulfillment: string;
    pointsAmount: number;
  } | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [shippingSubmitting, setShippingSubmitting] = useState(false);
  const [previewPrizeKey, setPreviewPrizeKey] = useState<PrizeKey | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const res = await lotteryApi.listRecent(LOTTERY_SLUG, 20);
      setRecentWinners(res.data?.data?.items || []);
    } catch {
      // 动态列表失败不阻断主流程
    }
  }, []);

  const loadCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lotteryApi.getCampaign(LOTTERY_SLUG);
      const data = res.data?.data;
      if (!data?.campaign) {
        toast.error('活动加载失败');
        return;
      }
      setCampaign(data.campaign);
      setMyTodayDraw(data.myTodayDraw || null);
      setMyDraw(data.myDraw || data.myTodayDraw || null);
      setCanDraw(Boolean(data.canDraw));
    } catch (error) {
      toast.error(getErrorMessage(error, '活动加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaign();
    void loadRecent();
  }, [loadCampaign, loadRecent, isLoggedIn]);

  const handleDraw = async () => {
    const gate = evaluateClientDrawGate({
      isLoggedIn,
      campaign,
      canDrawFromServer: canDraw,
      myTodayDraw,
      myDraw,
    });
    if (!gate.ok) {
      if (gate.code === 'login_required') {
        toast.error(gate.message);
        navigate('/home', { state: { from: { pathname: `/activity/${LOTTERY_SLUG}` } } });
        return;
      }
      toast.error(gate.message);
      return;
    }
    if (drawing || spinning) return;

    setDrawing(true);
    try {
      const res = await lotteryApi.draw(LOTTERY_SLUG);
      const data = res.data?.data;
      if (!data?.prize || !data?.draw) {
        toast.error('抽奖失败，请稍后重试');
        return;
      }
      setPendingResult({
        draw: data.draw,
        prizeKey: data.prize.prizeKey,
        prizeName: data.prize.name,
        fulfillment: data.prize.fulfillment,
        pointsAmount: data.prize.pointsAmount,
      });
      setTargetPrizeKey(data.prize.prizeKey);
      setSpinning(true);
      setMyTodayDraw(data.draw);
      setMyDraw(data.draw);
      setCanDraw(false);
    } catch (error) {
      toast.error(getErrorMessage(error, '抽奖失败'));
    } finally {
      setDrawing(false);
    }
  };

  const handleSpinEnd = useCallback(() => {
    setSpinning(false);
    setShowWin(true);
    void loadRecent();
  }, [loadRecent]);

  const handleShippingSubmit = async (form: {
    recipientName: string;
    phone: string;
    address: string;
  }) => {
    if (!pendingResult?.draw?.id) return;
    setShippingSubmitting(true);
    try {
      await lotteryApi.saveShipping(pendingResult.draw.id, form);
      toast.success('收货信息已保存');
      setShowShipping(false);
    } catch (error) {
      toast.error(getErrorMessage(error, '保存失败'));
    } finally {
      setShippingSubmitting(false);
    }
  };

  const handleRetryPoints = async () => {
    if (!pendingResult?.draw?.id) return;
    try {
      const res = await lotteryApi.retryPoints(pendingResult.draw.id);
      const draw = res.data?.data;
      if (draw) {
        setPendingResult((prev) => (prev ? { ...prev, draw } : prev));
        toast.success('积分已发放');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, '积分发放失败'));
    }
  };

  const alreadyDrawn =
    campaign?.drawLimitType === 'once_per_activity' ? Boolean(myDraw) : Boolean(myTodayDraw);
  const drawLabel = drawing || spinning ? '抽奖中…' : alreadyDrawn ? '已抽过奖' : '开始抽奖';
  const statusHint = !isLoggedIn
    ? '点击后需登录才能抽奖'
    : alreadyDrawn
      ? campaign?.drawLimitType === 'once_per_activity'
        ? '本活动期间每账号限抽 1 次，你已抽过'
        : '你今天已经抽过啦，明天再来'
      : !canDraw
        ? '当前暂不可抽（活动未开放或已抽过）'
        : '点击下方金色按钮开始抽奖';

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          返回
        </button>
      </div>

      <header className={styles.header}>
        <h1 className={styles.srOnly}>Funloom 惊喜一抽！100%中奖</h1>
        <img
          className={styles.heroBanner}
          src={heroBanner}
          alt="Funloom 惊喜一抽！100%中奖"
        />
        <p className={styles.meta}>活动时间 7.31 – 8.03 · 每账号活动期间限抽 1 次（本次抽奖仅面向Chinajoy活动）</p>
      </header>

      {loading ? (
        <p className={styles.loading}>加载中…</p>
      ) : (
        <>
          <div className={styles.wheelBlock}>
            <LotteryWheel
              spinning={spinning}
              targetPrizeKey={targetPrizeKey}
              onSpinEnd={handleSpinEnd}
            />
          </div>

          <p className={styles.statusHint}>{statusHint}</p>

          <button
            type="button"
            className={styles.drawBtn}
            onClick={handleDraw}
            disabled={drawing || spinning || alreadyDrawn}
          >
            {drawLabel}
          </button>

          <section className={styles.prizeList}>
            <h2 className={styles.sectionTitle}>奖池一览</h2>
            <ul className={styles.prizeGrid}>
              {PRIZE_KEYS.map((key) => {
                const meta = PRIZE_DISPLAY[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={styles.prizeCard}
                      onClick={() => setPreviewPrizeKey(key)}
                      aria-label={`预览奖品：${meta.label}`}
                    >
                      <img src={PRIZE_IMAGES[key]} alt="" />
                      <strong>{meta.label}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <RecentWinners items={recentWinners} />
        </>
      )}

      <WinModal
        open={showWin && Boolean(pendingResult)}
        prizeKey={pendingResult?.prizeKey || 'points_300'}
        prizeName={pendingResult?.prizeName || ''}
        fulfillment={pendingResult?.fulfillment || 'points'}
        pointsAmount={pendingResult?.pointsAmount || 0}
        onsiteHint={campaign?.onsiteClaimHint}
        pointsGrantStatus={pendingResult?.draw.pointsGrantStatus}
        onClose={() => setShowWin(false)}
        onFillShipping={() => {
          setShowWin(false);
          setShowShipping(true);
        }}
        onRetryPoints={handleRetryPoints}
      />

      <ShippingFormModal
        open={showShipping}
        submitting={shippingSubmitting}
        onClose={() => setShowShipping(false)}
        onSubmit={handleShippingSubmit}
      />

      <PrizePreviewModal
        open={Boolean(previewPrizeKey)}
        prizeKey={previewPrizeKey}
        onsiteHint={campaign?.onsiteClaimHint}
        onClose={() => setPreviewPrizeKey(null)}
      />
    </div>
  );
};

export default FunloomLotteryPage;
