import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  warehouseResourcesApi,
  type WarehouseResource,
  type WarehouseResourceType,
} from '../../api/galgame/warehouseResources';
import ConfirmModal from '../../components/CommonModal/ConfirmModal';
import { MdCheck } from 'react-icons/md';
import { PERSONA_TAG_ALL, PERSONA_TAGS, WORLDBOOK_DEFAULT_ENTRY_TITLE, personaTagLabel } from './warehouseNav';
import WarehouseEmptyIcon from './WarehouseEmptyIcon';
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
        return { ok: false as const, i18nKey: 'warehouse.resource.entriesNotArray' };
      }
      entries = parsed;
    } catch {
      return { ok: false as const, i18nKey: 'warehouse.resource.entriesParseFailed' };
    }
    // 功能注释：条目为空但写了描述时，自动生成一条，避免局内导入报「无可导入条目」
    if (entries.length === 0 && (draft.title.trim() || draft.description.trim())) {
      entries = [{
        title: draft.title.trim() || WORLDBOOK_DEFAULT_ENTRY_TITLE,
        content: draft.description.trim() || draft.title.trim(),
        keywords: tags,
        constant: true,
        enabled: true,
      }];
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

function summaryLine(
  item: WarehouseResource,
  type: WarehouseResourceType,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (item.description) return item.description;
  if (type === 'worldbook') {
    const n = Array.isArray((item.payload as { entries?: unknown[] })?.entries)
      ? (item.payload as { entries: unknown[] }).entries.length
      : 0;
    return t('warehouse.resource.summaryEntries', { count: n });
  }
  const kind = String((item.payload as { kind?: string })?.kind || 'prompt');
  return t('warehouse.resource.summaryKind', { kind });
}

const WarehouseResourceLibrary: React.FC<Props> = ({ resourceType, mode }) => {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.user?.token);
  const navigate = useNavigate();
  const meta = useMemo(
    () => ({
      titleMine: t(`warehouse.resource.${resourceType}.titleMine`),
      titlePublic: t(`warehouse.resource.${resourceType}.titlePublic`),
      subMine: t(`warehouse.resource.${resourceType}.subMine`),
      subPublic: t(`warehouse.resource.${resourceType}.subPublic`),
      emptyMine: t(`warehouse.resource.${resourceType}.emptyMine`),
      emptyPublic: t(`warehouse.resource.${resourceType}.emptyPublic`),
      createLabel: t(`warehouse.resource.${resourceType}.createLabel`),
      minePath: resourceType === 'worldbook' ? '/warehouse/worldbooks' : '/warehouse/plugins',
    }),
    [resourceType, t],
  );
  const isPublic = mode === 'public';

  const [items, setItems] = useState<WarehouseResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<(typeof PERSONA_TAGS)[number]>(PERSONA_TAG_ALL);
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
        toast.error(res?.message || t('warehouse.cards.loadFailed'));
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
      toast.error((e as Error)?.message || t('warehouse.cards.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [token, query, resourceType, isPublic, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tag === PERSONA_TAG_ALL) return items;
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
      toast.error(t('warehouse.cards.loginRequired'));
      return;
    }
    if (!draft.title.trim()) {
      toast.error(t('warehouse.resource.titleRequired'));
      return;
    }
    const packed = resourceFromDraft(resourceType, draft);
    if (!packed.ok) {
      toast.error('i18nKey' in packed && packed.i18nKey ? t(packed.i18nKey) : String((packed as { message?: string }).message || ''));
      return;
    }
    setSaving(true);
    try {
      const res = editingId
        ? await warehouseResourcesApi.update(token, editingId, packed.body)
        : await warehouseResourcesApi.create(token, { type: resourceType, ...packed.body });
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.cards.saveFailed'));
        return;
      }
      toast.success(editingId ? t('warehouse.resource.updatedOk') : t('warehouse.resource.createdOk'));
      setFormOpen(false);
      await load();
      if (res.data?.id) setSelectedId(String(res.data.id));
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.cards.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (item: WarehouseResource, nextPublic: boolean) => {
    if (!token) return;
    const res = await warehouseResourcesApi.publish(token, item.id, nextPublic);
    if (!res?.success) {
      toast.error(res?.message || t('warehouse.cards.operationFailed'));
      return;
    }
    toast.success(nextPublic ? t('warehouse.resource.publishOk') : t('warehouse.resource.unpublishOk'));
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
    toast.success(t('warehouse.cards.exportJsonOk'));
  };

  const importFile = async (file: File) => {
    if (!token) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const title = String(json.title || '').trim();
      if (!title) {
        toast.error(t('warehouse.resource.importMissingTitle'));
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
        toast.error('i18nKey' in packed && packed.i18nKey ? t(packed.i18nKey) : String((packed as { message?: string }).message || ''));
        return;
      }
      const res = await warehouseResourcesApi.create(token, {
        type: resourceType,
        ...packed.body,
      });
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.cards.importFailed'));
        return;
      }
      toast.success(t('warehouse.resource.importOk'));
      await load();
    } catch {
      toast.error(t('warehouse.cards.importParseFailed'));
    }
  };

  const importFromPublic = async (item: WarehouseResource) => {
    if (!token) {
      toast.error(t('warehouse.cards.loginRequired'));
      return;
    }
    setImporting(true);
    try {
      const res = await warehouseResourcesApi.importFromPublic(token, item.id);
      if (!res?.success) {
        toast.error(res?.message || t('warehouse.cards.importFailed'));
        return;
      }
      toast.success(t('warehouse.resource.importToMineOk'));
      navigate(meta.minePath);
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.cards.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteId) return;
    const res = await warehouseResourcesApi.remove(token, deleteId);
    if (!res?.success) {
      toast.error(res?.message || t('warehouse.cards.deleteFailed'));
      return;
    }
    toast.success(t('warehouse.cards.deleted'));
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
          placeholder={t('warehouse.resource.searchPlaceholder')}
        />
        {!isPublic ? (
          <>
            <button type="button" className={panel.ghostBtn} onClick={() => fileRef.current?.click()}>
              {t('warehouse.cards.importJson')}
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
            {t('warehouse.resource.goPublishMine')}
          </button>
        )}
      </div>

      <div className={panel.tags}>
        {PERSONA_TAGS.map((tg) => (
          <button
            key={tg}
            type="button"
            className={tag === tg ? panel.tagActive : panel.tag}
            onClick={() => setTag(tg)}
          >
            {personaTagLabel(tg, t)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={panel.empty}>{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className={panel.emptyStage}>
          <WarehouseEmptyIcon kind={resourceType === 'plugin' ? 'plugin' : 'worldbook'} />
          <h2>{isPublic ? meta.emptyPublic : meta.emptyMine}</h2>
          <p>{isPublic ? t('warehouse.resource.emptyHintPublic') : t('warehouse.resource.emptyHintMine')}</p>
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
                      <span className={panel.portraitBadge}>{t('warehouse.resource.publicBadge')}</span>
                    ) : null}
                    {active ? <span className={panel.checkMark}>✓</span> : null}
                  </div>
                  <div className={panel.cardBody}>
                    <div className={panel.cardTop}>
                      <h3 className={panel.cardName}>{item.title}</h3>
                    </div>
                    <p className={panel.cardMeta}>
                      {isPublic
                        ? t('warehouse.resource.byAuthor', {
                          author: item.authorName || t('warehouse.publicCards.anonymous'),
                        })
                        : (item.enabled === false ? t('warehouse.resource.disabled') : t('warehouse.resource.enabled'))}
                    </p>
                    {(item.tags || []).length > 0 ? (
                      <div className={panel.chipRow}>
                        {(item.tags || []).slice(0, 3).map((tagItem) => (
                          <span key={tagItem} className={panel.chip}>{personaTagLabel(tagItem, t)}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className={panel.cardPersona}>{summaryLine(item, resourceType, t)}</p>
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
                          {t('warehouse.cards.edit')}
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
                          {t('warehouse.cards.importToMine')}
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
                <p className={panel.previewTitle}>{isPublic ? t('warehouse.resource.previewDetail') : t('warehouse.resource.previewCurrent')}</p>
                <h3 className={panel.previewName}>{selected.title}</h3>
                {isPublic ? (
                  <p className={panel.previewRow}>
                    <strong>{t('warehouse.resource.labelAuthor')}</strong>{selected.authorName || t('warehouse.publicCards.anonymous')}
                  </p>
                ) : null}
                <p className={panel.previewRow}>
                  <strong>{t('warehouse.resource.labelDescription')}</strong>{selected.description || '—'}
                </p>
                <p className={panel.previewRow}>
                  <strong>{t('warehouse.resource.labelTags')}</strong>{(selected.tags || []).join('、') || '—'}
                </p>
                <p className={panel.previewRow}>
                  <strong>{t('warehouse.resource.labelContent')}</strong>{summaryLine(selected, resourceType, t)}
                </p>
                <div className={panel.previewActions}>
                  {!isPublic ? (
                    <>
                      <button
                        type="button"
                        className={panel.primaryBtn}
                        onClick={() => openEdit(selected)}
                      >
                        {t('warehouse.cards.edit')}
                      </button>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        onClick={() => exportItem(selected)}
                      >
                        {t('warehouse.cards.export')}
                      </button>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        onClick={() => void publish(selected, !selected.isPublic)}
                      >
                        {selected.isPublic ? t('warehouse.resource.unpublishAction') : t('warehouse.resource.publishAction')}
                      </button>
                      <button
                        type="button"
                        className={panel.dangerBtn}
                        onClick={() => setDeleteId(selected.id)}
                      >
                        {t('warehouse.cards.delete')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={panel.primaryBtn}
                      disabled={importing}
                      onClick={() => void importFromPublic(selected)}
                    >
                      {importing ? t('warehouse.cards.importing') : t('warehouse.cards.importToMine')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={panel.previewInner}>
                <p className={panel.empty}>{t('warehouse.resource.selectHint')}</p>
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
              aria-label={editingId ? t('warehouse.resource.form.dialogAriaEdit') : t('warehouse.resource.form.dialogAriaCreate')}
              onClick={(e) => e.stopPropagation()}
            >
              <aside className={panel.formPreview}>
                <p className={panel.formPreviewEyebrow}>
                  {resourceType === 'worldbook' ? 'WORLD BOOK' : 'PLUGIN'}
                </p>
                <div className={panel.formPreviewPortrait}>
                  <div className={panel.formPreviewPortraitFallback} aria-hidden>
                    {(draft.title || '?').slice(0, 1)}
                  </div>
                </div>
                <h4 className={panel.formPreviewName}>{draft.title.trim() || t('warehouse.resource.form.unnamed')}</h4>
                <p className={panel.formPreviewMeta}>
                  {(draft.description || t('warehouse.resource.form.previewHint')).slice(0, 80)}
                </p>
              </aside>

              <div className={panel.formBody}>
                <div className={panel.formBodyHead}>
                  <h3>
                    {editingId ? t('warehouse.resource.form.titleEdit') : t('warehouse.resource.form.titleCreate')}
                    {resourceType === 'worldbook' ? t('warehouse.resource.form.typeWorldbook') : t('warehouse.resource.form.typePlugin')}
                  </h3>
                  <button
                    type="button"
                    className={panel.formClose}
                    aria-label={t('warehouse.cards.close')}
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-res-title">{t('warehouse.resource.form.titleLabel')}</label>
                  <input
                    id="wh-res-title"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    maxLength={80}
                    placeholder={t('warehouse.resource.form.titlePlaceholder')}
                    autoFocus
                  />
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-res-desc">{t('warehouse.resource.form.descriptionLabel')}</label>
                  <textarea
                    id="wh-res-desc"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    maxLength={2000}
                    placeholder={t('warehouse.resource.form.descriptionPlaceholder')}
                  />
                </div>

                <div className={panel.field}>
                  <label htmlFor="wh-res-tags">{t('warehouse.cards.labelTags')}</label>
                  <input
                    id="wh-res-tags"
                    value={draft.tagsText}
                    onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
                    placeholder={t('warehouse.resource.form.tagsPlaceholder')}
                  />
                </div>

                {resourceType === 'worldbook' ? (
                  <div className={panel.field}>
                    <label htmlFor="wh-res-entries">{t('warehouse.resource.form.entriesJsonLabel')}</label>
                    <textarea
                      id="wh-res-entries"
                      value={draft.entriesJson}
                      onChange={(e) => setDraft((d) => ({ ...d, entriesJson: e.target.value }))}
                      placeholder={t('warehouse.resource.form.entriesJsonPlaceholder')}
                      style={{ minHeight: 160, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                    />
                  </div>
                ) : (
                  <>
                    <div className={panel.field}>
                      <span id="wh-plugin-kind-label">{t('warehouse.resource.form.pluginTypeLabel')}</span>
                      <div className={panel.segRow} role="group" aria-labelledby="wh-plugin-kind-label">
                        {['prompt', 'regex', 'tool'].map((k) => (
                          <button
                            key={k}
                            type="button"
                            className={draft.pluginKind === k ? panel.segActive : panel.seg}
                            onClick={() => setDraft((d) => ({ ...d, pluginKind: k }))}
                          >
                            {draft.pluginKind === k ? (
                              <MdCheck className={panel.segActiveIcon} aria-hidden />
                            ) : null}
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={panel.field}>
                      <label htmlFor="wh-plugin-script">{t('warehouse.resource.form.scriptLabel')}</label>
                      <textarea
                        id="wh-plugin-script"
                        value={draft.scriptText}
                        onChange={(e) => setDraft((d) => ({ ...d, scriptText: e.target.value }))}
                        placeholder={t('warehouse.resource.form.scriptPlaceholder')}
                        style={{ minHeight: 140 }}
                      />
                    </div>
                    <label className={panel.checkRow}>
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
                      />
                      {t('warehouse.resource.form.enablePlugin')}
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
                    {t('warehouse.cards.cancel')}
                  </button>
                  <button
                    type="button"
                    className={panel.primaryBtn}
                    disabled={saving}
                    onClick={() => void saveForm()}
                  >
                    {saving ? t('warehouse.cards.saving') : t('warehouse.cards.save')}
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
        title={t('warehouse.resource.deleteTitle')}
        message={t('warehouse.cards.deleteConfirm')}
        confirmButtonText={t('warehouse.cards.delete')}
        cancelButtonText={t('warehouse.cards.cancel')}
      />
    </div>
  );
};

export default WarehouseResourceLibrary;
