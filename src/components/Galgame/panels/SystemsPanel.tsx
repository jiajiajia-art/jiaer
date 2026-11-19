import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import styles from './SystemsPanel.module.css';
import GameConfirmModal from '../GameConfirmModal';
import {
  GAME_START_LIMITS,
  type GameStartPersonaBlocks,
  type GameStartWorldBookEntry,
  type GameStartWritingStyle,
  type OpeningRouteOption,
  type WritingPace,
} from '../../../lib/galgame/gameStartConfig';
import {
  createEmptyWorldBookEntry,
  morePromptFormsToWorldBookEntries,
  normalizeWorldBookEntry,
  parseWorldBookImportText,
  warehouseWorldBookToEntries,
  WORLD_BOOK_IMPORT_TEMPLATES,
  worldBookEntriesToPanelItems,
} from '../../../lib/galgame/systemWorldBook';
import {
  groupWritingStylePresets,
  toggleWritingStyleId,
  WRITING_PACE_OPTIONS,
  WRITING_STYLE_GROUP_LABELS,
  type WritingStylePresetGroupId,
} from '../../../lib/galgame/writingStylePresets';
import { NPC_PROFILE_FIELD_GENERATION_COST } from '../../../utils/constants';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import {
  formatSessionProfileCharge,
  getSessionProfileBillingPreview,
  resolveSessionProfileBalancePatch,
} from '../../../lib/sessionProfileBilling';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import { sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import {
  warehouseResourcesApi,
  type WarehouseResource,
} from '../../../api/galgame/warehouseResources';

type SystemsView =
  | 'overview'
  | 'worldBook'
  | 'worldBookEdit'
  | 'worldBookImport'
  | 'writingStyle'
  | 'avoidEdit'
  | 'position'
  | 'positionEdit'
  | 'route'
  | 'routeEdit';

export type SystemsConfigPatch = {
  worldBookEntries: GameStartWorldBookEntry[];
  writingStyle: GameStartWritingStyle;
  personaBlocks: GameStartPersonaBlocks;
  openingRouteId?: string;
  openingMonologue?: string;
  retainedStorylineIds?: string[];
};

interface SystemsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  morePromptForms: unknown;
  openingRoutes?: OpeningRouteOption[];
  currentOpeningRouteId?: string;
  initialWorldBookEntries?: GameStartWorldBookEntry[] | null;
  initialWritingStyle?: GameStartWritingStyle | null;
  initialPersonaBlocks?: GameStartPersonaBlocks | null;
  /** 保存世界书 / 文风 / 定位 / 路线到 session */
  onPersistSystemConfig?: (patch: SystemsConfigPatch) => void | Promise<void>;
  routeChangeDisabled?: boolean;
}

const DEFAULT_STYLE: GameStartWritingStyle = {
  toggles: ['vernacular', 'plot_push'],
  pace: 'medium',
  avoidWords: [],
};

/**
 * UE 系统模块：总览 → 世界书 / 文风 / 定位 / 路线。
 * 配色主题红，交互严格对齐流程图。
 */
const SystemsPanel: React.FC<SystemsPanelProps> = ({
  isOpen,
  onClose,
  morePromptForms,
  openingRoutes = [],
  currentOpeningRouteId = '',
  initialWorldBookEntries = null,
  initialWritingStyle = null,
  initialPersonaBlocks = null,
  onPersistSystemConfig,
  routeChangeDisabled = false,
}) => {
  const { t } = useTranslation();
  const seededEntries = useMemo(() => {
    if (Array.isArray(initialWorldBookEntries) && initialWorldBookEntries.length > 0) {
      return initialWorldBookEntries;
    }
    return morePromptFormsToWorldBookEntries(morePromptForms);
  }, [initialWorldBookEntries, morePromptForms]);

  const [view, setView] = useState<SystemsView>('overview');
  const [entries, setEntries] = useState<GameStartWorldBookEntry[]>(seededEntries);
  const [writingStyle, setWritingStyle] = useState<GameStartWritingStyle>(
    () => initialWritingStyle || DEFAULT_STYLE,
  );
  const [personaBlocks, setPersonaBlocks] = useState<GameStartPersonaBlocks>(
    () => initialPersonaBlocks || {},
  );
  const [editingEntry, setEditingEntry] = useState<GameStartWorldBookEntry | null>(null);
  const [importTab, setImportTab] = useState<'paste' | 'upload' | 'template' | 'mine'>('paste');
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [mineWorldBooks, setMineWorldBooks] = useState<WarehouseResource[]>([]);
  const [mineWorldBooksLoading, setMineWorldBooksLoading] = useState(false);
  const [selectedMineWorldBookId, setSelectedMineWorldBookId] = useState<string | null>(null);
  const [avoidDraft, setAvoidDraft] = useState('');
  const [positionDraft, setPositionDraft] = useState({ identity: '', stance: '' });
  const [routeDraftId, setRouteDraftId] = useState(currentOpeningRouteId);
  const [routeMemo, setRouteMemo] = useState('');
  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [positionAiBusy, setPositionAiBusy] = useState<'traits' | null>(null);
  const [positionAiConfirm, setPositionAiConfirm] = useState<'traits' | null>(null);
  const authUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { sessionId } = useGameStore();
  const billingSearch = typeof window === 'undefined' ? '' : window.location.search;
  const textBillingPreview = getSessionProfileBillingPreview(
    billingSearch,
    NPC_PROFILE_FIELD_GENERATION_COST,
  );
  const textChargeText = formatSessionProfileCharge(textBillingPreview);

  useEffect(() => {
    if (!isOpen) {
      setView('overview');
      return;
    }
    setEntries(seededEntries);
    if (initialWritingStyle) setWritingStyle(initialWritingStyle);
    if (initialPersonaBlocks) setPersonaBlocks(initialPersonaBlocks);
    setRouteDraftId(currentOpeningRouteId);
  }, [isOpen, seededEntries, initialWritingStyle, initialPersonaBlocks, currentOpeningRouteId]);

  useEffect(() => {
    if (!isOpen || view !== 'worldBookImport' || importTab !== 'mine') return;
    const token = authUser?.token;
    if (!token) {
      setMineWorldBooks([]);
      return;
    }
    let cancelled = false;
    setMineWorldBooksLoading(true);
    void (async () => {
      try {
        const res = await warehouseResourcesApi.list(token, { type: 'worldbook' });
        if (cancelled) return;
        if (!res?.success) {
          toast.error(res?.message || t('galgameUi.systems.toast.loadWorldBookFailed'));
          setMineWorldBooks([]);
          return;
        }
        const list = Array.isArray(res.data) ? (res.data as WarehouseResource[]) : [];
        setMineWorldBooks(list);
        setSelectedMineWorldBookId((prev) => {
          if (prev && list.some((x) => x.id === prev)) return prev;
          return list[0]?.id || null;
        });
      } catch (e) {
        if (!cancelled) {
          toast.error((e as Error)?.message || t('galgameUi.systems.toast.loadWorldBookFailed'));
          setMineWorldBooks([]);
        }
      } finally {
        if (!cancelled) setMineWorldBooksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, view, importTab, authUser?.token]);

  const panelItems = useMemo(() => worldBookEntriesToPanelItems(entries), [entries]);
  const presetGroups = useMemo(() => groupWritingStylePresets(), []);
  const currentRoute = openingRoutes.find((r) => r.id === currentOpeningRouteId);
  const pendingRoute = openingRoutes.find((r) => r.id === pendingRouteId);

  const persist = async (patch: Partial<SystemsConfigPatch> & {
    worldBookEntries?: GameStartWorldBookEntry[];
    writingStyle?: GameStartWritingStyle;
    personaBlocks?: GameStartPersonaBlocks;
  }) => {
    if (!onPersistSystemConfig) {
      toast.error(t('galgameUi.systems.toast.cannotSaveServer'));
      return false;
    }
    setSaving(true);
    try {
      await onPersistSystemConfig({
        worldBookEntries: patch.worldBookEntries ?? entries,
        writingStyle: patch.writingStyle ?? writingStyle,
        personaBlocks: patch.personaBlocks ?? personaBlocks,
        openingRouteId: patch.openingRouteId,
        openingMonologue: patch.openingMonologue,
        retainedStorylineIds: patch.retainedStorylineIds,
      });
      return true;
    } catch (e) {
      console.error(e);
      toast.error((e as Error)?.message || t('galgameUi.common.saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setView('overview');
    onClose();
  };

  const backFromSub = () => {
    if (view === 'worldBookEdit' || view === 'worldBookImport') {
      setView('worldBook');
      setEditingEntry(null);
      return;
    }
    if (view === 'avoidEdit') {
      setView('writingStyle');
      return;
    }
    if (view === 'positionEdit') {
      setView('position');
      return;
    }
    if (view === 'routeEdit') {
      setView('route');
      return;
    }
    setView('overview');
  };

  const openEditEntry = (entry?: GameStartWorldBookEntry) => {
    setEditingEntry(entry ? { ...entry, keywords: [...(entry.keywords || [])] } : createEmptyWorldBookEntry());
    setView('worldBookEdit');
  };

  const saveEntry = async () => {
    if (!editingEntry) return;
    const keywordsText = (editingEntry.keywords || []).join('，');
    const checked = normalizeWorldBookEntry({
      ...editingEntry,
      keywords: keywordsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    });
    if (!checked.ok) {
      toast.error(checked.message || t('galgameUi.common.invalidEntry'));
      return;
    }
    const next = [...entries];
    const idx = next.findIndex((e) => e.id === checked.entry.id);
    if (idx >= 0) next[idx] = checked.entry;
    else next.push(checked.entry);
    setEntries(next);
    const ok = await persist({ worldBookEntries: next });
    if (ok) {
      toast.success(t('galgameUi.systems.toast.worldBookSaved'));
      setEditingEntry(null);
      setView('worldBook');
    }
  };

  const toggleEntryEnabled = async (id: string, enabled: boolean) => {
    const next = entries.map((e) => (e.id === id ? { ...e, enabled } : e));
    setEntries(next);
    const ok = await persist({ worldBookEntries: next });
    if (!ok) setEntries(entries);
  };

  const confirmImport = async () => {
    let incoming: GameStartWorldBookEntry[] = [];
    if (importTab === 'template') {
      const tpl = WORLD_BOOK_IMPORT_TEMPLATES.find((x) => x.id === selectedTemplateId);
      if (!tpl) {
        toast.error(t('galgameUi.systems.toast.selectTemplate'));
        return;
      }
      incoming = tpl.entries.map((e) => ({
        ...e,
        id: `${e.id}_${Date.now().toString(36)}`,
      }));
    } else if (importTab === 'mine') {
      const book = mineWorldBooks.find((x) => x.id === selectedMineWorldBookId);
      if (!book) {
        toast.error(t('galgameUi.systems.toast.selectMyWorldBook'));
        return;
      }
      const parsed = warehouseWorldBookToEntries(book);
      if (!parsed.ok) {
        toast.error(parsed.message || t('galgameUi.common.importFailed'));
        return;
      }
      incoming = parsed.entries;
    } else {
      const parsed = parseWorldBookImportText(importText);
      if (!parsed.ok) {
        toast.error(parsed.message || t('galgameUi.common.importFailed'));
        return;
      }
      incoming = parsed.entries;
    }
    const next = [...entries, ...incoming];
    setEntries(next);
    const ok = await persist({ worldBookEntries: next });
    if (ok) {
      toast.success(t('galgameUi.systems.toast.importedCount', { count: incoming.length }));
      setImportText('');
      setImportFileName('');
      setSelectedTemplateId(null);
      setSelectedMineWorldBookId(null);
      setView('worldBook');
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    try {
      const text = await file.text();
      setImportText(text);
      setImportTab('paste');
      toast.success(t('galgameUi.systems.toast.fileReadConfirmImport'));
    } catch {
      toast.error(t('galgameUi.systems.toast.readFileFailed'));
    }
  };

  const setToggle = async (id: string, on: boolean) => {
    const next = {
      ...writingStyle,
      toggles: toggleWritingStyleId(writingStyle.toggles, id, on),
    };
    setWritingStyle(next);
    const ok = await persist({ writingStyle: next });
    if (!ok) setWritingStyle(writingStyle);
  };

  const setPace = async (pace: WritingPace) => {
    const next = { ...writingStyle, pace };
    setWritingStyle(next);
    const ok = await persist({ writingStyle: next });
    if (!ok) setWritingStyle(writingStyle);
  };

  const addAvoidWord = () => {
    const w = avoidDraft.trim().slice(0, GAME_START_LIMITS.avoidWordMax);
    if (!w) {
      toast.error(t('galgameUi.systems.toast.enterAvoidWord'));
      return;
    }
    if (writingStyle.avoidWords.includes(w)) {
      toast.error(t('galgameUi.common.alreadyExists'));
      return;
    }
    if (writingStyle.avoidWords.length >= GAME_START_LIMITS.avoidWordsMax) {
      toast.error(t('galgameUi.common.maxCount', { max: GAME_START_LIMITS.avoidWordsMax }));
      return;
    }
    setWritingStyle((s) => ({ ...s, avoidWords: [...s.avoidWords, w] }));
    setAvoidDraft('');
  };

  const removeAvoidWord = (word: string) => {
    setWritingStyle((s) => ({
      ...s,
      avoidWords: s.avoidWords.filter((w) => w !== word),
    }));
  };

  const finishAvoidEdit = async () => {
    const ok = await persist({ writingStyle });
    if (ok) {
      toast.success(t('galgameUi.systems.toast.avoidWordsUpdated'));
      setView('writingStyle');
    }
  };

  const savePosition = async () => {
    // 功能注释：秘密由创作者设定且不对玩家回传；保存时保留局内已有 secret，禁止被空草稿清空
    const next: GameStartPersonaBlocks = {
      ...personaBlocks,
      identity: positionDraft.identity.trim() || undefined,
      traits: positionDraft.stance.trim() || undefined,
      secret: personaBlocks.secret,
    };
    setPersonaBlocks(next);
    const ok = await persist({ personaBlocks: next });
    if (ok) {
      toast.success(t('galgameUi.systems.toast.positionSaved'));
      setView('position');
    }
  };

  const POSITION_AI_LABEL = { traits: t('galgameUi.systems.form.traits') } as const;

  const requestPositionAi = async (field: 'traits') => {
    if (!authUser?.token || !sessionId) {
      toast.error(t('galgameUi.common.loginAndEnterSession'));
      return;
    }
    if (positionAiBusy || saving) return;
    if (textBillingPreview.currency === 'points') {
      const latestPoints = await refreshAuthUserPoints();
      if (
        typeof latestPoints === 'number'
        && latestPoints < textBillingPreview.chargedUnits
      ) {
        toast.error(
          t('galgameUi.currency.insufficientDreamBeans', { need: textBillingPreview.chargedUnits, current: latestPoints }),
        );
        return;
      }
    }
    setPositionAiConfirm(field);
  };

  const runPositionAi = async () => {
    const field = positionAiConfirm;
    setPositionAiConfirm(null);
    const token = authUser?.token;
    if (!field || !token || !sessionId || positionAiBusy) return;
    setPositionAiBusy(field);
    try {
      const res = await sessionPlayerProfileApi.generatePlayerPositioningField(token, sessionId, {
        field,
        draft: {
          identity: positionDraft.identity,
          traits: positionDraft.stance,
        },
      });
      if (!res?.success || !res.data?.text) {
        toast.error(res?.message || t('galgameUi.common.generateFailed'));
        return;
      }
      const text = String(res.data.text);
      if (field === 'traits') {
        setPositionDraft((d) => ({ ...d, stance: text.slice(0, 200) }));
      }
      const balancePatch = resolveSessionProfileBalancePatch(res.data.billing);
      if (balancePatch) {
        updateUser(balancePatch);
      } else if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(
        t('galgameUi.systems.toast.positionGenerated', { field: POSITION_AI_LABEL[field], billing: res.data.billing
          ? formatSessionProfileCharge(res.data.billing)
          : textChargeText }),
      );
    } catch (e) {
      toast.error((e as Error)?.message || t('galgameUi.common.generateFailed'));
    } finally {
      setPositionAiBusy(null);
    }
  };

  const confirmRouteChange = async () => {
    if (!pendingRouteId) return;
    const selected = openingRoutes.find((r) => r.id === pendingRouteId);
    if (!selected) {
      setPendingRouteId(null);
      return;
    }
    const retained = openingRoutes.map((r) => r.id).filter((id) => id && id !== pendingRouteId);
    const ok = await persist({
      openingRouteId: pendingRouteId,
      openingMonologue: selected.openingMonologue || routeMemo.trim() || undefined,
      retainedStorylineIds: retained,
    });
    if (ok) {
      toast.success(t('galgameUi.route.switchedToast', { title: selected.title }));
      setPendingRouteId(null);
      setView('route');
    }
  };

  const shellTitle = (() => {
    switch (view) {
      case 'worldBook':
        return t('galgameUi.systems.nav.worldBook');
      case 'worldBookEdit':
        return editingEntry && entries.some((e) => e.id === editingEntry.id) ? t('galgameUi.systems.nav.editEntry') : t('galgameUi.systems.nav.newEntry');
      case 'worldBookImport':
        return t('galgameUi.systems.nav.importWorldBook');
      case 'writingStyle':
        return t('galgameUi.systems.nav.writingStyle');
      case 'avoidEdit':
        return t('galgameUi.systems.nav.avoidWords');
      case 'position':
      case 'positionEdit':
        return t('galgameUi.systems.nav.position');
      case 'route':
      case 'routeEdit':
        return t('galgameUi.route.currentSection');
      default:
        return t('galgame.panelSystemsTitle');
    }
  })();

  const shellSubtitle = (() => {
    if (view === 'overview') return t('galgame.panelSystemsSubtitle');
    if (view === 'worldBook') return t('galgameUi.systems.nav.worldBookDesc');
    if (view === 'worldBookImport') return t('galgameUi.systems.nav.importWorldBookHint');
    if (view === 'writingStyle') return t('galgameUi.systems.nav.writingStyleHint');
    if (view === 'avoidEdit') return t('galgameUi.systems.nav.avoidEditHint');
    if (view === 'position') return t('galgameUi.systems.nav.positionDesc');
    if (view === 'positionEdit') return t('galgameUi.systems.nav.positionEditHint');
    if (view === 'route') return t('galgameUi.route.currentHint');
    return undefined;
  })();

  const headerRight =
    view === 'worldBook' ? (
      <div className={styles.headerActions}>
        <button
          type="button"
          className={shell.ghostButton}
          onClick={() => {
            setImportTab('mine');
            setImportText('');
            setSelectedMineWorldBookId(null);
            setView('worldBookImport');
          }}
        >
          {t('galgameUi.systems.actions.importWorldBook')}
        </button>
        <button type="button" className={shell.primaryButton} onClick={() => openEditEntry()}>
          {t('galgameUi.systems.actions.addEntry')}
        </button>
      </div>
    ) : view === 'writingStyle' ? (
      <div className={styles.headerActions}>
        <button type="button" className={shell.ghostButton} onClick={() => setView('avoidEdit')}>
          {t('galgameUi.systems.actions.editAvoidWords')}
        </button>
      </div>
    ) : null;

  const keywordsJoined = (editingEntry?.keywords || []).join('，');

  return (
    <>
      <PlayPanelShell
        isOpen={isOpen}
        title={shellTitle}
        subtitle={shellSubtitle}
        onClose={handleClose}
        showBack={view === 'overview'}
        onHeaderBack={view === 'overview' ? undefined : backFromSub}
        headerRight={headerRight}
        hideHeader={false}
      >
        {view === 'overview' ? (
          <div className={styles.overviewList}>
            {[
              { id: 'worldBook' as const, icon: '書', title: t('galgameUi.systems.nav.worldBook'), desc: t('galgameUi.systems.nav.worldBookDesc') },
              { id: 'writingStyle' as const, icon: '风', title: t('galgameUi.systems.nav.writingStyle'), desc: t('galgameUi.systems.nav.writingStyleDesc') },
              { id: 'position' as const, icon: '位', title: t('galgameUi.systems.nav.position'), desc: t('galgameUi.systems.nav.positionDesc') },
              { id: 'route' as const, icon: '线', title: t('galgameUi.route.currentSection'), desc: t('galgameUi.route.progressDesc') },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.overviewCard}
                onClick={() => setView(item.id)}
              >
                <span className={styles.overviewIcon} aria-hidden>{item.icon}</span>
                <span className={styles.overviewText}>
                  <h3 className={styles.overviewTitle}>{item.title}</h3>
                  <p className={styles.overviewDesc}>{item.desc}</p>
                </span>
                <span className={styles.chevron} aria-hidden>›</span>
              </button>
            ))}
          </div>
        ) : null}

        {view === 'worldBook' ? (
          panelItems.length === 0 ? (
            <div className={shell.empty}>{t('galgameUi.systems.actions.emptyWorldBook')}</div>
          ) : (
            panelItems.map((item) => (
              <article key={item.id} className={styles.wbCard}>
                <div className={styles.wbMain}>
                  <h3 className={styles.wbTitle}>{item.name}</h3>
                  {item.summary ? <p className={styles.wbBody}>{item.summary}</p> : null}
                  <p className={styles.wbMeta}>
                    {t('galgameUi.systems.actions.keywordsPrefix')}{item.keywords.length ? item.keywords.join('、') : t('galgameUi.common.none')}
                    {item.constant ? ` ${t('galgameUi.common.constantTrigger')}` : ''}
                  </p>
                </div>
                <div className={styles.wbSide}>
                  <span className={styles.badge}>{t('galgameUi.systems.actions.loaded')}</span>
                  <div className={styles.toggleRow}>
                    <span>{item.enabled ? t('galgameUi.common.enabled') : t('galgameUi.common.disabled')}</span>
                    <button
                      type="button"
                      className={`${styles.switch} ${item.enabled ? styles.switchOn : ''}`}
                      aria-pressed={item.enabled}
                      disabled={saving}
                      onClick={() => void toggleEntryEnabled(item.id, !item.enabled)}
                    >
                      <span className={styles.switchKnob} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => {
                      const entry = entries.find((e) => e.id === item.id);
                      if (entry) openEditEntry(entry);
                    }}
                  >
                    编辑
                  </button>
                </div>
              </article>
            ))
          )
        ) : null}

        {view === 'worldBookEdit' && editingEntry ? (
          <div className={styles.form}>
            <label className={styles.field}>
              <span className={styles.labelRow}>{t('galgameUi.systems.form.title')}</span>
              <input
                value={editingEntry.title}
                maxLength={40}
                placeholder={t('galgameUi.systems.form.entryTitlePlaceholder')}
                onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.labelRow}>{t('galgameUi.systems.form.content')}</span>
              <textarea
                rows={6}
                value={editingEntry.content}
                placeholder={t('galgameUi.systems.form.entryContentPlaceholder')}
                onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.labelRow}>
                {t('galgameUi.systems.form.triggerKeywords')}
                <span className={styles.counter}>{keywordsJoined.length}/100</span>
              </span>
              <input
                value={keywordsJoined}
                maxLength={100}
                placeholder={t('galgameUi.systems.form.keywordsPlaceholder')}
                onChange={(e) =>
                  setEditingEntry({
                    ...editingEntry,
                    keywords: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </label>
            <div className={styles.field}>
              <span className={styles.labelRow}>{t('galgameUi.systems.form.constant')}</span>
              <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={`${styles.switch} ${editingEntry.constant ? styles.switchOn : ''}`}
                  aria-pressed={Boolean(editingEntry.constant)}
                  onClick={() =>
                    setEditingEntry({ ...editingEntry, constant: !editingEntry.constant })
                  }
                >
                  <span className={styles.switchKnob} />
                </button>
                <span>{editingEntry.constant ? t('galgameUi.common.constantTrigger') : t('galgameUi.common.keywordTrigger')}</span>
              </div>
            </div>
            <div className={styles.field}>
              <span className={styles.labelRow}>{t('galgameUi.systems.form.status')}</span>
              <div className={styles.statusChips}>
                <button
                  type="button"
                  className={`${styles.statusChip} ${editingEntry.enabled !== false ? styles.statusChipActive : ''}`}
                  onClick={() => setEditingEntry({ ...editingEntry, enabled: true })}
                >
                  {t('galgameUi.common.enabled')}
                </button>
                <button
                  type="button"
                  className={`${styles.statusChip} ${editingEntry.enabled === false ? styles.statusChipActive : ''}`}
                  onClick={() => setEditingEntry({ ...editingEntry, enabled: false })}
                >
                  {t('galgameUi.common.disabled')}
                </button>
              </div>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={saving}
                onClick={() => {
                  setEditingEntry(null);
                  setView('worldBook');
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void saveEntry()}
              >
                {saving ? t('createGame.saving') : t('common.save')}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'worldBookImport' ? (
          <div className={styles.form}>
            <div className={styles.importTabs} role="tablist">
              {(
                [
                  { id: 'mine' as const, label: t('galgameUi.systems.form.tabMine') },
                  { id: 'paste' as const, label: t('galgameUi.systems.form.tabPaste') },
                  { id: 'upload' as const, label: t('galgameUi.systems.form.tabUpload') },
                  { id: 'template' as const, label: t('galgameUi.systems.form.tabTemplate') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={importTab === tab.id}
                  className={`${styles.importTab} ${importTab === tab.id ? styles.importTabActive : ''}`}
                  onClick={() => setImportTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {importTab === 'mine' ? (
              <div className={styles.mineList}>
                {mineWorldBooksLoading ? (
                  <div className={shell.empty}>{t('galgameUi.systems.form.loadingMyWorldBook')}</div>
                ) : mineWorldBooks.length === 0 ? (
                  <div className={shell.empty}>
                    {t('galgameUi.systems.form.noWorldBookInWarehouse')}
                  </div>
                ) : (
                  mineWorldBooks.map((book) => {
                    const entryCount = Array.isArray(
                      (book.payload as { entries?: unknown[] } | undefined)?.entries,
                    )
                      ? (book.payload as { entries: unknown[] }).entries.length
                      : 0;
                    const selected = selectedMineWorldBookId === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        className={`${styles.templateRow} ${selected ? styles.templateRowSelected : ''}`}
                        onClick={() => setSelectedMineWorldBookId(book.id)}
                      >
                        <div className={styles.templateBody}>
                          <p className={styles.templateName}>{book.title || t('galgameUi.common.unnamedWorldBook')}</p>
                          <p className={styles.templateDesc}>
                            {(book.description || '').trim() || t('galgameUi.common.entrySettingsCount', { count: entryCount })}
                            {book.enabled === false ? t('galgameUi.common.disabledBadge') : ''}
                            {entryCount > 0 ? t('galgameUi.common.entryCountBadge', { count: entryCount }) : ''}
                          </p>
                        </div>
                        <span className={styles.badge}>{selected ? t('galgameUi.common.selected') : t('galgameUi.common.select')}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}

            {importTab === 'paste' ? (
              <label className={styles.field}>
                <span className={styles.labelRow}>{t('galgameUi.systems.form.pasteWorldBookLabel')}</span>
                <textarea
                  className={styles.pasteArea}
                  rows={8}
                  value={importText}
                  placeholder={t('galgameUi.systems.form.pasteWorldBookPlaceholder')}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </label>
            ) : null}

            {importTab === 'upload' ? (
              <label className={styles.uploadBox}>
                <input
                  type="file"
                  accept=".json,application/json,text/plain"
                  onChange={(e) => void onPickFile(e.target.files?.[0] || null)}
                />
                <span>点击选择 .json / 文本文件</span>
                <span>{importFileName || t('galgameUi.systems.form.pickFileHint')}</span>
              </label>
            ) : null}

            {importTab === 'template' ? (
              <div className={styles.form}>
                {WORLD_BOOK_IMPORT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`${styles.templateRow} ${selectedTemplateId === tpl.id ? styles.templateRowSelected : ''}`}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                  >
                    <div className={styles.templateBody}>
                      <p className={styles.templateName}>{tpl.name}</p>
                      <p className={styles.templateDesc}>
                        {tpl.description} · {tpl.entries.length} 条
                      </p>
                    </div>
                    <span className={styles.badge}>
                      {selectedTemplateId === tpl.id ? t('galgameUi.common.selected') : t('galgameUi.common.select')}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={saving}
                onClick={() => setView('worldBook')}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void confirmImport()}
              >
                {saving ? t('galgameUi.common.importing') : t('galgameUi.common.importConfirm')}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'writingStyle' ? (
          <div>
            {(Object.keys(presetGroups) as WritingStylePresetGroupId[]).map((groupId) => (
              <section key={groupId} className={styles.sectionBlock}>
                <h4 className={styles.sectionTitle}>{WRITING_STYLE_GROUP_LABELS[groupId]}</h4>
                {presetGroups[groupId].map((preset) => {
                  const on = writingStyle.toggles.includes(preset.id);
                  return (
                    <div key={preset.id} className={styles.presetRow}>
                      <div>
                        <div className={styles.presetLabel}>{preset.label}</div>
                        {preset.hint ? <p className={styles.presetHint}>{preset.hint}</p> : null}
                      </div>
                      <button
                        type="button"
                        className={`${styles.switch} ${on ? styles.switchOn : ''}`}
                        aria-pressed={on}
                        disabled={saving}
                        onClick={() => void setToggle(preset.id, !on)}
                      >
                        <span className={styles.switchKnob} />
                      </button>
                    </div>
                  );
                })}
              </section>
            ))}

            <section className={styles.sectionBlock}>
              <h4 className={styles.sectionTitle}>{t('galgameUi.systems.form.pace')}</h4>
              <div className={styles.paceRow}>
                {WRITING_PACE_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.statusChip} ${writingStyle.pace === p.id ? styles.statusChipActive : ''}`}
                    disabled={saving}
                    onClick={() => void setPace(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.sectionBlock}>
              <div className={styles.presetRow} style={{ borderBottom: 'none', paddingTop: 0 }}>
                <h4 className={styles.sectionTitle}>{t('galgameUi.systems.form.avoidWordsSection')}</h4>
                <div className={styles.headerActions}>
                  <button type="button" className={styles.editBtn} onClick={() => setView('avoidEdit')}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => {
                      setAvoidDraft('');
                      setView('avoidEdit');
                    }}
                  >
                    添加
                  </button>
                </div>
              </div>
              {writingStyle.avoidWords.length === 0 ? (
                <p className={styles.infoHint}>{t('galgameUi.systems.form.noAvoidWords')}</p>
              ) : (
                <div className={styles.tagCloud}>
                  {writingStyle.avoidWords.map((w) => (
                    <span key={w} className={styles.tag}>
                      {w}
                      <button
                        type="button"
                        className={styles.tagX}
                        aria-label={t('galgameUi.common.deleteAria', { word: w })}
                        onClick={() => {
                          const next = {
                            ...writingStyle,
                            avoidWords: writingStyle.avoidWords.filter((x) => x !== w),
                          };
                          setWritingStyle(next);
                          void persist({ writingStyle: next });
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className={styles.infoHint}>
                出现避雷词时会改用符合身份与语境的自然说法，不会用 ×× / 空格占位。角色改名后的旧名会自动按现用名称呼，不必再手动加入避雷词库。
              </p>
            </section>
          </div>
        ) : null}

        {view === 'avoidEdit' ? (
          <div className={styles.form}>
            <p className={styles.infoHint}>
              叙事会用自然替代表述避开这些词；禁止用 ××、xx 或无意义空格代替。
            </p>
            <div className={styles.field}>
              <span className={styles.labelRow}>{t('galgameUi.systems.form.addAvoidWord')}</span>
              <div className={styles.paceRow}>
                <input
                  value={avoidDraft}
                  maxLength={GAME_START_LIMITS.avoidWordMax}
                  placeholder={t('galgameUi.systems.form.avoidWordPlaceholder')}
                  onChange={(e) => setAvoidDraft(e.target.value)}
                />
                <button type="button" className={styles.editBtn} onClick={addAvoidWord}>
                  添加
                </button>
              </div>
            </div>
            <div className={styles.avoidEditList}>
              {writingStyle.avoidWords.length === 0 ? (
                <div className={shell.empty}>{t('galgameUi.systems.form.avoidEmpty')}</div>
              ) : (
                writingStyle.avoidWords.map((w) => (
                  <div key={w} className={styles.avoidEditRow}>
                    <span className={styles.avoidEditText}>{w}</span>
                    <button type="button" className={styles.tagX} onClick={() => removeAvoidWord(w)}>
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void finishAvoidEdit()}
              >
                {saving ? t('createGame.saving') : t('galgameUi.common.done')}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'position' ? (
          <div className={styles.form}>
            <div className={styles.positionCard}>
              <div className={styles.positionRow}>
                <span className={styles.positionKey}>{t('galgameUi.systems.form.identity')}</span>
                <div className={styles.positionVal}>{personaBlocks.identity || t('galgameUi.common.notSet')}</div>
              </div>
              <div className={styles.positionRow}>
                <span className={styles.positionKey}>{t('galgameUi.systems.form.traits')}</span>
                <div className={styles.positionVal}>{personaBlocks.traits || t('galgameUi.common.notSet')}</div>
              </div>
            </div>
            <p className={styles.infoHint}>
              「秘密」由创作者在创作台「玩家目前定位」中填写，局内不对玩家展示；叙事仍会遵守该秘密。NPC 默认不知情。
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setPositionDraft({
                  identity: personaBlocks.identity || '',
                  stance: personaBlocks.traits || '',
                });
                setView('positionEdit');
              }}
            >
              {t('galgameUi.systems.actions.editPosition')}
            </button>
          </div>
        ) : null}

        {view === 'positionEdit' ? (
          <div className={styles.form}>
            <label className={styles.field}>
              <span className={styles.labelRow}>{t('galgameUi.systems.form.identity')}</span>
              <input
                value={positionDraft.identity}
                maxLength={80}
                placeholder={t('galgameUi.systems.form.identityPlaceholder')}
                onChange={(e) => setPositionDraft((d) => ({ ...d, identity: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <div className={styles.labelWithAi}>
                <span className={styles.labelRow}>{t('galgameUi.systems.form.traits')}</span>
                <button
                  type="button"
                  className={styles.fieldAiBtn}
                  disabled={saving || Boolean(positionAiBusy)}
                  onClick={() => {
                    void requestPositionAi('traits');
                  }}
                >
                  {positionAiBusy === 'traits'
                    ? t('galgameUi.common.generating')
                    : t('galgameUi.common.aiGenerate', { charge: textChargeText })}
                </button>
              </div>
              <textarea
                rows={3}
                value={positionDraft.stance}
                maxLength={200}
                placeholder={t('galgameUi.systems.form.traitsPlaceholder')}
                disabled={positionAiBusy === 'traits'}
                onChange={(e) => setPositionDraft((d) => ({ ...d, stance: e.target.value }))}
              />
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={saving || Boolean(positionAiBusy)}
                onClick={() => setView('position')}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving || Boolean(positionAiBusy)}
                onClick={() => void savePosition()}
              >
                {saving ? t('createGame.saving') : t('common.save')}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'route' ? (
          <div className={styles.form}>
            <div className={styles.positionCard}>
              <div className={styles.positionRow}>
                <span className={styles.positionKey}>当前路线</span>
                <div className={styles.positionVal}>{currentRoute?.title || t('galgameUi.common.noRouteSelected')}</div>
              </div>
              {currentRoute?.summary ? (
                <div className={styles.positionRow}>
                  <span className={styles.positionKey}>阶段说明</span>
                  <div className={styles.positionVal}>{currentRoute.summary}</div>
                </div>
              ) : null}
            </div>
            <h4 className={styles.sectionTitle}>可选路线</h4>
            <div className={shell.routeList}>
              {openingRoutes.map((route) => {
                const active = route.id === currentOpeningRouteId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    className={`${shell.routeChip} ${active ? shell.routeChipActive : ''}`}
                    disabled
                  >
                    <span className={shell.routeChipTitle}>
                      {active ? '● ' : '○ '}
                      {route.title}
                    </span>
                    {route.summary ? (
                      <span className={shell.routeChipSummary}>{route.summary}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={routeChangeDisabled || openingRoutes.length === 0}
              onClick={() => {
                setRouteDraftId(currentOpeningRouteId);
                setRouteMemo('');
                setView('routeEdit');
              }}
            >
              {t('galgameUi.systems.actions.changeRoute')}
            </button>
          </div>
        ) : null}

        {view === 'routeEdit' ? (
          <div className={styles.form}>
            <div className={shell.routeList}>
              {openingRoutes.map((route) => {
                const active = route.id === routeDraftId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    className={`${shell.routeChip} ${active ? shell.routeChipActive : ''}`}
                    onClick={() => setRouteDraftId(route.id)}
                  >
                    <span className={shell.routeChipTitle}>
                      {active ? '● ' : '○ '}
                      {route.title}
                    </span>
                    {route.summary ? (
                      <span className={shell.routeChipSummary}>{route.summary}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <label className={styles.field}>
              <span className={styles.labelRow}>
                路线备注（选填）
                <span className={styles.counter}>{routeMemo.length}/200</span>
              </span>
              <textarea
                rows={3}
                maxLength={200}
                value={routeMemo}
                placeholder={t('galgameUi.route.routeRemarkPlaceholder')}
                onChange={(e) => setRouteMemo(e.target.value)}
              />
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setView('route')}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={routeChangeDisabled || !routeDraftId || routeDraftId === currentOpeningRouteId}
                onClick={() => setPendingRouteId(routeDraftId)}
              >
                确认更换
              </button>
            </div>
          </div>
        ) : null}
      </PlayPanelShell>

      <GameConfirmModal
        isOpen={Boolean(positionAiConfirm)}
        variant="dossier"
        title={t('galgameUi.systems.toast.confirmGeneratePositionTitle', { field: positionAiConfirm ? POSITION_AI_LABEL[positionAiConfirm] : '' })}
        message={t('galgameUi.systems.toast.confirmGeneratePositionMessage', { charge: textChargeText, field: positionAiConfirm ? POSITION_AI_LABEL[positionAiConfirm] : '' })}
        confirmText={t('galgameUi.common.confirmGenerate')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void runPositionAi();
        }}
        onCancel={() => setPositionAiConfirm(null)}
      />
      <GameConfirmModal
        isOpen={Boolean(pendingRouteId)}
        title={t('galgameUi.route.confirmSwitchTitle')}
        message={
          pendingRoute
            ? `${t('galgameUi.route.changeMessage')}\n「${pendingRoute.title}」`
            : t('galgameUi.route.changeMessage')
        }
        confirmText={saving ? t('galgameUi.common.changingRoute') : t('galgameUi.common.confirmChangeRoute')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void confirmRouteChange();
        }}
        onCancel={() => {
          if (!saving) setPendingRouteId(null);
        }}
      />
    </>
  );
};

export default SystemsPanel;
