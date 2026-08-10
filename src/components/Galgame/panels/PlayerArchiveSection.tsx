import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  applyPlayerCardImport,
  filterPlayerCharacterCards,
  PLAYER_CARD_GENDERS,
  PLAYER_CARD_LIMITS,
  previewPlayerCardImportDiff,
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
import { CHARACTER_GENERATION_COST, NPC_PROFILE_FIELD_GENERATION_COST, getImageUrl } from '../../../utils/constants';
import {
  pickDisplayAvatarFullUrl,
  pickDisplayAvatarThumbUrl,
} from '../../../lib/galgame/avatarThumbUrl';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import GameConfirmModal from '../GameConfirmModal';
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
  const authUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { sessionId } = useGameStore();
  const [saving, setSaving] = useState(false);
  const [personaAiBusy, setPersonaAiBusy] = useState(false);
  const [personaAiConfirmOpen, setPersonaAiConfirmOpen] = useState(false);
  const [avatarAiBusy, setAvatarAiBusy] = useState(false);
  const [avatarAiConfirmOpen, setAvatarAiConfirmOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [query, setQuery] = useState('');
  const [previewCard, setPreviewCard] = useState<PlayerCharacterCard | null>(null);

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
  // 功能注释：列表/小头像走 *_150.webp；点击放大必须用原图，禁止大图吃 150
  const avatarThumbPath = pickDisplayAvatarThumbUrl([
    profile?.avatarThumbUrl,
    profile?.avatarUrl,
    documentPlayerAvatarUrl,
  ]);
  const avatarSrc = avatarThumbPath ? getImageUrl(avatarThumbPath) : '';
  const avatarFullPath = pickDisplayAvatarFullUrl([
    profile?.avatarUrl,
    documentPlayerAvatarUrl,
    profile?.avatarThumbUrl,
  ]);
  const avatarFullSrc = avatarFullPath ? getImageUrl(avatarFullPath) : '';
  const sessionAvatarFull = String(profile?.avatarUrl || '').trim();
  const needsAvatar = !!profile?.avatarNeedsRegen || !sessionAvatarFull;

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
            toast('实验组：请为新身份生成头像（将扣除积分）');
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

  const requestGenerateAvatar = async () => {
    if (!playerAvatarAbOnChange) return;
    const payload = avatarGenPayload();
    if (!payload.name) {
      toast.error('请先填写姓名再生成头像');
      return;
    }
    if (!authUser?.token || !sessionId) {
      toast.error('请先登录并进入对局');
      return;
    }
    if (avatarAiBusy || saving || personaAiBusy) return;
    const latestPoints = await refreshAuthUserPoints();
    if (typeof latestPoints === 'number' && latestPoints < CHARACTER_GENERATION_COST) {
      toast.error(`积分不足（需要 ${CHARACTER_GENERATION_COST}，当前 ${latestPoints}）`);
      return;
    }
    setAvatarAiConfirmOpen(true);
  };

  const runGenerateAvatar = async () => {
    setAvatarAiConfirmOpen(false);
    const token = authUser?.token;
    if (!token || !sessionId || avatarAiBusy) return;
    const payload = avatarGenPayload();
    if (!payload.name) {
      toast.error('请先填写姓名再生成头像');
      return;
    }
    setAvatarAiBusy(true);
    try {
      const res = await sessionPlayerProfileApi.generatePlayerAvatar(token, sessionId, payload);
      if (!res?.success || !res.data?.avatarUrl) {
        toast.error(res?.message || '头像生成失败');
        return;
      }
      const nextProfile = res.data.profile && typeof res.data.profile === 'object'
        ? res.data.profile
        : {
            ...(profile || {
              name: resolveDraftName(null),
              gender: resolveDraftGender(null),
              persona: '',
              customAttributes: {},
            }),
            avatarUrl: res.data.avatarUrl,
            avatarThumbUrl: res.data.avatarThumbUrl || '',
            avatarNeedsRegen: false,
          };
      onProfileChange(nextProfile);
      if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(`头像已生成（-${res.data.pointsDeducted ?? CHARACTER_GENERATION_COST} 积分）`);
    } catch (e) {
      toast.error((e as Error)?.message || '头像生成失败');
    } finally {
      setAvatarAiBusy(false);
    }
  };

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
    const latestPoints = await refreshAuthUserPoints();
    if (
      typeof latestPoints === 'number'
      && latestPoints < NPC_PROFILE_FIELD_GENERATION_COST
    ) {
      toast.error(
        `积分不足（需要 ${NPC_PROFILE_FIELD_GENERATION_COST}，当前 ${latestPoints}）`,
      );
      return;
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
      if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(
        `人设已生成（-${res.data.pointsDeducted ?? NPC_PROFILE_FIELD_GENERATION_COST} 积分）`,
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
      const res = await playerCharacterCardsApi.list(authUser.token, '');
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
      const merged: SessionPlayerProfile = serverProfile && typeof serverProfile === 'object'
        ? {
            ...applied.profile,
            ...serverProfile,
            customAttributes: {
              ...(applied.profile.customAttributes || {}),
              ...(serverProfile.customAttributes || {}),
            },
          }
        : {
            ...applied.profile,
            ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
            ...(profile?.avatarThumbUrl ? { avatarThumbUrl: profile.avatarThumbUrl } : {}),
          };
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
        toast('实验组：请为新角色生成头像（将扣除积分）');
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
              disabled={saving || personaAiBusy || avatarAiBusy}
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          {playerAvatarAbOnChange ? (
            <div className={styles.editAvatarBlock}>
              <button
                type="button"
                className={styles.editAvatarHit}
                onClick={() => {
                  if (avatarSrc) setAvatarPreviewOpen(true);
                }}
                aria-label={avatarSrc ? '查看主角头像' : '暂无头像'}
              >
                {avatarSrc ? (
                  <img className={styles.editAvatarImg} src={avatarSrc} alt={displayName} />
                ) : (
                  <div className={styles.editAvatarEmpty}>暂无头像</div>
                )}
              </button>
              <div className={styles.editAvatarMeta}>
                <div className={styles.labelRow}>
                  <span className={styles.labelWithAiLeft}>
                    头像
                    <button
                      type="button"
                      className={styles.fieldAiBtn}
                      disabled={saving || personaAiBusy || avatarAiBusy || !authUser?.token}
                      onClick={() => {
                        void requestGenerateAvatar();
                      }}
                    >
                      {avatarAiBusy
                        ? '生成中…'
                        : `${needsAvatar ? 'AI生成' : '重新生成'} · ${CHARACTER_GENERATION_COST}`}
                    </button>
                  </span>
                </div>
                <p className={styles.editAvatarHint}>
                  {needsAvatar
                    ? (avatarSrc
                      ? '当前为主角立绘；可 AI 生成局内头像（将扣除积分）'
                      : '换角后请生成新头像（将扣除积分）')
                    : '点击头像可放大；重新生成将扣除积分'}
                </p>
              </div>
            </div>
          ) : null}

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
                    : `AI生成 · ${NPC_PROFILE_FIELD_GENERATION_COST}`}
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
              disabled={saving || personaAiBusy || avatarAiBusy}
            >
              取消
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={saving || personaAiBusy || avatarAiBusy}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>

        <GameConfirmModal
          isOpen={personaAiConfirmOpen}
          variant="dossier"
          title="确认生成人设"
          message={`将扣除 ${NPC_PROFILE_FIELD_GENERATION_COST} 积分生成「人设」，是否继续？`}
          confirmText="确认生成"
          cancelText="取消"
          overlayZIndex={3600}
          onConfirm={() => {
            void runGeneratePersona();
          }}
          onCancel={() => setPersonaAiConfirmOpen(false)}
        />

        <GameConfirmModal
          isOpen={avatarAiConfirmOpen}
          variant="dossier"
          title="确认生成头像"
          message={`将扣除 ${CHARACTER_GENERATION_COST} 积分生成 AI 主角头像，是否继续？`}
          confirmText="确认生成"
          cancelText="取消"
          overlayZIndex={3800}
          onConfirm={() => {
            void runGenerateAvatar();
          }}
          onCancel={() => setAvatarAiConfirmOpen(false)}
        />

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
              <img className={styles.avatarPreviewImg} src={avatarFullSrc || avatarSrc} alt={displayName} />
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
          filtered.map((card) => (
            <div key={card.id} className={styles.importRow}>
              <div className={styles.importAvatar} aria-hidden>
                {card.name.slice(0, 1) || '卡'}
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
          ))
        )}
      </div>
    );
  }

  if (view === 'preview' && previewCard && previewDiff?.next) {
    const next = previewDiff.next;
    const attrEntries = Object.entries(next.customAttributes || {});
    return (
      <div className={styles.previewPanel}>
        <section className={styles.previewCard}>
          <h4 className={styles.previewSectionTitle}>角色卡</h4>
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
          <p>导入将填写或覆盖当前玩家档案，之后仍可继续编辑。</p>
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
        {playerAvatarAbOnChange ? (
          <div className={styles.avatarRow}>
            <button
              type="button"
              className={styles.avatarHit}
              onClick={() => {
                if (avatarSrc) setAvatarPreviewOpen(true);
              }}
              aria-label={avatarSrc ? '查看主角头像' : '暂无头像'}
            >
              {avatarSrc ? (
                <img className={styles.avatarImg} src={avatarSrc} alt={displayName} />
              ) : (
                <div className={styles.avatarEmpty}>头像</div>
              )}
            </button>
            <div className={styles.avatarMeta}>
              <p className={styles.avatarHint}>
                {needsAvatar
                  ? (avatarSrc
                    ? '当前为主角立绘；换角后请 AI 生成局内头像'
                    : '换角后请生成新头像')
                  : '点击头像可放大；AI 生成将扣除积分'}
              </p>
              <button
                type="button"
                className={styles.avatarGenBtn}
                disabled={avatarAiBusy || saving || !authUser?.token}
                onClick={() => void requestGenerateAvatar()}
              >
                {avatarAiBusy
                  ? '生成中…'
                  : `${needsAvatar ? '生成头像' : '重新生成头像'} · ${CHARACTER_GENERATION_COST} 积分`}
              </button>
            </div>
          </div>
        ) : null}
        <div className={styles.profileRow}>
          <span className={styles.profileKey}>姓名</span>
          <span className={styles.profileVal}>{displayName}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileKey}>性别</span>
          <span className={styles.profileVal}>{genderText(profile?.gender)}</span>
        </div>
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

      <p className={styles.dynHint}>下方为动态属性面板（LLM），与自设属性分区，互不覆盖。</p>

      <GameConfirmModal
        isOpen={avatarAiConfirmOpen}
        title="确认生成头像"
        message={`将扣除 ${CHARACTER_GENERATION_COST} 积分生成 AI 主角头像，是否继续？`}
        confirmText="确认生成"
        cancelText="取消"
        overlayZIndex={3800}
        onConfirm={() => { void runGenerateAvatar(); }}
        onCancel={() => setAvatarAiConfirmOpen(false)}
      />

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
            <img className={styles.avatarPreviewImg} src={avatarFullSrc || avatarSrc} alt={displayName} />
            <p className={styles.avatarPreviewName}>{displayName}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default PlayerArchiveSection;
