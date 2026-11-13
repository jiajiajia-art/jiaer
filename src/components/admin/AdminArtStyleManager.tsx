/**
 * 素材中心 · 画风管理：配置生图画风（名称、正向提示词、负面词、示例图、排序、上下架）。
 * 上架项出现在编辑器所有生图入口的画风选择里；接口未上线 / 库为空时编辑器用内置预设。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { artStyleLibraryApi, type ArtStyleLibraryItem } from '../../api/galgame/artStyleLibrary';
import { ART_STYLE_PRESETS } from '../../../Romance/src/lib/editorImagePrompts';
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

const emptyForm = (): FormState => ({ key: '', name: '', prompt: '', negative: '', sampleUrl: '', swatch: '', sortOrder: '0' });

export default function AdminArtStyleManager() {
  const token = useAuthStore((s) => s.user?.token) || '';
  const [items, setItems] = useState<ArtStyleLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [confirmOff, setConfirmOff] = useState<ArtStyleLibraryItem | null>(null);

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
        toast.error(res?.message || '加载画风失败');
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载画风失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [items],
  );

  const onUpload = async (file: File | null) => {
    if (!file || !token) return;
    setUploading(true);
    try {
      const res = await artStyleLibraryApi.upload(token, file);
      if (!res?.success || !res?.data?.imageUrl) {
        toast.error(res?.message || '上传失败');
        return;
      }
      setForm((f) => ({ ...f, sampleUrl: String(res.data.imageUrl) }));
      toast.success('示例图已上传');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    const name = form.name.trim();
    const prompt = form.prompt.trim();
    const key = form.key.trim() || `style_${Date.now().toString(36)}`;
    if (!name) { toast.error('请填写画风名称'); return; }
    if (!prompt) { toast.error('请填写正向提示词'); return; }
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
      const res = form.id ? await artStyleLibraryApi.update(token, form.id, payload) : await artStyleLibraryApi.create(token, payload);
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

  // 功能注释：库为空时一键导入内置 9 种画风，运营再逐个补示例图 / 改提示词
  const seedBuiltins = async () => {
    if (!token) return;
    setSeeding(true);
    let ok = 0;
    const existing = new Set(items.map((x) => x.key));
    for (const [i, p] of ART_STYLE_PRESETS.entries()) {
      if (existing.has(p.id)) continue;
      const res = await artStyleLibraryApi.create(token, { key: p.id, name: p.label, prompt: p.prompt, negative: p.negative, swatch: p.swatch, sortOrder: i * 10 }).catch(() => null);
      if (res?.success) ok++;
    }
    setSeeding(false);
    toast.success(`已导入 ${ok} 个内置画风`);
    await load();
  };

  const toggleStatus = async (item: ArtStyleLibraryItem) => {
    if (!token) return;
    const res = item.status === 'active' ? await artStyleLibraryApi.disable(token, item.id) : await artStyleLibraryApi.enable(token, item.id);
    if (!res?.success) { toast.error(res?.message || '操作失败'); return; }
    toast.success(item.status === 'active' ? '已下架（编辑器不再显示）' : '已上架');
    setConfirmOff(null);
    await load();
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>画风管理</h2>
        <p className={styles.desc}>
          配置编辑器生图时可选的画风：名称、正向提示词（建议「质量层 + 风格层」，约 75 词内）、负面词（选中时并入，用于排除三次元 / 低质）和示例图。
          上架项按排序出现在单张生图、批量生图、人物头像生图的画风选择里；库为空时编辑器使用内置预设。
        </p>
      </div>

      {apiMissing ? (
        <div className={styles.empty}>后端画风库接口（/api/art-style-library）尚未上线，编辑器当前使用内置 9 种画风。接口上线后即可在此配置。</div>
      ) : (
        <>
          <div className={styles.form}>
            <strong>{form.id ? '编辑画风' : '新增画风'}</strong>
            <div className={styles.formRow}>
              <span className={styles.label}>名称</span>
              <input className={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="如：乙女向" />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>Key（英文，唯一）</span>
              <input className={styles.input} value={form.key} disabled={!!form.id} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.replace(/[^\w-]/g, '') }))} placeholder="如：otome；留空自动生成" />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>正向提示词</span>
              <textarea className={styles.textarea} rows={4} value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} placeholder="masterpiece, best quality, highly detailed, elegant otome game character art, ..." />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>负面词</span>
              <textarea className={styles.textarea} rows={2} value={form.negative} onChange={(e) => setForm((f) => ({ ...f, negative: e.target.value }))} placeholder="photorealistic, 3d render, lowres, bad anatomy, watermark ..." />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>示例图（竖版 3:4）</span>
              <input className={styles.input} value={form.sampleUrl} onChange={(e) => setForm((f) => ({ ...f, sampleUrl: e.target.value }))} placeholder="图片 URL，或下方上传" />
              <input type="file" accept="image/*" disabled={uploading} onChange={(e) => void onUpload(e.target.files?.[0] || null)} />
              {form.sampleUrl ? <img className={styles.thumb} src={getImageUrl(form.sampleUrl)} alt="示例图预览" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} /> : null}
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>色块（无示例图时显示）</span>
              <input className={styles.input} value={form.swatch} onChange={(e) => setForm((f) => ({ ...f, swatch: e.target.value }))} placeholder="CSS 背景，如 linear-gradient(135deg,#ffd6e0,#a8c8ff)" />
            </div>
            <div className={styles.formRow}>
              <span className={styles.label}>排序（越小越靠前）</span>
              <input className={styles.input} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
            </div>
            <div className={styles.toolbar}>
              <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void onSave()}>
                {saving ? '保存中…' : form.id ? '保存修改' : '新增'}
              </button>
              {form.id ? <button type="button" className={styles.btn} onClick={() => setForm(emptyForm())}>取消编辑</button> : null}
            </div>
          </div>

          <div className={styles.toolbar}>
            <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
            <button type="button" className={styles.btn} onClick={() => void seedBuiltins()} disabled={seeding || loading}>
              {seeding ? '导入中…' : '导入内置画风'}
            </button>
          </div>

          {!sorted.length ? (
            <div className={styles.empty}>{loading ? '加载中…' : '画风库为空，编辑器正在使用内置预设。可点「导入内置画风」后再补示例图。'}</div>
          ) : (
            <div className={styles.grid}>
              {sorted.map((item) => (
                <article key={item.id} className={styles.card}>
                  {item.sampleUrl ? (
                    <img className={styles.thumb} src={getImageUrl(item.sampleUrl)} alt={item.name} style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
                  ) : (
                    <div className={styles.thumb} style={{ aspectRatio: '3 / 4', background: item.swatch || undefined }} />
                  )}
                  <div className={styles.body}>
                    <span className={item.status === 'active' ? styles.badge : styles.badgeOff}>
                      {item.status === 'active' ? '上架' : '下架'} · {item.key}
                    </span>
                    <h3 className={styles.name}>{item.name}</h3>
                    <p className={styles.meta} title={item.prompt}>{item.prompt.length > 90 ? `${item.prompt.slice(0, 90)}…` : item.prompt}</p>
                    {!item.sampleUrl ? <p className={styles.meta}>未上传示例图</p> : null}
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => setForm({
                          id: item.id,
                          key: item.key,
                          name: item.name,
                          prompt: item.prompt,
                          negative: item.negative || '',
                          sampleUrl: item.sampleUrl || '',
                          swatch: item.swatch || '',
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
        </>
      )}

      <ConfirmModal
        isOpen={!!confirmOff}
        title="下架画风？"
        message={confirmOff ? `下架「${confirmOff.name}」后，编辑器画风选择里不再出现；作品里已保存的画风文字不受影响。` : ''}
        confirmButtonText="下架"
        tone="admin"
        onConfirm={() => { if (confirmOff) void toggleStatus(confirmOff); }}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
}
