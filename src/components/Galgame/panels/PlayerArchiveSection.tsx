import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  applyPlayerCardImport,
  mergeProfileAfterPlayerCardImport,
  filterPlayerCharacterCards,
  PLAYER_CARD_GENDERS,
  PLAYER_CARD_LIMITS,
  previewPlayerCardImportDiff,
  isSessionUploadedPortraitUrl,
  type PlayerCardGender,
  type PlayerCharacterCard,
  type SessionPlayerProfile,
  validatePlayerCharacterCardInput,
} from '../../../lib/galgame/playerCharacterCard';
import { resolvePlayerDisplayNameOrFallback } from '../../../lib/galgame/playerDisplayName';
import { normalizeGameStartGender } from '../../../lib/galgame/gameStartConfig';
import { playerCharacterCardsApi, sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import { NPC_PROFILE_FIELD_GENERATION_COST, getImageUrl } from '../../../utils/constants';
import { useImageBusinessPrice } from '../../../hooks/useImageBusinessPrice';
import { getApiErrorMessage } from '../../../utils/error';
import {
  pickDisplayAvatarFullUrl,
} from '../../../lib/galgame/avatarThumbUrl';
import {
  isPlayerAvatarGenBusy,
  startPlayerAvatarBackgroundGen,
  subscribePlayerAvatarGenBusy,
} from '../../../lib/galgame/playerAvatarBackgroundJob';
import { mergePlayerAvatarIntoProfile } from '../../../lib/galgame/playerAvatarMerge';
import {
  PLAYER_UPLOAD_AVATAR_ACCEPT,
  PLAYER_UPLOAD_AVATAR_MAX_BYTES,
  compressImageFileToWebpUnderMaxBytes,
} from '../../../lib/galgame/compressImageToWebp';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import {
  formatSessionProfileCharge,
  getSessionProfileBillingPreview,
  resolveSessionProfileBalancePatch,
  sessionProfileCurrencyLabel,
} from '../../../lib/sessionProfileBilling';
import TrimmedTransparentImg from '../../TrimmedTransparentImg';
import GameConfirmModal from '../GameConfirmModal';
import {
  AVATAR_STYLE_OPTIONS,
  DEFAULT_AVATAR_STYLE,
  type AvatarStyleId,
} from '../../../lib/galgame/sessionNpcAvatarPrompt';
import shell from './PlayPanelShell.module.css';
import styles from './PlayerArchiveSection.module.css';

export type PlayerArchiveView = 'overview' | 'edit' | 'import' | 'preview';

interface PlayerArchiveSectionProps {
  profile: SessionPlayerProfile | null;
  onProfileChange: (profile: SessionPlayerProfile) => void;
  view: PlayerArchiveView;
  onViewChange: (view: PlayerArchiveView) => void;
  /** 文档主角名，用于编辑默认值（禁止落到「玩家」） */
  documentPlayerName?: string | null;
  documentPlayerGender?: string | null;
  /** 文档主角立绘 URL（相对或绝对），局内档案无头像时回退 */
  documentPlayerAvatarUrl?: string | null;
  /** 主角变更写入历史后刷新历史面板 */
  onHistoryMaybeChanged?: () => void | Promise<void>;
  /** A/B treatment：换角后展示 AI 生头像并扣积分 */
  playerAvatarAbOnChange?: boolean;
  onPlayerAvatarAbChange?: (enabled: boolean) => void;
}

const GENDER_LABEL: Record<PlayerCardGender, string> = {
  female: '女',
  male: '男',
  other: '其他',
};

/** UE 性别顺序：女 / 男 / 其他 */
const GENDER_ORDER: PlayerCardGender[] = ['female', 'male', 'other'];

function genderText(g?: string | null) {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '其他';
}

/**
 * UE 属性模块：
 * 总览（我的档案）→ 编辑档案弹层
 * 总览 → 导入列表 → 预览确认 → 回总览
 * 配色主题红，交互严格对齐流程图。
 */
const PlayerArchiveSection: React.FC<PlayerArchiveSectionProps> = ({
  profile,
  onProfileChange,
  view,
  onViewChange,
  documentPlayerName = null,
  documentPlayerGender = null,
  documentPlayerAvatarUrl = null,
  onHistoryMaybeChanged,
  playerAvatarAbOnChange = false,
  onPlayerAvatarAbChange,
}) => {
  const { sessionId } = useGameStore();
  const {
    data: sessionAvatarPricing,
    estimatedPoints: sessionAvatarPrice,
    priceUnavailable: sessionAvatarPriceUnavailable,
    error: sessionAvatarPriceError,
  } = useImageBusinessPrice('session_avatar_control', undefined, sessionId);
  const sessionAvatarCost = sessionAvatarPrice ?? 0;
  const billingSearch = typeof window === 'undefined' ? '' : window.location.search;
  const avatarBillingPreview = getSessionProfileBillingPreview(
    billingSearch,
    sessionAvatarCost,
    sessionAvatarPricing,
  );
  const textBillingPreview = getSessionProfileBillingPreview(
    billingSearch,
    NPC_PROFILE_FIELD_GENERATION_COST,
  );
  const avatarChargeText = formatSessionProfileCharge(avatarBillingPreview);
  const textChargeText = formatSessionProfileCharge(textBillingPreview);
  const authUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [saving, setSaving] = useState(false);
  const [personaAiBusy, setPersonaAiBusy] = useState(false);
  const [personaAiConfirmOpen, setPersonaAiConfirmOpen] = useState(false);
  const [avatarAiBusy, setAvatarAiBusy] = useState(() => isPlayerAvatarGenBusy(sessionId));
  const [avatarAiConfirmOpen, setAvatarAiConfirmOpen] = useState(false);
  /** 对齐添加角色：确认弹窗内选画风 + 可选外貌补充 */
  const [avatarPromptOpen, setAvatarPromptOpen] = useState(false);
  const [avatarPromptSupplement, setAvatarPromptSupplement] = useState('');
  const [avatarStyleId, setAvatarStyleId] = useState<AvatarStyleId>(DEFAULT_AVATAR_STYLE);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [query, setQuery] = useState('');
  const [previewCard, setPreviewCard] = useState<PlayerCharacterCard | null>(null);

  // 功能注释：后台生头像跨页面；订阅 busy 展示「生成中」
  useEffect(() => {
    return subscribePlayerAvatarGenBusy(sessionId, setAvatarAiBusy);
  }, [sessionId]);

  const resolveDraftName = (fromProfile?: string | null) =>
    resolvePlayerDisplayNameOrFallback([fromProfile, documentPlayerName]);

  const resolveDraftGender = (fromProfile?: string | null): PlayerCardGender => {
    const g = normalizeGameStartGender(fromProfile || documentPlayerGender);
    return (PLAYER_CARD_GENDERS.includes(g as PlayerCardGender)
      ? g
      : 'other') as PlayerCardGender;
  };

  const [draft, setDraft] = useState({
    name: resolveDraftName(profile?.name),
    gender: resolveDraftGender(profile?.gender),
    persona: profile?.persona || '',
  });

  const filtered = useMemo(
    () => filterPlayerCharacterCards(cards, query),
    [cards, query],
  );

  const previewDiff = useMemo(() => {
    if (!previewCard) return null;
    return previewPlayerCardImportDiff(profile, previewCard);
  }, [previewCard, profile]);

  const displayName = resolvePlayerDisplayNameOrFallback([profile?.name, documentPlayerName]) || '未设置';
  // 功能注释：方框 bust 裁切必须用原图；_150 小图再 bust 会裁成几十像素、脸被切碎
  const avatarFullPath = pickDisplayAvatarFullUrl([
    profile?.avatarUrl,
    documentPlayerAvatarUrl,
    profile?.avatarThumbUrl,
  ]);
  const avatarFullSrc = avatarFullPath ? getImageUrl(avatarFullPath) : '';
  const avatarSrc = avatarFullSrc;
  const sessionAvatarFull = String(profile?.avatarUrl || '').trim();
  const needsAvatar = !!profile?.avatarNeedsRegen || !sessionAvatarFull;
  /** 用户上传多为整图海报，bust 裁切会糊且裁歪 */
  const avatarVariant = isSessionUploadedPortraitUrl(profile?.avatarUrl) ? 'full' : 'bust';
  const avatarStageClass = `${styles.avatarHit}${avatarVariant === 'full' ? ` ${styles.avatarHitPoster}` : ''}`;

  const openEdit = () => {
    setDraft({
      name: resolveDraftName(profile?.name),
      gender: resolveDraftGender(
        profile?.gender && PLAYER_CARD_GENDERS.includes(profile.gender)
          ? profile.gender
          : null,
      ),
      persona: profile?.persona || '',
    });
    onViewChange('edit');
  };

  const closeToOverview = () => {
    setPreviewCard(null);
    setQuery('');
    onViewChange('overview');
  };

  const saveEdit = async () => {
    const checked = validatePlayerCharacterCardInput({
      name: draft.name,
      gender: draft.gender,
      persona: draft.persona,
      attributes: profile?.customAttributes || {},
    });
    if (!checked.ok) {
      toast.error(checked.message || '档案无效');
      return;
    }
    const next: SessionPlayerProfile = {
      name: checked.data.name,
      gender: checked.data.gender,
      persona: checked.data.persona,
      customAttributes: profile?.customAttributes || {},
      importedCardId: profile?.importedCardId,
      ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      ...(profile?.avatarThumbUrl ? { avatarThumbUrl: profile.avatarThumbUrl } : {}),
    };
    const token = authUser?.token;
    setSaving(true);
    try {
      if (sessionId && token) {
        const res = await sessionPlayerProfileApi.putPlayerProfile(token, sessionId, next);
        if (!res?.success) {
          toast.error(res?.message || '保存失败');
          return;
        }
        if (typeof res.data?.ab?.generateOnChange === 'boolean') {
          onPlayerAvatarAbChange?.(!!res.data.ab.generateOnChange);
        }
        const saved = res.data?.profile && typeof res.data.profile === 'object'
          ? { ...next, ...res.data.profile }
          : next;
        const change = res.data?.protagonistChange;
        onProfileChange(saved);
        onViewChange('overview');
        if (change?.content) {
          toast.success(`${change.content}（下一句起按新身份）`);
          void onHistoryMaybeChanged?.();
        } else {
          toast.success('档案已更新');
        }
        if (playerAvatarAbOnChange || res.data?.ab?.generateOnChange) {
          if (saved.avatarNeedsRegen || !saved.avatarUrl) {
            toast(`实验组：请为新身份生成头像（将扣除${sessionProfileCurrencyLabel(avatarBillingPreview.currency)}）`);
          }
        }
        return;
      }
      onProfileChange(next);
      onViewChange('overview');
      toast.success('档案已更新');
    } finally {
      setSaving(false);
    }
  };

  const avatarGenPayload = () => {
    if (view === 'edit') {
      return {
        name: draft.name.trim(),
        gender: draft.gender,
        persona: draft.persona.trim(),
      };
    }
    return {
      name: resolveDraftName(profile?.name),
      gender: resolveDraftGender(profile?.gender),
      persona: profile?.persona || '',
    };
  };

  const closeAvatarConfirm = () => {
    setAvatarAiConfirmOpen(false);
    setAvatarPromptOpen(false);
  };

  const requestGenerateAvatar = async () => {
    const payload = avatarGenPayload();
    if (!payload.name) {
      toast.error('请先填写姓名再生成头像');
      return;
    }
    if (!authUser?.token || !sessionId) {
      toast.error('请先登录并进入对局');
      return;
    }
    if (avatarAiBusy || personaAiBusy || avatarUploading) return;
    if (sessionAvatarPriceUnavailable || sessionAvatarPrice == null) {
      toast.error(sessionAvatarPriceError || 'Price unavailable');
      return;
    }
    if (avatarBillingPreview.currency === 'points') {
      const latestPoints = await refreshAuthUserPoints();
      if (typeof latestPoints === 'number' && latestPoints < avatarBillingPreview.chargedUnits) {
        toast.error(`织梦豆不足（需要 ${avatarBillingPreview.chargedUnits}，当前 ${latestPoints}）`);
        return;
      }
    }
    setAvatarStyleId(DEFAULT_AVATAR_STYLE);
    setAvatarPromptOpen(true);
    setAvatarAiConfirmOpen(true);
  };

  const runGenerateAvatar = async () => {
    const promptSupplement = avatarPromptSupplement.trim().slice(0, 500);
    const avatarStyle = avatarStyleId;
    closeAvatarConfirm();
    const token = authUser?.token;
    if (!token || !sessionId || isPlayerAvatarGenBusy(sessionId)) return;
    const payload = avatarGenPayload();
    if (!payload.name) {
      toast.error('请先填写姓名再生成头像');
      return;
    }
    // 功能注释：后台任务不绑组件生命周期；可保存/离开，完成后服务端已落盘，本地只合并头像
    toast('头像生成中，可先保存或离开，完成后会自动写入');
    try {
      await startPlayerAvatarBackgroundGen({
        token,
        sessionId,
        payload: {
          ...payload,
          avatarStyle,
          ...(promptSupplement ? { promptSupplement } : {}),
        },
      });
      setAvatarPromptSupplement('');
      setAvatarStyleId(DEFAULT_AVATAR_STYLE);
      // 成功由 Galgame 订阅写回档案并 toast，避免面板卸载后丢更新
    } catch (e) {
      toast.error(getApiErrorMessage(e, '头像生成失败'));
    }
  };

  const requestUploadAvatar = () => {
    if (!authUser?.token || !sessionId) {
      toast.error('请先登录并进入对局');
      return;
    }
    if (avatarAiBusy || avatarUploading) return;
    avatarFileInputRef.current?.click();
  };

  const onAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const token = authUser?.token;
    if (!token || !sessionId) {
      toast.error('请先登录并进入对局');
      return;
    }
    if (avatarUploading || avatarAiBusy) return;
    setAvatarUploading(true);
    try {
      // 功能注释：仅客户端压 WebP≤1MB（优先质量 100）；不做抠图/去背景
      const compressed = await compressImageFileToWebpUnderMaxBytes(file, {
        maxBytes: PLAYER_UPLOAD_AVATAR_MAX_BYTES,
      });
      const res = await sessionPlayerProfileApi.uploadPlayerAvatar(
        token,
        sessionId,
        compressed.file,
        { fileName: compressed.file.name },
      );
      if (!res?.success || !res.data?.avatarUrl) {
        toast.error(res?.message || '头像上传失败');
        return;
      }
      if (res.data.profile) {
        onProfileChange(res.data.profile);
      } else {
        onProfileChange(mergePlayerAvatarIntoProfile(profile, {
          avatarUrl: res.data.avatarUrl,
          avatarThumbUrl: res.data.avatarThumbUrl || '',
        }));
      }
      toast.success('头像已上传');
    } catch (err) {
      toast.error((err as Error)?.message || '头像上传失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  const renderAvatarConfirmModal = (overlayZIndex: number) => (
    <GameConfirmModal
      isOpen={avatarAiConfirmOpen}
      variant="dossier"
      title="确认生成头像"
      message={(
        <div className={styles.confirmMsgStack}>
          <p className={styles.confirmMsgText}>
            {`将扣除 ${sessionAvatarPrice == null ? '—' : avatarChargeText} 生成 AI 头像，是否继续？`}
          </p>
          <button
            type="button"
            className={`${styles.promptCueBtn} ${avatarPromptOpen ? styles.promptCueBtnActive : ''}`}
            onClick={() => setAvatarPromptOpen((open) => !open)}
            aria-expanded={avatarPromptOpen}
          >
            <span>{avatarPromptOpen ? '收起画风与提示词' : '画风与提示词'}</span>
            <span className={styles.promptCueChevron} aria-hidden>
              {avatarPromptOpen ? '▴' : '▾'}
            </span>
          </button>
        </div>
      )}
      confirmText="确认生成"
      cancelText="取消"
      overlayZIndex={overlayZIndex}
      onConfirm={() => { void runGenerateAvatar(); }}
      onCancel={closeAvatarConfirm}
    >
      {avatarPromptOpen ? (
        <div className={styles.promptCuePanel} role="region" aria-label="画风与提示词">
          <div className={styles.promptCueSection}>
            <div className={styles.promptCueLabelRow}>
              <span className={styles.promptCueLabel}>风格选择</span>
              <span className={styles.promptCueHint}>点选即可 · 默认 A</span>
            </div>
            <div className={styles.styleChipRow} role="radiogroup" aria-label="立绘画风">
              {AVATAR_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={avatarStyleId === opt.id}
                  className={`${styles.styleChip} ${avatarStyleId === opt.id ? styles.styleChipActive : ''}`}
                  onClick={() => setAvatarStyleId(opt.id)}
                >
                  <span className={styles.styleChipId}>{opt.id}</span>
                  <span className={styles.styleChipLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.promptCueSection}>
            <div className={styles.promptCueLabelRow}>
              <label className={styles.promptCueLabel} htmlFor="player-archive-avatar-prompt-supplement">
                外貌补充（可选）
              </label>
              <span className={styles.promptCueHint}>
                {avatarPromptSupplement.trim().length}/500
              </span>
            </div>
            <textarea
              id="player-archive-avatar-prompt-supplement"
              className={styles.promptCueInput}
              value={avatarPromptSupplement}
              onChange={(ev) => setAvatarPromptSupplement(ev.target.value.slice(0, 500))}
              placeholder="短发、校服、冷白皮、侧分刘海…"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
      ) : null}
    </GameConfirmModal>
  );

  const renderAvatarFileInput = () => (
    <input
      ref={avatarFileInputRef}
      type="file"
      accept={PLAYER_UPLOAD_AVATAR_ACCEPT}
      className={styles.hiddenFileInput}
      onChange={(ev) => { void onAvatarFileSelected(ev); }}
      aria-hidden
      tabIndex={-1}
    />
  );

  const requestGeneratePersona = async () => {
    if (!draft.name.trim()) {
      toast.error('请先填写姓名再生成');
      return;
    }
    if (!authUser?.token || !sessionId) {
      toast.error('请先登录并进入对局');
      return;
    }
    if (personaAiBusy || saving) return;
    // 功能注释：后台改分后本地 store 可能仍是旧值，先拉最新再预检
    if (textBillingPreview.currency === 'points') {
      const latestPoints = await refreshAuthUserPoints();
      if (
        typeof latestPoints === 'number'
        && latestPoints < textBillingPreview.chargedUnits
      ) {
        toast.error(
          `织梦豆不足（需要 ${textBillingPreview.chargedUnits}，当前 ${latestPoints}）`,
        );
        return;
      }
    }
    setPersonaAiConfirmOpen(true);
  };

  const runGeneratePersona = async () => {
    setPersonaAiConfirmOpen(false);
    const token = authUser?.token;
    if (!token || !sessionId || personaAiBusy) return;
    setPersonaAiBusy(true);
    try {
      const res = await sessionPlayerProfileApi.generatePlayerPersona(token, sessionId, {
        name: draft.name.trim(),
        gender: draft.gender,
        existingPersona: draft.persona,
      });
      if (!res?.success || !res.data?.text) {
        toast.error(res?.message || '人设生成失败');
        return;
      }
      setDraft((d) => ({
        ...d,
        persona: String(res.data!.text).slice(0, PLAYER_CARD_LIMITS.persona.max),
      }));
      const balancePatch = resolveSessionProfileBalancePatch(res.data.billing);
      if (balancePatch) {
        updateUser(balancePatch);
      } else if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(
        `人设已生成（-${res.data.billing
          ? formatSessionProfileCharge(res.data.billing)
          : textChargeText}）`,
      );
    } catch (e) {
      toast.error((e as Error)?.message || '人设生成失败');
    } finally {
      setPersonaAiBusy(false);
    }
  };

  const openImport = async () => {
    if (!authUser?.token) {
      toast.error('请先登录后再导入角色卡');
      return;
    }
    setImportLoading(true);
    onViewChange('import');
    setPreviewCard(null);
    try {
      const res = await playerCharacterCardsApi.list(authUser.token, { kind: 'player' });
      if (!res?.success) {
        toast.error(res?.message || '加载卡库失败');
        onViewChange('overview');
        return;
      }
      setCards(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error((e as Error)?.message || '加载卡库失败');
      onViewChange('overview');
    } finally {
      setImportLoading(false);
    }
  };

  const selectCard = (card: PlayerCharacterCard) => {
    if (card.cardKind === 'npc') {
      toast.error('请选择人设卡；角色卡请在角色档案中导入');
      return;
    }
    const preview = previewPlayerCardImportDiff(profile, card);
    if (!preview.ok || !preview.next) {
      toast.error(preview.message || '无法导入');
      return;
    }
    setPreviewCard(card);
    onViewChange('preview');
  };

  const confirmImport = async () => {
    if (!previewCard) return;
    const token = authUser?.token;
    if (!token || !sessionId) {
      toast.error('会话不可用');
      return;
    }
    setSaving(true);
    try {
      const res = await playerCharacterCardsApi.importToSession(token, sessionId, previewCard.id);
      if (!res?.success) {
        toast.error(res?.message || '导入失败');
        return;
      }
      const applied = applyPlayerCardImport(previewCard, {
        currentUserId: authUser?.user?.userId,
      });
      if (!applied.ok) {
        toast.error(applied.message || '导入失败');
        return;
      }
      const serverProfile = (res.data as { profile?: SessionPlayerProfile; ab?: { generateOnChange?: boolean }; avatarNeedsRegen?: boolean } | undefined)?.profile;
      if (typeof (res.data as { ab?: { generateOnChange?: boolean } })?.ab?.generateOnChange === 'boolean') {
        onPlayerAvatarAbChange?.(!!(res.data as { ab?: { generateOnChange?: boolean } }).ab?.generateOnChange);
      }
      const merged = mergeProfileAfterPlayerCardImport({
        applied: applied.profile,
        serverProfile,
        previousProfile: profile,
      });
      onProfileChange(merged);
      closeToOverview();
      const change = (res.data as { protagonistChange?: { content?: string } } | undefined)
        ?.protagonistChange;
      if (change?.content) {
        toast.success(`${change.content}（下一句起按新身份）`);
        void onHistoryMaybeChanged?.();
      } else {
        toast.success('已覆盖当前局玩家档案');
      }
      if (
        (playerAvatarAbOnChange || (res.data as { ab?: { generateOnChange?: boolean } })?.ab?.generateOnChange)
        && (merged.avatarNeedsRegen || !merged.avatarUrl)
      ) {
        toast(`实验组：请为新角色生成头像（将扣除${sessionProfileCurrencyLabel(avatarBillingPreview.currency)}）`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (view === 'edit') {
    return (
      <>
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit();
          }}
        >
          <div className={styles.modalTop}>
            <h3 className={styles.modalTitle}>编辑我的档案</h3>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeToOverview}
              disabled={saving || personaAiBusy}
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          {/* 功能注释：编辑页头像舞台对齐总览 Crimson Dossier；手动 AI 生成始终可用，换角清头像仍由 A/B 管 */}
          <div className={styles.editAvatarBlock}>
            <button
              type="button"
              className={`${styles.editAvatarHit}${avatarVariant === 'full' ? ` ${styles.avatarHitPoster}` : ''}`}
              onClick={() => {
                if (avatarSrc) setAvatarPreviewOpen(true);
              }}
              aria-label={avatarSrc ? '查看主角头像' : '暂无头像'}
            >
              <span className={styles.avatarStageGlow} aria-hidden />
              {avatarSrc ? (
                <TrimmedTransparentImg
                  className={`${styles.editAvatarImg}${avatarVariant === 'full' ? ` ${styles.avatarImgPoster}` : ''}`}
                  src={avatarSrc}
                  alt={displayName}
                  variant={avatarVariant}
                />
              ) : (
                <div className={styles.editAvatarEmpty}>头像</div>
              )}
              {avatarSrc ? <span className={styles.avatarZoomCue}>放大</span> : null}
            </button>
            <div className={styles.editAvatarMeta}>
              <div className={styles.editAvatarTitleRow}>
                <span className={styles.editAvatarTitle}>立绘</span>
                {avatarAiBusy ? (
                  <span className={styles.fieldAiBusyBadge} aria-live="polite">生成中…</span>
                ) : null}
              </div>
              <p className={styles.editAvatarHint}>
                {avatarUploading
                  ? '压缩上传中（≤1MB，不做背景处理）…'
                  : avatarAiBusy
                    ? '可先保存或离开，完成后自动写入'
                    : (needsAvatar
                      ? (avatarSrc ? '可重新生成或上传局内头像' : '生成或上传头像')
                      : '点击立绘可放大预览')}
              </p>
              <div className={styles.avatarActionRow}>
                <button
                  type="button"
                  className={styles.avatarGenBtn}
                  disabled={personaAiBusy || avatarAiBusy || avatarUploading || !authUser?.token}
                  onClick={() => {
                    void requestGenerateAvatar();
                  }}
                >
                  {avatarAiBusy
                    ? '后台生成中…'
                    : `${needsAvatar ? '生成头像' : '重新生成'} · ${sessionAvatarPrice == null ? '—' : avatarChargeText}`}
                </button>
                <button
                  type="button"
                  className={styles.avatarUploadBtn}
                  disabled={personaAiBusy || avatarAiBusy || avatarUploading || !authUser?.token}
                  onClick={() => requestUploadAvatar()}
                >
                  {avatarUploading ? '上传中…' : '上传图片'}
                </button>
              </div>
            </div>
          </div>
          {renderAvatarFileInput()}

          <label className={styles.field}>
            <span className={styles.labelRow}>
              姓名
              <span className={styles.counter}>
                {draft.name.length}/{PLAYER_CARD_LIMITS.name.max}
              </span>
            </span>
            <input
              value={draft.name}
              maxLength={PLAYER_CARD_LIMITS.name.max}
              placeholder="你的姓名"
              disabled={personaAiBusy}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.labelRow}>性别</span>
            <div className={styles.chips} role="radiogroup" aria-label="性别">
              {GENDER_ORDER.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={draft.gender === g}
                  className={`${styles.chip} ${draft.gender === g ? styles.chipActive : ''}`}
                  disabled={personaAiBusy}
                  onClick={() => setDraft((d) => ({ ...d, gender: g }))}
                >
                  {GENDER_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <span className={styles.labelWithAiLeft}>
                人设
                <button
                  type="button"
                  className={styles.fieldAiBtn}
                  disabled={saving || personaAiBusy}
                  onClick={() => {
                    void requestGeneratePersona();
                  }}
                >
                  {personaAiBusy
                    ? '生成中…'
                    : `AI生成 · ${textChargeText}`}
                </button>
              </span>
              <span className={styles.counter}>
                {draft.persona.length}/{PLAYER_CARD_LIMITS.persona.max}
              </span>
            </div>
            <div className={styles.personaGrowWrap}>
              <textarea
                className={styles.personaTextarea}
                value={draft.persona}
                maxLength={PLAYER_CARD_LIMITS.persona.max}
                placeholder="性格、身份、经历…"
                disabled={personaAiBusy}
                onChange={(e) => setDraft((d) => ({ ...d, persona: e.target.value }))}
                aria-label="人设"
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={closeToOverview}
              disabled={saving || personaAiBusy}
            >
              取消
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={saving || personaAiBusy}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>

        <GameConfirmModal
          isOpen={personaAiConfirmOpen}
          variant="dossier"
          title="确认生成人设"
          message={`将扣除 ${textChargeText} 生成「人设」，是否继续？`}
          confirmText="确认生成"
          cancelText="取消"
          overlayZIndex={3600}
          onConfirm={() => {
            void runGeneratePersona();
          }}
          onCancel={() => setPersonaAiConfirmOpen(false)}
        />

        {renderAvatarConfirmModal(3800)}

        {avatarPreviewOpen && avatarSrc ? (
          <div
            className={styles.avatarPreviewOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={`${displayName} 头像`}
            onClick={() => setAvatarPreviewOpen(false)}
          >
            <div className={styles.avatarPreviewCard} onClick={(e) => e.stopPropagation()}>
              <div className={styles.avatarPreviewChrome}>
                <span>我的档案</span>
                <button
                  type="button"
                  className={styles.avatarPreviewClose}
                  onClick={() => setAvatarPreviewOpen(false)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <div className={styles.avatarPreviewStage}>
                <img className={styles.avatarPreviewImg} src={avatarFullSrc || avatarSrc} alt={displayName} />
              </div>
              <p className={styles.avatarPreviewName}>{displayName}</p>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (view === 'import') {
    return (
      <div className={styles.importPanel}>
        <input
          className={styles.search}
          value={query}
          placeholder="按姓名、关键词搜索"
          onChange={(e) => setQuery(e.target.value)}
        />
        {importLoading ? (
          <div className={shell.empty}>加载中…</div>
        ) : filtered.length === 0 ? (
          <div className={shell.empty}>卡库为空，请先在账号下创建角色卡</div>
        ) : (
          filtered.map((card) => {
            const cardAvatar = String(card.avatarUrl || '').trim();
            const cardAvatarSrc = cardAvatar ? getImageUrl(cardAvatar) : '';
            return (
            <div key={card.id} className={styles.importRow}>
              <div className={styles.importAvatar} aria-hidden>
                {cardAvatarSrc ? (
                  <TrimmedTransparentImg
                    className={styles.importAvatarImg}
                    src={cardAvatarSrc}
                    alt=""
                    variant="bust"
                  />
                ) : (
                  card.name.slice(0, 1) || '卡'
                )}
              </div>
              <div className={styles.importBody}>
                <div className={styles.importName}>
                  {card.name}
                  <span className={styles.importMeta}> · {genderText(card.gender)}</span>
                </div>
                <p className={styles.importPersona}>{card.persona || '暂无人设'}</p>
              </div>
              <button
                type="button"
                className={styles.selectBtn}
                onClick={() => selectCard(card)}
              >
                选择
              </button>
            </div>
            );
          })
        )}
      </div>
    );
  }

  if (view === 'preview' && previewCard && previewDiff?.next) {
    const next = previewDiff.next;
    const attrEntries = Object.entries(next.customAttributes || {});
    const previewAvatarPath = String(next.avatarUrl || previewCard.avatarUrl || '').trim();
    const previewAvatarSrc = previewAvatarPath ? getImageUrl(previewAvatarPath) : '';
    return (
      <div className={styles.previewPanel}>
        <section className={styles.previewCard}>
          <h4 className={styles.previewSectionTitle}>角色卡</h4>
          {previewAvatarSrc ? (
            <div className={styles.previewAvatarWrap}>
              <TrimmedTransparentImg
                className={styles.previewAvatarImg}
                src={previewAvatarSrc}
                alt=""
                variant="bust"
              />
            </div>
          ) : null}
          <div className={styles.previewName}>{next.name}</div>
          <div className={styles.previewMeta}>{genderText(next.gender)}</div>
          <p className={styles.previewPersona}>{next.persona || '暂无人设'}</p>
        </section>

        <section className={styles.previewCard}>
          <h4 className={styles.previewSectionTitle}>
            属性预览（导入后将覆盖当前自设数值）
          </h4>
          {attrEntries.length === 0 ? (
            <p className={styles.previewMuted}>该卡无自设属性数值</p>
          ) : (
            <div className={styles.previewAttrGrid}>
              {attrEntries.map(([label, value]) => {
                const changed = previewDiff.changedKeys.includes(`attr:${label}`);
                return (
                  <div
                    key={label}
                    className={`${styles.previewAttrCard} ${changed ? styles.previewAttrChanged : ''}`}
                  >
                    <div className={styles.previewAttrLabel}>{label}</div>
                    <div className={styles.previewAttrValue}>{value}</div>
                    <div className={styles.previewAttrHint}>导入后数值</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className={styles.infoBanner} role="note">
          <span className={styles.infoIcon} aria-hidden>i</span>
          <p>
            {previewAvatarSrc
              ? '导入将覆盖当前玩家档案并带上卡库立绘，之后仍可在档案中重新生成头像。'
              : '导入将填写或覆盖当前玩家档案；该卡暂无立绘，导入后可在档案中生成头像。'}
          </p>
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onViewChange('import')}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void confirmImport()}
            disabled={saving}
          >
            {saving ? '导入中…' : '确认导入'}
          </button>
        </div>
      </div>
    );
  }

  /* preview 无卡时回退总览（例如顶栏乱点） */
  if (view === 'preview') {
    return (
      <div className={styles.previewPanel}>
        <div className={shell.empty}>请先选择角色卡</div>
        <button type="button" className={styles.secondaryBtn} onClick={() => onViewChange('import')}>
          返回列表
        </button>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h3 className={styles.title}>我的档案</h3>
        <div className={styles.headActions}>
          <button type="button" className={shell.ghostButton} onClick={openEdit}>
            编辑档案
          </button>
          <button type="button" className={shell.primaryButton} onClick={() => void openImport()}>
            导入角色卡
          </button>
        </div>
      </div>

      <div className={styles.profileCard}>
        {/* 功能注释：头像与「生成头像」始终可见；A/B 只影响换角后是否强制清头像引导 */}
        <div className={styles.dossierHero}>
          <button
            type="button"
            className={avatarStageClass}
            onClick={() => {
              if (avatarSrc) setAvatarPreviewOpen(true);
            }}
            aria-label={avatarSrc ? '查看主角头像' : '暂无头像'}
          >
            <span className={styles.avatarStageGlow} aria-hidden />
            {avatarSrc ? (
              <TrimmedTransparentImg
                className={`${styles.avatarImg}${avatarVariant === 'full' ? ` ${styles.avatarImgPoster}` : ''}`}
                src={avatarSrc}
                alt={displayName}
                variant={avatarVariant}
              />
            ) : (
              <div className={styles.avatarEmpty}>头像</div>
            )}
            {avatarSrc ? (
              <span className={styles.avatarZoomCue}>放大</span>
            ) : null}
          </button>
          <div className={styles.avatarMeta}>
            <div className={styles.identityLine}>
              <span className={styles.identityName}>{displayName}</span>
              <span className={styles.identityGender}>{genderText(profile?.gender)}</span>
            </div>
            <p className={styles.avatarHint}>
              {avatarUploading
                ? '压缩上传中…'
                : needsAvatar
                  ? (avatarSrc
                    ? '可重新生成或上传局内头像'
                    : '生成或上传头像')
                  : '点击立绘可放大预览'}
            </p>
            <div className={styles.avatarActionRow}>
              <button
                type="button"
                className={styles.avatarGenBtn}
                disabled={avatarAiBusy || avatarUploading || !authUser?.token}
                onClick={() => void requestGenerateAvatar()}
              >
                {avatarAiBusy
                  ? '后台生成中…'
                  : `${needsAvatar ? '生成头像' : '重新生成'} · ${sessionAvatarPrice == null ? '—' : avatarChargeText}`}
              </button>
              <button
                type="button"
                className={styles.avatarUploadBtn}
                disabled={avatarAiBusy || avatarUploading || !authUser?.token}
                onClick={() => requestUploadAvatar()}
              >
                {avatarUploading ? '上传中…' : '上传图片'}
              </button>
            </div>
          </div>
        </div>
        {renderAvatarFileInput()}
        <div className={styles.dossierMeta}>
          <div className={styles.profileBlock}>
            <span className={styles.profileKey}>人设</span>
            <p className={styles.profilePersona}>{profile?.persona || '暂无人设'}</p>
          </div>
          {profile?.customAttributes && Object.keys(profile.customAttributes).length > 0 ? (
            <div className={styles.profileBlock}>
              <span className={styles.profileKey}>自设属性</span>
              <ul className={styles.profileAttrList}>
                {Object.entries(profile.customAttributes).map(([key, value]) => (
                  <li key={key} className={styles.profileAttrItem}>
                    <span>{key}</span>
                    <strong>{Number.isFinite(Number(value)) ? Math.round(Number(value)) : '—'}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <p className={styles.dynHint}>下方为动态属性面板（LLM），与自设属性分区，互不覆盖。</p>

      {renderAvatarConfirmModal(3800)}

      {avatarPreviewOpen && avatarSrc ? (
        <div
          className={styles.avatarPreviewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName} 头像`}
          onClick={() => setAvatarPreviewOpen(false)}
        >
          <div className={styles.avatarPreviewCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.avatarPreviewChrome}>
              <span>我的档案</span>
              <button
                type="button"
                className={styles.avatarPreviewClose}
                onClick={() => setAvatarPreviewOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className={styles.avatarPreviewStage}>
              <img className={styles.avatarPreviewImg} src={avatarFullSrc || avatarSrc} alt={displayName} />
            </div>
            <p className={styles.avatarPreviewName}>{displayName}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default PlayerArchiveSection;
