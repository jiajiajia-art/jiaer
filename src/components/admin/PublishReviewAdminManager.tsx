import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminReportApi, {
  PUBLISH_REJECT_REASON_OPTIONS,
  type AdminPublishQueueItem,
  type PublishRejectReasonId,
} from '../../api/admin/adminReportApi';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import { getAppBasePath } from '../../lib/appBasePath';
import styles from './CommentAdminManager.module.css';
import local from './ContentReportAdminManager.module.css';

const PAGE_SIZE = 20;

const formatTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const displayNickname = (name: string | null | undefined): string => {
  const trimmed = name?.trim();
  return trimmed || '未设置昵称';
};

/** 功能注释：引擎展示名，至少醒目标出 ROMANCE */
const engineLabel = (engine?: string | null, gameTags?: string | null): string => {
  const raw = String(engine || gameTags || '')
    .trim()
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .split(',')[0]
    .replace(/^["']|["']$/g, '')
    .trim()
    .toUpperCase();
  if (!raw) return '未知';
  return raw;
};

const isRomanceEngine = (engine?: string | null, gameTags?: string | null): boolean =>
  engineLabel(engine, gameTags) === 'ROMANCE';

type ConfirmAction =
  | { kind: 'approve'; item: AdminPublishQueueItem }
  | { kind: 'reject'; item: AdminPublishQueueItem }
  | { kind: 'clearNeedReview'; item: AdminPublishQueueItem };

type FormPreviewState = {
  fileId: string;
  title: string;
  loading: boolean;
  error: string | null;
  summary: {
    name?: string;
    intro?: string;
    setting?: string;
    npcCount: number;
    roomCount: number;
    loreCount: number;
    hasCover: boolean;
    roomsWithBg: number;
  } | null;
};

/** 功能注释：从待审 editor.json 抽只读摘要，改 UI 不回写 */
function summarizeRomancePending(content: unknown): FormPreviewState['summary'] {
  const root = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>;
  const mod = (root.mod && typeof root.mod === 'object' ? root.mod : root) as Record<string, unknown>;
  const draft = (root.draft && typeof root.draft === 'object' ? root.draft : mod) as Record<string, unknown>;
  const contentBag = (draft.content && typeof draft.content === 'object'
    ? draft.content
    : mod.content && typeof mod.content === 'object'
      ? mod.content
      : draft) as Record<string, unknown>;
  const npcs = Array.isArray(contentBag.npcs) ? contentBag.npcs : [];
  const rooms = Array.isArray(contentBag.rooms) ? contentBag.rooms : [];
  const lore = Array.isArray(contentBag.worldBook)
    ? contentBag.worldBook
    : Array.isArray(contentBag.lore)
      ? contentBag.lore
      : [];
  const roomsWithBg = rooms.filter((r) => {
    if (!r || typeof r !== 'object') return false;
    const bg = (r as { bg?: unknown }).bg;
    return typeof bg === 'string' && bg.trim().length > 0;
  }).length;
  const name = String(draft.name || mod.name || contentBag.name || '').trim();
  const intro = String(draft.blurb || draft.intro || mod.blurb || contentBag.blurb || '').trim();
  const setting = String(draft.setting || contentBag.setting || '').trim();
  const cover = String(draft.cover || draft.coverUrl || mod.cover || '').trim();
  return {
    name: name || undefined,
    intro: intro || undefined,
    setting: setting || undefined,
    npcCount: npcs.length,
    roomCount: rooms.length,
    loreCount: lore.length,
    hasCover: cover.length > 0,
    roomsWithBg,
  };
}

/** 功能注释：运营「发布审核」— 过/驳 + Romance 预览表单/游戏 + 审核标准 + 结构化驳回 */
const PublishReviewAdminManager: React.FC = () => {
  const [list, setList] = useState<AdminPublishQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectReasons, setRejectReasons] = useState<PublishRejectReasonId[]>([]);
  const [formPreview, setFormPreview] = useState<FormPreviewState | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const standardsHref = useMemo(() => {
    const base = getAppBasePath().replace(/\/$/, '');
    return `${base}/legal/work-review-standards`;
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminReportApi.listPublishQueue({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '加载发布审核列表失败');
      }
      setList(response.data.data.list || []);
      setTotal(response.data.data.total || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载发布审核列表失败'));
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openFormPreview = async (item: AdminPublishQueueItem) => {
    setFormPreview({
      fileId: item.fileId,
      title: item.title?.trim() || item.fileId,
      loading: true,
      error: null,
      summary: null,
    });
    try {
      const response = await adminReportApi.getRomancePendingReviewContent(item.fileId);
      if (!response.data.success) {
        throw new Error(response.data.message || '拉取待审正文失败');
      }
      const content = response.data.data?.content;
      setFormPreview({
        fileId: item.fileId,
        title: item.title?.trim() || item.fileId,
        loading: false,
        error: null,
        summary: summarizeRomancePending(content),
      });
    } catch (error) {
      setFormPreview({
        fileId: item.fileId,
        title: item.title?.trim() || item.fileId,
        loading: false,
        error: getApiErrorMessage(error, '拉取待审正文失败'),
        summary: null,
      });
    }
  };

  /** 功能注释：审核预览读待审快照；退出后仍为审核中，不写公开存档 */
  const openGamePreview = (item: AdminPublishQueueItem) => {
    const base = getAppBasePath().replace(/\/$/, '');
    const url = `${base}/romance/?reviewPreview=1&fileId=${encodeURIComponent(item.fileId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const fileId = confirm.item.fileId;
    const userId = confirm.item.creatorUserId;
    setBusyKey(confirm.kind === 'clearNeedReview' ? `user:${userId}` : `file:${fileId}`);
    try {
      if (confirm.kind === 'approve') {
        const response = await adminReportApi.approvePublishQueue(fileId);
        toast.success(response.data.message || '已通过，作品已公开');
      } else if (confirm.kind === 'reject') {
        const reasonLabels = PUBLISH_REJECT_REASON_OPTIONS.filter((o) =>
          rejectReasons.includes(o.id),
        ).map((o) => o.label);
        const combinedNote = [reasonLabels.length ? `原因：${reasonLabels.join('、')}` : '', rejectNote.trim()]
          .filter(Boolean)
          .join('\n');
        const response = await adminReportApi.rejectPublishQueue(
          fileId,
          combinedNote || undefined,
          rejectReasons,
        );
        toast.success(response.data.message || '已驳回，作品保持私密');
      } else {
        if (!userId) throw new Error('缺少创作者 userId');
        const response = await adminReportApi.clearPublishNeedReview(userId);
        toast.success(response.data.message || '已关闭先审，之后可直发');
      }
      setConfirm(null);
      setRejectNote('');
      setRejectReasons([]);
      void loadQueue();
    } catch (error) {
      const fallback =
        confirm.kind === 'approve'
          ? '通过失败'
          : confirm.kind === 'reject'
            ? '驳回失败'
            : '关闭先审失败';
      toast.error(getApiErrorMessage(error, fallback));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleRejectReason = (id: PublishRejectReasonId) => {
    setRejectReasons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className={local.panelStack}>
      <div className={`${styles.card} ${local.filterCard}`}>
        <label className={`${local.field} ${local.fieldGrow}`}>
          <span className={local.fieldLabel}>关键词</span>
          <input
            className={local.control}
            value={keywordInput}
            placeholder="作品 id、标题或创作者"
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setKeyword(keywordInput.trim());
              }
            }}
          />
        </label>
        <button
          type="button"
          className={local.toolbarBtn}
          onClick={() => {
            setPage(1);
            setKeyword(keywordInput.trim());
          }}
        >
          搜索
        </button>
        <button
          type="button"
          className={local.toolbarBtn}
          onClick={() => void loadQueue()}
          disabled={loading}
        >
          刷新
        </button>
        <a
          className={local.toolbarBtn}
          href={standardsHref}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          《作品审核标准》
        </a>
      </div>

      <div className={styles.card}>
        {loading ? (
          <p className={styles.emptyState}>加载中…</p>
        ) : list.length === 0 ? (
          <p className={styles.emptyState}>暂无待审作品</p>
        ) : (
          <div className={local.tableWrap}>
            <table className={local.table}>
              <thead>
                <tr>
                  <th>作品</th>
                  <th>fileId / 引擎</th>
                  <th>创作者</th>
                  <th>提交时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const cover = row.coverUrl ? getImageUrl(row.coverUrl) : '';
                  const submitted = row.submittedAt || row.createdAt;
                  const eng = engineLabel(row.engine, row.gameTags);
                  const romance = isRomanceEngine(row.engine, row.gameTags);
                  return (
                    <tr key={row.fileId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {cover ? (
                            <img
                              src={cover}
                              alt=""
                              width={40}
                              height={40}
                              style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : null}
                          <div>
                            <div>
                              {row.title?.trim() || '未命名作品'}{' '}
                              <strong>{row.reviewKind === 'update' ? '【更新】' : '【新作品】'}</strong>
                            </div>
                            {row.reviewKind === 'update' ? (
                              <div className={styles.cardDesc} style={{ margin: 0, fontSize: 12 }}>
                                当前公开版本 v{row.publishedVersion || 1}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{row.fileId}</code>
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: romance ? 'rgba(200, 80, 120, 0.12)' : 'rgba(0,0,0,0.06)',
                              color: romance ? '#a12d5a' : '#444',
                            }}
                          >
                            {eng}
                          </span>
                        </div>
                      </td>
                      <td>
                        {row.creatorUserCode ? (
                          <Link
                            className={local.factLink}
                            to={`/account/${encodeURIComponent(row.creatorUserCode)}`}
                            state={{ from: '/operator/publish-queue' }}
                          >
                            {displayNickname(row.creatorNickname || row.authorName)}
                          </Link>
                        ) : (
                          displayNickname(row.creatorNickname || row.authorName)
                        )}
                        <div className={styles.cardDesc} style={{ margin: 0, fontSize: 12 }}>
                          {row.creatorUserId}
                        </div>
                      </td>
                      <td>{formatTime(submitted)}</td>
                      <td>
                        <div className={local.decisionRow} style={{ marginTop: 0, flexWrap: 'wrap' }}>
                          {romance ? (
                            <>
                              <button
                                type="button"
                                className={local.decisionBtn}
                                disabled={Boolean(busyKey)}
                                onClick={() => void openFormPreview(row)}
                              >
                                预览表单
                              </button>
                              <button
                                type="button"
                                className={local.decisionBtn}
                                disabled={Boolean(busyKey)}
                                onClick={() => openGamePreview(row)}
                              >
                                预览游戏
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className={`${local.decisionBtn} ${local.decisionApprove}`}
                            disabled={Boolean(busyKey)}
                            onClick={() => setConfirm({ kind: 'approve', item: row })}
                          >
                            通过
                          </button>
                          <button
                            type="button"
                            className={`${local.decisionBtn} ${local.decisionReject}`}
                            disabled={Boolean(busyKey)}
                            onClick={() => {
                              setRejectNote('');
                              setRejectReasons([]);
                              setConfirm({ kind: 'reject', item: row });
                            }}
                          >
                            驳回
                          </button>
                          <button
                            type="button"
                            className={local.decisionBtn}
                            style={{
                              background: '#fffdfb',
                              color: '#5e3f2a',
                              borderColor: 'rgba(165, 96, 47, 0.45)',
                            }}
                            disabled={Boolean(busyKey) || !row.creatorUserId}
                            onClick={() => setConfirm({ kind: 'clearNeedReview', item: row })}
                          >
                            关闭先审
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span className={styles.pageInfo}>
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(confirm)}
        tone="admin"
        title={
          confirm?.kind === 'approve'
            ? '确认通过公开？'
            : confirm?.kind === 'reject'
              ? '确认驳回公开？'
              : '确认关闭该账号先审？'
        }
        message={
          confirm?.kind === 'approve' ? (
            `通过后「${confirm.item.title?.trim() || confirm.item.fileId}」将对访客公开。`
          ) : confirm?.kind === 'reject' ? (
            <div>
              <p style={{ margin: '0 0 10px' }}>
                驳回后作品保持私密，创作者可修改后再提交。勾选原因会展示给创作者。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {PUBLISH_REJECT_REASON_OPTIONS.map((opt) => {
                  const on = rejectReasons.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={on}
                      className={local.decisionBtn}
                      style={{
                        background: on ? 'rgba(200,80,80,0.12)' : undefined,
                        borderColor: on ? 'rgba(180,60,60,0.5)' : undefined,
                      }}
                      onClick={() => toggleRejectReason(opt.id)}
                      disabled={Boolean(busyKey)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <label className={local.field}>
                <span className={local.fieldLabel}>补充说明（可选）</span>
                <textarea
                  className={local.note}
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  disabled={Boolean(busyKey)}
                />
              </label>
            </div>
          ) : (
            `关闭后，${displayNickname(confirm?.item.creatorNickname || confirm?.item.authorName)}（${confirm?.item.creatorUserId || '—'}）之后发布可直发，不必再进队。本条作品仍须单独通过/驳回。`
          )
        }
        confirmButtonText={busyKey ? '处理中…' : '确认'}
        cancelButtonText="取消"
        onCancel={() => {
          if (!busyKey) {
            setConfirm(null);
            setRejectNote('');
            setRejectReasons([]);
          }
        }}
        onConfirm={() => {
          void handleConfirm();
        }}
      />

      <ConfirmModal
        isOpen={Boolean(formPreview)}
        tone="admin"
        variant="alert"
        title={`预览表单 · ${formPreview?.title || ''}`}
        message={
          formPreview?.loading ? (
            <p>加载待审快照…</p>
          ) : formPreview?.error ? (
            <p style={{ color: '#a12d5a' }}>{formPreview.error}</p>
          ) : formPreview?.summary ? (
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              <p style={{ margin: '0 0 8px' }}>
                <b>只读</b> · fileId <code>{formPreview.fileId}</code> · 改动不会写回待审包
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <b>名称</b>：{formPreview.summary.name || '（空）'}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <b>介绍</b>：{formPreview.summary.intro || '（空）'}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <b>设定摘要</b>：{formPreview.summary.setting || '（空）'}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                人物 {formPreview.summary.npcCount} · 地点 {formPreview.summary.roomCount}（有背景图{' '}
                {formPreview.summary.roomsWithBg}）· 世界书 {formPreview.summary.loreCount} · 封面{' '}
                {formPreview.summary.hasCover ? '有' : '缺'}
              </p>
            </div>
          ) : (
            <p>无内容</p>
          )
        }
        confirmButtonText="关闭"
        onCancel={() => setFormPreview(null)}
        onConfirm={() => setFormPreview(null)}
      />
    </div>
  );
};

export default PublishReviewAdminManager;
