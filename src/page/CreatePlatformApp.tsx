/**
 * 创作应用：登录用户填写名称/图标/预览/分类/说明/类型/内容，保存为草稿；
 * authorId 用本人库兰号；上架后别人才能在商店安装。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppPageShell from '../components/Layout/AppPageShell';
import { useAuthStore } from '../store/useAuthStore';
import { isOperatorRole } from '../utils/userRoles';
import { getImageUrl } from '../utils/constants';
import {
  PLATFORM_APP_TYPE_OPTIONS,
  platformAppsApi,
  type PlatformApp,
  type PlatformAppType,
} from '../api/platform/platformAppsApi';
import styles from './CreatePlatformApp.module.css';

type FormState = {
  name: string;
  icon: string;
  previews: string[];
  summary: string;
  category: string;
  type: PlatformAppType;
  contentText: string;
};

const emptyForm = (): FormState => ({
  name: '',
  icon: '',
  previews: [],
  summary: '',
  category: '',
  type: 'browse',
  contentText: '',
});

const CreatePlatformApp: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.user?.token);
  const userCode = useAuthStore((s) => s.user?.user?.userCode);
  const role = useAuthStore((s) => s.user?.user?.role);
  const isStaff = isOperatorRole(role);
  const [mine, setMine] = useState<PlatformApp[]>([]);
  const [published, setPublished] = useState<PlatformApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadMine = useCallback(async () => {
    if (!token) {
      setMine([]);
      setPublished([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await platformAppsApi.listMine(token);
      if (!res.success) throw new Error(res.message || '加载失败');
      setMine(Array.isArray(res.data) ? res.data : []);
      // 功能注释：运营可改官方应用（如绿信图标）；拉已上架列表便于编辑同一条记录
      if (isStaff) {
        const pub = await platformAppsApi.listPublished(token);
        if (pub.success && Array.isArray(pub.data)) setPublished(pub.data);
      } else {
        setPublished([]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载我的应用失败');
    } finally {
      setLoading(false);
    }
  }, [token, isStaff]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const uploadImage = async (file: File | undefined): Promise<string | null> => {
    if (!file || !token) return null;
    const res = await platformAppsApi.upload(token, file);
    if (!res.success || !res.data?.imageUrl) {
      toast.error(res.message || '上传失败');
      return null;
    }
    return String(res.data.imageUrl);
  };

  const onPickIcon = async (file: File | undefined) => {
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, icon: url }));
  };

  const onPickPreview = async (file: File | undefined) => {
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, previews: [...f.previews, url].slice(0, 12) }));
  };

  const startEdit = (app: PlatformApp) => {
    setEditingId(app.appId);
    const contentText =
      typeof app.content === 'string'
        ? app.content
        : app.content && typeof app.content === 'object' && 'text' in (app.content as object)
          ? String((app.content as { text?: string }).text || '')
          : app.content
            ? JSON.stringify(app.content)
            : '';
    setForm({
      name: app.name || '',
      icon: app.icon || '',
      previews: Array.isArray(app.previews) ? app.previews : [],
      summary: app.summary || '',
      category: app.category || '',
      type: (PLATFORM_APP_TYPE_OPTIONS.some((o) => o.value === app.type)
        ? app.type
        : 'browse') as PlatformAppType,
      contentText,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!token) {
      toast.error('请先登录');
      navigate('/profile');
      return;
    }
    if (!form.name.trim()) {
      toast.error('请填写应用名称');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        icon: form.icon,
        previews: form.previews,
        summary: form.summary.trim(),
        category: form.category.trim(),
        type: form.type,
        content: { text: form.contentText },
      };
      const res = editingId
        ? await platformAppsApi.update(token, editingId, body)
        : await platformAppsApi.create(token, body);
      if (!res.success) throw new Error(res.message || '保存失败');
      toast.success(editingId ? '已保存' : '已保存为草稿');
      resetForm();
      await loadMine();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (appId: string) => {
    if (!token) return;
    try {
      const res = await platformAppsApi.publish(token, appId);
      if (!res.success) throw new Error(res.message || '上架失败');
      toast.success('已上架，别人可以安装了');
      await loadMine();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '上架失败');
    }
  };

  const unpublish = async (appId: string) => {
    if (!token) return;
    try {
      const res = await platformAppsApi.unpublish(token, appId);
      if (!res.success) throw new Error(res.message || '下架失败');
      toast.success('已下架为草稿');
      await loadMine();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '下架失败');
    }
  };

  // 功能注释：顶/底栏避让交给 AppPageShell，避免固定顶栏挡住「填写名称…」说明文案
  return (
    <AppPageShell shellClassName={styles.pageRoot} mainClassName={styles.main}>
        <h1 className={styles.title}>创作应用</h1>
        <p className={styles.hint}>
          填写名称、图标、预览图、分类、一行说明、类型和内容。保存为草稿；上架后商店与作品编辑器才能安装。
          作者库兰号：{userCode || '（需登录）'}。手机按类型打开现成页面，不会运行上传的代码。
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{editingId ? `编辑 · ${editingId}` : '新建应用'}</h2>
          <div className={styles.field}>
            <label htmlFor="app-name">名称</label>
            <input
              id="app-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="应用名称"
              maxLength={80}
            />
          </div>
          <div className={styles.field}>
            <label>图标</label>
            <div className={styles.row}>
              {form.icon ? (
                <img className={styles.iconPreview} src={getImageUrl(form.icon)} alt="" />
              ) : (
                <span className={styles.iconPreview} />
              )}
              <label className={styles.btnGhost}>
                上传图标
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void onPickIcon(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
          <div className={styles.field}>
            <label>预览图</label>
            <div className={styles.previewRow}>
              {form.previews.map((p) => (
                <img key={p} className={styles.previewThumb} src={getImageUrl(p)} alt="" />
              ))}
            </div>
            <label className={styles.btnGhost}>
              添加预览图
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void onPickPreview(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className={styles.field}>
            <label htmlFor="app-summary">一行说明</label>
            <input
              id="app-summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="列表里显示的一句话"
              maxLength={200}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="app-category">分类</label>
            <input
              id="app-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="如：社交、生活"
              maxLength={40}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="app-type">类型</label>
            <select
              id="app-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PlatformAppType }))}
            >
              {PLATFORM_APP_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="app-content">内容</label>
            <textarea
              id="app-content"
              value={form.contentText}
              onChange={(e) => setForm((f) => ({ ...f, contentText: e.target.value }))}
              placeholder="该类型页面要展示的内容（配置/文案，不是代码）"
            />
          </div>
          <div className={styles.row}>
            <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void save()}>
              {saving ? '保存中…' : editingId ? '保存修改' : '保存草稿'}
            </button>
            {editingId ? (
              <button type="button" className={styles.btnGhost} onClick={resetForm}>
                取消编辑
              </button>
            ) : null}
          </div>
        </section>

        {isStaff ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>运营 · 已上架应用</h2>
            <p className={styles.hint}>作者和运营改的是同一条记录；保存后商店与已装手机一起更换。</p>
            {published.map((app) => (
              <div key={`pub-${app.appId}`} className={styles.listItem}>
                {app.icon ? (
                  <img className={styles.iconPreview} src={getImageUrl(app.icon)} alt="" />
                ) : (
                  <span className={styles.iconPreview} />
                )}
                <div className={styles.meta}>
                  <p className={styles.metaName}>{app.name}</p>
                  <p className={styles.metaSub}>
                    {app.summary || '暂无说明'} · {app.authorName || app.authorId}
                  </p>
                </div>
                <button type="button" className={styles.btnGhost} onClick={() => startEdit(app)}>
                  编辑
                </button>
              </div>
            ))}
          </section>
        ) : null}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>我的应用</h2>
          {loading ? <p className={styles.empty}>加载中…</p> : null}
          {!loading && mine.length === 0 ? <p className={styles.empty}>还没有应用，先在上方保存一份草稿</p> : null}
          {mine.map((app) => (
            <div key={app.appId} className={styles.listItem}>
              {app.icon ? (
                <img className={styles.iconPreview} src={getImageUrl(app.icon)} alt="" />
              ) : (
                <span className={styles.iconPreview} />
              )}
              <div className={styles.meta}>
                <p className={styles.metaName}>{app.name}</p>
                <p className={styles.metaSub}>
                  {app.summary || '暂无说明'} · {app.authorId}
                </p>
              </div>
              <span className={app.status === 'published' ? styles.badgeOn : styles.badge}>
                {app.status === 'published' ? '已上架' : '草稿'}
              </span>
              <button type="button" className={styles.btnGhost} onClick={() => startEdit(app)}>
                编辑
              </button>
              {app.status === 'published' ? (
                <button type="button" className={styles.btnGhost} onClick={() => void unpublish(app.appId)}>
                  下架
                </button>
              ) : (
                <button type="button" className={styles.btnBlue} onClick={() => void publish(app.appId)}>
                  上架
                </button>
              )}
            </div>
          ))}
        </section>
    </AppPageShell>
  );
};

export default CreatePlatformApp;
