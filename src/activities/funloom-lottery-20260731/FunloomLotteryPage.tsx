import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import lotteryApi from './api/lotteryApi';
import {
  evaluateClientDrawGate,
  LOTTERY_SLUG,
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prizeLabel = (key: PrizeKey) => t(`lottery.prizes.${key}.label`);
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
        toast.error(t('lottery.page.loadFailed'));
        return;
      }
      setCampaign(data.campaign);
      setMyTodayDraw(data.myTodayDraw || null);
      setMyDraw(data.myDraw || data.myTodayDraw || null);
      setCanDraw(Boolean(data.canDraw));
    } catch (error) {
      toast.error(getErrorMessage(error, t('lottery.page.loadFailed')));
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
        toast.error(t(`lottery.gate.${gate.code}`));
        navigate('/home', { state: { from: { pathname: `/activity/${LOTTERY_SLUG}` } } });
        return;
      }
      toast.error(t(`lottery.gate.${gate.code}`));
      return;
    }
    if (drawing || spinning) return;

    // 功能注释：先转盘再等接口，掩盖 draw TTFB，避免「点了没反应」
    setDrawing(true);
    setSpinning(true);
    setTargetPrizeKey(null);
    try {
      const res = await lotteryApi.draw(LOTTERY_SLUG);
      const data = res.data?.data;
      if (!data?.prize || !data?.draw) {
        setSpinning(false);
        setTargetPrizeKey(null);
        toast.error(t('lottery.page.drawFailedRetry'));
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
      setMyTodayDraw(data.draw);
      setMyDraw(data.draw);
      setCanDraw(false);
    } catch (error) {
      setSpinning(false);
      setTargetPrizeKey(null);
      toast.error(getErrorMessage(error, t('lottery.page.drawFailed')));
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
      toast.success(t('lottery.page.shippingSaved'));
      setShowShipping(false);
    } catch (error) {
      toast.error(getErrorMessage(error, t('lottery.page.saveFailed')));
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
        toast.success(t('lottery.page.pointsGranted'));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t('lottery.page.pointsGrantFailed')));
    }
  };

  const alreadyDrawn =
    campaign?.drawLimitType === 'once_per_activity' ? Boolean(myDraw) : Boolean(myTodayDraw);
  const drawLabel = drawing || spinning
    ? t('lottery.page.drawing')
    : alreadyDrawn
      ? t('lottery.page.alreadyDrawn')
      : t('lottery.page.startDraw');
  const statusHint = !isLoggedIn
    ? t('lottery.page.hintLogin')
    : alreadyDrawn
      ? campaign?.drawLimitType === 'once_per_activity'
        ? t('lottery.page.hintOncePerActivity')
        : t('lottery.page.hintOncePerDay')
      : !canDraw
        ? t('lottery.page.hintUnavailable')
        : t('lottery.page.hintReady');

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          {t('lottery.page.back')}
        </button>
      </div>

      <header className={styles.header}>
        <h1 className={styles.srOnly}>{t('lottery.page.heroTitle')}</h1>
        <img
          className={styles.heroBanner}
          src={heroBanner}
          alt={t('lottery.page.heroTitle')}
        />
        <p className={styles.meta}>{t('lottery.page.meta')}</p>
      </header>

      {loading ? (
        <p className={styles.loading}>{t('lottery.page.loading')}</p>
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
            <h2 className={styles.sectionTitle}>{t('lottery.page.prizePoolTitle')}</h2>
            <ul className={styles.prizeGrid}>
              {PRIZE_KEYS.map((key) => {
                const label = prizeLabel(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={styles.prizeCard}
                      onClick={() => setPreviewPrizeKey(key)}
                      aria-label={t('lottery.page.previewPrizeAria', { label })}
                    >
                      <img src={PRIZE_IMAGES[key]} alt="" />
                      <strong>{label}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <RecentWinners items={recentWinners} paused={spinning || drawing} />
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
