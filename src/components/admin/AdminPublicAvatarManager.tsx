/**
 * 管理面板 / 运营中心 · 公共头像：批量上传公共/系统头像、搜索、预览、下架、删除；可查看用户私人上传。
 * 批量选图先出看板（合格/需裁切/不合格）；需裁切点进裁剪且不可关闭直至确认。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { avatarLibraryApi } from '../../api/galgame/avatarLibrary';
import {
  AVATAR_ASSET_GENDERS,
  avatarAgeLabel,
  avatarBackgroundLabel,
  avatarGenderLabel,
  avatarKindLabel,
  type AvatarLibraryItem,
  type AvatarTagOption,
} from '../../lib/galgame/avatarLibrary';
import { invalidateAvatarTagOptionsCache, useAvatarTagOptions } from '../../hooks/useAvatarTagOptions';
import {
  classifyAvatarBatchImage,
  describeSquareAvatarUploadHints,
  isAllowedAvatarUploadFile,
  readImageNaturalSize,
  resolveLibraryAvatarDisplayUrl,
  type AvatarBatchInspectStatus,
} from '../../lib/galgame/squareAvatarPrep';
import { fileToDataUrl } from '../../utils/uploadImageCrop';
import { getImageUrl } from '../../utils/constants';
import ConfirmModal from '../CommonModal/ConfirmModal';
import AvatarFrame from '../Avatar/AvatarFrame';
import SquareAvatarCropGate, {
  type SquareAvatarCropGateHandle,
  type SquareAvatarUploadPayload,
} from '../Avatar/SquareAvatarCropGate';
import styles from './AdminPublicAvatarManager.module.css';

type ViewScope = 'admin' | 'user-uploads';
type UploadKind = 'public' | 'system';
type SegOption = { id: string; label: string };

type BatchBoardItem = {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  status: AvatarBatchInspectStatus;
  label: string;
  reason?: string;
  phase: 'idle' | 'uploading' | 'done' | 'error';
  errorText?: string;
};

/** 功能注释：浅色分段选项（对齐管理面板暖色），替代原生 select */
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
    <div className={styles.segBlock}>
      <span className={styles.segLabel}>{label}</span>
      <div className={styles.segRow} role="radiogroup" aria-label={label}>
        {items.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id || '__all'}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? styles.segActive : styles.seg}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AdminPublicAvatarManager: React.FC = () => {
  const token = useAuthStore((s) => s.user?.token);
  const {
    options: tagOptions,
    ageOptions,
    backgroundOptions,
    reload: reloadTagOptions,
  } = useAvatarTagOptions(token, { includeDisabled: true });
  const [scope, setScope] = useState<ViewScope>('admin');
  const [items, setItems] = useState<AvatarLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [backgroundType, setBackgroundType] = useState('');
  const [uploadKind, setUploadKind] = useState<UploadKind>('public');
  const [formGender, setFormGender] = useState('female');
  const [formAge, setFormAge] = useState('adult');
  const [formBg, setFormBg] = useState('modern');
  const [formTitle, setFormTitle] = useState('');
  const [newAgeLabel, setNewAgeLabel] = useState('');
  const [newBgLabel, setNewBgLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [batchBoardOpen, setBatchBoardOpen] = useState(false);
  const [batchBoard, setBatchBoard] = useState<BatchBoardItem[]>([]);
  const [batchInspecting, setBatchInspecting] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const activeBatchIdRef = useRef<string | null>(null);
  const cropGateRef = useRef<SquareAvatarCropGateHandle>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [delistId, setDelistId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AvatarLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await avatarLibraryApi.list(token, {
        scope,
        q: q.trim() || undefined,
        kind: scope === 'admin' ? (kindFilter || undefined) : 'private',
        status: statusFilter || undefined,
        gender: gender || undefined,
        ageGroup: ageGroup || undefined,
        backgroundType: backgroundType || undefined,
      });
      if (!res.success) {
        toast.error(res.message || '加载失败');
        setItems([]);
        return;
      }
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error((e as Error)?.message || '加载失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, scope, q, kindFilter, statusFilter, gender, ageGroup, backgroundType]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadOne = async (payload: SquareAvatarUploadPayload) => {
    if (!token) throw new Error('未登录');
    const res = await avatarLibraryApi.upload(token, payload.file, {
      gender: formGender,
      ageGroup: formAge,
      backgroundType: formBg,
      title: formTitle.trim() || undefined,
      kind: uploadKind,
      crop: payload.crop,
    });
    if (!res.success) throw new Error(res.message || '上传失败');
    return res.data;
  };

  const patchBoardItem = useCallback((id: string, patch: Partial<BatchBoardItem>) => {
    setBatchBoard((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const clearBatchBoard = useCallback(() => {
    setBatchBoard((prev) => {
      // 功能注释：清空时释放裁切后生成的 blob 预览，避免泄漏
      prev.forEach((row) => {
        if (row.previewUrl.startsWith('blob:')) URL.revokeObjectURL(row.previewUrl);
      });
      return [];
    });
    setBatchBoardOpen(false);
    activeBatchIdRef.current = null;
    setActiveBatchId(null);
  }, []);

  const onCropReady = async (payload: SquareAvatarUploadPayload) => {
    const batchId = activeBatchIdRef.current;
    setUploading(true);

    // 功能注释：裁切确认当下就用 1:1 成片换掉看板竖图，不等服务端回写
    let boardPreviewUrl = '';
    if (batchId) {
      const previewSource = payload.previewBlob || (!payload.isGif ? payload.file : null);
      if (previewSource) {
        boardPreviewUrl = URL.createObjectURL(previewSource);
      }
      const side = Math.max(
        1,
        Number(payload.previewSide || payload.crop?.width || 0) || 512,
      );
      setBatchBoard((prev) => prev.map((row) => {
        if (row.id !== batchId) return row;
        if (boardPreviewUrl && row.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(row.previewUrl);
        }
        return {
          ...row,
          phase: 'uploading',
          status: 'pass',
          label: '正常',
          reason: undefined,
          errorText: undefined,
          previewUrl: boardPreviewUrl || row.previewUrl,
          width: side,
          height: side,
          file: payload.isGif ? row.file : payload.file,
        };
      }));
    }

    try {
      await uploadOne(payload);
      if (batchId) {
        patchBoardItem(batchId, { phase: 'done', status: 'pass', label: '正常' });
        activeBatchIdRef.current = null;
        setActiveBatchId(null);
        toast.success('已上传，看板已更新为 1:1 预览');
        await load();
        return;
      }
      toast.success(uploadKind === 'system' ? '已加入系统头像' : '已加入公共头像');
      setFormTitle('');
      await load();
    } catch (e) {
      const msg = (e as Error)?.message || '上传失败';
      toast.error(msg);
      if (batchId) patchBoardItem(batchId, { phase: 'error', errorText: msg });
    } finally {
      setUploading(false);
    }
  };

  /** 功能注释：批量选图 → 读尺寸分类 → 打开看板，不自动弹裁剪 */
  const onBatchPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files);
    const accepted = picked.filter((f) => isAllowedAvatarUploadFile(f));
    const rejected = picked.length - accepted.length;
    if (rejected > 0) {
      toast.error(`已跳过 ${rejected} 张不支持的格式（仅 PNG/JPG/WebP/GIF）`);
    }
    if (!accepted.length) {
      toast.error('没有可上传的图片');
      return;
    }
    setBatchInspecting(true);
    try {
      const rows: BatchBoardItem[] = [];
      for (let i = 0; i < accepted.length; i += 1) {
        const file = accepted[i];
        try {
          const previewUrl = await fileToDataUrl(file);
          const size = await readImageNaturalSize(previewUrl);
          const classified = classifyAvatarBatchImage(size.width, size.height, file);
          rows.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${i}`,
            file,
            previewUrl,
            width: classified.width,
            height: classified.height,
            status: classified.status,
            label: classified.label,
            reason: classified.reason,
            phase: 'idle',
          });
        } catch {
          rows.push({
            id: `${file.name}-${file.size}-${i}-bad`,
            file,
            previewUrl: '',
            width: 0,
            height: 0,
            status: 'invalid',
            label: '不合格',
            reason: '无法读取图片',
            phase: 'idle',
          });
        }
      }
      setBatchBoard((prev) => [...prev.filter((r) => r.phase !== 'done'), ...rows]);
      setBatchBoardOpen(true);
      const pass = rows.filter((r) => r.status === 'pass').length;
      const need = rows.filter((r) => r.status === 'need_crop').length;
      const bad = rows.filter((r) => r.status === 'invalid').length;
      toast.success(`已检视 ${rows.length} 张：合格 ${pass} · 需裁切 ${need} · 不合格 ${bad}`);
    } finally {
      setBatchInspecting(false);
    }
  };

  /** 功能注释：看板点击——合格可直接走裁切确认；需裁切强制不可关闭 */
  const onBoardItemAction = async (row: BatchBoardItem) => {
    if (row.phase === 'done' || row.phase === 'uploading' || uploading) return;
    if (row.status === 'invalid') {
      toast.error(row.reason || '该图不合格，无法上传');
      return;
    }
    if (!cropGateRef.current) {
      toast.error('裁剪组件未就绪');
      return;
    }
    activeBatchIdRef.current = row.id;
    setActiveBatchId(row.id);
    const forceCrop = row.status === 'need_crop';
    const result = await cropGateRef.current.openFile(row.file, {
      forceCrop,
      allowClose: !forceCrop,
    });
    if (result === 'reject') {
      activeBatchIdRef.current = null;
      setActiveBatchId(null);
      patchBoardItem(row.id, { phase: 'error', errorText: '无法打开裁切' });
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
    toast.success('已删除库记录（角色已绑副本保留）');
    await load();
  };

  const onDelist = async () => {
    if (!token || !delistId) return;
    const res = await avatarLibraryApi.delist(token, delistId);
    setDelistId(null);
    if (!res.success) {
      toast.error(res.message || '下架失败');
      return;
    }
    toast.success('已下架，不再参与自动匹配');
    await load();
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h2 className={styles.title}>公共头像</h2>
        <p className={styles.sub}>{describeSquareAvatarUploadHints()} 运营与管理员均可上传公共/系统头像。</p>
      </header>

      <section className={styles.panel} aria-label="库范围与筛选">
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="头像库范围">
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'admin'}
              className={scope === 'admin' ? styles.tabActive : styles.tab}
              onClick={() => setScope('admin')}
            >
              公共 / 系统库
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'user-uploads'}
              className={scope === 'user-uploads' ? styles.tabActive : styles.tab}
              onClick={() => setScope('user-uploads')}
            >
              用户私人上传
            </button>
          </div>
          <input
            className={styles.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题…"
            aria-label="搜索标题"
          />
        </div>

        <div className={styles.filters}>
          {scope === 'admin' ? (
            <SegOptions
              label="类型"
              value={kindFilter}
              allowEmpty
              emptyLabel="全部"
              options={[
                { id: 'public', label: '公共' },
                { id: 'system', label: '系统' },
              ]}
              onChange={setKindFilter}
            />
          ) : null}
          <SegOptions
            label="状态"
            value={statusFilter}
            allowEmpty
            emptyLabel="全部"
            options={[
              { id: 'active', label: '上架' },
              { id: 'delisted', label: '已下架' },
            ]}
            onChange={setStatusFilter}
          />
          <SegOptions label="性别" value={gender} options={AVATAR_ASSET_GENDERS} allowEmpty emptyLabel="全部" onChange={setGender} />
          <SegOptions label="年龄" value={ageGroup} options={ageOptions} allowEmpty emptyLabel="全部" onChange={setAgeGroup} />
          <SegOptions label="背景" value={backgroundType} options={backgroundOptions} allowEmpty emptyLabel="全部" onChange={setBackgroundType} />
        </div>
      </section>

      {scope === 'admin' ? (
        <section className={styles.panel} aria-label="标签选项配置">
          <p className={styles.panelTitle}>年龄段 / 背景类型（稳定 id，改名不影响匹配）</p>
          <AdminTagOptionsEditor
            token={token}
            options={tagOptions}
            newAgeLabel={newAgeLabel}
            newBgLabel={newBgLabel}
            setNewAgeLabel={setNewAgeLabel}
            setNewBgLabel={setNewBgLabel}
            onChanged={async () => {
              invalidateAvatarTagOptionsCache();
              await reloadTagOptions(true);
            }}
          />
        </section>
      ) : null}

      {scope === 'admin' ? (
        <section className={styles.panel} aria-label="上传入库">
          <p className={styles.panelTitle}>上传入库</p>
          <div className={styles.uploadForm}>
            <SegOptions
              label="入库类型"
              value={uploadKind}
              options={[
                { id: 'public', label: '公共头像' },
                { id: 'system', label: '系统头像' },
              ]}
              onChange={(v) => setUploadKind(v as UploadKind)}
            />
            <div className={styles.uploadMetaRow}>
              <SegOptions label="性别" value={formGender} options={AVATAR_ASSET_GENDERS} onChange={setFormGender} />
              <SegOptions label="年龄" value={formAge} options={ageOptions} onChange={setFormAge} />
              <SegOptions label="背景" value={formBg} options={backgroundOptions} onChange={setFormBg} />
            </div>
            <label className={styles.titleField}>
              <span className={styles.fieldLabel}>标题</span>
              <input
                className={styles.titleInput}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                maxLength={40}
                placeholder="可选，便于检索"
              />
            </label>
            <div className={styles.actionsRow}>
              <SquareAvatarCropGate
                ref={cropGateRef}
                disabled={uploading}
                buttonDisabled={uploading || batchBoardOpen}
                buttonClassName={styles.primaryBtn}
                buttonLabel={uploading ? '上传中…' : '上传'}
                onReady={(p) => void onCropReady(p)}
                onDismiss={() => {
                  if (activeBatchIdRef.current) {
                    activeBatchIdRef.current = null;
                    setActiveBatchId(null);
                  }
                }}
              />
              <label className={styles.secondaryBtn}>
                {batchInspecting ? '检视中…' : '批量选图'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  disabled={uploading || batchInspecting}
                  onChange={(e) => {
                    void onBatchPick(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {batchBoard.length > 0 ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setBatchBoardOpen(true)}
                >
                  打开看板（{batchBoard.filter((r) => r.phase !== 'done').length}）
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.panel} aria-label="头像列表">
        <p className={styles.panelTitle}>头像列表</p>
        {loading ? (
          <p className={styles.empty}>加载中…</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>暂无数据</p>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <button type="button" className={styles.thumbBtn} onClick={() => setPreview(item)}>
                  <AvatarFrame
                    src={getImageUrl(resolveLibraryAvatarDisplayUrl(item))}
                    alt={item.title || '头像'}
                    variant="rounded"
                  />
                </button>
                <p className={styles.meta}>
                  {avatarKindLabel(String(item.kind || ''))} · {item.status === 'delisted' ? '已下架' : '上架'}
                </p>
                <p className={styles.meta}>
                  {avatarGenderLabel(item.gender)} · {avatarAgeLabel(item.ageGroup, tagOptions)} · {avatarBackgroundLabel(item.backgroundType, tagOptions)}
                </p>
                {item.title ? <p className={styles.cardTitle}>{item.title}</p> : null}
                {item.ownerUserId ? <p className={styles.meta}>用户 {item.ownerUserId.slice(0, 8)}…</p> : null}
                <div className={styles.cardActions}>
                  {scope === 'admin' && item.status === 'active' && item.kind !== 'private' ? (
                    <button type="button" className={styles.warnBtn} onClick={() => setDelistId(item.id)}>下架</button>
                  ) : null}
                  <button type="button" className={styles.dangerBtn} onClick={() => setDeleteId(item.id)}>删除</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {batchBoardOpen
        ? createPortal(
            <div
              className={styles.batchOverlay}
              role="presentation"
              onClick={() => {
                if (!uploading && !activeBatchId) setBatchBoardOpen(false);
              }}
            >
              <div
                className={styles.batchBoard}
                role="dialog"
                aria-modal="true"
                aria-labelledby="avatar-batch-board-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className={styles.batchBoardHeader}>
                  <div className={styles.batchBoardHeading}>
                    <p className={styles.batchBoardEyebrow}>Avatar Intake</p>
                    <h3 id="avatar-batch-board-title" className={styles.batchBoardTitle}>
                      批量上传看板
                    </h3>
                    <p className={styles.batchBoardSub}>
                      点选卡片处理：合格可确认，非 1:1 须裁切且裁切层不可关闭。
                    </p>
                  </div>
                  <div className={styles.batchBoardHeaderActions}>
                    <span className={styles.batchBoardStat}>
                      {batchBoard.filter((r) => r.phase === 'done').length}/{batchBoard.length} 已上传
                    </span>
                    <button
                      type="button"
                      className={styles.batchGhostBtn}
                      disabled={uploading || !!activeBatchId}
                      onClick={() => setBatchBoardOpen(false)}
                    >
                      收起
                    </button>
                  </div>
                </header>
                <div className={styles.batchGrid}>
                  {batchBoard.map((row) => {
                    const badgeClass =
                      row.phase === 'done' || row.status === 'pass'
                        ? styles.batchBadgePass
                        : row.status === 'need_crop'
                          ? styles.batchBadgeCrop
                          : styles.batchBadgeBad;
                    const badgeText = row.phase === 'done' ? '正常' : row.label;
                    const actionLabel =
                      row.phase === 'done'
                        ? '正常'
                        : row.phase === 'uploading'
                          ? '上传中…'
                          : row.status === 'pass'
                            ? '去确认'
                            : row.status === 'need_crop'
                              ? '去裁切'
                              : '不可用';
                    const locked =
                      uploading
                      || row.phase === 'done'
                      || row.phase === 'uploading'
                      || row.status === 'invalid'
                      || (!!activeBatchId && activeBatchId !== row.id);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className={[
                          styles.batchCard,
                          activeBatchId === row.id ? styles.batchCardActive : '',
                          row.phase === 'done' ? styles.batchCardDone : '',
                          locked && row.phase !== 'done' ? styles.batchCardLocked : '',
                        ].filter(Boolean).join(' ')}
                        disabled={locked}
                        onClick={() => void onBoardItemAction(row)}
                        title={row.reason || row.file.name}
                      >
                        <span className={styles.batchThumbWrap}>
                          {row.previewUrl ? (
                            <img src={row.previewUrl} alt="" className={styles.batchThumb} />
                          ) : (
                            <span className={styles.batchThumbEmpty}>无预览</span>
                          )}
                          <span className={badgeClass}>{badgeText}</span>
                          <span className={styles.batchCardShade} aria-hidden="true" />
                          <span className={styles.batchCardInfo}>
                            <span className={styles.batchName}>{row.file.name}</span>
                            <span className={styles.batchMeta}>
                              {row.width > 0 ? `${row.width}×${row.height}` : '—'}
                              {row.phase === 'error' && row.errorText ? ` · ${row.errorText}` : ''}
                            </span>
                            <span className={styles.batchCardCta}>{actionLabel}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <footer className={styles.batchBoardFooter}>
                  <div className={styles.batchBoardFooterActions}>
                    <button
                      type="button"
                      className={styles.batchGhostBtn}
                      disabled={uploading || !!activeBatchId}
                      onClick={clearBatchBoard}
                    >
                      清空看板
                    </button>
                    <button
                      type="button"
                      className={styles.batchSaveBtn}
                      disabled={uploading || !!activeBatchId}
                      onClick={() => {
                        const unfinished = batchBoard.filter(
                          (r) => r.phase !== 'done' && r.status !== 'invalid',
                        );
                        if (unfinished.length > 0) {
                          toast.error(`还有 ${unfinished.length} 张未处理，请先裁切或确认上传`);
                          return;
                        }
                        clearBatchBoard();
                        toast.success('已保存，看板已关闭');
                      }}
                    >
                      保存
                    </button>
                  </div>
                  <p className={styles.batchBoardFootnote}>
                    需裁切 {batchBoard.filter((r) => r.status === 'need_crop' && r.phase !== 'done').length}
                    · 待确认 {batchBoard.filter((r) => r.status === 'pass' && r.phase !== 'done').length}
                    · 不合格 {batchBoard.filter((r) => r.status === 'invalid').length}
                  </p>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmModal
        isOpen={!!deleteId}
        title="删除头像"
        message="删除库记录后，已绑定到角色的头像副本仍会保留。确认删除？"
        confirmButtonText="删除"
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmModal
        isOpen={!!delistId}
        title="下架头像"
        message="下架后不再参与自动匹配；已有角色仍保留该头像。确认下架？"
        confirmButtonText="下架"
        onConfirm={() => void onDelist()}
        onCancel={() => setDelistId(null)}
      />
      <ConfirmModal
        isOpen={!!preview}
        title={preview?.title || '预览'}
        message={preview ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AvatarFrame
              src={getImageUrl(resolveLibraryAvatarDisplayUrl(preview))}
              alt="预览"
              variant="rounded"
              size={280}
            />
          </div>
        ) : ''}
        confirmButtonText="关闭"
        variant="alert"
        onConfirm={() => setPreview(null)}
        onCancel={() => setPreview(null)}
      />
    </div>
  );
};

/** 功能注释：后台维护年龄/背景选项；已用选项只能停用不能删；改名不改 id */
function AdminTagOptionsEditor({
  token,
  options,
  newAgeLabel,
  newBgLabel,
  setNewAgeLabel,
  setNewBgLabel,
  onChanged,
}: {
  token?: string | null;
  options: AvatarTagOption[];
  newAgeLabel: string;
  newBgLabel: string;
  setNewAgeLabel: (v: string) => void;
  setNewBgLabel: (v: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const ages = options.filter((o) => o.dimension === 'age_group');
  const bgs = options.filter((o) => o.dimension === 'background_type');

  const startRename = (opt: AvatarTagOption) => {
    setEditingId(opt.id);
    setEditingLabel(opt.label);
  };

  const commitRename = async (opt: AvatarTagOption) => {
    if (!token) return;
    const label = editingLabel.trim();
    if (!label) {
      toast.error('名称不能为空');
      return;
    }
    if (label === opt.label) {
      setEditingId(null);
      return;
    }
    const res = await avatarLibraryApi.updateTagOption(token, opt.id, { label });
    if (!res.success) {
      toast.error(res.message || '重命名失败');
      return;
    }
    setEditingId(null);
    toast.success('已重命名');
    await onChanged();
  };

  const toggle = async (opt: AvatarTagOption) => {
    if (!token) return;
    const status = opt.status === 'disabled' ? 'active' : 'disabled';
    const res = await avatarLibraryApi.updateTagOption(token, opt.id, { status });
    if (!res.success) {
      toast.error(res.message || '更新失败');
      return;
    }
    toast.success(status === 'disabled' ? '已停用' : '已启用');
    await onChanged();
  };

  const remove = async (opt: AvatarTagOption) => {
    if (!token) return;
    const res = await avatarLibraryApi.deleteTagOption(token, opt.id);
    if (!res.success) {
      toast.error(res.message || '删除失败');
      return;
    }
    toast.success('已删除');
    await onChanged();
  };

  const add = async (dimension: 'age_group' | 'background_type', label: string, clear: () => void) => {
    if (!token) return;
    const text = label.trim();
    if (!text) {
      toast.error('请填写名称');
      return;
    }
    const res = await avatarLibraryApi.createTagOption(token, { dimension, label: text });
    if (!res.success) {
      toast.error(res.message || '新增失败');
      return;
    }
    clear();
    toast.success('已新增');
    await onChanged();
  };

  const move = async (dimension: 'age_group' | 'background_type', id: string, dir: -1 | 1) => {
    if (!token) return;
    const list = (dimension === 'age_group' ? ages : bgs).map((o) => o.id);
    const idx = list.indexOf(id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    const res = await avatarLibraryApi.reorderTagOptions(token, dimension, list);
    if (!res.success) {
      toast.error(res.message || '排序失败');
      return;
    }
    await onChanged();
  };

  const renderGroup = (title: string, list: AvatarTagOption[], dimension: 'age_group' | 'background_type') => (
    <div className={styles.tagGroup}>
      <p className={styles.fieldLabel}>{title}</p>
      <ul className={styles.tagList}>
        {list.map((opt, index) => (
          <li key={opt.id} className={styles.tagRow}>
            <span className={styles.tagMain}>
              {editingId === opt.id ? (
                <input
                  className={styles.titleInput}
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  maxLength={40}
                  aria-label="选项名称"
                />
              ) : (
                <strong>{opt.label}</strong>
              )}
              <span className={styles.tagMeta}>
                id={opt.id}
                {opt.status === 'disabled' ? ' · 已停用' : ''}
                {opt.isBuiltin ? ' · 内置' : ''}
              </span>
            </span>
            <span className={styles.tagActions}>
              <button type="button" className={styles.secondaryBtn} disabled={index === 0} onClick={() => void move(dimension, opt.id, -1)}>↑</button>
              <button type="button" className={styles.secondaryBtn} disabled={index >= list.length - 1} onClick={() => void move(dimension, opt.id, 1)}>↓</button>
              {editingId === opt.id ? (
                <>
                  <button type="button" className={styles.secondaryBtn} onClick={() => void commitRename(opt)}>保存</button>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setEditingId(null)}>取消</button>
                </>
              ) : (
                <button type="button" className={styles.secondaryBtn} onClick={() => startRename(opt)}>改名</button>
              )}
              <button type="button" className={styles.secondaryBtn} onClick={() => void toggle(opt)}>
                {opt.status === 'disabled' ? '启用' : '停用'}
              </button>
              {!opt.isBuiltin ? (
                <button type="button" className={styles.dangerBtn} onClick={() => void remove(opt)}>删除</button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className={styles.tagEditor}>
      {renderGroup('年龄段', ages, 'age_group')}
      <div className={styles.tagAddRow}>
        <input
          className={styles.titleInput}
          value={newAgeLabel}
          onChange={(e) => setNewAgeLabel(e.target.value)}
          placeholder="新增年龄段名称"
          maxLength={40}
        />
        <button type="button" className={styles.secondaryBtn} onClick={() => void add('age_group', newAgeLabel, () => setNewAgeLabel(''))}>
          新增年龄段
        </button>
      </div>
      {renderGroup('背景类型', bgs, 'background_type')}
      <div className={styles.tagAddRow}>
        <input
          className={styles.titleInput}
          value={newBgLabel}
          onChange={(e) => setNewBgLabel(e.target.value)}
          placeholder="新增背景类型名称"
          maxLength={40}
        />
        <button type="button" className={styles.secondaryBtn} onClick={() => void add('background_type', newBgLabel, () => setNewBgLabel(''))}>
          新增背景
        </button>
      </div>
      <p className={styles.sub}>已被头像使用的选项不能删除，只能停用；性别固定为男 / 女 / 通用，不可在此配置。</p>
    </div>
  );
}

export default AdminPublicAvatarManager;
