import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from '../components/Bookshelf/Bookshelf.module.css';
import AppPageShell from '../components/Layout/AppPageShell';
import ShelfSavePicker from '../components/Bookshelf/ShelfSavePicker';
import ShelfSaveManager from '../components/Bookshelf/ShelfSaveManager';
import ShelfMyMods from '../components/Bookshelf/ShelfMyMods';
import { PHONE_APP_CREATE_PATH, PLAY_MOD_CREATE_PATH, readShelfModKind, type ShelfModKind } from '../lib/shelfMyMods';
import bookshelfApi from '../api/bookshelf/bookshelfApi';
import { authModalStore, useAuthStore } from '../store/useAuthStore';
import { buildShelfResumeState } from '../utils/gameDetailNavigation';
import { addImageTimestamp } from '../utils/imageCache';
import { getImageUrl } from '../utils/constants';
import {
  coverUrlAfterDisplayCoverError,
  resolveGameListCoverUrl,
  resolveOriginalCoverUrl,
} from '../utils/displayCoverUrl';
import {
  SHELF_PAGE_SIZE,
  SHELF_VIEW_STORAGE_KEY,
  formatShelfPlayedAt,
  mergeShelfPage,
  normalizeShelfKeyword,
  parseShelfViewState,
  removeShelfItems,
  resolveShelfContinuePlan,
  restoreShelfItems,
  shelfBlockedReason,
  shelfFirstPageSize,
  shelfProgressLine,
  shelfStatusLabel,
  shelfSupportsSaveSlots,
  toggleShelfSelection,
  type ShelfItem,
  type ShelfResumeOption,
  type ShelfSaveEntry,
  type ShelfTab,
} from '../lib/bookshelf';

type ListStatus = 'loading' | 'error' | 'ready';

interface TabList {
  status: ListStatus;
  items: ShelfItem[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
}

const EMPTY_LIST: TabList = { status: 'loading', items: [], hasMore: false, loadingMore: false, loadMoreFailed: false };

interface PickerState {
  item: ShelfItem;
  options: ShelfResumeOption[];
  invalid: ShelfSaveEntry[];
  defaultKey: string;
}

/** 功能注释：优先用 AppPageShell 中间滚动区；回退 #root 兼容旧壳 */
const getScrollRoot = (): HTMLElement | null =>
  (document.querySelector('[data-app-page-main="1"]') as HTMLElement | null) || document.getElementById('root');

const TAB_LABEL: Record<ShelfTab, string> = { recent: '最近游玩', favorites: '我的收藏' };
const BATCH_ACTION_LABEL: Record<ShelfTab, string> = { recent: '移出最近游玩', favorites: '取消收藏' };
/** 功能注释：「我的 Mod」页签不走书架列表接口，单独记住是否停留在该页签（从编辑器返回时恢复） */
const SHELF_MODS_VIEW_KEY = 'shelf-view-mods';
const readModsView = () => {
  try { return sessionStorage.getItem(SHELF_MODS_VIEW_KEY) === '1'; } catch { return false; }
};

/**
 * 书架 Tab（一级页）：最近游玩 / 我的收藏。
 * 数据全部来自后端 /auth/bookshelf/*（身份取自 token）；「继续游玩」交给详情页执行，复用其登录、更新提示与付费校验。
 */
const Bookshelf: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setIsAuthModalOpen } = authModalStore();
  const userId = user?.user?.id;
  const isLoggedIn = Boolean(user?.token && userId);

  const restoredView = useMemo(() => parseShelfViewState(sessionStorage.getItem(SHELF_VIEW_STORAGE_KEY)), []);
  const restorePendingRef = useRef<{ tab: ShelfTab; scrollY: number } | null>(
    restoredView.scrollY > 0 ? { tab: restoredView.tab, scrollY: restoredView.scrollY } : null,
  );

  const [tab, setTab] = useState<ShelfTab>(restoredView.tab);
  const [modsView, setModsView] = useState<boolean>(readModsView);
  const [modKind, setModKind] = useState<ShelfModKind>(readShelfModKind);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [lists, setLists] = useState<Record<ShelfTab, TabList>>({ recent: EMPTY_LIST, favorites: EMPTY_LIST });
  const [reloadSeq, setReloadSeq] = useState(0);
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [saveManagerOpen, setSaveManagerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const current = lists[tab];

  const patchList = useCallback((target: ShelfTab, patch: Partial<TabList> | ((prev: TabList) => Partial<TabList>)) => {
    setLists((prev) => {
      const base = prev[target];
      const next = typeof patch === 'function' ? patch(base) : patch;
      return { ...prev, [target]: { ...base, ...next } };
    });
  }, []);

  const fetchPage = useCallback((target: ShelfTab, params: { limit: number; offset: number; q: string }, signal?: AbortSignal) => (
    target === 'recent'
      ? bookshelfApi.listRecent(params, signal)
      : bookshelfApi.listFavorites(params, signal)
  ), []);

  // 首屏 / 切换页签 / 搜索词变化 / 手动重试：拉第一页（可取消，StrictMode 双挂载不会留下重复结果）
  useEffect(() => {
    if (!isLoggedIn) return;
    const controller = new AbortController();
    const target = tab;
    const restoring = restorePendingRef.current?.tab === target;
    const limit = restoring ? shelfFirstPageSize(restoredView.loaded) : SHELF_PAGE_SIZE;
    patchList(target, { status: 'loading', items: [], hasMore: false, loadMoreFailed: false });
    fetchPage(target, { limit, offset: 0, q: keyword }, controller.signal)
      .then((resp) => {
        if (controller.signal.aborted) return;
        const data = resp.data?.data;
        if (!resp.data?.success || !data) {
          patchList(target, { status: 'error' });
          return;
        }
        patchList(target, { status: 'ready', items: data.rows, hasMore: Boolean(data.hasMore) });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('[Bookshelf] load failed:', error);
        patchList(target, { status: 'error' });
      });
    return () => controller.abort();
  }, [isLoggedIn, userId, tab, keyword, reloadSeq, fetchPage, patchList, restoredView.loaded]);

  // 恢复滚动：仅在被恢复的页签首屏数据就绪后执行一次
  useEffect(() => {
    const pending = restorePendingRef.current;
    if (!pending || pending.tab !== tab || current.status !== 'ready') return;
    restorePendingRef.current = null;
    requestAnimationFrame(() => getScrollRoot()?.scrollTo({ top: pending.scrollY, behavior: 'auto' }));
  }, [tab, current.status]);

  // 离开页面时记住页签、滚动位置与已加载数
  const tabRef = useRef(tab);
  const loadedCountRef = useRef(0);
  tabRef.current = tab;
  loadedCountRef.current = current.items.length;
  const persistView = useCallback(() => {
    try {
      sessionStorage.setItem(SHELF_VIEW_STORAGE_KEY, JSON.stringify({
        tab: tabRef.current,
        scrollY: getScrollRoot()?.scrollTop ?? 0,
        loaded: loadedCountRef.current,
      }));
    } catch {
      // 存储不可用时不恢复，不影响使用
    }
  }, []);
  useEffect(() => () => persistView(), [persistView]);

  // 搜索防抖
  useEffect(() => {
    const next = normalizeShelfKeyword(keywordInput);
    const timer = window.setTimeout(() => setKeyword(next), 300);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const loadMore = useCallback(async () => {
    const target = tab;
    const list = lists[target];
    if (list.status !== 'ready' || !list.hasMore || list.loadingMore) return;
    patchList(target, { loadingMore: true, loadMoreFailed: false });
    try {
      const resp = await fetchPage(target, { limit: SHELF_PAGE_SIZE, offset: list.items.length, q: keyword });
      const data = resp.data?.data;
      if (!resp.data?.success || !data) throw new Error(resp.data?.message || 'load more failed');
      patchList(target, (prev) => ({
        items: mergeShelfPage(prev.items, data.rows),
        hasMore: Boolean(data.hasMore),
        loadingMore: false,
      }));
    } catch (error) {
      console.error('[Bookshelf] load more failed:', error);
      patchList(target, { loadingMore: false, loadMoreFailed: true });
    }
  }, [tab, lists, keyword, fetchPage, patchList]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !current.hasMore || current.loadMoreFailed) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { rootMargin: '200px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [current.hasMore, current.loadMoreFailed, loadMore]);

  const switchTab = (next: ShelfTab) => {
    if (next === tab && !modsView) return;
    setModsView(false);
    try { sessionStorage.removeItem(SHELF_MODS_VIEW_KEY); } catch { /* ignore */ }
    setManaging(false);
    setSelected([]);
    setKeywordInput('');
    setKeyword('');
    getScrollRoot()?.scrollTo({ top: 0, behavior: 'auto' });
    setTab(next);
  };

  const openModsView = () => {
    if (modsView) return;
    setModsView(true);
    try { sessionStorage.setItem(SHELF_MODS_VIEW_KEY, '1'); } catch { /* ignore */ }
    setManaging(false);
    setSelected([]);
    setKeywordInput('');
    setKeyword('');
    getScrollRoot()?.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openDetail = (item: ShelfItem) => {
    if (item.status === 'missing' || item.status === 'deleted') {
      toast.error(shelfBlockedReason(item));
      return;
    }
    persistView();
    navigate(`/game/${encodeURIComponent(item.fileId)}`, { state: { source: 'bookshelf' } });
  };

  const goResume = (item: ShelfItem, saveId: string | null) => {
    persistView();
    navigate(`/game/${encodeURIComponent(item.fileId)}`, { state: buildShelfResumeState(item.fileId, saveId) });
  };

  const handleContinue = async (item: ShelfItem) => {
    if (continuingId) return;
    let saves: ShelfSaveEntry[] | null = null;
    if (item.canPlay && shelfSupportsSaveSlots(item.gameMode)) {
      setContinuingId(item.fileId);
      try {
        const resp = await bookshelfApi.listSaves(item.fileId);
        saves = Array.isArray(resp.data?.items) ? resp.data.items : [];
      } catch (error) {
        console.error('[Bookshelf] list saves failed:', error);
        toast.error('读取存档失败，请稍后重试');
        return;
      } finally {
        setContinuingId(null);
      }
    }
    const plan = resolveShelfContinuePlan(item, saves);
    switch (plan.kind) {
      case 'blocked':
        toast.error(plan.reason);
        return;
      case 'resume':
        goResume(item, plan.saveId);
        return;
      case 'choose':
        setPicker({ item, options: plan.options, invalid: plan.invalid, defaultKey: plan.defaultKey });
        return;
      case 'noValidSave':
        setPicker({ item, options: [], invalid: plan.invalid, defaultKey: '' });
        return;
      default:
        return;
    }
  };

  const toggleManage = () => {
    setManaging((v) => !v);
    setSelected([]);
  };

  const allSelected = current.items.length > 0 && selected.length === current.items.length;
  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : current.items.map((i) => i.fileId));
  };

  // 批量移出 / 取消收藏：乐观移除，失败原位回滚并提示重试
  const runBatch = async () => {
    if (selected.length === 0 || batchBusy) return;
    const target = tab;
    const ids = [...selected];
    const { next, removed } = removeShelfItems(lists[target].items, ids);
    patchList(target, { items: next });
    setSelected([]);
    setBatchBusy(true);
    try {
      const resp = target === 'recent'
        ? await bookshelfApi.removeRecent(ids)
        : await bookshelfApi.removeFavorites(ids);
      if (!resp.data?.success) throw new Error(resp.data?.message || 'batch failed');
      toast.success(target === 'recent' ? `已移出 ${ids.length} 部，存档仍保留` : `已取消收藏 ${ids.length} 部`);
      if (next.length === 0) setManaging(false);
    } catch (error) {
      console.error('[Bookshelf] batch action failed:', error);
      patchList(target, (prev) => ({ items: restoreShelfItems(prev.items, removed) }));
      setSelected(ids);
      toast.error(`${BATCH_ACTION_LABEL[target]}失败，请重试`);
    } finally {
      setBatchBusy(false);
    }
  };

  const saveManageGames = useMemo(
    () => current.items.filter((i) => i.hasPlayRecord && shelfSupportsSaveSlots(i.gameMode)),
    [current.items],
  );

  const renderCover = (item: ShelfItem) => {
    const coverPath = resolveGameListCoverUrl({ cover_url: item.coverUrl, portrait_cover_url: item.portraitCoverUrl });
    const statusLabel = shelfStatusLabel(item.status);
    const isSelected = selected.includes(item.fileId);
    return (
      <button
        type="button"
        className={`${styles.cover} ${item.canPlay ? '' : styles.coverDimmed}`}
        onClick={() => (managing ? setSelected((s) => toggleShelfSelection(s, item.fileId)) : openDetail(item))}
        aria-label={managing ? `选择 ${item.title}` : `查看 ${item.title} 详情`}
      >
        {coverPath && (
          <img
            src={addImageTimestamp(getImageUrl(coverPath))}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              const img = event.currentTarget;
              const fallback = coverUrlAfterDisplayCoverError(coverPath, resolveOriginalCoverUrl({ cover_url: item.coverUrl }));
              const next = fallback ? addImageTimestamp(getImageUrl(fallback)) : '';
              if (!next || img.dataset.coverFallback === '1') return;
              img.dataset.coverFallback = '1';
              img.src = next;
            }}
          />
        )}
        {statusLabel && <span className={styles.statusBadge}>{statusLabel}</span>}
        {item.isPaidGame && !item.purchased && item.canPlay && <span className={styles.paidBadge}>付费</span>}
        {managing && <span className={`${styles.checkbox} ${isSelected ? styles.checkboxOn : ''}`} aria-hidden="true" />}
      </button>
    );
  };

  const renderCard = (item: ShelfItem) => {
    const playedAt = formatShelfPlayedAt(item.lastPlayedAt);
    const progress = shelfProgressLine(item);
    const showContinue = tab === 'recent' || item.hasPlayRecord;
    const isContinuing = continuingId === item.fileId;
    return (
      <div key={item.fileId} className={`${styles.card} ${managing && selected.includes(item.fileId) ? styles.cardSelected : ''}`}>
        {renderCover(item)}
        <div className={styles.cardBody}>
          <button type="button" className={styles.cardTitle} onClick={() => (managing ? setSelected((s) => toggleShelfSelection(s, item.fileId)) : openDetail(item))}>
            {item.title || '未命名剧本'}
          </button>
          <div className={styles.cardLine}>{item.author || '\u00a0'}</div>
          <div className={styles.cardLine}>{playedAt ? `${playedAt}玩过` : (tab === 'favorites' ? '还没玩过' : '\u00a0')}</div>
          <div className={`${styles.cardLine} ${styles.cardProgress}`}>{progress || '\u00a0'}</div>
          {!managing && (
            <div className={styles.cardActions}>
              {tab === 'favorites' && (
                <button type="button" className={styles.ghostButton} onClick={() => openDetail(item)}>查看详情</button>
              )}
              {showContinue && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={!item.canPlay || isContinuing}
                  title={item.canPlay ? undefined : shelfBlockedReason(item)}
                  onClick={() => void handleContinue(item)}
                >
                  {isContinuing ? '读取中…' : '继续游玩'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSkeleton = () => (
    <div className={styles.grid} aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonCover} />
          <div className={styles.skeletonLine} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        </div>
      ))}
    </div>
  );

  const renderBody = () => {
    if (!isLoggedIn) {
      return (
        <div className={styles.stateBox}>
          <span>{modsView ? '登录后查看并编辑你创作的玩法 Mod 和手机应用' : '登录后查看你的最近游玩与收藏'}</span>
          <button type="button" className={styles.stateButton} onClick={() => setIsAuthModalOpen(true)}>登录 / 注册</button>
        </div>
      );
    }
    if (modsView) {
      return (
        <ShelfMyMods
          token={user!.token}
          keyword={keyword}
          kind={modKind}
          onKindChange={(k) => { setModKind(k); setKeywordInput(''); setKeyword(''); }}
          onBeforeLeave={persistView}
        />
      );
    }
    if (current.status === 'loading') return renderSkeleton();
    if (current.status === 'error') {
      return (
        <div className={styles.stateBox}>
          <span>{TAB_LABEL[tab]}加载失败</span>
          <button type="button" className={styles.stateButton} onClick={() => setReloadSeq((n) => n + 1)}>重试</button>
        </div>
      );
    }
    if (current.items.length === 0) {
      if (keyword) {
        return <div className={styles.stateBox}><span>没有找到与「{keyword}」相关的剧本</span></div>;
      }
      return (
        <div className={styles.stateBox}>
          <span>{tab === 'recent' ? '还没有玩过的剧本' : '还没有收藏的剧本'}</span>
          <button type="button" className={styles.stateButton} onClick={() => navigate('/home')}>去发现剧本</button>
        </div>
      );
    }
    return (
      <>
        <div className={styles.grid}>{current.items.map(renderCard)}</div>
        <div ref={sentinelRef} className={styles.listFooter}>
          {current.loadingMore && '加载中…'}
          {current.loadMoreFailed && (
            <>加载失败，<button type="button" onClick={() => void loadMore()}>点击重试</button></>
          )}
          {!current.hasMore && !current.loadingMore && current.items.length > SHELF_PAGE_SIZE && '已经到底了'}
        </div>
      </>
    );
  };

  return (
    <AppPageShell shellClassName={`${styles.pageRoot} ${managing ? styles.pageRootManaging : ''}`} mainClassName={styles.main}>
        <div className={styles.header}>
          <div className={styles.tabs} role="tablist">
            {(['recent', 'favorites'] as ShelfTab[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={!modsView && tab === key}
                className={`${styles.tab} ${!modsView && tab === key ? styles.tabActive : ''}`}
                onClick={() => switchTab(key)}
              >
                {TAB_LABEL[key]}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={modsView}
              className={`${styles.tab} ${modsView ? styles.tabActive : ''}`}
              onClick={openModsView}
            >
              我的 Mod
            </button>
          </div>
          {isLoggedIn && (
            <div className={styles.headerRight}>
              <label className={styles.search}>
                <input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder={modsView ? (modKind === 'app' ? '搜索我的手机应用' : '搜索我的玩法') : '搜索剧本 / 作者'}
                  maxLength={50}
                  aria-label={modsView ? '按名称搜索我的 Mod' : '按剧本名称或作者搜索'}
                />
                {keywordInput && (
                  <button type="button" className={styles.searchClear} onClick={() => setKeywordInput('')} aria-label="清空搜索">×</button>
                )}
              </label>
              {modsView ? (
                <button type="button" className={styles.headerButton} onClick={() => { persistView(); navigate(modKind === 'app' ? PHONE_APP_CREATE_PATH : PLAY_MOD_CREATE_PATH); }}>{modKind === 'app' ? '新建应用' : '新建玩法'}</button>
              ) : (
              <>
              <button
                type="button"
                className={`${styles.headerButton} ${managing ? styles.headerButtonActive : ''}`}
                onClick={toggleManage}
                disabled={current.status !== 'ready' || (current.items.length === 0 && !managing)}
              >
                {managing ? '完成' : '管理'}
              </button>
              <button type="button" className={styles.headerButton} onClick={() => setSaveManagerOpen(true)}>存档管理</button>
              </>
              )}
            </div>
          )}
        </div>
        {renderBody()}

      {managing && (
        <div className={styles.manageBar}>
          <div className={styles.manageInfo}>
            <strong>{BATCH_ACTION_LABEL[tab]}</strong>
            已选 {selected.length} 部 · {tab === 'recent' ? '只移除记录，不删除存档' : '不删除存档，不影响购买'}
          </div>
          <button type="button" className={styles.manageSelectAll} onClick={toggleSelectAll}>
            {allSelected ? '取消全选' : '全选'}
          </button>
          <button type="button" className={styles.manageAction} disabled={selected.length === 0 || batchBusy} onClick={() => void runBatch()}>
            {batchBusy ? '处理中…' : BATCH_ACTION_LABEL[tab]}
          </button>
        </div>
      )}

      <ShelfSavePicker
        isOpen={Boolean(picker)}
        gameTitle={picker?.item.title || ''}
        options={picker?.options || []}
        invalid={picker?.invalid || []}
        defaultKey={picker?.defaultKey || ''}
        onClose={() => setPicker(null)}
        onViewDetail={() => {
          const item = picker?.item;
          setPicker(null);
          if (item) openDetail(item);
        }}
        onConfirm={(option) => {
          const item = picker?.item;
          setPicker(null);
          if (item) goResume(item, option.saveId);
        }}
      />
      <ShelfSaveManager isOpen={saveManagerOpen} games={saveManageGames} onClose={() => setSaveManagerOpen(false)} />
    </AppPageShell>
  );
};

export default Bookshelf;
