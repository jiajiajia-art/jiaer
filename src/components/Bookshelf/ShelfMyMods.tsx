/**
 * 功能注释：书架「我的 Mod」页签——本人创作的两类内容，顶部切换：
 * - 玩法：/api/components/mine?kind=gameplay（草稿 / 私有·审核中 / 已上架），编辑回对话工坊
 * - 手机应用：/api/auth/platform-apps/mine（草稿 / 已上架），编辑跳 /create/app?edit=appId 直接进入该应用的编辑状态
 * 两类都只读本人数据，与各自创作页同一份接口。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import shelf from './Bookshelf.module.css';
import styles from './ShelfMyMods.module.css';
import { playModStoreApi } from '../../api/playMod/playModApi';
import { platformAppsApi, type PlatformApp } from '../../api/platform/platformAppsApi';
import { getImageUrl } from '../../utils/constants';
import {
  KIND_STORAGE_KEY,
  PHONE_APP_CREATE_PATH,
  PLAY_MOD_CREATE_PATH,
  phoneAppEditPath,
  playModEditPath,
  type ShelfModKind,
} from '../../lib/shelfMyMods';
import {
  MY_PLAY_MOD_GROUP_LABEL,
  MY_PLAY_MOD_STATUS_LABEL,
  groupKeyOfPlayModStatus,
  groupMyPlayMods,
  type MyPlayModItem,
} from '../../lib/myPlayMods';

const KIND_LABEL: Record<ShelfModKind, string> = { play: '玩法', app: '手机应用' };


/** 功能注释：两类内容统一成同一种列表行 */
type Row = {
  id: string;
  name: string;
  desc: string;
  group: string;
  statusLabel: string;
  meta: string;
  icon?: string;
  updatedAt: string;
  editPath: string;
};

const FILTERS: Record<ShelfModKind, { key: string; label: string }[]> = {
  play: [
    { key: 'all', label: '全部' },
    { key: 'draft', label: MY_PLAY_MOD_GROUP_LABEL.draft },
    { key: 'private', label: MY_PLAY_MOD_GROUP_LABEL.private },
    { key: 'published', label: MY_PLAY_MOD_GROUP_LABEL.published },
  ],
  app: [
    { key: 'all', label: '全部' },
    { key: 'draft', label: '草稿' },
    { key: 'published', label: '已上架' },
  ],
};

function formatUpdated(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${sameYear ? '' : `${d.getFullYear()}.`}${d.getMonth() + 1}.${d.getDate()} 更新`;
}

function playRows(items: MyPlayModItem[]): Row[] {
  const g = groupMyPlayMods(items);
  return [...g.draft, ...g.private, ...g.published].map((m) => ({
    id: m.id,
    name: m.name || m.slug || m.id,
    desc: m.description || '暂无说明',
    group: groupKeyOfPlayModStatus(m.status),
    statusLabel: MY_PLAY_MOD_STATUS_LABEL[m.status] || m.status,
    meta: [m.version ? `v${m.version}` : '', formatUpdated(m.updatedAt)].filter(Boolean).join(' · '),
    updatedAt: String(m.updatedAt || ''),
    editPath: playModEditPath(m.id),
  }));
}

function appRows(items: PlatformApp[]): Row[] {
  return items.filter((a) => a && a.appId).map((a) => {
    const published = a.status === 'published';
    return {
      id: a.appId,
      name: a.name || a.appId,
      desc: a.summary || '暂无说明',
      group: published ? 'published' : 'draft',
      statusLabel: published ? '已上架' : '草稿',
      meta: [a.category, formatUpdated(a.updatedAt || a.createdAt)].filter(Boolean).join(' · '),
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
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [filter, setFilter] = useState('all');
  const [reloadSeq, setReloadSeq] = useState(0);

  useEffect(() => {
    let aborted = false;
    setStatus('loading');
    setFilter('all');
    const run = async () => {
      try {
        if (kind === 'play') {
          const res = await playModStoreApi.listMine(token, 'gameplay');
          if (!res?.success) throw new Error(res?.message || 'load failed');
          if (!aborted) setRows(playRows(Array.isArray(res.data?.items) ? res.data.items : []));
        } else {
          const res = await platformAppsApi.listMine(token);
          if (!res?.success) throw new Error(res?.message || 'load failed');
          if (!aborted) setRows(appRows(Array.isArray(res.data) ? res.data : []));
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
  }, [token, kind, reloadSeq]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [rows]);
  const filters = FILTERS[kind];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sorted.length };
    for (const r of sorted) c[r.group] = (c[r.group] ?? 0) + 1;
    return c;
  }, [sorted]);
  const q = keyword.trim().toLowerCase();
  const shown = sorted.filter((r) => (filter === 'all' || r.group === filter)
    && (!q || `${r.name} ${r.desc}`.toLowerCase().includes(q)));
  const filterLabel = filters.find((f) => f.key === filter)?.label ?? '';
  const noun = kind === 'play' ? '玩法 Mod' : '手机应用';

  const go = (path: string) => {
    onBeforeLeave?.();
    navigate(path);
  };

  const kindSwitch = (
    <div className={styles.kindSwitch} role="tablist" aria-label="内容类型">
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
          {KIND_LABEL[k]}
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
        <span>我的{noun}加载失败</span>
        <button type="button" className={shelf.stateButton} onClick={() => setReloadSeq((n) => n + 1)}>重试</button>
      </div>
    );
  } else if (sorted.length === 0) {
    body = (
      <div className={shelf.stateBox}>
        <span>还没有自己的{noun}</span>
        <span className={styles.stateHint}>
          {kind === 'play'
            ? '用一句话描述玩法，AI 帮你做成叠加包，可装进任意游戏世界'
            : '对话生成一个小手机应用，审核上架后，游戏世界里的手机就能安装'}
        </span>
        <button type="button" className={shelf.stateButton} onClick={() => go(kind === 'play' ? PLAY_MOD_CREATE_PATH : PHONE_APP_CREATE_PATH)}>
          {kind === 'play' ? '创作玩法 Mod' : '创作手机应用'}
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <div className={styles.filters} role="radiogroup" aria-label="按状态筛选">
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
            <span>{q ? `没有找到与「${keyword.trim()}」相关的${noun}` : `没有${filterLabel}的${noun}`}</span>
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
                <button
                  type="button"
                  className={`${shelf.primaryButton} ${styles.editBtn}`}
                  onClick={() => go(r.editPath)}
                  aria-label={`编辑「${r.name}」`}
                >
                  编辑
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.footNote}>
          {kind === 'play'
            ? '点「编辑」回到对话工坊修改，改完重新上传即提交新版本。'
            : '点「编辑」打开该应用的草稿表单，改完保存并上传应用草稿；上架 / 下架也在那里操作。'}
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
