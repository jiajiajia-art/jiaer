import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CHARACTER_PROFILE_LIMITS,
  NPC_GENDERS,
  NPC_IMPORTANCE,
  NPC_SURVIVAL,
  normalizeNpcGender,
  type NpcGender,
  type NpcImportance,
  type NpcSurvival,
  type PlayerEditableNpc,
  validateCharacterProfileInput,
  resolveDistinctDetailedBio,
} from '../../../lib/galgame/characterProfile';
import { sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import { CHARACTER_GENERATION_COST, NPC_PROFILE_FIELD_GENERATION_COST, getImageUrl } from '../../../utils/constants';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import GameConfirmModal from '../GameConfirmModal';
import { buildSessionNpcAvatarPrompt } from '../../../lib/galgame/sessionNpcAvatarPrompt';
import {
  pickDisplayAvatarFullUrl,
  pickDisplayAvatarThumbUrl,
} from '../../../lib/galgame/avatarThumbUrl';
import styles from './CharacterProfileForm.module.css';

export type CharacterProfileFormValues = {
  name: string;
  gender: NpcGender;
  relationship: string;
  summary: string;
  attitudeToPlayer: string;
  detailedBio: string;
  importance: NpcImportance | '';
  survival: NpcSurvival | '';
  avatarUrl: string;
  avatarThumbUrl: string;
};

type ProfileTextField = 'relationship' | 'summary' | 'attitudeToPlayer' | 'detailedBio';
type ConfirmKind = 'avatar' | ProfileTextField;
type AiBusyKey = ConfirmKind;

const PROFILE_FIELD_LABEL: Record<ProfileTextField, string> = {
  relationship: '关系',
  summary: '简介',
  attitudeToPlayer: '对你的态度',
  detailedBio: '详细简介',
};

const emptyValues = (): CharacterProfileFormValues => ({
  name: '',
  gender: 'female',
  relationship: '',
  summary: '',
  attitudeToPlayer: '',
  detailedBio: '',
  importance: '',
  survival: '',
  avatarUrl: '',
  avatarThumbUrl: '',
});

function profileToValues(p?: Partial<PlayerEditableNpc> | null): CharacterProfileFormValues {
  if (!p) return emptyValues();
  return {
    name: String(p.name || ''),
    gender: normalizeNpcGender(p.gender, 'female'),
    relationship: String(p.relationship || ''),
    summary: String(p.summary || ''),
    attitudeToPlayer: String(p.attitudeToPlayer || ''),
    detailedBio: String(p.detailedBio || ''),
    importance: (p.importance as NpcImportance) || '',
    survival: (p.survival as NpcSurvival) || '',
    avatarUrl: String(p.avatarUrl || ''),
    avatarThumbUrl: String(p.avatarThumbUrl || ''),
  };
}

function newDraftId() {
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface CharacterProfileFormProps {
  initial?: Partial<PlayerEditableNpc> | null;
  submitLabel?: string;
  /** UE 表单顶栏标题：添加新角色 / 编辑人设 */
  formTitle?: string;
  /** 会话侧已 ensure 的角色 *_150.webp（优先于 initial.avatarThumbUrl） */
  sessionAvatarThumbUrl?: string | null;
  /** 父级仍在批量 ensure 150：无小图时显示 loading */
  avatarThumbsPending?: boolean;
  onCancel: () => void;
  onSubmit: (profile: Omit<PlayerEditableNpc, 'id' | 'source' | 'encountered'> & { id?: string }) => void | Promise<void>;
}

const GENDER_LABEL: Record<NpcGender, string> = {
  male: '男',
  female: '女',
  other: '其他',
  unknown: '未知',
};

const IMPORTANCE_LABEL: Record<NpcImportance, string> = {
  major: '重要',
  minor: '次要',
  extra: '路人',
};

const SURVIVAL_LABEL: Record<NpcSurvival, string> = {
  alive: '存活',
  dead: '死亡',
  unknown: '未知',
};

function reqLabel(text: string, required = false) {
  return (
    <span className={styles.labelRow}>
      {text}
      {required ? <span className={styles.req} aria-hidden>*</span> : null}
    </span>
  );
}

function fieldLabelWithAi(opts: {
  text: string;
  required?: boolean;
  busy: boolean;
  disabled: boolean;
  onAi: () => void;
}) {
  return (
    <div className={styles.labelWithAi}>
      {reqLabel(opts.text, opts.required)}
      <button
        type="button"
        className={styles.fieldAiBtn}
        disabled={opts.disabled || opts.busy}
        onClick={opts.onAi}
      >
        {opts.busy ? '生成中…' : `AI生成 · ${NPC_PROFILE_FIELD_GENERATION_COST}`}
      </button>
    </div>
  );
}

/** 功能注释：局内添加/编辑角色档案（UE：头像 + 必填 + 可折叠补充档案）。 */
const CharacterProfileForm: React.FC<CharacterProfileFormProps> = ({
  initial,
  submitLabel = '保存',
  formTitle = '添加新角色',
  sessionAvatarThumbUrl = null,
  avatarThumbsPending = false,
  onCancel,
  onSubmit,
}) => {
  const token = useAuthStore((s) => s.user?.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { sessionId } = useGameStore();
  const draftId = useMemo(() => String(initial?.id || newDraftId()), [initial?.id]);
  const [values, setValues] = useState<CharacterProfileFormValues>(() => profileToValues(initial));
  const [saving, setSaving] = useState(false);
  /** 用户点过性别芯片 → 保存时打 genderManuallySet，供 A/B「跟创作台」判断 */
  const [genderTouched, setGenderTouched] = useState(false);
  /** 各 AI 按钮独立忙碌：只锁当前按钮，互不阻塞 */
  const [aiBusy, setAiBusy] = useState<Partial<Record<AiBusyKey, boolean>>>({});
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  /** 头像确认弹窗：提示词补充面板 */
  const [avatarPromptOpen, setAvatarPromptOpen] = useState(false);
  const [avatarPromptSupplement, setAvatarPromptSupplement] = useState('');
  const [supplementOpen, setSupplementOpen] = useState(() => Boolean(
    initial?.detailedBio || initial?.importance || initial?.survival,
  ));
  const formScrollRef = useRef<HTMLDivElement>(null);
  const supplementToggleRef = useRef<HTMLButtonElement>(null);
  const pendingSupplementScrollRef = useRef(false);

  useEffect(() => {
    setValues(profileToValues(initial));
    setGenderTouched(false);
    setSupplementOpen(Boolean(initial?.detailedBio || initial?.importance || initial?.survival));
  }, [initial]);

  /** 展开补充档案后，把标题滚到滚动区顶部，保证展开内容进可视区 */
  useEffect(() => {
    if (!supplementOpen || !pendingSupplementScrollRef.current) return;
    pendingSupplementScrollRef.current = false;
    const scrollEl = formScrollRef.current;
    const anchor = supplementToggleRef.current;
    if (!scrollEl || !anchor) return;

    let timeoutId = 0;
    const raf = window.requestAnimationFrame(() => {
      // 等补充区块挂载 + 展开动画起势后再滚
      timeoutId = window.setTimeout(() => {
        const scrollRect = scrollEl.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const nextTop = scrollEl.scrollTop + (anchorRect.top - scrollRect.top) - 10;
        scrollEl.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      }, 40);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [supplementOpen]);

  const setField = <K extends keyof CharacterProfileFormValues>(key: K, value: CharacterProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const isAiBusy = (key: AiBusyKey) => Boolean(aiBusy[key]);
  const anyAiBusy = Object.values(aiBusy).some(Boolean);

  // 功能注释：编辑坞只显示确认 150；不回落原图，避免大图闪一下（放大预览仍用原图）
  const avatarThumbPath = pickDisplayAvatarThumbUrl([
    sessionAvatarThumbUrl,
    values.avatarThumbUrl,
  ]);
  const avatarThumbSrc = avatarThumbPath ? getImageUrl(avatarThumbPath) : '';
  const avatarFullPath = pickDisplayAvatarFullUrl([
    values.avatarUrl,
    values.avatarThumbUrl,
    sessionAvatarThumbUrl,
  ]);
  const avatarFullSrc = avatarFullPath ? getImageUrl(avatarFullPath) : avatarThumbSrc;
  const previewName = values.name.trim() || '未命名角色';
  const introSummary = values.summary.trim();
  const introAttitude = values.attitudeToPlayer.trim();
  const introRelation = values.relationship.trim();
  const introBio = resolveDistinctDetailedBio(values.summary, values.detailedBio);
  const hasIntro = Boolean(introSummary || introAttitude || introRelation || introBio);

  const formLocked = saving;

  const openAvatarPreview = () => {
    if (!avatarThumbSrc && !avatarFullSrc) {
      toast.error('暂无头像可预览');
      return;
    }
    setPreviewOpen(true);
  };

  const ensureReadyForAi = () => {
    if (!values.name.trim()) {
      toast.error('请先填写姓名再生成');
      return false;
    }
    if (!token || !sessionId) {
      toast.error('请先登录并进入对局');
      return false;
    }
    return true;
  };

  /** 仅积分不足时提示当前余额；够用则不展示「当前积分」。先刷新服务端积分，避免后台改分后本地缓存误拦。 */
  const ensureEnoughPointsForAi = async (cost: number) => {
    const latestPoints = await refreshAuthUserPoints();
    if (typeof latestPoints === 'number' && latestPoints < cost) {
      toast.error(`积分不足（需要 ${cost}，当前 ${latestPoints}）`);
      return false;
    }
    return true;
  };

  const requestGenerateAvatar = async () => {
    if (!ensureReadyForAi()) return;
    if (!(await ensureEnoughPointsForAi(CHARACTER_GENERATION_COST))) return;
    if (isAiBusy('avatar')) return;
    setAvatarPromptOpen(false);
    setAvatarPromptSupplement('');
    setConfirmKind('avatar');
  };

  const requestGenerateField = async (field: ProfileTextField) => {
    if (!ensureReadyForAi()) return;
    if (!(await ensureEnoughPointsForAi(NPC_PROFILE_FIELD_GENERATION_COST))) return;
    if (isAiBusy(field)) return;
    setConfirmKind(field);
  };

  const runGenerateAvatar = async () => {
    const promptSupplement = avatarPromptSupplement.trim();
    setConfirmKind(null);
    setAvatarPromptOpen(false);
    if (!token || !sessionId) return;
    if (isAiBusy('avatar')) return;
    setAiBusy((prev) => ({ ...prev, avatar: true }));
    try {
      const res = await sessionPlayerProfileApi.generateNpcAvatar(token, sessionId, {
        npcId: draftId,
        name: values.name,
        gender: values.gender,
        relationship: values.relationship,
        summary: values.summary,
        attitudeToPlayer: values.attitudeToPlayer,
        detailedBio: values.detailedBio,
        ...(promptSupplement ? { promptSupplement } : {}),
      });
      if (!res?.success || !res.data?.avatarUrl) {
        toast.error(res?.message || '头像生成失败');
        return;
      }
      setField('avatarUrl', res.data.avatarUrl);
      if (res.data.avatarThumbUrl) {
        setField('avatarThumbUrl', res.data.avatarThumbUrl);
      } else {
        setField('avatarThumbUrl', '');
      }
      if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(`头像已生成（-${res.data.pointsDeducted ?? CHARACTER_GENERATION_COST} 积分）`);
      setAvatarPromptSupplement('');
    } catch (e) {
      toast.error((e as Error)?.message || '头像生成失败');
    } finally {
      setAiBusy((prev) => ({ ...prev, avatar: false }));
    }
  };

  const runGenerateField = async (field: ProfileTextField) => {
    setConfirmKind(null);
    if (!token || !sessionId) return;
    if (isAiBusy(field)) return;
    setAiBusy((prev) => ({ ...prev, [field]: true }));
    try {
      const res = await sessionPlayerProfileApi.generateNpcProfileField(token, sessionId, {
        field,
        name: values.name,
        gender: values.gender,
        relationship: values.relationship,
        summary: values.summary,
        attitudeToPlayer: values.attitudeToPlayer,
        detailedBio: values.detailedBio,
      });
      if (!res?.success || !res.data?.text) {
        toast.error(res?.message || `${PROFILE_FIELD_LABEL[field]}生成失败`);
        return;
      }
      setField(field, res.data.text);
      if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(
        `${PROFILE_FIELD_LABEL[field]}已生成（-${res.data.pointsDeducted ?? NPC_PROFILE_FIELD_GENERATION_COST} 积分）`,
      );
    } catch (e) {
      toast.error((e as Error)?.message || `${PROFILE_FIELD_LABEL[field]}生成失败`);
    } finally {
      setAiBusy((prev) => ({ ...prev, [field]: false }));
    }
  };

  const avatarBasePrompt = useMemo(
    () => buildSessionNpcAvatarPrompt(values),
    [values],
  );

  const closeConfirmModal = () => {
    setConfirmKind(null);
    setAvatarPromptOpen(false);
  };

  const handleConfirmGenerate = () => {
    if (!confirmKind) return;
    if (confirmKind === 'avatar') {
      void runGenerateAvatar();
      return;
    }
    void runGenerateField(confirmKind);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checked = validateCharacterProfileInput({
      ...values,
      favorability: initial?.favorability,
      importance: values.importance || undefined,
      survival: values.survival || undefined,
      avatarUrl: values.avatarUrl.trim() || undefined,
      avatarThumbUrl: values.avatarThumbUrl || undefined,
      genderManuallySet: genderTouched || initial?.genderManuallySet === true,
    });
    if (!checked.ok || !checked.data) {
      toast.error(checked.message || '表单无效');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...checked.data,
        id: draftId,
        genderManuallySet: genderTouched || initial?.genderManuallySet === true,
      });
      // 无头像时提示可稍后生成；不阻塞保存
      if (!values.avatarUrl.trim()) {
        toast('角色已保存；头像可稍后在编辑中生成');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formScroll} ref={formScrollRef}>
        <div className={styles.formTop}>
          <h3 className={styles.formTitle}>{formTitle}</h3>
          <button type="button" className={styles.formClose} onClick={onCancel} aria-label="关闭" disabled={formLocked}>
            ×
          </button>
        </div>

        <section className={styles.avatarBlock} aria-label="角色头像">
          <button
            type="button"
            className={styles.avatarFrame}
            onClick={openAvatarPreview}
            aria-label={`查看 ${previewName} 头像与介绍`}
          >
            {avatarThumbSrc ? (
              <img className={styles.avatarImg} src={avatarThumbSrc} alt="角色头像" />
            ) : avatarThumbsPending ? (
              <div className={styles.avatarLoading} role="status" aria-label="头像加载中">
                <span className={styles.avatarLoadingPulse} aria-hidden />
              </div>
            ) : (
              <div className={styles.avatarEmpty}>头像</div>
            )}
          </button>
          <div className={styles.avatarActions}>
            {reqLabel('头像', false)}
            <p className={styles.avatarHint}>
              点击头像可放大预览；可先保存再生成（AI 生成消耗 {CHARACTER_GENERATION_COST} 积分）
            </p>
            <button
              type="button"
              className={styles.avatarGenBtn}
              disabled={formLocked || isAiBusy('avatar')}
              onClick={() => {
                void requestGenerateAvatar();
              }}
            >
              {isAiBusy('avatar') ? '生成中…' : `AI 生成头像 · ${CHARACTER_GENERATION_COST} 积分`}
            </button>
          </div>
        </section>

        <section className={styles.block} aria-label="必填档案">
          <label className={styles.field}>
            {reqLabel('姓名', true)}
            <input
              value={values.name}
              maxLength={CHARACTER_PROFILE_LIMITS.name.max}
              placeholder="角色姓名"
              onChange={(e) => setField('name', e.target.value)}
            />
          </label>

          <div className={styles.field}>
            {reqLabel('性别', true)}
            <div className={styles.chips} role="radiogroup" aria-label="性别">
              {(values.gender === 'other' || values.gender === 'unknown'
                ? NPC_GENDERS
                : NPC_GENDERS.filter((g) => g !== 'other' && g !== 'unknown')
              ).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={values.gender === g}
                  className={`${styles.chip} ${values.gender === g ? styles.chipActive : ''}`}
                  onClick={() => {
                    setGenderTouched(true);
                    setField('gender', g);
                  }}
                >
                  {GENDER_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            {fieldLabelWithAi({
              text: `关系（≤${CHARACTER_PROFILE_LIMITS.relationship.max}）`,
              required: true,
              busy: isAiBusy('relationship'),
              disabled: formLocked,
              onAi: () => {
                void requestGenerateField('relationship');
              },
            })}
            <input
              value={values.relationship}
              maxLength={CHARACTER_PROFILE_LIMITS.relationship.max}
              placeholder="与你的关系"
              disabled={isAiBusy('relationship')}
              onChange={(e) => setField('relationship', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            {fieldLabelWithAi({
              text: `简介（≤${CHARACTER_PROFILE_LIMITS.summary.max}）`,
              required: true,
              busy: isAiBusy('summary'),
              disabled: formLocked,
              onAi: () => {
                void requestGenerateField('summary');
              },
            })}
            <textarea
              value={values.summary}
              maxLength={CHARACTER_PROFILE_LIMITS.summary.max}
              rows={3}
              placeholder="一句话人物简介"
              disabled={isAiBusy('summary')}
              onChange={(e) => setField('summary', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            {fieldLabelWithAi({
              text: `对你的态度（≤${CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}）`,
              required: true,
              busy: isAiBusy('attitudeToPlayer'),
              disabled: formLocked,
              onAi: () => {
                void requestGenerateField('attitudeToPlayer');
              },
            })}
            <textarea
              value={values.attitudeToPlayer}
              maxLength={CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}
              rows={2}
              placeholder="TA 对你的态度"
              disabled={isAiBusy('attitudeToPlayer')}
              onChange={(e) => setField('attitudeToPlayer', e.target.value)}
            />
          </div>
        </section>

        <button
          type="button"
          ref={supplementToggleRef}
          className={styles.supplementToggle}
          aria-expanded={supplementOpen}
          onClick={() => {
            setSupplementOpen((open) => {
              if (!open) pendingSupplementScrollRef.current = true;
              return !open;
            });
          }}
        >
          <span>补充档案（选填）</span>
          <span className={`${styles.chevron} ${supplementOpen ? styles.chevronOpen : ''}`} aria-hidden>
            ▾
          </span>
        </button>

        {supplementOpen ? (
          <section className={styles.supplement} aria-label="补充档案">
            <div className={styles.field}>
              {fieldLabelWithAi({
                text: `详细简介（≤${CHARACTER_PROFILE_LIMITS.detailedBio.max}）`,
                busy: isAiBusy('detailedBio'),
                disabled: formLocked,
                onAi: () => {
                  void requestGenerateField('detailedBio');
                },
              })}
              <textarea
                value={values.detailedBio}
                maxLength={CHARACTER_PROFILE_LIMITS.detailedBio.max}
                rows={4}
                placeholder="可写经历、习惯、秘密等补充人设…"
                disabled={isAiBusy('detailedBio')}
                onChange={(e) => setField('detailedBio', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.labelRow}>重要程度</span>
              <div className={styles.chips} role="group" aria-label="重要程度">
                {NPC_IMPORTANCE.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.chip} ${values.importance === v ? styles.chipActive : ''}`}
                    onClick={() => setField('importance', values.importance === v ? '' : v)}
                  >
                    {IMPORTANCE_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.labelRow}>存活</span>
              <div className={styles.chips} role="group" aria-label="存活">
                {NPC_SURVIVAL.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.chip} ${values.survival === v ? styles.chipActive : ''}`}
                    onClick={() => setField('survival', values.survival === v ? '' : v)}
                  >
                    {SURVIVAL_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={formLocked}>
            取消
          </button>
          <button type="submit" className={styles.primary} disabled={formLocked || anyAiBusy}>
            {saving ? '保存中…' : submitLabel}
          </button>
        </div>
      </form>

      <GameConfirmModal
        isOpen={Boolean(confirmKind)}
        variant="dossier"
        title={confirmKind === 'avatar'
          ? '确认生成头像'
          : `确认生成${confirmKind ? PROFILE_FIELD_LABEL[confirmKind] : ''}`}
        message={confirmKind === 'avatar' ? (
          <div className={styles.confirmMsgStack}>
            <p className={styles.confirmMsgText}>
              {`将扣除 ${CHARACTER_GENERATION_COST} 积分生成 AI 头像，是否继续？`}
            </p>
            <button
              type="button"
              className={`${styles.promptCueBtn} ${avatarPromptOpen ? styles.promptCueBtnActive : ''}`}
              onClick={() => setAvatarPromptOpen((open) => !open)}
              aria-expanded={avatarPromptOpen}
            >
              <span>{avatarPromptOpen ? '收起提示词' : '提示词补充'}</span>
              <span className={styles.promptCueChevron} aria-hidden>
                {avatarPromptOpen ? '▴' : '▾'}
              </span>
            </button>
          </div>
        ) : (
          `将扣除 ${NPC_PROFILE_FIELD_GENERATION_COST} 积分生成「${confirmKind ? PROFILE_FIELD_LABEL[confirmKind] : ''}」，是否继续？`
        )}
        confirmText="确认生成"
        cancelText="取消"
        overlayZIndex={3600}
        onConfirm={handleConfirmGenerate}
        onCancel={closeConfirmModal}
      >
        {confirmKind === 'avatar' && avatarPromptOpen ? (
          <div className={styles.promptCuePanel} role="region" aria-label="头像生成提示词">
            <div className={styles.promptCueSection}>
              <div className={styles.promptCueLabelRow}>
                <label className={styles.promptCueLabel} htmlFor="npc-avatar-base-prompt">
                  当前提示词
                </label>
                <span className={styles.promptCueHint}>只读</span>
              </div>
              <textarea
                id="npc-avatar-base-prompt"
                className={styles.promptCueReadonly}
                value={avatarBasePrompt}
                readOnly
                rows={4}
              />
            </div>
            <div className={styles.promptCueSection}>
              <div className={styles.promptCueLabelRow}>
                <label className={styles.promptCueLabel} htmlFor="npc-avatar-prompt-supplement">
                  补充描述
                </label>
                <span className={styles.promptCueHint}>拼到末尾 · {avatarPromptSupplement.trim().length}/500</span>
              </div>
              <textarea
                id="npc-avatar-prompt-supplement"
                className={styles.promptCueInput}
                value={avatarPromptSupplement}
                onChange={(e) => setAvatarPromptSupplement(e.target.value.slice(0, 500))}
                placeholder="短发、校服、冷白皮、侧分刘海…"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
        ) : null}
      </GameConfirmModal>

      {previewOpen && (avatarFullSrc || avatarThumbSrc) ? (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${previewName} 人物介绍`}
          onClick={() => setPreviewOpen(false)}
        >
          <div className={styles.previewCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewChrome}>
              <span className={styles.previewChromeLabel}>人物笺</span>
              <button
                type="button"
                className={styles.previewClose}
                onClick={() => setPreviewOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewPortraitWrap}>
                <img className={styles.previewPortrait} src={avatarFullSrc} alt={previewName} />
              </div>
              <h3 className={styles.previewName}>{previewName}</h3>
              {introRelation ? (
                <p className={styles.previewMeta}>关系：{introRelation}</p>
              ) : null}
              <div className={styles.previewIntro}>
                <h4 className={styles.previewIntroTitle}>人物介绍</h4>
                {hasIntro ? (
                  <>
                    {introSummary ? <p className={styles.previewIntroBody}>{introSummary}</p> : null}
                    {introAttitude ? (
                      <p className={styles.previewIntroBody}>对你的态度：{introAttitude}</p>
                    ) : null}
                    {introBio ? <p className={styles.previewIntroBody}>{introBio}</p> : null}
                  </>
                ) : (
                  <p className={styles.previewIntroMuted}>暂无人物介绍</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CharacterProfileForm;
