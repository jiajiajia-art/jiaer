import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  applyPlayerCardImport,
  filterPlayerCharacterCards,
  previewPlayerCardImportDiff,
  type PlayerCharacterCard,
  type SessionPlayerProfile,
  validatePlayerCharacterCardInput,
} from '../../../lib/galgame/playerCharacterCard';
import { playerCharacterCardsApi, sessionPlayerProfileApi } from '../../../api/galgame/playerCharacterCards';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import shell from './PlayPanelShell.module.css';
import styles from './PlayerArchiveSection.module.css';

interface PlayerArchiveSectionProps {
  profile: SessionPlayerProfile | null;
  onProfileChange: (profile: SessionPlayerProfile) => void;
}

/** 功能注释：属性面板「我的档案」+ 账号卡库导入覆盖。 */
const PlayerArchiveSection: React.FC<PlayerArchiveSectionProps> = ({
  profile,
  onProfileChange,
}) => {
  const authUser = useAuthStore((s) => s.user);
  const { sessionId } = useGameStore();
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cards, setCards] = useState<PlayerCharacterCard[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({
    name: profile?.name || '',
    gender: (profile?.gender || 'other') as SessionPlayerProfile['gender'],
    persona: profile?.persona || '',
  });

  const filtered = useMemo(
    () => filterPlayerCharacterCards(cards, query),
    [cards, query],
  );

  const openEdit = () => {
    setDraft({
      name: profile?.name || '',
      gender: profile?.gender || 'other',
      persona: profile?.persona || '',
    });
    setEditing(true);
    setImporting(false);
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
    if (sessionId && token) {
      const res = await sessionPlayerProfileApi.putPlayerProfile(token, sessionId, next);
      if (!res?.success) {
        toast.error(res?.message || '保存失败');
        return;
      }
    }
    onProfileChange(next);
    setEditing(false);
    toast.success('档案已更新');
  };

  const openImport = async () => {
    if (!authUser?.token) {
      toast.error('请先登录后再导入角色卡');
      return;
    }
    setImporting(true);
    setEditing(false);
    const res = await playerCharacterCardsApi.list(authUser.token, '');
    if (!res?.success) {
      toast.error(res?.message || '加载卡库失败');
      setImporting(false);
      return;
    }
    setCards(Array.isArray(res.data) ? res.data : []);
  };

  const confirmImport = async (card: PlayerCharacterCard) => {
    const preview = previewPlayerCardImportDiff(profile, card);
    if (!preview.ok || !preview.next) {
      toast.error(preview.message || '无法导入');
      return;
    }
    const token = authUser?.token;
    if (!token || !sessionId) {
      toast.error('会话不可用');
      return;
    }
    const res = await playerCharacterCardsApi.importToSession(token, sessionId, card.id);
    if (!res?.success) {
      toast.error(res?.message || '导入失败');
      return;
    }
    const applied = applyPlayerCardImport(card, { currentUserId: authUser?.user?.userId });
    if (applied.ok) {
      onProfileChange(applied.profile);
      setImporting(false);
      toast.success('已覆盖当前局玩家档案');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h3 className={styles.title}>我的档案（自设）</h3>
        <div className={styles.headActions}>
          <button type="button" className={shell.backButton} onClick={openEdit}>编辑档案</button>
          <button type="button" className={shell.backButton} onClick={() => void openImport()}>导入角色卡</button>
        </div>
      </div>

      {!editing && !importing ? (
        <div className={shell.card}>
          <div className={shell.cardTitle}>{profile?.name || '未设置姓名'}</div>
          <div className={shell.cardMeta}>
            {profile?.gender === 'male' ? '男' : profile?.gender === 'female' ? '女' : '其他'}
          </div>
          <p className={shell.cardBody}>{profile?.persona || '暂无人设'}</p>
          {profile?.customAttributes && Object.keys(profile.customAttributes).length > 0 ? (
            <div className={styles.attrRow}>
              {Object.entries(profile.customAttributes).map(([k, v]) => (
                <span key={k} className={styles.attrChip}>{k} {v}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className={styles.editBox}>
          <label className={styles.field}>
            <span>姓名</span>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>性别</span>
            <select
              value={draft.gender}
              onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value as SessionPlayerProfile['gender'] }))}
            >
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>人设</span>
            <textarea
              rows={3}
              value={draft.persona}
              onChange={(e) => setDraft((d) => ({ ...d, persona: e.target.value }))}
            />
          </label>
          <div className={styles.actions}>
            <button type="button" className={shell.backButton} onClick={() => setEditing(false)}>取消</button>
            <button type="button" className={shell.backButton} onClick={() => void saveEdit()}>保存</button>
          </div>
        </div>
      ) : null}

      {importing ? (
        <div className={styles.editBox}>
          <input
            className={styles.search}
            placeholder="搜索卡库"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filtered.length === 0 ? (
            <div className={shell.empty}>卡库为空，请先在账号下创建角色卡</div>
          ) : (
            filtered.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`${shell.card} ${shell.charCardButton}`}
                onClick={() => void confirmImport(card)}
              >
                <div className={shell.cardTitle}>{card.name}</div>
                <div className={shell.cardMeta}>将覆盖当前玩家档案</div>
                <p className={shell.cardBody}>{card.persona || '无人设'}</p>
              </button>
            ))
          )}
          <button type="button" className={shell.backButton} onClick={() => setImporting(false)}>关闭卡库</button>
        </div>
      ) : null}

      <div className={styles.dynHint}>下方为动态属性面板（LLM），与自设属性分区，互不覆盖。</div>
    </section>
  );
};

export default PlayerArchiveSection;
