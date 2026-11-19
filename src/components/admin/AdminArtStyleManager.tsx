/**
 * 素材中心 · 画风：列出创作者生图时能选的画风，点开即可改名称和描述。
 * 服务器还没有画风库时，先展示编辑器正在用的 9 种内置画风。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { artStyleLibraryApi, type ArtStyleLibraryItem } from '../../api/galgame/artStyleLibrary';
import { ART_STYLE_PRESETS } from '../../../Romance/src/lib/editorImagePrompts';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './AdminLocationLibraryManager.module.css';

type StyleRow = ArtStyleLibraryItem & { fromBuiltin?: boolean };

type FormState = {
  id?: string;
  fromBuiltin?: boolean;
  key: string;
  name: string;
  prompt: string;
  negative: string;
  sampleUrl: string;
  swatch: string;
  sortOrder: string;
  visible: boolean;
};

const emptyForm = (): FormState => ({
  key: '',
  name: '',
  prompt: '',
  negative: '',
  sampleUrl: '',
  swatch: 'linear-gradient(135deg,#ffd6e0,#a8c8ff)',
  sortOrder: '0',
  visible: true,
});

function builtinStyles(): StyleRow[] {
  return ART_STYLE_PRESETS.map((preset, index) => ({
    id: `builtin:${preset.id}`,
    key: preset.id,
    name: preset.label,
    prompt: preset.prompt,
    negative: preset.negative,
    swatch: preset.swatch,
    sampleUrl: '',
    sortOrder: index * 10,
    status: 'active',
    fromBuiltin: true,
  }));
}

function saveError(message: string | undefined, fallback: string): string {
  if (/404|not found/i.test(String(message || ''))) {
    return '测试服务器还不能保存画风。这 9 种仍按现在的默认来，后台更新后这里的修改才会生效。';
  }
  return message || fallback;
}

export default function AdminArtStyleManager() {
  const token = useAuthStore((s) => s.user?.token) || '';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<ArtStyleLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StyleRow | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await artStyleLibraryApi.list(token, { includeDisabled: true });
      if (res.httpStatus === 404) {
        setApiMissing(true);
        setItems([]);
        return;
      }
      setApiMissing(false);
      if (!res?.success) {
        toast.error(saveError(res?.message, '加载画风失败'));
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载画风失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const usingBuiltins = apiMissing || (!loading && items.length === 0);
  const rows = useMemo(() => {
    const source = usingBuiltins ? builtinStyles().filter((item) => !hiddenKeys.includes(item.key)) : items;
    return [...source].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'zh-CN'));
  }, [items, usingBuiltins, hiddenKeys]);

  const openEdit = (item: StyleRow) => {
    setForm({
      id: item.fromBuiltin ? undefined : item.id,
      fromBuiltin: item.fromBuiltin,
      key: item.key,
      name: item.name,
      prompt: item.prompt,
      negative: item.negative || '',
      sampleUrl: item.sampleUrl || '',
      swatch: item.swatch || '',
      sortOrder: String(item.sortOrder ?? 0),
      visible: item.status !== 'disabled',
    });
  };

  const onUpload = async (file: File | null) => {
    if (!file || !token || !form) return;
    setUploading(true);
    try {
      const res = await artStyleLibraryApi.upload(token, file);
      const sampleUrl = res?.data?.sampleUrl || res?.data?.imageUrl;
      if (!res?.success || !sampleUrl) {
        toast.error(saveError(res?.message, '上传失败'));
        return;
      }
      setForm((current) => current ? { ...current, sampleUrl: String(sampleUrl) } : current);
      toast.success('示例图已上传');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!token || !form) return;
    const name = form.name.trim();
    const prompt = form.prompt.trim();
    if (!name) { toast.error('请填写画风名称'); return; }
    if (!prompt) { toast.error('请填写画出来的样子'); return; }
    if (apiMissing) {
      toast.error(saveError('404', '保存失败'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        key: form.key.trim() || `style_${Date.now().toString(36)}`,
        name,
        prompt,
        negative: form.negative.trim(),
        sampleUrl: form.sampleUrl.trim(),
        swatch: form.swatch.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        status: form.visible ? 'active' as const : 'disabled' as const,
      };
      const res = form.id
        ? await artStyleLibraryApi.update(token, form.id, payload)
        : await artStyleLibraryApi.create(token, payload);
      if (!res?.success) { toast.error(saveError(res?.message, '保存失败')); return; }
      toast.success(form.id ? '已保存' : '已添加');
      setForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const removeStyle = async (item: StyleRow) => {
    if (!token) return;
    if (item.fromBuiltin) {
      setHiddenKeys((keys) => (keys.includes(item.key) ? keys : [...keys, item.key]));
      toast.success('已删除');
      setConfirmDelete(null);
      return;
    }
    const res = await artStyleLibraryApi.remove(token, item.id);
    if (!res?.success) { toast.error(saveError(res?.message, '删除失败')); return; }
    toast.success('已删除');
    setConfirmDelete(null);
    await load();
  };

  return (
    <div className={styles.root}>
      <div className={`${styles.header} ${styles.styleHead}`}>
        <h2 className={styles.title}>画风</h2>
        <button type="button" className={styles.stylePrimary} onClick={() => setForm(emptyForm())}>新增</button>
      </div>

      {loading ? <div className={styles.empty}>正在加载画风…</div> : (
        <div className={styles.styleGrid}>
          {rows.map((item) => {
            const row = item as StyleRow;
            return (
              <article key={item.id} className={styles.styleCard}>
                {item.sampleUrl ? (
                  <img className={styles.portrait} src={getImageUrl(item.sampleUrl)} alt="" />
                ) : (
                  <div className={`${styles.portrait} ${styles.portraitEmpty}`}>暂无示例</div>
                )}
                <div className={styles.body}>
                  <span className={item.status === 'disabled' ? styles.badgeOff : styles.badge}>
                    {item.status === 'disabled' ? '已关掉' : '创作者可选'}
                  </span>
                  <h3 className={styles.name}>{item.name}</h3>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btn} onClick={() => openEdit(row)}>修改</button>
                    <button type="button" className={styles.btnDanger} onClick={() => setConfirmDelete(row)}>删除</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {form ? createPortal(
        <div className={styles.overlay} role="presentation" onClick={() => { if (!saving) setForm(null); }}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="art-style-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.dialogHeader}>
              <h3 id="art-style-editor-title" className={styles.dialogTitle}>{form.id || form.fromBuiltin ? '修改画风' : '新增画风'}</h3>
              <button type="button" className={styles.closeBtn} aria-label="关闭" onClick={() => setForm(null)}>×</button>
            </header>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void onUpload(event.target.files?.[0] || null)} />
            <div className={styles.editorBody}>
              <div className={styles.formRow}>
                {form.sampleUrl ? (
                  <img className={styles.portraitLarge} src={getImageUrl(form.sampleUrl)} alt="示例图" />
                ) : (
                  <button
                    type="button"
                    className={`${styles.portraitLarge} ${styles.portraitEmpty}`}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? '上传中…' : '上传竖图'}
                  </button>
                )}
                {form.sampleUrl ? (
                  <button type="button" className={styles.styleGhost} disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? '上传中…' : '换一张'}
                  </button>
                ) : (
                  <p className={styles.hint}>竖图，宽 3、高 4</p>
                )}
              </div>
              <div className={styles.formPlain}>
                <div className={styles.formRow}>
                  <span className={styles.label}>名字</span>
                  <input className={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：乙女向" />
                </div>
                <div className={styles.formRow}>
                  <span className={styles.label}>画出来的样子</span>
                  <p className={styles.hint}>创作者看不到。只影响画出来的效果。</p>
                  <textarea className={styles.textarea} rows={4} value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="例如：柔和、古风、线稿干净" />
                </div>
                <div className={styles.formRow}>
                  <span className={styles.label}>不要出现的东西</span>
                  <p className={styles.hint}>创作者也看不到。例如不要照片感、不要模糊。</p>
                  <textarea className={styles.textarea} rows={3} value={form.negative} onChange={(event) => setForm({ ...form, negative: event.target.value })} placeholder="例如：不要照片感、不要模糊、不要水印" />
                </div>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={form.visible}
                    onChange={(event) => setForm({ ...form, visible: event.target.checked })}
                  />
                  <span>给创作者选用</span>
                </label>
                <div className={styles.styleActions}>
                  <button type="button" className={styles.styleGhost} disabled={saving} onClick={() => setForm(null)}>取消</button>
                  <button type="button" className={styles.stylePrimary} disabled={saving} onClick={() => void onSave()}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="删除这个画风？"
        message={confirmDelete ? `删除「${confirmDelete.name}」后，创作者的画风列表里不再出现。` : ''}
        confirmButtonText="删除"
        tone="admin"
        onConfirm={() => { if (confirmDelete) void removeStyle(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
