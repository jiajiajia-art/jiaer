import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PlayPanelShell from './PlayPanelShell';
import shell from './PlayPanelShell.module.css';
import styles from './SystemsPanel.module.css';
import GameConfirmModal from '../GameConfirmModal';
import {
  GAME_START_LIMITS,
  GAME_START_UE_COPY,
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
  const [importTab, setImportTab] = useState<'paste' | 'upload' | 'template'>('paste');
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [avoidDraft, setAvoidDraft] = useState('');
  const [positionDraft, setPositionDraft] = useState({ identity: '', stance: '' });
  const [routeDraftId, setRouteDraftId] = useState(currentOpeningRouteId);
  const [routeMemo, setRouteMemo] = useState('');
  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      toast.error('当前无法保存到服务器');
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
      toast.error((e as Error)?.message || '保存失败');
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
      toast.error(checked.message || '条目无效');
      return;
    }
    const next = [...entries];
    const idx = next.findIndex((e) => e.id === checked.entry.id);
    if (idx >= 0) next[idx] = checked.entry;
    else next.push(checked.entry);
    setEntries(next);
    const ok = await persist({ worldBookEntries: next });
    if (ok) {
      toast.success('世界书已保存');
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
        toast.error('请选择模板');
        return;
      }
      incoming = tpl.entries.map((e) => ({
        ...e,
        id: `${e.id}_${Date.now().toString(36)}`,
      }));
    } else {
      const parsed = parseWorldBookImportText(importText);
      if (!parsed.ok) {
        toast.error(parsed.message || '导入失败');
        return;
      }
      incoming = parsed.entries;
    }
    const next = [...entries, ...incoming];
    setEntries(next);
    const ok = await persist({ worldBookEntries: next });
    if (ok) {
      toast.success(`已导入 ${incoming.length} 条`);
      setImportText('');
      setImportFileName('');
      setSelectedTemplateId(null);
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
      toast.success('文件已读入，请确认后导入');
    } catch {
      toast.error('读取文件失败');
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
      toast.error('请输入避雷词');
      return;
    }
    if (writingStyle.avoidWords.includes(w)) {
      toast.error('已存在');
      return;
    }
    if (writingStyle.avoidWords.length >= GAME_START_LIMITS.avoidWordsMax) {
      toast.error(`最多 ${GAME_START_LIMITS.avoidWordsMax} 个`);
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
      toast.success('避雷词库已更新');
      setView('writingStyle');
    }
  };

  const savePosition = async () => {
    const next: GameStartPersonaBlocks = {
      ...personaBlocks,
      identity: positionDraft.identity.trim() || undefined,
      traits: positionDraft.stance.trim() || undefined,
    };
    setPersonaBlocks(next);
    const ok = await persist({ personaBlocks: next });
    if (ok) {
      toast.success('定位已保存');
      setView('position');
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
      toast.success(`已切换路线：${selected.title}`);
      setPendingRouteId(null);
      setView('route');
    }
  };

  const shellTitle = (() => {
    switch (view) {
      case 'worldBook':
        return '世界书';
      case 'worldBookEdit':
        return editingEntry && entries.some((e) => e.id === editingEntry.id) ? '编辑条目' : '新增条目';
      case 'worldBookImport':
        return '导入世界书';
      case 'writingStyle':
        return '文风设定';
      case 'avoidEdit':
        return '避雷词库';
      case 'position':
      case 'positionEdit':
        return '玩家目前定位';
      case 'route':
      case 'routeEdit':
        return GAME_START_UE_COPY.currentRouteSection;
      default:
        return t('galgame.panelSystemsTitle');
    }
  })();

  const shellSubtitle = (() => {
    if (view === 'overview') return t('galgame.panelSystemsSubtitle');
    if (view === 'worldBook') return '已装载条目与规则';
    if (view === 'worldBookImport') return '支持粘贴、上传文件或模板';
    if (view === 'writingStyle') return '文风 / 节奏 / 视角 / 描写 / 剧情';
    if (view === 'avoidEdit') return '长按拖拽排序二期；可增删';
    if (view === 'position') return '当前身份与立场';
    if (view === 'route') return GAME_START_UE_COPY.currentRouteHint;
    return undefined;
  })();

  const headerRight =
    view === 'worldBook' ? (
      <div className={styles.headerActions}>
        <button
          type="button"
          className={shell.ghostButton}
          onClick={() => {
            setImportTab('paste');
            setImportText('');
            setView('worldBookImport');
          }}
        >
          导入世界书
        </button>
        <button type="button" className={shell.primaryButton} onClick={() => openEditEntry()}>
          新增条目
        </button>
      </div>
    ) : view === 'writingStyle' ? (
      <div className={styles.headerActions}>
        <button type="button" className={shell.ghostButton} onClick={() => setView('avoidEdit')}>
          编辑避雷
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
              { id: 'worldBook' as const, icon: '书', title: '世界书', desc: '已装载条目与规则' },
              { id: 'writingStyle' as const, icon: '风', title: '文风设定', desc: '文风偏好与避雷词' },
              { id: 'position' as const, icon: '位', title: '玩家目前定位', desc: '当前身份与立场' },
              { id: 'route' as const, icon: '线', title: GAME_START_UE_COPY.currentRouteSection, desc: '剧情路线与进度' },
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
            <div className={shell.empty}>暂无世界书条目，可新增或导入</div>
          ) : (
            panelItems.map((item) => (
              <article key={item.id} className={styles.wbCard}>
                <div className={styles.wbMain}>
                  <h3 className={styles.wbTitle}>{item.name}</h3>
                  {item.summary ? <p className={styles.wbBody}>{item.summary}</p> : null}
                  <p className={styles.wbMeta}>
                    触发关键词：{item.keywords.length ? item.keywords.join('、') : '无'}
                    {item.constant ? ' · 常驻' : ''}
                  </p>
                </div>
                <div className={styles.wbSide}>
                  <span className={styles.badge}>已装载</span>
                  <div className={styles.toggleRow}>
                    <span>{item.enabled ? '启用' : '停用'}</span>
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
              <span className={styles.labelRow}>标题</span>
              <input
                value={editingEntry.title}
                maxLength={40}
                placeholder="条目标题"
                onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.labelRow}>内容</span>
              <textarea
                rows={6}
                value={editingEntry.content}
                placeholder="条目内容摘要 / 规则正文"
                onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.labelRow}>
                触发关键词
                <span className={styles.counter}>{keywordsJoined.length}/100</span>
              </span>
              <input
                value={keywordsJoined}
                maxLength={100}
                placeholder="用逗号分隔"
                onChange={(e) =>
                  setEditingEntry({
                    ...editingEntry,
                    keywords: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </label>
            <div className={styles.field}>
              <span className={styles.labelRow}>是否常驻</span>
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
                <span>{editingEntry.constant ? '常驻' : '按关键词触发'}</span>
              </div>
            </div>
            <div className={styles.field}>
              <span className={styles.labelRow}>状态</span>
              <div className={styles.statusChips}>
                <button
                  type="button"
                  className={`${styles.statusChip} ${editingEntry.enabled !== false ? styles.statusChipActive : ''}`}
                  onClick={() => setEditingEntry({ ...editingEntry, enabled: true })}
                >
                  启用
                </button>
                <button
                  type="button"
                  className={`${styles.statusChip} ${editingEntry.enabled === false ? styles.statusChipActive : ''}`}
                  onClick={() => setEditingEntry({ ...editingEntry, enabled: false })}
                >
                  停用
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
                取消
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void saveEntry()}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'worldBookImport' ? (
          <div className={styles.form}>
            <div className={styles.importTabs} role="tablist">
              {(
                [
                  { id: 'paste' as const, label: '粘贴内容' },
                  { id: 'upload' as const, label: '上传文件' },
                  { id: 'template' as const, label: '已有模板' },
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

            {importTab === 'paste' ? (
              <label className={styles.field}>
                <span className={styles.labelRow}>粘贴世界书内容（JSON 或纯文本）</span>
                <textarea
                  className={styles.pasteArea}
                  rows={8}
                  value={importText}
                  placeholder={'支持 JSON 数组 / {entries} / 创作台 morePromptForms，或空行分隔的纯文本'}
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
                <span>{importFileName || '支持拖放前请先点选文件'}</span>
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
                      {selectedTemplateId === tpl.id ? '已选' : '选择'}
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
                取消
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void confirmImport()}
              >
                {saving ? '导入中…' : '确认导入'}
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
              <h4 className={styles.sectionTitle}>节奏</h4>
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
                <h4 className={styles.sectionTitle}>避雷词库</h4>
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
                <p className={styles.infoHint}>暂无避雷词</p>
              ) : (
                <div className={styles.tagCloud}>
                  {writingStyle.avoidWords.map((w) => (
                    <span key={w} className={styles.tag}>
                      {w}
                      <button
                        type="button"
                        className={styles.tagX}
                        aria-label={`删除 ${w}`}
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
            </section>
          </div>
        ) : null}

        {view === 'avoidEdit' ? (
          <div className={styles.form}>
            <p className={styles.infoHint}>* 长按拖拽排序将在后续版本提供</p>
            <div className={styles.field}>
              <span className={styles.labelRow}>添加避雷词</span>
              <div className={styles.paceRow}>
                <input
                  value={avoidDraft}
                  maxLength={GAME_START_LIMITS.avoidWordMax}
                  placeholder="输入后点添加"
                  onChange={(e) => setAvoidDraft(e.target.value)}
                />
                <button type="button" className={styles.editBtn} onClick={addAvoidWord}>
                  添加
                </button>
              </div>
            </div>
            <div className={styles.avoidEditList}>
              {writingStyle.avoidWords.length === 0 ? (
                <div className={shell.empty}>词库为空</div>
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
                {saving ? '保存中…' : '完成'}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'position' ? (
          <div className={styles.form}>
            <div className={styles.positionCard}>
              <div className={styles.positionRow}>
                <span className={styles.positionKey}>当前身份</span>
                <div className={styles.positionVal}>{personaBlocks.identity || '未设置'}</div>
              </div>
              <div className={styles.positionRow}>
                <span className={styles.positionKey}>当前立场</span>
                <div className={styles.positionVal}>{personaBlocks.traits || '未设置'}</div>
              </div>
            </div>
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
              编辑定位
            </button>
          </div>
        ) : null}

        {view === 'positionEdit' ? (
          <div className={styles.form}>
            <label className={styles.field}>
              <span className={styles.labelRow}>当前身份</span>
              <input
                value={positionDraft.identity}
                maxLength={80}
                placeholder="如：冷宫嫔妃 / 江湖游侠"
                onChange={(e) => setPositionDraft((d) => ({ ...d, identity: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.labelRow}>当前立场</span>
              <textarea
                rows={4}
                value={positionDraft.stance}
                maxLength={200}
                placeholder="你站在哪一边、对谁有利"
                onChange={(e) => setPositionDraft((d) => ({ ...d, stance: e.target.value }))}
              />
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={saving}
                onClick={() => setView('position')}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={saving}
                onClick={() => void savePosition()}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        ) : null}

        {view === 'route' ? (
          <div className={styles.form}>
            <div className={styles.positionCard}>
              <div className={styles.positionRow}>
                <span className={styles.positionKey}>当前路线</span>
                <div className={styles.positionVal}>{currentRoute?.title || '未选择'}</div>
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
              更换路线
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
                placeholder="可写切换原因或期待走向"
                onChange={(e) => setRouteMemo(e.target.value)}
              />
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setView('route')}
              >
                取消
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
        isOpen={Boolean(pendingRouteId)}
        title={GAME_START_UE_COPY.changeRouteConfirmTitle}
        message={
          pendingRoute
            ? `${GAME_START_UE_COPY.changeRouteConfirmMessage}\n「${pendingRoute.title}」`
            : GAME_START_UE_COPY.changeRouteConfirmMessage
        }
        confirmText={saving ? '更换中…' : GAME_START_UE_COPY.changeRouteConfirmOk}
        cancelText="取消"
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
