/**
 * 功能注释：C2.3 创作游戏 →「我的玩法 Mod」：本人草稿 / 私有测试 / 已上架列表，
 * 可回对话工坊继续编辑，也可上传本地 .kkmod；私有测试可提审，审核中可撤回。
 * 只调用 /api/components/mine（本人），不出现运营/管理员列表。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppPageShell from '../components/Layout/AppPageShell';
import { useAuthStore } from '../store/useAuthStore';
import { playModStoreApi } from '../api/playMod/playModApi';
import {
  MY_PLAY_MOD_GROUP_LABEL,
  MY_PLAY_MOD_STATUS_LABEL,
  canSubmitPlayMod,
  canWithdrawPlayMod,
  groupMyPlayMods,
  parseKkmodFileText,
  type MyPlayModGroupKey,
  type MyPlayModItem,
} from '../lib/myPlayMods';
import styles from './CreatePlatformApp.module.css';

const GROUP_ORDER: MyPlayModGroupKey[] = ['draft', 'private', 'published'];

const MyPlayMods: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.user?.token);
  const [items, setItems] = useState<MyPlayModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** 功能注释：进页只拉一次本人列表；上传/提审成功后手动刷新同一接口 */
  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await playModStoreApi.listMine(token, 'gameplay');
      if (!res?.success) throw new Error(res?.message || '加载失败');
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载我的玩法失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 功能注释：选 .kkmod 文件 → 本地校验 JSON/manifest → 上传为私有测试草稿 */
  const onPickPackage = async (file: File | undefined) => {
    if (!file) return;
    if (!token) {
      toast.error('请先登录');
      navigate('/profile');
      return;
    }
    const parsed = parseKkmodFileText(await file.text(), file.name);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    setUploadBusy(true);
    try {
      const res = await playModStoreApi.uploadKkmod(token, {
        filename: parsed.filename,
        package: parsed.pkg,
        engineVersion: '1.0.0',
      });
      if (!res.success) throw new Error(res.message || res.data?.message || '上传失败');
      toast.success(res.data?.message || '已上传玩法包（私有测试）。可点「提交审核」上架。');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submitReview = async (mod: MyPlayModItem) => {
    if (!token || !canSubmitPlayMod(mod.status)) return;
    setActionId(mod.id);
    try {
      const res = await playModStoreApi.submitKkmod(token, mod.id);
      if (!res?.success) throw new Error(res?.message || res?.data?.message || '提审失败');
      toast.success(res.data?.message || '已提交审核');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '提审失败');
    } finally {
      setActionId(null);
    }
  };

  const withdrawReview = async (mod: MyPlayModItem) => {
    if (!token || !canWithdrawPlayMod(mod.status)) return;
    setActionId(mod.id);
    try {
      const res = await playModStoreApi.withdrawKkmod(token, mod.id);
      if (!res?.success) throw new Error(res?.message || res?.data?.message || '撤回失败');
      toast.success(res.data?.message || '已撤回审核，回到私有测试');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '撤回失败');
    } finally {
      setActionId(null);
    }
  };

  const grouped = groupMyPlayMods(items);
  const total = GROUP_ORDER.reduce((n, k) => n + grouped[k].length, 0);

  return (
    <AppPageShell hideBottomNav shellClassName={styles.pageRoot} mainClassName={styles.main}>
      <h1 className={styles.title}>我的玩法 Mod</h1>
      <p className={styles.hint}>
        这里只显示你自己创作的玩法包：草稿、私有测试、审核中、已上架。对话创作会扣织梦豆；上传与提审不扣豆。
      </p>

      <section className={styles.card} data-my-play-mods-actions="1">
        <div className={styles.row}>
          <button type="button" className={styles.btnPrimary} onClick={() => navigate('/romance/?createPlayMod=1')}>
            新建玩法（对话生成）
          </button>
          <label className={styles.btnGhost}>
            {uploadBusy ? '上传中…' : '上传玩法包 .kkmod'}
            <input
              ref={fileRef}
              type="file"
              accept=".kkmod,.json,application/json"
              hidden
              disabled={uploadBusy}
              onChange={(e) => void onPickPackage(e.target.files?.[0])}
            />
          </label>
        </div>
      </section>

      {loading ? <p className={styles.empty}>加载中…</p> : null}
      {!loading && total === 0 ? (
        <p className={styles.empty}>还没有玩法 Mod，先对话生成或上传一个玩法包</p>
      ) : null}

      {GROUP_ORDER.map((key) =>
        grouped[key].length ? (
          <section key={key} className={styles.card} data-my-play-mods-group={key}>
            <h2 className={styles.cardTitle}>
              {MY_PLAY_MOD_GROUP_LABEL[key]}（{grouped[key].length}）
            </h2>
            {grouped[key].map((mod) => (
              <div key={mod.id} className={styles.listItem}>
                <div className={styles.meta}>
                  <p className={styles.metaName}>{mod.name || mod.slug || mod.id}</p>
                  <p className={styles.metaSub}>
                    {mod.description || '暂无说明'}
                    {mod.version ? ` · v${mod.version}` : ''}
                  </p>
                </div>
                <span className={mod.status === 'listed' ? styles.badgeOn : styles.badge}>
                  {MY_PLAY_MOD_STATUS_LABEL[mod.status] || mod.status}
                </span>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => navigate(`/romance/?createPlayMod=1&editComponent=${encodeURIComponent(mod.id)}`)}
                >
                  继续编辑
                </button>
                {canSubmitPlayMod(mod.status) ? (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={actionId === mod.id}
                    onClick={() => void submitReview(mod)}
                  >
                    {actionId === mod.id ? '提交中…' : '提交审核'}
                  </button>
                ) : null}
                {canWithdrawPlayMod(mod.status) ? (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={actionId === mod.id}
                    onClick={() => void withdrawReview(mod)}
                  >
                    {actionId === mod.id ? '撤回中…' : '撤回审核'}
                  </button>
                ) : null}
              </div>
            ))}
          </section>
        ) : null,
      )}
    </AppPageShell>
  );
};

export default MyPlayMods;
