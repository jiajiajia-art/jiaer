import React, { useEffect, useState } from 'react';
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
  favorability: string;
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
  favorability: '',
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
    favorability: p.favorability != null ? String(p.favorability) : '',
  };
}

interface CharacterProfileFormProps {
  initial?: Partial<PlayerEditableNpc> | null;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (profile: Omit<PlayerEditableNpc, 'id' | 'source' | 'encountered'>) => void | Promise<void>;
}

const GENDER_LABEL: Record<NpcGender, string> = {
  male: '男',
  female: '女',
  other: '其他',
  unknown: '未知',
};

/** 功能注释：局内添加/编辑角色档案表单（必填+选填补充）。 */
const CharacterProfileForm: React.FC<CharacterProfileFormProps> = ({
  initial,
  submitLabel = '保存',
  onCancel,
  onSubmit,
}) => {
  const [values, setValues] = useState<CharacterProfileFormValues>(() => profileToValues(initial));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(profileToValues(initial));
  }, [initial]);

  const setField = <K extends keyof CharacterProfileFormValues>(key: K, value: CharacterProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checked = validateCharacterProfileInput({
      ...values,
      favorability: values.favorability === '' ? undefined : Number(values.favorability),
      importance: values.importance || undefined,
      survival: values.survival || undefined,
    });
    if (!checked.ok || !checked.data) {
      toast.error(checked.message || '表单无效');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(checked.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>姓名 *</span>
        <input
          value={values.name}
          maxLength={CHARACTER_PROFILE_LIMITS.name.max}
          onChange={(e) => setField('name', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>性别 *</span>
        <select
          value={values.gender}
          onChange={(e) => setField('gender', e.target.value as NpcGender)}
        >
          {NPC_GENDERS.map((g) => (
            <option key={g} value={g}>{GENDER_LABEL[g]}</option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>关系 *（≤{CHARACTER_PROFILE_LIMITS.relationship.max}）</span>
        <input
          value={values.relationship}
          maxLength={CHARACTER_PROFILE_LIMITS.relationship.max}
          onChange={(e) => setField('relationship', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>简介 *（≤{CHARACTER_PROFILE_LIMITS.summary.max}）</span>
        <textarea
          value={values.summary}
          maxLength={CHARACTER_PROFILE_LIMITS.summary.max}
          rows={3}
          onChange={(e) => setField('summary', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>对你的态度 *（≤{CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}）</span>
        <textarea
          value={values.attitudeToPlayer}
          maxLength={CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max}
          rows={2}
          onChange={(e) => setField('attitudeToPlayer', e.target.value)}
        />
      </label>

      <div className={styles.sectionTitle}>补充档案（选填）</div>
      <label className={styles.field}>
        <span>详细简介（≤{CHARACTER_PROFILE_LIMITS.detailedBio.max}）</span>
        <textarea
          value={values.detailedBio}
          maxLength={CHARACTER_PROFILE_LIMITS.detailedBio.max}
          rows={3}
          onChange={(e) => setField('detailedBio', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>重要程度</span>
        <select
          value={values.importance}
          onChange={(e) => setField('importance', e.target.value as NpcImportance | '')}
        >
          <option value="">未设置</option>
          {NPC_IMPORTANCE.map((v) => (
            <option key={v} value={v}>{v === 'major' ? '重要' : v === 'minor' ? '次要' : '路人'}</option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>存活</span>
        <select
          value={values.survival}
          onChange={(e) => setField('survival', e.target.value as NpcSurvival | '')}
        >
          <option value="">未设置</option>
          {NPC_SURVIVAL.map((v) => (
            <option key={v} value={v}>{v === 'alive' ? '存活' : v === 'dead' ? '死亡' : '未知'}</option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>好感度（0–100）</span>
        <input
          type="number"
          min={0}
          max={100}
          value={values.favorability}
          onChange={(e) => setField('favorability', e.target.value)}
        />
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
          取消
        </button>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default CharacterProfileForm;
