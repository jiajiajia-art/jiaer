import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CHARACTER_PROFILE_LIMITS,
  NPC_GENDERS,
  NPC_IMPORTANCE,
  NPC_SURVIVAL,
  type NpcGender,
  type NpcImportance,
  type NpcSurvival,
  type PlayerEditableNpc,
  validateCharacterProfileInput,
} from '../../../lib/galgame/characterProfile';
import { sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import { CHARACTER_GENERATION_COST, getImageUrl } from '../../../utils/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import GameConfirmModal from '../GameConfirmModal';
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
};

const emptyValues = (): CharacterProfileFormValues => ({
  name: '',
  gender: 'unknown',
  relationship: '',
  summary: '',
  attitudeToPlayer: '',
  detailedBio: '',
  importance: '',
  survival: '',
  avatarUrl: '',
});

function profileToValues(p?: Partial<PlayerEditableNpc> | null): CharacterProfileFormValues {
  if (!p) return emptyValues();
  return {
    name: String(p.name || ''),
    gender: (p.gender as NpcGender) || 'unknown',
    relationship: String(p.relationship || ''),
    summary: String(p.summary || ''),
    attitudeToPlayer: String(p.attitudeToPlayer || ''),
    detailedBio: String(p.detailedBio || ''),
    importance: (p.importance as NpcImportance) || '',
    survival: (p.survival as NpcSurvival) || '',
    avatarUrl: String(p.avatarUrl || ''),
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

/** 功能注释：局内添加/编辑角色档案（UE：头像 + 必填 + 可折叠补充档案）。 */
const CharacterProfileForm: React.FC<CharacterProfileFormProps> = ({
  initial,
  submitLabel = '保存',
  formTitle = '添加新角色',
  onCancel,
  onSubmit,
}) => {
  const token = useAuthStore((s) => s.user?.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const userPoints = useAuthStore((s) => s.user?.user?.points);
  const { sessionId } = useGameStore();
  const draftId = useMemo(() => String(initial?.id || newDraftId()), [initial?.id]);
  const [values, setValues] = useState<CharacterProfileFormValues>(() => profileToValues(initial));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(() => Boolean(
    initial?.detailedBio || initial?.importance || initial?.survival,
  ));

  useEffect(() => {
    setValues(profileToValues(initial));
    setSupplementOpen(Boolean(initial?.detailedBio || initial?.importance || initial?.survival));
  }, [initial]);

  const setField = <K extends keyof CharacterProfileFormValues>(key: K, value: CharacterProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const avatarSrc = getImageUrl(values.avatarUrl);
  const previewName = values.name.trim() || '未命名角色';
  const introSummary = values.summary.trim();
  const introAttitude = values.attitudeToPlayer.trim();
  const introRelation = values.relationship.trim();
  const introBio = values.detailedBio.trim();
  const hasIntro = Boolean(introSummary || introAttitude || introRelation || introBio);

  const openAvatarPreview = () => {
    if (!avatarSrc) {
      toast.error('请先生成角色头像');
      return;
    }
    setPreviewOpen(true);
  };

  const requestGenerate = () => {
    if (!values.name.trim()) {
      toast.error('请先填写姓名再生成头像');
      return;
    }
    if (!token || !sessionId) {
      toast.error('请先登录并进入对局');
      return;
    }
    setConfirmOpen(true);
  };

  const runGenerate = async () => {
    setConfirmOpen(false);
    if (!token || !sessionId) return;
    setGenerating(true);
    try {
      const res = await sessionPlayerProfileApi.generateNpcAvatar(token, sessionId, {
        npcId: draftId,
        name: values.name,
        gender: values.gender,
        relationship: values.relationship,
        summary: values.summary,
        attitudeToPlayer: values.attitudeToPlayer,
        detailedBio: values.detailedBio,
      });
      if (!res?.success || !res.data?.avatarUrl) {
        toast.error(res?.message || '头像生成失败');
        return;
      }
      setField('avatarUrl', res.data.avatarUrl);
      if (typeof res.data.remainingPoints === 'number') {
        updateUser({ points: res.data.remainingPoints });
      }
      toast.success(`头像已生成（-${res.data.pointsDeducted ?? CHARACTER_GENERATION_COST} 积分）`);
    } catch (e) {
      toast.error((e as Error)?.message || '头像生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.avatarUrl.trim()) {
      toast.error('请先生成角色头像');
      return;
    }
    const checked = validateCharacterProfileInput({
      ...values,
      favorability: initial?.favorability,
      importance: values.importance || undefined,
      survival: values.survival || undefined,
      avatarUrl: values.avatarUrl,
    });
    if (!checked.ok || !checked.data) {
      toast.error(checked.message || '表单无效');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...checked.data, id: draftId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formScroll}>
        <div className={styles.formTop}>
          <h3 className={styles.formTitle}>{formTitle}</h3>
          <button type="button" className={styles.formClose} onClick={onCancel} aria-label="关闭" disabled={saving || generating}>
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
            {avatarSrc ? (
              <img className={styles.avatarImg} src={avatarSrc} alt="角色头像" />
            ) : (
              <div className={styles.avatarEmpty}>头像</div>
            )}
          </button>
          <div className={styles.avatarActions}>
            {reqLabel('头像', true)}
            <p className={styles.avatarHint}>
              点击头像可放大预览；AI 生成消耗 {CHARACTER_GENERATION_COST} 积分
              {typeof userPoints === 'number' ? `（当前 ${userPoints}）` : ''}
            </p>
            <button
              type="button"
              className={styles.avatarGenBtn}
              disabled={generating || saving}
              onClick={requestGenerate}
            >
              {generating ? '生成中…' : `AI 生成头像 · ${CHARACTER_GENERATION_COST} 积分`}
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
              {(values.gender === 'other'
                ? NPC_GENDERS
                : NPC_GENDERS.filter((g) => g !== 'other')
              ).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={values.gender === g}
                  className={`${styles.chip} ${values.gender === g ? styles.chipActive : ''}`}
                  onClick={() => setField('gender', g)}
                >
                  {GENDER_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            {reqLabel(`关系（≤${CHARACTER_PROFILE_LIMITS.relationship.max}）`, true)}
            <input
              value={values.relationship}
              maxLength={CHARACTER_PROFILE_LIMITS.relationship.max}
              placeholder="与你的关系"
              onChange={(e) => setField('relationship', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            {reqLabel(`简介（≤${CHARACTER_PROFILE_LIMITS.summary.max}）`, true)}
            <textarea
              value={values.summary}
              maxLength={CHARACTER_PROFILE_LIMITS.summary.max}
              rows={3}
              placeholder="一句话人物简介"
              onChange={(e) => setField('summary', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            {reqLabel(`对你的态度（≤${CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}）`, true)}
            <textarea
              value={values.attitudeToPlayer}
              maxLength={CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}
              rows={2}
              placeholder="TA 对你的态度"
              onChange={(e) => setField('attitudeToPlayer', e.target.value)}
            />
          </label>
        </section>

        <button
          type="button"
          className={styles.supplementToggle}
          aria-expanded={supplementOpen}
          onClick={() => setSupplementOpen((v) => !v)}
        >
          <span>补充档案（选填）</span>
          <span className={`${styles.chevron} ${supplementOpen ? styles.chevronOpen : ''}`} aria-hidden>
            ▾
          </span>
        </button>

        {supplementOpen ? (
          <section className={styles.supplement} aria-label="补充档案">
            <label className={styles.field}>
              <span className={styles.labelRow}>
                详细简介（≤{CHARACTER_PROFILE_LIMITS.detailedBio.max}）
              </span>
              <textarea
                value={values.detailedBio}
                maxLength={CHARACTER_PROFILE_LIMITS.detailedBio.max}
                rows={4}
                placeholder="可写经历、习惯、秘密等补充人设…"
                onChange={(e) => setField('detailedBio', e.target.value)}
              />
            </label>

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
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving || generating}>
            取消
          </button>
          <button type="submit" className={styles.primary} disabled={saving || generating}>
            {saving ? '保存中…' : submitLabel}
          </button>
        </div>
      </form>

      <GameConfirmModal
        isOpen={confirmOpen}
        title="确认生成头像"
        message={`将扣除 ${CHARACTER_GENERATION_COST} 积分生成 AI 头像${typeof userPoints === 'number' ? `（当前积分 ${userPoints}）` : ''}，是否继续？`}
        confirmText="确认生成"
        cancelText="取消"
        overlayZIndex={3600}
        onConfirm={() => { void runGenerate(); }}
        onCancel={() => setConfirmOpen(false)}
      />

      {previewOpen && avatarSrc ? (
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
                <img className={styles.previewPortrait} src={avatarSrc} alt={previewName} />
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
