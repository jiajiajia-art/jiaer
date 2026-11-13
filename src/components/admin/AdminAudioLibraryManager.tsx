/**
 * 运营中心 · 音频库：上传 / 编辑 / 上下架平台公共曲目；下架不删文件。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  audioLibraryApi,
  type AudioLibraryItem,
  type AudioLibraryKind,
} from '../../api/galgame/audioLibrary';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './AdminLocationLibraryManager.module.css';

const KIND_OPTS: { id: AudioLibraryKind; label: string }[] = [
  { id: 'bgm', label: 'BGM' },
  { id: 'sfx', label: '音效' },
  { id: 'amb', label: '环境音' },
];

type FormState = {
  id?: string;
  name: string;
  description: string;
  audioUrl: string;
  kind: AudioLibraryKind;
  loop: boolean;
  durationSec: string;
  tagsText: string;
  authorKul: string;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  audioUrl: '',
  kind: 'bgm',
  loop: true,
  durationSec: '',
  tagsText: '',
  authorKul: '',
  sortOrder: '0',
});

const splitTags = (raw: string) =>
  raw.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);

export default function AdminAudioLibraryManager() {
  const token = useAuthStore((s) => s.user?.token) || '';
  const [items, setItems] = useState<AudioLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOff, setConfirmOff] = useState<AudioLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await audioLibraryApi.list(token, {
        q,
        kind: kindFilter || undefined,
        includeDisabled: true,
      });
      if (!res?.success) {
        toast.error(res?.message || '加载音频库失败');
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载音频库失败');
    } finally {
      setLoading(false);
    }
  }, [token, q, kindFilter]);

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
      const res = await audioLibraryApi.upload(token, file);
      if (!res?.success || !res?.data?.audioUrl) {
        toast.error(res?.message || '上传失败');
        return;
      }
      setForm((f) => ({
        ...f,
        audioUrl: String(res.data.audioUrl),
        name: f.name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 40),
      }));
      toast.success('音频已上传');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    const name = form.name.trim();
    const audioUrl = form.audioUrl.trim();
    if (!name) {
      toast.error('请填写曲目名称');
      return;
    }
    if (!audioUrl) {
      toast.error('请上传或填写音频地址');
      return;
    }
    setSaving(true);
    try {
      const durationRaw = form.durationSec.trim();
      const payload = {
        name,
        description: form.description.trim(),
        audioUrl,
        kind: form.kind,
        loop: form.loop,
        durationSec: durationRaw === '' ? null : Number(durationRaw),
        tags: splitTags(form.tagsText),
        authorKul: form.authorKul.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = form.id
        ? await audioLibraryApi.update(token, form.id, payload)
        : await audioLibraryApi.create(token, payload);
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

  const toggleStatus = async (item: AudioLibraryItem) => {
    if (!token) return;
    const res =
      item.status === 'active'
        ? await audioLibraryApi.disable(token, item.id)
        : await audioLibraryApi.enable(token, item.id);
    if (!res?.success) {
      toast.error(res?.message || '操作失败');
      return;
    }
    toast.success(item.status === 'active' ? '已下架（编辑器曲库不再出现）' : '已上架');
    setConfirmOff(null);
    await load();
  };

  const kindLabel = (k: string) => KIND_OPTS.find((x) => x.id === k)?.label || k;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>音频库</h2>
        <p className={styles.desc}>
          平台公共曲目。Romance 编辑器「平台音乐素材库」只读上架项；下架不删文件，作品已引用的曲目仍可播放。
        </p>
      </div>

      <div className={styles.form}>
        <strong>{editing ? '编辑曲目' : '上传曲目'}</strong>
        <div className={styles.formRow}>
          <span className={styles.label}>名称</span>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="曲目名称"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>说明</span>
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="可选说明"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>类型</span>
          <select
            className={styles.input}
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value as AudioLibraryKind;
              setForm((f) => ({ ...f, kind, loop: kind !== 'sfx' }));
            }}
          >
            {KIND_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>循环</span>
          <label>
            <input
              type="checkbox"
              checked={form.loop}
              onChange={(e) => setForm((f) => ({ ...f, loop: e.target.checked }))}
            />{' '}
            播放时循环
          </label>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>时长（秒）</span>
          <input
            className={styles.input}
            value={form.durationSec}
            onChange={(e) => setForm((f) => ({ ...f, durationSec: e.target.value }))}
            placeholder="可选"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>作者库兰号</span>
          <input
            className={styles.input}
            value={form.authorKul}
            onChange={(e) => setForm((f) => ({ ...f, authorKul: e.target.value }))}
            placeholder="可选"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>标签</span>
          <input
            className={styles.input}
            value={form.tagsText}
            onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))}
            placeholder="顿号 / 逗号分隔"
          />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>音频</span>
          <input
            className={styles.input}
            value={form.audioUrl}
            onChange={(e) => setForm((f) => ({ ...f, audioUrl: e.target.value }))}
            placeholder="音频 URL，或下方上传"
          />
          <input
            type="file"
            accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,.mp3,.ogg,.wav,.m4a"
            disabled={uploading}
            onChange={(e) => void onUpload(e.target.files?.[0] || null)}
          />
          {form.audioUrl ? (
            <audio controls src={form.audioUrl} style={{ width: '100%', marginTop: 8 }}>
              <track kind="captions" />
            </audio>
          ) : null}
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
          placeholder="搜索名称 / 库兰号 / 标签"
        />
        <select
          className={styles.input}
          style={{ maxWidth: 160 }}
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="">全部类型</option>
          {KIND_OPTS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {!sorted.length ? (
        <div className={styles.empty}>{loading ? '加载中…' : '暂无曲目，请先上传'}</div>
      ) : (
        <div className={styles.grid}>
          {sorted.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.body}>
                <span className={item.status === 'active' ? styles.badge : styles.badgeOff}>
                  {item.status === 'active' ? '上架' : '下架'} · {kindLabel(item.kind)}
                </span>
                <h3 className={styles.name}>{item.name}</h3>
                <p className={styles.meta}>{item.description || '（无说明）'}</p>
                <p className={styles.meta}>
                  id={item.id}
                  {item.authorKul ? ` · 库兰 ${item.authorKul}` : ''}
                  {item.tags?.length ? ` · ${item.tags.join('、')}` : ''}
                </p>
                {item.audioUrl ? (
                  <audio controls src={item.audioUrl} style={{ width: '100%', marginTop: 6 }}>
                    <track kind="captions" />
                  </audio>
                ) : null}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() =>
                      setForm({
                        id: item.id,
                        name: item.name,
                        description: item.description || '',
                        audioUrl: item.audioUrl || '',
                        kind: item.kind,
                        loop: item.loop ?? item.kind !== 'sfx',
                        durationSec: item.durationSec == null ? '' : String(item.durationSec),
                        tagsText: (item.tags || []).join('、'),
                        authorKul: item.authorKul || '',
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
        title="下架曲目？"
        message={
          confirmOff
            ? `下架「${confirmOff.name}」后编辑器曲库不再出现；作品里已引用的曲目仍可播放。`
            : ''
        }
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
