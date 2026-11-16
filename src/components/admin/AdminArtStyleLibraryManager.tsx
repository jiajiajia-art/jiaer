/**
 * 运营中心 · 画风管理：名称、标识、正/负提示词、示例图、上下架。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { artStyleLibraryApi, type ArtStyleLibraryItem } from '../../api/galgame/artStyleLibrary';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './AdminLocationLibraryManager.module.css';

type FormState = {
  id?: string;
  key: string;
  name: string;
  prompt: string;
  negative: string;
  sampleUrl: string;
  swatch: string;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  key: '',
  name: '',
  prompt: '',
  negative: '',
  sampleUrl: '',
  swatch: '',
  sortOrder: '0',
});

export default function AdminArtStyleLibraryManager() {
  const token = useAuthStore((s) => s.user?.token) || '';
  const [items, setItems] = useState<ArtStyleLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOff, setConfirmOff] = useState<ArtStyleLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await artStyleLibraryApi.list(token, { includeDisabled: true });
      if (!res?.success) {
        toast.error(res?.message || '加载画风库失败');
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载画风库失败');
    } finally {
      setLoading(false);
    }
  }, [token, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = !!form.id;
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
      ),
    [items],
  );

  const onUpload = async (file: File | null) => {
    if (!file || !token) return;
    setUploading(true);
    try {
      const res = await artStyleLibraryApi.upload(token, file);
      if (!res?.success || !res?.data?.sampleUrl) {
        toast.error(res?.message || '上传失败');
        return;
      }
      setForm((f) => ({ ...f, sampleUrl: String(res.data.sampleUrl) }));
      toast.success('示例图已上传');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    const key = form.key.trim();
    const name = form.name.trim();
    const prompt = form.prompt.trim();
    if (!key) {
      toast.error('请填写画风标识');
      return;
    }
    if (!name) {
      toast.error('请填写画风名称');
      return;
    }
    if (!prompt) {
      toast.error('请填写正向提示词');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        key,
        name,
        prompt,
        negative: form.negative.trim(),
        sampleUrl: form.sampleUrl.trim(),
        swatch: form.swatch.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = form.id
        ? await artStyleLibraryApi.update(token, form.id, payload)
        : await artStyleLibraryApi.create(token, payload);
      if (!res?.success) {
        toast.error(res?.message || '保存失败');
        return;
      }
      toast.success(form.id ? '已更新' : '已新增');
      setForm(emptyForm());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: ArtStyleLibraryItem) => {
    if (!token) return;
    const res =
      item.status === 'active'
        ? await artStyleLibraryApi.disable(token, item.id)
        : await artStyleLibraryApi.enable(token, item.id);
    if (!res?.success) {
      toast.error(res?.message || '操作失败');
      return;
    }
    toast.success(item.status === 'active' ? '已下架' : '已上架');
    setConfirmOff(null);
    await load();
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>画风管理</h2>
        <p className={styles.desc}>
          编辑器生图优先读上架画风；接口为空时退回内置 9 种。标识发布后勿改。
        </p>
      </div>

      <div className={styles.form}>
        <strong>{editing ? '编辑画风' : '新增画风'}</strong>
        <div className={styles.formRow}>
          <span className={styles.label}>标识 key</span>
          <input
            className={styles.input}
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            placeholder="如 anime_ink"
            disabled={editing}
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>名称</span>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="画风名称"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>正向提示词</span>
          <textarea
            className={styles.textarea}
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
            placeholder="追加到生图提示词"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>负面提示词</span>
          <textarea
            className={styles.textarea}
            value={form.negative}
            onChange={(e) => setForm((f) => ({ ...f, negative: e.target.value }))}
            placeholder="可选"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>色板</span>
          <input
            className={styles.input}
            value={form.swatch}
            onChange={(e) => setForm((f) => ({ ...f, swatch: e.target.value }))}
            placeholder="#A8283C 或简短色名"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>示例图</span>
          <input
            className={styles.input}
            value={form.sampleUrl}
            onChange={(e) => setForm((f) => ({ ...f, sampleUrl: e.target.value }))}
            placeholder="图片 URL，或下方上传"
          />
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => void onUpload(e.target.files?.[0] || null)}
          />
          {form.sampleUrl ? <img className={styles.thumb} src={getImageUrl(form.sampleUrl)} alt="预览" /> : null}
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>排序（越小越靠前）</span>
          <input
            className={styles.input}
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void onSave()}>
            {saving ? '保存中…' : editing ? '保存修改' : '新增'}
          </button>
          {editing ? (
            <button type="button" className={styles.btn} onClick={() => setForm(emptyForm())}>
              取消编辑
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          style={{ maxWidth: 240 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称 / 标识 / 提示词"
        />
        <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {!sorted.length ? (
        <div className={styles.empty}>{loading ? '加载中…' : '暂无画风'}</div>
      ) : (
        <div className={styles.grid}>
          {sorted.map((item) => (
            <article key={item.id} className={styles.card}>
              {item.sampleUrl ? (
                <img className={styles.thumb} src={getImageUrl(item.sampleUrl)} alt={item.name} />
              ) : (
                <div className={styles.thumb} style={{ background: item.swatch || '#333' }} />
              )}
              <div className={styles.body}>
                <span className={item.status === 'active' ? styles.badge : styles.badgeOff}>
                  {item.status === 'active' ? '上架' : '下架'} · {item.key}
                </span>
                <h3 className={styles.name}>{item.name}</h3>
                <p className={styles.meta}>{item.prompt.slice(0, 80) || '（无提示词）'}</p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() =>
                      setForm({
                        id: item.id,
                        key: item.key,
                        name: item.name,
                        prompt: item.prompt || '',
                        negative: item.negative || '',
                        sampleUrl: item.sampleUrl || '',
                        swatch: item.swatch || '',
                        sortOrder: String(item.sortOrder ?? 0),
                      })
                    }
                  >
                    编辑
                  </button>
                  {item.status === 'active' ? (
                    <button type="button" className={styles.btnDanger} onClick={() => setConfirmOff(item)}>
                      下架
                    </button>
                  ) : (
                    <button type="button" className={styles.btn} onClick={() => void toggleStatus(item)}>
                      上架
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmOff}
        title="下架画风？"
        message={confirmOff ? `下架「${confirmOff.name}」后编辑器不再优先展示该画风。` : ''}
        confirmButtonText="下架"
        tone="admin"
        onConfirm={() => {
          if (confirmOff) void toggleStatus(confirmOff);
        }}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
}
