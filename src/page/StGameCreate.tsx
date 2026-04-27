import React, { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import styles from './StGameCreate.module.css';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { StConfig, STRegexScript, STCharBookEntry } from '../utils/stRender';
import AssetsUpload, { type AssetsUploadHandle } from '../components/StGame/AssetsUpload';
import getGameDataApi from '../api/home/getGameData';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import { flattenThemeTags, type FlatThemeTag } from '../utils/themeTags';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import PublishSettingsModal from '../components/CommonModal/PublishSettingsModal';
import GameAction from '../api/rpgGame/gameAction';
import toast from 'react-hot-toast';

const emptyConfig: StConfig = {
  regex: [],
  variables: {},
  preferCharacterId: 'last',
  persona: {},
  extensions: {
    regex_scripts: [],
    character_book: { entries: [] },
  },
  data: {
    description: '',
  },
};

const THEME_TAG_MIN = 1;
const THEME_TAG_MAX = 2;
const THEME_TAG_REQUIRED_TOAST_ID = 'st-theme-tags-required';
const THEME_TAG_REQUIRED_TOAST_DURATION = 4500;
type RequiredFieldKey = 'title' | 'themeTags';
type ClearFieldKey = 'description' | 'firstMes';
type StCreateStepKey = 'info' | 'assets' | 'rules';
type StCreateStepIndex = 1 | 2 | 3;
type LeaveConfirmSource = 'navigate' | 'history-back';

const DEFAULT_STEP_KEY: StCreateStepKey = 'info';
const STEP_INDEX_MAP: Record<StCreateStepKey, StCreateStepIndex> = {
  info: 1,
  assets: 2,
  rules: 3,
};
const STEP_ITEMS: Array<{ key: StCreateStepKey; index: StCreateStepIndex; label: string }> = [
  { key: 'info', index: 1, label: '剧本信息' },
  { key: 'assets', index: 2, label: '素材包' },
  { key: 'rules', index: 3, label: '规则与渲染' },
];

const normalizeThemeTagIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
    .slice(0, THEME_TAG_MAX);
};

const isStCreateStepKey = (value: string | null): value is StCreateStepKey => (
  value === 'info' || value === 'assets' || value === 'rules'
);

const StGameCreate: React.FC = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const appIdFromQuery = params.get('appId') || '';
  const stepParam = params.get('step');
  const stepKey: StCreateStepKey = isStCreateStepKey(stepParam) ? stepParam : DEFAULT_STEP_KEY;

  const [title, setTitle] = useState('');
  const [appId, setAppId] = useState('');
  const [cfg, setCfg] = useState<StConfig>({ ...emptyConfig });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
  const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
  const [themeTagError, setThemeTagError] = useState('');
  const [highlightField, setHighlightField] = useState<RequiredFieldKey | ''>('');
  const [showPendingAssetsConfirm, setShowPendingAssetsConfirm] = useState(false);
  const [uploadingFromStepConfirm, setUploadingFromStepConfirm] = useState(false);
  const [hasPendingLocalAssets, setHasPendingLocalAssets] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveConfirmSource, setLeaveConfirmSource] = useState<LeaveConfirmSource | null>(null);
  const [clearFieldTarget, setClearFieldTarget] = useState<ClearFieldKey | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTargetGameId, setPublishTargetGameId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const titleRowRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const themeTagsPanelRef = useRef<HTMLDivElement>(null);
  const assetsUploadRef = useRef<AssetsUploadHandle | null>(null);
  const pendingLeaveActionRef = useRef<(() => void) | null>(null);
  const pendingGuardCleanupActionRef = useRef<(() => void) | null>(null);
  const shouldWarnBeforeLeaveRef = useRef(false);
  const hasHistoryGuardRef = useRef(false);
  const skipNextPopstateRef = useRef(false);
  const step = STEP_INDEX_MAP[stepKey];
  const resolvedAppId = String(appIdFromQuery || appId || '').trim();

  const scripts: STRegexScript[] = ((cfg.extensions?.regex_scripts) || []) as STRegexScript[];
  const entries: STCharBookEntry[] = (((cfg.extensions?.character_book)?.entries) || []) as STCharBookEntry[];
  const descriptionValue = String((cfg.data?.description) || '');
  const firstMessageValue = String(cfg.persona?.first_mes || '');

  const readHasPendingLocalAssets = () => (
    assetsUploadRef.current?.hasPendingLocalAssets() ?? hasPendingLocalAssets
  );

  const shouldWarnBeforeLeave = () => stepKey === 'assets' && readHasPendingLocalAssets();

  const buildStepHref = (targetStep: StCreateStepKey, nextAppId?: string) => {
    const nextParams = new URLSearchParams(params);
    const targetAppId = String(nextAppId ?? resolvedAppId).trim();
    nextParams.set('step', targetStep);
    if (targetAppId) {
      nextParams.set('appId', targetAppId);
    } else {
      nextParams.delete('appId');
    }
    return `/st/create?${nextParams.toString()}`;
  };

  const navigateToStep = (
    targetStep: StCreateStepKey,
    options?: { replace?: boolean; nextAppId?: string },
  ) => {
    nav(buildStepHref(targetStep, options?.nextAppId), { replace: options?.replace });
  };

  const updateScripts = (next: STRegexScript[]) => {
    setCfg(s => ({
      ...s,
      extensions: {
        ...(s.extensions || {}),
        regex_scripts: next,
      },
    }));
  };

  const updateEntries = (next: STCharBookEntry[]) => {
    const withPriority = next.map((e, i) => ({ ...e, priority: i + 1 }));
    setCfg(s => ({
      ...s,
      extensions: {
        ...(s.extensions || {}),
        character_book: { entries: withPriority },
      },
    }));
  };

  const openClearFieldConfirm = (field: ClearFieldKey) => {
    setClearFieldTarget(field);
  };

  const clearField = () => {
    if (clearFieldTarget === 'description') {
      setCfg(s => ({
        ...s,
        data: { ...(s.data || {}), description: '' },
      }));
    } else if (clearFieldTarget === 'firstMes') {
      setCfg(s => ({
        ...s,
        persona: { ...(s.persona || {}), first_mes: '' },
      }));
    }
    setClearFieldTarget(null);
  };

  const closeClearFieldConfirm = () => {
    setClearFieldTarget(null);
  };

  const cleanupHistoryGuard = (action?: () => void) => {
    if (typeof window === 'undefined' || !hasHistoryGuardRef.current) {
      action?.();
      return;
    }

    pendingGuardCleanupActionRef.current = action ?? null;
    skipNextPopstateRef.current = true;
    hasHistoryGuardRef.current = false;
    window.history.back();
  };

  const openLeaveConfirm = (
    source: LeaveConfirmSource,
    action?: () => void,
  ) => {
    pendingLeaveActionRef.current = action ?? null;
    setLeaveConfirmSource(source);
    setShowLeaveConfirm(true);
  };

  const runBeforeLeaveAction = (action: () => void) => {
    if (!shouldWarnBeforeLeave()) {
      if (hasHistoryGuardRef.current) {
        cleanupHistoryGuard(action);
        return;
      }
      action();
      return;
    }
    openLeaveConfirm('navigate', action);
  };

  useEffect(() => {
    if (isStCreateStepKey(stepParam)) return;
    navigateToStep(DEFAULT_STEP_KEY, { replace: true });
  }, [nav, params, resolvedAppId, stepParam]);

  useEffect(() => {
    if (!appId || appId === appIdFromQuery) return;
    navigateToStep(stepKey, { replace: true, nextAppId: appId });
  }, [appId, appIdFromQuery, nav, params, stepKey]);

  useEffect(() => {
    shouldWarnBeforeLeaveRef.current = shouldWarnBeforeLeave();

    if (typeof window === 'undefined') return;
    if (shouldWarnBeforeLeaveRef.current) {
      if (!hasHistoryGuardRef.current && window.history.length > 1) {
        // 插入同地址哨兵记录，用于拦截浏览器后退。
        window.history.pushState(window.history.state, '', window.location.href);
        hasHistoryGuardRef.current = true;
      }
      return;
    }

    if (hasHistoryGuardRef.current) {
      cleanupHistoryGuard();
    }
  }, [stepKey, hasPendingLocalAssets]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handlePopState = () => {
      if (skipNextPopstateRef.current) {
        skipNextPopstateRef.current = false;
        const nextAction = pendingGuardCleanupActionRef.current;
        pendingGuardCleanupActionRef.current = null;
        nextAction?.();
        return;
      }

      if (!shouldWarnBeforeLeaveRef.current) {
        hasHistoryGuardRef.current = false;
        return;
      }

      window.history.pushState(window.history.state, '', window.location.href);
      hasHistoryGuardRef.current = true;
      openLeaveConfirm('history-back');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const canProceedToAssetsStep = () => {
    setError('');
    if (!validateThemeTags()) {
      const message = '题材未填，请先选择作品标签。';
      setError(message);
      guideToRequiredField('themeTags', message);
      return false;
    }
    return true;
  };

  const goToRulesStep = () => {
    if (!canProceedToAssetsStep()) return;
    if (assetsUploadRef.current?.hasPendingUpload()) {
      setShowPendingAssetsConfirm(true);
      return;
    }
    runBeforeLeaveAction(() => navigateToStep('rules'));
  };

  const uploadAssetsAndContinue = async () => {
    if (uploadingFromStepConfirm) return;
    if (!assetsUploadRef.current) {
      setShowPendingAssetsConfirm(false);
      navigateToStep('rules');
      return;
    }

    setUploadingFromStepConfirm(true);
    try {
      const ok = await assetsUploadRef.current.uploadPendingAssetsAndContinue();
      if (!ok) return;
      setShowPendingAssetsConfirm(false);
      navigateToStep('rules');
    } finally {
      setUploadingFromStepConfirm(false);
    }
  };

  // DnD: 拖动调整世界书条目顺序
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const onDragStartEntry = (idx: number, ev: React.DragEvent<HTMLDivElement>) => {
    try { ev.dataTransfer.setData('text/plain', String(idx)); } catch {}
    setDragIndex(idx);
  };
  const onDragOverEntry = (_idx: number, ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
  };
  const onDropEntry = (idx: number, ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    let from = dragIndex;
    if (from == null) {
      try { from = parseInt(ev.dataTransfer.getData('text/plain') || '-1', 10); } catch { from = -1; }
    }
    if (from == null || from < 0 || from === idx) { setDragIndex(null); return; }
    const arr = [...entries];
    const [moved] = arr.splice(from, 1);
    arr.splice(idx, 0, moved);
    updateEntries(arr);
    setDragIndex(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appIdFromQuery) return;
      try {
        const r = await authFetch(`${HOST_ADDRESS}/api/st/apps/${appIdFromQuery}/config`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        if (j?.config) {
          setCfg({ ...emptyConfig, ...j.config });
          setAppId(appIdFromQuery);
          if (typeof j?.config?.data?.title === 'string') {
            setTitle(j.config.data.title as string);
          } else if (typeof j?.config?.persona?.name === 'string') {
            setTitle(j.config.persona.name as string);
          }
        }
      } catch {
        // ignore edit errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appIdFromQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await gameTagsApi.getGameTagsTree();
        if (!resp.data?.success || cancelled) return;
        setAvailableThemeTags(flattenThemeTags(resp.data.data || []));
      } catch {
        // ignore theme tag load errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 补充：与自定义模式一致，编辑模式下通过 /auth/games/info 读取游戏信息（用于标题等元数据）
  useEffect(() => {
    let destroyed = false;
    (async () => {
      if (!appIdFromQuery) return;
      try {
        const resp = await getGameDataApi.getGameDetail({ fileId: appIdFromQuery });
        const data: any = resp?.data?.data;
        if (destroyed) return;
        if (data && typeof data.title === 'string') {
          setTitle((prev) => prev || data.title);
        }
      } catch (_err) {
        // 静默失败，不打断流程
      }
    })();
    return () => { destroyed = true; };
  }, [appIdFromQuery]);

  useEffect(() => {
    if (!highlightField || step !== 1) return;

    const targetTimer = window.setTimeout(() => {
      const target = highlightField === 'title' ? titleRowRef.current : themeTagsPanelRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (highlightField === 'title') {
        titleInputRef.current?.focus();
      }
    }, 0);

    const clearTimer = window.setTimeout(() => {
      setHighlightField((current) => current === highlightField ? '' : current);
    }, 3200);

    return () => {
      window.clearTimeout(targetTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightField, step]);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      if (!appIdFromQuery) return;
      try {
        const resp = await getGameDataApi.getGameDetail({ fileId: appIdFromQuery });
        const data: any = resp?.data?.data;
        if (!destroyed) {
          setSelectedThemeTagIds(normalizeThemeTagIds(data?.theme_tag_ids));
        }
      } catch {
        // ignore theme tag hydrate errors
      }
    })();
    return () => { destroyed = true; };
  }, [appIdFromQuery]);

  const handleThemeTagToggle = (tagId: number) => {
    setSelectedThemeTagIds((prev) => {
      if (prev.includes(tagId)) {
        const next = prev.filter((id) => id !== tagId);
        if (next.length >= THEME_TAG_MIN) {
          setThemeTagError('');
        }
        return next;
      }
      if (prev.length >= THEME_TAG_MAX) {
        setThemeTagError('请选择 1~2 个作品标签');
        return prev;
      }
      setThemeTagError('');
      setHighlightField((current) => current === 'themeTags' ? '' : current);
      return [...prev, tagId];
    });
  };

  const validateThemeTags = (): boolean => {
    if (selectedThemeTagIds.length < THEME_TAG_MIN || selectedThemeTagIds.length > THEME_TAG_MAX) {
      setThemeTagError('请选择 1~2 个作品标签');
      return false;
    }
    setThemeTagError('');
    return true;
  };

  const showThemeTagRequiredToast = (message: string) => {
    toast.error(message, {
      id: THEME_TAG_REQUIRED_TOAST_ID,
      duration: THEME_TAG_REQUIRED_TOAST_DURATION,
    });
  };

  const guideToRequiredField = (field: RequiredFieldKey, message: string) => {
    if (field === 'themeTags') {
      showThemeTagRequiredToast(message);
    } else {
      window.alert(message);
    }
    navigateToStep(DEFAULT_STEP_KEY, { replace: true });
    setHighlightField(field);
  };

  const goToAssetsStep = () => {
    if (!canProceedToAssetsStep()) return;
    navigateToStep('assets');
  };

  const handleStepNavigation = (targetStep: StCreateStepKey) => {
    if (targetStep === stepKey) return;
    if (STEP_INDEX_MAP[targetStep] <= step) {
      if (targetStep !== 'assets') {
        runBeforeLeaveAction(() => navigateToStep(targetStep));
        return;
      }
      navigateToStep(targetStep);
      return;
    }
    if (targetStep === 'assets') {
      goToAssetsStep();
      return;
    }
    if (targetStep === 'rules') {
      goToRulesStep();
      return;
    }
    navigateToStep(targetStep);
  };

  const handleStepLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetStep: StCreateStepKey,
  ) => {
    if (
      event.button !== 0
      || event.metaKey
      || event.altKey
      || event.ctrlKey
      || event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    handleStepNavigation(targetStep);
  };

  const closeLeaveConfirm = () => {
    pendingLeaveActionRef.current = null;
    setLeaveConfirmSource(null);
    setShowLeaveConfirm(false);
  };

  const confirmLeaveCurrentPage = () => {
    const source = leaveConfirmSource;
    const action = pendingLeaveActionRef.current;

    pendingLeaveActionRef.current = null;
    setLeaveConfirmSource(null);
    setShowLeaveConfirm(false);

    if (typeof window !== 'undefined' && source === 'history-back') {
      skipNextPopstateRef.current = true;
      hasHistoryGuardRef.current = false;
      window.history.go(-2);
      return;
    }

    if (action) {
      cleanupHistoryGuard(action);
    }
  };

  const validateRequiredFields = (): boolean => {
    setError('');
    if (!title.trim()) {
      const message = '标题未填，请先填写标题。';
      setError(message);
      guideToRequiredField('title', message);
      return false;
    }

    if (!validateThemeTags()) {
      const message = '题材未填，请先选择作品标签。';
      setError(message);
      guideToRequiredField('themeTags', message);
      return false;
    }

    return true;
  };

  const saveConfig = async (): Promise<string> => {
    setError('');
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('标题未填，请先填写标题。');
      throw new Error('标题未填，请先填写标题。');
    }

    if (!validateThemeTags()) {
      throw new Error('请选择 1~2 个作品标签');
    }

    try {
      setSaving(true);
      let id = appIdFromQuery || appId;

      if (!id) {
        const r1 = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), engine: 'ST' }),
        });
        const j1 = await r1.json();
        id = j1?.appId || j1?.data?.appId;
        if (!id) throw new Error('未返回 appId');
        setAppId(id);
      }

      // 同步游戏标题到 Custom App 元数据（用于卡片标题/列表展示）
      const titleResp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/meta/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!titleResp.ok) throw new Error(await titleResp.text());

      // 在提交前，按照当前条目顺序写入优先级（1..N）
      const finalCfg = (() => {
        const current = {
          ...cfg,
          data: { ...((cfg as any).data || {}), title: trimmedTitle },
          persona: { ...((cfg as any).persona || {}), name: trimmedTitle },
        } as any;
        const ents = ((current.extensions && current.extensions.character_book && current.extensions.character_book.entries) || []) as any[];
        const withPriority = (Array.isArray(ents) ? ents : []).map((it, i) => ({ ...it, priority: i + 1 }));
        current.extensions = { ...(current.extensions || {}) };
        current.extensions.character_book = { ...(current.extensions.character_book || {}), entries: withPriority };
        return current;
      })();

      const r2 = await authFetch(`${HOST_ADDRESS}/api/st/apps/${id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalCfg),
      });
      if (!r2.ok) throw new Error(await r2.text());
      await gameTagsApi.setGameTagsForGame({
        fileId: String(id),
        tagIds: selectedThemeTagIds,
      });
      return id;
    } catch (e: any) {
      setError(String(e?.message || e));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const saveToStats = async () => {
    if (saving || publishing) return;
    if (!validateRequiredFields()) return;
    try {
      const id = await saveConfig();
      nav(`/createGame?mode=stats&gameId=${encodeURIComponent(id)}`);
    } catch {
      // handled in saveConfig
    }
  };

  const saveAndTest = async () => {
    if (saving || publishing) return;
    if (!validateRequiredFields()) return;
    try {
      const id = await saveConfig();
      nav(`/st/${id}`);
    } catch {
      // handled in saveConfig
    }
  };

  const saveAndOpenPublish = async () => {
    if (saving || publishing) return;
    if (!validateRequiredFields()) return;
    try {
      const id = await saveConfig();
      setPublishTargetGameId(id);
      setShowPublishModal(true);
    } catch {
      // handled in saveConfig
    }
  };

  const closePublishModal = () => {
    if (publishing) return;
    setShowPublishModal(false);
  };

  const handlePublishGame = async (description: string) => {
    if (publishing) return;

    const fileId = String(publishTargetGameId || appIdFromQuery || appId || '').trim();
    if (!fileId) {
      toast.error('缺少作品 ID，无法发布');
      return;
    }

    try {
      setPublishing(true);
      const response = await GameAction.publishGame({
        fileId,
        priceAmount: 0,
        description,
      });

      if (!response.data.success) {
        const errorMessage = response.data.message || '发布游戏失败';
        toast.error(errorMessage);
        if (errorMessage === '游戏已发布') {
          setShowPublishModal(false);
          nav(`/createGame?mode=stats&gameId=${encodeURIComponent(fileId)}`);
        }
        return;
      }

      setShowPublishModal(false);
      nav(`/createGame?mode=stats&gameId=${encodeURIComponent(fileId)}`);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '发布游戏失败';
      toast.error(errorMessage);
      if (errorMessage === '游戏已发布') {
        setShowPublishModal(false);
        nav(`/createGame?mode=stats&gameId=${encodeURIComponent(fileId)}`);
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar beforeLeaveAction={runBeforeLeaveAction} />
      <div className={styles.main}>
        <div className={styles.headerRow}>
          <h2>创建AVG模式</h2>
          <nav className={styles.stepper} aria-label="AVG create steps">
            {STEP_ITEMS.map((item, index) => {
              const active = item.key === stepKey;
              return (
                <React.Fragment key={item.key}>
                  <Link
                    to={buildStepHref(item.key)}
                    aria-current={active ? 'step' : undefined}
                    className={`${styles.stepLink} ${active ? styles.stepActive : styles.step}`}
                    onClick={(event) => handleStepLinkClick(event, item.key)}
                  >
                    {item.index}. {item.label}
                  </Link>
                  {index < STEP_ITEMS.length - 1 ? (
                    <div className={styles.stepDivider} aria-hidden="true"></div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        <div
          ref={titleRowRef}
          className={`${styles.formRow} ${highlightField === 'title' ? styles.requiredHighlight : ''}`}
        >
          <label>标题</label>
          <input
            ref={titleInputRef}
            className={`${styles.text} ${highlightField === 'title' ? styles.inputHighlight : ''}`}
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              setHighlightField((current) => current === 'title' ? '' : current);
            }}
          />
        </div>

        {step === 1 && (
          <div
            ref={themeTagsPanelRef}
            className={`${styles.themeTagsPanel} ${highlightField === 'themeTags' ? styles.requiredHighlight : ''}`}
          >
            <div className={styles.themeTagsHeader}>
              <span className={styles.themeTagsLabel}>作品标签<span className={styles.requiredMark}>*</span></span>
              <span className={styles.themeTagsHint}>最少 1 个，最多 2 个</span>
            </div>
            <div className={styles.themeTagsWrap}>
              {availableThemeTags.map((tag) => {
                const active = selectedThemeTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`${styles.themeTagChip} ${active ? styles.themeTagChipActive : ''}`}
                    onClick={() => handleThemeTagToggle(tag.id)}
                    title={tag.pathLabel || tag.name}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            {themeTagError ? <div className={styles.themeTagError}>{themeTagError}</div> : null}
          </div>
        )}

        {step === 1 && (
          <div className={`${styles.columns} ${styles.stepOneColumns}`}>
            <div className={`${styles.col} ${styles.stepOneCol}`}>
              <div className={`${styles.group} ${styles.stepOneGroup}`}>
                <div className={styles.stepOneGroupHeader}>
                  <div className={`${styles.groupTitle} ${styles.stepOneGroupTitle}`}>提示词 / 角色卡</div>
                  <button
                    type="button"
                    className={styles.clearFieldButton}
                    onClick={() => openClearFieldConfirm('description')}
                    disabled={!descriptionValue}
                  >
                    一键清空
                  </button>
                </div>
                <textarea
                  className={`${styles.area} ${styles.stepOneArea}`}
                  rows={18}
                  placeholder={'例：近未来的上海，玩家扮演新入职的「记忆修复师」，需要在一周内修复三名委托人的记忆。'}
                  value={descriptionValue}
                  onChange={e => setCfg(s => ({
                    ...s,
                    data: { ...(s.data || {}), description: e.target.value },
                  }))}
                />
              </div>
            </div>
            <div className={`${styles.col} ${styles.stepOneCol}`}>
              <div className={`${styles.group} ${styles.stepOneGroup}`}>
                <div className={styles.stepOneGroupHeader}>
                  <div className={`${styles.groupTitle} ${styles.stepOneGroupTitle}`}>开场白 / 首页</div>
                  <button
                    type="button"
                    className={styles.clearFieldButton}
                    onClick={() => openClearFieldConfirm('firstMes')}
                    disabled={!firstMessageValue}
                  >
                    一键清空
                  </button>
                </div>
                <textarea
                  className={`${styles.area} ${styles.stepOneArea}`}
                  rows={18}
                  placeholder={'例：你推开那家小店的门，风铃叮当作响，一股混合着咖啡与雨味的气息扑面而来。'}
                  value={firstMessageValue}
                  onChange={e => setCfg(s => ({
                    ...s,
                    persona: { ...(s.persona || {}), first_mes: e.target.value },
                  }))}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.columns3}>
            <div className={styles.col}>
              <div className={styles.group}>
                <div className={styles.groupTitle}>素材包</div>
                <div className={styles.hint}>上传图片/音频等静态资源，稍后在正则替换模板里用 {'{{ASSET_PREFIX}}'} 引用。</div>
                <AssetsUpload
                  ref={assetsUploadRef}
                  title={title}
                  appId={appId}
                  layoutVariant="shell"
                  onAppReady={(id)=> setAppId(id)}
                  onPendingLocalAssetsChange={setHasPendingLocalAssets}
                  onUploaded={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.columns}>
            <div className={styles.col}>
              <div className={styles.group}>
                <div className={styles.groupTitle}>世界书</div>
                <div className={styles.hint}>为世界设定写规则片段，按关键词分组，方便模型查阅。</div>
                {entries.map((e, idx) => (
                  <div
                    key={e.uid || idx}
                    className={styles.ruleItem}
                    draggable
                    onDragStart={(ev) => onDragStartEntry(idx, ev)}
                    onDragOver={(ev) => onDragOverEntry(idx, ev)}
                    onDrop={(ev) => onDropEntry(idx, ev)}
                    title="拖动以调整优先级"
                  >
                    <div className={styles.row2} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>优先级：{idx + 1}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" aria-label="删除" title="删除" onClick={() => { const next = entries.filter((_, i) => i !== idx); updateEntries(next); }} style={{ background: 'transparent', border: 'none', color: '#999', fontSize: 16, lineHeight: '1', cursor: 'pointer', padding: '4px 6px' }}>×</button>
                        <div style={{ cursor: 'grab', userSelect: 'none' }}>☰</div>
                      </div>
                    </div>
                    <div className={styles.row2}>
                      <label>keys</label>
                      <input
                        className={styles.text}
                        placeholder={'例：校规, 晚自习'}
                        value={(e.keys || []).join(',')}
                        onChange={ev => {
                          const next = [...entries];
                          next[idx] = { ...next[idx], keys: (ev.target.value || '').split(',').map(s => s.trim()).filter(Boolean) };
                          updateEntries(next);
                        }}
                      />
                    </div>
                    <div>
                      <label>内容</label>
                      <textarea
                        className={styles.area}
                        rows={3}
                        placeholder={'例：晚自习期间禁止使用手机，被发现将扣除 10 点纪律值。'}
                        value={e.content || ''}
                        onChange={ev => {
                          const next = [...entries];
                          next[idx] = { ...next[idx], content: ev.target.value };
                          updateEntries(next);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className={styles.row2}>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      const next: STCharBookEntry[] = [...entries, {
                        keys: [],
                        content: '',
                        enabled: true,
                      }];
                      updateEntries(next);
                    }}
                  >+ 新增一条世界书条目</button>
                </div>
              </div>
            </div>

            <div className={styles.col}>
              <div className={styles.group}>
                <div className={styles.groupTitle}>正则脚本</div>
                <div className={styles.hint}>用于把模型输出中的特定模式替换为 HTML 片段。</div>

                {scripts.map((r, idx) => (
                  <div key={idx} className={styles.ruleItem}>
                    <div className={styles.row2}>
                      <label>正则</label>
                      <input
                        className={styles.text}
                        placeholder={'例：/(好感度：(?<val>\\d+))/g'}
                        value={r.findRegex || ''}
                        onChange={e => {
                          const next = [...scripts];
                          next[idx] = { ...next[idx], findRegex: e.target.value };
                          updateScripts(next);
                        }}
                      />
                    </div>
                    <div>
                      <label>替换内容</label>
                      <textarea
                        className={styles.area}
                        rows={4}
                        placeholder={'例：<span class="status">好感度：$<val></span>'}
                        value={r.replaceString || ''}
                        onChange={e => {
                          const next = [...scripts];
                          next[idx] = { ...next[idx], replaceString: e.target.value };
                          updateScripts(next);
                        }}
                      />
                    </div><div className={styles.row2}>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          const next = scripts.filter((_, i) => i !== idx);
                          updateScripts(next);
                        }}
                      >删除此规则</button>
                    </div>
                  </div>
                ))}

                <div className={styles.row2}>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      const next: STRegexScript[] = [...scripts, {
                        findRegex: '',
                        replaceString: '',
                      }];
                      updateScripts(next);
                    }}
                  >+ 新增一条规则</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actionsLegacy}>
          {step === 1 ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => handleStepNavigation('assets')}
            >下一步：上传素材包</button>
          ) : step === 2 ? (
            <>
              <button type="button" className={styles.secondary} onClick={() => handleStepNavigation('info')}>上一步</button>
              <button type="button" className={styles.primary} onClick={() => handleStepNavigation('rules')}>下一步：配置规则</button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => handleStepNavigation('assets')}
                disabled={saving || publishing}
              >上一步</button>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving || publishing}
                onClick={saveToStats}
              >{saving ? '保存中...' : '保存'}</button>
              <button
                type="button"
                className={styles.primary}
                disabled={saving || publishing}
                onClick={saveAndTest}
              >{saving ? '保存中...' : '测试'}</button>
              <button
                type="button"
                className={styles.primary}
                disabled={saving || publishing}
                onClick={saveAndOpenPublish}
              >{saving ? '保存中...' : publishing ? '发布中...' : '发布'}</button>
              <div style={{ display: 'none' }}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => handleStepNavigation('assets')}
              >上一步</button>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving || publishing}
                onClick={saveToStats}
              >完成</button>
              <button
                className={styles.primary}
                disabled={saving || publishing}
                onClick={saveAndTest}
              >{saving ? '创建中…' : '创建并测试'}</button>
              </div>
            </>
          )}
        </div>
        <div className={styles.actions}>
          <div className={styles.actionsLeft}>
            {step !== 1 ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => handleStepNavigation(step === 2 ? 'info' : 'assets')}
                disabled={saving || publishing}
              >上一步</button>
            ) : null}
          </div>
          <div className={styles.actionsRight}>
            {step === 1 ? (
              <button
                type="button"
                className={styles.primary}
                onClick={() => handleStepNavigation('assets')}
              >下一步：上传素材包</button>
            ) : step === 2 ? (
              <button
                type="button"
                className={styles.primary}
                onClick={() => handleStepNavigation('rules')}
              >下一步：配置规则</button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || publishing}
                  onClick={saveToStats}
                >{saving ? '保存中...' : '保存'}</button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || publishing}
                  onClick={saveAndTest}
                >{saving ? '保存中...' : '测试'}</button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || publishing}
                  onClick={saveAndOpenPublish}
                >{saving ? '保存中...' : publishing ? '发布中...' : '发布'}</button>
              </>
            )}
          </div>
        </div>
        <ConfirmModal
          isOpen={showPendingAssetsConfirm}
          onConfirm={() => { void uploadAssetsAndContinue(); }}
          onCancel={() => {
            if (uploadingFromStepConfirm) return;
            setShowPendingAssetsConfirm(false);
          }}
          title="素材还没有上传"
          message="你当前只是把素材选进了列表，还没有真正上传到云端。现在上传后再继续下一步。"
          confirmButtonText={uploadingFromStepConfirm ? "上传中..." : "上传并继续"}
          cancelButtonText="留在当前页"
        />
        <ConfirmModal
          isOpen={showLeaveConfirm}
          onConfirm={confirmLeaveCurrentPage}
          onCancel={closeLeaveConfirm}
          title="素材未上传"
          message="当前素材只保存在本地，尚未上传素材包。确认离开当前页面吗？"
          confirmButtonText="确认离开"
          cancelButtonText="取消"
        />
        <ConfirmModal
          isOpen={clearFieldTarget !== null}
          onConfirm={clearField}
          onCancel={closeClearFieldConfirm}
          title={clearFieldTarget === 'description' ? '清除当前的文本?' : '清除当前的文本?'}
          message={clearFieldTarget === 'description'
            ? '此操作将清空“提示词 / 角色卡”的当前所有文本'
            : '此操作将清空“开场白 / 首页”中的当前所有文本'}
          confirmButtonText="清除"
          cancelButtonText="取消"
        />
        <PublishSettingsModal
          isOpen={showPublishModal}
          onClose={closePublishModal}
          onPublish={handlePublishGame}
          fileId={publishTargetGameId || undefined}
          publishing={publishing}
        />
      </div>
      <FooterArea />
    </div>
  );
};

export default StGameCreate;
