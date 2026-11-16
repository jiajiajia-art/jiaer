/**
 * 我的资源 · 头像库：私人相册 / 公共 / 系统；三维标签。
 * 匹配优先级改由剧本编辑器①基础按剧配置；此处只管理资产与相册顺序。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { avatarLibraryApi } from '../../api/galgame/avatarLibrary';
import { useAvatarTagOptions } from '../../hooks/useAvatarTagOptions';
import {
  AVATAR_ASSET_GENDERS,
  avatarAgeLabel,
  avatarBackgroundLabel,
  avatarGenderLabel,
  type AvatarLibraryAlbum,
  type AvatarLibraryItem,
} from '../../lib/galgame/avatarLibrary';
import {
  resolveLibraryAvatarDisplayUrl,
} from '../../lib/galgame/squareAvatarPrep';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../../components/CommonModal/ConfirmModal';
import AvatarFrame from '../../components/Avatar/AvatarFrame';
import SquareAvatarCropGate, {
  type SquareAvatarUploadPayload,
} from '../../components/Avatar/SquareAvatarCropGate';
import WarehouseEmptyIcon from './WarehouseEmptyIcon';
import { genderLabel } from './warehouseNav';
import panel from './WarehousePanel.module.css';

function displayAssetGender(id: string, t: (key: string) => string): string {
  if (id === 'universal') return t('warehouse.avatars.gender.universal');
  if (id === 'male' || id === 'female') return genderLabel(id, t);
  return avatarGenderLabel(id);
}

type Scope = 'mine' | 'public' | 'system';
type SegOption = { id: string; label: string };

/** 功能注释：暗色分段选项，替代原生 select，避免系统白底控件 */
function SegOptions({
  label,
  value,
  options,
  allowEmpty,
  emptyLabel,
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
    ? [{ id: '', label: emptyLabel ?? '' }, ...options]
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
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.user?.token);
  const { ageOptions, backgroundOptions, options: tagOptions } = useAvatarTagOptions(token);

  const assetGenderOptions = useMemo(
    () => AVATAR_ASSET_GENDERS.map((g) => ({
      id: g.id,
      label: displayAssetGender(g.id, t),
    })),
    [t],
  );
  const filterAllLabel = t('warehouse.avatars.filterAll');

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
      toast.error(res.message || t('warehouse.avatars.loadAlbumsFailed'));
      setAlbums([]);
      return;
    }
    const list = Array.isArray(res.data) ? res.data : [];
    setAlbums(list);
    if (!formAlbumId && list[0]?.id) setFormAlbumId(list[0].id);
  }, [token, formAlbumId, t]);

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
        toast.error(res.message || t('warehouse.avatars.loadFailed'));
        setItems([]);
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.avatars.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, scope, gender, ageGroup, backgroundType, q, activeAlbumId, t]);

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
        toast.error(res.message || t('warehouse.avatars.uploadFailed'));
        return;
      }
      toast.success(t('warehouse.avatars.uploadOk'));
      setFormTitle('');
      setUploadOpen(false);
      setScope('mine');
      if (formAlbumId) setActiveAlbumId(formAlbumId);
      await loadAlbums();
      await loadItems();
    } catch (e) {
      toast.error((e as Error)?.message || t('warehouse.avatars.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    if (!token || !deleteId) return;
    const res = await avatarLibraryApi.remove(token, deleteId);
    setDeleteId(null);
    if (!res.success) {
      toast.error(res.message || t('warehouse.avatars.deleteFailed'));
      return;
    }
    toast.success(t('warehouse.avatars.deleteOk'));
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
    const title = newAlbumTitle.trim() || t('warehouse.avatars.unnamedAlbum');
    const res = await avatarLibraryApi.createAlbum(token, { title });
    if (!res.success) {
      toast.error(res.message || t('warehouse.avatars.createAlbumFailed'));
      return;
    }
    setNewAlbumTitle('');
    toast.success(t('warehouse.avatars.createAlbumOk'));
    await loadAlbums();
  };

  const orderedAlbums = useMemo(() => albums, [albums]);

  const showAlbumGrid = scope === 'mine' && !activeAlbumId;

  return (
    <div className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>{t('warehouse.avatars.title')}</h1>
        <p className={panel.sub}>
          {t('warehouse.avatars.matchPriorityHint')}。{t('warehouse.avatars.uploadHints')}
        </p>
      </header>

      <div className={panel.avatarLibControls}>
        <div className={panel.avatarLibScopeSearch}>
          <div className={panel.avatarLibScopeTrack} role="tablist" aria-label={t('warehouse.avatars.scopeAria')}>
            {([
              { id: 'mine' as const, label: t('warehouse.avatars.scopeMine') },
              { id: 'public' as const, label: t('warehouse.avatars.scopePublic') },
              { id: 'system' as const, label: t('warehouse.avatars.scopeSystem') },
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
            placeholder={t('warehouse.avatars.searchPlaceholder')}
            aria-label={t('warehouse.avatars.searchAria')}
          />
          <button
            type="button"
            className={panel.primaryBtn}
            onClick={() => setUploadOpen(true)}
          >
            {t('warehouse.avatars.upload')}
          </button>
        </div>

        {!showAlbumGrid ? (
          <div className={panel.uploadDimsRow} aria-label={t('warehouse.avatars.filterListAria')}>
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
              label={t('warehouse.avatars.filterGender')}
              value={gender}
              options={assetGenderOptions}
              allowEmpty
              emptyLabel={filterAllLabel}
              onChange={setGender}
            />
            <SegOptions
              label={t('warehouse.avatars.filterAge')}
              value={ageGroup}
              options={ageOptions}
              allowEmpty
              emptyLabel={filterAllLabel}
              onChange={setAgeGroup}
            />
            <SegOptions
              label={t('warehouse.avatars.filterBackground')}
              value={backgroundType}
              options={backgroundOptions}
              allowEmpty
              emptyLabel={filterAllLabel}
              onChange={setBackgroundType}
            />
          </div>
        ) : null}
      </div>

      {showAlbumGrid ? (
        <div className={panel.avatarAlbumSection}>
          <div className={panel.avatarAlbumHeader}>
            <h2 className={panel.avatarAlbumTitle}>{t('warehouse.avatars.myAlbumsTitle')}</h2>
            <div className={panel.avatarAlbumNewRow}>
              <input
                className={panel.avatarLibSearch}
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder={t('warehouse.avatars.newAlbumPlaceholder')}
                maxLength={40}
                aria-label={t('warehouse.avatars.newAlbumAria')}
              />
              <button type="button" className={panel.primaryBtn} onClick={() => void createAlbum()}>
                {t('warehouse.avatars.newAlbum')}
              </button>
            </div>
          </div>
          {orderedAlbums.length === 0 ? (
            <div className={panel.empty}>
              <WarehouseEmptyIcon />
              <p>{t('warehouse.avatars.emptyAlbums')}</p>
            </div>
          ) : (
            <div className={panel.avatarAlbumGrid}>
              {orderedAlbums.map((album, index) => (
                <article key={album.id} className={panel.avatarAlbumCard}>
                  <div className={panel.avatarAlbumCardTop}>
                    <div>
                      <h3 className={panel.avatarAlbumCardName}>{album.title}</h3>
                      <p className={panel.sub} style={{ margin: 0 }}>
                        {t('warehouse.avatars.avatarCount', { count: album.avatarCount ?? 0 })}
                      </p>
                    </div>
                    <div className={panel.avatarAlbumOrderBtns}>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        disabled={index === 0}
                        aria-label={t('warehouse.avatars.moveAlbumUpAria')}
                        onClick={() => void moveAlbum(album.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={panel.ghostBtn}
                        disabled={index >= orderedAlbums.length - 1}
                        aria-label={t('warehouse.avatars.moveAlbumDownAria')}
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
                      {t('warehouse.avatars.openAlbum')}
                    </button>
                    <button
                      type="button"
                      className={panel.primaryBtn}
                      onClick={() => {
                        setFormAlbumId(album.id);
                        setUploadOpen(true);
                      }}
                    >
                      {t('warehouse.avatars.upload')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className={panel.empty}>{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className={panel.empty}>
          <WarehouseEmptyIcon />
          <p>{scope === 'mine' ? t('warehouse.avatars.emptyAlbumItems') : t('warehouse.avatars.emptyFiltered')}</p>
        </div>
      ) : (
        <div className={panel.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {items.map((item) => (
            <article key={item.id} className={panel.card} style={{ padding: 10 }}>
              <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} onClick={() => setPreview(item)}>
                <AvatarFrame
                  src={getImageUrl(resolveLibraryAvatarDisplayUrl(item))}
                  alt={item.title || t('warehouse.avatars.altAvatar')}
                  variant="rounded"
                />
              </button>
              <p className={panel.sub} style={{ margin: '8px 0 0', fontSize: 12 }}>
                {displayAssetGender(item.gender, t)} · {avatarAgeLabel(item.ageGroup, tagOptions)} · {avatarBackgroundLabel(item.backgroundType, tagOptions)}
              </p>
              {item.title ? <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text)' }}>{item.title}</p> : null}
              {scope === 'mine' && (
                <button type="button" className={panel.dangerBtn} style={{ marginTop: 8, width: '100%' }} onClick={() => setDeleteId(item.id)}>
                  {t('warehouse.cards.delete')}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title={t('warehouse.avatars.deleteTitle')}
        message={t('warehouse.avatars.deleteMessage')}
        confirmButtonText={t('warehouse.cards.delete')}
        tone="dark"
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmModal
        isOpen={!!preview}
        title={preview?.title || t('warehouse.avatars.previewTitle')}
        message={preview ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
              <AvatarFrame
                src={getImageUrl(resolveLibraryAvatarDisplayUrl(preview))}
                alt={preview.title || t('warehouse.avatars.altPreview')}
                variant="rounded"
                size={240}
              />
            </div>
            <p style={{ margin: 0, textAlign: 'center' }}>
              {displayAssetGender(preview.gender, t)} · {avatarAgeLabel(preview.ageGroup, tagOptions)} · {avatarBackgroundLabel(preview.backgroundType, tagOptions)}
            </p>
          </div>
        ) : ''}
        confirmButtonText={t('warehouse.cards.close')}
        cancelButtonText={t('warehouse.cards.close')}
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
                    aria-label={t('warehouse.cards.close')}
                    disabled={uploading}
                    onClick={() => setUploadOpen(false)}
                  >
                    <span className={panel.avatarLibModalCloseIcon} aria-hidden="true" />
                  </button>
                  <h2 id="avatar-lib-upload-title" className={panel.avatarLibModalTitle}>
                    {t('warehouse.avatars.uploadPrivateTitle')}
                  </h2>
                </header>
                <div className={panel.avatarLibModalBody}>
                  <p className={panel.avatarLibModalHint}>{t('warehouse.avatars.uploadHints')}</p>
                  <div className={panel.avatarLibModalFields}>
                    <SegOptions label={t('warehouse.avatars.filterGender')} value={formGender} options={assetGenderOptions} onChange={setFormGender} />
                    <SegOptions label={t('warehouse.avatars.filterAge')} value={formAge} options={ageOptions} onChange={setFormAge} />
                    <SegOptions label={t('warehouse.avatars.filterBackground')} value={formBg} options={backgroundOptions} onChange={setFormBg} />
                    {albums.length > 0 ? (
                      <SegOptions
                        label={t('warehouse.avatars.putInAlbum')}
                        value={formAlbumId || albums[0]?.id || ''}
                        options={albums.map((a) => ({ id: a.id, label: a.title }))}
                        onChange={setFormAlbumId}
                      />
                    ) : null}
                    <label className={panel.avatarLibModalField}>
                      <span className={panel.segBlockLabel}>{t('warehouse.avatars.titleField')}</span>
                      <input
                        className={panel.avatarLibModalInput}
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        maxLength={40}
                        placeholder={t('warehouse.avatars.titlePlaceholder')}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <div className={panel.avatarLibModalActions}>
                    <SquareAvatarCropGate
                      disabled={uploading}
                      buttonClassName={panel.avatarLibModalPrimary}
                      buttonLabel={uploading ? t('warehouse.avatars.uploading') : t('warehouse.avatars.uploadBtn')}
                      onReady={(p) => void onUploadReady(p)}
                    />
                    <button
                      type="button"
                      className={panel.avatarLibModalGhost}
                      disabled={uploading}
                      onClick={() => setUploadOpen(false)}
                    >
                      {t('warehouse.cards.cancel')}
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
