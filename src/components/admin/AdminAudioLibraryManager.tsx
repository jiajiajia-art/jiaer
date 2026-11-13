/**
 * 运营中心 · 音频库：平台公共曲库（背景音乐 / 短音效 / 环境氛围音）。
 * 上架曲目出现在创作者编辑器「音乐 → 平台音乐素材库」；下架后不再可选，已引用的作品不受影响。
 * 版式沿用地点素材库。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { audioLibraryApi, type AudioLibraryItem, type AudioLibraryKind } from '../../api/galgame/audioLibrary';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './AdminLocationLibraryManager.module.css';

const KIND_OPTS: { id: AudioLibraryKind; label: string }[] = [
  { id: 'bgm', label: '背景音乐' },
  { id: 'sfx', label: '短音效' },
  { id: 'amb', label: '环境氛围音' },
];
const MAX_MB = 30;

type FormState = {
  id?: string;
  name: string;
  description: string;
  audioUrl: string;
  kind: AudioLibraryKind;
  loop: boolean;
  durationSec?: number;
  tagsText: string;
  authorKul: string;
  sortOrder: string;
};

const emptyForm = (): FormState => ({ name: '', description: '', audioUrl: '', kind: 'bgm', loop: true, tagsText: '', authorKul: '', sortOrder: '0' });
const splitTags = (raw: string) => raw.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
const fmtDur = (s?: number) => (s && s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

/** 功能注释：读取本地音频时长，存进条目便于创作者挑选 */
function probeDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : undefined); URL.revokeObjectURL(url); };
    a.onerror = () => { resolve(undefined); URL.revokeObjectURL(url); };
    a.src = url;
  });
}

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
      const res = await audioLibraryApi.list(token, { q, kind: kindFilter || undefined, includeDisabled: true });
      if (!res?.success) {
        toast.error(res?.message || '加载音频库失败');
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载音频库失败');
    } finally {
      setLoading(false);
    }
  }, [token, q, kindFilter]);

  useEffect(() => { void load(); }, [load]);

  const editing = !!form.id;
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
    [items],
  );

  const onUpload = async (file: File | null) => {
    if (!file || !token) return;
    if (!/\.(mp3|ogg|wav|m4a)$/i.test(file.name)) {
      toast.error('只支持 mp3 / ogg / wav / m4a');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`文件不能超过 ${MAX_MB}MB`);
      return;
    }
    setUploading(true);
    try {
      const [res, durationSec] = await Promise.all([audioLibraryApi.upload(token, file), probeDuration(file)]);
      const url = res?.data?.audioUrl || res?.data?.url;
      if (!res?.success || !url) {
        toast.error(res?.message || '上传失败');
        return;
      }
      setForm((f) => ({ ...f, audioUrl: String(url), durationSec: durationSec ?? f.durationSec, name: f.name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 40) }));
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
    if (!name) { toast.error('请填写曲目名称'); return; }
    if (!audioUrl) { toast.error('请上传或填写音频地址'); return; }
    setSaving(true);
    try {
      const payload = {
        name,
        description: form.description.trim(),
        audioUrl,
        kind: form.kind,
        loop: form.loop,
        ...(form.durationSec ? { durationSec: form.durationSec } : {}),
        tags: splitTags(form.tagsText),
        authorKul: form.authorKul.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = form.id ? await audioLibraryApi.update(token, form.id, payload) : await audioLibraryApi.create(token, payload);
      if (!res?.success) { toast.error(res?.message || '保存失败'); return; }
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
    const res = item.status === 'active' ? await audioLibraryApi.disable(token, item.id) : await audioLibraryApi.enable(token, item.id);
    if (!res?.success) { toast.error(res?.message || '操作失败'); return; }
    toast.success(item.status === 'active' ? '已下架（编辑器里不再可选）' : '已上架');
    setConfirmOff(null);
    await load();
  };

  const kindLabel = (k: string) => KIND_OPTS.find((x) => x.id === k)?.label || k;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>音频库</h2>
        <p className={styles.desc}>
          平台公共曲库。上架的曲目会出现在创作者编辑器「音乐 → 平台音乐素材库」，可作为背景音乐、地点音乐或音效使用；
          创作者只能选用和试听，不能修改原曲。下架后编辑器里不再可选，已引用的作品照常播放。
        </p>
      </div>

      <div className={styles.form}>
        <strong>{editing ? '编辑曲目' : '上传曲目'}</strong>
        <div className={styles.formRow}>
          <span className={styles.label}>名称</span>
          <input className={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="曲目名称" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>说明</span>
          <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="可选：适合的场景、情绪" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>类型</span>
          <select
            className={styles.input}
            value={form.kind}
            onChange={(e) => { const kind = e.target.value as AudioLibraryKind; setForm((f) => ({ ...f, kind, loop: kind !== 'sfx' })); }}
          >
            {KIND_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>循环播放</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={form.loop} onChange={(e) => setForm((f) => ({ ...f, loop: e.target.checked }))} />
            {form.loop ? '循环' : '只播一次'}
          </label>
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>作者库兰号</span>
          <input className={styles.input} value={form.authorKul} onChange={(e) => setForm((f) => ({ ...f, authorKul: e.target.value }))} placeholder="如：0761481355" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>标签</span>
          <input className={styles.input} value={form.tagsText} onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))} placeholder="顿号 / 逗号分隔，如：悬疑、雨夜" />
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>音频</span>
          <input className={styles.input} value={form.audioUrl} onChange={(e) => setForm((f) => ({ ...f, audioUrl: e.target.value }))} placeholder="音频 URL，或下方上传（mp3 / ogg / wav / m4a，≤30MB）" />
          <input type="file" accept=".mp3,.ogg,.wav,.m4a,audio/*" disabled={uploading} onChange={(e) => void onUpload(e.target.files?.[0] || null)} />
          {uploading ? <span className={styles.meta}>上传中…</span> : null}
          {form.audioUrl ? <audio controls preload="none" src={getImageUrl(form.audioUrl)} style={{ width: '100%', maxWidth: 360 }} /> : null}
          {form.durationSec ? <span className={styles.meta}>时长 {fmtDur(form.durationSec)}</span> : null}
        </div>
        <div className={styles.formRow}>
          <span className={styles.label}>排序（越小越靠前）</span>
          <input className={styles.input} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnPrimary} disabled={saving || uploading} onClick={() => void onSave()}>
            {saving ? '保存中…' : editing ? '保存修改' : '新增'}
          </button>
          {editing ? <button type="button" className={styles.btn} onClick={() => setForm(emptyForm())}>取消编辑</button> : null}
        </div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.input} style={{ maxWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称 / 库兰号 / 标签" />
        <select className={styles.input} style={{ maxWidth: 160 }} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">全部类型</option>
          {KIND_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
      </div>

      {!sorted.length ? (
        <div className={styles.empty}>{loading ? '加载中…' : '暂无曲目，请先上传'}</div>
      ) : (
        <div className={styles.grid}>
          {sorted.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.body}>
                <span className={item.status === 'active' ? styles.badge : styles.badgeOff}>
                  {item.status === 'active' ? '上架' : '下架'} · {kindLabel(item.kind)}{item.loop === false ? ' · 单次' : ''}
                </span>
                <h3 className={styles.name}>{item.name}</h3>
                {item.audioUrl ? <audio controls preload="none" src={getImageUrl(item.audioUrl)} style={{ width: '100%' }} /> : null}
                <p className={styles.meta}>{item.description || '（无说明）'}{item.durationSec ? ` · ${fmtDur(item.durationSec)}` : ''}</p>
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
                      audioUrl: item.audioUrl || '',
                      kind: item.kind,
                      loop: item.loop ?? item.kind !== 'sfx',
                      durationSec: item.durationSec,
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
        title="下架曲目？"
        message={confirmOff ? `下架「${confirmOff.name}」后，编辑器里不再可选；已引用的作品照常播放。` : ''}
        confirmButtonText="下架"
        tone="admin"
        onConfirm={() => { if (confirmOff) void toggleStatus(confirmOff); }}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
}
