import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import lotteryApi from '../activities/funloom-lottery-20260731/api/lotteryApi';
import {
  ADMIN_DRAWS_PAGE_SIZE,
  formatAdminExportSuccessMessage,
  formatFirstPrizeOddsHint,
  fromShanghaiDatetimeLocal,
  resolveAdminDrawsOffset,
  resolveAdminDrawsTotalPages,
  toShanghaiDatetimeLocal,
} from '../activities/funloom-lottery-20260731/lib/lotteryAdminConfig';
import {
  LOTTERY_SLUG,
  PRIZE_DISPLAY,
  type LotteryCampaign,
  type PrizeKey,
} from '../activities/funloom-lottery-20260731/lib/lotteryClient';
import { HOST_ADDRESS } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import styles from './LotteryAdminManager.module.css';

interface AdminDrawRow {
  id: number;
  userId: string;
  nickname?: string;
  userCode?: string;
  phoneNumber?: string;
  prizeKey: string;
  prizeName?: string;
  drawDate: string;
  fulfillment: string;
  createdAt: string;
  shipping?: { recipientName: string; phone: string; address: string } | null;
}

interface AdminPrizeRow {
  prizeKey: string;
  name: string;
  weight: number;
  remaining: number;
}

function formatShanghaiTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** 功能注释：运营配置活动档期、一等奖概率，并分页查看抽奖名单与全量 CSV 导出。 */
const LotteryAdminManager: React.FC = () => {
  const token = useAuthStore((s) => s.user?.token);
  const [prizeKey, setPrizeKey] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminDrawRow[]>([]);
  const [campaign, setCampaign] = useState<LotteryCampaign | null>(null);
  const [prizes, setPrizes] = useState<AdminPrizeRow[]>([]);
  const [startsLocal, setStartsLocal] = useState('');
  const [endsLocal, setEndsLocal] = useState('');
  const [firstPrizeWeightInput, setFirstPrizeWeightInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totalPages = useMemo(
    () => resolveAdminDrawsTotalPages(total, ADMIN_DRAWS_PAGE_SIZE),
    [total],
  );

  const oddsHint = useMemo(() => {
    const raw = firstPrizeWeightInput.trim();
    if (raw === '') return formatFirstPrizeOddsHint(0);
    return formatFirstPrizeOddsHint(Number(raw));
  }, [firstPrizeWeightInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lotteryApi.adminListDraws({
        slug: LOTTERY_SLUG,
        prizeKey: prizeKey || undefined,
        limit: ADMIN_DRAWS_PAGE_SIZE,
        offset: resolveAdminDrawsOffset(page, ADMIN_DRAWS_PAGE_SIZE),
      });
      const data = res.data?.data;
      const nextCampaign = data?.campaign || null;
      const nextPrizes = (data?.prizes as AdminPrizeRow[]) || [];
      const nextTotal = Number(data?.total || 0);
      setCampaign(nextCampaign);
      setPrizes(nextPrizes);
      setItems((data?.items as AdminDrawRow[]) || []);
      setTotal(nextTotal);
      const maxPage = resolveAdminDrawsTotalPages(nextTotal, ADMIN_DRAWS_PAGE_SIZE);
      if (page > maxPage) {
        setPage(maxPage);
      }
      if (nextCampaign) {
        setStartsLocal(toShanghaiDatetimeLocal(nextCampaign.startsAt));
        setEndsLocal(toShanghaiDatetimeLocal(nextCampaign.endsAt));
      }
      const consolePrize = nextPrizes.find((p) => p.prizeKey === 'console');
      const configuredWeight =
        nextCampaign?.firstPrizeConfigured
          ? Number(nextCampaign.firstPrizeWeight ?? consolePrize?.weight ?? 0)
          : Number(consolePrize?.weight ?? 0);
      setFirstPrizeWeightInput(
        configuredWeight > 0 ? String(configuredWeight) : nextCampaign?.firstPrizeConfigured ? '0' : '',
      );
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [prizeKey, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePrizeFilterChange = (value: string) => {
    setPrizeKey(value);
    setPage(1);
  };

  const handleSaveConfig = async () => {
    const startsAt = fromShanghaiDatetimeLocal(startsLocal);
    const endsAt = fromShanghaiDatetimeLocal(endsLocal);
    if (!startsAt || !endsAt) {
      toast.error('请填写有效的开始/结束时间');
      return;
    }
    const raw = firstPrizeWeightInput.trim();
    const firstPrizeWeight = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(firstPrizeWeight) || firstPrizeWeight < 0) {
      toast.error('一等奖权重须为 ≥0 的数字；留空或 0 表示永远抽不中');
      return;
    }

    setSaving(true);
    try {
      const res = await lotteryApi.adminUpdateCampaign({
        slug: LOTTERY_SLUG,
        startsAt,
        endsAt,
        firstPrizeWeight,
      });
      const data = res.data?.data;
      if (data?.campaign) {
        setCampaign(data.campaign);
        setStartsLocal(toShanghaiDatetimeLocal(data.campaign.startsAt));
        setEndsLocal(toShanghaiDatetimeLocal(data.campaign.endsAt));
      }
      if (data?.prizes) {
        setPrizes(data.prizes as AdminPrizeRow[]);
      }
      toast.success(
        firstPrizeWeight > 0
          ? '活动配置已保存'
          : '已保存：一等奖权重为 0，永远抽不中',
      );
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const url = `${HOST_ADDRESS}${lotteryApi.adminExportShippingUrl(LOTTERY_SLUG, {
      prizeKey: prizeKey || undefined,
    })}`;
    void (async () => {
      setExporting(true);
      try {
        const resp = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) {
          toast.error('导出失败');
          return;
        }
        const exportTotalHeader = resp.headers.get('X-Export-Total');
        const exportRowsHeader = resp.headers.get('X-Export-Rows');
        const text = await resp.text();
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0);
        const rowsFromCsv = Math.max(0, lines.length - 1);
        const exportTotal =
          exportTotalHeader != null && Number.isFinite(Number(exportTotalHeader))
            ? Number(exportTotalHeader)
            : undefined;
        const exportRows =
          exportRowsHeader != null && Number.isFinite(Number(exportRowsHeader))
            ? Number(exportRowsHeader)
            : rowsFromCsv;

        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `lottery-draws-${LOTTERY_SLUG}.csv`;
        a.click();
        URL.revokeObjectURL(objectUrl);
        toast.success(formatAdminExportSuccessMessage(exportRows ?? rowsFromCsv, exportTotal));
      } catch {
        toast.error('导出失败');
      } finally {
        setExporting(false);
      }
    })();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2>Funloom 限定抽奖 · 活动配置与名单</h2>
        <p className={styles.linkHint}>活动链接：/funloom/activity/{LOTTERY_SLUG}</p>

        <div className={styles.configCard}>
          <h3>活动配置</h3>
          <div className={styles.configGrid}>
            <label>
              开始时间（上海）
              <input
                type="datetime-local"
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
              />
            </label>
            <label>
              结束时间（上海）
              <input
                type="datetime-local"
                value={endsLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
              />
            </label>
            <label>
              一等奖权重（游戏机）
              <input
                type="number"
                min={0}
                step={1}
                placeholder="留空或 0 = 永远抽不中；1 ≈ 1/3000"
                value={firstPrizeWeightInput}
                onChange={(e) => setFirstPrizeWeightInput(e.target.value)}
              />
            </label>
          </div>
          <p className={styles.configHint}>{oddsHint}</p>
          {campaign ? (
            <p className={styles.configHint}>
              当前档期：{formatShanghaiTime(campaign.startsAt)} ~ {formatShanghaiTime(campaign.endsAt)}
              {campaign.firstPrizeConfigured ? ' · 一等奖已配置' : ' · 一等奖尚未配置（永远抽不中）'}
            </p>
          ) : null}
          {prizes.length > 0 ? (
            <p className={styles.configHint}>
              当前权重：
              {prizes.map((p) => `${p.name}=${p.weight}`).join(' · ')}
            </p>
          ) : null}
          <div className={styles.row}>
            <button type="button" onClick={() => void handleSaveConfig()} disabled={saving || loading}>
              {saving ? '保存中…' : '保存活动配置'}
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <select value={prizeKey} onChange={(e) => handlePrizeFilterChange(e.target.value)}>
            <option value="">全部奖品</option>
            <option value="console">游戏机</option>
            <option value="mini_handheld">迷你掌机</option>
            <option value="badge">吧唧</option>
            <option value="poke_ball">精灵球</option>
            <option value="points_300">300积分</option>
          </select>
          <button type="button" onClick={() => void load()} disabled={loading}>
            刷新
          </button>
          <button type="button" onClick={handleExport} disabled={exporting || loading}>
            {exporting ? '导出中…' : '导出全部记录 CSV'}
          </button>
        </div>
        <div className={styles.pager}>
          <span className={styles.pagerMeta}>
            共 {total} 条 · 第 {page}/{totalPages} 页 · 每页 {ADMIN_DRAWS_PAGE_SIZE} 条
            {loading ? ' · 加载中…' : ''}
          </span>
          <div className={styles.pagerBtns}>
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>昵称</th>
              <th>Kuran号</th>
              <th>手机号</th>
              <th>奖品</th>
              <th>抽奖时间</th>
              <th>收货信息</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const prizeLabel =
                item.prizeName ||
                PRIZE_DISPLAY[item.prizeKey as PrizeKey]?.label ||
                item.prizeKey;
              return (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.nickname || '—'}</td>
                  <td>{item.userCode || '—'}</td>
                  <td>{item.phoneNumber || '—'}</td>
                  <td>{prizeLabel}</td>
                  <td>{formatShanghaiTime(item.createdAt)}</td>
                  <td>
                    {item.shipping
                      ? `${item.shipping.recipientName} / ${item.shipping.phone} / ${item.shipping.address}`
                      : item.fulfillment === 'shipping'
                        ? '待填写'
                        : '—'}
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={7}>暂无记录</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LotteryAdminManager;
