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
import { playerCharacterCardsApi, sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import shell from './PlayPanelShell.module.css';
import styles from './PlayerArchiveSection.module.css';

export type PlayerArchiveView = 'overview' | 'edit' | 'import' | 'preview';

interface PlayerArchiveSectionProps {
  profile: SessionPlayerProfile | null;
  onProfileChange: (profile: SessionPlayerProfile) => void;
  view: PlayerArchiveView;
  onViewChange: (view: PlayerArchiveView) => void;
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
}) => {
  const authUser = useAuthStore((s) => s.user);
  const { sessionId } = useGameStore();
  const [saving, setSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [query, setQuery] = useState('');
  const [previewCard, setPreviewCard] = useState<PlayerCharacterCard | null>(null);
  const [draft, setDraft] = useState({
    name: profile?.name || '',
    gender: (profile?.gender || 'other') as PlayerCardGender,
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

  const openEdit = () => {
    setDraft({
      name: profile?.name || '',
      gender: (profile?.gender && PLAYER_CARD_GENDERS.includes(profile.gender)
        ? profile.gender
        : 'other') as PlayerCardGender,
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
    if (!checked.ok || !checked.data) {
      toast.error(checked.message || '档案无效');
      return;
    }
    const next: SessionPlayerProfile = {
      name: checked.data.name,
      gender: checked.data.gender,
      persona: checked.data.persona,
      customAttributes: profile?.customAttributes || {},
      importedCardId: profile?.importedCardId,
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
      }
      onProfileChange(next);
      onViewChange('overview');
      toast.success('档案已更新');
    } finally {
      setSaving(false);
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
      onProfileChange(applied.profile);
      closeToOverview();
      toast.success('已覆盖当前局玩家档案');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'edit') {
    return (
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
            disabled={saving}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

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
                onClick={() => setDraft((d) => ({ ...d, gender: g }))}
              >
                {GENDER_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.labelRow}>
            人设
            <span className={styles.counter}>
              {draft.persona.length}/{PLAYER_CARD_LIMITS.persona.max}
            </span>
          </span>
          <textarea
            rows={5}
            value={draft.persona}
            maxLength={PLAYER_CARD_LIMITS.persona.max}
            placeholder="性格、身份、经历…"
            onChange={(e) => setDraft((d) => ({ ...d, persona: e.target.value }))}
          />
        </label>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={closeToOverview}
            disabled={saving}
          >
            取消
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
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
        <div className={styles.profileRow}>
          <span className={styles.profileKey}>姓名</span>
          <span className={styles.profileVal}>{profile?.name || '未设置'}</span>
        </div>
        <div className={styles.profileRow}>
          <span className={styles.profileKey}>性别</span>
          <span className={styles.profileVal}>{genderText(profile?.gender)}</span>
        </div>
        <div className={styles.profileBlock}>
          <span className={styles.profileKey}>人设</span>
          <p className={styles.profilePersona}>{profile?.persona || '暂无人设'}</p>
        </div>
      </div>

      <p className={styles.dynHint}>下方为动态属性面板（LLM），与自设属性分区，互不覆盖。</p>
    </section>
  );
};

export default PlayerArchiveSection;
