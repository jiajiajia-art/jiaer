/**
 * 运营后台 · 玩法 Mod 管理：官方创建维护、创作者审核、下架/停用、官方推荐、推荐权重
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  playModAdminApi,
  type PlayModRecord,
  type PlayModStatus,
} from '../../api/playMod/playModApi';
import specialThemeTagsApi from '../../api/specialThemeTags/specialThemeTagsApi';
import { formatThemeTagLabels, validateThemeRebind } from '../../utils/applicableThemeTags';
import ConfirmModal from '../CommonModal/ConfirmModal';
import AdminPlatformAppsSection from './AdminPlatformAppsSection';
import ThemeTagPicker, { type ThemeTagOption } from './ThemeTagPicker';
import styles from './AdminPlayModManager.module.css';

const STATUS_LABEL: Record<PlayModStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  private_test: '私有测试',
  listed: '已上架',
  delisted: '已下架',
  disabled: '已停用',
};

const emptyForm = (): Partial<PlayModRecord> => ({
  name: '',
  slug: '',
  description: '',
  detailMd: '',
  previewImages: [],
  authorDisplayName: '',
  category: 'gameplay',
  iconSvg: '',
  version: '1.0.0',
  defaultNavLabel: '',
  needsNavEntry: false,
  priceKk: 0,
  status: 'draft',
  adjustableParams: ['enabled', 'navLabel', 'iconSvg', 'visible', 'sortOrder'],
  editorPanels: [],
  officialRecommend: false,
});

const AdminPlayModManager: React.FC = () => {
  const token = useAuthStore((s) => s.user?.token) || '';
  const [items, setItems] = useState<PlayModRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [form, setForm] = useState<Partial<PlayModRecord>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [confirmDel, setConfirmDel] = useState<PlayModRecord | null>(null);
  // 功能注释：题材列表只拉一次，同时供「玩法适用题材」与「应用适用题材」两处多选复用
  const [themeTags, setThemeTags] = useState<ThemeTagOption[]>([]);
  const [themeEditId, setThemeEditId] = useState<string | null>(null);
  const [themeDraftIds, setThemeDraftIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await playModAdminApi.list(token, { q, status: status || undefined, kind: kind || undefined, limit: 100 });
      if (!res.success) {
        toast.error(res.message || '加载失败');
        return;
      }
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [token, q, status, kind]);

  const loadWeights = useCallback(async () => {
    if (!token) return;
    const res = await playModAdminApi.getWeights(token);
    if (res.success) setWeights(res.data || {});
  }, [token]);

  useEffect(() => {
    void load();
    void loadWeights();
  }, [load, loadWeights]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await specialThemeTagsApi.getPublicTags();
        if (cancelled || !res.data.success) return;
        setThemeTags(
          (res.data.data || [])
            .filter((t) => Number(t.id) > 0 && String(t.name || '').trim())
            .map((t) => ({ id: Number(t.id), name: String(t.name) })),
        );
      } catch {
        if (!cancelled) toast.error('加载题材列表失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 功能注释：运营改绑玩法包适用题材；官方包后台值覆盖前端种子，至少保留 1 个
  const saveModThemes = async (mod: PlayModRecord) => {
    if (!token) return;
    const err = validateThemeRebind(themeDraftIds);
    if (err) {
      toast.error(err);
      return;
    }
    const res = await playModAdminApi.setApplicableThemes(token, mod.id, themeDraftIds);
    if (!res.success) {
      toast.error(res.message || '改绑失败');
      return;
    }
    toast.success('适用题材已更新');
    setThemeEditId(null);
    void load();
  };

  const save = async () => {
    if (!token) return;
    if (!form.name?.trim()) {
      toast.error('请填写名称');
      return;
    }
    // 功能注释：上架/保存为 listed 时，前端先拦住缺说明/预览图（与后端契约一致）
    const previewImages = Array.isArray(form.previewImages)
      ? form.previewImages
      : String(form.previewImages || '')
          .split(/\n/)
          .map((x) => x.trim())
          .filter(Boolean);
    const detailText = String(form.detailMd || form.description || '').trim();
    if (form.status === 'listed') {
      if (detailText.length < 8) {
        toast.error('上架须填写玩法说明（至少 8 字）');
        return;
      }
      if (!previewImages.length) {
        toast.error('上架须至少 1 张预览图');
        return;
      }
    }
    const body = {
      ...form,
      id: editingId || form.id,
      previewImages,
      detailMd: form.detailMd || form.description || '',
      editorPanels: typeof form.editorPanels === 'string'
        ? String(form.editorPanels).split(/[,，\s]+/).filter(Boolean)
        : form.editorPanels,
      adjustableParams: form.adjustableParams,
    };
    const res = await playModAdminApi.upsert(token, body as Partial<PlayModRecord>);
    if (!res.success) {
      toast.error(res.message || '保存失败');
      return;
    }
    toast.success('已保存');
    setEditingId(null);
    setForm(emptyForm());
    void load();
  };

  const setModStatus = async (mod: PlayModRecord, next: PlayModStatus) => {
    if (!token) return;
    const res = await playModAdminApi.setStatus(token, mod.id, next);
    if (!res.success) {
      toast.error(res.message || '状态更新失败');
      return;
    }
    toast.success(`已设为${STATUS_LABEL[next]}`);
    void load();
  };

  const toggleOfficial = async (mod: PlayModRecord) => {
    if (!token) return;
    const res = await playModAdminApi.setOfficialRecommend(token, mod.id, !mod.officialRecommend);
    if (!res.success) {
      toast.error(res.message || '更新失败');
      return;
    }
    toast.success(mod.officialRecommend ? '已取消官方推荐' : '已标记【官方推荐】');
    void load();
  };

  const audit = async (mod: PlayModRecord, approve: boolean) => {
    if (!token) return;
    const res = await playModAdminApi.audit(token, mod.id, approve);
    if (!res.success) {
      toast.error(res.message || '审核失败');
      return;
    }
    toast.success(approve ? '已通过并上架' : '已驳回为草稿');
    void load();
  };

  const saveWeights = async () => {
    if (!token) return;
    const res = await playModAdminApi.setWeights(token, weights);
    if (!res.success) {
      toast.error(res.message || '权重保存失败');
      return;
    }
    toast.success('推荐权重已更新');
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h2 className={styles.title}>组件管理</h2>
        <p className={styles.sub}>
          玩法组件 + 手机应用统一目录 · 对话生成 / .kkmod 上传 · 私有测试 · 审核上架 · KK 币定价 · 【官方推荐】
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3>{editingId ? '编辑 Mod' : '新建官方 Mod'}</h3>
          {editingId ? (
            <button type="button" className={styles.ghost} onClick={() => { setEditingId(null); setForm(emptyForm()); }}>
              取消编辑
            </button>
          ) : null}
        </div>
        <div className={styles.grid}>
          <label>名称<input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Slug<input value={form.slug || ''} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="pack-career" /></label>
          <label>分类<input value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></label>
          <label>版本<input value={form.version || ''} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} /></label>
          <label>KK 币价格（0=免费）<input type="number" min={0} value={form.priceKk ?? 0} onChange={(e) => setForm((f) => ({ ...f, priceKk: Number(e.target.value) || 0 }))} /></label>
          <label>作者展示名<input value={form.authorDisplayName || ''} onChange={(e) => setForm((f) => ({ ...f, authorDisplayName: e.target.value }))} placeholder="官方 / 创作者昵称" /></label>
          <label>默认底栏名<input value={form.defaultNavLabel || ''} onChange={(e) => setForm((f) => ({ ...f, defaultNavLabel: e.target.value }))} /></label>
          <label className={styles.check}>
            <input type="checkbox" checked={!!form.needsNavEntry} onChange={(e) => setForm((f) => ({ ...f, needsNavEntry: e.target.checked }))} />
            需要底栏入口
          </label>
          <label className={styles.full}>列表短说明<textarea rows={2} value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
          <label className={styles.full}>玩法详细说明（上架必填）<textarea rows={3} value={form.detailMd || ''} onChange={(e) => setForm((f) => ({ ...f, detailMd: e.target.value }))} placeholder="详情页完整说明，至少 8 字" /></label>
          <label className={styles.full}>预览图 URL（每行一张，上架至少 1 张）
            <textarea
              rows={3}
              value={Array.isArray(form.previewImages) ? form.previewImages.join('\n') : String(form.previewImages || '')}
              onChange={(e) => setForm((f) => ({
                ...f,
                previewImages: e.target.value.split(/\n/).map((x) => x.trim()).filter(Boolean),
              }))}
              placeholder={'https://...\n或 local:slug-1'}
            />
          </label>
          <label className={styles.full}>线性 SVG 图标<textarea rows={2} value={form.iconSvg || ''} onChange={(e) => setForm((f) => ({ ...f, iconSvg: e.target.value }))} placeholder="<svg>...</svg>" /></label>
          <label className={styles.full}>编辑器面板（逗号分隔）
            <input
              value={Array.isArray(form.editorPanels) ? form.editorPanels.join(',') : String(form.editorPanels || '')}
              onChange={(e) => setForm((f) => ({ ...f, editorPanels: e.target.value.split(/[,，\s]+/).filter(Boolean) as unknown as string[] }))}
              placeholder="gigs,contracts,pregnancy"
            />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void save()}>保存</button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3>玩法 / 组件目录（含官方玩法适用题材）</h3>
          <div className={styles.filters}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称 / slug" />
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">全部类型</option>
              <option value="gameplay">玩法组件</option>
              <option value="phone_app">手机应用</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button type="button" className={styles.ghost} onClick={() => void load()}>刷新</button>
          </div>
        </div>
        {loading ? <p className={styles.muted}>加载中…</p> : null}
        <ul className={styles.list}>
          {items.map((mod) => (
            <li key={mod.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.icon} dangerouslySetInnerHTML={{ __html: mod.iconSvg || '' }} />
                <div>
                  <div className={styles.nameRow}>
                    <strong>{mod.name}</strong>
                    <span className={styles.tag}>{STATUS_LABEL[mod.status] || mod.status}</span>
                    {mod.officialRecommend ? <span className={styles.official}>官方推荐</span> : null}
                  </div>
                  <p className={styles.meta}>
                    {mod.slug} · v{mod.version} · {mod.priceKk ? `${mod.priceKk} KK` : '免费'} · 安装游戏 {mod.stats?.installGames ?? 0} · 购买账号 {mod.stats?.buyers ?? 0}
                  </p>
                  <p className={styles.desc}>{mod.description}</p>
                  <p className={styles.desc}>
                    适用题材：{mod.applicableThemeTagIds?.length
                      ? formatThemeTagLabels(mod.applicableThemeTagIds, themeTags)
                      : '未配置（前台使用官方种子语义）'}
                  </p>
                  {themeEditId === mod.id ? (
                    <div className={styles.themeEditor}>
                      <ThemeTagPicker tags={themeTags} value={themeDraftIds} onChange={setThemeDraftIds} />
                      <div className={styles.actions}>
                        <button type="button" className={styles.primary} onClick={() => void saveModThemes(mod)}>保存题材</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => {
                    setThemeEditId(themeEditId === mod.id ? null : mod.id);
                    setThemeDraftIds(mod.applicableThemeTagIds || []);
                  }}
                >
                  {themeEditId === mod.id ? '收起题材' : '改绑题材'}
                </button>
                <button type="button" className={styles.ghost} onClick={() => { setEditingId(mod.id); setForm(mod); }}>编辑</button>
                {mod.status === 'pending' ? (
                  <>
                    <button type="button" className={styles.primary} onClick={() => void audit(mod, true)}>通过</button>
                    <button type="button" className={styles.ghost} onClick={() => void audit(mod, false)}>驳回</button>
                  </>
                ) : null}
                {mod.status === 'listed' ? (
                  <button type="button" className={styles.ghost} onClick={() => void setModStatus(mod, 'delisted')}>下架</button>
                ) : null}
                {mod.status !== 'disabled' ? (
                  <button type="button" className={styles.ghost} onClick={() => void setModStatus(mod, 'disabled')}>停用</button>
                ) : (
                  <button type="button" className={styles.ghost} onClick={() => void setModStatus(mod, 'listed')}>重新上架</button>
                )}
                <button type="button" className={styles.ghost} onClick={() => void toggleOfficial(mod)}>
                  {mod.officialRecommend ? '取消官方推荐' : '官方推荐'}
                </button>
                <button type="button" className={styles.danger} onClick={() => setConfirmDel(mod)}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <AdminPlatformAppsSection token={token} themeTags={themeTags} />

      <section className={styles.card}>
        <div className={styles.cardHead}><h3>推荐权重</h3></div>
        <div className={styles.grid}>
          {Object.entries(weights).map(([k, v]) => (
            <label key={k}>{k}
              <input
                type="number"
                step="0.01"
                value={v}
                onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void saveWeights()}>保存权重</button>
        </div>
      </section>

      <ConfirmModal
        isOpen={!!confirmDel}
        title="删除玩法 Mod"
        message={confirmDel ? `确认删除「${confirmDel.name}」？已被购买或安装的 Mod 将拒绝删除。` : ''}
        confirmButtonText="删除"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          void (async () => {
            if (!token || !confirmDel) return;
            const res = await playModAdminApi.remove(token, confirmDel.id);
            setConfirmDel(null);
            if (!res.success) {
              toast.error(res.message || '删除失败');
              return;
            }
            toast.success('已删除');
            void load();
          })();
        }}
      />
    </div>
  );
};

export default AdminPlayModManager;
