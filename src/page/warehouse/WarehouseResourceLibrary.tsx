import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  warehouseResourcesApi,
  type WarehouseResource,
  type WarehouseResourceType,
} from '../../api/galgame/warehouseResources';
import ConfirmModal from '../../components/CommonModal/ConfirmModal';
import { PERSONA_TAGS } from './warehouseNav';
import panel from './WarehousePanel.module.css';

type Props = {
  resourceType: WarehouseResourceType;
  mode: 'mine' | 'public';
};

type Draft = {
  title: string;
  description: string;
  tagsText: string;
  enabled: boolean;
  /** worldbook: entries JSON text */
  entriesJson: string;
  /** plugin */
  pluginKind: string;
  scriptText: string;
};

const META: Record<WarehouseResourceType, {
  titleMine: string;
  titlePublic: string;
  subMine: string;
  subPublic: string;
  emptyMine: string;
  emptyPublic: string;
  createLabel: string;
  minePath: string;
}> = {
  worldbook: {
    titleMine: '我的世界书',
    titlePublic: '公共世界书',
    subMine: '管理世界观与设定条目，可发布到公共库',
    subPublic: '浏览并导入他人分享的世界书',
    emptyMine: '还没有世界书',
    emptyPublic: '公共世界书还是空的',
    createLabel: '+ 新建世界书',
    minePath: '/warehouse/worldbooks',
  },
  plugin: {
    titleMine: '我的插件',
    titlePublic: '公共插件',
    subMine: '管理提示词 / 正则等能力插件，可发布到公共库',
    subPublic: '浏览并导入他人分享的插件',
    emptyMine: '还没有插件',
    emptyPublic: '公共插件还是空的',
    createLabel: '+ 新建插件',
    minePath: '/warehouse/plugins',
  },
};

function emptyDraft(_type: WarehouseResourceType): Draft {
  return {
    title: '',
    description: '',
    tagsText: '',
    enabled: true,
    entriesJson: '[]',
    pluginKind: 'prompt',
    scriptText: '',
  };
}

function resourceFromDraft(type: WarehouseResourceType, draft: Draft) {
  const tags = draft.tagsText
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (type === 'worldbook') {
    let entries: unknown[] = [];
    try {
      const parsed = JSON.parse(draft.entriesJson || '[]');
      if (!Array.isArray(parsed)) {
        return { ok: false as const, message: '条目必须是 JSON 数组' };
      }
      entries = parsed;
    } catch {
      return { ok: false as const, message: '条目 JSON 无法解析' };
    }
    return {
      ok: true as const,
      body: {
        title: draft.title,
        description: draft.description,
        tags,
        payload: { entries },
      },
    };
  }
  return {
    ok: true as const,
    body: {
      title: draft.title,
      description: draft.description,
      tags,
      enabled: draft.enabled,
      payload: {
        kind: draft.pluginKind || 'prompt',
        scriptText: draft.scriptText,
        config: {},
      },
    },
  };
}

function draftFromResource(item: WarehouseResource): Draft {
  const payload = (item.payload || {}) as Record<string, unknown>;
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  return {
    title: item.title || '',
    description: item.description || '',
    tagsText: (item.tags || []).join(','),
    enabled: item.enabled !== false,
    entriesJson: JSON.stringify(entries, null, 2),
    pluginKind: String(payload.kind || 'prompt'),
    scriptText: String(payload.scriptText || ''),
  };
}

function summaryLine(item: WarehouseResource, type: WarehouseResourceType): string {
  if (item.description) return item.description;
  if (type === 'worldbook') {
    const n = Array.isArray((item.payload as { entries?: unknown[] })?.entries)
      ? (item.payload as { entries: unknown[] }).entries.length
      : 0;
    return `${n} 条设定`;
  }
  const kind = String((item.payload as { kind?: string })?.kind || 'prompt');
  return `类型：${kind}`;
}

const WarehouseResourceLibrary: React.FC<Props> = ({ resourceType, mode }) => {
  const token = useAuthStore((s) => s.user?.token);
  const navigate = useNavigate();
  const meta = META[resourceType];
  const isPublic = mode === 'public';

  const [items, setItems] = useState<WarehouseResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(resourceType));
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!formOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [formOpen]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = isPublic
        ? await warehouseResourcesApi.listPublic(token, { type: resourceType, q: query })
        : await warehouseResourcesApi.list(token, { type: resourceType, q: query });
      if (!res?.success) {
        toast.error(res?.message || '加载失败');
        setItems([]);
        return;
      }
      const list = Array.isArray(res.data) ? (res.data as WarehouseResource[]) : [];
      setItems(list);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || null;
      });
    } catch (e) {
      toast.error((e as Error)?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, query, resourceType, isPublic]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tag === '全部') return items;
    return items.filter((c) => (c.tags || []).some((t) => t === tag));
  }, [items, tag]);

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0] || null;

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft(resourceType));
    setFormOpen(true);
  };

  const openEdit = (item: WarehouseResource) => {
    setEditingId(item.id);
    setDraft(draftFromResource(item));
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    if (!draft.title.trim()) {
      toast.error('请填写标题');
      return;
    }
    const packed = resourceFromDraft(resourceType, draft);
    if (!packed.ok) {
      toast.error(packed.message);
      return;
    }
    setSaving(true);
    try {
      const res = editingId
        ? await warehouseResourcesApi.update(token, editingId, packed.body)
        : await warehouseResourcesApi.create(token, { type: resourceType, ...packed.body });
      if (!res?.success) {
        toast.error(res?.message || '保存失败');
        return;
      }
      toast.success(editingId ? '已更新' : '已创建');
      setFormOpen(false);
      await load();
      if (res.data?.id) setSelectedId(String(res.data.id));
    } catch (e) {
      toast.error((e as Error)?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (item: WarehouseResource, nextPublic: boolean) => {
    if (!token) return;
    const res = await warehouseResourcesApi.publish(token, item.id, nextPublic);
    if (!res?.success) {
      toast.error(res?.message || '操作失败');
      return;
    }
    toast.success(nextPublic ? '已发布到公共库' : '已取消公开');
    await load();
  };

  const exportItem = (item: WarehouseResource) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resourceType}-${item.title || item.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出 JSON');
  };

  const importFile = async (file: File) => {
    if (!token) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const title = String(json.title || '').trim();
      if (!title) {
        toast.error('导入文件缺少 title');
        return;
      }
      const draftLike: Draft = {
        title,
        description: String(json.description || ''),
        tagsText: Array.isArray(json.tags) ? json.tags.join(',') : '',
        enabled: json.enabled !== false,
        entriesJson: JSON.stringify(
          Array.isArray(json.payload?.entries)
            ? json.payload.entries
            : (Array.isArray(json.entries) ? json.entries : []),
          null,
          2,
        ),
        pluginKind: String(json.payload?.kind || json.kind || 'prompt'),
        scriptText: String(json.payload?.scriptText || json.scriptText || ''),
      };
      const packed = resourceFromDraft(resourceType, draftLike);
      if (!packed.ok) {
        toast.error(packed.message);
        return;
      }
      const res = await warehouseResourcesApi.create(token, {
        type: resourceType,
        ...packed.body,
      });
      if (!res?.success) {
        toast.error(res?.message || '导入失败');
        return;
      }
      toast.success('已导入');
      await load();
    } catch {
      toast.error('无法解析导入文件');
    }
  };

  const importFromPublic = async (item: WarehouseResource) => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    setImporting(true);
    try {
      const res = await warehouseResourcesApi.importFromPublic(token, item.id);
      if (!res?.success) {
        toast.error(res?.message || '导入失败');
        return;
      }
      toast.success('已导入到我的资源库（私人副本）');
      navigate(meta.minePath);
    } catch (e) {
      toast.error((e as Error)?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    const res = await warehouseResourcesApi.remove(token, deleteId);
    if (!res?.success) {
      toast.error(res?.message || '删除失败');
      return;
    }
    toast.success('已删除');
    setDeleteId(null);
    await load();
  };

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>{isPublic ? meta.titlePublic : meta.titleMine}</h1>
        <p className={panel.sub}>{isPublic ? meta.subPublic : meta.subMine}</p>
      </header>

      <div className={panel.toolbar}>
        <input
          className={panel.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索标题 / 描述 / 标签"
        />
        {!isPublic ? (
          <>
            <button type="button" className={panel.ghostBtn} onClick={() => fileRef.current?.click()}>
              导入 JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = '';
              }}
            />
            <button type="button" className={panel.primaryBtn} onClick={openCreate}>
              {meta.createLabel}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={panel.primaryBtn}
            onClick={() => navigate(meta.minePath)}
          >
            去我的库发布
          </button>
        )}
      </div>

      <div className={panel.tags}>
        {PERSONA_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className={tag === t ? panel.tagActive : panel.tag}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={panel.empty}>加载中…</p>
      ) : filtered.length === 0 ? (
        <div className={panel.emptyStage}>
          <div className={panel.emptyOrb} aria-hidden />
          <h2>{isPublic ? meta.emptyPublic : meta.emptyMine}</h2>
          <p>{isPublic ? '去「我的」发布第一份资源吧' : '新建或导入一份资源开始整理'}</p>
        </div>
      ) : (
        <div className={panel.layout}>
          <div className={panel.grid}>
            {filtered.map((item) => {
              const active = selected?.id === item.id;
              return (
                <article
                  key={item.id}
                  className={active ? panel.cardActive : panel.card}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className={panel.portrait}>
                    <div className={panel.portraitFallback}>
                      {(item.title || '?').slice(0, 1)}
                    </div>
                    {item.isPublic && !isPublic ? (
                      <span className={panel.portraitBadge}>公开</span>
                    ) : null}
                    {active ? <span className={panel.checkMark}>✓</span> : null}
                  </div>
                  <div className={panel.cardBody}>
                    <div className={panel.cardTop}>
                      <h3 className={panel.cardName}>{item.title}</h3>
                    </div>
                    <p className={panel.cardMeta}>
                      {isPublic
                        ? `by ${item.authorName || '匿名'}`
                        : (item.enabled === false ? '已停用' : '已启用')}
                    </p>
                    {(item.tags || []).length > 0 ? (
                      <div className={panel.chipRow}>
                        {(item.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className={panel.chip}>{t}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={panel.cardPersona}>{summaryLine(item, resourceType)}</p>
                    <div className={panel.cardActions}>
                      {!isPublic ? (
                        <button
                          type="button"
                          className={panel.actionPrimary}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          编辑
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={panel.actionPrimary}
                          disabled={importing}
                          onClick={(e) => {
                            e.stopPropagation();
                            void importFromPublic(item);
                          }}
                        >
                          导入到我的
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className={panel.preview}>
            {selected ? (
              <div className={panel.previewInner}>
                <p className={panel.previewTitle}>{isPublic ? '资源详情' : '当前预览'}</p>
                <h3 className={panel.previewName}>{selected.title}</h3>
                {isPublic ? (
                  <p className={panel.previewRow}>
                    <strong>作者</strong>{selected.authorName || '匿名'}
                  </p>
                ) : null}
                <p className={panel.previewRow}>
                  <strong>描述</strong>{selected.description || '—'}
                </p>
                <p className={panel.previewRow}>
                  <strong>标签</strong>{(selected.tags || []).join('、') || '—'}
                </p>
                <p className={panel.previewRow}>
                  <strong>内容</strong>{summaryLine(selected, resourceType)}
                </p>
                <div className={panel.previewActions}>
                  {!isPublic ? (
                    <>
                      <button
                        type="button"
                        className={panel.primaryBtn}
                        onClick={() => openEdit(selected)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        onClick={() => exportItem(selected)}
                      >
                        导出
                      </button>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        onClick={() => void publish(selected, !selected.isPublic)}
                      >
                        {selected.isPublic ? '取消公开' : '发布到公共库'}
                      </button>
                      <button
                        type="button"
                        className={panel.dangerBtn}
                        onClick={() => setDeleteId(selected.id)}
                      >
                        删除
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={panel.primaryBtn}
                      disabled={importing}
                      onClick={() => void importFromPublic(selected)}
                    >
                      {importing ? '导入中…' : '导入到我的'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={panel.previewInner}>
                <p className={panel.empty}>选择一项查看详情</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {!isPublic && formOpen
        ? createPortal(
          <div className={panel.formOverlay} onClick={() => !saving && setFormOpen(false)}>
            <div
              className={panel.formCard}
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? '编辑' : '新建'}
              onClick={(e) => e.stopPropagation()}
            >
              <aside className={panel.formPreview}>
                <p className={panel.formPreviewEyebrow}>
                  {resourceType === 'worldbook' ? 'WORLD BOOK' : 'PLUGIN'}
                </p>
                <div className={panel.formPreviewPortrait}>
                  {(draft.title || '?').slice(0, 1)}
                </div>
                <h4 className={panel.formPreviewName}>{draft.title.trim() || '未命名'}</h4>
                <p className={panel.formPreviewMeta}>
                  {(draft.description || '在右侧填写内容…').slice(0, 80)}
                </p>
              </aside>

              <div className={panel.formBody}>
                <div className={panel.formBodyHead}>
                  <h3>{editingId ? '编辑' : '新建'}{resourceType === 'worldbook' ? '世界书' : '插件'}</h3>
                  <button
                    type="button"
                    className={panel.formClose}
                    aria-label="关闭"
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-res-title">标题</label>
                  <input
                    id="wh-res-title"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    maxLength={80}
                    placeholder="资源标题"
                    autoFocus
                  />
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-res-desc">描述</label>
                  <textarea
                    id="wh-res-desc"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    maxLength={2000}
                    placeholder="简要说明用途"
                  />
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-res-tags">标签</label>
                  <input
                    id="wh-res-tags"
                    value={draft.tagsText}
                    onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
                    placeholder="奇幻, 校园（逗号分隔）"
                  />
                </div>

                {resourceType === 'worldbook' ? (
                  <div className={panel.field}>
                    <label htmlFor="wh-res-entries">条目 JSON</label>
                    <textarea
                      id="wh-res-entries"
                      value={draft.entriesJson}
                      onChange={(e) => setDraft((d) => ({ ...d, entriesJson: e.target.value }))}
                      placeholder={'[{"title":"设定名","content":"...","keywords":[],"constant":false,"enabled":true}]'}
                      style={{ minHeight: 160, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                    />
                  </div>
                ) : (
                  <>
                    <div className={panel.field}>
                      <span id="wh-plugin-kind-label">插件类型</span>
                      <div className={panel.segRow} role="group" aria-labelledby="wh-plugin-kind-label">
                        {['prompt', 'regex', 'tool'].map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={draft.pluginKind === k ? panel.segActive : panel.seg}
                            onClick={() => setDraft((d) => ({ ...d, pluginKind: k }))}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={panel.field}>
                      <label htmlFor="wh-plugin-script">脚本 / 配置文本</label>
                      <textarea
                        id="wh-plugin-script"
                        value={draft.scriptText}
                        onChange={(e) => setDraft((d) => ({ ...d, scriptText: e.target.value }))}
                        placeholder="提示词、正则规则或工具说明…"
                        style={{ minHeight: 140 }}
                      />
                    </div>
                    <label className={panel.checkRow}>
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                      />
                      启用该插件
                    </label>
                  </>
                )}

                <div className={panel.formActions}>
                  <button
                    type="button"
                    className={panel.ghostBtn}
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className={panel.primaryBtn}
                    disabled={saving}
                    onClick={() => void saveForm()}
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title="删除资源"
        message="删除后不可恢复，确认删除吗？"
        confirmButtonText="删除"
        cancelButtonText="取消"
      />
    </div>
  );
};

export default WarehouseResourceLibrary;
