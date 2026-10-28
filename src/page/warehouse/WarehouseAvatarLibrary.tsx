/**
 * 我的资源 · 头像库：私人相册 / 公共 / 系统；三维标签。
 * 匹配优先级改由剧本编辑器①基础按剧配置；此处只管理资产与相册顺序。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { avatarLibraryApi } from '../../api/galgame/avatarLibrary';
import { useAvatarTagOptions } from '../../hooks/useAvatarTagOptions';
import {
  AVATAR_ASSET_GENDERS,
  avatarAgeLabel,
  avatarBackgroundLabel,
  avatarGenderLabel,
  describeAvatarMatchPriority,
  type AvatarLibraryAlbum,
  type AvatarLibraryItem,
} from '../../lib/galgame/avatarLibrary';
import {
  describeSquareAvatarUploadHints,
  resolveLibraryAvatarDisplayUrl,
} from '../../lib/galgame/squareAvatarPrep';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../../components/CommonModal/ConfirmModal';
import AvatarFrame from '../../components/Avatar/AvatarFrame';
import SquareAvatarCropGate, {
  type SquareAvatarUploadPayload,
} from '../../components/Avatar/SquareAvatarCropGate';
import WarehouseEmptyIcon from './WarehouseEmptyIcon';
import panel from './WarehousePanel.module.css';

type Scope = 'mine' | 'public' | 'system';
type SegOption = { id: string; label: string };

/** 功能注释：暗色分段选项，替代原生 select，避免系统白底控件 */
function SegOptions({
  label,
  value,
  options,
  allowEmpty,
  emptyLabel = '全部',
  onChange,
}: {
  label: string;
  value: string;
  options: readonly SegOption[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (next: string) => void;
}) {
  const items: SegOption[] = allowEmpty
    ? [{ id: '', label: emptyLabel }, ...options]
    : [...options];
  return (
    <div className={panel.segBlock}>
      <span className={panel.segBlockLabel} id={`seg-${label}`}>{label}</span>
      <div className={panel.segRowCompact} role="radiogroup" aria-labelledby={`seg-${label}`}>
        {items.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id || '__all'}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? panel.avatarLibChipActive : panel.avatarLibChip}
              onClick={() => {
                if (allowEmpty && active && opt.id !== '') {
                  onChange('');
                  return;
                }
                onChange(opt.id);
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const WarehouseAvatarLibrary: React.FC = () => {
  const token = useAuthStore((s) => s.user?.token);
  const { ageOptions, backgroundOptions, options: tagOptions } = useAvatarTagOptions(token);

  const [scope, setScope] = useState<Scope>('mine');
  const [items, setItems] = useState<AvatarLibraryItem[]>([]);
  const [albums, setAlbums] = useState<AvatarLibraryAlbum[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [backgroundType, setBackgroundType] = useState('');
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formGender, setFormGender] = useState('female');
  const [formAge, setFormAge] = useState('adult');
  const [formBg, setFormBg] = useState('modern');
  const [formTitle, setFormTitle] = useState('');
  const [formAlbumId, setFormAlbumId] = useState('');
  const [preview, setPreview] = useState<AvatarLibraryItem | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');

  const activeAlbum = useMemo(
    () => albums.find((a) => a.id === activeAlbumId) || null,
    [albums, activeAlbumId],
  );

  const loadAlbums = useCallback(async () => {
    if (!token) return;
    const res = await avatarLibraryApi.listAlbums(token);
    if (!res.success) {
      toast.error(res.message || '加载私人头像库失败');
      setAlbums([]);
      return;
    }
    const list = Array.isArray(res.data) ? res.data : [];
    setAlbums(list);
    if (!formAlbumId && list[0]?.id) setFormAlbumId(list[0].id);
  }, [token, formAlbumId]);

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await avatarLibraryApi.list(token, {
        scope,
        gender: gender || undefined,
        ageGroup: ageGroup || undefined,
        backgroundType: backgroundType || undefined,
        q: q.trim() || undefined,
        albumId: scope === 'mine' && activeAlbumId ? activeAlbumId : undefined,
      });
      if (!res.success) {
        toast.error(res.message || '加载头像库失败');
        setItems([]);
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error((e as Error)?.message || '加载头像库失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, scope, gender, ageGroup, backgroundType, q, activeAlbumId]);

  useEffect(() => {
    if (!token) return;
    void loadAlbums();
  }, [token, loadAlbums]);

  useEffect(() => {
    // 功能注释：我的范围未点进相册时只展示相册卡，不拉扁平列表
    if (scope === 'mine' && !activeAlbumId) {
      setItems([]);
      setLoading(false);
      return;
    }
    void loadItems();
  }, [scope, activeAlbumId, loadItems]);

  const onUploadReady = async (payload: SquareAvatarUploadPayload) => {
    if (!token) return;
    setUploading(true);
    try {
      const res = await avatarLibraryApi.upload(token, payload.file, {
        gender: formGender,
        ageGroup: formAge,
        backgroundType: formBg,
        title: formTitle.trim() || undefined,
        albumId: formAlbumId || undefined,
        kind: 'private',
        crop: payload.crop,
      });
      if (!res.success) {
        toast.error(res.message || '上传失败');
        return;
      }
      toast.success('已加入我的头像库');
      setFormTitle('');
      setUploadOpen(false);
      setScope('mine');
      if (formAlbumId) setActiveAlbumId(formAlbumId);
      await loadAlbums();
      await loadItems();
    } catch (e) {
      toast.error((e as Error)?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    if (!token || !deleteId) return;
    const res = await avatarLibraryApi.remove(token, deleteId);
    setDeleteId(null);
    if (!res.success) {
      toast.error(res.message || '删除失败');
      return;
    }
    toast.success('已删除（使用中的角色仍保留已绑定头像）');
    await loadAlbums();
    await loadItems();
  };

  /** 功能注释：相册展示序 = 服务端 sort_order；↑↓ 只调相册表，不再写平台全局匹配偏好 */
  const moveAlbum = async (albumId: string, dir: -1 | 1) => {
    if (!token) return;
    const order = albums.map((a) => a.id);
    const idx = order.indexOf(albumId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= order.length) return;
    [order[idx], order[swap]] = [order[swap], order[idx]];
    const res = await avatarLibraryApi.reorderAlbums(token, order);
    if (res.success && Array.isArray(res.data)) setAlbums(res.data);
    else await loadAlbums();
  };

  const createAlbum = async () => {
    if (!token) return;
    const title = newAlbumTitle.trim() || '未命名头像库';
    const res = await avatarLibraryApi.createAlbum(token, { title });
    if (!res.success) {
      toast.error(res.message || '新建失败');
      return;
    }
    setNewAlbumTitle('');
    toast.success('已新建头像库');
    await loadAlbums();
  };

  const orderedAlbums = useMemo(() => albums, [albums]);

  const showAlbumGrid = scope === 'mine' && !activeAlbumId;

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>头像库</h1>
        <p className={panel.sub}>
          {describeAvatarMatchPriority()}。{describeSquareAvatarUploadHints()}
        </p>
      </header>

      <div className={panel.avatarLibControls}>
        <div className={panel.avatarLibScopeSearch}>
          <div className={panel.avatarLibScopeTrack} role="tablist" aria-label="头像库范围">
            {([
              { id: 'mine' as const, label: '我的' },
              { id: 'public' as const, label: '公共' },
              { id: 'system' as const, label: '系统' },
            ]).map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={scope === s.id}
                className={scope === s.id ? panel.avatarLibChipActive : panel.avatarLibChip}
                onClick={() => {
                  setScope(s.id);
                  setActiveAlbumId(null);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            className={panel.avatarLibSearch}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索头像库或头像"
            aria-label="搜索头像"
          />
          <button
            type="button"
            className={panel.primaryBtn}
            onClick={() => setUploadOpen(true)}
          >
            上传头像
          </button>
        </div>

        {!showAlbumGrid ? (
          <div className={panel.uploadDimsRow} aria-label="列表筛选">
            {activeAlbum ? (
              <button
                type="button"
                className={panel.ghostBtn}
                onClick={() => setActiveAlbumId(null)}
              >
                ← {activeAlbum.title}
              </button>
            ) : null}
            <SegOptions
              label="性别"
              value={gender}
              options={AVATAR_ASSET_GENDERS}
              allowEmpty
              emptyLabel="全部"
              onChange={setGender}
            />
            <SegOptions
              label="年龄"
              value={ageGroup}
              options={ageOptions}
              allowEmpty
              emptyLabel="全部"
              onChange={setAgeGroup}
            />
            <SegOptions
              label="背景"
              value={backgroundType}
              options={backgroundOptions}
              allowEmpty
              emptyLabel="全部"
              onChange={setBackgroundType}
            />
          </div>
        ) : null}
      </div>

      {showAlbumGrid ? (
        <div className={panel.avatarAlbumSection}>
          <div className={panel.avatarAlbumHeader}>
            <h2 className={panel.avatarAlbumTitle}>我的头像库</h2>
            <div className={panel.avatarAlbumNewRow}>
              <input
                className={panel.avatarLibSearch}
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder="新库名称"
                maxLength={40}
                aria-label="新库名称"
              />
              <button type="button" className={panel.primaryBtn} onClick={() => void createAlbum()}>
                + 新建
              </button>
            </div>
          </div>
          {orderedAlbums.length === 0 ? (
            <div className={panel.empty}>
              <WarehouseEmptyIcon />
              <p>还没有私人头像库，先新建一个吧。</p>
            </div>
          ) : (
            <div className={panel.avatarAlbumGrid}>
              {orderedAlbums.map((album, index) => (
                <article key={album.id} className={panel.avatarAlbumCard}>
                  <div className={panel.avatarAlbumCardTop}>
                    <div>
                      <h3 className={panel.avatarAlbumCardName}>{album.title}</h3>
                      <p className={panel.sub} style={{ margin: 0 }}>
                        {album.avatarCount ?? 0} 张头像
                      </p>
                    </div>
                    <div className={panel.avatarAlbumOrderBtns}>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        disabled={index === 0}
                        aria-label="上移相册顺序"
                        onClick={() => void moveAlbum(album.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        disabled={index >= orderedAlbums.length - 1}
                        aria-label="下移相册顺序"
                        onClick={() => void moveAlbum(album.id, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className={panel.avatarAlbumPreviews}>
                    {(album.previewUrls || []).slice(0, 4).map((url) => (
                      <div key={url} className={panel.avatarAlbumPreviewSlot}>
                        <AvatarFrame src={getImageUrl(url)} alt="" variant="rounded" size={56} />
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - (album.previewUrls?.length || 0)) }).map((_, i) => (
                      <div key={`empty-${i}`} className={panel.avatarAlbumPreviewEmpty} />
                    ))}
                  </div>
                  <div className={panel.avatarAlbumActions}>
                    <button
                      type="button"
                      className={panel.ghostBtn}
                      onClick={() => setActiveAlbumId(album.id)}
                    >
                      打开头像库
                    </button>
                    <button
                      type="button"
                      className={panel.primaryBtn}
                      onClick={() => {
                        setFormAlbumId(album.id);
                        setUploadOpen(true);
                      }}
                    >
                      上传头像
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className={panel.empty}>加载中…</div>
      ) : items.length === 0 ? (
        <div className={panel.empty}>
          <WarehouseEmptyIcon />
          <p>{scope === 'mine' ? '这个头像库还没有头像，上传一张吧。' : '暂无符合筛选的头像。'}</p>
        </div>
      ) : (
        <div className={panel.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {items.map((item) => (
            <article key={item.id} className={panel.card} style={{ padding: 10 }}>
              <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} onClick={() => setPreview(item)}>
                <AvatarFrame
                  src={getImageUrl(resolveLibraryAvatarDisplayUrl(item))}
                  alt={item.title || '头像'}
                  variant="rounded"
                />
              </button>
              <p className={panel.sub} style={{ margin: '8px 0 0', fontSize: 12 }}>
                {avatarGenderLabel(item.gender)} · {avatarAgeLabel(item.ageGroup, tagOptions)} · {avatarBackgroundLabel(item.backgroundType, tagOptions)}
              </p>
              {item.title ? <p style={{ margin: '2px 0 0', fontSize: 13, color: '#fff' }}>{item.title}</p> : null}
              {scope === 'mine' && (
                <button type="button" className={panel.dangerBtn} style={{ marginTop: 8, width: '100%' }} onClick={() => setDeleteId(item.id)}>
                  删除
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="删除头像"
        message="删除库记录后无法恢复；正在使用该图的角色仍保留已绑定副本。确认删除？"
        confirmButtonText="删除"
        tone="dark"
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmModal
        isOpen={!!preview}
        title={preview?.title || '头像预览'}
        message={preview ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
              <AvatarFrame
                src={getImageUrl(resolveLibraryAvatarDisplayUrl(preview))}
                alt={preview.title || '预览'}
                variant="rounded"
                size={240}
              />
            </div>
            <p style={{ margin: 0, textAlign: 'center' }}>
              {avatarGenderLabel(preview.gender)} · {avatarAgeLabel(preview.ageGroup, tagOptions)} · {avatarBackgroundLabel(preview.backgroundType, tagOptions)}
            </p>
          </div>
        ) : ''}
        confirmButtonText="关闭"
        cancelButtonText="关闭"
        variant="alert"
        tone="dark"
        onConfirm={() => setPreview(null)}
        onCancel={() => setPreview(null)}
      />

      {uploadOpen
        ? createPortal(
            <div
              className={panel.avatarLibModalOverlay}
              role="presentation"
              onClick={() => {
                if (!uploading) setUploadOpen(false);
              }}
            >
              <div
                className={panel.avatarLibModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="avatar-lib-upload-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className={panel.avatarLibModalHeader}>
                  <button
                    type="button"
                    className={panel.avatarLibModalClose}
                    aria-label="关闭"
                    disabled={uploading}
                    onClick={() => setUploadOpen(false)}
                  >
                    <span className={panel.avatarLibModalCloseIcon} aria-hidden="true" />
                  </button>
                  <h2 id="avatar-lib-upload-title" className={panel.avatarLibModalTitle}>
                    上传私人头像
                  </h2>
                </header>
                <div className={panel.avatarLibModalBody}>
                  <p className={panel.avatarLibModalHint}>{describeSquareAvatarUploadHints()}</p>
                  <div className={panel.avatarLibModalFields}>
                    <SegOptions label="性别" value={formGender} options={AVATAR_ASSET_GENDERS} onChange={setFormGender} />
                    <SegOptions label="年龄" value={formAge} options={ageOptions} onChange={setFormAge} />
                    <SegOptions label="背景" value={formBg} options={backgroundOptions} onChange={setFormBg} />
                    {albums.length > 0 ? (
                      <SegOptions
                        label="放入头像库"
                        value={formAlbumId || albums[0]?.id || ''}
                        options={albums.map((a) => ({ id: a.id, label: a.title }))}
                        onChange={setFormAlbumId}
                      />
                    ) : null}
                    <label className={panel.avatarLibModalField}>
                      <span className={panel.segBlockLabel}>标题</span>
                      <input
                        className={panel.avatarLibModalInput}
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        maxLength={40}
                        placeholder="可选，便于检索"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <div className={panel.avatarLibModalActions}>
                    <SquareAvatarCropGate
                      disabled={uploading}
                      buttonClassName={panel.avatarLibModalPrimary}
                      buttonLabel={uploading ? '上传中…' : '上传'}
                      onReady={(p) => void onUploadReady(p)}
                    />
                    <button
                      type="button"
                      className={panel.avatarLibModalGhost}
                      disabled={uploading}
                      onClick={() => setUploadOpen(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default WarehouseAvatarLibrary;
