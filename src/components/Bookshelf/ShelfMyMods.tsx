/**
 * 功能注释：书架「我的 Mod」页签——本人创作的两类内容，顶部切换：
 * - 玩法：/api/components/mine?kind=gameplay（草稿 / 私有·审核中 / 已上架），编辑回对话工坊
 * - 手机应用：/api/auth/platform-apps/mine（草稿 / 已上架），编辑跳 /create/app?edit=appId 直接进入该应用的编辑状态
 * 两类都只读本人数据，与各自创作页同一份接口。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import shelf from './Bookshelf.module.css';
import styles from './ShelfMyMods.module.css';
import { playModStoreApi } from '../../api/playMod/playModApi';
import { platformAppsApi, type PlatformApp } from '../../api/platform/platformAppsApi';
import { getImageUrl } from '../../utils/constants';
import toast from 'react-hot-toast';
import { PLAY_MOD_CREATE_LOCKED, PLAY_MOD_CREATE_LOCKED_HINT } from '../../../Romance/src/lib/playModCreate';
import {
  KIND_STORAGE_KEY,
  PHONE_APP_CREATE_PATH,
  PLAY_MOD_CREATE_PATH,
  phoneAppEditPath,
  playModEditPath,
  type ShelfModKind,
} from '../../lib/shelfMyMods';
import {
  canSubmitPlayMod,
  canWithdrawPlayMod,
  groupKeyOfPlayModStatus,
  groupMyPlayMods,
  type MyPlayModGroupKey,
  type MyPlayModItem,
} from '../../lib/myPlayMods';

type TFn = (key: string, opts?: Record<string, unknown>) => string;


/** 功能注释：两类内容统一成同一种列表行 */
type Row = {
  id: string;
  name: string;
  desc: string;
  group: string;
  /** 功能注释：原始 status，玩法提审/撤回用 */
  rawStatus: string;
  statusLabel: string;
  meta: string;
  icon?: string;
  updatedAt: string;
  editPath: string;
};

function formatUpdated(v: string | undefined, t: TFn): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${sameYear ? '' : `${d.getFullYear()}.`}${d.getMonth() + 1}.${d.getDate()} ${t('bookshelfUi.myMods.updatedSuffix')}`;
}

function playModStatusLabel(status: string, t: TFn): string {
  return t(`bookshelfUi.myMods.playModStatus.${status}`, { defaultValue: status });
}

function playModGroupLabel(group: MyPlayModGroupKey, t: TFn): string {
  return t(`bookshelfUi.myMods.playModGroup.${group}`);
}

function playRows(items: MyPlayModItem[], t: TFn): Row[] {
  const g = groupMyPlayMods(items);
  return [...g.draft, ...g.private, ...g.published].map((m) => ({
    id: m.id,
    name: m.name || m.slug || m.id,
    desc: m.description || t('bookshelfUi.myMods.noDescription'),
    group: groupKeyOfPlayModStatus(m.status),
    rawStatus: String(m.status || ''),
    statusLabel: playModStatusLabel(m.status, t),
    meta: [m.version ? `v${m.version}` : '', formatUpdated(m.updatedAt, t)].filter(Boolean).join(' · '),
    updatedAt: String(m.updatedAt || ''),
    editPath: playModEditPath(m.id),
  }));
}

function appRows(items: PlatformApp[], t: TFn): Row[] {
  return items.filter((a) => a && a.appId).map((a) => {
    const published = a.status === 'published';
    return {
      id: a.appId,
      name: a.name || a.appId,
      desc: a.summary || t('bookshelfUi.myMods.noDescription'),
      group: published ? 'published' : 'draft',
      rawStatus: String(a.status || ''),
      statusLabel: published ? t('bookshelfUi.myMods.filterPublished') : t('bookshelfUi.myMods.filterDraft'),
      meta: [a.category, formatUpdated(a.updatedAt || a.createdAt, t)].filter(Boolean).join(' · '),
      icon: a.icon || undefined,
      updatedAt: String(a.updatedAt || a.createdAt || ''),
      editPath: phoneAppEditPath(a.appId),
    };
  });
}

interface Props {
  token: string;
  /** 功能注释：书架顶部搜索词，按名称 / 说明本地过滤 */
  keyword: string;
  kind: ShelfModKind;
  onKindChange: (k: ShelfModKind) => void;
  /** 功能注释：跳转前让书架记住当前页签与滚动位置 */
  onBeforeLeave?: () => void;
}

const ShelfMyMods: React.FC<Props> = ({ token, keyword, kind, onKindChange, onBeforeLeave }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [filter, setFilter] = useState('all');
  const [reloadSeq, setReloadSeq] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    setStatus('loading');
    setFilter('all');
    const run = async () => {
      try {
        if (kind === 'play') {
          const res = await playModStoreApi.listMine(token, 'gameplay');
          if (!res?.success) throw new Error(res?.message || 'load failed');
          if (!aborted) setRows(playRows(Array.isArray(res.data?.items) ? res.data.items : [], t));
        } else {
          const res = await platformAppsApi.listMine(token);
          if (!res?.success) throw new Error(res?.message || 'load failed');
          if (!aborted) setRows(appRows(Array.isArray(res.data) ? res.data : [], t));
        }
        if (!aborted) setStatus('ready');
      } catch (error) {
        if (aborted) return;
        console.error('[ShelfMyMods] load failed:', error);
        setStatus('error');
      }
    };
    void run();
    return () => { aborted = true; };
  }, [token, kind, reloadSeq, t]);

  const kindLabel = useMemo<Record<ShelfModKind, string>>(() => ({
    play: t('bookshelfUi.myMods.kindPlay'),
    app: t('bookshelfUi.myMods.kindApp'),
  }), [t]);

  const filters = useMemo(() => {
    if (kind === 'play') {
      return [
        { key: 'all', label: t('bookshelfUi.myMods.filterAll') },
        { key: 'draft', label: playModGroupLabel('draft', t) },
        { key: 'private', label: playModGroupLabel('private', t) },
        { key: 'published', label: playModGroupLabel('published', t) },
      ];
    }
    return [
      { key: 'all', label: t('bookshelfUi.myMods.filterAll') },
      { key: 'draft', label: t('bookshelfUi.myMods.filterDraft') },
      { key: 'published', label: t('bookshelfUi.myMods.filterPublished') },
    ];
  }, [kind, t]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [rows]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sorted.length };
    for (const r of sorted) c[r.group] = (c[r.group] ?? 0) + 1;
    return c;
  }, [sorted]);
  const q = keyword.trim().toLowerCase();
  const shown = sorted.filter((r) => (filter === 'all' || r.group === filter)
    && (!q || `${r.name} ${r.desc}`.toLowerCase().includes(q)));
  const filterLabel = filters.find((f) => f.key === filter)?.label ?? '';
  const noun = kind === 'play' ? t('bookshelfUi.myMods.playModNoun') : t('bookshelfUi.myMods.appNoun');

  const go = (path: string) => {
    if (kind === 'play' && PLAY_MOD_CREATE_LOCKED && path.includes('createPlayMod')) {
      toast(PLAY_MOD_CREATE_LOCKED_HINT);
      return;
    }
    onBeforeLeave?.();
    navigate(path);
  };

  /** 功能注释：玩法包提审 / 撤回走真实 kkmod API，成功后刷新本人列表 */
  const runPlayModReview = async (row: Row, action: 'submit' | 'withdraw') => {
    if (kind !== 'play') return;
    setActionId(row.id);
    try {
      const res = action === 'submit'
        ? await playModStoreApi.submitKkmod(token, row.id)
        : await playModStoreApi.withdrawKkmod(token, row.id);
      if (!res?.success) throw new Error(res?.message || res?.data?.message || (action === 'submit' ? '提审失败' : '撤回失败'));
      toast.success(
        res.data?.message
          || (action === 'submit'
            ? t('bookshelfUi.myMods.submitOk')
            : t('bookshelfUi.myMods.withdrawOk')),
      );
      setReloadSeq((n) => n + 1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (action === 'submit' ? t('bookshelfUi.myMods.submitFail') : t('bookshelfUi.myMods.withdrawFail')));
    } finally {
      setActionId(null);
    }
  };

  const kindSwitch = (
    <div className={styles.kindSwitch} role="tablist" aria-label={t('bookshelfUi.myMods.contentTypeAria')}>
      {(['play', 'app'] as ShelfModKind[]).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={kind === k}
          className={`${styles.kindBtn} ${kind === k ? styles.kindBtnOn : ''}`}
          onClick={() => {
            if (k === kind) return;
            try { sessionStorage.setItem(KIND_STORAGE_KEY, k); } catch { /* ignore */ }
            onKindChange(k);
          }}
        >
          {kindLabel[k]}
        </button>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (status === 'loading') {
    body = (
      <div className={styles.list} aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.skeleton} />)}
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className={shelf.stateBox}>
        <span>{t('bookshelfUi.myMods.loadFailed', { noun })}</span>
        <button type="button" className={shelf.stateButton} onClick={() => setReloadSeq((n) => n + 1)}>{t('bookshelfUi.myMods.retry')}</button>
      </div>
    );
  } else if (sorted.length === 0) {
    body = (
      <div className={shelf.stateBox}>
        <span>{t('bookshelfUi.myMods.emptyTitle', { noun })}</span>
        <span className={styles.stateHint}>
          {kind === 'play'
            ? t('bookshelfUi.myMods.emptyHintPlay')
            : t('bookshelfUi.myMods.emptyHintApp')}
        </span>
        <button type="button" className={shelf.stateButton} onClick={() => go(kind === 'play' ? PLAY_MOD_CREATE_PATH : PHONE_APP_CREATE_PATH)}>
          {kind === 'play' ? t('bookshelfUi.myMods.createPlayMod') : t('bookshelfUi.myMods.createApp')}
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <div className={styles.filters} role="radiogroup" aria-label={t('bookshelfUi.myMods.filterByStatusAria')}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}<span className={styles.chipCount}>{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className={shelf.stateBox}>
            <span>{q
              ? t('bookshelfUi.myMods.noSearchResults', { keyword: keyword.trim(), noun })
              : t('bookshelfUi.myMods.noFilterResults', { filterLabel, noun })}</span>
          </div>
        ) : (
          <ul className={styles.list}>
            {shown.map((r) => (
              <li key={r.id} className={styles.item}>
                {r.icon ? (
                  <img className={styles.markImg} src={getImageUrl(r.icon)} alt="" loading="lazy" />
                ) : (
                  <span className={`${styles.mark} ${r.group === 'published' ? styles.mark_published : ''}`} aria-hidden="true">{r.name.slice(0, 1)}</span>
                )}
                <div className={styles.body}>
                  <div className={styles.titleRow}>
                    <span className={styles.name}>{r.name}</span>
                    <span className={`${styles.badge} ${r.group === 'published' ? styles.badge_published : ''}`}>{r.statusLabel}</span>
                  </div>
                  <p className={styles.desc}>{r.desc}</p>
                  {r.meta && <p className={styles.meta}>{r.meta}</p>}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${shelf.primaryButton} ${styles.editBtn}`}
                    onClick={() => go(r.editPath)}
                    aria-label={t('bookshelfUi.myMods.editAria', { name: r.name })}
                  >
                    {t('bookshelfUi.myMods.edit')}
                  </button>
                  {kind === 'play' && canSubmitPlayMod(r.rawStatus) ? (
                    <button
                      type="button"
                      className={styles.reviewBtn}
                      disabled={actionId === r.id}
                      onClick={() => void runPlayModReview(r, 'submit')}
                    >
                      {actionId === r.id ? t('bookshelfUi.myMods.submitting') : t('bookshelfUi.myMods.submitReview')}
                    </button>
                  ) : null}
                  {kind === 'play' && canWithdrawPlayMod(r.rawStatus) ? (
                    <button
                      type="button"
                      className={styles.withdrawBtn}
                      disabled={actionId === r.id}
                      onClick={() => void runPlayModReview(r, 'withdraw')}
                    >
                      {actionId === r.id ? t('bookshelfUi.myMods.withdrawing') : t('bookshelfUi.myMods.withdrawReview')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.footNote}>
          {kind === 'play'
            ? t('bookshelfUi.myMods.footNotePlay')
            : t('bookshelfUi.myMods.footNoteApp')}
        </p>
      </>
    );
  }

  return (
    <div className={styles.wrap}>
      {kindSwitch}
      {body}
    </div>
  );
};

export default ShelfMyMods;
