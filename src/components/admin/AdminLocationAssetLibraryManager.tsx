/**
 * 运营中心 · 地点素材库：只管图；用途大地图图 / 地点场景图 / 封面。
 * 下架后编辑器素材库弹窗不再出现；作品里已选用的图不受影响。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  locationAssetLibraryApi,
  type LocationAssetLibraryItem,
  type LocationAssetPurpose,
} from '../../api/galgame/locationAssetLibrary';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './AdminLocationLibraryManager.module.css';

const PURPOSE_OPTS: { id: LocationAssetPurpose; label: string }[] = [
  { id: 'world_map', label: '大地图图' },
  { id: 'location_scene', label: '地点场景图' },
  { id: 'cover', label: '封面' },
];

type FormState = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  purpose: LocationAssetPurpose;
  tagsText: string;
  authorKul: string;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  imageUrl: '',
  purpose: 'location_scene',
  tagsText: '',
  authorKul: '',
  sortOrder: '0',
});

const splitTags = (raw: string) =>
  raw.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);

export default function AdminLocationAssetLibraryManager() {
  const token = useAuthStore((s) => s.user?.token) || '';
  const [items, setItems] = useState<LocationAssetLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<string>('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOff, setConfirmOff] = useState<LocationAssetLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await locationAssetLibraryApi.list(token, {
        q,
        purpose: purposeFilter || undefined,
        includeDisabled: true,
      });
      if (!res?.success) {
        toast.error(res?.message || '加载素材库失败');
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载素材库失败');
    } finally {
      setLoading(false);
    }
  }, [token, q, purposeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = !!form.id;
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    [items],
  );

  const onUpload = async (file: File | null) => {
    if (!file || !token) return;
    setUploading(true);
    try {
      const res = await locationAssetLibraryApi.upload(token, file);
      if (!res?.success || !res?.data?.imageUrl) {
        toast.error(res?.message || '上传失败');
        return;
      }
      setForm((f) => ({
        ...f,
        imageUrl: String(res.data.imageUrl),
        name: f.name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 40),
      }));
      toast.success('图片已上传');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    const name = form.name.trim();
    const imageUrl = form.imageUrl.trim();
    if (!name) {
      toast.error('请填写素材名称');
      return;
    }
    if (!imageUrl) {
      toast.error('请上传或填写图片');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description: form.description.trim(),
        imageUrl,
        purpose: form.purpose,
        tags: splitTags(form.tagsText),
        authorKul: form.authorKul.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = form.id
        ? await locationAssetLibraryApi.update(token, form.id, payload)
        : await locationAssetLibraryApi.create(token, payload);
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

  const toggleStatus = async (item: LocationAssetLibraryItem) => {
    if (!token) return;
    const res = item.status === 'active'
      ? await locationAssetLibraryApi.disable(token, item.id)
      : await locationAssetLibraryApi.enable(token, item.id);
    if (!res?.success) {
      toast.error(res?.message || '操作失败');
      return;
    }
    toast.success(item.status === 'active' ? '已下架（编辑器弹窗不再出现）' : '已上架');
    setConfirmOff(null);
    await load();
  };

  const purposeLabel = (p: string) => PURPOSE_OPTS.find((x) => x.id === p)?.label || p;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>地点素材库</h2>
        <p className={styles.desc}>
          只装图。编辑器大地图 / 地点上的「素材库」按用途筛选选图，只替换预览，不改地点结构。
          可按名称、作者库兰号搜索；下架后弹窗不再出现，作品里已选用的图保留。
        </p>
      </div>

      <div className={styles.form}>
        <strong>{editing ? '编辑素材' : '上传素材'}</strong>
        <div className={styles.formRow}>
          <span className={styles.label}>名称</span>
          <input className={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="素材名称" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>说明</span>
          <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="可选说明" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>用途</span>
          <select
            className={styles.input}
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value as LocationAssetPurpose }))}
          >
            {PURPOSE_OPTS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>作者库兰号</span>
          <input className={styles.input} value={form.authorKul} onChange={(e) => setForm((f) => ({ ...f, authorKul: e.target.value }))} placeholder="如：0761481355" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>标签</span>
          <input className={styles.input} value={form.tagsText} onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))} placeholder="顿号 / 逗号分隔" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>图片</span>
          <input className={styles.input} value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="图片 URL，或下方上传" />
          <input type="file" accept="image/*" disabled={uploading} onChange={(e) => void onUpload(e.target.files?.[0] || null)} />
          {form.imageUrl ? <img className={styles.thumb} src={getImageUrl(form.imageUrl)} alt="预览" /> : null}
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>排序（越小越靠前）</span>
          <input className={styles.input} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void onSave()}>
            {saving ? '保存中…' : editing ? '保存修改' : '新增'}
          </button>
          {editing ? (
            <button type="button" className={styles.btn} onClick={() => setForm(emptyForm())}>取消编辑</button>
          ) : null}
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          style={{ maxWidth: 240 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称 / 库兰号 / 标签"
        />
        <select
          className={styles.input}
          style={{ maxWidth: 160 }}
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value)}
        >
          <option value="">全部用途</option>
          {PURPOSE_OPTS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {!sorted.length ? (
        <div className={styles.empty}>{loading ? '加载中…' : '暂无素材，请先上传'}</div>
      ) : (
        <div className={styles.grid}>
          {sorted.map((item) => (
            <article key={item.id} className={styles.card}>
              {item.imageUrl ? (
                <img className={styles.thumb} src={getImageUrl(item.imageUrl)} alt={item.name} />
              ) : (
                <div className={styles.thumb} />
              )}
              <div className={styles.body}>
                <span className={item.status === 'active' ? styles.badge : styles.badgeOff}>
                  {item.status === 'active' ? '上架' : '下架'} · {purposeLabel(item.purpose)}
                </span>
                <h3 className={styles.name}>{item.name}</h3>
                <p className={styles.meta}>{item.description || '（无说明）'}</p>
                <p className={styles.meta}>
                  {item.authorKul ? `库兰 ${item.authorKul}` : '未填库兰号'}
                  {item.tags?.length ? ` · ${item.tags.join('、')}` : ''}
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setForm({
                      id: item.id,
                      name: item.name,
                      description: item.description || '',
                      imageUrl: item.imageUrl || '',
                      purpose: item.purpose,
                      tagsText: (item.tags || []).join('、'),
                      authorKul: item.authorKul || '',
                      sortOrder: String(item.sortOrder ?? 0),
                    })}
                  >
                    编辑
                  </button>
                  {item.status === 'active' ? (
                    <button type="button" className={styles.btnDanger} onClick={() => setConfirmOff(item)}>下架</button>
                  ) : (
                    <button type="button" className={styles.btn} onClick={() => void toggleStatus(item)}>上架</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmOff}
        title="下架素材？"
        message={confirmOff ? `下架「${confirmOff.name}」后，编辑器素材库弹窗不再出现；作品里已选用的图会保留。` : ''}
        confirmButtonText="下架"
        tone="admin"
        onConfirm={() => { if (confirmOff) void toggleStatus(confirmOff); }}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
}
