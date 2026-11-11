/**
 * 运营中心 · 地点库：新增 / 修改 / 停用；字段至少名称、简介、图片。
 * 停用后编辑器「从地点库添加」不再展示；已写入作品的地点副本不自动删除。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { locationLibraryApi, type LocationLibraryItem } from '../../api/galgame/locationLibrary';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './AdminLocationLibraryManager.module.css';

type FormState = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  tagsText: string;
  authorKul: string;
  /** 功能注释：大地图地点树 JSON 文本；空 = 导入时退化为单地点 */
  treeJsonText: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  imageUrl: '',
  sortOrder: '0',
  tagsText: '',
  authorKul: '',
  treeJsonText: '',
});

const splitTags = (raw: string) =>
  raw.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);

const TREE_PLACEHOLDER = `{
  "rooms": [
    { "key": "hall", "name": "前厅", "description": "你来到了「前厅」。" },
    { "key": "din", "name": "前厅餐室", "parentKey": "hall", "description": "你来到了「前厅餐室」。" }
  ]
}`;

export default function AdminLocationLibraryManager() {
  const token = useAuthStore((s) => s.user?.token) || '';
  const [items, setItems] = useState<LocationLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOff, setConfirmOff] = useState<LocationLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await locationLibraryApi.list(token, { q, includeDisabled: true });
      if (!res?.success) {
        toast.error(res?.message || '加载地点库失败');
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载地点库失败');
    } finally {
      setLoading(false);
    }
  }, [token, q]);

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
      const res = await locationLibraryApi.upload(token, file);
      if (!res?.success || !res?.data?.imageUrl) {
        toast.error(res?.message || '上传失败');
        return;
      }
      setForm((f) => ({ ...f, imageUrl: String(res.data.imageUrl) }));
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
      toast.error('请填写大地图名称');
      return;
    }
    if (!imageUrl) {
      toast.error('请上传或填写大地图封面图');
      return;
    }
    type TreePayload = { rooms: { key: string; name: string; description?: string; imageUrl?: string; parentKey?: string | null; order?: number }[] };
    let treeJson: TreePayload | null = null;
    const treeRaw = form.treeJsonText.trim();
    if (treeRaw) {
      try {
        const parsed: unknown = JSON.parse(treeRaw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { rooms?: unknown }).rooms)) {
          toast.error('地点树须为 { rooms: [...] }');
          return;
        }
        treeJson = parsed as TreePayload;
      } catch {
        toast.error('地点树 JSON 格式不对');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description: form.description.trim(),
        imageUrl,
        sortOrder: Number(form.sortOrder) || 0,
        tags: splitTags(form.tagsText),
        authorKul: form.authorKul.trim(),
        treeJson,
      };
      const res = form.id
        ? await locationLibraryApi.update(token, form.id, payload)
        : await locationLibraryApi.create(token, payload);
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

  const toggleStatus = async (item: LocationLibraryItem) => {
    if (!token) return;
    const res = item.status === 'active'
      ? await locationLibraryApi.disable(token, item.id)
      : await locationLibraryApi.enable(token, item.id);
    if (!res?.success) {
      toast.error(res?.message || '操作失败');
      return;
    }
    toast.success(item.status === 'active' ? '已下架（编辑器弹窗不再出现）' : '已上架');
    setConfirmOff(null);
    await load();
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>地点库</h2>
        <p className={styles.desc}>
          装「大地图 + 地点树」整包。创作者「从地点库添加」会复制进作品；下架后弹窗不再出现，已加进作品的包不受影响。
          可按名称、作者库兰号搜索。
        </p>
      </div>

      <div className={styles.form}>
        <strong>{editing ? '编辑地点包' : '新增地点包'}</strong>
        <div className={styles.formRow}>
          <span className={styles.label}>名称</span>
          <input className={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：雾色旅馆" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>说明</span>
          <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="说明（创作者选库时可见）" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>作者库兰号</span>
          <input className={styles.input} value={form.authorKul} onChange={(e) => setForm((f) => ({ ...f, authorKul: e.target.value }))} placeholder="如：0761481355" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>标签</span>
          <input className={styles.input} value={form.tagsText} onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))} placeholder="顿号 / 逗号分隔，如：旅馆、民国" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>封面图</span>
          <input className={styles.input} value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="图片 URL，或下方上传" />
          <input type="file" accept="image/*" disabled={uploading} onChange={(e) => void onUpload(e.target.files?.[0] || null)} />
          {form.imageUrl ? (
            <img className={styles.thumb} src={getImageUrl(form.imageUrl)} alt="预览" />
          ) : null}
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>地点树 JSON（可选）</span>
          <textarea
            className={styles.textarea}
            style={{ minHeight: 140, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
            value={form.treeJsonText}
            onChange={(e) => setForm((f) => ({ ...f, treeJsonText: e.target.value }))}
            placeholder={TREE_PLACEHOLDER}
          />
          <span className={styles.meta}>留空则导入时只生成一个与大地图同名的顶层地点。rooms[].key 唯一；parentKey 指向父节点 key。</span>
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
          style={{ maxWidth: 280 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称 / 作者库兰号 / 标签"
        />
        <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {!sorted.length ? (
        <div className={styles.empty}>{loading ? '加载中…' : '暂无地点包，请先新增'}</div>
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
                  {item.status === 'active' ? '上架' : '下架'}
                </span>
                <h3 className={styles.name}>{item.name}</h3>
                <p className={styles.meta}>{item.description || '（无说明）'}</p>
                <p className={styles.meta}>
                  地点 {Array.isArray(item.treeJson?.rooms) ? item.treeJson.rooms.length : 1} 个
                  {item.authorKul ? ` · 库兰 ${item.authorKul}` : ''}
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
                      sortOrder: String(item.sortOrder ?? 0),
                      tagsText: (item.tags || []).join('、'),
                      authorKul: item.authorKul || '',
                      treeJsonText: item.treeJson ? JSON.stringify(item.treeJson, null, 2) : '',
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
        title="下架地点包？"
        message={confirmOff ? `下架「${confirmOff.name}」后，编辑器地点库弹窗不再出现；已经加进作品里的地点包会保留。` : ''}
        confirmButtonText="下架"
        tone="admin"
        onConfirm={() => { if (confirmOff) void toggleStatus(confirmOff); }}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
}
