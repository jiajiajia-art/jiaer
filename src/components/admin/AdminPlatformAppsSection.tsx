/**
 * 运营后台 · 平台手机应用（官方 + 创作者）：列表、上架/下架审核、适用题材改绑。
 * 官方应用适用题材以此处保存的值为准；未保存时前台回退 officialThemeApplicability 种子语义。
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { platformAppsAdminApi, type PlatformApp } from '../../api/platform/platformAppsApi';
import { formatThemeTagLabels, validateThemeRebind } from '../../utils/applicableThemeTags';
import ThemeTagPicker, { type ThemeTagOption } from './ThemeTagPicker';
import styles from './AdminPlayModManager.module.css';

type Props = {
  token: string;
  /** 功能注释：由父组件拉一次题材列表后下发，避免本区块与玩法区块各打一遍同一接口 */
  themeTags: ThemeTagOption[];
};

const AdminPlatformAppsSection: React.FC<Props> = ({ token, themeTags }) => {
  const [items, setItems] = useState<PlatformApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'' | 'official' | 'creator'>('official');
  const [q, setQ] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await platformAppsAdminApi.list(token, { scope: scope || undefined, q });
      if (!res.success) {
        toast.error(res.message || '加载应用失败');
        return;
      }
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [token, scope, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveThemes = async (app: PlatformApp) => {
    const err = validateThemeRebind(draftIds);
    if (err) {
      toast.error(err);
      return;
    }
    const res = await platformAppsAdminApi.setApplicableThemes(token, app.appId, draftIds);
    if (!res.success) {
      toast.error(res.message || '改绑失败');
      return;
    }
    toast.success('适用题材已更新');
    setEditingId(null);
    void load();
  };

  const audit = async (app: PlatformApp, approve: boolean) => {
    const res = await platformAppsAdminApi.audit(token, app.appId, approve);
    if (!res.success) {
      toast.error(res.message || '操作失败');
      return;
    }
    toast.success(approve ? '已上架' : '已下架为草稿');
    void load();
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h3>手机应用 · 官方应用适用题材 / 创作者应用</h3>
        <div className={styles.filters}>
          <select value={scope} onChange={(e) => setScope(e.target.value as '' | 'official' | 'creator')}>
            <option value="official">官方应用</option>
            <option value="creator">创作者应用</option>
            <option value="">全部</option>
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称 / appId / 作者" />
          <button type="button" className={styles.ghost} onClick={() => void load()}>刷新</button>
        </div>
      </div>
      {loading ? <p className={styles.muted}>加载中…</p> : null}
      <ul className={styles.list}>
        {items.map((app) => {
          const ids = app.applicableThemeTagIds || [];
          const editing = editingId === app.appId;
          return (
            <li key={app.appId} className={styles.row} style={{ flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className={styles.nameRow}>
                    <strong>{app.name}</strong>
                    <span className={styles.tag}>{app.status === 'published' ? '已上架' : '草稿'}</span>
                    {app.isOfficial ? <span className={styles.official}>官方</span> : null}
                  </div>
                  <p className={styles.meta}>
                    {app.appId} · {app.type} · 作者 {app.authorName || app.authorId}
                  </p>
                  <p className={styles.desc}>
                    适用题材：{ids.length ? formatThemeTagLabels(ids, themeTags) : '未配置（前台使用官方种子语义）'}
                  </p>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => {
                      setEditingId(editing ? null : app.appId);
                      setDraftIds(ids);
                    }}
                  >
                    {editing ? '收起' : '改绑题材'}
                  </button>
                  {app.status !== 'published' ? (
                    <button type="button" className={styles.primary} onClick={() => void audit(app, true)}>通过上架</button>
                  ) : (
                    <button type="button" className={styles.ghost} onClick={() => void audit(app, false)}>下架</button>
                  )}
                </div>
              </div>
              {editing ? (
                <div className={styles.themeEditor}>
                  <ThemeTagPicker tags={themeTags} value={draftIds} onChange={setDraftIds} />
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} onClick={() => void saveThemes(app)}>保存题材</button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {!loading && !items.length ? <li className={styles.muted}>暂无应用</li> : null}
      </ul>
    </section>
  );
};

export default AdminPlatformAppsSection;
