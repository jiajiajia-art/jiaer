import React, { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import styles from './StGameCreate.module.css';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { StConfig, STRegexScript, STCharBookEntry } from '../utils/stRender';
import AssetsUpload from '../components/StGame/AssetsUpload';
import getGameDataApi from '../api/home/getGameData';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import { flattenThemeTags, type FlatThemeTag } from '../utils/themeTags';

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
type RequiredFieldKey = 'title' | 'themeTags';

const normalizeThemeTagIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
    .slice(0, THEME_TAG_MAX);
};

const StGameCreate: React.FC = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const appIdFromQuery = params.get('appId') || '';

  const [title, setTitle] = useState('');
  const [appId, setAppId] = useState('');
  const [cfg, setCfg] = useState<StConfig>({ ...emptyConfig });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
  const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
  const [themeTagError, setThemeTagError] = useState('');
  const [highlightField, setHighlightField] = useState<RequiredFieldKey | ''>('');
  const titleRowRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const themeTagsPanelRef = useRef<HTMLDivElement>(null);

  const scripts: STRegexScript[] = ((cfg.extensions?.regex_scripts) || []) as STRegexScript[];
  const entries: STCharBookEntry[] = (((cfg.extensions?.character_book)?.entries) || []) as STCharBookEntry[];

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

  const guideToRequiredField = (field: RequiredFieldKey, message: string) => {
    window.alert(message);
    setStep(1);
    setHighlightField(field);
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

  const toServer = async () => {
    if (!validateRequiredFields()) return;
    try {
      const id = await saveConfig();
      nav(`/st/${id}`);
    } catch {
      // handled in saveConfig
    }
  };

  const finishToStats = async () => {
    if (!validateRequiredFields()) return;
    try {
      const id = await saveConfig();
      nav(`/createGame?mode=stats&gameId=${encodeURIComponent(id)}`);
    } catch {
      // handled in saveConfig
    }
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.main}>
        <div className={styles.headerRow}>
          <h2>创建AVG模式</h2>
          <div className={styles.stepper}>
            <div className={step === 1 ? styles.stepActive : styles.step}>1. 剧本信息</div>
            <div className={styles.stepDivider}></div>
            <div className={step === 2 ? styles.stepActive : styles.step}>2. 素材包</div>
            <div className={styles.stepDivider}></div>
            <div className={step === 3 ? styles.stepActive : styles.step}>3. 规则与渲染</div>
          </div>
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
          <div className={styles.columns}>
            <div className={styles.col}>
              <div className={styles.group}>
                <div className={styles.groupTitle}>故事书 / 角色卡</div>
                <textarea
                  className={styles.area}
                  rows={18}
                  placeholder={'例：近未来的上海，玩家扮演新入职的「记忆修复师」，需要在一周内修复三名委托人的记忆。'}
                  value={String((cfg.data?.description) || '')}
                  onChange={e => setCfg(s => ({
                    ...s,
                    data: { ...(s.data || {}), description: e.target.value },
                  }))}
                />
              </div>
            </div>
            <div className={styles.col}>
              <div className={styles.group}>
                <div className={styles.groupTitle}>开场白</div>
                <div className={styles.hint}>玩家进入游戏时看到的第一句旁白或对话。</div>
                <textarea
                  className={styles.area}
                  rows={10}
                  placeholder={'例：你推开那家小店的门，风铃叮当作响，一股混合着咖啡与雨味的气息扑面而来。'}
                  value={String(cfg.persona?.first_mes || '')}
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
                  title={title}
                  appId={appId}
                  onAppReady={(id)=> setAppId(id)}
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
        <div className={styles.actions}>
          {step === 1 ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => setStep(2)}
            >下一步：上传素材包</button>
          ) : step === 2 ? (
            <>
              <button type="button" className={styles.secondary} onClick={() => setStep(1)}>上一步</button>
              <button type="button" className={styles.primary} onClick={() => setStep(3)}>下一步：配置规则</button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setStep(2)}
              >上一步</button>
              <button
                type="button"
                className={styles.primary}
                disabled={saving}
                onClick={finishToStats}
              >完成</button>
              <button
                className={styles.primary}
                disabled={saving}
                onClick={toServer}
              >{saving ? '创建中…' : '创建并测试'}</button>
            </>
          )}
        </div>
      </div>
      <FooterArea />
    </div>
  );
};

export default StGameCreate;
