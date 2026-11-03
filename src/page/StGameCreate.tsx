import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { flattenThemeTags, useLocalizedThemeTags, type FlatThemeTag } from '../utils/themeTags';
import ContentAudienceField from '../components/ContentAudienceField';
import { isValidContentAudience, type ContentAudience } from '../utils/contentAudience';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import PublishSettingsModal, { type PublishSubmitPayload } from '../components/CommonModal/PublishSettingsModal';
import GameAction from '../api/rpgGame/gameAction';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/error';
import { isPublishPendingReview } from '../lib/publishReview';

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
type RequiredFieldKey = 'title' | 'themeTags' | 'audience';
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
const STEP_ITEM_KEYS: StCreateStepKey[] = ['info', 'assets', 'rules'];

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
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const appIdFromQuery = params.get('appId') || '';
  const stepParam = params.get('step');
  const stepKey: StCreateStepKey = isStCreateStepKey(stepParam) ? stepParam : DEFAULT_STEP_KEY;

  const [title, setTitle] = useState('');
  // 功能注释：创建模式复用本机草稿 appId，避免刷新/重挂后 save 再 create-empty 多出一条书架草稿
  const ST_DRAFT_APP_KEY = 'st_draft_appId';
  const [appId, setAppId] = useState(() => {
    if (appIdFromQuery) return '';
    try {
      return localStorage.getItem(ST_DRAFT_APP_KEY) || '';
    } catch {
      return '';
    }
  });
  const [cfg, setCfg] = useState<StConfig>({ ...emptyConfig });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
  const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
  const [themeTagError, setThemeTagError] = useState('');
  const [selectedAudienceType, setSelectedAudienceType] = useState<ContentAudience | null>(null);
  const [audienceError, setAudienceError] = useState('');
  const displayThemeTags = useLocalizedThemeTags(availableThemeTags);
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

  const stepItems = useMemo(
    () => STEP_ITEM_KEYS.map((key) => ({
      key,
      index: STEP_INDEX_MAP[key],
      label: t(`stGameCreate.steps.${key}`),
    })),
    [t],
  );

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
    if (!validateAudienceType()) {
      guideToRequiredField('audience', t('createGame.contentAudienceRequired'));
      return false;
    }
    if (!validateThemeTags()) {
      const message = t('stGameCreate.themeTagsFieldRequired');
      // 功能注释：题材缺失只走 toast + 滚到标签区，不再在下一步按钮上插红色横幅
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
          setSelectedAudienceType(isValidContentAudience(data?.audience_type) ? data.audience_type : null);
          setAudienceError('');
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
        setThemeTagError(t('createGame.themeTagRequired'));
        return prev;
      }
      setThemeTagError('');
      setHighlightField((current) => current === 'themeTags' ? '' : current);
      return [...prev, tagId];
    });
  };

  const handleAudienceTypeChange = (next: ContentAudience) => {
    setSelectedAudienceType(next);
    setAudienceError('');
    setHighlightField((current) => current === 'audience' ? '' : current);
  };

  const validateThemeTags = (): boolean => {
    if (selectedThemeTagIds.length < THEME_TAG_MIN || selectedThemeTagIds.length > THEME_TAG_MAX) {
      setThemeTagError(t('createGame.themeTagRequired'));
      return false;
    }
    setThemeTagError('');
    return true;
  };

  const validateAudienceType = (): boolean => {
    if (!isValidContentAudience(selectedAudienceType)) {
      setAudienceError(t('createGame.contentAudienceRequired'));
      return false;
    }
    setAudienceError('');
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
      toast.error(message);
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
      const message = t('stGameCreate.titleRequired');
      guideToRequiredField('title', message);
      return false;
    }

    if (!validateAudienceType()) {
      const message = t('createGame.contentAudienceRequired');
      guideToRequiredField('audience', message);
      return false;
    }

    if (!validateThemeTags()) {
      const message = t('stGameCreate.themeTagsFieldRequired');
      guideToRequiredField('themeTags', message);
      return false;
    }

    return true;
  };

  const saveConfig = async (): Promise<string> => {
    setError('');
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('stGameCreate.titleRequired'));
      throw new Error(t('stGameCreate.titleRequired'));
    }

    if (!validateAudienceType()) {
      throw new Error(t('createGame.contentAudienceRequired'));
    }

    if (!validateThemeTags()) {
      throw new Error(t('createGame.themeTagRequired'));
    }

    try {
      setSaving(true);
      let id = appIdFromQuery || appId;

      if (!id) {
        const r1 = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim() || t('create.defaultAvgGameTitle'), engine: 'ST' }),
        });
        const j1 = await r1.json();
        id = j1?.appId || j1?.data?.appId;
        if (!id) throw new Error(t('stGameCreate.noAppIdReturned'));
        setAppId(id);
        try {
          localStorage.setItem(ST_DRAFT_APP_KEY, String(id));
        } catch {
          /* ignore */
        }
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
        audienceType: selectedAudienceType || undefined,
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

  const handlePublishGame = async (payload: PublishSubmitPayload) => {
    if (publishing) return;

    const fileId = String(publishTargetGameId || appIdFromQuery || appId || '').trim();
    if (!fileId) {
      toast.error(t('stGameCreate.missingGameIdPublish'));
      return;
    }

    try {
      setPublishing(true);
      const response = await GameAction.publishGame({
        fileId,
        priceAmount: 0,
        description: payload.description,
        shareType: payload.shareType,
        versionNotes: payload.versionNotes,
        notifyFavoritedUsers: payload.notifyFavoritedUsers,
        audienceType: payload.audienceType,
      });

      if (!response.data.success) {
        const errorMessage = response.data.message || t('stGameCreate.publishFailed');
        toast.error(errorMessage);
        return;
      }

      if (isPublishPendingReview(response.data)) {
        toast.success(
          response.data.message?.trim()
          || t('report.publishPendingReviewSuccess'),
        );
      } else {
        toast.success(response.data.message?.trim() || t('createGame.publishSuccess'));
      }

      setShowPublishModal(false);
      nav(`/createGame?mode=stats&gameId=${encodeURIComponent(fileId)}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('stGameCreate.publishFailed')));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar beforeLeaveAction={runBeforeLeaveAction} />
      <div className={styles.main}>
        <div className={styles.headerRow}>
          <h2>{t('stGameCreate.pageTitle')}</h2>
          <nav className={styles.stepper} aria-label={t('stGameCreate.stepperAriaLabel')}>
            {stepItems.map((item, index) => {
              const active = item.key === stepKey;
              return (
                <React.Fragment key={item.key}>
                  <Link
                    to={buildStepHref(item.key)}
                    aria-current={active ? 'step' : undefined}
                    className={`${styles.stepLink} ${active ? styles.stepActive : styles.step}`}
                    onClick={(event) => handleStepLinkClick(event, item.key)}
                  >
                    {/* 功能注释：步号单独缩小，避免与文案同级抢视觉 */}
                    <span className={styles.stepIndex}>{item.index}.</span>
                    <span className={styles.stepLabel}>{item.label}</span>
                  </Link>
                  {index < stepItems.length - 1 ? (
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
          <label>{t('stGameCreate.titleLabel')}</label>
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
          <>
            <div
              className={`${styles.themeTagsPanel} ${highlightField === 'audience' ? styles.requiredHighlight : ''}`}
            >
              <ContentAudienceField
                value={selectedAudienceType}
                onChange={handleAudienceTypeChange}
                required
                error={audienceError}
                disabled={saving || publishing}
              />
            </div>
            <div
              ref={themeTagsPanelRef}
              className={`${styles.themeTagsPanel} ${highlightField === 'themeTags' ? styles.requiredHighlight : ''}`}
            >
              <div className={styles.themeTagsHeader}>
                <span className={styles.themeTagsLabel}>{t('createGame.gameTags')}<span className={styles.requiredMark}>*</span></span>
                <span className={styles.themeTagsHint}>{t('createGame.min1Max2Tags')}</span>
              </div>
              <div className={styles.themeTagsWrap}>
                {displayThemeTags.map((tag) => {
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
          </>
        )}

        {step === 1 && (
          <div className={`${styles.columns} ${styles.stepOneColumns}`}>
            <div className={`${styles.col} ${styles.stepOneCol}`}>
              <div className={`${styles.group} ${styles.stepOneGroup}`}>
                <div className={styles.stepOneGroupHeader}>
                  <div className={`${styles.groupTitle} ${styles.stepOneGroupTitle}`}>{t('stGameCreate.promptCard')}</div>
                  <button
                    type="button"
                    className={styles.clearFieldButton}
                    onClick={() => openClearFieldConfirm('description')}
                    disabled={!descriptionValue}
                  >
                    {t('stGameCreate.clearAll')}
                  </button>
                </div>
                <textarea
                  className={`${styles.area} ${styles.stepOneArea}`}
                  rows={18}
                  placeholder={t('stGameCreate.placeholderDescription')}
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
                  <div className={`${styles.groupTitle} ${styles.stepOneGroupTitle}`}>{t('stGameCreate.openingHome')}</div>
                  <button
                    type="button"
                    className={styles.clearFieldButton}
                    onClick={() => openClearFieldConfirm('firstMes')}
                    disabled={!firstMessageValue}
                  >
                    {t('stGameCreate.clearAll')}
                  </button>
                </div>
                <textarea
                  className={`${styles.area} ${styles.stepOneArea}`}
                  rows={18}
                  placeholder={t('stGameCreate.placeholderFirstMes')}
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
                <div className={styles.groupTitle}>{t('stGameCreate.assetsTitle')}</div>
                <div className={styles.hint}>{t('stGameCreate.assetsHint', { assetPrefix: '{{ASSET_PREFIX}}' })}</div>
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
                <div className={styles.groupTitle}>{t('stGameCreate.worldBook')}</div>
                <div className={styles.hint}>{t('stGameCreate.worldBookHint')}</div>
                {entries.map((e, idx) => (
                  <div
                    key={e.uid || idx}
                    className={styles.ruleItem}
                    draggable
                    onDragStart={(ev) => onDragStartEntry(idx, ev)}
                    onDragOver={(ev) => onDragOverEntry(idx, ev)}
                    onDrop={(ev) => onDropEntry(idx, ev)}
                    title={t('stGameCreate.dragPriority')}
                  >
                    <div className={styles.row2} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>{t('stGameCreate.priority', { index: idx + 1 })}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" aria-label={t('stGameCreate.delete')} title={t('stGameCreate.delete')} onClick={() => { const next = entries.filter((_, i) => i !== idx); updateEntries(next); }} style={{ background: 'transparent', border: 'none', color: '#999', fontSize: 16, lineHeight: '1', cursor: 'pointer', padding: '4px 6px' }}>×</button>
                        <div style={{ cursor: 'grab', userSelect: 'none' }}>☰</div>
                      </div>
                    </div>
                    <div className={styles.row2}>
                      <label>keys</label>
                      <input
                        className={styles.text}
                        placeholder={t('stGameCreate.placeholderWorldBookKeys')}
                        value={(e.keys || []).join(',')}
                        onChange={ev => {
                          const next = [...entries];
                          next[idx] = { ...next[idx], keys: (ev.target.value || '').split(',').map(s => s.trim()).filter(Boolean) };
                          updateEntries(next);
                        }}
                      />
                    </div>
                    <div>
                      <label>{t('stGameCreate.content')}</label>
                      <textarea
                        className={styles.area}
                        rows={3}
                        placeholder={t('stGameCreate.placeholderWorldBookContent')}
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
                  >{t('stGameCreate.addWorldBookEntry')}</button>
                </div>
              </div>
            </div>

            <div className={styles.col}>
              <div className={styles.group}>
                <div className={styles.groupTitle}>{t('stGameCreate.regexScripts')}</div>
                <div className={styles.hint}>{t('stGameCreate.regexScriptsHint')}</div>

                {scripts.map((r, idx) => (
                  <div key={idx} className={styles.ruleItem}>
                    <div className={styles.row2}>
                      <label>{t('stGameCreate.regex')}</label>
                      <input
                        className={styles.text}
                        placeholder={t('stGameCreate.placeholderRegex')}
                        value={r.findRegex || ''}
                        onChange={e => {
                          const next = [...scripts];
                          next[idx] = { ...next[idx], findRegex: e.target.value };
                          updateScripts(next);
                        }}
                      />
                    </div>
                    <div>
                      <label>{t('stGameCreate.replaceContent')}</label>
                      <textarea
                        className={styles.area}
                        rows={4}
                        placeholder={t('stGameCreate.placeholderReplace')}
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
                      >{t('stGameCreate.deleteRule')}</button>
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
                  >{t('stGameCreate.addRule')}</button>
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
            >{t('stGameCreate.nextUploadAssets')}</button>
          ) : step === 2 ? (
            <>
              <button type="button" className={styles.secondary} onClick={() => handleStepNavigation('info')}>{t('stGameCreate.prev')}</button>
              <button type="button" className={styles.primary} onClick={() => handleStepNavigation('rules')}>{t('stGameCreate.nextConfigureRules')}</button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => handleStepNavigation('assets')}
                disabled={saving || publishing}
              >{t('stGameCreate.prev')}</button>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving || publishing}
                onClick={saveToStats}
              >{saving ? t('stGameCreate.saving') : t('common.save')}</button>
              <button
                type="button"
                className={styles.primary}
                disabled={saving || publishing}
                onClick={saveAndTest}
              >{saving ? t('stGameCreate.saving') : t('stGameCreate.test')}</button>
              <button
                type="button"
                className={styles.primary}
                disabled={saving || publishing}
                onClick={saveAndOpenPublish}
              >{saving ? t('stGameCreate.saving') : publishing ? t('stGameCreate.publishing') : t('stGameCreate.publish')}</button>
              <div style={{ display: 'none' }}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => handleStepNavigation('assets')}
              >{t('stGameCreate.prev')}</button>
              <button
                type="button"
                className={styles.secondary}
                disabled={saving || publishing}
                onClick={saveToStats}
              >{t('stGameCreate.done')}</button>
              <button
                className={styles.primary}
                disabled={saving || publishing}
                onClick={saveAndTest}
              >{saving ? t('stGameCreate.creating') : t('stGameCreate.createAndTest')}</button>
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
              >{t('stGameCreate.prev')}</button>
            ) : null}
          </div>
          <div className={styles.actionsRight}>
            {step === 1 ? (
              <button
                type="button"
                className={styles.primary}
                onClick={() => handleStepNavigation('assets')}
              >{t('stGameCreate.nextUploadAssets')}</button>
            ) : step === 2 ? (
              <button
                type="button"
                className={styles.primary}
                onClick={() => handleStepNavigation('rules')}
              >{t('stGameCreate.nextConfigureRules')}</button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || publishing}
                  onClick={saveToStats}
                >{saving ? t('stGameCreate.saving') : t('common.save')}</button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || publishing}
                  onClick={saveAndTest}
                >{saving ? t('stGameCreate.saving') : t('stGameCreate.test')}</button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving || publishing}
                  onClick={saveAndOpenPublish}
                >{saving ? t('stGameCreate.saving') : publishing ? t('stGameCreate.publishing') : t('stGameCreate.publish')}</button>
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
          title={t('stGameCreate.pendingAssetsTitle')}
          message={t('stGameCreate.pendingAssetsMessage')}
          confirmButtonText={uploadingFromStepConfirm ? t('stGameCreate.uploading') : t('stGameCreate.uploadAndContinue')}
          cancelButtonText={t('stGameCreate.stayOnPage')}
        />
        <ConfirmModal
          isOpen={showLeaveConfirm}
          onConfirm={confirmLeaveCurrentPage}
          onCancel={closeLeaveConfirm}
          title={t('stGameCreate.leaveAssetsTitle')}
          message={t('stGameCreate.leaveAssetsMessage')}
          confirmButtonText={t('stGameCreate.confirmLeave')}
          cancelButtonText={t('common.cancel')}
        />
        <ConfirmModal
          isOpen={clearFieldTarget !== null}
          onConfirm={clearField}
          onCancel={closeClearFieldConfirm}
          title={t('stGameCreate.clearTextTitle')}
          message={clearFieldTarget === 'description'
            ? t('stGameCreate.clearDescriptionMessage')
            : t('stGameCreate.clearFirstMesMessage')}
          confirmButtonText={t('stGameCreate.clear')}
          cancelButtonText={t('common.cancel')}
        />
        <PublishSettingsModal
          isOpen={showPublishModal}
          onClose={closePublishModal}
          onPublish={handlePublishGame}
          fileId={publishTargetGameId || undefined}
          publishing={publishing}
          engine="ST"
        />
      </div>
      <FooterArea />
    </div>
  );
};

export default StGameCreate;
